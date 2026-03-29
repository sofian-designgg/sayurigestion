import mongoose from 'mongoose';

const staffStatsSchema = new mongoose.Schema({
  guildId: { type: String, required: true },
  userId: { type: String, required: true },
  voiceMinutes: { type: Number, default: 0 },
  messageCount: { type: Number, default: 0 },
});

staffStatsSchema.index({ guildId: 1, userId: 1 }, { unique: true });

export const StaffStats = mongoose.model('StaffStats', staffStatsSchema);
