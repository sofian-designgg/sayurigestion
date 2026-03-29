import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} from 'discord.js';

/**
 * @typedef {{ userId: string, username: string, guildName: string, guildId: string }} PlaceholderCtx
 */

export function applyPlaceholders(str, ctx) {
  if (typeof str !== 'string') return str;
  return str
    .replaceAll('{user}', `<@${ctx.userId}>`)
    .replaceAll('{username}', ctx.username ?? '')
    .replaceAll('{guild}', ctx.guildName ?? '')
    .replaceAll('{guild.id}', ctx.guildId ?? '');
}

function isEmbedError(x) {
  return Boolean(x && typeof x.error === 'string');
}

function apiEmbedToBuilder(e, ctx) {
  const b = new EmbedBuilder();
  if (e.color != null && e.color !== '') {
    const n = Number(e.color);
    if (!Number.isNaN(n)) b.setColor(n);
  }
  if (e.title) b.setTitle(applyPlaceholders(String(e.title), ctx).slice(0, 256));
  if (e.description) {
    b.setDescription(applyPlaceholders(String(e.description), ctx).slice(0, 4096));
  }
  if (e.url) {
    try {
      b.setURL(new URL(String(e.url)).href);
    } catch {
      /* skip */
    }
  }
  if (e.footer?.text) {
    b.setFooter({ text: applyPlaceholders(String(e.footer.text), ctx).slice(0, 2048) });
  }
  if (e.image?.url) {
    try {
      b.setImage(new URL(String(e.image.url)).href);
    } catch {
      return { error: 'URL **image** invalide (http/https).' };
    }
  } else if (e.image && typeof e.image === 'string') {
    try {
      b.setImage(new URL(e.image).href);
    } catch {
      return { error: 'URL **image** invalide (http/https).' };
    }
  }
  if (e.thumbnail?.url) {
    try {
      b.setThumbnail(new URL(String(e.thumbnail.url)).href);
    } catch {
      /* skip */
    }
  }
  if (e.author?.name) {
    const icon = e.author.icon_url || e.author.iconURL;
    let iconURL;
    if (icon) {
      try {
        iconURL = new URL(String(icon)).href;
      } catch {
        /* skip */
      }
    }
    b.setAuthor({
      name: applyPlaceholders(String(e.author.name), ctx).slice(0, 256),
      ...(iconURL ? { iconURL } : {}),
    });
  }
  if (Array.isArray(e.fields)) {
    for (const f of e.fields.slice(0, 25)) {
      b.addFields({
        name: applyPlaceholders(String(f.name ?? ''), ctx).slice(0, 256),
        value: applyPlaceholders(String(f.value ?? ''), ctx).slice(0, 1024),
        inline: !!f.inline,
      });
    }
  }
  if (e.timestamp != null && e.timestamp !== false) {
    try {
      if (e.timestamp === true) b.setTimestamp(new Date());
      else b.setTimestamp(new Date(e.timestamp));
    } catch {
      b.setTimestamp();
    }
  }
  return b;
}

/**
 * Discord n’accepte pas les « shortcodes » du type `:gift:` sur les boutons — il faut du Unicode
 * ou un emoji serveur `{ id, name }`. On convertit les shortcodes courants ; sinon on ignore l’emoji.
 */
const SHORTCODE_TO_UNICODE = {
  gift: '🎁',
  trophy: '🏆',
  medal: '🏅',
  star: '⭐',
  star2: '🌟',
  tada: '🎉',
  sparkles: '✨',
  alarm_clock: '⏰',
  clock: '🕐',
  white_check_mark: '✅',
  x: '❌',
  warning: '⚠️',
  link: '🔗',
  ticket: '🎫',
  mail: '📧',
  heart: '❤️',
  fire: '🔥',
};

function shortcodeToUnicode(s) {
  const m = String(s).trim().match(/^:([a-z0-9_]+):$/i);
  if (!m) return null;
  return SHORTCODE_TO_UNICODE[m[1].toLowerCase()] ?? null;
}

