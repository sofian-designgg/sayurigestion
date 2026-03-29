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
  /** Catégorie parent des salons vocaux « stats » (-setcatserveurinfo). */
  serverStatsCategoryId: { type: String, default: null },
  serverStatsVcMembersId: { type: String, default: null },
  serverStatsVcOnlineId: { type: String, default: null },
  serverStatsVcVoiceId: { type: String, default: null },
  serverStatsVcBoostId: { type: String, default: null },
  serverStatsVcInviteId: { type: String, default: null },
  /** Salon du jeu « compte 1, 2, 3… » (-setchannelcompeut). */
  countingChannelId: { type: String, default: null },
  /** Dernier nombre valide (0 = le prochain doit être 1). */
  countingLastNumber: { type: Number, default: 0 },
  categoryRoles: { type: categoryRolesSchema, default: () => ({}) },
  /** Rôles réattribués après un rankup s’ils manquent (ex. apprenti). */
  rankupForeverRoleIds: { type: [String], default: [] },
});

export const GuildConfig = mongoose.model('GuildConfig', guildConfigSchema);
