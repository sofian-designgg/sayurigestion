/** Brouillon message JSON (-json) avant choix du salon ; TTL ~15 min. */
const store = new Map();

const TTL_MS = 15 * 60 * 1000;

function key(userId, guildId) {
  return `${userId}:${guildId}`;
}

export function setJsonDraft(userId, guildId, rawJsonString) {
  store.set(key(userId, guildId), { rawJsonString, at: Date.now() });
}

export function takeJsonDraft(userId, guildId) {
  const k = key(userId, guildId);
  const v = store.get(k);
  store.delete(k);
  if (!v) return null;
  if (Date.now() - v.at > TTL_MS) return null;
  return v.rawJsonString;
}
