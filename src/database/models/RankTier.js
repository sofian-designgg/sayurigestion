import mongoose from 'mongoose';

const rankTierSchema = new mongoose.Schema({
  guildId: { type: String, required: true },
  roleId: { type: String, required: true },
  voiceMinutesRequired: { type: Number, required: true, min: 0 },
  messagesRequired: { type: Number, required: true, min: 0 },
  order: { type: Number, required: true },
});

rankTierSchema.index({ guildId: 1, roleId: 1 }, { unique: true });
rankTierSchema.index({ guildId: 1, order: 1 });

export const RankTier = mongoose.model('RankTier', rankTierSchema);
