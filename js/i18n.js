/* =============================================================================
 * i18n.js — every word the arcade says to a player, in bokmål and in English.
 *
 * The hub's contract (CLAUDE.md §2, "Two languages, Norwegian first"), worked
 * out in kitchens/js/i18n.js and kept to the same shape every game uses:
 *
 *   t(key, ...args)   the current language, else English, else the key itself,
 *                     warning once per missing key. A value may be a function,
 *                     because a language is not a template with blanks in it:
 *                     "1 maskin" / "3 maskiner", and Norwegian puts the game's
 *                     name in a different place in half the sentences below.
 *   getLang()         'nb' or 'en'.
 *   setLang(lang)     validates, stores, sets <html lang>, repaints every
 *                     marked node, then dispatches `arcade:lang` on document.
 *                     Everything the arcade builds at runtime listens for that
 *                     and repaints itself — main.js's HUD and menu, the touch
 *                     button in controls.js, and the canvas lettering on the
 *                     signs and cabinet screens, which is the one place a
 *                     language switch costs GPU work: each board redraws its
 *                     texture ONCE, on the event, and never per frame
 *                     (PERFORMANCE.md). screen.js and the boot watchdog in
 *                     index.html import nothing and keep their own few words.
 *   paintStatic(root) [data-i18n] -> textContent, [data-i18n-label] ->
 *                     aria-label and title; and three the arcade adds:
 *                     [data-i18n-aria] -> aria-label only (a group or a canvas,
 *                     where a hover tooltip would sit over the sky),
 *                     [data-i18n-title] -> title only (the menu plate, whose
 *                     tooltip carries "(Esc)" and whose label does not),
 *                     [data-i18n-html] -> innerHTML, for the few lines that
 *                     carry <kbd> or <b> inside a sentence — only ever this
 *                     file's own strings, never anything a player typed — and
 *                     [data-i18n-placeholder] -> placeholder.
 *
 * NORWEGIAN BY DEFAULT, whatever the browser prefers: the owner's call for the
 * whole arcade. The choice lives in `arcade.lang.v1`, the one key every game on
 * the origin shares — a language is a fact about the player, not about a
 * cabinet, so choosing English here means every game opens in English too. It
 * holds "nb" or "en" and never anything else. index.html sets <html lang> from
 * it in the head, before first paint, and the static text there is written in
 * Norwegian, so the default never flashes English on the way in.
 *
 * NOT TRANSLATED: the names of the games, the arcade's own name (GOPHER CLOUD,
 * on the HUD, the boards and the wordmark), the pets' names, the manifest,
 * console output, storage keys, and the letters in the mailbox, which are what
 * somebody wrote. The fps readout behind ?perf=1 is a measuring tool in units
 * (fps, ms, draws) and is left as it is.
 *
 * GAME TAGLINES come from games.json, not from here: an entry may carry
 * `"nb": { "tagline", "description" }` beside its English ones, and
 * gameText() below picks the right one with English (or the game's own
 * manifest) as the fallback, so a new slug with no Norwegian yet still gets a
 * card rather than a gap.
 * ========================================================================== */

const KEY = 'arcade.lang.v1';

function initial() {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === 'nb' || saved === 'en') return saved;
  } catch {
    // No storage: the default stands.
  }
  return 'nb';
}

let lang = initial();
document.documentElement.lang = lang;

export const getLang = () => lang;

/** For Intl: how each language writes a date. Only the mailbox asks. */
export const locale = () => (lang === 'nb' ? 'nb-NO' : 'en-GB');

/**
 * A game's tagline or description in the current language. `game` is what
 * registry.js resolved: English (or the manifest's) on the top level, and an
 * optional `nb` object beside it from games.json.
 */
export function gameText(game, field) {
  if (lang === 'nb') {
    const nb = game?.nb?.[field];
    if (typeof nb === 'string' && nb.trim()) return nb;
  }
  return game?.[field] || '';
}

/* ------------------------------------------------------------ the words */

const plural = (n, one, many) => (n === 1 ? one : many);

