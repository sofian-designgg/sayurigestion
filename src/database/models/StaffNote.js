import mongoose from 'mongoose';

const staffNoteSchema = new mongoose.Schema({
  guildId: { type: String, required: true },
  targetId: { type: String, required: true },
  authorId: { type: String, required: true },
  content: { type: String, required: true, maxlength: 2000 },
  createdAt: { type: Date, default: Date.now },
});

staffNoteSchema.index({ guildId: 1, targetId: 1, createdAt: -1 });

export const StaffNote = mongoose.model('StaffNote', staffNoteSchema);
