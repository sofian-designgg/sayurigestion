import mongoose from 'mongoose';

const categoryRolesSchema = new mongoose.Schema(
  {
    cat1: { type: [String], default: [] },
    cat2: { type: [String], default: [] },
    cat3: { type: [String], default: [] },
    cat4: { type: [String], default: [] },
    cat5: { type: [String], default: [] },
  },
  { _id: false }
);

const guildConfigSchema = new mongoose.Schema({
  guildId: { type: String, required: true, unique: true },
  adminLogChannelId: { type: String, default: null },
  absenceEmbedChannelId: { type: String, default: null },
  absenceResponseChannelId: { type: String, default: null },
  /** Salon des annonces de rankup staff (mention + embed). */
  rankupAnnounceChannelId: { type: String, default: null },
  categoryRoles: { type: categoryRolesSchema, default: () => ({}) },
});

export const GuildConfig = mongoose.model('GuildConfig', guildConfigSchema);
