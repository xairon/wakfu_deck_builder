export const meta = {
  name: "dofus-mag-extract",
  description:
    "Extraire les ~66 decks Dofus Mag restants depuis les photos (1 agent/deck, checksum 48)",
  phases: [
    { title: "Extraction", detail: "1 agent par deck, réconciliation à 48" },
  ],
};

const ROT = "E:\\wakfu_deck_builder\\dofus_mag_decks_rotated\\";
const OUTDIR = "E:\\wakfu_deck_builder\\scripts\\dofus-mag-extracted\\";

const DECKS = [
  {
    i: 3,
    title: "Deck Osamodas",
    hero: "Trantmy Londami",
    havreSac: "du Prespic",
    photos: ["20260624_184514.jpg"],
  },
  {
    i: 4,
    title: "Deck Sacrieur",
    hero: "Ayma Ragie",
    havreSac: "du Tofu",
    photos: ["20260624_184514.jpg", "20260624_184519.jpg"],
  },
  {
    i: 5,
    title: "Deck Enutrof",
    hero: "Hynd Yanajone",
    havreSac: "du Wabbit",
    photos: ["20260624_184527.jpg", "20260624_184532.jpg"],
  },
  {
    i: 6,
    title: "Deck Sram",
    hero: "Kouff Ourbe",
    havreSac: "du Bouftou",
    photos: ["20260624_184527.jpg", "20260624_184532.jpg"],
  },
  {
    i: 7,
    title: "Deck Eniripsa",
    hero: "Opée Tissoin",
    havreSac: "du Prespic",
    photos: ["20260624_184537.jpg", "20260624_184542.jpg"],
  },
  {
    i: 8,
    title: "Deck Pandawa",
    hero: "Shimay Rouch",
    havreSac: "du Wabbit",
    photos: ["20260624_184537.jpg", "20260624_184542.jpg"],
  },
  {
    i: 9,
    title: "Deck Bouftous",
    hero: "Bruss Ouilis",
    havreSac: "du Bouftou",
    photos: ["20260624_184803.jpg"],
  },
  {
    i: 10,
    title: "Deck Vampyres",
    hero: "Kouff Ourbe",
    havreSac: "du Tofu",
    photos: ["20260624_184803.jpg", "20260624_184809.jpg"],
  },
  {
    i: 11,
    title: "Deck Gelées",
    hero: "Trantmy Londamy",
    havreSac: "du Wabbit",
    photos: ["20260624_184814.jpg", "20260624_184819.jpg"],
  },
  {
    i: 12,
    title: "Deck Tofus",
    hero: "Tirlangue Portey",
    havreSac: "du Wabbit",
    photos: ["20260624_184819.jpg"],
  },
  {
    i: 13,
    title: "Deck Horde",
    hero: "Opée Tissoin",
    havreSac: "du Bouftou",
    photos: ["20260624_184829.jpg"],
  },
  {
    i: 14,
    title: "Deck Chi-Fu-Mi",
    hero: "Karey Dass",
    havreSac: "du Wabbit",
    photos: ["20260624_184835.jpg"],
  },
  {
    i: 15,
    title: "Deck Légumisation",
    hero: "Aeron Zeklox",
    havreSac: "du Prespic",
    photos: ["20260624_184841.jpg", "20260624_184845.jpg"],
  },
  {
    i: 16,
    title: "Deck Les Petits d'Abord",
    hero: "Poum Ondacié",
    havreSac: "du Prespic",
    photos: ["20260624_184841.jpg", "20260624_184845.jpg"],
  },
  {
    i: 17,
    title: "Deck Subtilité",
    hero: "Bruss Ouilis",
    havreSac: "du Wabbit",
    photos: ["20260624_185354.jpg", "20260624_185400.jpg"],
  },
  {
    i: 18,
    title: "Deck Espièglerie",
    hero: "Karey Dass",
    havreSac: "du Wabbit",
    photos: ["20260624_185354.jpg", "20260624_185400.jpg"],
  },
  {
    i: 19,
    title: "Deck Fourberie",
    hero: "Aeron Zeklox",
    havreSac: "du Prespic",
    photos: ["20260624_185407.jpg", "20260624_185413.jpg"],
  },
  {
    i: 20,
    title: "Deck Envahissement",
    hero: "Tirlangue Portey",
    havreSac: "du Bouftou",
    photos: ["20260624_185407.jpg", "20260624_185413.jpg"],
  },
  {
    i: 21,
    title: "Deck d'Atog",
    hero: "Tirlangue Portey",
    havreSac: "du Bouftou",
    photos: ["20260624_185711.jpg"],
  },
  {
    i: 22,
    title: "Deck de Nemoh",
    hero: "Aeron Zeklox",
    havreSac: "du Tofu",
    photos: ["20260624_185711.jpg", "20260624_185734.jpg"],
  },
  {
    i: 23,
    title: "Deck de Toad",
    hero: "Ayma Ragie",
    havreSac: "du Wabbit",
    photos: ["20260624_185742.jpg", "20260624_185749.jpg"],
  },
  {
    i: 24,
    title: "Deck de Boing",
    hero: "Trantmy Londami",
    havreSac: "du Wabbit",
    photos: [
      "20260624_185742.jpg",
      "20260624_185749.jpg",
      "20260624_185755.jpg",
    ],
  },
  {
    i: 25,
    title: "Deck de Jess",
    hero: "Bruss Ouilis",
    havreSac: "du Wabbit",
    photos: ["20260624_185913.jpg"],
  },
  {
    i: 26,
    title: "Deck de Charly",
    hero: "Tirlangue Portey",
    havreSac: "du Prespic",
    photos: ["20260624_185913.jpg", "20260624_185919.jpg"],
  },
  {
    i: 27,
    title: "Deck de Soukata",
    hero: "Opée Tissoin",
    havreSac: "du Tofu",
    photos: ["20260624_185927.jpg"],
  },
  {
    i: 28,
    title: "Deck de Zellina",
    hero: "Trantmy Londami",
    havreSac: "du Wabbit",
    photos: ["20260624_185927.jpg", "20260624_185945.jpg"],
  },
  {
    i: 29,
    title: "Deck du Champion de France (a)",
    hero: "Opée Tissoin",
    havreSac: "du Wabbit",
    photos: ["20260624_190116.jpg"],
  },
  {
    i: 30,
    title: "Deck du Vice-Champion de France (a)",
    hero: "Trantmy Londami",
    havreSac: "du Wabbit",
    photos: ["20260624_190116.jpg", "20260624_190120.jpg"],
  },
  {
    i: 31,
    title: "Deck Victoire aux Dofus",
    hero: "Opée Tissoin",
    havreSac: "du Wabbit",
    photos: ["20260624_190126.jpg"],
  },
  {
    i: 32,
    title: "Deck Chevalier",
    hero: "Bruss Ouilis",
    havreSac: "du Prespic",
    photos: ["20260624_190126.jpg", "20260624_190132.jpg"],
  },
  {
    i: 33,
    title: "Deck Bonta",
    hero: "Justine Broudi",
    havreSac: "du Corbac",
    photos: ["20260624_190245.jpg"],
  },
  {
    i: 34,
    title: "Deck Brâkmar",
    hero: "Mawy Blodie",
    havreSac: "du Bwork",
    photos: ["20260624_190245.jpg", "20260624_190250.jpg"],
  },
  {
    i: 35,
    title: "Deck Rats",
    hero: "Karey Dass",
    havreSac: "du Bouftou",
    photos: ["20260624_190255.jpg"],
  },
  {
    i: 36,
    title: "Deck Champi",
    hero: "Babeth Safoueth",
    havreSac: "du Craqueleur",
    photos: ["20260624_190255.jpg", "20260624_190300.jpg"],
  },
  {
    i: 37,
    title: "Deck 1er Tournoi des 12 (Xélor)",
    hero: "Aeron Zeklox",
    havreSac: "du Tofu",
    photos: ["20260624_190358.jpg"],
  },
  {
    i: 38,
    title: "Deck Montures (Agressif)",
    hero: "Hylary Swinte",
    havreSac: "du Bwork",
    photos: ["20260624_190428.jpg"],
  },
  {
    i: 39,
    title: "Deck Grouilleux (Temporisation)",
    hero: "Aeron Zeklox",
    havreSac: "du Crocodaille",
    photos: ["20260624_190432.jpg"],
  },
  {
    i: 40,
    title: "Deck Koalak (Agressif Monstre)",
    hero: "Trantmy Londami",
    havreSac: "du Craqueleur",
    photos: ["20260624_190440.jpg"],
  },
  {
    i: 41,
    title: "Deck Shushu (Agressif Équipement)",
    hero: "Thapa Sambal",
    havreSac: "du Craqueleur",
    photos: ["20260624_190447.jpg"],
  },
  {
    i: 42,
    title: "Deck du Champion Pandawa",
    hero: "Shimay Rouch",
    havreSac: "du Bouftou",
    photos: ["20260624_190622.jpg", "20260624_190630.jpg"],
  },
  {
    i: 43,
    title: "Deck Kanniboul",
    hero: "Shimay Rouch",
    havreSac: "du Tofu",
    photos: ["20260624_190639.jpg"],
  },
  {
    i: 44,
    title: "Deck Fantôme (Necro)",
    hero: "Opée Tissoin",
    havreSac: "du Fantôme",
    photos: ["20260624_190639.jpg", "20260624_190646.jpg"],
  },
  {
    i: 45,
    title: "Deck de Karey Dass",
    hero: "Karey Dass",
    havreSac: "du Wabbit",
    photos: ["20260624_190853.jpg", "20260624_190857.jpg"],
  },
  {
    i: 46,
    title: "Deck d'Hilary",
    hero: "Hilary Swinte",
    havreSac: "du Bouftou",
    photos: ["20260624_190853.jpg", "20260624_190857.jpg"],
  },
  {
    i: 47,
    title: "Deck du Champion de France (b)",
    hero: "Opée Tissoin",
    havreSac: "du Prespic",
    photos: ["20260624_190905.jpg"],
  },
  {
    i: 48,
    title: "Deck du Vice-champion de France (b)",
    hero: "Tirlangue Portey",
    havreSac: "du Wabbit",
    photos: ["20260624_190905.jpg", "20260624_190911.jpg"],
  },
  {
    i: 49,
    title: "Deck Boisson du 5e du CDF",
    hero: "Aeron Zeklox",
    havreSac: "du Tofu",
    photos: ["20260624_191018.jpg"],
  },
  {
    i: 50,
    title: "Deck Otomaï",
    hero: "Otomaï l'Enchanteur",
    havreSac: "du Corbac",
    photos: ["20260624_191018.jpg", "20260624_191023.jpg"],
  },
  {
    i: 51,
    title: "Deck de Jérémie Humeau (CDF)",
    hero: "Aeron Zeklox",
    havreSac: "du Tofu",
    photos: ["20260624_191135.jpg"],
  },
  {
    i: 52,
    title: "Deck du 4e du CDF",
    hero: "Trantmy Londami",
    havreSac: "du Bouftou",
    photos: ["20260624_191231.jpg"],
  },
  {
    i: 54,
    title: "Deck du Champion Ultime",
    hero: "Dani Osheun",
    havreSac: "du Corbac",
    photos: ["20260624_191359.jpg", "20260624_191404.jpg"],
  },
  {
    i: 55,
    title: "Deck du Champion Xélor",
    hero: "Flix Flax",
    havreSac: "du Bwork",
    photos: ["20260624_191359.jpg", "20260624_191404.jpg"],
  },
  {
    i: 56,
    title: "Deck du Déluge",
    hero: "Hilary Swinte",
    havreSac: "du Prespic",
    photos: ["20260624_191410.jpg"],
  },
  {
    i: 57,
    title: "Deck Un passe-temps comme les autres",
    hero: "Aeron Zeklox",
    havreSac: "du Tofu",
    photos: ["20260624_191416.jpg"],
  },
  {
    i: 58,
    title: "Deck d'Alexandre (Champion Eniripsa, Tournoi des Douze)",
    hero: "Bôm d'Utygr",
    havreSac: "du Corbac",
    photos: ["20260624_191515.jpg"],
  },
  {
    i: 59,
    title: "Deck de Romain (Champion Enutrof, Tournoi des Douze)",
    hero: "Thapa Sambal",
    havreSac: "du Corbac",
    photos: ["20260624_191515.jpg", "20260624_191524.jpg"],
  },
  {
    i: 60,
    title: "Deck de Swann (Champion Pandawa, Tournoi des Douze)",
    hero: "Mawy Blodie",
    havreSac: "du Corbac",
    photos: [
      "20260624_191524.jpg",
      "20260624_191529.jpg",
      "20260624_191532.jpg",
    ],
  },
  {
    i: 61,
    title: "Deck de Florian (Champion Iop, Tournoi des Douze)",
    hero: "Hilary Swinte",
    havreSac: "du Craqueleur",
    photos: ["20260624_191529.jpg", "20260624_191532.jpg"],
  },
  {
    i: 62,
    title: "Deck de Jérémie (Champion Féca, Tournoi des Douze)",
    hero: "Justine Broudi",
    havreSac: "du Corbac",
    photos: ["20260624_191538.jpg"],
  },
  {
    i: 63,
    title: "Deck d'Anthony (Champion Sacrieur, Tournoi des Douze)",
    hero: "Coa Gullay",
    havreSac: "du Corbac",
    photos: [
      "20260624_191538.jpg",
      "20260624_191543.jpg",
      "20260624_191547.jpg",
    ],
  },
  {
    i: 64,
    title: "Deck de Dimitri (Champion Crâ, Tournoi des Douze)",
    hero: "Luk Ylook",
    havreSac: "du Corbac",
    photos: ["20260624_191543.jpg", "20260624_191547.jpg"],
  },
  {
    i: 65,
    title: "Deck de Quentin (Champion Sram, Tournoi des Douze)",
    hero: "Oscar Nak",
    havreSac: "du Crocodaille",
    photos: ["20260624_191602.jpg", "20260624_191606.jpg"],
  },
  {
    i: 66,
    title: "Deck de Damien (Champion Osamodas, Tournoi des Douze)",
    hero: "Babeth Safoueth",
    havreSac: "du Bwork",
    photos: [
      "20260624_191602.jpg",
      "20260624_191606.jpg",
      "20260624_191609.jpg",
    ],
  },
  {
    i: 67,
    title: "Deck d'Arnaud (Champion Sadida, Tournoi des Douze)",
    hero: "Jin Kobi Loba",
    havreSac: "du Craqueleur",
    photos: ["20260624_191606.jpg", "20260624_191609.jpg"],
  },
  {
    i: 68,
    title: "Deck de Fabrice (Champion Ultime/Ecaflip, Tournoi des Douze)",
    hero: "Dani Osheun",
    havreSac: "du Corbac",
    photos: ["20260624_191615.jpg", "20260624_191619.jpg"],
  },
  {
    i: 69,
    title: "Deck de Mathieu (Vice-Champion/Xélor, Tournoi des Douze)",
    hero: "Flix Flax",
    havreSac: "du Bwork",
    photos: ["20260624_191615.jpg", "20260624_191619.jpg"],
  },
];

