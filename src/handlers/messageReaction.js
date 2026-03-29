import { ReactionRoleBinding } from '../database/models/ReactionRoleBinding.js';
import { emojiKeyFromReaction } from '../utils/parseDiscordLink.js';

async function resolveReaction(reaction) {
  if (reaction.partial) {
    try {
      await reaction.fetch();
    } catch {
      return null;
    }
  }
  if (reaction.message?.partial) {
    try {
      await reaction.message.fetch();
    } catch {
      return null;
    }
  }
  return reaction;
}

export async function handleMessageReactionAdd(reaction, user) {
  if (user.bot) return;
  const r = await resolveReaction(reaction);
  if (!r?.message?.guild) return;

  const msg = r.message;
  const emojiKey = emojiKeyFromReaction(r);

  const binding = await ReactionRoleBinding.findOne({
    guildId: msg.guild.id,
    channelId: msg.channel.id,
    messageId: msg.id,
    emojiKey,
  }).lean();

  if (!binding) return;

  const member = await msg.guild.members.fetch(user.id).catch(() => null);
  if (!member) return;

  await member.roles.add(binding.roleId).catch((err) => {
    console.warn(
      `[reaction-role] impossible d’ajouter le rôle ${binding.roleId} à ${user.id} :`,
      err?.message || err
    );
  });
}

export async function handleMessageReactionRemove(reaction, user) {
  if (user.bot) return;
  const r = await resolveReaction(reaction);
  if (!r?.message?.guild) return;

  const msg = r.message;
  const emojiKey = emojiKeyFromReaction(r);

  const binding = await ReactionRoleBinding.findOne({
    guildId: msg.guild.id,
    channelId: msg.channel.id,
    messageId: msg.id,
    emojiKey,
  }).lean();

  if (!binding) return;

  const member = await msg.guild.members.fetch(user.id).catch(() => null);
  if (!member) return;

  await member.roles.remove(binding.roleId).catch((err) => {
    console.warn(
      `[reaction-role] impossible de retirer le rôle ${binding.roleId} à ${user.id} :`,
      err?.message || err
    );
  });
}
