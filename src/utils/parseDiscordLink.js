/** Extrait guild / channel / message depuis un lien discord.com */
export function parseDiscordMessageLink(input) {
  const u = String(input || '').trim();
  const m = u.match(/discord(?:app)?\.com\/channels\/(\d+)\/(\d+)\/(\d+)/);
  if (!m) return null;
  return { guildId: m[1], channelId: m[2], messageId: m[3] };
}

/**
 * @returns {{ key: string, react: string } | null}
 * key pour la base : custom:id ou unicode:…
 * Discord n’accepte qu’**un seul** emoji par réaction : pas de phrase, pas d’espace.
 */
export function parseEmojiForReaction(str) {
  const s = String(str || '').trim();
  const custom = s.match(/^<a?:([\w~]+):(\d+)>$/);
  if (custom) return { key: `custom:${custom[2]}`, react: s };

  if (!s || s.startsWith('<')) return null;
  /* Phrases du type "devenir staff 👒 !" cassent message.react() */
  if (/\s/.test(s)) return null;
  if (s.length > 48) return null;

  return { key: `unicode:${s}`, react: s };
}

export function emojiKeyFromReaction(reaction) {
  if (reaction.emoji.id) return `custom:${reaction.emoji.id}`;
  return `unicode:${reaction.emoji.name}`;
}
