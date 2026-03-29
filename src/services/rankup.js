import { EmbedBuilder } from 'discord.js';
import { RankTier } from '../database/models/RankTier.js';
import { StaffStats } from '../database/models/StaffStats.js';
import { GuildConfig } from '../database/models/GuildConfig.js';
import { getUserPower } from '../utils/permissions.js';

async function announceRankup(member, tier) {
  const cfg = await GuildConfig.findOne({ guildId: member.guild.id }).lean();
  const chId = cfg?.rankupAnnounceChannelId;
  if (!chId) return;

  const ch = await member.guild.channels.fetch(chId).catch(() => null);
  if (!ch?.isTextBased()) return;

  const embed = new EmbedBuilder()
    .setTitle('Rankup staff')
    .setDescription(
      [
        `${member} a obtenu le rôle <@&${tier.roleId}> !`,
        '',
        `**Objectifs** : ${tier.voiceMinutesRequired} min en vocal · ${tier.messagesRequired} messages`,
      ].join('\n')
    )
    .setColor(0x57f287)
    .setThumbnail(member.user.displayAvatarURL({ size: 128 }))
    .setTimestamp();

  await ch.send({ content: `${member}`, embeds: [embed] }).catch(() => {});
}

async function isTrackableStaff(member) {
  if ((await getUserPower(member)) !== null) return true;
  const tiers = await RankTier.find({ guildId: member.guild.id }).lean();
  for (const t of tiers) {
    if (member.roles.cache.has(t.roleId)) return true;
  }
  return false;
}

export async function incrementStaffMessage(member) {
  if (!member.guild || member.user.bot) return;
  const ok = await isTrackableStaff(member);
  if (!ok) return;

  await StaffStats.findOneAndUpdate(
    { guildId: member.guild.id, userId: member.id },
    { $inc: { messageCount: 1 } },
    { upsert: true, new: true }
  );

  await tryRankup(member);
}

export async function addVoiceMinutes(member, minutes) {
  if (!member?.guild || minutes <= 0) return;
  const ok = await isTrackableStaff(member);
  if (!ok) return;

  await StaffStats.findOneAndUpdate(
    { guildId: member.guild.id, userId: member.id },
    { $inc: { voiceMinutes: minutes } },
    { upsert: true, new: true }
  );

  await tryRankup(member);
}

export async function tryRankup(member) {
  const guildId = member.guild.id;
  const tiers = await RankTier.find({ guildId }).sort({ order: 1 }).lean();
  if (!tiers.length) return;

  const stats = await StaffStats.findOne({ guildId, userId: member.id }).lean();
  const voice = stats?.voiceMinutes ?? 0;
  const msgs = stats?.messageCount ?? 0;

  for (const t of tiers) {
    if (member.roles.cache.has(t.roleId)) continue;
    if (voice < t.voiceMinutesRequired || msgs < t.messagesRequired) continue;
    try {
      await member.roles.add(t.roleId, 'Rankup automatique (objectifs vocaux + messages)');
      await announceRankup(member, t);
    } catch {
      /* manque de perms / hiérarchie */
    }
  }
}

/** Stats affichées pour -statsstaff */
export async function buildStatsPayload(member) {
  const guildId = member.guild.id;
  const userId = member.id;
  const [stats, tiers, cfg] = await Promise.all([
    StaffStats.findOne({ guildId, userId }).lean(),
    RankTier.find({ guildId }).sort({ order: 1 }).lean(),
    GuildConfig.findOne({ guildId }).lean(),
  ]);

  const voice = stats?.voiceMinutes ?? 0;
  const msgs = stats?.messageCount ?? 0;
  const power = await getUserPower(member);

  let next = null;
  for (const t of tiers) {
    if (member.roles.cache.has(t.roleId)) continue;
    next = t;
    break;
  }

  let progress = null;
  if (next) {
    const pv = next.voiceMinutesRequired
      ? Math.min(100, Math.round((voice / next.voiceMinutesRequired) * 100))
      : 100;
    const pm = next.messagesRequired
      ? Math.min(100, Math.round((msgs / next.messagesRequired) * 100))
      : 100;
    progress = {
      roleId: next.roleId,
      voiceNeed: next.voiceMinutesRequired,
      msgNeed: next.messagesRequired,
      voicePct: pv,
      msgPct: pm,
    };
  }

  return {
    voiceMinutes: voice,
    messageCount: msgs,
    staffPower: power,
    nextTier: progress,
    hasConfig: !!cfg,
  };
}
