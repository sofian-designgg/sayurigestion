import { EmbedBuilder } from 'discord.js';
import { GuildConfig } from '../database/models/GuildConfig.js';

/**
 * @param {import('discord.js').Client} client
 * @param {string} guildId
 * @param {object} opts
 */
export async function sendAdminLog(client, guildId, opts) {
  const config = await GuildConfig.findOne({ guildId });
  const chId = config?.adminLogChannelId;
  if (!chId) return;

  const guild = client.guilds.cache.get(guildId);
  const channel = guild?.channels.cache.get(chId);
  if (!channel?.isTextBased()) return;

  const embed = new EmbedBuilder()
    .setTitle(opts.title || 'Journal staff')
    .setColor(opts.color ?? 0x5865f2)
    .setTimestamp();

  if (opts.description) embed.setDescription(opts.description);
  if (opts.fields?.length) embed.addFields(opts.fields);

  await channel.send({ embeds: [embed] }).catch(() => {});
}
