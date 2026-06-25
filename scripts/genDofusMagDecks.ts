/**
 * Génère `src/data/dofusMagDecks.ts` à partir des JSON bruts d'extraction dans
 * `scripts/dofus-mag-extracted/`. Valide l'invariant 48, dédoublonne les ids,
 * et SKIP tout deck incomplet ou dont la somme ≠ 48 (loggé, jamais émis).
 * Lancer : `npm run gen-dofus-mag` (génère puis formate via prettier).
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";

const DIR = resolve(__dirname, "dofus-mag-extracted");
const OUT = resolve(__dirname, "../src/data/dofusMagDecks.ts");

interface RawCard {
  name: string;
  quantity: number;
  section?: string | null;
}
interface Raw {
  name: string;
  hero: string;
  havreSac: string;
  description?: string | null;
  alignment?: string | null;
  lore?: string | null;
  howToPlay?: string | null;
  keyCards?: string[] | null;
  protector?: string | null;
  illustrator?: string | null;
  magIssue?: string | null;
  cards: RawCard[];
  incomplete?: boolean;
  /** Le magazine source est lui-même incohérent (en-tête ≠ liste) : inclure ≠48. */
  magInconsistent?: boolean;
  notes?: string | null;
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function firstSentence(text: string): string {
  const m = text.match(/^.*?[.!?…](\s|$)/);
  return (m ? m[0] : text).trim().slice(0, 160);
}

/**
 * Corrections OCR → nom canonique de la base de cartes. Appliquées partout
 * (cartes, cartes maîtresses, protecteur). Ajoute une entrée ici quand le
 * rapport de matching signale un non-résolu dû à une graphie du magazine.
 */
const NAME_FIXES: Record<string, string> = {
  // Cartes confirmées contre la base (graphies du magazine → nom canonique)
  "Gelée Verte": "Gelée Menthe",
  "Piou de Baradaize": "Pious de Baradaïze",
  "Piou de Baradaïze": "Pious de Baradaïze",
  // Ponctuation / pluriels / articles
  "Brisé!": "Brisé !",
  "Banni!": "Banni !",
  "Bonne Affaire": "Bonne Affaire !",
  "Filouterie au Zaap d'Astrub": "Filouteries au Zaap d'Astrub",
  "Pantoufle du Tofu": "Pantoufles du Tofu",
  "Dernière Rasade": "La Dernière Rasade",
  Wapin: "Wapins",
  "Forêt d'Astrub": "Forêts d'Astrub",
  "Aiguilles à Tricoter": "Aiguille à Tricoter",
  "Anneaux du Rat Noir": "Anneau du Rat Noir",
  // Coquilles OCR
  "Shika Ingalss": "Shika Ingalsse",
  Moskitorch: "Moskitorsh",
  "Fofy Favié": "Fofy Fafié",
  "Fofy Favier": "Fofy Fafié",
  "Venin du Scorbute": "Venin de Scorbute",
  Montakristo: "Montrakristo",
  "Kriss la Krasse": "Kriss la Krass",
  "Ekraz Ienoub": "Ekraz Lenoub",
  "Bouton Blanc": "Boufton Blanc",
  "Bourreau des Brumes": "Le Bourreau des Brumes",
  "Gryne Piz": "Grine Piz",
  Dollarawan: "Dollarawan le Banquier",
  "Pelle Mech'ba": "Pelle Mechba",
  Bowisette: "Bowissette",
  Chacha: "Chacha Noir",
  "Daïe Guérie": "Daïe Guéri",
  "Dryana Karemboul": "Dryana Karamboul",
  "Bâton de Fetusoli": "Bâton du Fetusoli",
  "Aurore Pourpre": "L'Aurore Pourpre",
  "Frakacia Leucocityne": "Frakacia Leukocityne",
  "Frakacya Leucocityne": "Frakacia Leukocityne",
  "Gryp'sou": "Gryp' Soû",
  "Edasse le Trouble-fête": "Edasse le Trouble Fête",
  "Donjon Bwork": "Donjon des Bworks",
  "Anneau du Champ-Champ": "Anneau du Champ Champ",
  "Protège Tibias Ancestraux": "Protège-Tibias Ancestraux",
  "Éternelle Moisson": "L'Éternelle Moisson",
  "Viktor Hugo": "Viktor Yugo",
  "Narnia Totep": "Narnya Totep",
  "Mule du Dragon Cochon": "Mules du Dragon Cochon",
  Maimane: "Maimane, Protecteur d'Octolliard",
  "Kwalame de Glace": "Kwaklame de Glace",
  "Kwakbotte de Glace": "Kwakobottes de Glace",
  "Koloff Toulou": "Kolof Toulou",
  "Kolo Kolko": "Kolo-Kolko",
  "Karlé Thé": "Karla Thé",
  Jiva: "Jiva, Protectrice de Javian",
  "Guerrier Zoths": "Guerriers Zoths",
  Gelobotte: "Gelobottes",
  "Gagues de Fouraille": "Dagues de Fouraille",
  Djaul: "Djaul, Protecteur de Descendre",
  "Craqueleur Balloné": "Craqueleur Ballonné",
  "Ceinture du Boufcool": "Ceinture du Boufcoul",
  "Carte du Grav'Mar'Av": "Carte du Grav'Mar'Av'",
  "Basic Astik": "Bazic Astik",
  "Achill Brizfair": "Atchill Brizfair",
  "Cervelle de Iop": "Cervelle de Iop !",
  "Reviens!": "Reviens !",
  "Protège!": "Protège !",
  "Dofus de Glace": "Dofus des Glaces",
  "Dofus de Glaces": "Dofus des Glaces",
  "Champ de Glace": "Champs de Glace",
  "Seth Ottomatix": "Seth Ottomathix",
  "Kani Sarbak": "Kanniboul Sarbak",
  "Kani Jav": "Kanniboul Jav",
  Dispersion: "Flèche de Dispersion",
  "Dame de bouffe": "Dames de Bouffe",
  "Dague de Boissaille": "Dagues de Boisaille",
  "Colère de Zaïtoshwan": "Colère de Zatoïshwan",
  "Anneau de Chance": "Petit Anneau de Chance",
  "Atchil Brizfair": "Atchill Brizfair",
  "YeCh'Ty": "YeCh'ti",
  "Dahvid Boivit": "Dhavid Boivit",
  "Fôteux Detroub'": "Fôteuz Detroub'",
  "Gountarai le Barbare": "Goultard le Barbare",
  Noob: "noob!",
  "Bouclier en Slip du Bwork": "Bouclier en Slip",
  "Dague du Rat Noir": "Dagues du Rat Noir",
  "Demi Falque": "Demi Finame",
  Dragoune: "Dragoune Rose",
  Koléral: "Kolérat",
  "Kwacoiffe de Glace": "Kwakoiffe de Glace",
  "Baton Bah'Pik": "Bâton Bah'Pik'",
  "Enclos de Dragodinde": "Enclos de Dragodindes",
  Kriss: "Kriss la Krass",
  "Retraite Anticipé": "Retraite Anticipée",
  // Héros / havre-sac
  "Trantmy Londamy": "Trantmy Londami",
  "Luk Ylook": "Luc Ylook",
  "Hylary Swinte": "Hilary Swinte",
};
function fixName(n: string): string {
  return NAME_FIXES[n] ?? n;
}

