import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelSelectMenuBuilder,
  ChannelType,
  EmbedBuilder,
  RoleSelectMenuBuilder,
} from 'discord.js';
import mongoose from 'mongoose';
import { GuildConfig } from '../database/models/GuildConfig.js';
import { PendingWarn } from '../database/models/PendingWarn.js';
import { WarnRecord } from '../database/models/WarnRecord.js';
import { RankTier } from '../database/models/RankTier.js';
import { StaffNote } from '../database/models/StaffNote.js';
import { StaffStats } from '../database/models/StaffStats.js';
import { getUserPower, canUseCommand } from '../utils/permissions.js';
import { sendAdminLog } from '../utils/modLog.js';
import { parseUserMention, parseDuration } from '../utils/parseArgs.js';
import { incrementStaffMessage, buildStatsPayload } from '../services/rankup.js';
import { buildHelpEmbeds } from '../utils/helpEmbeds.js';
import { buildAbsenceAnnouncementEmbed, buildAbsenceButtonRow } from '../utils/absenceEmbed.js';

const PREFIX = '-';

function splitOnceRest(args) {
  return args.join(' ').trim();
}

async function replyComponentPanel(message, { embed, customIdPrefix, guildId, type }) {
  const row =
    type === 'channel'
      ? new ActionRowBuilder().addComponents(
          new ChannelSelectMenuBuilder()
            .setCustomId(`${customIdPrefix}:${guildId}`)
            .setPlaceholder('Choisis un salon')
            .setChannelTypes([ChannelType.GuildText, ChannelType.GuildAnnouncement])
        )
      : new ActionRowBuilder().addComponents(
          new RoleSelectMenuBuilder()
            .setCustomId(`${customIdPrefix}:${guildId}`)
            .setPlaceholder('Choisis un rôle')
            .setMinValues(1)
            .setMaxValues(1)
        );

  await message.reply({ embeds: [embed], components: [row] });
}