const STRINGS = {
  nb: {
    'doc.title': 'GOPHER CLOUD ARCADE — himmelen er arkaden',

    // ---- boot
    'boot.clouds': 'ruller ut skyene…',
    'boot.machines': 'leser maskinene…',
    'boot.cabinets': (n) => `triller inn ${n} ${plural(n, 'spillmaskin', 'spillmaskiner')}…`,
    'boot.gopher': 'vekker gopheren…',
    'boot.noBabylon': 'Babylon.js ble ikke lastet. Første gang trenger arkaden internett.',
    'boot.failed': (why) => `Arkaden ville ikke åpne seg: ${why}`,

    // ---- the welcome card
    'title.blurb': 'Hver maskin står på sin egen sky. Hopp to ganger for å ri på skyen, og fly dit du vil.',
    'play': 'Spill',
    'lang': 'Språk',
    'lang.group': 'Språk / Language',
    'welcome.skip': 'Gå rett inn neste gang',
    'hint.keys':
      '<kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> gå &middot; ' +
      '<kbd>Mellomrom</kbd> hopp, én gang til for skyen &middot; ' +
      '<kbd>E</kbd> spill &middot; dra for å se deg rundt' +
      '<br>faller du av en sky, kommer skyen og henter deg',
    'hint.touch':
      'venstre tommel går &middot; den øverste knappen hopper, én gang til for skyen &middot; ' +
      'den under spiller på en maskin &middot; dra i himmelen for å se deg rundt' +
      '<br>faller du av en sky, kommer skyen og henter deg',

    // ---- install offer (title card, pause menu, the card itself)
    'install.offer': 'Installer på enheten din',
    'install.offerIos': 'Legg på Hjem-skjermen',
    'install.hide': 'Skjul dette, jeg spiller i nettleseren',
    'install.pause': 'Ha arkaden på enheten din',
    'install.head': 'Ta den med deg',
    'install.why':
      'Sitt eget ikon, rett inn i himmelen, i fullskjerm — ingen adresselinje i veien. ' +
      'Samme arkade, samme maskiner, ingenting holdt tilbake.',
    'install.go': 'Installer arkaden',
    'install.tap': 'Trykk på',
    'install.share': 'Del',
    'install.whereIpad': 'i raden med knapper øverst',
    'install.wherePhone': 'i linjen nederst på skjermen',
    'install.shareTail': '— boksen med en pil som hopper ut av den.',
    'install.ios2': 'Bla nedover i lista og velg <b>Legg til på Hjem-skjerm</b>.',
    'install.android1': 'Åpne menyen i nettleseren — de <b>tre prikkene</b> øverst til høyre.',
    'install.android2': 'Velg <b>Installer app</b>. Noen nettlesere kaller det <b>Legg til på startsiden</b>.',
    'install.note':
      'Ingen konto, ingenting å melde seg på, ingenting sendes noe sted. ' +
      'Spiller du i nettleseren i stedet, går du ikke glipp av noe av dette.',
    'install.close': 'Ikke nå — det går fint å spille her',

    // ---- HUD and the corner
    'hud.count': (n) => `${n} ${plural(n, 'maskin', 'maskiner')} i lufta`,
    'menu': 'Meny',
    'menu.title': 'Meny (Esc)',
    'mute': 'Slå av lyden',
    'unmute': 'Slå på lyden',

    // ---- where you are
    'platform.minimaze': 'Kulehagen',
    'platform.zoodoku': 'Gåteenga',
    'platform.geometry_pong': 'Sekskantbanen',
    'platform.heist': 'Nattbanken',
    'platform.neonfox': 'Neonarenaen',
    'platform.lobbots': 'Prøvefeltet',
    'platform.welcome': 'Velkomstskyen',
    'platform.water': 'Akvariet',
    'platform.race': 'Gyrohangaren',
    'platform.mine': 'Fjellknausen',
    'platform.adventure': 'Gruvefirmaet',
    'platform.mine_bridge': 'Gruvebrua',
    'platform.dam': 'Demningen',
    'platform.calm': 'Den stille skyen',
    'platform.open': 'Den åpne himmelen',
    'seat.welcome': 'Velkomstbenken',
    'seat.garden': 'Hagebenken',
    'seat.aquarium': 'Akvariekrakken',

    // ---- the callout over whatever the gopher stands at
    'cue.tap': (glyph) => `trykk <kbd>${glyph}</kbd>`,
    'cue.play': 'spill',
    'cue.pets': 'velg et kjæledyr',
    'cue.dress': 'kle ut gopheren',
    'cue.read': 'les',
    'cue.write': 'skriv et brev',
    'cue.readAnswer': 'les svaret ditt',
    'cue.toRead': ' for å lese det',
    'cue.take': 'ta det med hjem',
    'cue.sit': 'sett deg',
    'cue.standTouch': (glyph) => `trykk <kbd>${glyph}</kbd> for å reise deg`,
    'cue.standKeys': '<kbd>E</kbd> reis deg · gå eller hopp for å gå videre',
    'prompt.sitting': 'Setter seg…',
    'prompt.standing': 'Reiser seg…',
    'prompt.resting': 'Tar en pause',
    'prompt.pets': 'Kjæledyr',
    'prompt.dress': 'Utkledning',
    'prompt.parents': 'For foreldre og foresatte',
    'prompt.mailbox': 'Postkassen',
    'prompt.mailboxAnswer': 'Postkassen — et svar til deg',
    'prompt.take': (title) => `Ta med ${title} hjem`,

    // ---- the touch button under UP (controls.js): glyph, then label
    'glyph.read': 'LES',
    'glyph.sit': 'SITT',
    'glyph.stand': 'STÅ',
    'glyph.pets': 'DYR',
    'glyph.dress': 'KLÆR',
    'glyph.write': 'SKRIV',
    'glyph.take': 'TA MED',
    'glyph.play': 'SPILL',
    'action.read': 'Les skiltet',
    'action.sit': 'Sett deg',
    'action.stand': 'Reis deg',
    'action.pets': 'Velg et kjæledyr',
    'action.dress': 'Kle ut gopheren',
    'action.write': 'Skriv et brev',
    'action.take': 'Ta med dette spillet hjem',
    'action.run': 'Løp',
    'action.descend': 'Synk',
    'action.play': 'Spill',
    'action.up': 'Opp',

    // ---- the menu
    'paused': 'Pause',
    'resume': 'Fortsett',
    'music': 'MUSIKK',
    'effects': 'EFFEKTER',
    'sound.note': 'MUSIKK er arkadens egen melodi · EFFEKTER er alt rundt deg — mynter, skritt og andres maskiner',
    'sound.muted': 'Lyden er slått av i hjørnet. Flytt en glidebryter, eller trykk på høyttaleren igjen, for å få lyden tilbake.',
    'sound.noTheme': 'Melodien kunne ikke lastes, så det er ingen musikk å stille på. Rommet lager fortsatt sine egne lyder.',
    'on': 'på',
    'off': 'av',
    'toggle': (label, on) => `${label}: ${on ? 'på' : 'av'}`,
    'quality.label': 'Grafikk',
    'quality.full': 'full',
    'quality.lighter': 'lett',
    'quality.probe': (x) => `Grafikk: ${String(x).replace('.', ',')}x (fra lenken)`,
    'stats.label': 'Ytelse',
    'fromLink': ' (fra lenken)',
    'welcome.label': 'Velkomstskjerm',

    // ---- the rotate notice (screen.js keeps its own words for the button)
    'rotate.head': 'Snu enheten på siden',
    'rotate.why': 'Himmelen er bredere enn den er høy.',

    // ---- the cabinet, when a game has no way out of its own
    'back.arcade': 'Tilbake til arkaden',
    'back': 'Tilbake',

    // ---- for parents and guardians
    'parents.alt': 'Gopheren med flosshatt og monokkel, svevende på en liten sky',
    'parents.aria': 'Arkadens filosofi',
    'parents.title': 'For foreldre og foresatte',
    'parents.p1':
      'Jeg er utvikler og far til to gutter, og jeg laget Gopher Cloud Arcade for at det skulle føles som spillene jeg vokste opp med: du slår det på, du spiller, og ingenting står i veien.',
    'parents.p2':
      'Derfor finnes det ingen reklame og ingen varsler her. Ingenting maser på barnet ditt om å komme tilbake: ingen daglige rekker å holde ved like, ingen nedtellinger, ingen belønning for å møte opp. Det finnes ingen kontoer og ingenting å melde seg på, og alle spillene er gratis for alle.',
    'parents.p3':
      'Jeg håper det kan bli et sted å dele: finn et spill sammen, hei på hverandre, og la barna finne sine egne favoritter og sitt eget tempo. Her er det plass til å vandre, tulle eller bare sitte i skyene en stund.',
    'parents.p4':
      'Noen av spillene kan spilles sammen over internett, og de kjører i nettleseren på nettbrett, telefoner og datamaskiner, så en venn, et søskenbarn eller en besteforelder kan være med fra det de allerede har i hendene. Én spiller deler en romkode, de andre skriver den inn, og det er alt: ingenting å installere, ingen å registrere.',
    'parents.p5':
      'Jeg kommer ikke til å selge dataene dine. Jeg vil ikke engang ha dem. Det finnes ingen analyse her og ingen sporing av noe slag, og ingenting blir stille samlet inn mens barnet ditt spiller. Det arkaden husker er lite, og det blir værende på enheten du spiller på: om lyden er på, hvor skarp du vil ha himmelen. Hvis kontoer og lagret fremgang kommer en dag, er det der de blir lagret også. Og hvis noe forlater enheten, som et brev barnet ditt velger å legge i arkadens postkasse, inneholder det det de skrev, hvilket spill det handlet om, og et tilfeldig navn arkaden har gitt denne nettleseren — noe sånt som gc-7f3q-k2m9. Det navnet er hvordan svaret mitt finner veien tilbake til riktig postkasse, og det betyr at jeg kan se at to brev kom fra samme sted, som er det som gjør en samtale mulig i det hele tatt. Det er også alt jeg noen gang vet: ikke noe ekte navn, ingen konto, ingen e-post, ingenting om hvem eller hvor du er. Det hører til en nettleser og ikke til en person, og tømmer du nettleserens data, er det borte for godt. Selskapet som bringer posten for meg, Forminit, oppbevarer brevene på servere i Irland og noterer, som alle postvesen, hvilken internettadresse de kom fra. Jeg bruker den aldri til noe, og jeg sletter brevene når jeg har svart på dem.',
    'parents.p6':
      'Alt i arkaden er gratis i dag. Hvis den noen gang skal betale for seg selv, blir det gjennom tullete hatter og skyvenner for alle som har lyst til å bidra. Aldri et abonnement, aldri en pris på et spill, og aldri noe som gir én spiller en fordel eller låser en del av et spill.',
    'parents.p7':
      'Arkaden er fortsatt i beta og vokser. Spillene kan ha ulikt tempo og ulik vanskelighetsgrad, så jeg inviterer deg til å utforske sammen med barnet ditt og velge det som passer for familien deres.',
    'parents.scrollUp': 'Rull teksten opp',
    'parents.scrollDown': 'Rull teksten ned',
    'parents.scrollThumb': 'Rull teksten for foreldre og foresatte',
    'parents.scrolled': (p) => `${p} % rullet`,
    'parents.allVisible': 'All teksten vises',

    // ---- the mailbox
    'mail.title': 'Postkassen',
    'mail.intro':
      'Skriv til den som har laget dette stedet. Svarene kommer tilbake til denne postkassen, på denne enheten — tømmer du nettleseren, forsvinner de, akkurat som et papirbrev du har mistet.',
    'mail.thread': 'Brevene dine og svarene',
    'mail.letter': 'Brevet ditt',
    'mail.placeholder': 'Kjære arkade …',
    'mail.care': 'Du trenger ikke skrive navnet ditt, skolen din eller hvor du bor — fortell så mye eller så lite du vil.',
    'mail.post': 'Send brevet',
    'mail.room': (n) => `plass til ${n} tegn`,
    'mail.roomLeft': (n) => `plass til ${n} tegn til`,
    'mail.you': 'Du',
    'mail.arcade': 'Arkaden',
    'mail.empty': 'Ingenting i postkassen ennå. Skriv det første brevet, så skriver jeg tilbake.',
    'mail.wait': 'Ett brev om gangen — gi posten et minutt på å komme i gang.',
    'mail.posting': 'Sender …',
    'mail.busy': 'Posten har mye å gjøre akkurat nå. Vent et minutt og send det igjen.',
    'mail.sent': 'Det ligger i postkassen. Jeg skriver tilbake her.',
    'mail.failed': 'Det ville ikke gå — det er stille i lufta. Brevet ditt er her fortsatt, så prøv igjen om litt.',
    'mail.closed': 'Posten henter ikke fra denne postkassen ennå. Skriv brevet ditt — det blir liggende.',
    'mail.arrived': 'Et svar kom akkurat.',

    // ---- the take-home machine
    'take.eyebrow': 'TA MED HJEM',
    'take.title': 'Ta det med hjem',
    'take.heading': (title) => `Ta med ${title} hjem`,
    'take.blurb': (title) =>
      `${title} kan bo på enheten din som alt annet der: sitt eget ikon, ingen adresselinje, og det virker selv når internett ikke gjør det.`,
    'take.ios': (title) => [
      `${title} åpnes i Safari.`,
      'Trykk på Del-knappen — firkanten med en pil ut av seg.',
      'Velg «Legg til på Hjem-skjerm».',
    ],
    'take.android': (title) => [
      `${title} åpnes i nettleseren din.`,
      'Trykk på ⋮-menyen øverst til høyre.',
      'Velg «Installer app» eller «Legg til på startsiden».',
    ],
    'take.desktop': (title) => [
      `${title} åpnes i en ny fane.`,
      'Se etter installeringsknappen i adresselinjen — en liten skjerm med en pil.',
      'Chrome og Edge har en. Firefox har det ikke, og det er ikke din feil.',
    ],
    'take.note':
      'Du er i den installerte arkaden, så dette åpnes i et vanlig nettleservindu — og den typen vindu har ingen installeringsknapp. Hvis menyen ikke tilbyr det, åpner du arkaden i selve Chrome og kommer tilbake til denne maskinen.',
    'take.later': 'Kanskje senere',
    'take.go': (title) => `Åpne ${title} for seg selv`,
    'take.goPlain': 'Åpne det for seg selv',

    // ---- pets
    'pets.preview': 'Levende 3D-bilde av kjæledyret',
    'pets.canvas': 'Det valgte dyret på sin egen sky',
    'pets.companion': 'Skyvennen din',
    'pets.eyebrow': 'LITT SELSKAP',
    'pets.title': 'Kjæledyr',
    'pets.intro': 'Velg en venn som følger deg, både til fots og i lufta.',
    'pets.group': 'Velg skyvennen din',
    'pets.pip': 'Kanin med bladører · bomullshale',
    'pets.noodle': 'Aksolotl med frynser · svingende finnehale',
    'pets.nyan': 'Bakverkskatt · regnbuestripe når den flyr',
    'pets.none': 'Ingen kjæledyr',
    'pets.solo': 'Reis alene',
    'pets.done': 'Ferdig',
    'pets.chosen': (name) => `${name} er skyvennen din.`,
    'pets.alone': 'Du reiser uten kjæledyr.',
    'pets.previewOf': (name) => `${name} · skyvennen din`,
    'pets.choose': 'Velg et kjæledyr for å se det',

    // ---- the dresser
    'outfit.preview': 'Levende bilde av gopheren',
    'outfit.eyebrow': 'UTKLEDNINGSROMMET',
    'outfit.yours': 'Gopheren din',
    'outfit.left': 'Snu gopheren mot venstre',
    'outfit.right': 'Snu gopheren mot høyre',
    'outfit.look': 'Ta en titt rundt',
    'outfit.mix': 'MIKS OG MATCH',
    'outfit.title': 'Utkledning',
    'outfit.intro': 'Én ting på hver plass. Velg noe nytt for å bytte, eller trykk på det igjen for å ta det av.',
    'outfit.items': 'Utstyret',
    'outfit.count': (n) => `${n} ting valgt`,
    'outfit.none': 'Ingenting på ennå',
    'outfit.clear': 'Ta av alt',
    'outfit.done': 'Bruk dette antrekket',
    'outfit.note': 'Antrekket ditt blir husket, og reven din har det på seg i NeonFox.',
    'outfit.loading': 'Laster bilde …',
    'outfit.noPreview': 'Ingen bilde',
    'outfit.slotSmall': (slot) => slot,
    'outfit.empty': 'tom',
    'slot.head': 'Hode',
    'slot.eyes': 'Øyne',
    'slot.mouth': 'Munn',
    'slot.nose': 'Nese',
    'slot.neck': 'Hals',
    'slot.ears': 'Ører',
    'acc.topHat': 'Flosshatt',
    'acc.antennae': 'Romvesenantenner',
    'acc.crown': 'Kongekrone',
    'acc.vikingHelmet': 'Vikinghjelm',
    'acc.propellerCap': 'Propellcaps',
    'acc.sunglasses': 'Tullete solbriller',
    'acc.monocle': 'Monokkel',
    'acc.snorkel': 'Snorkelmaske',
    'acc.eyePatch': 'Sjørøverlapp',
    'acc.mustache': 'Krøllete bart',
    'acc.bubbleGum': 'Tyggegummi',
    'acc.clownNose': 'Klovnenese',
    'acc.pigSnout': 'Grisetryne',
    'acc.bowTie': 'Sløyfe',
    'acc.necktie': 'Kontorslips',
    'acc.medal': 'Gullmedalje',
    'acc.earrings': 'Gulløreringer',
    'acc.headphones': 'Hodetelefoner',

    // ---- lettering in the sky (signs.js, cabinets.js, parents.js, pets.js, customization.js)
    'sign.welcome': 'VELKOMMEN TIL ARKADEN',
    'sign.fly': 'Hopp to ganger for å fly',
    'sign.find': 'Finn ditt neste spill i skyene',
    'sign.parents1': 'For foreldre',
    'sign.parents2': 'og foresatte',
    'sign.pets': 'KJÆLEDYR',
    'sign.dresser': 'UTKLEDNING',
    'screen.play': 'SPILL',
  },

  en: {
    'doc.title': 'GOPHER CLOUD ARCADE — the sky is the arcade',

    'boot.clouds': 'rolling out the clouds…',
    'boot.machines': 'reading the machines…',
    'boot.cabinets': (n) => `wheeling in ${n} ${plural(n, 'cabinet', 'cabinets')}…`,
    'boot.gopher': 'waking the gopher…',
    'boot.noBabylon': 'Babylon.js did not load. The floor needs the network the first time.',
    'boot.failed': (why) => `The arcade did not open: ${why}`,

    'title.blurb': 'Every machine is on its own cloud. Jump twice to ride the cloud, and fly to whichever one you fancy.',
    'play': 'Play',
    'lang': 'Language',
    'lang.group': 'Language / Språk',
    'welcome.skip': 'Go straight in next time',
    'hint.keys':
      '<kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> walk &middot; ' +
      '<kbd>Space</kbd> hop, again for the cloud &middot; ' +
      '<kbd>E</kbd> play &middot; drag to look' +
      '<br>fall off a cloud and the cloud comes back for you',
    'hint.touch':
      'left thumb walks &middot; the top button hops, again for the cloud &middot; ' +
      'the one under it plays at a machine &middot; drag the sky to look' +
      '<br>fall off a cloud and the cloud comes back for you',

    'install.offer': 'Install on your device',
    'install.offerIos': 'Add to home screen',
    'install.hide': 'Hide this, I will play in the browser',
    'install.pause': 'Keep it on your device',
    'install.head': 'Take it with you',
    'install.why':
      'Its own icon, straight into the sky, full screen — no address bar in the way. ' +
      'Same arcade, same machines, nothing held back for it.',
    'install.go': 'Install the arcade',
    'install.tap': 'Tap',
    'install.share': 'Share',
    'install.whereIpad': 'in the row of buttons at the top',
    'install.wherePhone': 'in the bar at the bottom of the screen',
    'install.shareTail': '— the box with an arrow jumping out of it.',
    'install.ios2': 'Scroll that list and choose <b>Add to Home Screen</b>.',
    'install.android1': "Open your browser's menu — the <b>three dots</b> at the top right.",
    'install.android2': 'Choose <b>Install app</b>. Some browsers call it <b>Add to Home screen</b>.',
    'install.note':
      'No account, nothing to sign up for, nothing sent anywhere. Playing in the browser ' +
      'instead costs you none of it.',
    'install.close': 'Not now — playing here is fine',

    'hud.count': (n) => `${n} ${plural(n, 'machine', 'machines')} in the sky`,
    'menu': 'Menu',
    'menu.title': 'Menu (Esc)',
    'mute': 'Mute',
    'unmute': 'Unmute',

    'platform.minimaze': 'The marble garden',
    'platform.zoodoku': 'The puzzle meadow',
    'platform.geometry_pong': 'The hexagon court',
    'platform.heist': 'The night bank',
    'platform.neonfox': 'The neon arena',
    'platform.lobbots': 'The proving ground',
    'platform.welcome': 'The welcome cloud',
    'platform.water': 'The aquarium',
    'platform.race': 'The gyro hangar',
    'platform.mine': 'The outcrop',
    'platform.adventure': 'The mining company',
    'platform.mine_bridge': 'The miners’ bridge',
    'platform.dam': 'The reservoir',
    'platform.calm': 'The quiet cloud',
    'platform.open': 'The open sky',
    'seat.welcome': 'Welcome bench',
    'seat.garden': 'Garden bench',
    'seat.aquarium': 'Aquarium stool',

    'cue.tap': (glyph) => `tap <kbd>${glyph}</kbd>`,
    'cue.play': 'play game',
    'cue.pets': 'choose companion',
    'cue.dress': 'customize gopher',
    'cue.read': 'read',
    'cue.write': 'write a letter',
    'cue.readAnswer': 'read your answer',
    'cue.toRead': ' to read it',
    'cue.take': 'keep it on your device',
    'cue.sit': 'sit down',
    'cue.standTouch': (glyph) => `tap <kbd>${glyph}</kbd> to get up`,
    'cue.standKeys': '<kbd>E</kbd> stand up · move or jump to leave',
    'prompt.sitting': 'Sitting down…',
    'prompt.standing': 'Getting up…',
    'prompt.resting': 'Taking a break',
    'prompt.pets': 'Pets',
    'prompt.dress': 'Dresser',
    'prompt.parents': 'For parents and guardians',
    'prompt.mailbox': 'The mailbox',
    'prompt.mailboxAnswer': 'The mailbox — an answer for you',
    'prompt.take': (title) => `${title} to take home`,

    'glyph.read': 'READ',
    'glyph.sit': 'SIT',
    'glyph.stand': 'STAND',
    'glyph.pets': 'PETS',
    'glyph.dress': 'DRESS',
    'glyph.write': 'WRITE',
    'glyph.take': 'TAKE',
    'glyph.play': 'PLAY',
    'action.read': 'Read sign',
    'action.sit': 'Sit down',
    'action.stand': 'Stand up',
    'action.pets': 'Choose a pet',
    'action.dress': 'Customize gopher',
    'action.write': 'Write a letter',
    'action.take': 'Take this game home',
    'action.run': 'Run',
    'action.descend': 'Descend',
    'action.play': 'Play game',
    'action.up': 'Up',

    'paused': 'Paused',
    'resume': 'Resume',
    'music': 'MUSIC',
    'effects': 'EFFECTS',
    'sound.note': 'MUSIC is the arcade’s own tune · EFFECTS is the room around you — coins, footsteps and other people’s machines',
    'sound.muted': 'Silenced from the corner. Move a slider, or press the speaker again, to bring the room back.',
    'sound.noTheme': 'The theme could not be loaded, so there is no music to set. The room still makes its own noise.',
    'on': 'on',
    'off': 'off',
    'toggle': (label, on) => `${label}: ${on ? 'on' : 'off'}`,
    'quality.label': 'Sky detail',
    'quality.full': 'full',
    'quality.lighter': 'lighter',
    'quality.probe': (x) => `Sky detail: ${x}x (from the link)`,
    'stats.label': 'Stats',
    'fromLink': ' (from the link)',
    'welcome.label': 'Welcome screen',

    'rotate.head': 'Turn your device sideways',
    'rotate.why': 'The sky is wider than it is tall.',

    'back.arcade': 'Back to arcade',
    'back': 'Back',

    'parents.alt': 'The Gopher wearing a top hat and monocle, floating on a little cloud',
    'parents.aria': 'Arcade philosophy',
    'parents.title': 'For parents and guardians',
    'parents.p1':
      'I’m a developer and a father of two boys, and I built Gopher Cloud Arcade to feel like the games I grew up with: you turn it on, you play, and nothing gets in the way.',
    'parents.p2':
      'So there are no ads and no push notifications. Nothing here nags your child to come back: no daily streaks to keep up, no countdowns, no rewards for showing up. There are no accounts and nothing to sign up for, and every game is free to play for everyone.',
    'parents.p3':
      'I hope it can be a place to share: discover a game together, cheer each other on, and let children find their own favourites and their own pace. There’s room to wander, be silly, or just sit in the clouds for a while.',
    'parents.p4':
      'Some of the games play together over the internet, and they run in a browser on tablets, phones and computers alike, so a friend, a cousin or a grandparent can join from whatever they already have in their hands. One player shares a room code, the others enter it, and that is the whole setup: nothing to install, nobody to sign up.',
    'parents.p5':
      'I won’t sell your data. I don’t even want it. There is no analytics here and no tracking of any kind, and nothing is quietly gathered up while your child plays. What the arcade remembers is small, and it stays on the device you are playing on: whether the sound is on, how sharp you like the sky. If accounts and saved progress arrive one day, that is where they will be saved too. And if something leaves the device, like a letter your child chooses to post in the arcade’s mailbox, it carries what they wrote, which game it was about, and a random name the arcade gave this browser — something like gc-7f3q-k2m9. That name is how my answer finds its way back to the right mailbox, and it does mean I can tell that two letters came from the same one, which is what makes a conversation possible at all. It is also all I ever know: no real name, no account, no email, nothing about who or where you are. It belongs to a browser rather than to a person, and clearing that browser’s data ends it for good. The company that carries the post for me, Forminit, keeps the letters on servers in Ireland and, like any postal service, notes the internet address they came from. I never use it for anything, and I delete letters once I have answered them.',
    'parents.p6':
      'Everything in the arcade is free today. If it ever pays for itself, it will be through silly hats and cloud companions for anyone who feels like chipping in. Never a subscription, never a price on a game, and never anything that gives one player an advantage or locks part of a game away.',
    'parents.p7':
      'The arcade is still in beta and growing. Games can differ in pace and challenge, so I invite you to explore alongside your child and choose what feels right for your family.',
    'parents.scrollUp': 'Scroll text up',
    'parents.scrollDown': 'Scroll text down',
    'parents.scrollThumb': 'Scroll the parents and guardians text',
    'parents.scrolled': (p) => `${p}% scrolled`,
    'parents.allVisible': 'All text visible',

    'mail.title': 'The mailbox',
    'mail.intro':
      'Write to whoever built this place. Answers come back to this box, on this device — clear your browser and they go with it, like a paper letter you lost.',
    'mail.thread': 'Your letters and the answers',
    'mail.letter': 'Your letter',
    'mail.placeholder': 'Dear arcade…',
    'mail.care': 'No need to write your name, your school or where you live — tell me as much or as little as you like.',
    'mail.post': 'Post it',
    'mail.room': (n) => `room for ${n} characters`,
    'mail.roomLeft': (n) => `room for ${n} more characters`,
    'mail.you': 'You',
    'mail.arcade': 'The arcade',
    'mail.empty': 'Nothing in the box yet. Write the first letter and I will write back.',
    'mail.wait': 'One letter at a time — give the post a minute to get going.',
    'mail.posting': 'Posting…',
    'mail.busy': 'The post is busy just now. Give it a minute and send it again.',
    'mail.sent': 'It is in the box. I will write back here.',
    'mail.failed': 'It would not go — the sky is quiet. Your letter is still here, so try again in a bit.',
    'mail.closed': 'The post is not collecting from this box yet. Write your letter — it will keep.',
    'mail.arrived': 'An answer just came in.',

    'take.eyebrow': 'TAKE ONE HOME',
    'take.title': 'Take it home',
    'take.heading': (title) => `Take ${title} home`,
    'take.blurb': (title) =>
      `${title} can live on your device like anything else on it: its own icon, no address bar, and it keeps working when the internet does not.`,
    'take.ios': (title) => [
      `${title} opens in Safari.`,
      'Tap the Share button — the square with an arrow out of it.',
      'Choose "Add to Home Screen".',
    ],
    'take.android': (title) => [
      `${title} opens in your browser.`,
      'Tap the ⋮ menu, top right.',
      'Choose "Install app", or "Add to Home screen".',
    ],
    'take.desktop': (title) => [
      `${title} opens in a new tab.`,
      'Look in the address bar for the install button — a little screen with an arrow.',
      'Chrome and Edge have one. Firefox does not, and that is not your fault.',
    ],
    'take.note':
      'You are in the installed arcade, so this opens in a plain browser window — and that kind of window has no install button. If the menu does not offer it, open the arcade in Chrome itself and come back to this machine.',
    'take.later': 'Maybe later',
    'take.go': (title) => `Open ${title} on its own`,
    'take.goPlain': 'Open it on its own',

    'pets.preview': 'Live 3D pet preview',
    'pets.canvas': 'Selected creature on its own cloud',
    'pets.companion': 'Your cloud companion',
    'pets.eyebrow': 'A LITTLE COMPANY',
    'pets.title': 'Pets',
    'pets.intro': 'Pick one friend to follow you, on foot and in the sky.',
    'pets.group': 'Choose your companion',
    'pets.pip': 'Leaf-eared rabbit · cotton tail',
    'pets.noodle': 'Frilly axolotl · swishing fin tail',
    'pets.nyan': 'Pastry cat · rainbow trail in flight',
    'pets.none': 'No pet',
    'pets.solo': 'Travel solo',
    'pets.done': 'Done',
    'pets.chosen': (name) => `${name} is your companion.`,
    'pets.alone': 'Travelling without a pet.',
    'pets.previewOf': (name) => `${name} · your cloud companion`,
    'pets.choose': 'Choose a pet to preview',

    'outfit.preview': 'Live gopher preview',
    'outfit.eyebrow': 'THE DRESSING ROOM',
    'outfit.yours': 'Your gopher',
    'outfit.left': 'Turn gopher left',
    'outfit.right': 'Turn gopher right',
    'outfit.look': 'Take a look around',
    'outfit.mix': 'MIX & MATCH',
    'outfit.title': 'Dresser',
    'outfit.intro': 'One item per slot. Pick a new item to swap it in, or select it again to take it off.',
    'outfit.items': 'Accessory inventory',
    'outfit.count': (n) => `${n} ${plural(n, 'item', 'items')} selected`,
    'outfit.none': 'Nothing on yet',
    'outfit.clear': 'Take everything off',
    'outfit.done': 'Wear this look',
    'outfit.note': 'Your look is remembered, and your fox wears it in NeonFox.',
    'outfit.loading': 'Loading preview…',
    'outfit.noPreview': 'Preview unavailable',
    'outfit.slotSmall': (slot) => `${slot} slot`,
    'outfit.empty': 'empty',
    'slot.head': 'Head',
    'slot.eyes': 'Eyes',
    'slot.mouth': 'Mouth',
    'slot.nose': 'Nose',
    'slot.neck': 'Neck',
    'slot.ears': 'Ears',
    'acc.topHat': 'Top hat',
    'acc.antennae': 'Alien antennae',
    'acc.crown': 'Royal crown',
    'acc.vikingHelmet': 'Viking helmet',
    'acc.propellerCap': 'Propeller cap',
    'acc.sunglasses': 'Silly sunglasses',
    'acc.monocle': 'Monocle',
    'acc.snorkel': 'Snorkel mask',
    'acc.eyePatch': 'Pirate eye patch',
    'acc.mustache': 'Curly mustache',
    'acc.bubbleGum': 'Bubble gum',
    'acc.clownNose': 'Clown nose',
    'acc.pigSnout': 'Piggy snout',
    'acc.bowTie': 'Bow tie',
    'acc.necktie': 'Office necktie',
    'acc.medal': 'Gold medal',
    'acc.earrings': 'Golden hoops',
    'acc.headphones': 'Headphones',

    'sign.welcome': 'WELCOME TO THE ARCADE',
    'sign.fly': 'Jump twice to fly',
    'sign.find': 'Find your next game in the clouds',
    'sign.parents1': 'For parents',
    'sign.parents2': 'and guardians',
    'sign.pets': 'PETS',
    'sign.dresser': 'DRESSER',
    'screen.play': 'PLAY  GAME',
  },
};