const files = readdirSync(DIR)
  .filter((f) => /^deck-.*\.json$/i.test(f))
  .sort();

const decks: Record<string, unknown>[] = [];
const skipped: string[] = [];
const usedIds = new Set<string>();

for (const f of files) {
  let raw: Raw;
  try {
    raw = JSON.parse(readFileSync(join(DIR, f), "utf8"));
  } catch (e) {
    skipped.push(`${f}: JSON invalide (${(e as Error).message})`);
    continue;
  }
  const sum = (raw.cards ?? []).reduce((s, c) => s + (c.quantity || 0), 0);
  // Inclure les decks à 48, OU ceux marqués « incohérence magazine » (le mag
  // source est lui-même incohérent : en-tête ≠ liste → volontairement ≠ 48).
  // Sinon, skip (deck réellement incomplet / illisible).
  if (sum !== 48 && !raw.magInconsistent) {
    skipped.push(
      `${f}: « ${raw.name ?? "?"} » somme=${sum}, incomplete=${!!raw.incomplete}`,
    );
    continue;
  }

  const cleanName = raw.name.replace(/^deck\s+(de\s+|du\s+|d['’]\s*)?/i, "");
  let id = "dofus-mag-" + slugify(cleanName || raw.hero);
  const base = id;
  let n = 2;
  while (usedIds.has(id)) id = `${base}-${n++}`;
  usedIds.add(id);

  const description =
    (raw.description && raw.description.trim()) ||
    (raw.lore ? firstSentence(raw.lore) : `Deck Dofus Mag — ${raw.hero}.`);

  const deck: Record<string, unknown> = {
    id,
    name: raw.name,
    description,
    extension: "dofus-mag",
    source: "dofus-mag",
    hero: fixName(raw.hero),
    havreSac: fixName(raw.havreSac),
  };
  if (raw.alignment) deck.alignment = raw.alignment;
  if (raw.lore) deck.lore = raw.lore;
  if (raw.howToPlay) deck.howToPlay = raw.howToPlay;
  if (raw.keyCards && raw.keyCards.length)
    deck.keyCards = raw.keyCards.map(fixName);
  if (raw.protector) deck.protector = fixName(raw.protector);
  if (raw.illustrator) deck.illustrator = raw.illustrator;
  if (raw.magIssue) deck.magIssue = raw.magIssue;
  if (raw.magInconsistent)
    deck.formatNote = `Format historique : incohérence d'impression du magazine (${sum} cartes — total d'en-tête ≠ liste imprimée).`;
  deck.cards = raw.cards.map((c) => {
    const card: Record<string, unknown> = {
      name: fixName(c.name),
      quantity: c.quantity,
      type: "card",
    };
    if (c.section) card.section = c.section;
    return card;
  });
  decks.push(deck);
}

// Tri stable par id pour un diff déterministe.
decks.sort((a, b) => String(a.id).localeCompare(String(b.id)));

const header = `/**
 * Decks « idées de deck » WAKFU TCG extraits du magazine Dofus Mag.
 * GÉNÉRÉ par scripts/genDofusMagDecks.ts depuis scripts/dofus-mag-extracted/*.json.
 * Ne pas éditer à la main — relancer le générateur après ré-extraction.
 * INVARIANT : chaque deck = exactement 48 cartes (hors héros + havre-sac).
 * Voir le rapport de matching : \`docs/dofus-mag-matching-report.md\`.
 */
import type { OfficialDeck } from "./officialDecks";

export const DOFUS_MAG_DECKS: OfficialDeck[] = `;

writeFileSync(OUT, header + JSON.stringify(decks, null, 2) + ";\n", "utf8");

console.log(`Généré ${decks.length} decks → ${OUT}`);
if (skipped.length) {
  console.log(`\n${skipped.length} deck(s) IGNORÉ(S) :`);
  skipped.forEach((s) => console.log("  SKIP " + s));
}
