/** @type {Map<string, number>} clé guildId:userId -> timestamp join */
const joinAt = new Map();

function key(guildId, userId) {
  return `${guildId}:${userId}`;
}

export function markVoiceJoin(guildId, userId) {
  joinAt.set(key(guildId, userId), Date.now());
}

export function clearVoiceJoin(guildId, userId) {
  joinAt.delete(key(guildId, userId));
}

/** Retourne minutes passées depuis join, ou 0 */
export function consumeVoiceMinutes(guildId, userId) {
  const k = key(guildId, userId);
  const t = joinAt.get(k);
  if (!t) return 0;
  joinAt.delete(k);
  return Math.floor((Date.now() - t) / 60_000);
}

export function hasActiveVoice(guildId, userId) {
  return joinAt.has(key(guildId, userId));
}
