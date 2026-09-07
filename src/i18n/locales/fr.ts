/**
 * Locale de reference. Les deux autres sont typees `typeof fr`, donc c'est ce
 * fichier qui definit le contrat : y ajouter une cle fait echouer `vue-tsc` sur
 * `en.ts` et `zh.ts` jusqu'a ce qu'elles soient traduites.
 *
 * Surtout PAS de `as const` : chaque valeur deviendrait son propre type
 * litteral, et toute traduction serait alors refusee comme n'etant pas la
 * chaine francaise.
 *
 * Les guillemets et les espaces font partie de la traduction, pas du code : le
 * francais veut « ... » avec espaces insecables, l'anglais "...", le chinois
 * n'a pas d'espace avant ses unites. Aucun composant ne doit les ajouter.
 */
export default {
  app: {
    /**
     * Nom du produit. En minuscules dans les trois langues, ce n'est pas une
     * coquille : les capitales de `NOM` (App.vue) sont un logotype, pas le nom.
     * Un nom propre ne se traduit pas non plus. `title` sert de `document.title`.
     * Voir aussi le <title> de index.html, qui est statique.
     */
    name: 'bloub',
    title: 'bloub — avatar SVG animé',
    botAria: 'Avatar bloub animé'
  },

  gallery: {
    back: 'Retour au lecteur'
  },

  rail: {
    nav: 'Sections',
    customize: 'Personnaliser',
    lab: 'Laboratoire',
    animations: 'Animations',
    settings: 'Réglages'
  },

  panel: {
    /**
     * Au SINGULIER, comme les trois autres : un titre de grille nomme ce qu'un
     * clic pose, pas le nombre de vignettes proposees. Le pluriel reste au rail,
     * qui nomme la vue et non le choix (`rail.animations`).
     */
    animations: 'Animation',
    shape: 'Forme',
    character: 'Personnage',
    expression: 'Expression',
    color: 'Couleur'
  },

  characters: {
    bloub: 'bloub',
    kirby: 'Kirby'
  },

  /**
   * Barre d'export de la vue Personnaliser. Les libelles du menu sont des
   * ACTIONS et pas des noms de format : « Télécharger le PNG » se comprend sans
   * savoir ce qu'est un PNG, « PNG · 1024 px » demande de trancher une question
   * qui n'est pas celle de l'utilisateur.
   */
  export: {
    action: 'Exporter en PNG',
    more: 'Autres formats',
    png: 'Télécharger le PNG',
    svg: 'Télécharger le SVG',
    anime: "Télécharger l'animation SVG",
    gif: 'Télécharger le GIF animé',
    cycleDetail: 'La vidéo est plus légère et plus fluide ; le GIF passe partout.',
    cycleFormat: 'Format',
    cycle_mp4: 'Vidéo MP4',
    cycle_mp4_aide: 'Léger et fluide, fond obligatoire',
    cycle_gif: 'GIF animé',
    cycle_gif_aide: 'Lu partout, plus lourd',
    cycleProgress: 'Export en cours…',
    cycleReessayer: 'Réessayer',
    gifTitle: 'Télécharger le GIF animé',
    gifDetail:
      "Le GIF ne gère la transparence qu'en tout ou rien : sans fond, le contour de la boule est un peu dur.",
    gifBackground: 'Fond',
    fond_blanc: 'Fond blanc',
    fond_blanc_aide: 'Contour lisse, à poser sur du clair',
    fond_transparent: 'Fond transparent',
    fond_transparent_aide: "S'adapte à tout fond, contour un peu dur",
    gifConfirm: 'Télécharger',
    copie: "Copier l'image",
    copieSvg: 'Copier le SVG',
    done: 'Exporté',
    copied: 'Copié',
    failed: "Échec de l'export"
  },

  preview: {
    exit: "Quitter l'aperçu",
    /** Nom de la touche tel qu'il est grave sur le clavier de la langue. */
    key: 'Échap'
  },

  timeline: {
    play: 'Lancer la lecture',
    pause: 'Arrêter la lecture',
    addAnimation: 'Ajouter une animation',
    preview: 'Aperçu',
    export: 'Exporter le montage',
    zoom: 'Zoom de la piste',
    blockAria: '{state}, {duration}',
    blockDurationAria: 'Durée de {state}, {duration}',
    blockRemoveAria: 'Retirer {state}'
  },

  dialog: {
    cancel: 'Annuler',
    nameCreateTitle: 'Nouveau cycle',
    nameRenameTitle: 'Renommer le cycle',
    nameField: 'Nom du cycle',
    nameCreate: 'Créer',
    nameRename: 'Renommer',
    removeTitle: 'Supprimer « {name} » ?',
    removeDetail:
      'Ce montage sera perdu, avec son animation. | Ce montage sera perdu, avec ses {n} animations.',
    removeConfirm: 'Supprimer'
  },

  cycles: {
    defaultName: 'Cycle par défaut',
    newName: 'Mon cycle',
    menuNew: 'Nouveau cycle',
    menuRenameAria: 'Renommer {name}',
    menuRemoveAria: 'Supprimer {name}'
  },

  units: {
    seconds: '{n} s',
    /** Graduation de la règle : serré, le chiffre est déjà petit. */
    secondsShort: '{n}s'
  },

  settings: {
    title: 'Réglages',
    language: 'Langue',
    about: 'À propos',
    credits: 'Créé avec ❤️ par {name}',
    creditsAria: 'Jérémy sur X, dans un nouvel onglet',
    github: 'Voir le projet sur GitHub',
    githubAria: 'Le dépôt du projet sur GitHub, dans un nouvel onglet'
  },

  lab: {
    title: 'Laboratoire',
    pose: 'Pose',
    import: 'Import',
    motion: 'Mouvement',
    agent: 'Agent',
    body: 'Corps',
    gaze: 'Regard',
    eyes: 'Yeux',
    expression: 'Expression',
    yaw: 'Lacet',
    pitch: 'Tangage',
    roll: 'Roulis',
    split: 'Écart',
    width: 'Largeur',
    height: 'Hauteur',
    tilt: 'Inclinaison',
    open: 'Ouverture',
    leftEye: 'Œil gauche',
    rightEye: 'Œil droit',
    linkEyes: 'Lier les yeux',
    freezeGaze: 'Figer le regard',
    reset: 'Réinitialiser',
    apply: 'Appliquer à l’avatar',
    parts: 'Pièces',
    partsHint:
      'Volumes indépendants, pas un second contour. Kirby = un corps + deux bras ellipsoïdes.',
    kirby: 'Kirby',
    addEllipsoid: 'Ajouter un ellipsoïde',
    addCapsule: 'Ajouter une capsule',
    clearParts: 'Retirer les pièces',
    armLeft: 'Bras gauche',
    armRight: 'Bras droit',
    partX: 'X',
    partY: 'Y',
    partZ: 'Z',
    partRotZ: 'Rotation Z',
    partSx: 'Taille X',
    partSy: 'Taille Y',
    custom: 'Personnalisé',
    svgLabel: 'Source SVG',
    svgHint:
      'Collez un SVG ou choisissez un fichier. Le plus grand contour devient un profil de 64 rayons.',
    svgFile: 'Choisir un fichier',
    svgApply: 'Utiliser comme corps',
    svgError: 'SVG illisible : aucun contour fermé.',
    svgOk: 'Profil à 64 points prêt.',
    parse: 'Analyser',
    jsonTitle: 'Personnage JSON',
    jsonHint:
      'Le PNG et le SVG ne sont qu’une image. Le JSON de bloub garde le corps et les pièces (bras, etc.) séparés, pour les réimporter tels quels.',
    jsonExport: 'Exporter JSON',
    jsonImport: 'Importer JSON',
    jsonOk: '« {name} » chargé.',
    jsonExported: 'JSON téléchargé.',
    jsonError: 'JSON illisible : ce n’est pas un personnage.',
    primitives: 'Primitives',
    addState: 'Ajouter un état',
    addPartStep: 'Ajouter un geste',
    partMotionHint: 'Les gestes visent une main, en plus de l’état. Les deux bras peuvent bouger en même temps.',
    duration: 'Durée',
    sendToTimeline: 'Ouvrir dans Animations',
    timelineNoParts:
      'Ce mouvement anime des pièces. La timeline d’états ne les enregistre pas encore.',
    play: 'Jouer',
    stop: 'Arrêter',
    loop: 'Boucle',
    removePrimitive: 'Retirer',
    current: 'État visuel',
    fire: 'Événement',
    motionCycle: 'Lab · {name}',
    motions: {
      rest: 'Repos',
      notice: 'Attention',
      think: 'Réflexion',
      write: 'Écriture',
      speak: 'Parole',
      error: 'Erreur',
      done: 'Terminé',
      sleep: 'Veille',
      wave: 'Vague',
      hand: 'Main au visage',
      celebrate: 'Célébrer',
      clap: 'Applaudir'
    },
    events: {
      idle: 'Repos',
      notice: 'Attention',
      think: 'Réflexion',
      write: 'Écriture',
      speak: 'Parole',
      error: 'Erreur',
      done: 'Terminé',
      sleep: 'Veille'
    },
    prim: {
      state: 'État',
      expression: 'Expression',
      look: 'Regard',
      hold: 'Pause',
      rotate: 'Rotation',
      translate: 'Translation',
      oscillate: 'Oscillation'
    }
  },

  states: {
    idle: 'Repos',
    thinking: 'Réflexion',
    wink: "Clin d'œil",
    wide: 'Yeux écarquillés',
    alert: 'Alerte',
    notify: 'Notification',
    exclaim: 'Exclamation',
    sleep: 'Veille',
    egg: 'Œuf',
    hexagon: 'Hexagone',
    play: 'Lecture',
    orbit: 'Orbite',
    burst: 'Éclatement',
    comet: 'Comète',
    swirl: 'Tourbillon'
  },

  shapes: {
    cercle: 'Cercle',
    galet: 'Galet',
    squircle: 'Squircle',
    capsule: 'Capsule',
    triangle: 'Triangle',
    hexagone: 'Hexagone',
    nuage: 'Nuage',
    goutte: 'Goutte'
  },

  colors: {
    encre: 'Encre',
    creme: 'Crème',
    brun: 'Brun',
    rouge: 'Rouge',
    orange: 'Orange',
    ambre: 'Ambre',
    vert: 'Vert',
    turquoise: 'Turquoise',
    bleu: 'Bleu',
    violet: 'Violet',
    rose: 'Rose',
    gris: 'Gris'
  },

  expressions: {
    neutre: 'Neutre',
    attentif: 'Attentif',
    surpris: 'Surpris',
    excite: 'Excité',
    heureux: 'Heureux',
    hilare: 'Hilare',
    colere: 'En colère',
    triste: 'Triste',
    effraye: 'Effrayé',
    mefiant: 'Méfiant',
    confus: 'Confus',
    curieux: 'Curieux',
    fier: 'Fier',
    timide: 'Timide',
    blase: 'Blasé',
    somnolent: 'Somnolent'
  }
}