export async function handleMessageCreate(message, client) {
  if (message.author.bot) return;

  if (message.guild) {
    await incrementStaffMessage(message.member).catch(() => {});
  }

  /* MP : pas de réponse auto ; absence = bouton serveur → MP avec bouton → modal. */
  if (!message.guild) return;

  const raw = message.content.trim();
  if (!raw.startsWith(PREFIX)) return;

  const args = raw.slice(PREFIX.length).trim().split(/\s+/);
  const name = args.shift()?.toLowerCase();
  if (!name) return;

  const guildId = message.guild.id;
  const member = message.member;
  const power = await getUserPower(member);

  const need = (minP) => {
    if (!canUseCommand(power, minP)) {
      message.reply('Tu n’as pas la permission d’utiliser cette commande.').catch(() => {});
      return false;
    }
    return true;
  };

  try {
    if (name === 'panelcat') {
      if (!need(1)) return;

      const embeds = [1, 2, 3, 4, 5].map((n) =>
        new EmbedBuilder()
          .setTitle(`Catégorie ${n}`)
          .setDescription(
            n === 1
              ? 'Niveau maximum — configuration bot, panneaux, logs.'
              : n === 2
                ? 'Administration lourde (ban, structure…).'
                : n === 3
                  ? 'Modération standard (timeout, validation warns…).'
                  : n === 4
                    ? 'Modération légère / support.'
                    : 'Entrée de gamme — mute texte, warns (validation requise).'
          )
          .setColor(0x5865f2)
      );

      const row = new ActionRowBuilder().addComponents(
        [1, 2, 3, 4, 5].map((cat) =>
          new ButtonBuilder()
            .setCustomId(`panelcat_btn:${cat}:${guildId}`)
            .setLabel(`Cat. ${cat}`)
            .setStyle(ButtonStyle.Primary)
        )
      );

      await message.channel.send({ embeds, components: [row] });
      return;
    }

    if (name === 'setadminlogs') {
      if (!need(1)) return;
      await replyComponentPanel(message, {
        embed: new EmbedBuilder()
          .setTitle('Salon des logs staff')
          .setDescription('Choisis le salon où seront envoyées les actions de modération.'),
        customIdPrefix: 'setcfg_adminlog',
        guildId,
        type: 'channel',
      });
      return;
    }

    if (name === 'setabsencechannel') {
      if (!need(1)) return;
      await replyComponentPanel(message, {
        embed: new EmbedBuilder()
          .setTitle('Salon du formulaire d’absence')
          .setDescription(
            'Choisis le salon où sera posté l’embed avec le bouton (les membres recevront ensuite le formulaire en MP).'
          ),
        customIdPrefix: 'setcfg_abs_embed',
        guildId,
        type: 'channel',
      });
      return;
    }

    if (name === 'setabsenceinfo') {
      if (!need(1)) return;
      await replyComponentPanel(message, {
        embed: new EmbedBuilder()
          .setTitle('Salon des réponses d’absence')
          .setDescription(
            'Choisis le salon où seront envoyées les demandes validées (avec réactions pour avis du staff).'
          ),
        customIdPrefix: 'setcfg_abs_resp',
        guildId,
        type: 'channel',
      });
      return;
    }

    if (name === 'setchannelrank') {
      if (!need(1)) return;
      await replyComponentPanel(message, {
        embed: new EmbedBuilder()
          .setTitle('Salon des annonces de rankup')
          .setDescription(
            'Choisis le salon où seront postés les messages à chaque **rankup** staff : le membre sera **mentionné** et un embed récapitulera le rôle obtenu.'
          ),
        customIdPrefix: 'setcfg_rank_ann',
        guildId,
        type: 'channel',
      });
      return;
    }

    if (name === 'setrankstaff') {
      if (!need(1)) return;
      const embed = new EmbedBuilder()
        .setTitle('Configuration rankup staff')
        .setDescription(
          'Sélectionne le **rôle** à attribuer automatiquement quand les objectifs sont atteints. Ensuite un formulaire te demandera les **minutes** en vocal et le **nombre de messages** requis.'
        );

      const row = new ActionRowBuilder().addComponents(
        new RoleSelectMenuBuilder()
          .setCustomId(`ranksetup_role:${guildId}`)
          .setPlaceholder('Rôle à rankup')
          .setMinValues(1)
          .setMaxValues(1)
      );

      await message.reply({ embeds: [embed], components: [row] });
      return;
    }

    if (name === 'statsstaff') {
      if (!need(5)) return;
      const data = await buildStatsPayload(member);
      if (data.staffPower === null) {
        await message.reply('Tu n’as aucun rôle staff configuré pour ce serveur.');
        return;
      }

      const lines = [
        `**Temps vocal (minutes)** : ${data.voiceMinutes}`,
        `**Messages comptabilisés** : ${data.messageCount}`,
        `**Ta catégorie staff** : ${data.staffPower} (1 = max)`,
      ];

      if (data.nextTier) {
        lines.push(
          '',
          `**Prochain rôle (rankup)** : <@&${data.nextTier.roleId}>`,
          `· Vocal : ${data.voiceMinutes} / ${data.nextTier.voiceNeed} (${data.nextTier.voicePct}%)`,
          `· Messages : ${data.messageCount} / ${data.nextTier.msgNeed} (${data.nextTier.msgPct}%)`
        );
      } else {
        lines.push('', '**Prochain rôle** : aucun palier restant (ou rankup non configuré).');
      }

      const embed = new EmbedBuilder()
        .setTitle('Tes stats staff')
        .setDescription(lines.join('\n'))
        .setColor(0x57f287);

      await message.reply({ embeds: [embed] });
      return;
    }

    if (name === 'warn') {
      if (!need(5)) return;
      const targetId = parseUserMention(args[0]);
      if (!targetId) {
        await message.reply('Usage : `-warn @membre raison`');
        return;
      }
      const reason = splitOnceRest(args.slice(1)) || 'Sans raison';
      const target = await message.guild.members.fetch(targetId).catch(() => null);
      if (!target) {
        await message.reply('Membre introuvable.');
        return;
      }

      const issuerPower = power;

      if (issuerPower <= 4) {
        await WarnRecord.create({
          guildId,
          targetId,
          issuerId: message.author.id,
          reason,
          approvedById: null,
        });
        await sendAdminLog(client, guildId, {
          title: 'Warn appliqué',
          description: `**Cible** : ${target} (\`${target.id}\`)\n**Par** : ${message.author} (\`${message.author.id}\`)\n**Raison** : ${reason}`,
          color: 0xfee75c,
        });
        await message.reply(`Warn enregistré pour ${target.user.tag}.`);
        return;
      }

      const pending = await PendingWarn.create({
        guildId,
        targetId,
        issuerId: message.author.id,
        reason,
      });

      const cfg = await GuildConfig.findOne({ guildId });
      const logId = cfg?.adminLogChannelId;
      if (!logId) {
        await message.reply(
          'Aucun salon de logs staff configuré (`-setadminlogs`). Le warn est en attente mais invisible pour la validation.'
        );
        return;
      }

      const logCh = message.guild.channels.cache.get(logId);
      if (!logCh?.isTextBased()) {
        await message.reply('Salon de logs invalide.');
        return;
      }

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`warn_appr:${pending._id}`)
          .setLabel('Valider le warn')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`warn_rej:${pending._id}`)
          .setLabel('Refuser')
          .setStyle(ButtonStyle.Danger)
      );

      const embed = new EmbedBuilder()
        .setTitle('Warn en attente (cat. 5)')
        .setDescription(
          `**Cible** : ${target} (\`${target.id}\`)\n**Auteur** : ${message.author} (\`${message.author.id}\`)\n**Raison** : ${reason}\n\n_Validation réservée aux cat. 1–4._`
        )
        .setColor(0xed4245);

      const sent = await logCh.send({ embeds: [embed], components: [row] });
      pending.reviewMessageId = sent.id;
      pending.reviewChannelId = sent.channel.id;
      await pending.save();

      await message.reply(
        'Ta demande de warn a été envoyée aux modérateurs (cat. 3–4+) pour validation.'
      );
      return;
    }

    if (name === 'warns') {
      if (!need(5)) return;
      const targetId = parseUserMention(args[0]);
      if (!targetId) {
        await message.reply('Usage : `-warns @membre`');
        return;
      }
      const list = await WarnRecord.find({ guildId, targetId })
        .sort({ createdAt: -1 })
        .limit(15)
        .lean();
      if (!list.length) {
        await message.reply('Aucun warn enregistré pour ce membre.');
        return;
      }
      const lines = list.map((w, i) => {
        const ts = Math.floor(new Date(w.createdAt).getTime() / 1000);
        const appr = w.approvedById ? ` · validé par <@${w.approvedById}>` : '';
        return `**${i + 1}.** <t:${ts}:f> — <@${w.issuerId}>${appr}\n└ ${w.reason.slice(0, 200)}${w.reason.length > 200 ? '…' : ''}`;
      });
      const embed = new EmbedBuilder()
        .setTitle(`Warns — ${targetId}`)
        .setDescription(lines.join('\n\n').slice(0, 4000))
        .setColor(0xfee75c);
      await message.reply({ embeds: [embed] });
      return;
    }

    if (name === 'listrankstaff') {
      if (!need(1)) return;
      const tiers = await RankTier.find({ guildId }).sort({ order: 1 }).lean();
      if (!tiers.length) {
        await message.reply('Aucun palier rankup configuré. Utilise `-setrankstaff` pour en ajouter.');
        return;
      }
      const lines = tiers.map(
        (t, i) =>
          `**#${i + 1}** <@&${t.roleId}> — **${t.voiceMinutesRequired}** min vocal · **${t.messagesRequired}** messages`
      );
      const embed = new EmbedBuilder()
        .setTitle('Paliers rankup staff')
        .setDescription(lines.join('\n'))
        .setFooter({ text: 'Menu : supprimer la config du rôle choisi' })
        .setColor(0x5865f2);

      const row = new ActionRowBuilder().addComponents(
        new RoleSelectMenuBuilder()
          .setCustomId(`rankdel_role:${guildId}`)
          .setPlaceholder('Supprimer le palier lié à ce rôle')
          .setMinValues(1)
          .setMaxValues(1)
      );

      await message.reply({ embeds: [embed], components: [row] });
      return;
    }

    if (name === 'resetstats') {
      if (!need(2)) return;
      const targetId = parseUserMention(args[0]);
      if (!targetId) {
        await message.reply('Usage : `-resetstats @membre`');
        return;
      }
      await StaffStats.findOneAndUpdate(
        { guildId, userId: targetId },
        { $set: { voiceMinutes: 0, messageCount: 0 } },
        { upsert: true }
      );
      await message.reply(
        `Compteurs **vocal** et **messages** remis à zéro pour <@${targetId}> (rankup).`
      );
      return;
    }

    if (name === 'absencesync') {
      if (!need(1)) return;
      const cfg = await GuildConfig.findOne({ guildId });
      const chId = cfg?.absenceEmbedChannelId;
      if (!chId) {
        await message.reply('Aucun salon configuré. Utilise d’abord `-setabsencechannel`.');
        return;
      }
      const ch = await message.guild.channels.fetch(chId).catch(() => null);
      if (!ch?.isTextBased()) {
        await message.reply('Salon d’absence invalide ou introuvable.');
        return;
      }
      await ch.send({
        embeds: [buildAbsenceAnnouncementEmbed()],
        components: [buildAbsenceButtonRow(guildId)],
      });
      await message.reply(`Embed **absence** republié dans <#${chId}>.`);
      return;
    }

    if (name === 'note') {
      if (!need(4)) return;
      if (args[0]?.toLowerCase() !== 'add') {
        await message.reply('Usage : `-note add @membre ton texte…`');
        return;
      }
      const targetId = parseUserMention(args[1]);
      const content = splitOnceRest(args.slice(2));
      if (!targetId || !content) {
        await message.reply('Usage : `-note add @membre texte de la note`');
        return;
      }
      await StaffNote.create({
        guildId,
        targetId,
        authorId: message.author.id,
        content,
      });
      await message.reply(`Note ajoutée pour <@${targetId}>. Affiche-les avec \`-notes @membre\`.`);
      return;
    }

    if (name === 'notes') {
      if (!need(4)) return;
      const targetId = parseUserMention(args[0]);
      if (!targetId) {
        await message.reply('Usage : `-notes @membre`');
        return;
      }
      const notes = await StaffNote.find({ guildId, targetId })
        .sort({ createdAt: -1 })
        .limit(12)
        .lean();
      if (!notes.length) {
        await message.reply('Aucune note pour ce membre.');
        return;
      }
      const lines = notes.map((n) => {
        const ts = Math.floor(new Date(n.createdAt).getTime() / 1000);
        const prev = n.content.length > 120 ? `${n.content.slice(0, 120)}…` : n.content;
        return `**ID** \`${n._id}\` · <t:${ts}:R> · <@${n.authorId}>\n${prev}`;
      });
      const embed = new EmbedBuilder()
        .setTitle(`Notes staff — ${targetId}`)
        .setDescription(
          `${lines.join('\n\n')}\n\n_Suppression : \`-notedel <id>\` (cat. 3+)._`.slice(0, 4096)
        )
        .setColor(0xeb459e);
      await message.reply({ embeds: [embed] });
      return;
    }

    if (name === 'notedel') {
      if (!need(3)) return;
      const noteId = args[0];
      if (!noteId || !mongoose.isValidObjectId(noteId)) {
        await message.reply('Usage : `-notedel <id>` — l’id est affiché dans `-notes`.');
        return;
      }
      const del = await StaffNote.findOneAndDelete({ _id: noteId, guildId });
      if (!del) {
        await message.reply('Note introuvable sur ce serveur.');
        return;
      }
      await message.reply('Note supprimée.');
      return;
    }

    if (name === 'embed') {
      if (!need(5)) return;
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`embed_open:${guildId}`)
          .setLabel('Ouvrir l’éditeur d’embed')
          .setStyle(ButtonStyle.Primary)
      );
      await message.reply({
        content:
          'Clique sur le bouton : tu pourras remplir **titre**, **description**, **couleur**, **footer**, **image**, puis choisir le **salon** d’envoi.',
        components: [row],
      });
      return;
    }

    if (name === 'mute' || name === 'timeout') {
      if (!need(5)) return;
      const targetId = parseUserMention(args[0]);
      const durStr = args[1];
      const reason = splitOnceRest(args.slice(2)) || 'Sans raison';
      if (!targetId || !durStr) {
        await message.reply('Usage : `-mute @membre 10m raison` (durées : s, m, h, d)');
        return;
      }
      const ms = parseDuration(durStr);
      if (!ms || ms > 28 * 24 * 60 * 60 * 1000) {
        await message.reply('Durée invalide ou supérieure à 28 jours (limite Discord).');
        return;
      }

      const target = await message.guild.members.fetch(targetId).catch(() => null);
      if (!target) {
        await message.reply('Membre introuvable.');
        return;
      }

      await target.timeout(ms, reason).catch(async (e) => {
        await message.reply(`Impossible : ${e.message}`);
        throw e;
      });

      await sendAdminLog(client, guildId, {
        title: 'Mute / timeout',
        description: `**Cible** : ${target} (\`${target.id}\`)\n**Par** : ${message.author}\n**Durée** : ${durStr}\n**Raison** : ${reason}`,
        color: 0xed4245,
      });

      await message.reply(`${target} a été muté (${durStr}).`);
      return;
    }

    if (name === 'help') {
      if (!need(5)) return;
      const embeds = buildHelpEmbeds();
      await message.reply({ embeds });
      return;
    }
  } catch (e) {
    console.error(e);
    message.reply('Erreur lors de l’exécution.').catch(() => {});
  }
}
