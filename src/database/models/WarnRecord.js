import mongoose from 'mongoose';

const warnRecordSchema = new mongoose.Schema({
  guildId: { type: String, required: true },
  targetId: { type: String, required: true },
  issuerId: { type: String, required: true },
  reason: { type: String, required: true },
  approvedById: { type: String, default: null },
  createdAt: { type: Date, default: Date.now },
});

warnRecordSchema.index({ guildId: 1, targetId: 1 });

export const WarnRecord = mongoose.model('WarnRecord', warnRecordSchema);
