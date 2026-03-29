import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelSelectMenuBuilder,
  ChannelType,
  EmbedBuilder,
  ModalBuilder,
  RoleSelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import { GuildConfig } from '../database/models/GuildConfig.js';
import { RankTier } from '../database/models/RankTier.js';
import { PendingWarn } from '../database/models/PendingWarn.js';
import { WarnRecord } from '../database/models/WarnRecord.js';
import { getUserPower, canUseCommand } from '../utils/permissions.js';
import { sendAdminLog } from '../utils/modLog.js';
import { buildAbsenceAnnouncementEmbed, buildAbsenceButtonRow } from '../utils/absenceEmbed.js';
import { setEmbedDraft, takeEmbedDraft } from '../utils/embedDraftStore.js';

async function safePower(member) {
  if (!member) return null;
  return getUserPower(member);
}

export async function handleInteractionCreate(interaction, client) {
  try {
    if (interaction.isButton()) {
      await handleButton(interaction, client);
      return;
    }
    if (interaction.isRoleSelectMenu()) {
      await handleRoleSelect(interaction, client);
      return;
    }
    if (interaction.isChannelSelectMenu()) {
      await handleChannelSelect(interaction, client);
      return;
    }
    if (interaction.isModalSubmit()) {
      await handleModal(interaction, client);
      return;
    }
  } catch (e) {
    console.error(e);
    const msg = { content: 'Une erreur est survenue.', ephemeral: true };
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(msg).catch(() => {});
    } else {
      await interaction.reply(msg).catch(() => {});
    }
  }
}

