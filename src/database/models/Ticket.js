import mongoose from 'mongoose';

const ticketSchema = new mongoose.Schema({
  guildId: { type: String, required: true, index: true },
  channelId: { type: String, required: true, unique: true },
  openerId: { type: String, required: true },
  /** Identifiant du bouton (type de ticket). */
  buttonId: { type: String, required: true },
  closedAt: { type: Date, default: null },
});

ticketSchema.index({ guildId: 1, openerId: 1, closedAt: 1 });

export const Ticket = mongoose.model('Ticket', ticketSchema);
