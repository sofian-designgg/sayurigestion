import { GuildConfig } from '../database/models/GuildConfig.js';

/**
 * Salon « compte à la suite » : 1, 2, 3… Une erreur remet le compteur à 0 (prochain = 1).
 * @returns {Promise<boolean>} true si le message a été traité (salon compteur)
 */
export async function handleCountingMessage(message) {
  if (!message.guild || message.author.bot) return false;

  const cfg = await GuildConfig.findOne({ guildId: message.guild.id }).lean();
  if (!cfg?.countingChannelId || message.channel.id !== cfg.countingChannelId) {
    return false;
  }

  const trimmed = message.content.trim();
  if (!/^\d+$/.test(trimmed)) {
    await GuildConfig.updateOne({ guildId: message.guild.id }, { $set: { countingLastNumber: 0 } });
    await message.react('❌').catch(() => {});
    return true;
  }

  const n = parseInt(trimmed, 10);
  if (!Number.isFinite(n) || n < 1) {
    await GuildConfig.updateOne({ guildId: message.guild.id }, { $set: { countingLastNumber: 0 } });
    await message.react('❌').catch(() => {});
    return true;
  }

  const prev = cfg.countingLastNumber ?? 0;
  const expected = prev + 1;

  if (n !== expected) {
    await GuildConfig.updateOne({ guildId: message.guild.id }, { $set: { countingLastNumber: 0 } });
    await message.react('❌').catch(() => {});
    return true;
  }

  const updated = await GuildConfig.findOneAndUpdate(
    {
      guildId: message.guild.id,
      countingChannelId: cfg.countingChannelId,
      countingLastNumber: prev,
    },
    { $set: { countingLastNumber: n } },
    { new: true }
  );

  if (!updated) {
    await message.react('❌').catch(() => {});
    return true;
  }

  await message.react('✅').catch(() => {});
  return true;
}