async function handleButton(interaction, client) {
  const id = interaction.customId;

  if (id.startsWith('panelcat_btn:')) {
    const [, cat, guildId] = id.split(':');
    if (interaction.guildId !== guildId) return;
    const power = await safePower(interaction.member);
    if (!canUseCommand(power, 1)) {
      await interaction.reply({ content: 'Réservé à la cat. 1.', ephemeral: true });
      return;
    }

    const row = new ActionRowBuilder().addComponents(
      new RoleSelectMenuBuilder()
        .setCustomId(`panelcat_roles:${cat}:${guildId}`)
        .setPlaceholder(`Rôles — catégorie ${cat} (0–25)`)
        .setMinValues(0)
        .setMaxValues(25)
    );

    await interaction.reply({
      content: `Choisis les rôles pour la **catégorie ${cat}** (tu peux en retirer tous pour vider).`,
      components: [row],
      ephemeral: true,
    });
    return;
  }

  if (id.startsWith('absence_start:')) {
    const guildId = id.split(':')[1];
    const guild = client.guilds.cache.get(guildId);
    if (!guild) {
      await interaction.reply({ content: 'Serveur introuvable.', ephemeral: true });
      return;
    }

    await interaction.deferReply({ ephemeral: true });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`absence_fill:${guildId}`)
        .setLabel('Remplir le formulaire')
        .setStyle(ButtonStyle.Primary)
    );

    const embed = new EmbedBuilder()
      .setTitle('Absence')
      .setDescription(
        'Clique sur le bouton ci-dessous pour ouvrir le **formulaire** (en message privé avec le bot).'
      );

    try {
      await interaction.user.send({ embeds: [embed], components: [row] });
      await interaction.editReply({
        content: 'Je t’ai envoyé le formulaire en **message privé**. Pense à activer les MP du serveur.',
      });
    } catch {
      await interaction.editReply({
        content:
          'Impossible de t’envoyer un MP : ouvre tes paramètres et autorise les messages du serveur, puis réessaie.',
      });
    }
    return;
  }

  if (id.startsWith('absence_fill:')) {
    const guildId = id.split(':')[1];

    const modal = new ModalBuilder()
      .setCustomId(`absence_modal:${guildId}`)
      .setTitle('Déclaration d’absence');

    const temps = new TextInputBuilder()
      .setCustomId('abs_temps')
      .setLabel('Temps (durée de l’absence)')
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(200);

    const raison = new TextInputBuilder()
      .setCustomId('abs_raison')
      .setLabel('Raison')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true)
      .setMaxLength(1000);

    modal.addComponents(
      new ActionRowBuilder().addComponents(temps),
      new ActionRowBuilder().addComponents(raison)
    );

    await interaction.showModal(modal);
    return;
  }

  if (id.startsWith('embed_open:')) {
    const guildId = id.split(':')[1];
    if (interaction.guildId !== guildId) return;
    const power = await safePower(interaction.member);
    if (!canUseCommand(power, 5)) {
      await interaction.reply({ content: 'Réservé au **staff** (rôle configuré dans `-panelcat`).', ephemeral: true });
      return;
    }

    const modal = new ModalBuilder().setCustomId(`embed_form:${guildId}`).setTitle('Créer un embed');

    const t = new TextInputBuilder()
      .setCustomId('emb_title')
      .setLabel('Titre')
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(256);

    const d = new TextInputBuilder()
      .setCustomId('emb_desc')
      .setLabel('Description')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true)
      .setMaxLength(4000);

    const c = new TextInputBuilder()
      .setCustomId('emb_color')
      .setLabel('Couleur (hex, ex: 5865F2 ou #57F287)')
      .setStyle(TextInputStyle.Short)
      .setRequired(false)
      .setMaxLength(7)
      .setPlaceholder('5865F2');

    const f = new TextInputBuilder()
      .setCustomId('emb_footer')
      .setLabel('Pied de page (optionnel)')
      .setStyle(TextInputStyle.Short)
      .setRequired(false)
      .setMaxLength(2048);

    const img = new TextInputBuilder()
      .setCustomId('emb_image')
      .setLabel('URL image grande (optionnel)')
      .setStyle(TextInputStyle.Short)
      .setRequired(false)
      .setMaxLength(500);

    modal.addComponents(
      new ActionRowBuilder().addComponents(t),
      new ActionRowBuilder().addComponents(d),
      new ActionRowBuilder().addComponents(c),
      new ActionRowBuilder().addComponents(f),
      new ActionRowBuilder().addComponents(img)
    );

    await interaction.showModal(modal);
    return;
  }

  if (id.startsWith('warn_appr:') || id.startsWith('warn_rej:')) {
    const appr = id.startsWith('warn_appr:');
    const wid = id.split(':')[1];
    if (!interaction.guild) return;

    const power = await safePower(interaction.member);
    if (!canUseCommand(power, 4)) {
      await interaction.reply({
        content: 'Seuls les staff **cat. 1 à 4** peuvent valider ou refuser ce warn.',
        ephemeral: true,
      });
      return;
    }

    const pending = await PendingWarn.findById(wid);
    if (!pending || pending.guildId !== interaction.guild.id) {
      await interaction.reply({ content: 'Demande introuvable ou expirée.', ephemeral: true });
      return;
    }

    if (appr) {
      await WarnRecord.create({
        guildId: pending.guildId,
        targetId: pending.targetId,
        issuerId: pending.issuerId,
        reason: pending.reason,
        approvedById: interaction.user.id,
      });
      await sendAdminLog(client, pending.guildId, {
        title: 'Warn validé',
        description: `**Cible** : <@${pending.targetId}> (\`${pending.targetId}\`)\n**Auteur initial (cat.5)** : <@${pending.issuerId}>\n**Validé par** : ${interaction.user}\n**Raison** : ${pending.reason}`,
        color: 0x57f287,
      });
    } else {
      await sendAdminLog(client, pending.guildId, {
        title: 'Warn refusé',
        description: `**Cible** : <@${pending.targetId}>\n**Auteur** : <@${pending.issuerId}>\n**Refusé par** : ${interaction.user}\n**Raison** : ${pending.reason}`,
        color: 0xed4245,
      });
    }

    await PendingWarn.deleteOne({ _id: pending._id });

    const base = interaction.message.embeds[0];
    const embed = base
      ? EmbedBuilder.from(base).setColor(appr ? 0x57f287 : 0xed4245)
      : new EmbedBuilder()
          .setTitle(appr ? 'Warn validé' : 'Warn refusé')
          .setColor(appr ? 0x57f287 : 0xed4245);
    embed.setFooter({ text: appr ? `Validé par ${interaction.user.tag}` : `Refusé par ${interaction.user.tag}` });

    await interaction.update({
      embeds: [embed],
      components: [],
    });
    return;
  }
}

