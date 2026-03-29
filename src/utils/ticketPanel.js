import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} from 'discord.js';

const STYLE_MAP = {
  Primary: ButtonStyle.Primary,
  Secondary: ButtonStyle.Secondary,
  Success: ButtonStyle.Success,
  Danger: ButtonStyle.Danger,
};

const BTN_PER_ROW = 5;
const MAX_BUTTONS = 25;

/**
 * Valide le JSON (outil web ou modal) et retourne { embed, buttons } stockables.
 */
export function validateTicketPanelJson(raw) {
  let data;
  try {
    data = typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch {
    return { error: 'JSON invalide (syntaxe).' };
  }

  const embedIn = data.embed ?? data;
  if (!embedIn || typeof embedIn !== 'object') {
    return { error: 'Champ **embed** manquant ou invalide.' };
  }

  const title = typeof embedIn.title === 'string' ? embedIn.title.trim() : '';
  const desc = typeof embedIn.description === 'string' ? embedIn.description.trim() : '';
  if (!title && !desc) {
    return { error: 'L’embed doit avoir au moins un **titre** ou une **description**.' };
  }

  const buttons = Array.isArray(data.buttons) ? data.buttons : [];
  if (buttons.length < 1) {
    return { error: 'Ajoute au moins **un bouton** (tableau **buttons**).' };
  }
  if (buttons.length > MAX_BUTTONS) {
    return { error: `Maximum **${MAX_BUTTONS}** boutons par message Discord.` };
  }

  const seen = new Set();
  const normalized = [];
  for (const b of buttons) {
    if (!b || typeof b !== 'object') {
      return { error: 'Chaque bouton doit être un objet.' };
    }
    const id = typeof b.id === 'string' ? b.id.trim() : '';
    if (!/^[a-z0-9_-]{1,32}$/i.test(id)) {
      return {
        error:
          'Chaque bouton doit avoir un **id** unique (1–32 caractères : lettres, chiffres, `_`, `-`).',
      };
    }
    if (seen.has(id)) return { error: `**id** dupliqué : \`${id}\`` };
    seen.add(id);

    const label = typeof b.label === 'string' ? b.label.trim() : '';
    if (!label || label.length > 80) {
      return { error: `**label** invalide pour le bouton \`${id}\` (1–80 caractères).` };
    }

    const styleRaw = typeof b.style === 'string' ? b.style.trim() : 'Secondary';
    if (!STYLE_MAP[styleRaw]) {
      return {
        error: `**style** invalide pour \`${id}\` : Primary, Secondary, Success ou Danger.`,
      };
    }

    let emoji = null;
    if (b.emoji != null && String(b.emoji).trim()) {
      emoji = String(b.emoji).trim().slice(0, 80);
    }

    normalized.push({ id, label, emoji, style: styleRaw });
  }

  const embed = normalizeEmbedForStorage(embedIn);
  return { embed, buttons: normalized };
}

function normalizeEmbedForStorage(e) {
  const out = {};
  if (e.color != null) {
    const n = Number(e.color);
    if (!Number.isNaN(n) && n >= 0 && n <= 0xffffff) out.color = n;
  }
  if (e.title) out.title = String(e.title).slice(0, 256);
  if (e.description) out.description = String(e.description).slice(0, 4096);
  if (e.url) {
    try {
      const u = new URL(String(e.url));
      if (u.protocol === 'http:' || u.protocol === 'https:') out.url = u.href;
    } catch {
      /* skip */
    }
  }
  if (e.footer?.text) {
    out.footer = { text: String(e.footer.text).slice(0, 2048) };
  }
  if (e.author?.name) {
    out.author = { name: String(e.author.name).slice(0, 256) };
    if (e.author.icon_url || e.author.iconURL) {
      const i = e.author.icon_url || e.author.iconURL;
      try {
        const u = new URL(String(i));
        if (u.protocol === 'http:' || u.protocol === 'https:') out.author.icon_url = u.href;
      } catch {
        /* skip */
      }
    }
  }
  if (e.thumbnail?.url || e.thumbnail_url) {
    const t = e.thumbnail?.url || e.thumbnail_url;
    try {
      const u = new URL(String(t));
      if (u.protocol === 'http:' || u.protocol === 'https:') out.thumbnail = { url: u.href };
    } catch {
      /* skip */
    }
  }
  if (e.image?.url || e.image_url) {
    const t = e.image?.url || e.image_url;
    try {
      const u = new URL(String(t));
      if (u.protocol === 'http:' || u.protocol === 'https:') out.image = { url: u.href };
    } catch {
      /* skip */
    }
  }
  if (e.timestamp) {
    out.timestamp = true;
  }
  return out;
}

export function embedFromStored(data) {
  if (!data || typeof data !== 'object') return null;
  const eb = new EmbedBuilder();
  if (data.color != null) eb.setColor(data.color);
  if (data.title) eb.setTitle(data.title);
  if (data.description) eb.setDescription(data.description);
  if (data.url) eb.setURL(data.url);
  if (data.footer?.text) eb.setFooter({ text: data.footer.text });
  if (data.author?.name) {
    eb.setAuthor({
      name: data.author.name,
      ...(data.author.icon_url ? { iconURL: data.author.icon_url } : {}),
    });
  }
  if (data.thumbnail?.url) eb.setThumbnail(data.thumbnail.url);
  if (data.image?.url) eb.setImage(data.image.url);
  if (data.timestamp) eb.setTimestamp(new Date());
  return eb;
}

export function buildTicketPanelPayload(guildId, cfg) {
  const embed = embedFromStored(cfg.ticketPanelEmbed);
  const list = cfg.ticketButtons || [];
  if (!embed || !list.length) return null;

  const rows = [];
  for (let i = 0; i < list.length; i += BTN_PER_ROW) {
    const slice = list.slice(i, i + BTN_PER_ROW);
    const row = new ActionRowBuilder().addComponents(
      slice.map((b) => {
        const st = STYLE_MAP[b.style] ?? ButtonStyle.Secondary;
        const btn = new ButtonBuilder()
          .setCustomId(`t_open:${guildId}:${b.id}`)
          .setLabel(b.label.slice(0, 80))
          .setStyle(st);
        if (b.emoji) btn.setEmoji(b.emoji);
        return btn;
      })
    );
    rows.push(row);
  }
  return { embeds: [embed], components: rows };
}
