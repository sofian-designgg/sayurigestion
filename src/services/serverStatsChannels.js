import {
  ChannelType,
  PermissionFlagsBits,
} from 'discord.js';
import { GuildConfig } from '../database/models/GuildConfig.js';

const INVITE_LINE = '🏝️ · .gg/sayuri';

/** Délai minimum entre deux rafraîchissements complets (limite API renommage salons). */
const MIN_REFRESH_MS = 5 * 60 * 1000;

const lastFullRefresh = new Map();

function countInVoice(guild) {
  let n = 0;
  for (const state of guild.voiceStates.cache.values()) {
    if (state.channelId) n++;
  }
  return n;
}

function countOnline(guild) {
  let n = 0;
  for (const m of guild.members.cache.values()) {
    const s = m.presence?.status;
    if (s && s !== 'offline' && s !== 'invisible') n++;
  }
  return n;
}

function buildNames(guild) {
  const members = guild.memberCount;
  const online = countOnline(guild);
  const voice = countInVoice(guild);
  const boost = guild.premiumSubscriptionCount ?? 0;

  const clip = (s, max = 100) => (s.length > max ? s.slice(0, max - 1) + '…' : s);

  return {
    members: clip(`🍂・Membres: ${members}`),
    online: clip(`🍭・En ligne: ${online}`),
    voice: clip(`💃・En vocal: ${voice}`),
    boost: clip(`🥢・Boost: ${boost}`),
    invite: clip(INVITE_LINE),
  };
}

export async function updateGuildServerStats(guild) {
  const cfg = await GuildConfig.findOne({ guildId: guild.id }).lean();
  if (!cfg?.serverStatsVcMembersId) return;

  const ids = {
    members: cfg.serverStatsVcMembersId,
    online: cfg.serverStatsVcOnlineId,
    voice: cfg.serverStatsVcVoiceId,
    boost: cfg.serverStatsVcBoostId,
    invite: cfg.serverStatsVcInviteId,
  };

  const names = buildNames(guild);

  const pairs = [
    [ids.members, names.members],
    [ids.online, names.online],
    [ids.voice, names.voice],
    [ids.boost, names.boost],
    [ids.invite, names.invite],
  ];

  for (const [id, name] of pairs) {
    if (!id) continue;
    const ch = guild.channels.cache.get(id) ?? (await guild.channels.fetch(id).catch(() => null));
    if (!ch?.isVoiceBased()) continue;
    if (ch.name === name) continue;
    await ch.setName(name).catch(() => {});
  }
}

export async function updateAllServerStatsChannels(client) {
  const configs = await GuildConfig.find({
    serverStatsVcMembersId: { $nin: [null, ''] },
  })
    .select('guildId')
    .lean();

  for (const c of configs) {
    const guild = client.guilds.cache.get(c.guildId);
    if (guild) await updateGuildServerStats(guild).catch(() => {});
  }
}

/**
 * Rafraîchissement throttlé (événements vocaux / membres) pour approcher du temps réel sans spam API.
 */
export function scheduleStatsRefresh(guild) {
  const gid = guild.id;
  const now = Date.now();
  const prev = lastFullRefresh.get(gid) || 0;
  if (now - prev < MIN_REFRESH_MS) return;
  lastFullRefresh.set(gid, now);
  updateGuildServerStats(guild).catch(() => {});
}

export async function createServerStatsVoiceChannels(guild, categoryId) {
  const parent = await guild.channels.fetch(categoryId).catch(() => null);
  if (!parent || parent.type !== ChannelType.GuildCategory) {
    throw new Error('Catégorie invalide');
  }

  const everyone = guild.roles.everyone;
  const overwrites = [
    {
      id: everyone.id,
      allow: PermissionFlagsBits.ViewChannel,
      deny: PermissionFlagsBits.Connect | PermissionFlagsBits.Speak,
    },
  ];

  const names = buildNames(guild);
  const initial = [
    names.members,
    names.online,
    names.voice,
    names.boost,
    names.invite,
  ];

  const created = [];
  for (const name of initial) {
    const ch = await guild.channels.create({
      name,
      type: ChannelType.GuildVoice,
      parent: categoryId,
      permissionOverwrites: overwrites,
      reason: 'Stats serveur Sayuri (-setcatserveurinfo)',
    });
    created.push(ch);
  }

  await GuildConfig.findOneAndUpdate(
    { guildId: guild.id },
    {
      serverStatsCategoryId: categoryId,
      serverStatsVcMembersId: created[0].id,
      serverStatsVcOnlineId: created[1].id,
      serverStatsVcVoiceId: created[2].id,
      serverStatsVcBoostId: created[3].id,
      serverStatsVcInviteId: created[4].id,
    },
    { upsert: true }
  );

  return created;
}