phase("Extraction");

function pad(n) {
  return String(n).padStart(2, "0");
}

function buildPrompt(d) {
  const photoList = d.photos.map((p) => `  - ${ROT}${p}`).join("\n");
  const outPath = `${OUTDIR}deck-${pad(d.i)}.json`;
  return `Tu extrais UN SEUL deck WAKFU TCG d'une page de magazine Dofus Mag. Les photos sont déjà redressées (texte à l'endroit). Lis-les avec l'outil Read.

## Deck cible
- Titre (indicatif) : ${d.title}
- HÉROS : ${d.hero}   ← discriminant : une photo peut montrer DEUX decks ; n'extrais QUE celui dont le Héros est « ${d.hero} ».
- Havre-Sac (abrégé dans le mag) : ${d.havreSac}

## Photos à lire (les combiner — le deck peut être à cheval sur plusieurs clichés à cause des chevauchements)
${photoList}

## Ce qu'il faut extraire
Chaque page liste des catégories (Alliés / Sorts / Actions / Équipements / Zones / Protecteur…) ; CHAQUE catégorie imprime son total (ex. « Alliés : 25 »). Pour chaque carte : nom + quantité + catégorie.

Règles de nommage des cartes :
- Transcris le nom EXACT imprimé, mais SINGULARISE les pluriels de comptage (ex. « 3 Gelées Vertes » → nom « Gelée Verte »).
- Conserve les articles de tête (Le / La / Les) et les accents/circonflexes. Préfère l'orthographe vue sur l'illustration de la carte si visible.
- Le champ "havreSac" doit être le NOM COMPLET de la carte : préfixe « Havre Sac du … » s'il manque (ex. « du Tofu » → « Havre Sac du Tofu », « Bouftou » → « Havre Sac du Bouftou »). Le "hero" est le nom complet du héros.

Métadonnées optionnelles (mets-les si présentes, sinon null) :
- "lore" : le paragraphe d'intro narratif.
- "howToPlay" : le texte de l'encadré « Le conseil d'Adamaï » (s'il existe).
- "alignment" : ex. « Neutre ».
- "keyCards" : la liste « Cartes maîtresses » (array de noms), sinon [].
- "protector" : la carte « Protecteur : … » SI présente (et AUSSI ajoute-la dans cards[] avec section "Protecteur").
- "illustrator" : crédit « ILLUSTRATION ET DECK : … ».
- "magIssue" : numéro de page/mag visible en pied (ex. « 124 Dofus Mag » → « Dofus Mag 124 »).

## CHECKSUM ABSOLU (règle non négociable)
La somme de toutes les quantités de cartes (hors héros + havre-sac) DOIT valoir **48**.
Double contrôle : (a) les cartes d'une catégorie somment à son total imprimé ; (b) la somme globale = 48.
Si ça ne tombe pas sur 48 : RELIS les photos pour trouver la carte/quantité manquante ou mal lue. Ne « complète » jamais par invention.
Si, après relecture sérieuse, tu ne peux pas atteindre 48 depuis les photos fournies (deck coupé/illisible), mets "incomplete": true et explique dans "notes" quelle catégorie est incomplète et le total atteint.

## Sortie
Écris le résultat en JSON (UTF-8) avec l'outil Write dans CE chemin EXACT :
${outPath}

Forme du JSON :
{
  "name": "<titre lisible, ex. 'Deck Osamodas — ${d.hero}'>",
  "hero": "${d.hero}",
  "havreSac": "<nom complet Havre Sac>",
  "alignment": <string|null>,
  "lore": <string|null>,
  "howToPlay": <string|null>,
  "keyCards": <array de strings ou []>,
  "protector": <string|null>,
  "illustrator": <string|null>,
  "magIssue": <string|null>,
  "cards": [ { "name": "<nom>", "quantity": <n>, "section": "<Alliés|Sorts|Actions|Équipements|Zones|Protecteur|…>" }, … ],
  "checksum": <somme des quantités, doit être 48>,
  "incomplete": <true|false>,
  "notes": <string|null>
}

N'écris RIEN d'autre dans le fichier que ce JSON. Après avoir écrit le fichier, réponds par UNE seule ligne de statut : « OK 48 » si réconcilié, sinon « INCOMPLETE <somme> — <raison courte> ».`;
}

const results = await parallel(
  DECKS.map(
    (d) => () =>
      agent(buildPrompt(d), {
        label: `extract:${d.title}`,
        phase: "Extraction",
      }),
  ),
);

const statuses = results.map((r, idx) => ({
  i: DECKS[idx].i,
  deck: DECKS[idx].title,
  hero: DECKS[idx].hero,
  status: (r || "NULL (agent failed)").trim().split("\n").pop().slice(0, 160),
}));

const ok = statuses.filter((s) => /^OK/i.test(s.status)).length;
const incomplete = statuses.filter((s) => /incomplete/i.test(s.status));
const failed = statuses.filter((s) => /NULL/.test(s.status));

log(
  `Extraction terminée : ${ok}/${DECKS.length} OK, ${incomplete.length} incomplets, ${failed.length} échecs`,
);

return { total: DECKS.length, ok, statuses, incomplete, failed };
