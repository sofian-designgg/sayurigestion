import { consumeVoiceMinutes, markVoiceJoin } from '../services/voiceTracker.js';
import { addVoiceMinutes } from '../services/rankup.js';
import { scheduleStatsRefresh } from '../services/serverStatsChannels.js';

export async function handleVoiceStateUpdate(oldState, newState) {
  const guild = newState.guild;
  const uid = newState.id;
  const oldId = oldState.channelId;
  const newId = newState.channelId;

  if (oldId && oldId !== newId) {
    const mins = await consumeVoiceMinutes(guild.id, uid);
    const mem = await guild.members.fetch(uid).catch(() => null);
    if (mem && mins > 0) await addVoiceMinutes(mem, mins).catch(() => {});
  }

  if (newId && newId !== oldId) {
    await markVoiceJoin(guild.id, uid);
  }

  scheduleStatsRefresh(guild);
}
