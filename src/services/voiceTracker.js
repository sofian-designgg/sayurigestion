import { VoiceSession } from '../database/models/VoiceSession.js';
import { addVoiceMinutes } from './rankup.js';

/** Plafond de minutes créditées pour une session « orpheline » (sortie pendant que le bot était off). */
const ORPHAN_MAX_MIN = Math.min(
  24 * 60,
  Math.max(1, Number(process.env.VOICE_ORPHAN_MAX_MINUTES) || 24 * 60)
);

export async function markVoiceJoin(guildId, userId) {
  await VoiceSession.findOneAndUpdate(
    { guildId, userId },
    { guildId, userId, joinedAt: new Date() },
    { upsert: true }
  );
}

export async function clearVoiceJoin(guildId, userId) {
  await VoiceSession.deleteOne({ guildId, userId }).catch(() => {});
}

/** Minutes depuis joinedAt (persisté MongoDB), puis suppression de la session. */
export async function consumeVoiceMinutes(guildId, userId) {
  const doc = await VoiceSession.findOneAndDelete({ guildId, userId }).lean();
  if (!doc?.joinedAt) return 0;
  const ms = Date.now() - new Date(doc.joinedAt).getTime();
  return Math.max(0, Math.floor(ms / 60_000));
}

export async function hasActiveVoice(guildId, userId) {
  const n = await VoiceSession.countDocuments({ guildId, userId });
  return n > 0;
}

/**
 * Sessions encore en base alors que la personne **n’est plus en vocal** : en général elle a
 * quitté pendant que le bot était hors ligne (aucun `voiceStateUpdate`). On crédite les
 * minutes (avec plafond) puis on supprime la ligne pour ne pas bloquer les prochains vocaux.
 * À lancer **avant** `syncVoiceJoinsFromClient`.
 */
export async function flushOrphanVoiceSessions(client) {
  const sessions = await VoiceSession.find({}).lean();
  let flushed = 0;
  let minutesTotal = 0;

  for (const s of sessions) {
    const guild = client.guilds.cache.get(s.guildId);
    if (!guild) {
      await VoiceSession.deleteOne({ _id: s._id }).catch(() => {});
      continue;
    }

    const member = await guild.members.fetch(s.userId).catch(() => null);
    if (!member) {
      await VoiceSession.deleteOne({ _id: s._id }).catch(() => {});
      continue;
    }

    if (member.voice?.channelId) continue;

    const raw = Math.floor(
      (Date.now() - new Date(s.joinedAt).getTime()) / 60_000
    );
    const mins = Math.min(Math.max(0, raw), ORPHAN_MAX_MIN);
    if (mins > 0) {
      await addVoiceMinutes(member, mins).catch(() => {});
      minutesTotal += mins;
    }
    await VoiceSession.deleteOne({ _id: s._id }).catch(() => {});
    flushed++;
  }

  if (flushed > 0) {
    console.log(
      `Vocal : ${flushed} session(s) orpheline(s) fermée(s) (sortie pendant arrêt bot) — ~${minutesTotal} min créditées (plafond ${ORPHAN_MAX_MIN} min / session).`
    );
  }
}

/**
 * Au démarrage : quelqu’un peut être en vocal sans ligne en base (ex. premier join
 * pendant que le bot était off). On crée une session avec **maintenant** uniquement
 * s’il n’en existe pas déjà (sinon on garde le **joinedAt** sauvegardé = temps déjà en voc conservé).
 */
export async function syncVoiceJoinsFromClient(client) {
  let created = 0;
  for (const guild of client.guilds.cache.values()) {
    for (const ch of guild.channels.cache.values()) {
      if (!ch.isVoiceBased()) continue;
      for (const member of ch.members.values()) {
        if (member.user.bot) continue;
        const exists = await VoiceSession.findOne({
          guildId: guild.id,
          userId: member.id,
        }).lean();
        if (!exists) {
          await markVoiceJoin(guild.id, member.id);
          created++;
        }
      }
    }
  }
  if (created > 0) {
    console.log(
      `Vocal : ${created} nouvelle(s) session(s) (déjà en salon, pas encore en base). Les autres gardent leur heure d’entrée.`
    );
  }
}
