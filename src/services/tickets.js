import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
  PermissionFlagsBits,
} from 'discord.js';
import { GuildConfig } from '../database/models/GuildConfig.js';
import { Ticket } from '../database/models/Ticket.js';
import { buildTicketPanelPayload } from '../utils/ticketPanel.js';

function sanitizeChannelName(name) {
  return String(name || 'user')
    .toLowerCase()
    .replace(/[^a-z0-9-_]/gi, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80) || 'user';
}

/**
 * Crée un salon ticket et enregistre l’entrée.
 */
export async function openTicketInteraction(interaction, client, buttonId) {
  const guild = interaction.guild;
  const guildId = guild.id;
  const userId = interaction.user.id;

  const cfg = await GuildConfig.findOne({ guildId }).lean();
  if (!cfg?.ticketCategoryId) {
    await interaction.reply({
      content: 'Tickets non configurés : utilise **`-ticketcat`** pour définir la **catégorie**.',
      ephemeral: true,
    });
    return;
  }

  const existing = await Ticket.findOne({ guildId, openerId: userId, closedAt: null }).lean();
  if (existing) {
    await interaction.reply({
      content: `Tu as déjà un ticket ouvert : <#${existing.channelId}>`,
      ephemeral: true,
    });
    return;
  }

  const member = await guild.members.fetch(userId).catch(() => null);
  if (!member) {
    await interaction.reply({ content: 'Membre introuvable.', ephemeral: true });
    return;
  }

  const parent = await guild.channels.fetch(cfg.ticketCategoryId).catch(() => null);
  if (!parent || parent.type !== ChannelType.GuildCategory) {
    await interaction.reply({
      content: '**Catégorie** tickets introuvable. Refais **`-ticketcat`**.',
      ephemeral: true,
    });
    return;
  }

  const safeName = sanitizeChannelName(member.user.username);
  const base = `ticket-${safeName}`.slice(0, 90);
  let name = base;
  let suffix = 0;
  const exists = (n) =>
    guild.channels.cache.some(
      (c) => c.parentId === parent.id && c.name === n && c.type === ChannelType.GuildText
    );
  while (exists(name) && suffix < 200) {
    suffix++;
    name = `${base}-${suffix}`.slice(0, 100);
  }

  const overwrites = [
    { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
    {
      id: userId,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.EmbedLinks,
      ],
    },
    {
      id: client.user.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ManageChannels,
        PermissionFlagsBits.ManageMessages,
      ],
    },
  ];
  if (cfg.ticketStaffRoleId) {
    overwrites.push({
      id: cfg.ticketStaffRoleId,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.EmbedLinks,
      ],
    });
  }

  let channel;
  try {
    channel = await guild.channels.create({
      name,
      type: ChannelType.GuildText,
      parent: parent.id,
      permissionOverwrites: overwrites,
      reason: `Ticket ouvert (${buttonId})`,
    });
  } catch (e) {
    await interaction.reply({
      content: `Impossible de créer le salon : ${e.message}`,
      ephemeral: true,
    });
    return;
  }

  await Ticket.create({
    guildId,
    channelId: channel.id,
    openerId: userId,
    buttonId,
  });

  await interaction.reply({
    content: `Ticket ouvert : ${channel}`,
    ephemeral: true,
  });

  const welcome = new EmbedBuilder()
    .setTitle('Ticket')
    .setDescription(
      [
        `${member}, bienvenue dans ton ticket.`,
        '',
        `**Type** : \`${buttonId}\``,
        '',
        'Explique ta demande ici. Le **staff** peut répondre dans ce salon.',
        '',
        '· Bouton **Fermer le ticket** : supprime ce salon (toi ou le staff).',
      ].join('\n')
    )
    .setColor(0x57f287);

  const closeRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`t_close:${channel.id}`)
      .setLabel('Fermer le ticket')
      .setStyle(ButtonStyle.Danger)
  );

  await channel.send({ embeds: [welcome], components: [closeRow] });
}

