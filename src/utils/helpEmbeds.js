import { EmbedBuilder } from 'discord.js';

export function buildHelpEmbeds() {
  const intro = new EmbedBuilder()
    .setTitle('Aide — bot staff')
    .setDescription(
      [
        'Préfixe **`-`**. Ta **catégorie** = le **plus petit** numéro parmi tes rôles staff (ex. rôle cat. 2 + cat. 5 → tu es traité en **cat. 2**).',
        'Une commande indiquée « min. cat. 5 » est utilisable par **toute** l’équipe (1 à 5) ; « min. cat. 1 » seulement par la **cat. 1**. Les **menus** (salons / rôles) remplacent la saisie d’ID.',
      ].join('\n\n')
    )
    .setColor(0x5865f2);

  const cat1 = new EmbedBuilder()
    .setTitle('Catégorie 1 — configuration maximale')
    .setColor(0xed4245)
    .setDescription(
      [
        '**`-panelcat`** — Panneau : 5 embeds (une par catégorie) + boutons pour assigner les **rôles** de chaque catégorie (menu, pas d’ID à taper).',
        '**`-setadminlogs`** — Choisir le salon des **logs** de modération (timeouts, warns, validations…).',
        '**`-setabsencechannel`** — Salon de l’**embed d’absence** (bouton → MP → formulaire **durée + raison** ; pseudo / rôles remplis par le bot).',
        '**`-setabsenceinfo`** — Salon où arrivent les **réponses** d’absence (mention + réactions ✅❌).',
        '**`-setrankstaff`** — Choisir un **rôle**, puis indiquer **minutes vocal** et **messages** requis pour le rankup auto.',
        '**`-setchannelrank`** — Salon où le bot **mentionne** le staff et poste un **embed** à chaque rankup automatique.',
        '**`-setcatserveurinfo`** — Choisir une **catégorie** : crée **5 salons vocaux** affichage seule (membres, en ligne, en vocal, boost, lien .gg/sayuri), **mis à jour** en continu.',
        '**`-setchannelcompeut`** — Définit le salon où l’on compte **1, 2, 3…** sans se tromper : **✅** si bon, **❌** + reset si erreur.',
        '**`-setreactionrole`** — Bouton puis formulaire : **lien du message** + **un seul emoji** (pas de texte) + **rôle** ; réagir donne le rôle, enlever la réaction l’ôte. Voir aussi `-reactionrole list` et `-delreactionrole`.',
        '**`-listrankstaff`** — Liste tous les **paliers** rankup + menu pour **supprimer** la config d’un rôle.',
        '**`-absencesync`** — Renvoie l’**embed d’absence** dans le salon configuré (utile après édition).',
      ].join('\n\n')
    );

  const cat2 = new EmbedBuilder()
    .setTitle('Catégorie 2 — administration')
    .setColor(0xf26522)
    .setDescription(
      [
        '**`-resetstats @membre`** — Remet à **0** les compteurs **vocal + messages** staff (rankup) pour ce membre.',
      ].join('\n\n')
    );

  const cat3 = new EmbedBuilder()
    .setTitle('Catégorie 3 — notes & contrôle')
    .setColor(0xfee75c)
    .setDescription(
      [
        '**`-notedel <id>`** — Supprime une **note interne**. Copie l’**`id`** affiché dans `-notes` (chaîne MongoDB).',
        'Les **warns** déposés par la **cat. 5** sont **validés ou refusés** via boutons dans le salon **logs staff** (réservé aux cat. **1 à 4**).',
      ].join('\n\n')
    );

  const cat4 = new EmbedBuilder()
    .setTitle('Catégorie 4 — notes staff')
    .setColor(0x57f287)
    .setDescription(
      [
        '**`-note add @membre texte`** — Ajoute une **note interne** sur un membre (visible avec `-notes`).',
        '**`-notes @membre`** — Affiche les **notes** enregistrées (les plus récentes en premier).',
      ].join('\n\n')
    );

  const cat5 = new EmbedBuilder()
    .setTitle('Catégorie 5 — modération de base')
    .setColor(0x99aab5)
    .setDescription(
      [
        '**`-embed`** — Bouton → formulaire (**titre, description, couleur, auteur**, puis **miniature | image | pied** avec `|`) → salon. **Horodatage** inclus. **Tout le staff** (cat. 1 à 5).',
        '**`-warn @membre raison`** — Warn. Si tu es **seulement** en cat. 5, le warn part en **validation** (cat. 1–4 dans les logs). Sinon il est **appliqué** tout de suite.',
        '**`-mute`** / **`-timeout @membre 10m raison`** — **Timeout** Discord (durées : `s`, `m`, `h`, `d`, max 28 j).',
        '**`-warns @membre`** — Liste les **warns** enregistrés pour ce membre.',
        '**`-statsstaff`** — Tes **stats** : vocal, messages, catégorie, progression **rankup**.',
        '**`-help`** — Cette aide, **détaillée** par catégorie.',
      ].join('\n\n')
    );

  const extra = new EmbedBuilder()
    .setTitle('Rappels')
    .setColor(0x4f545c)
    .setDescription(
      [
        '· **Absence** : configurer **les deux** salons (`-setabsencechannel` + `-setabsenceinfo`) avant utilisation.',
        '· **Rankup** : compteurs pour les membres **staff** (rôle cat.) ou ayant un **rôle palier**.',
        '· **Stats vocales** (`-setcatserveurinfo`) : **PRESENCE INTENT** sur le portail pour **En ligne**.',
        '· **Rôles-réaction** : activer **MESSAGE CONTENT INTENT** (déjà) + **SERVER MEMBERS** ; ajouter **GUILD MESSAGE REACTIONS** (intent « réactions ») pour que le bot voie les réactions.',
        '· **Outil embed (HTML)** : URL `https://TON_DOMAINE_RAILWAY/embed-builder` (même **PORT** que le bot) — prévisualisation, couleur, emoji, copie **JSON** ou **discord.js**. En local : `http://localhost:3000/embed-builder`.',
      ].join('\n')
    );

  return [intro, cat1, cat2, cat3, cat4, cat5, extra];
}
