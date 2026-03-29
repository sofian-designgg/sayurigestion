/** Brouillons d’embed (-embed) avant choix du salon ; TTL ~15 min. */
const store = new Map();

const TTL_MS = 15 * 60 * 1000;

function key(userId, guildId) {
  return `${userId}:${guildId}`;
}

export function setEmbedDraft(userId, guildId, data) {
  store.set(key(userId, guildId), { ...data, at: Date.now() });
}

export function takeEmbedDraft(userId, guildId) {
  const k = key(userId, guildId);
  const v = store.get(k);
  store.delete(k);
  if (!v) return null;
  if (Date.now() - v.at > TTL_MS) return null;
  return v;
}

export function peekEmbedDraft(userId, guildId) {
  const v = store.get(key(userId, guildId));
  if (!v || Date.now() - v.at > TTL_MS) return null;
  return v;
}
