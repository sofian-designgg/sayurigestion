import mongoose from 'mongoose';

const pendingWarnSchema = new mongoose.Schema({
  guildId: { type: String, required: true },
  targetId: { type: String, required: true },
  issuerId: { type: String, required: true },
  reason: { type: String, required: true },
  reviewMessageId: { type: String, default: null },
  reviewChannelId: { type: String, default: null },
  createdAt: { type: Date, default: Date.now },
});

export const PendingWarn = mongoose.model('PendingWarn', pendingWarnSchema);