/* ------------------------------------------------------------ machinery */

const warned = new Set();

export function t(key, ...args) {
  let v = STRINGS[lang][key];
  if (v === undefined) {
    v = STRINGS.en[key];
    if (!warned.has(key)) {
      warned.add(key);
      console.warn(`[cloudnine] no ${lang} words for "${key}"`);
    }
  }
  if (v === undefined) return key;
  return typeof v === 'function' ? v(...args) : v;
}

/** Every marked node in `root` gets its words in the current language. */
export function paintStatic(root = document) {
  for (const n of root.querySelectorAll('[data-i18n]')) n.textContent = t(n.dataset.i18n);
  for (const n of root.querySelectorAll('[data-i18n-html]')) n.innerHTML = t(n.dataset.i18nHtml);
  for (const n of root.querySelectorAll('[data-i18n-label]')) {
    const words = t(n.dataset.i18nLabel);
    n.setAttribute('aria-label', words);
    n.title = words;
  }
  for (const n of root.querySelectorAll('[data-i18n-aria]')) n.setAttribute('aria-label', t(n.dataset.i18nAria));
  for (const n of root.querySelectorAll('[data-i18n-title]')) n.title = t(n.dataset.i18nTitle);
  for (const n of root.querySelectorAll('[data-i18n-alt]')) n.alt = t(n.dataset.i18nAlt);
  for (const n of root.querySelectorAll('[data-i18n-placeholder]')) n.placeholder = t(n.dataset.i18nPlaceholder);
  if (root === document) document.title = t('doc.title');
  paintLangButtons();
}