async function handleRoleSelect(interaction, client) {
  const id = interaction.customId;

  if (id.startsWith('panelcat_roles:')) {
    const [, cat, guildId] = id.split(':');
    if (interaction.guildId !== guildId) return;
    const power = await safePower(interaction.member);
    if (!canUseCommand(power, 1)) {
      await interaction.reply({ content: 'Refusé.', ephemeral: true });
      return;
    }

    const roles = interaction.values;
    await GuildConfig.findOneAndUpdate(
      { guildId },
      { $set: { [`categoryRoles.cat${cat}`]: roles } },
      { upsert: true, new: true }
    );

    await interaction.update({
      content: `Catégorie **${cat}** : ${roles.length ? roles.map((r) => `<@&${r}>`).join(', ') : '*(aucun rôle)*'}.`,
      components: [],
    });
    return;
  }

  if (id.startsWith('ranksetup_role:')) {
    const guildId = id.split(':')[1];
    if (interaction.guildId !== guildId) return;
    const power = await safePower(interaction.member);
    if (!canUseCommand(power, 1)) {
      await interaction.reply({ content: 'Réservé à la cat. 1.', ephemeral: true });
      return;
    }

    const roleId = interaction.values[0];
    const modal = new ModalBuilder()
      .setCustomId(`ranksetup_modal:${guildId}:${roleId}`)
      .setTitle('Objectifs rankup');

    const v = new TextInputBuilder()
      .setCustomId('rank_voice_min')
      .setLabel('Minutes en vocal requises')
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setPlaceholder('ex: 120');

    const m = new TextInputBuilder()
      .setCustomId('rank_msg')
      .setLabel('Nombre de messages requis')
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setPlaceholder('ex: 500');

    modal.addComponents(
      new ActionRowBuilder().addComponents(v),
      new ActionRowBuilder().addComponents(m)
    );

    await interaction.showModal(modal);
    return;
  }

  if (id.startsWith('rankdel_role:')) {
    const guildId = id.split(':')[1];
    if (interaction.guildId !== guildId) return;
    const power = await safePower(interaction.member);
    if (!canUseCommand(power, 1)) {
      await interaction.reply({ content: 'Réservé à la cat. 1.', ephemeral: true });
      return;
    }

    const roleId = interaction.values[0];
    const removed = await RankTier.findOneAndDelete({ guildId, roleId });
    await interaction.deferUpdate();
    await interaction.followUp({
      content: removed
        ? `Palier rankup pour <@&${roleId}> **supprimé**. (Renvoie \`-listrankstaff\` pour rafraîchir.)`
        : `Aucune configuration rankup pour ce rôle.`,
      ephemeral: true,
    });
    return;
  }
}