function normalizeEmoji(emoji) {
  if (!emoji) return undefined;
  if (typeof emoji === 'string') {
    const u = shortcodeToUnicode(emoji) ?? emoji;
    if (/^:[a-z0-9_]+:$/i.test(String(u).trim())) return undefined;
    return u.slice(0, 80);
  }
  if (typeof emoji === 'object' && emoji.id && emoji.name) {
    return {
      id: String(emoji.id),
      name: String(emoji.name).replace(/^:/, '').replace(/:$/, '').slice(0, 32),
      ...(emoji.animated ? { animated: true } : {}),
    };
  }
  if (typeof emoji === 'object' && emoji.name != null) {
    const raw = String(emoji.name);
    const u = shortcodeToUnicode(raw) ?? raw;
    if (/^:[a-z0-9_]+:$/i.test(String(u).trim())) return undefined;
    return u.slice(0, 80);
  }
  return undefined;
}

function parseComponentRows(compRaw, ctx) {
  const rows = Array.isArray(compRaw) ? compRaw : [];
  if (rows.length > 5) {
    return { error: 'Maximum **5** lignes de composants (ActionRow).' };
  }

  const out = [];
  for (const row of rows) {
    const comps = row.components;
    if (!Array.isArray(comps)) continue;
    if (comps.length > 5) {
      return { error: 'Maximum **5** boutons par ligne.' };
    }

    const rowB = new ActionRowBuilder();
    for (const c of comps) {
      if (c.type != null && c.type !== 2) continue;
      const styleNum = Number(c.style ?? 2);
      if (styleNum === 5) {
        if (!c.url) {
          return { error: 'Chaque bouton **lien** doit avoir une **url** (style 5).' };
        }
        let href;
        try {
          href = new URL(String(c.url)).href;
        } catch {
          return { error: '**URL** de bouton invalide.' };
        }
        const btn = new ButtonBuilder().setStyle(ButtonStyle.Link).setURL(href);
        const label = c.label != null ? applyPlaceholders(String(c.label), ctx).slice(0, 80) : '';
        if (label) btn.setLabel(label);
        const em = normalizeEmoji(c.emoji);
        if (em) btn.setEmoji(em);
        if (!label && !em) btn.setLabel('Lien');
        rowB.addComponents(btn);
      } else {
        return {
          error:
            'Pour **\-json**, seuls les **boutons lien** (API **style: 5**) sont acceptés — pas de bouton avec custom_id.',
        };
      }
    }
    if (rowB.components.length) out.push(rowB);
  }
  return out;
}

/**
 * Transforme un JSON façon API Discord / webhook en options `channel.send()`.
 * @param {string|object} raw
 * @param {PlaceholderCtx} ctx
 */
export function parseDiscordJsonMessage(raw, ctx) {
  let data;
  try {
    data = typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch (e) {
    return { error: `JSON invalide : ${e.message}` };
  }

  if (!data || typeof data !== 'object') {
    return { error: 'Le JSON doit être un **objet**.' };
  }

  let content = null;
  if (data.content != null && String(data.content).length) {
    content = applyPlaceholders(String(data.content), ctx).slice(0, 2000);
  }

  const embeds = [];
  if (Array.isArray(data.embeds) && data.embeds.length) {
    const limit = Math.min(data.embeds.length, 10);
    for (let i = 0; i < limit; i++) {
      if (!data.embeds[i]) continue;
      const eb = apiEmbedToBuilder(data.embeds[i], ctx);
      if (isEmbedError(eb)) return eb;
      embeds.push(eb);
    }
  } else if (data.embed && typeof data.embed === 'object') {
    const eb = apiEmbedToBuilder(data.embed, ctx);
    if (isEmbedError(eb)) return eb;
    embeds.push(eb);
  }

  const compRaw = data.components ?? data.component;
  let components = [];
  if (compRaw != null) {
    const parsed = parseComponentRows(compRaw, ctx);
    if (parsed.error) return parsed;
    components = parsed;
  }

  if (!content && embeds.length === 0 && components.length === 0) {
    return {
      error:
        'Rien à envoyer : ajoute au moins **content**, **embed** / **embeds**, ou **components** / **component**.',
    };
  }

  return {
    payload: {
      ...(content ? { content } : {}),
      ...(embeds.length ? { embeds } : {}),
      ...(components.length ? { components } : {}),
    },
  };
}
