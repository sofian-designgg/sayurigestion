import mongoose from 'mongoose';

/** Session vocale active : permet de retrouver joinedAt après redémarrage du bot. */
const voiceSessionSchema = new mongoose.Schema({
  guildId: { type: String, required: true },
  userId: { type: String, required: true },
  joinedAt: { type: Date, required: true },
});

voiceSessionSchema.index({ guildId: 1, userId: 1 }, { unique: true });

export const VoiceSession = mongoose.model('VoiceSession', voiceSessionSchema);
