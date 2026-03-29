import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';

export function buildAbsenceAnnouncementEmbed() {
  return new EmbedBuilder()
    .setTitle('📆 Absence')
    .setDescription(
      [
        '## Formulaire :',
        '',
        'Ton **pseudo**, ton **ID** et tes **rôles** sont récupérés automatiquement par le bot.',
        '',
        '> **Temps :** *(durée de l’absence)*',
        '> **Raison :**',
        '',
        '-# Tout troll ou autre seras lourdement sanctionné.',
      ].join('\n')
    )
    .setColor(0x5865f2);
}

export function buildAbsenceButtonRow(guildId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`absence_start:${guildId}`)
      .setLabel('Déclarer une absence')
      .setStyle(ButtonStyle.Success)
  );
}
