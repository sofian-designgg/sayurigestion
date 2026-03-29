/** Extrait mention utilisateur <@123> ou <@!123> */
export function parseUserMention(arg) {
  if (!arg) return null;
  const m = arg.match(/^<@!?(\d+)>$/);
  return m ? m[1] : /^\d{17,20}$/.test(arg) ? arg : null;
}

/** Parse durées type 10m, 2h, 30s, 1d */
export function parseDuration(str) {
  if (!str) return null;
  const m = String(str).toLowerCase().match(/^(\d+)(s|m|h|d)$/);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  const u = m[2];
  const mult = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
  return n * mult[u];
}