export async function closeTicketInteraction(interaction, client) {
  const id = interaction.customId;
  const channelId = id.slice('t_close:'.length);
  if (interaction.channelId !== channelId) {
    await interaction.reply({ content: 'Ce bouton ne fonctionne que dans le salon du ticket.', ephemeral: true });
    return;
  }

  const ticket = await Ticket.findOne({ channelId, closedAt: null }).lean();
  if (!ticket) {
    await interaction.reply({ content: 'Ticket déjà fermé ou inconnu.', ephemeral: true });
    return;
  }

  const cfg = await GuildConfig.findOne({ guildId: interaction.guildId }).lean();
  const isOpener = ticket.openerId === interaction.user.id;
  const hasStaff =
    cfg?.ticketStaffRoleId && interaction.member?.roles?.cache?.has(cfg.ticketStaffRoleId);
  const mod =
    interaction.member?.permissions?.has(PermissionFlagsBits.ManageChannels) ?? false;

  if (!isOpener && !hasStaff && !mod) {
    await interaction.reply({
      content: 'Seul l’**auteur** du ticket, le **rôle staff** configuré ou un modérateur peut fermer.',
      ephemeral: true,
    });
    return;
  }

  await Ticket.updateOne(
    { _id: ticket._id },
    { $set: { closedAt: new Date() } }
  ).catch(() => {});

  const ch = interaction.channel;
  await interaction.reply({
    content: '**Ticket fermé.** Ce salon va être supprimé.',
    ephemeral: true,
  });

  try {
    await ch.delete('Ticket fermé');
  } catch (e) {
    await interaction.followUp({
      content: `Salon non supprimé : ${e.message}`,
      ephemeral: true,
    }).catch(() => {});
  }
}

/**
 * Envoie ou met à jour le message panneau dans le salon choisi.
 */
export async function syncTicketPanelMessage(interaction, client) {
  const guild = interaction.guild;
  const guildId = guild.id;
  const channelId = interaction.values[0];

  const cfg = await GuildConfig.findOne({ guildId }).lean();
  if (!cfg?.ticketPanelEmbed || !cfg.ticketButtons?.length) {
    await interaction.update({
      content: 'Panneau non configuré : utilise **`-ticketembed`** (JSON depuis la page **ticket-builder**).',
      components: [],
    });
    return;
  }

  if (!cfg.ticketCategoryId) {
    await interaction.update({
      content: 'Catégorie tickets manquante : **`-ticketcat`**.',
      components: [],
    });
    return;
  }

  const ch = await guild.channels.fetch(channelId).catch(() => null);
  if (!ch?.isTextBased()) {
    await interaction.update({ content: 'Salon invalide.', components: [] });
    return;
  }

  const payload = buildTicketPanelPayload(guildId, cfg);
  if (!payload) {
    await interaction.update({ content: 'Configuration panneau invalide.', components: [] });
    return;
  }

  const botMember = await guild.members.fetch(client.user.id).catch(() => null);
  if (!botMember?.permissionsIn(ch)?.has(PermissionFlagsBits.SendMessages)) {
    await interaction.update({
      content: `Je ne peux pas envoyer de messages dans ${ch}.`,
      components: [],
    });
    return;
  }

  try {
    if (cfg.ticketPanelChannelId === channelId && cfg.ticketPanelMessageId) {
      const msg = await ch.messages.fetch(cfg.ticketPanelMessageId).catch(() => null);
      if (msg?.author?.id === client.user.id) {
        await msg.edit(payload);
        await interaction.update({
          content: `Panneau **mis à jour** dans ${ch}.`,
          components: [],
        });
        return;
      }
    }

    const msg = await ch.send(payload);
    await GuildConfig.findOneAndUpdate(
      { guildId },
      {
        $set: {
          ticketPanelChannelId: channelId,
          ticketPanelMessageId: msg.id,
        },
        $setOnInsert: { guildId },
      },
      { upsert: true }
    );

    await interaction.update({
      content: `Panneau **publié** dans ${ch}. Utilise **\-ticketsync** pour mettre à jour après modification.`,
      components: [],
    });
  } catch (e) {
    await interaction.update({
      content: `Erreur : ${e.message}`,
      components: [],
    });
  }
}