async function handleChannelSelect(interaction, client) {
  const id = interaction.customId;
  const guildId = interaction.guildId;
  const power = await safePower(interaction.member);
  const channelId = interaction.values[0];

  if (id === `embed_dest:${guildId}`) {
    if (!canUseCommand(power, 5)) {
      await interaction.reply({ content: 'Réservé au **staff**.', ephemeral: true });
      return;
    }

    const draft = takeEmbedDraft(interaction.user.id, guildId);
    if (!draft) {
      await interaction.update({
        content: 'Brouillon expiré ou introuvable. Refais **`-embed`**. ',
        components: [],
      });
      return;
    }

    const ch = await interaction.guild.channels.fetch(channelId).catch(() => null);
    if (!ch?.isTextBased()) {
      await interaction.update({ content: 'Salon invalide.', components: [] });
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle(draft.title)
      .setDescription(draft.description)
      .setColor(draft.color);
    if (draft.footer) embed.setFooter({ text: draft.footer });
    if (draft.imageUrl) {
      try {
        embed.setImage(draft.imageUrl);
      } catch {
        /* ignore */
      }
    }

    try {
      await ch.send({ embeds: [embed] });
      await interaction.update({
        content: `Embed envoyé dans <#${channelId}>.`,
        components: [],
      });
    } catch (e) {
      await interaction.update({
        content: `Impossible d’envoyer dans ce salon : ${e.message}`,
        components: [],
      });
    }
    return;
  }

  if (!canUseCommand(power, 1)) {
    await interaction.reply({ content: 'Réservé à la cat. 1.', ephemeral: true });
    return;
  }

  if (id === `setcfg_adminlog:${guildId}`) {
    await GuildConfig.findOneAndUpdate(
      { guildId },
      { adminLogChannelId: channelId },
      { upsert: true }
    );
    await interaction.update({
      content: `Salon des **logs staff** : <#${channelId}>`,
      components: [],
    });
    return;
  }

  if (id === `setcfg_abs_embed:${guildId}`) {
    await GuildConfig.findOneAndUpdate(
      { guildId },
      { absenceEmbedChannelId: channelId },
      { upsert: true }
    );

    const ch = await interaction.guild.channels.fetch(channelId).catch(() => null);
    if (ch?.isTextBased()) {
      await ch.send({
        embeds: [buildAbsenceAnnouncementEmbed()],
        components: [buildAbsenceButtonRow(guildId)],
      });
    }

    await interaction.update({
      content: `Salon **formulaire absence** : <#${channelId}> — l’embed a été envoyé.`,
      components: [],
    });
    return;
  }

  if (id === `setcfg_abs_resp:${guildId}`) {
    await GuildConfig.findOneAndUpdate(
      { guildId },
      { absenceResponseChannelId: channelId },
      { upsert: true }
    );
    await interaction.update({
      content: `Salon des **réponses d’absence** : <#${channelId}>`,
      components: [],
    });
    return;
  }

  if (id === `setcfg_rank_ann:${guildId}`) {
    await GuildConfig.findOneAndUpdate(
      { guildId },
      { rankupAnnounceChannelId: channelId },
      { upsert: true }
    );
    await interaction.update({
      content: `Salon des **annonces de rankup** : <#${channelId}>`,
      components: [],
    });
    return;
  }
}

async function handleModal(interaction, client) {
  const id = interaction.customId;

  if (id.startsWith('absence_modal:')) {
    const guildId = id.split(':')[1];
    const cfg = await GuildConfig.findOne({ guildId });
    const respId = cfg?.absenceResponseChannelId;
    if (!respId) {
      await interaction.reply({
        content: 'Le salon des réponses n’est pas configuré sur le serveur.',
        ephemeral: true,
      });
      return;
    }

    const guild = client.guilds.cache.get(guildId);
    const ch = guild ? await guild.channels.fetch(respId).catch(() => null) : null;
    if (!ch?.isTextBased()) {
      await interaction.reply({ content: 'Salon des réponses invalide.', ephemeral: true });
      return;
    }

    const temps = interaction.fields.getTextInputValue('abs_temps');
    const raison = interaction.fields.getTextInputValue('abs_raison');

    const member = guild
      ? await guild.members.fetch(interaction.user.id).catch(() => null)
      : null;

    let rolesLine = '*Impossible de charger les rôles (tu as peut-être quitté le serveur).*';
    if (member) {
      const names = member.roles.cache
        .filter((r) => r.id !== guild.id)
        .sort((a, b) => b.position - a.position)
        .map((r) => r.name);
      rolesLine = names.length ? names.join(', ') : '*Aucun rôle*';
      if (rolesLine.length > 950) rolesLine = rolesLine.slice(0, 947) + '…';
    }

    const embed = new EmbedBuilder()
      .setTitle('Nouvelle absence')
      .setDescription(
        [
          `**Membre** : ${interaction.user} (\`${interaction.user.id}\`)`,
          `**Pseudo Discord** : \`${interaction.user.tag}\``,
          `**Rôles sur le serveur** : ${rolesLine}`,
          '',
          `**Temps** : ${temps}`,
          `**Raison** : ${raison}`,
        ].join('\n')
      )
      .setColor(0xfee75c)
      .setThumbnail(interaction.user.displayAvatarURL({ size: 128 }))
      .setTimestamp();

    let msg;
    try {
      msg = await ch.send({
        content: `${interaction.user}`,
        embeds: [embed],
      });
    } catch {
      await interaction.reply({
        content: 'Impossible d’envoyer le message dans le salon des réponses (permissions / salon).',
        ephemeral: true,
      });
      return;
    }

    await msg.react('✅').catch(() => {});
    await msg.react('❌').catch(() => {});

    await interaction.reply({
      content: 'Ta demande a été envoyée au staff. Merci !',
      ephemeral: true,
    });
    return;
  }

  if (id.startsWith('ranksetup_modal:')) {
    const parts = id.split(':');
    const guildId = parts[1];
    const roleId = parts[2];
    if (interaction.guildId !== guildId) return;

    const power = await safePower(interaction.member);
    if (!canUseCommand(power, 1)) {
      await interaction.reply({ content: 'Refusé.', ephemeral: true });
      return;
    }

    const vmRaw = interaction.fields.getTextInputValue('rank_voice_min');
    const msgRaw = interaction.fields.getTextInputValue('rank_msg');
    const voiceMinutes = parseInt(vmRaw, 10);
    const messagesRequired = parseInt(msgRaw, 10);

    if (
      Number.isNaN(voiceMinutes) ||
      Number.isNaN(messagesRequired) ||
      voiceMinutes < 0 ||
      messagesRequired < 0
    ) {
      await interaction.reply({
        content: 'Nombre invalide : utilise des entiers positifs pour les minutes et les messages.',
        ephemeral: true,
      });
      return;
    }

    const existing = await RankTier.findOne({ guildId, roleId }).lean();
    let order;
    if (existing) {
      order = existing.order;
    } else {
      const last = await RankTier.findOne({ guildId }).sort({ order: -1 }).lean();
      order = (last?.order ?? -1) + 1;
    }

    await RankTier.findOneAndUpdate(
      { guildId, roleId },
      { guildId, roleId, voiceMinutesRequired: voiceMinutes, messagesRequired, order },
      { upsert: true, new: true }
    );

    await interaction.reply({
      content: `Palier enregistré : rôle <@&${roleId}> — **${voiceMinutes}** min vocal, **${messagesRequired}** messages (ordre ${order}).`,
      ephemeral: true,
    });
    return;
  }

  if (id.startsWith('embed_form:')) {
    const guildId = id.split(':')[1];
    if (interaction.guildId !== guildId) return;
    const power = await safePower(interaction.member);
    if (!canUseCommand(power, 5)) {
      await interaction.reply({ content: 'Réservé au **staff**.', ephemeral: true });
      return;
    }

    const title = interaction.fields.getTextInputValue('emb_title').trim();
    const description = interaction.fields.getTextInputValue('emb_desc').trim();
    let color = 0x5865f2;
    const colorRaw = interaction.fields.getTextInputValue('emb_color')?.replace(/^#/, '').trim();
    if (colorRaw) {
      const n = parseInt(colorRaw, 16);
      if (!Number.isNaN(n) && n >= 0 && n <= 0xffffff) color = n;
    }

    const footer = interaction.fields.getTextInputValue('emb_footer')?.trim() || '';
    const imageRaw = interaction.fields.getTextInputValue('emb_image')?.trim() || '';
    let imageUrl = '';
    if (imageRaw) {
      try {
        const u = new URL(imageRaw);
        if (u.protocol === 'http:' || u.protocol === 'https:') imageUrl = imageRaw;
      } catch {
        await interaction.reply({
          content: 'URL d’image invalide (utilise http/https).',
          ephemeral: true,
        });
        return;
      }
    }

    setEmbedDraft(interaction.user.id, guildId, {
      title,
      description,
      color,
      footer,
      imageUrl,
    });

    const row = new ActionRowBuilder().addComponents(
      new ChannelSelectMenuBuilder()
        .setCustomId(`embed_dest:${guildId}`)
        .setPlaceholder('Salon où envoyer l’embed')
        .setChannelTypes([ChannelType.GuildText, ChannelType.GuildAnnouncement])
    );

    await interaction.reply({
      content:
        '**Brouillon enregistré** (valable ~15 min). Choisis le salon ci-dessous pour **publier** l’embed.',
      components: [row],
      ephemeral: true,
    });
    return;
  }
}

