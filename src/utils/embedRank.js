import { EmbedBuilder } from 'discord.js';

const CAT_COLORS = {
  1: 0xed4245,
  2: 0xf26522,
  3: 0xfee75c,
  4: 0x57f287,
  5: 0x99aab5,
  other: 0xeb459e,
};

const CAT_EMOJI = {
  1: '🔴',
  2: '🟠',
  3: '🟡',
  4: '🟢',
  5: '⚪',
  other: '📌',
};

const CAT_BLURB = {
  1: 'Niveau maximum — configuration bot, panneaux, logs.',
  2: 'Administration lourde (ban, structure…).',
  3: 'Modération standard (timeout, validation warns…).',
  4: 'Modération légère / support.',
  5: 'Entrée de gamme — mute texte, warns (validation requise).',
};

/** Plus petit numéro de catégorie panel contenant ce rôle, sinon null. */
export function staffCategoryForRoleId(roleId, categoryRoles) {
  if (!categoryRoles) return null;
  const pairs = [
    [1, categoryRoles.cat1 || []],
    [2, categoryRoles.cat2 || []],
    [3, categoryRoles.cat3 || []],
    [4, categoryRoles.cat4 || []],
    [5, categoryRoles.cat5 || []],
  ];
  let best = null;
  for (const [tier, ids] of pairs) {
    if (ids.includes(roleId)) {
      if (best === null || tier < best) best = tier;
    }
  }
  return best;
}

function packStrings(parts, maxLen) {
  const chunks = [];
  let cur = [];
  let len = 0;
  for (const p of parts) {
    const add = p.length + (cur.length ? 2 : 0);
    if (len + add > maxLen && cur.length) {
      chunks.push(cur.join('\n\n'));
      cur = [p];
      len = p.length;
    } else {
      cur.push(p);
      len += add;
    }
  }
  if (cur.length) chunks.push(cur.join('\n\n'));
  return chunks;
}

function embedCharBudget(emb) {
  const d = emb.data;
  return (
    (d.description?.length || 0) +
    (d.title?.length || 0) +
    (d.footer?.text?.length || 0) +
    80
  );
}

/** Respecte la limite ~6000 caractères / message et max 10 embeds. */
export function batchEmbedsForSending(embeds) {
  const batches = [];
  let current = [];
  let charCount = 0;
  const MAX_CHARS = 5200;
  const MAX_EMBEDS = 10;

  for (const emb of embeds) {
    const c = embedCharBudget(emb);
    if (
      current.length >= MAX_EMBEDS ||
      (charCount + c > MAX_CHARS && current.length > 0)
    ) {
      batches.push(current);
      current = [];
      charCount = 0;
    }
    current.push(emb);
    charCount += c;
  }
  if (current.length) batches.push(current);
  return batches;
}

/**
 * @param {{ tiers: Array<{ roleId: string, voiceMinutesRequired: number, messagesRequired: number, order: number }>, categoryRoles?: object }} opts
 * @returns {EmbedBuilder[]}
 */
export function buildEmbedRankEmbeds({ tiers, categoryRoles }) {
  const sorted = [...tiers].sort((a, b) => a.order - b.order);
  if (!sorted.length) return [];

  const withMeta = sorted.map((t, idx) => ({
    ...t,
    displayStep: idx + 1,
    staffCat: staffCategoryForRoleId(t.roleId, categoryRoles) ?? 'other',
  }));

  const groups = new Map();
  for (const k of [1, 2, 3, 4, 5, 'other']) groups.set(k, []);
  for (const t of withMeta) {
    groups.get(t.staffCat).push(t);
  }

  const embeds = [];

  embeds.push(
    new EmbedBuilder()
      .setTitle('📊 Paliers de rankup staff')
      .setColor(0x5865f2)
      .setDescription(
        [
          'Quand un **membre staff** atteint les objectifs (**minutes en vocal** **et** **messages**), le bot attribue **automatiquement** le rôle du **prochain** palier qu’il n’a pas encore.',
          '',
          '**Les deux** barres doivent être remplies. L’**ordre** (#1, #2…) est celui du rankup.',
          '',
          'Chaque bloc correspond à une **catégorie staff** (`-panelcat`). Les rôles **non** placés dans une catégorie 1–5 apparaissent dans **Autres paliers**.',
        ].join('\n')
      )
      .setTimestamp()
  );

  for (const catKey of [1, 2, 3, 4, 5, 'other']) {
    const list = groups.get(catKey);
    if (!list.length) continue;

    const emoji = CAT_EMOJI[catKey];
    const titleBase =
      catKey === 'other'
        ? `${emoji} Autres paliers`
        : `${emoji} Catégorie staff ${catKey}`;

    const header =
      catKey === 'other'
        ? '_Rôle du palier non assigné aux catégories 1–5 du panel._'
        : `_${CAT_BLURB[catKey]}_`;

    const blocks = list.map(
      (t) =>
        `**#${t.displayStep}** · <@&${t.roleId}>\n🎤 **\`${t.voiceMinutesRequired}\`** min en vocal · 💬 **\`${t.messagesRequired}\`** messages`
    );

    const packed = packStrings([header, ...blocks], 3900);
    packed.forEach((desc, i) => {
      const e = new EmbedBuilder()
        .setTitle(i === 0 ? titleBase : `${titleBase} — suite`)
        .setColor(CAT_COLORS[catKey === 'other' ? 'other' : catKey])
        .setDescription(desc);
      embeds.push(e);
    });
  }

  const last = embeds[embeds.length - 1];
  if (last) {
    last.setFooter({
      text: 'Config : -setrankstaff · Éditer / supprimer : -listrankstaff',
    });
  }

  return embeds;
}