/**
 * The language rows — one on the welcome card, one in the menu, the same two
 * buttons in each. aria-pressed is the whole of their state, and CSS draws the
 * chosen one off it, so what is lit and what a screen reader hears cannot
 * drift apart.
 */
function paintLangButtons() {
  for (const b of document.querySelectorAll('button[data-lang]')) {
    b.setAttribute('aria-pressed', String(b.dataset.lang === lang));
  }
}

export function setLang(next) {
  if (next !== 'nb' && next !== 'en' || next === lang) return;
  lang = next;
  document.documentElement.lang = lang;
  try {
    localStorage.setItem(KEY, lang);
  } catch {
    // Not remembered; this visit still switches.
  }
  paintStatic();
  document.dispatchEvent(new CustomEvent('arcade:lang', { detail: lang }));
}

/**
 * Wire every language button on the page. `onPress` is the caller's — main.js
 * passes the menu click — so this file stays free of audio. Switching never
 * closes the panel it was pressed in, never unpauses and never restarts
 * anything (hub §2): it repaints words and nothing else.
 */
export function bindLangButtons(onPress) {
  for (const b of document.querySelectorAll('button[data-lang]')) {
    b.addEventListener('click', () => {
      setLang(b.dataset.lang);
      onPress?.();
    });
  }
  paintLangButtons();
}

// The static page is written in Norwegian; an English player's first frame is
// repainted here, before main.js builds anything on top of it. A Norwegian one
// still needs the title-bar text and the two rows' pressed state.
if (lang !== 'nb') paintStatic();
else {
  document.title = t('doc.title');
  paintLangButtons();
}
