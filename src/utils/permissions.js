import { GuildConfig } from '../database/models/GuildConfig.js';

/**
 * Plus le nombre est petit, plus le staff est puissant (1 = max).
 * Retourne null si aucun rôle staff configuré ne correspond.
 */
export async function getUserPower(member) {
  const config = await GuildConfig.findOne({ guildId: member.guild.id });
  if (!config?.categoryRoles) return null;

  const cr = config.categoryRoles;
  const pairs = [
    [1, cr.cat1 || []],
    [2, cr.cat2 || []],
    [3, cr.cat3 || []],
    [4, cr.cat4 || []],
    [5, cr.cat5 || []],
  ];

  let best = null;
  for (const [tier, ids] of pairs) {
    for (const rid of ids) {
      if (member.roles.cache.has(rid)) {
        if (best === null || tier < best) best = tier;
      }
    }
  }
  return best;
}

/** commandMinPower: 1 = réservé cat 1 ; 5 = toute l’équipe staff (1–5). */
export function canUseCommand(userPower, commandMinPower) {
  if (userPower === null) return false;
  return userPower <= commandMinPower;
}

export async function memberIsStaff(member) {
  return (await getUserPower(member)) !== null;
}
