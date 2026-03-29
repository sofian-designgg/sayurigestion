const drafts = new Map();
const TTL_MS = 12 * 60 * 1000;

function k(userId, guildId) {
  return `${userId}:${guildId}`;
}

export function setReactionRoleDraft(userId, guildId, data) {
  drafts.set(k(userId, guildId), { ...data, at: Date.now() });
}

export function takeReactionRoleDraft(userId, guildId) {
  const key = k(userId, guildId);
  const v = drafts.get(key);
  drafts.delete(key);
  if (!v || Date.now() - v.at > TTL_MS) return null;
  return v;
}
