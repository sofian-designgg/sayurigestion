import mongoose from 'mongoose';

const reactionRoleBindingSchema = new mongoose.Schema({
  guildId: { type: String, required: true },
  channelId: { type: String, required: true },
  messageId: { type: String, required: true },
  /** `custom:emojiId` ou `unicode:name` */
  emojiKey: { type: String, required: true },
  roleId: { type: String, required: true },
  /** Chaîne passée à message.react() */
  reactString: { type: String, required: true },
});

reactionRoleBindingSchema.index(
  { guildId: 1, channelId: 1, messageId: 1, emojiKey: 1 },
  { unique: true }
);

export const ReactionRoleBinding = mongoose.model(
  'ReactionRoleBinding',
  reactionRoleBindingSchema
);
