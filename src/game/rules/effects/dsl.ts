/**
 * Moteur de règles — étape C : DSL d'effets texte, parsing STRICT.
 *
 * Un effet n'est automatisé que si la TOTALITÉ de son texte est comprise :
 * un déclencheur reconnu dont le sujet est la carte elle-même, puis des
 * phrases qui correspondent toutes à une opération sûre. Tout le reste
 * retombe sur le mode manuel (la table n'est jamais bloquée).
 *
 * La compilation est faite HORS-LIGNE par `scripts/compileEffects.ts` qui
 * écrit `effects[].compiled` dans public/data/*.json ; au runtime,
 * `arrivalEffects` lit cette forme compilée et ne re-parse le texte qu'en
 * repli (données non migrées, tests). « Vous pouvez … » donne un effet
 * `optional` que la table fait confirmer au joueur avant exécution.
 */
import type {
  Card,
  CardEffect,
  CardKeyword,
  CompiledEffect,
  CompiledEffectOp,
} from "@/types/cards";
import { isHeroCard } from "../../../types/cards.ts";

export type EffectOp = CompiledEffectOp;

export interface EffectAtom extends CompiledEffect {
  /** Texte d'origine (journal / confirmation). */
  text: string;
}

/** minuscules + accents retirés — la casse/les accents varient dans les données. */
function norm(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

const WORD_NUMBERS: Record<string, number> = { une: 1, deux: 2, trois: 3 };
function toNumber(raw: string): number {
  return WORD_NUMBERS[raw] ?? Number.parseInt(raw, 10);
}

/**
 * Phrase de LIEU / PROVENANCE optionnelle insérée entre « apparaît » et la
 * virgule du déclencheur d'apparition : « apparaît DANS LE MONDE, … »,
 * « apparaît DEPUIS VOTRE PIOCHE, … », « apparaît EN RENFORT, … ». Purement
 * locative : elle ne change PAS la sémantique (le déclencheur reste onArrive /
 * onOtherAppears, le corps inchangé). CONSERVATEUR — allowlist de phrases de
 * lieu connues (jamais du texte arbitraire, qui resterait une condition non
 * comprise → manuel). Le ` ?` initial absorbe l'espace avant la clause ; le
 * fragment entier est optionnel (`(?: … )?`). Sans groupe capturant (n'altère
 * pas les indices de capture des regex hôtes).
 */
const APPEAR_LOC =
  "(?: (?:dans le monde|dans (?:votre|son) havre[- ]?sac|en renfort|en defense|depuis (?:votre|sa) (?:main|defausse|pioche)))?";

const TARGET_WHAT: Record<string, "Allié" | "Zone" | "Équipement" | "Dofus"> = {
  "l allie": "Allié",
  "l'allie": "Allié",
  "la zone": "Zone",
  "l equipement": "Équipement",
  "l'equipement": "Équipement",
  "le dofus": "Dofus",
};

/**
 * FAMILLES DE CRÉATURE = SOUS-TYPES D'ALLIÉ (et UNIQUEMENT d'Allié). Une carte
 * désignée par sa seule Famille (« un Monstre », « une carte Tofu ») est donc
 * un Allié de cette Famille → `{ what:"Allié", sub:<famille> }`. CONSERVATEUR
 * (cf. tâche W18) : on n'admet QUE des Familles non ambiguës de créature.
 * SONT EXCLUS volontairement (pourraient désigner un autre type que l'Allié) :
 *  - les CLASSES de Héros (Iop, Crâ, Féca, Sacrieur, Ecaflip, Sram…) — « un Iop »
 *    peut viser un Héros ;
 *  - les ALIGNEMENTS / villes (Bonta, Brâkmar) ;
 *  - les mots-clés / marqueurs (« Unique »), titres combinables (« Roi »,
 *    « Princesse »).
 * Tout mot hors de cet allowlist retombe en MANUEL (pas de devinette de type).
 * Clé = forme normalisée (norm()).
 */
const ALLIED_FAMILIES = new Set([
  "monstre",
  "champignon",
  "wabbit",
  "bouftou",
  "bandit",
  "chevalier",
  "tofu",
  "piou",
  "gelee",
  "bwork",
  "koalak",
  "dragodinde",
  "monture",
  "vampyre",
  "fantome",
  "abraknyde",
  "blop",
  "chafer",
  "corbac",
  "larve",
  "prespic",
  "craqueleur",
  "shushu",
  "rat",
  "arakne",
  "crocodaille",
  "kralamoure",
  "scarafeuille",
  "crustace",
  "gobelin",
  "dopeul",
  "pirate",
  "demon",
  "flaqueux",
  "grouilleux",
  "kanniboul",
  "minos",
]);

/**
 * Mots-clés OCTROYABLES « jusqu'à la fin du tour » → forme canonique (accentuée)
 * stockée dans l'op grantKeyword{Self,Target}. STRICT : on ne reconnaît QUE les
 * mots-clés ayant une SÉMANTIQUE DE COMBAT câblée (lue par effectiveKeywords →
 * légalité / résolution). Les autres (Fantôme, Défense, Renfort, Portée,
 * Critique, Parade…) NE sont PAS ici : les octroyer serait un no-op =
 * approximation, donc ces effets restent MANUELS (« an approximation of gameplay
 * is worse than a manual effect »). Tacle : verrou d'inclinaison relationnel
 * appliqué par resolveCombat. Clé = forme normalisée (norm()).
 */
const GRANTABLE_KEYWORDS: Record<
  string,
  "Géant" | "Agilité" | "Agressivité" | "Tacle"
> = {
  geant: "Géant",
  agilite: "Agilité",
  agressivite: "Agressivité",
  tacle: "Tacle",
};

const RESIST_ELEMENTS = new Set(["air", "eau", "feu", "terre", "neutre"]);

/**
 * Parse une clause « résistance N (élément)(élément)… » (déjà normalisée) en une
 * liste `{ element, n }` (un par Élément, même valeur N) pour les ops d'octroi de
 * Résistance. STRICT : exactement « résistance <N> » suivi d'au moins un Élément
 * entre parenthèses, tous reconnus (RESIST_ELEMENTS) ; sinon null (forme non
 * comprise → l'effet reste manuel). « Résistance N » SANS Élément (« dans
 * l'élément de votre choix », « dans l'élément des Dommages … ») n'est PAS captée
 * ici → manuel (choix/dynamique d'Élément non modélisé).
 */
function parseResistClause(
  clause: string,
): { element: string; n: number }[] | null {
  const m = clause.match(/^resistance (\d+)((?: ?\([a-z]+\))+)$/);
  if (!m) return null;
  const n = toNumber(m[1]);
  const elements = [...m[2].matchAll(/\(([a-z]+)\)/g)].map((e) => e[1]);
  if (!elements.length || !elements.every((e) => RESIST_ELEMENTS.has(e)))
    return null;
  return elements.map((element) => ({ element, n }));
}

/**
 * Mot-type d'une recherche / mise-en-jeu → `{ what, sub? }`, ou null si le mot
 * n'est ni un type racine connu (Allié/Zone/Salle/Équipement/Dofus/Action) ni
 * une Famille de créature non ambiguë (→ Allié + sub). `mot` est déjà normalisé.
 */
function pickType(word: string): {
  what: "Allié" | "Zone" | "Salle" | "Équipement" | "Dofus" | "Action";
  sub?: string;
} | null {
  const ROOT: Record<
    string,
    "Allié" | "Zone" | "Salle" | "Équipement" | "Dofus" | "Action"
  > = {
    allie: "Allié",
    zone: "Zone",
    salle: "Salle",
    equipement: "Équipement",
    dofus: "Dofus",
    action: "Action",
  };
  if (ROOT[word]) return { what: ROOT[word] };
  if (ALLIED_FAMILIES.has(word)) return { what: "Allié", sub: word };
  return null;
}

/**
 * Une phrase → une op sûre, ou null (l'effet entier est alors abandonné).
 * Accepte l'impératif (« piochez ») et, après « vous pouvez », l'infinitif
 * (« piocher »). `sourceElement` = Élément de la carte source (410.1), figé
 * dans les ops de dommages pour la Résistance de la cible.
 */
/** Zones visées : sans qualificatif → tout le jeu (Monde + Havre-Sac). */
function targetZones(
  mondeOnly: string | undefined,
  havreSacAlso: string | undefined,
): ("monde" | "havreSac")[] {
  if (havreSacAlso || !mondeOnly) return ["monde", "havreSac"];
  return ["monde"];
}

function parseSentence(
  sentence: string,
  cardName: string,
  sourceElement: string,
): EffectOp | null {
  let m = sentence.match(/^gagne[zr] (\d+) xp$/);
  if (m) return { op: "gainXp", n: toNumber(m[1]) };
  m = sentence.match(/^pioche[zr] (une|deux|trois|\d+) cartes?$/);
  if (m) return { op: "draw", n: toNumber(m[1]) };
  // « Chaque joueur pioche N carte(s). » / « Tous les joueurs piochent N carte(s). »
  // — pioche symétrique (joueur actif d'abord).
  m = sentence.match(/^chaque joueur pioche (une|deux|trois|\d+) cartes?$/);
  if (m) return { op: "eachPlayerDraws", n: toNumber(m[1]) };
  m = sentence.match(
    /^tous les joueurs piochent (une|deux|trois|\d+) cartes?$/,
  );
  if (m) return { op: "eachPlayerDraws", n: toNumber(m[1]) };
  m = sentence.match(
    /^(?:gagne[zr]|votre heros gagne) (\d+) (?:pv|points? de vie)$/,
  );
  if (m) return { op: "heroGainPv", n: toNumber(m[1]) };
  m = sentence.match(/^votre heros perd (\d+) (?:pv|points? de vie)$/);
  if (m) return { op: "heroLosePv", n: toNumber(m[1]) };
  // « Perdez N PA/PM jusqu'à la fin du tour » (coûts d'entretien type Croum)
  m = sentence.match(/^perde?z? (\d+) (pa|pm) jusqu['’]a la fin d[ue] tour$/);
  if (m)
    return {
      op: "loseStatTurn",
      stat: m[2] as "pa" | "pm",
      n: toNumber(m[1]),
    };
  // « Tous vos adversaires perdent N PA/PM jusqu'à la fin du tour. » — en 1v1,
  // l'unique adversaire ; cible déterministe (pas « de votre choix »).
  m = sentence.match(
    /^tous vos adversaires perdent (\d+) (pa|pm) jusqu['’]a la fin du tour$/,
  );
  if (m)
    return {
      op: "oppLoseStatTurn",
      stat: m[2] as "pa" | "pm",
      n: toNumber(m[1]),
    };
  // « Le joueur de votre choix pioche N carte(s). » — choix d'un JOUEUR (ciblage
  // de Héros) : le joueur choisi pioche N. STRICT : la totalité de la phrase doit
  // correspondre (le `$` rejette « … puis se défausse … », qui vise le joueur
  // choisi et n'est pas modélisé → manuel).
  m = sentence.match(
    /^le joueur de votre choix pioche (une|deux|trois|\d+) cartes?$/,
  );
  if (m) return { op: "playerDraw", n: toNumber(m[1]) };
  // « Le joueur de votre choix perd N PA/PM jusqu'à la fin du tour. » → jeton
  // paMod/pmMod −N sur le Héros choisi (purgé en fin de tour). Le `$` rejette
  // « … jusqu'à la fin de SON prochain tour » (durée non modélisée) et toute
  // clause résiduelle (« Puis, si … », « Piochez une carte » est une op suivante).
  m = sentence.match(
    /^le joueur de votre choix perd (\d+) (pa|pm) jusqu['’]a la fin du tour$/,
  );
  if (m)
    return {
      op: "playerLoseStatTurn",
      stat: m[2] as "pa" | "pm",
      n: toNumber(m[1]),
    };
  // « Le joueur de votre choix gagne N PA/PM jusqu'à la fin du tour. » → jeton
  // paMod/pmMod +N sur le Héros choisi. Même restriction de durée (« du tour »
  // uniquement ; « de son prochain tour » → manuel).
  m = sentence.match(
    /^le joueur de votre choix gagne (\d+) (pa|pm) jusqu['’]a la fin du tour$/,
  );
  if (m)
    return {
      op: "playerGainStat",
      stat: m[2] as "pa" | "pm",
      n: toNumber(m[1]),
    };
  // « Votre Héros gagne +N en Force jusqu'à la fin du tour. » — bonus de Force
  // temporaire sur VOTRE Héros (sujet fixe, pas de choix).
  m = sentence.match(
    /^votre heros gagne \+(\d+) en force jusqu['’]a la fin d[ue] tour$/,
  );
  if (m) return { op: "buffForceHeroSelf", n: toNumber(m[1]) };
  // « Redressez votre Héros. » — redresse VOTRE Héros (pas de choix).
  m = sentence.match(/^redressez votre heros$/);
  if (m) return { op: "untapHeroSelf" };
  // « Redressez [cette carte]. » — redresse la SOURCE (pendant de tapSelf).
  //   Conservateur : on n'accepte QUE « redressez <ce X / nom de la carte> »
  //   dont le sujet est sans ambiguïté la carte elle-même (subjectIsSelf).
  //   Une cible générique (« redressez l'Allié de votre choix ») est traitée
  //   plus bas par untapTarget ; « redressez-le/la » nu reste ambigu → manuel.
  m = sentence.match(/^redressez (ce[t]?(?:te)? .{1,50}|.{1,50})$/);
  if (m && subjectIsSelf(m[1].replace(/^cet?t?e? /, ""), cardName))
    return { op: "untapSelf" };
  m = sentence.match(
    /^(?:inflige[zr] (\d+) dommages? au heros adverse|le heros adverse perd (\d+) (?:pv|points? de vie))$/,
  );
  if (m) return { op: "damageOppHero", n: toNumber(m[1] ?? m[2]) };
  m = sentence.match(/^gagne[zr] (\d+) (?:points? de )?resistance$/);
  if (m) return { op: "havreSacGainResistance", n: toNumber(m[1]) };
  m = sentence.match(
    /^recycle[zr] (une|deux|trois|\d+) cartes?( de votre defausse)?$/,
  );
  if (m) return { op: "recycleFromDiscard", n: toNumber(m[1]) };
  // « Recyclez jusqu'à N carte(s) [Élément] [de votre Défausse] » : l'interaction
  // de pioche est annulable (0..N), donc fidèle à l'op exacte. Le mot d'Élément
  // (feu/eau/terre/air/neutre) est stocké capitalisé, comme les autres Éléments.
  m = sentence.match(
    /^recycle[zr] jusqu['’]a (une|deux|trois|\d+) cartes?(?: \((feu|eau|terre|air|neutre)\))?( de votre defausse)?$/,
  );
  if (m) {
    const element = m[2]
      ? m[2].charAt(0).toUpperCase() + m[2].slice(1)
      : undefined;
    return {
      op: "recycleFromDiscard",
      n: toNumber(m[1]),
      ...(element ? { element } : {}),
    };
  }
  m = sentence.match(
    /^defaussez[- ]vous d['’ ]?\s?(une|deux|trois|\d+) cartes?(?: de votre main)?$/,
  );
  if (m) return { op: "discardFromHand", n: toNumber(m[1]) };
  // « Défaussez-vous de jusqu'à N carte(s) » : défausse annulable (0..N) →
  // fidèle à discardFromHand exact.
  m = sentence.match(
    /^defaussez[- ]vous de jusqu['’]a (une|deux|trois|\d+) cartes?(?: de votre main)?$/,
  );
  if (m) return { op: "discardFromHand", n: toNumber(m[1]) };
  // « Cherchez un(e) [carte] [type|Famille] [de Niveau ≤ N] dans votre
  //   Pioche, révélez-le et prenez-le en main » ou « … et mettez-le en jeu
  //   [incliné[e]] » (le mélange arrive en op suivante).
  //   - Le mot-type peut être un type racine (Allié/Zone/Salle/Équipement/
  //     Dofus/Action) OU une Famille de créature non ambiguë (« carte Tofu »,
  //     « carte Bouftou ») → Allié + sub (cf. pickType / ALLIED_FAMILIES).
  //   - « inclinée » en ligne après « en jeu » → tapped (jumeau de la phrase
  //     de liaison « Il apparaît incliné. »), uniquement quand dest = monde.
  m = sentence.match(
    /^cherchez (?:un|une) (?:carte )?([a-z]+)( [a-z]+)?( de niveau inferieur ou egal a (\d+))? dans votre pioche,? (?:revelez-l[ea] et prenez-l[ea] en main|et mettez-l[ea] en jeu( inclinee?)?)$/,
  );
  if (m) {
    const pt = pickType(m[1]);
    if (!pt) return null;
    const sub = pt.sub ?? m[2]?.trim();
    // mots de liaison = pas une famille (« ou non Unique », « portant… »)
    if (sub && ["ou", "non", "portant", "de", "et"].includes(sub)) return null;
    const dest = sentence.includes("en jeu") ? "monde" : "main";
    return {
      op: "searchDeck",
      what: pt.what,
      ...(sub ? { sub } : {}),
      ...(m[4] ? { maxLevel: toNumber(m[4]) } : {}),
      ...(m[5] && dest === "monde" ? { tapped: true } : {}),
      dest,
    };
  }
  // « Cherchez une carte [type|Famille] [de Niveau ≤ N] dans votre Défausse et
  //   mettez-la en jeu [incliné[e]]. » → putInPlay(from:"defausse") : choisir
  //   une carte de la DÉFAUSSE et la mettre en jeu (machinerie identique à
  //   « Mettez en jeu un X de votre Défausse »). dest implicite = Monde ; pas de
  //   mélange (la Défausse n'est pas mélangée). « prenez-la en main » depuis la
  //   Défausse n'est PAS modélisé (aucune op de recherche-Défausse-vers-main) →
  //   reste manuel.
  m = sentence.match(
    /^cherchez (?:un|une) (?:carte )?([a-z]+)( [a-z]+)?( de niveau inferieur ou egal a (\d+))? dans votre defausse et mettez-l[ea] en jeu( inclinee?)?(?: dans le monde)?$/,
  );
  if (m) {
    const pt = pickType(m[1]);
    // putInPlay n'accepte pas Action/Dofus (schéma) ; on reste strict.
    if (!pt || pt.what === "Action" || pt.what === "Dofus") return null;
    const sub = pt.sub ?? m[2]?.trim();
    if (sub && ["ou", "non", "portant", "de", "et"].includes(sub)) return null;
    return {
      op: "putInPlay",
      from: "defausse",
      what: pt.what,
      ...(sub ? { sub } : {}),
      ...(m[4] ? { maxLevel: toNumber(m[4]) } : {}),
      ...(m[5] ? { tapped: true } : {}),
    };
  }
  // « Cherchez une carte [type|Famille] [de Niveau ≤ N | de Niveau N] dans votre
  //   Défausse[, révélez-la] et prenez-la en main. » → searchDeck(from:"defausse",
  //   dest:"main") : même machinerie de pick que la recherche-Pioche, mais la
  //   pile source est la DÉFAUSSE (action toHand). Un éventuel « , puis mélangez »
  //   est une op suivante (shuffleDeck) — la Défausse elle-même n'est jamais
  //   mélangée. La forme « prenez-la main » (sans « en ») est tolérée (typo de
  //   scrape). Le mot-type accepte un type racine OU une Famille de créature
  //   non ambiguë (pickType / ALLIED_FAMILIES).
  m = sentence.match(
    /^cherchez (?:un|une) (?:carte )?([a-z]+)( [a-z]+)?(?: de niveau (?:inferieur ou egal a (\d+)|(\d+)))? dans votre defausse(?:,? revelez-l[ea])? et prenez-l[ea](?: en)? main$/,
  );
  if (m) {
    const pt = pickType(m[1]);
    if (!pt) return null;
    const sub = pt.sub ?? m[2]?.trim();
    // mots de liaison = pas une famille (« ou non Unique », « portant… »)
    if (sub && ["ou", "non", "portant", "de", "et"].includes(sub)) return null;
    return {
      op: "searchDeck",
      what: pt.what,
      from: "defausse",
      ...(sub ? { sub } : {}),
      ...(m[3] ? { maxLevel: toNumber(m[3]) } : {}),
      ...(m[4] ? { exactLevel: toNumber(m[4]) } : {}),
      dest: "main",
    };
  }
  // « Mettez en jeu [gratuitement] un(e) [Allié|Zone|Salle|Équipement|Famille]
  //   [Famille]? [de votre choix]? [de Niveau ≤ N | de Niveau N]? [gratuitement]
  //   [incliné[e]]? de/depuis votre (main|défausse) [dans le Monde] [incliné[e]]?. »
  //   → putInPlay (pick d'une carte existante de la main/Défausse, mise en Monde).
  //   - Le mot-type peut être un type racine (Allié/Zone/Salle/Équipement) OU une
  //     Famille de créature non ambiguë (« un Monstre », « un Champignon ») →
  //     Allié + sub (cf. pickType / ALLIED_FAMILIES). Action/Dofus ne sont pas
  //     des cibles putInPlay (schéma) → rejet.
  //   - « de Niveau N » (exact) → exactLevel ; « de Niveau ≤ N » → maxLevel. La
  //     clause de Niveau est admise AVANT ou APRÈS « de votre choix » (variante
  //     d'ordre courante : « l'Allié de Niveau 1 de votre choix … » comme
  //     « … un Allié de votre choix de Niveau ≤ 3 … ») — deux groupes optionnels
  //     mutuellement exclusifs (un seul des deux peut être présent à la fois).
  //   - « incliné[e] » (avant ou après la zone) → tapped.
  //   « gratuitement » = sans coût (la mise en jeu par effet est déjà gratuite —
  //   pas de clause résiduelle). Le `$` final REJETTE toute condition/cible-
  //   porteur résiduelle (« … sur l'Allié … », « … et placez-le … ») → ces formes
  //   restent manuelles. La CRÉATION de jeton (« Mettez en jeu un jeton … »,
  //   « Invoquez … ») ne correspond pas (pas de mot-type connu nu).
  // « Mettez en jeu un [type] [Famille]? de Niveau N ou M [gratuitement] de votre
  //   main [dans le Monde] [incliné] » → putInPlay avec un filtre `levelIn:[N,M]`
  //   (énumération de Niveaux, distincte de ≤ N / = N). Forme courante « de Niveau
  //   1 ou 2 ». Placée AVANT la grammaire générale (dont le sous-motif de Niveau
  //   ne capte qu'un seul nombre). `from` est la main (les formes observées sont
  //   toutes « de votre main »). Action/Dofus exclus (pas des cibles putInPlay).
  m = sentence.match(
    /^mett(?:ez|re) en jeu (?:gratuitement )?(?:un |une |le |la )([a-z]+)( [a-z-]+)? de niveau (\d+) ou (\d+)(?: gratuitement)? (?:de|depuis) votre main( dans le monde)?( incline[es]?)?$/,
  );
  if (m) {
    const pt = pickType(m[1]);
    if (!pt || pt.what === "Action" || pt.what === "Dofus") return null;
    const sub = pt.sub ?? m[2]?.trim();
    if (sub && ["ou", "non", "de", "et", "gratuitement"].includes(sub))
      return null;
    return {
      op: "putInPlay",
      from: "main",
      what: pt.what,
      ...(sub ? { sub } : {}),
      levelIn: [toNumber(m[3]), toNumber(m[4])],
      ...(m[6] ? { tapped: true } : {}),
    };
  }
  const lvl = "(?: de niveau (?:inferieur ou egal a (\\d+)|(\\d+)))?";
  m = sentence.match(
    new RegExp(
      "^mett(?:ez|re) en jeu (?:gratuitement )?(?:un |une |l['’ ]?\\s?|le |la )([a-z]+)( [a-z-]+)?" +
        lvl +
        "( de votre choix)?" +
        lvl +
        "(?: gratuitement)?( incline[es]?)? (?:de|depuis) votre (main|defausse)( dans le monde)?( incline[es]?)?$",
    ),
  );
  if (m) {
    const pt = pickType(m[1]);
    if (!pt || pt.what === "Action" || pt.what === "Dofus") return null;
    const sub = pt.sub ?? m[2]?.trim();
    // mots de liaison captés par la classe famille → pas une vraie Famille
    if (sub && ["ou", "non", "de", "et", "gratuitement"].includes(sub))
      return null;
    // Niveau présent dans l'un OU l'autre emplacement (jamais les deux).
    const maxLevel = m[3] ?? m[6];
    const exactLevel = m[4] ?? m[7];
    const tapped = !!(m[8] || m[11]);
    return {
      op: "putInPlay",
      from: m[9] === "main" ? "main" : "defausse",
      what: pt.what,
      ...(sub ? { sub } : {}),
      ...(maxLevel ? { maxLevel: toNumber(maxLevel) } : {}),
      ...(exactLevel ? { exactLevel: toNumber(exactLevel) } : {}),
      ...(tapped ? { tapped: true } : {}),
    };
  }
  m = sentence.match(/^melangez(?:[- ]la)? votre pioche$/);
  if (m) return { op: "shuffleDeck" };
  m = sentence.match(/^votre heros regagne (\d+) (?:pv|points? de vie)$/);
  if (m) return { op: "heroGainPv", n: toNumber(m[1]) };
  // « Le Héros [du joueur] de votre choix regagne N PV » → healHeroTarget
  //   (éligibilité = tous les Héros en jeu, les deux contrôleurs). « du joueur de
  //   votre choix » (choix d'un JOUEUR via son Héros) est sémantiquement identique
  //   à « de votre choix » ici : on soigne le Héros choisi. Placé AVANT la forme
  //   self générique « [Ce Héros] regagne N PV » pour ne pas être capté par elle.
  m = sentence.match(
    /^le heros (?:du joueur )?de votre choix regagne (\d+) (?:pv|points? de vie)$/,
  );
  if (m) return { op: "healHeroTarget", n: toNumber(m[1]) };
  // « [Ce Héros] regagne N PV » : le sujet est la carte elle-même (un Héros) →
  // soin du Héros contrôleur (op existante heroGainPv). Placé APRÈS les formes
  // « votre Héros » / « le Héros de votre choix » pour ne pas les capter.
  m = sentence.match(/^(.{1,50}?) regagne (\d+) (?:pv|points? de vie)$/);
  if (m && subjectIsSelf(m[1], cardName))
    return { op: "heroGainPv", n: toNumber(m[2]) };
  // « L'Allié (ou Héros) de votre choix gagne +N en Force jusqu'à la fin du tour »
  m = sentence.match(
    /^l['’ ]?\s?allie( ou heros)? de votre choix gagne \+(\d+) en force jusqu['’]a la fin d[ue] tour$/,
  );
  if (m)
    return {
      op: "buffForceTarget",
      n: toNumber(m[2]),
      heroes: !!m[1],
      zones: ["monde", "havreSac"],
    };
  // « [Cette carte] gagne +N en Force jusqu'à la fin du tour »
  m = sentence.match(
    /^(.{1,50}?) gagne \+(\d+) en force jusqu['’]a la fin d[ue] tour$/,
  );
  if (m && subjectIsSelf(m[1], cardName))
    return { op: "buffForceSelf", n: toNumber(m[2]) };
  // « L'Allié (ou Héros) [<Famille>] [bloqué] de votre choix gagne <Mot-clé>
  //   jusqu'à la fin du tour » (Pandaluk : Géant tout Allié ; Petit Anneau de
  //   Force : Géant Allié ou Héros en sacrifice ; chaos-dogrest : Agilité /
  //   Agressivité ; L'Allié Gelée/Tofu de votre choix : Agilité par Famille)
  //   → grantKeywordTarget. STRICT : seuls les mots-clés DE COMBAT câblés
  //   (GRANTABLE_KEYWORDS : Géant/Agilité/Agressivité/Tacle) sont compilés ; les
  //   autres (Fantôme…) restent manuels (octroi = no-op = approximation). « bloqué »
  //   → combatRole:"blocking" ; « jusqu'à la fin du tour » uniquement (variantes
  //   COMBAT/BEARER manuelles). m[2] = Famille optionnelle (validée ALLIED_FAMILIES).
  m = sentence.match(
    /^l['’ ]?\s?allie( ou heros)?(?: ([a-z-]+))?( bloque)? de votre choix gagne ([a-z]+) jusqu['’]a la fin d[ue] tour$/,
  );
  if (m && GRANTABLE_KEYWORDS[m[4]] && (!m[2] || ALLIED_FAMILIES.has(m[2])))
    return {
      op: "grantKeywordTarget",
      keyword: GRANTABLE_KEYWORDS[m[4]],
      heroes: !!m[1],
      ...(m[2] ? { sub: m[2] } : {}),
      ...(m[3] ? { combatRole: "blocking" as const } : {}),
      zones: ["monde", "havreSac"],
    };
  // « Le <Famille> [bloqué] de votre choix gagne <Mot-clé> jusqu'à la fin du
  //   tour » (Rat Klure : Géant/Rat bloqué ; Le Monstre de votre choix : Agressivité)
  //   → grantKeywordTarget filtré par Famille (sub, sur subTypes). La Famille doit
  //   être non ambiguë (ALLIED_FAMILIES — désigne forcément un Allié) ; sinon manuel.
  m = sentence.match(
    /^le ([a-z-]+?)( bloque)? de votre choix gagne ([a-z]+) jusqu['’]a la fin d[ue] tour$/,
  );
  if (m && ALLIED_FAMILIES.has(m[1]) && GRANTABLE_KEYWORDS[m[3]])
    return {
      op: "grantKeywordTarget",
      keyword: GRANTABLE_KEYWORDS[m[3]],
      sub: m[1],
      ...(m[2] ? { combatRole: "blocking" as const } : {}),
      zones: ["monde", "havreSac"],
    };
  // « [Cette carte] gagne <Mot-clé> jusqu'à la fin du tour » (Ouassingue : Géant)
  //   → grantKeywordSelf (la SOURCE gagne le mot-clé jusqu'à la fin du tour). Le
  //   sujet doit être la carte elle-même (subjectIsSelf) ; placé APRÈS les formes
  //   ciblées pour ne pas capter « L'Allié … de votre choix » (qui n'est pas soi).
  //   STRICT : seuls les mots-clés DE COMBAT câblés (GRANTABLE_KEYWORDS) sont
  //   compilés ; on rejette un sujet « Le Porteur de … » (bonus de PORTEUR
  //   temporaire — Anneau du Rat Noir) et tout sujet COMPOSITE (« … perd Agilité et
  //   gagne Géant » — Pandhravan : retrait de mot-clé non modélisé). Ces formes
  //   restent manuelles (« an approximation … is worse … »).
  m = sentence.match(
    /^(.{1,50}?) gagne ([a-z]+) jusqu['’]a la fin d[ue] tour$/,
  );
  if (
    m &&
    GRANTABLE_KEYWORDS[m[2]] &&
    !/\bporteur\b/.test(m[1]) &&
    !/\b(?:perd|et|puis|ou)\b/.test(m[1]) &&
    subjectIsSelf(m[1], cardName)
  )
    return { op: "grantKeywordSelf", keyword: GRANTABLE_KEYWORDS[m[2]] };
  // « L'Allié (ou Héros) [<Famille>] [bloqué] de votre choix gagne Résistance N
  //   (Élément)[…] jusqu'à la fin du tour » → grantResistanceTarget. STRICT :
  //   la clause de Résistance doit lister au moins un Élément reconnu entre
  //   parenthèses (parseResistClause) ; « dans l'élément de votre choix / des
  //   Dommages … » (choix / dynamique d'Élément) n'est PAS captée → manuel.
  //   « bloqué » → combatRole:"blocking" ; m[2] = Famille optionnelle (validée
  //   ALLIED_FAMILIES). Variantes BEARER / per-count restent manuelles.
  m = sentence.match(
    /^l['’ ]?\s?allie( ou heros)?(?: ([a-z-]+))?( bloque)? de votre choix gagne (resistance \d+(?: ?\([a-z]+\))+) jusqu['’]a la fin d[ue] tour$/,
  );
  if (m && (!m[2] || ALLIED_FAMILIES.has(m[2]))) {
    const resist = parseResistClause(m[4]);
    if (resist)
      return {
        op: "grantResistanceTarget",
        resist,
        heroes: !!m[1],
        ...(m[2] ? { sub: m[2] } : {}),
        ...(m[3] ? { combatRole: "blocking" as const } : {}),
        zones: ["monde", "havreSac"],
      };
  }
  // « Le <Famille> [bloqué] de votre choix gagne Résistance N (Élément)[…] jusqu'à
  //   la fin du tour » → grantResistanceTarget filtré par Famille (sub, non
  //   ambiguë : ALLIED_FAMILIES). Pendant de la forme « Le <Famille> … gagne
  //   <Mot-clé> … » pour la Résistance.
  m = sentence.match(
    /^le ([a-z-]+?)( bloque)? de votre choix gagne (resistance \d+(?: ?\([a-z]+\))+) jusqu['’]a la fin d[ue] tour$/,
  );
  if (m && ALLIED_FAMILIES.has(m[1])) {
    const resist = parseResistClause(m[3]);
    if (resist)
      return {
        op: "grantResistanceTarget",
        resist,
        sub: m[1],
        ...(m[2] ? { combatRole: "blocking" as const } : {}),
        zones: ["monde", "havreSac"],
      };
  }
  // « [Cette carte] gagne Résistance N (Élément)[…] jusqu'à la fin du tour »
  //   → grantResistanceSelf (la SOURCE gagne la Résistance jusqu'à la fin du
  //   tour). Le sujet doit être la carte elle-même (subjectIsSelf) ; placé APRÈS
  //   les formes ciblées. On rejette « Le Porteur de … » (bonus de PORTEUR — forme
  //   BEARER, manuelle) et tout sujet COMPOSITE (« perd … et gagne … »). « dans
  //   l'élément de votre choix / des Dommages » n'est pas captée (parseResistClause
  //   exige des Éléments explicites) → manuel.
  m = sentence.match(
    /^(.{1,50}?) gagne (resistance \d+(?: ?\([a-z]+\))+) jusqu['’]a la fin d[ue] tour$/,
  );
  if (
    m &&
    !/\bporteur\b/.test(m[1]) &&
    !/\b(?:perd|et|puis|ou)\b/.test(m[1]) &&
    subjectIsSelf(m[1], cardName)
  ) {
    const resist = parseResistClause(m[2]);
    if (resist) return { op: "grantResistanceSelf", resist };
  }
  // « Détruisez l'Équipement ou la Zone de votre choix » (deux types, dans
  //   l'un ou l'autre ordre) → destroyTarget multi-type. Placé AVANT la forme
  //   mono-type pour capter les deux compléments.
  m = sentence.match(
    /^detrui(?:sez|re) (l['’ ]?\s?allie|la zone|l['’ ]?\s?equipement|le dofus) ou (l['’ ]?\s?allie|la zone|l['’ ]?\s?equipement|le dofus) de votre choix( dans le monde)?( ou dans un havre ?-?sac)?$/,
  );
  if (m) {
    const first = TARGET_WHAT[m[1].replace(/['’]/g, "'").replace(/\s+/g, " ")];
    const second = TARGET_WHAT[m[2].replace(/['’]/g, "'").replace(/\s+/g, " ")];
    if (!first || !second || first === second) return null;
    const zones: ("monde" | "havreSac")[] = m[4]
      ? ["monde", "havreSac"]
      : ["monde"];
    return { op: "destroyTarget", whatAny: [first, second], zones };
  }
  // « Détruisez l'Arme / l'Armure / le Bijou / le Bouclier / le Familier /
  //   l'Objet de votre choix » → destroyTarget Équipement + filtre equipType
  //   (lu sur card.equipmentType). Placé AVANT la forme mono-type nue. Ces
  //   noms sont EXCLUSIVEMENT des sous-types d'Équipement.
  m = sentence.match(
    /^detrui(?:sez|re) (l['’ ]?\s?arme|l['’ ]?\s?armure|le bijou|le bouclier|le familier|l['’ ]?\s?objet) de votre choix( dans le monde)?( ou dans un havre ?-?sac)?$/,
  );
  if (m) {
    const EQUIP: Record<string, string> = {
      arme: "Arme",
      armure: "Armure",
      bijou: "Bijou",
      bouclier: "Bouclier",
      familier: "Familier",
      objet: "Objet",
    };
    const key = m[1].replace(/^(l['’ ]?\s?|le )/, "").trim();
    const equipType = EQUIP[key];
    if (equipType) {
      const zones: ("monde" | "havreSac")[] = m[3]
        ? ["monde", "havreSac"]
        : ["monde"];
      return { op: "destroyTarget", what: "Équipement", equipType, zones };
    }
  }
  // « Détruisez l'Allié de Niveau N de votre choix » → destroyTarget Allié +
  //   exactLevel (le « de Niveau N » précède « de votre choix » dans ces
  //   cartes ; ordre distinct de la forme maxLevel ci-dessous). Cible sans
  //   Niveau = inéligible.
  m = sentence.match(
    /^detrui(?:sez|re) l['’ ]?\s?allie de niveau (\d+) de votre choix( dans le monde)?( ou dans un havre ?-?sac)?$/,
  );
  if (m) {
    const zones: ("monde" | "havreSac")[] = m[3]
      ? ["monde", "havreSac"]
      : ["monde"];
    return {
      op: "destroyTarget",
      what: "Allié",
      exactLevel: toNumber(m[1]),
      zones,
    };
  }
  // « Détruisez l'Allié [Famille] de votre choix [de Niveau inférieur ou égal
  //   à N | de Niveau N] » → destroyTarget mono-type Allié + filtres `sub` /
  //   `maxLevel` (≤) / `exactLevel` (= N exact). Placé AVANT la forme mono-type
  //   nue. Seul l'Allié porte une Famille et un Niveau dans ce TCG.
  m = sentence.match(
    /^detrui(?:sez|re) l['’ ]?\s?allie( [a-z-]+)? de votre choix( de niveau inferieur ou egal a (\d+)| de niveau (\d+))?( dans le monde)?( ou dans un havre ?-?sac)?$/,
  );
  if (m && (m[1] || m[3] || m[4])) {
    const sub = m[1]?.trim();
    // mots de liaison captés par la classe famille → pas une vraie Famille
    if (sub && ["ou", "non", "de", "et"].includes(sub)) return null;
    const zones: ("monde" | "havreSac")[] = m[6]
      ? ["monde", "havreSac"]
      : ["monde"];
    return {
      op: "destroyTarget",
      what: "Allié",
      ...(sub ? { sub } : {}),
      ...(m[3] ? { maxLevel: toNumber(m[3]) } : {}),
      ...(m[4] ? { exactLevel: toNumber(m[4]) } : {}),
      zones,
    };
  }
  // « Détruisez le/la/l' <Famille> de votre choix [de Niveau …] » → destroyTarget
  //   Allié + `sub`. La Famille nue (« le Démon », « la Gelée ») désigne un Allié
  //   de cette Famille (cf. ALLIED_FAMILIES — UNIQUEMENT des Familles de créature
  //   non ambiguës ; un mot hors allowlist retombe en manuel). Pendant
  //   « Détruisez » de la forme « Mettez en jeu un <Famille> ». Placé AVANT la
  //   forme mono-type nue (qui ne connaît que les types racines).
  m = sentence.match(
    /^detrui(?:sez|re) (?:le |la |l['’ ]?\s?)([a-z]+) de votre choix( de niveau inferieur ou egal a (\d+)| de niveau (\d+))?( dans le monde)?( ou dans un havre ?-?sac)?$/,
  );
  if (m && ALLIED_FAMILIES.has(m[1])) {
    const zones: ("monde" | "havreSac")[] = m[5]
      ? ["monde", "havreSac"]
      : ["monde"];
    return {
      op: "destroyTarget",
      what: "Allié",
      sub: m[1],
      ...(m[3] ? { maxLevel: toNumber(m[3]) } : {}),
      ...(m[4] ? { exactLevel: toNumber(m[4]) } : {}),
      zones,
    };
  }
  m = sentence.match(
    /^detrui(?:sez|re) (l['’ ]?\s?allie|la zone|l['’ ]?\s?equipement|le dofus) de votre choix( dans le monde)?( ou dans un havre ?-?sac)?$/,
  );
  if (m) {
    const what = TARGET_WHAT[m[1].replace(/['’]/g, "'").replace(/\s+/g, " ")];
    if (!what) return null;
    const zones: ("monde" | "havreSac")[] = m[3]
      ? ["monde", "havreSac"]
      : ["monde"];
    return { op: "destroyTarget", what, zones };
  }
  // « Inclinez / Redressez l'Allié (ou Héros) ATTAQUANT (OU BLOQUEUR) de votre
  //   choix » → tapTarget / untapTarget + filtre combatRole (rôle dans le
  //   combat en cours). Placé AVANT la forme générique. Aucune cible hors
  //   combat (filtre vide).
  m = sentence.match(
    /^(incline|redresse)[zr] l['’ ]?\s?allie( ou heros)? (attaquant ou bloqueur|bloqueur ou attaquant|attaquant|bloqueur) de votre choix( dans le monde)?( ou dans (?:un|son) havre ?-?sac)?$/,
  );
  if (m) {
    const role = m[3];
    return {
      op: m[1] === "incline" ? "tapTarget" : "untapTarget",
      ...(m[2] ? { heroes: true } : {}),
      combatRole:
        role === "attaquant"
          ? "attacking"
          : role === "bloqueur"
            ? "blocking"
            : "inCombat",
      zones: m[4] ? ["monde", "havreSac"] : ["monde"],
    };
  }
  // « Inclinez / Redressez l'Allié (ou Héros) INCLINÉ / DRESSÉ de votre choix »
  //   → tapTarget / untapTarget + filtre orientation. « Redressez l'Allié
  //   incliné » / « Inclinez l'Allié dressé » : seule la cible de l'orientation
  //   donnée est éligible. Placé AVANT la forme générique.
  m = sentence.match(
    /^(incline|redresse)[zr] l['’ ]?\s?allie( ou heros)? (incline|dresse) de votre choix( dans le monde)?( ou dans (?:un|son) havre ?-?sac)?$/,
  );
  if (m)
    return {
      op: m[1] === "incline" ? "tapTarget" : "untapTarget",
      ...(m[2] ? { heroes: true } : {}),
      orientation: m[3] === "incline" ? "tapped" : "upright",
      zones: m[4] ? ["monde", "havreSac"] : ["monde"],
    };
  // « Inclinez / Redressez l'Allié (ou Héros) [adverse] de votre choix
  //   [dans le Monde][ ou dans un Havre-Sac] » → tapTarget / untapTarget.
  // « adverse » → contrôleur opponent ; sinon n'importe quel contrôleur. La
  // TOTALITÉ de la phrase doit correspondre (le `$` rejette toute condition
  // résiduelle : « de Force ≤ 3 », « qui vient d'apparaître », « attaquant »…).
  m = sentence.match(
    /^(incline|redresse)[zr] l['’ ]?\s?allie( ou heros)?( adverse)? de votre choix( dans le monde)?( ou dans (?:un|son) havre ?-?sac)?$/,
  );
  if (m)
    return {
      op: m[1] === "incline" ? "tapTarget" : "untapTarget",
      ...(m[2] ? { heroes: true } : {}),
      ...(m[3] ? { controller: "opponent" } : {}),
      // sans clause Havre-Sac, la cible inclinable est dans le Monde (comme
      // destroyTarget) — pas le défaut « tout le jeu » de targetZones.
      zones: m[5] ? ["monde", "havreSac"] : ["monde"],
    };
  // « Inclinez / Redressez un de vos Alliés (ou Héros) [dans le Monde] … »
  // → tapTarget / untapTarget contrôleur self. Pas de famille ni de condition
  // (« un de vos Alliés Sram », « : effet » sont hors champ — rejetés par `$`
  // et par l'absence de `:`).
  m = sentence.match(
    /^(incline|redresse)[zr] un de vos allies( ou heros)?( dans le monde)?( ou dans (?:un|son) havre ?-?sac)?$/,
  );
  if (m)
    return {
      op: m[1] === "incline" ? "tapTarget" : "untapTarget",
      ...(m[2] ? { heroes: true } : {}),
      controller: "self",
      zones: m[4] ? ["monde", "havreSac"] : ["monde"],
    };
  // « Renvoyez l'Allié, la Zone ou l'Équipement de votre choix dans la main de
  //   son propriétaire » (TROIS types — Sablier de Xelor) → returnToHand multi-
  //   type. Énumération « X, Y ou Z » : trois compléments mutuellement distincts.
  //   Placé AVANT la forme mono-type « Renvoyez l'Allié … ». Le renvoi en main
  //   fonctionne pour tout type (la résolution déplace vers la main du
  //   propriétaire, indépendamment du type). « ou Héros » n'apparaît pas dans
  //   cette énumération de types-cartes (un Héros n'est pas renvoyé en main).
  m = sentence.match(
    /^renvoyez (l['’ ]?\s?allie|la zone|l['’ ]?\s?equipement|le dofus), (l['’ ]?\s?allie|la zone|l['’ ]?\s?equipement|le dofus) ou (l['’ ]?\s?allie|la zone|l['’ ]?\s?equipement|le dofus) de votre choix dans la main de son proprietaire$/,
  );
  if (m) {
    const norms = [m[1], m[2], m[3]].map(
      (w) => TARGET_WHAT[w.replace(/['’]/g, "'").replace(/\s+/g, " ")],
    );
    if (norms.some((w) => !w) || new Set(norms).size !== 3) return null;
    return {
      op: "returnToHand",
      whatAny: norms as ("Allié" | "Zone" | "Équipement" | "Dofus")[],
      zones: ["monde", "havreSac"],
    };
  }
  // « Renvoyez l'Allié (ou Héros) [adverse] de votre choix dans la main de son
  //   propriétaire » → returnToHand. « adverse » → opponent. La cible retourne
  //   dans la main de SON propriétaire (résolution dans targeting.ts).
  m = sentence.match(
    /^renvoyez l['’ ]?\s?allie( ou heros)?( adverse)? de votre choix dans la main de son proprietaire$/,
  );
  if (m)
    return {
      op: "returnToHand",
      ...(m[1] ? { heroes: true } : {}),
      ...(m[2] ? { controller: "opponent" } : {}),
      zones: ["monde", "havreSac"],
    };
  // « L'Allié (ou Héros) [adverse] de votre choix retourne(nt) dans la main de
  //   son propriétaire » → returnToHand (variante sujet-en-tête / passive de la
  //   forme impérative « Renvoyez … » ci-dessus ; même op, jumeau du script
  //   repulsion-incarnam). Le `$` rejette toute clause résiduelle (« … attaquant
  //   … », « … dans le Monde … », « Le Héros de ce joueur perd … » en op suivante).
  m = sentence.match(
    /^l['’ ]?\s?allie( ou heros)?( adverse)? de votre choix retourne(?:nt)? dans la main de son proprietaire$/,
  );
  if (m)
    return {
      op: "returnToHand",
      ...(m[1] ? { heroes: true } : {}),
      ...(m[2] ? { controller: "opponent" } : {}),
      zones: ["monde", "havreSac"],
    };
  // « Infligez N Dommages à l'Allié (ou Héros) INCLINÉ / DRESSÉ de votre choix »
  //   → damageTarget + filtre orientation. La cible doit avoir l'orientation
  //   imprimée (tapped/upright). Placé AVANT la forme générique (son `$`
  //   rejetterait le qualificatif). Sujet self optionnel comme la forme nue.
  m = sentence.match(
    /^(?:inflige[zr]|(.{1,50}?) inflige) (\d+) dommages? a l['’ ]?\s?allie( ou (?:au )?heros)? (incline|dresse) de votre choix( dans le monde)?( ou dans (?:un|son) havre ?-?sac)?$/,
  );
  if (m) {
    if (m[1] !== undefined && !subjectIsSelf(m[1], cardName)) return null;
    return {
      op: "damageTarget",
      n: toNumber(m[2]),
      element: sourceElement,
      heroes: !!m[3],
      orientation: m[4] === "incline" ? "tapped" : "upright",
      zones: targetZones(m[5], m[6]),
    };
  }
  // « Infligez N Dommages à l'Allié (ou Héros) ATTAQUANT (OU BLOQUEUR) de votre
  //   choix » → damageTarget + filtre combatRole. « attaquant ou bloqueur » =
  //   inCombat (l'un ou l'autre rôle) ; « attaquant » / « bloqueur » seuls =
  //   le rôle exact. Hors combat, aucune cible (filtre vide).
  m = sentence.match(
    /^(?:inflige[zr]|(.{1,50}?) inflige) (\d+) dommages? a l['’ ]?\s?allie( ou (?:au )?heros)? (attaquant ou bloqueur|bloqueur ou attaquant|attaquant|bloqueur) de votre choix( dans le monde)?( ou dans (?:un|son) havre ?-?sac)?$/,
  );
  if (m) {
    if (m[1] !== undefined && !subjectIsSelf(m[1], cardName)) return null;
    const role = m[4];
    return {
      op: "damageTarget",
      n: toNumber(m[2]),
      element: sourceElement,
      heroes: !!m[3],
      combatRole:
        role === "attaquant"
          ? "attacking"
          : role === "bloqueur"
            ? "blocking"
            : "inCombat",
      zones: targetZones(m[5], m[6]),
    };
  }
  // « Infligez N Dommages au Héros [du joueur] de votre choix » (impératif) ou
  //   « [La carte] inflige N Dommages au Héros [du joueur] de votre choix … » →
  //   damageTarget restreint aux HÉROS (targetHeroOnly) : aucun Allié n'est
  //   éligible. « du joueur de votre choix » (choix d'un JOUEUR via son Héros) est
  //   sémantiquement identique à « de votre choix » ici (éligibilité = tous les
  //   Héros en jeu, les deux contrôleurs). Placé AVANT la forme « à l'Allié »
  //   (préposition distincte « au heros », pas de chevauchement). Toute clause
  //   résiduelle (« … qui vient de … », « dans ce Havre-Sac ») est rejetée par `$`.
  m = sentence.match(
    /^(?:inflige[zr]|(.{1,50}?) inflige) (\d+) dommages? au heros (?:du joueur )?de votre choix( dans le monde)?( ou dans (?:un|son) havre ?-?sac)?$/,
  );
  if (m) {
    if (m[1] !== undefined && !subjectIsSelf(m[1], cardName)) return null;
    return {
      op: "damageTarget",
      n: toNumber(m[2]),
      element: sourceElement,
      heroes: true,
      targetHeroOnly: true,
      zones: targetZones(m[3], m[4]),
    };
  }
  // « Le Héros [du joueur] de votre choix perd N PV » → damageTarget restreint aux
  //   HÉROS (targetHeroOnly), montant N (410.2 : un Héros perd des PV). Pendant de
  //   « inflige N Dommages au Héros … de votre choix » formulé en perte de PV par
  //   le Héros CHOISI (distinct de « le Héros ADVERSE perd N PV » → damageOppHero,
  //   non interactif). STRICT : `$` rejette toute restriction résiduelle
  //   (« … N'utilisez ce pouvoir que si … » est une phrase suivante non comprise →
  //   l'effet entier reste manuel).
  m = sentence.match(
    /^le heros (?:du joueur )?de votre choix perd (\d+) (?:pv|points? de vie)$/,
  );
  if (m)
    return {
      op: "damageTarget",
      n: toNumber(m[1]),
      element: sourceElement,
      heroes: true,
      targetHeroOnly: true,
      zones: ["monde", "havreSac"],
    };
  // « Infligez N Dommages à l'Allié [Famille] de votre choix » (impératif) ou
  // « [La carte] inflige N Dommages à l'Allié [ou Héros] de votre choix … »
  // La Famille (« à l'Allié Bouftou ») et « ou Héros » sont mutuellement
  // exclusifs ici (un Héros n'a pas de Famille) → groupes alternés.
  m = sentence.match(
    /^(?:inflige[zr]|(.{1,50}?) inflige) (\d+) dommages? a l['’ ]?\s?allie(?:( ou heros)|( [a-z-]+))? de votre choix( dans le monde)?( ou dans (?:un|son) havre ?-?sac)?$/,
  );
  if (m) {
    if (m[1] !== undefined && !subjectIsSelf(m[1], cardName)) return null;
    const sub = m[4]?.trim();
    // mots de liaison captés par la classe famille → pas une vraie Famille
    if (sub && ["ou", "non", "de", "et", "dans"].includes(sub)) return null;
    return {
      op: "damageTarget",
      n: toNumber(m[2]),
      element: sourceElement,
      heroes: !!m[3],
      ...(sub ? { sub } : {}),
      zones: targetZones(m[5], m[6]),
    };
  }
  // « [self] inflige sa Force en Dommages à l'Allié (ou Héros) de votre choix
  //   [adverse] [dans le Monde][ ou dans un Havre-Sac] » → damageTargetByForce.
  //   Le sujet doit être la carte elle-même (sujet explicite vérifié, ou forme
  //   nue « inflige… » comme corps d'un déclencheur de la carte). Le montant
  //   (Force de la source) est calculé à la résolution dans targeting.ts.
  m = sentence.match(
    /^(?:(.{1,50}?) )?inflige sa force en dommages? a l['’ ]?\s?allie( ou heros)?( adverse)? de votre choix( dans le monde)?( ou dans (?:un|son) havre ?-?sac)?$/,
  );
  if (m) {
    if (m[1] !== undefined && !subjectIsSelf(m[1], cardName)) return null;
    return {
      op: "damageTargetByForce",
      element: sourceElement,
      ...(m[2] ? { heroes: true } : {}),
      ...(m[3] ? { controller: "opponent" as const } : {}),
      zones: targetZones(m[4], m[5]),
    };
  }
  // « Vos Alliés dans le Monde gagnent un bonus de Force égal au Niveau de
  // votre Héros (ou +N en Force) jusqu'à la fin du tour » (Stratégie de
  // Groupe, 812.3b) — jeton de siège `teamForceMod` sur le Héros.
  m = sentence.match(
    /^vos allies dans le monde gagnent (?:un bonus de force egal au niveau de votre heros|\+(\d+) en force) jusqu['’]a la fin du tour$/,
  );
  if (m)
    return {
      op: "buffForceAlliesMondeTurn",
      n: m[1] ? toNumber(m[1]) : "heroLevel",
    };
  // « Jusqu'au début de votre prochain tour, tous les Dommages sont réduits
  // à 0 » (Trêve) — bouclier global, jeton `treveUntilTurn` sur le Héros.
  m = sentence.match(
    /^jusqu['’]au debut de votre prochain tour\s*,?\s*tous les dommages sont reduits a 0$/,
  );
  if (m) return { op: "globalDamageShield" };
  // OPS DE MASSE (« tous les … » / « tous vos … » — pas de « de votre choix ») :
  // inclinaison / redressement / Dommages de masse. Parseur dédié.
  const mass = parseMassOp(sentence, sourceElement);
  if (mass) return mass;
  return null;
}

/**
 * Sujet pluriel d'une op de MASSE → filtres `{controller, heroes?, sub?}`, ou
 * null si le sujet n'est pas une forme reconnue. Formes admises :
 *  - « tous les allies [et heros] [adverses] » → controller any (ou opponent si
 *    « adverses ») ;
 *  - « tous vos allies [<famille>] [et heros] » → controller self (+ Famille) ;
 *  - « tous vos <famille>s » (« tous vos Bouftous ») → self + sub (Famille).
 * `subject` est déjà normalisé, sans le préfixe verbal. CONSERVATEUR : une
 * Famille hors ALLIED_FAMILIES → null (pas de devinette de type).
 */
function parseMassSubject(subject: string): {
  controller: "self" | "opponent" | "any";
  heroes?: boolean;
  sub?: string;
} | null {
  // « tous les Alliés [et Héros] [adverses] » (controller any, ou opponent si adverses)
  let m = subject.match(/^tous les allies( et heros)?( adverses)?$/);
  if (m)
    return {
      controller: m[2] ? "opponent" : "any",
      ...(m[1] ? { heroes: true } : {}),
    };
  // « tous vos Alliés [Famille] [et Héros] » (controller self, Famille optionnelle)
  m = subject.match(/^tous vos allies( [a-z-]+?)?(s)?( et heros)?$/);
  if (m) {
    const famRaw = m[1]?.trim();
    // mot de liaison capté par la classe famille → pas une vraie Famille
    if (famRaw && ["et", "ou", "de", "dans"].includes(famRaw)) return null;
    const fam = famRaw ? famRaw.replace(/s$/, "") : undefined;
    if (fam && !ALLIED_FAMILIES.has(fam)) return null;
    return {
      controller: "self",
      ...(fam ? { sub: fam } : {}),
      ...(m[3] ? { heroes: true } : {}),
    };
  }
  // « tous vos <Famille>s » (« tous vos Bouftous ») → Allié de cette Famille.
  m = subject.match(/^tous vos ([a-z-]+?)s?$/);
  if (m) {
    const fam = m[1].replace(/s$/, "");
    if (ALLIED_FAMILIES.has(fam)) return { controller: "self", sub: fam };
  }
  return null;
}

/**
 * Parse une op de MASSE non interactive (« Inclinez/Redressez tous … »,
 * « Infligez N Dommages à tous les Alliés … »). STRICT : la totalité de la
 * phrase doit correspondre (le `$` rejette toute clause résiduelle). Le filtre
 * « de Force inférieure ou égale à N » devient `maxForce` ; « dans le Monde » →
 * zones ["monde"], absent → tout le jeu (targetZones). `sentence` est normalisé.
 */
function parseMassOp(sentence: string, sourceElement: string): EffectOp | null {
  // « Inclinez / Redressez <sujet pluriel> [de Force inférieure ou égale à N]
  //   [dans le Monde]. »
  let m = sentence.match(
    /^(incline|redresse)[zr] (tous (?:les|vos) [a-z -]+?)( de force inferieure ou egale a (\d+))?( dans le monde)?$/,
  );
  if (m) {
    const subj = parseMassSubject(m[2].trim());
    if (!subj) return null;
    return {
      op: m[1] === "incline" ? "tapAll" : "untapAll",
      controller: subj.controller,
      ...(subj.heroes ? { heroes: true } : {}),
      ...(subj.sub ? { sub: subj.sub } : {}),
      ...(m[4] ? { maxForce: toNumber(m[4]) } : {}),
      zones: m[5] ? ["monde"] : ["monde", "havreSac"],
    };
  }
  // « Infligez N Dommages à tous les Alliés [et Héros] [adverses] [dans le
  //   Monde] » (et variantes « tous vos … ») → damageAll. L'Élément des Dommages
  //   est celui de la source (410.1), figé à la compilation.
  m = sentence.match(
    /^infligez (\d+) dommages? a (tous (?:les|vos) [a-z -]+?)( de force inferieure ou egale a (\d+))?( dans le monde)?$/,
  );
  if (m) {
    const subj = parseMassSubject(m[2].trim());
    if (!subj) return null;
    return {
      op: "damageAll",
      n: toNumber(m[1]),
      element: sourceElement,
      controller: subj.controller,
      ...(subj.heroes ? { heroes: true } : {}),
      ...(subj.sub ? { sub: subj.sub } : {}),
      ...(m[4] ? { maxForce: toNumber(m[4]) } : {}),
      zones: m[5] ? ["monde"] : ["monde", "havreSac"],
    };
  }
  // « Détruisez <sujet pluriel> [de Niveau ≤ N | de Niveau N] [inclinés / dressés]
  //   [dans le Monde]. » → destroyAll (board-wipe non interactif). Le sujet
  //   (« tous les Alliés [et Héros] [adverses] », « tous vos Alliés [Famille] »…)
  //   passe par parseMassSubject (mêmes Familles non ambiguës). « de Niveau N »
  //   (exact) → exactLevel ; « ≤ N » → maxLevel. « inclinés » / « dressés » →
  //   orientation. Le `$` rejette toute clause résiduelle (« qui lui ont infligé… »,
  //   « ; ou détruisez… », « Vous ne gagnez pas d'XP. »…) → reste manuel (fidèle).
  m = sentence.match(
    /^detrui(?:sez|re) (tous (?:les|vos) [a-z -]+?)(?: de niveau (?:inferieur ou egal a (\d+)|(\d+)))?( inclines?| dresses?)?( dans le monde)?$/,
  );
  if (m) {
    const subj = parseMassSubject(m[1].trim());
    if (!subj) return null;
    const orientation = m[4]
      ? m[4].trim().startsWith("incline")
        ? ("tapped" as const)
        : ("upright" as const)
      : undefined;
    return {
      op: "destroyAll",
      controller: subj.controller,
      ...(subj.heroes ? { heroes: true } : {}),
      ...(subj.sub ? { sub: subj.sub } : {}),
      ...(m[2] ? { maxLevel: toNumber(m[2]) } : {}),
      ...(m[3] ? { exactLevel: toNumber(m[3]) } : {}),
      ...(orientation ? { orientation } : {}),
      zones: m[5] ? ["monde"] : ["monde", "havreSac"],
    };
  }
  return null;
}

/**
 * Une phrase, éventuellement composée (« X, puis Y ») → ses ops, ou null si
 * un seul fragment n'est pas compris.
 */
function parseOps(
  sentence: string,
  cardName: string,
  sourceElement: string,
): EffectOp[] | null {
  const fragments = sentence.split(/,?\s+puis\s+/).map((s) => s.trim());
  const ops: EffectOp[] = [];
  for (const f of fragments) {
    if (!f) return null;
    const op = parseSentence(f, cardName, sourceElement);
    if (!op) return null;
    ops.push(op);
  }
  return ops;
}

/**
 * « Choisissez jusqu'à N Alliés ou Héros [attaquants ou bloqueurs]?
 * [différents]? » — 1re phrase d'un effet de Dommages MULTI-CIBLES BORNÉ.
 * Retourne la borne (count), le drapeau « différents » et le filtre de rôle de
 * combat, ou null si la phrase n'est pas EXACTEMENT cette forme (STRICT :
 * « contrôlés par le même joueur », valeurs dynamiques, etc. → manuel).
 */
function matchChooseUpTo(sentence: string): {
  count: number;
  heroes: boolean;
  distinct: boolean;
  combatRole?: "inCombat";
} | null {
  const m = sentence.match(
    /^choisissez jusqu['’]a (une|deux|trois|\d+) allies ou heros( attaquants ou bloqueurs)?( differents)?$/,
  );
  if (!m) return null;
  return {
    count: toNumber(m[1]),
    heroes: true,
    distinct: !!m[3],
    ...(m[2] ? { combatRole: "inCombat" as const } : {}),
  };
}

/**
 * « [La source] leur inflige X Dommages » — 2e phrase d'un effet de Dommages
 * multi-cibles. Le sujet doit être la carte elle-même (subjectIsSelf). Retourne
 * X, ou null. STRICT : toute clause résiduelle (« … et perd … ») rejetée par `$`.
 */
function matchLeurInflige(sentence: string, cardName: string): number | null {
  const m = sentence.match(/^(.{1,50}?) leur inflige (\d+) dommages?$/);
  if (!m || !subjectIsSelf(m[1], cardName)) return null;
  return toNumber(m[2]);
}

/**
 * Compile un corps d'effet (déjà normalisé, sans point final) en ops.
 * Gère la clause de liaison « Il apparaît incliné. » : elle marque la
 * recherche-mise-en-jeu précédente (`tapped`), sinon rejet.
 */
function compileBody(
  body: string,
  cardName: string,
  sourceElement: string,
): EffectOp[] | null {
  const sentences = body
    .replace(/\.$/, "")
    .split(/\.\s*/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (!sentences.length) return null;
  const ops: EffectOp[] = [];
  for (let si = 0; si < sentences.length; si++) {
    const s = sentences[si];
    // DOMMAGES MULTI-CIBLES BORNÉS, sur DEUX phrases (« Choisissez jusqu'à N
    // Alliés ou Héros [attaquants ou bloqueurs]? [différents]?. [La source] leur
    // inflige X Dommages. ») → un seul op `damageMultiTarget`. La 1re phrase porte
    // la BORNE (count), les filtres (combatRole / différents) ; la 2e porte la
    // valeur X. Reconnu ICI (pas dans parseSentence) car l'op naît de deux phrases.
    const multi = matchChooseUpTo(s);
    if (multi) {
      const next = sentences[si + 1];
      const dmg = next ? matchLeurInflige(next, cardName) : null;
      if (dmg) {
        ops.push({
          op: "damageMultiTarget",
          n: dmg,
          element: sourceElement,
          count: multi.count,
          ...(multi.distinct ? { distinct: true } : {}),
          ...(multi.heroes ? { heroes: true } : {}),
          ...(multi.combatRole ? { combatRole: multi.combatRole } : {}),
          zones: ["monde", "havreSac"],
        });
        si++; // consomme aussi la phrase « … leur inflige X Dommages »
        continue;
      }
      return null; // « Choisissez … » sans phrase de Dommages comprise → manuel
    }
    // CLAUSE RÉSIDUELLE « [cet Allié (ou Héros) / il / elle] ne peut pas se
    // redresser jusqu'au début de votre prochain tour » (les deux ordres) :
    // se rapporte à la cible inclinée par la phrase précédente (tapTarget) —
    // on marque cette op `cannotRedress`. Pandrista, Kolo-Kolko, Boufdégou…
    // STRICT : sans tapTarget précédent, le référent est ambigu → manuel.
    if (
      /^(?:cet allie(?: ou heros)?|cette carte|il|elle) ne peut pas se redresser jusqu['’]au debut de votre prochain tour$/.test(
        s,
      ) ||
      /^jusqu['’]au debut de votre prochain tour,? (?:cet allie(?: ou heros)?|cette carte|il|elle) ne peut pas se redresser$/.test(
        s,
      )
    ) {
      const tapOp = [...ops]
        .reverse()
        .find(
          (o): o is Extract<EffectOp, { op: "tapTarget" }> =>
            o.op === "tapTarget",
        );
      if (tapOp) {
        tapOp.cannotRedress = true;
        continue;
      }
      return null;
    }
    if (s === "il apparait incline" || s === "ils apparaissent inclines") {
      // se rapporte à la dernière mise-en-jeu (le mélange peut s'être intercalé :
      // « …mettez-le en jeu, puis mélangez… ») — recherche-Pioche (searchDeck,
      // dest monde) OU mise-en-jeu main/Défausse (putInPlay).
      const put = [...ops]
        .reverse()
        .find(
          (
            o,
          ): o is Extract<
            EffectOp,
            { op: "searchDeck" } | { op: "putInPlay" }
          > =>
            (o.op === "searchDeck" && o.dest === "monde") ||
            o.op === "putInPlay",
        );
      if (put) {
        put.tapped = true;
        continue;
      }
      return null;
    }
    const parsed = parseOps(s, cardName, sourceElement);
    if (!parsed) return null;
    ops.push(...parsed);
  }
  return ops;
}

/**
 * Compile un CORPS ACTOR-BINDING « il/elle … » (déjà normalisé, sans « il/elle »,
 * sans point final) : le SUJET est une créature fournie par le contexte (apparue
 * ou sélectionnée par un coût), pas la carte source. STRICT — seules trois formes
 * sont admises, chacune une op à sujet implicite (sourceId, réécrit par le
 * moteur vers la créature liée) :
 *   - « inflige sa Force en Dommages à l'Allié (ou Héros) de votre choix … »
 *     → damageTargetByForce ;
 *   - « inflige N Dommages à l'Allié (ou Héros) de votre choix … »
 *     → damageTarget ;
 *   - « gagne +N en Force jusqu'à la fin du tour » → buffForceSelf.
 * `sourceElement` n'est qu'un repli : à la résolution, l'Élément des Dommages
 * est recalculé sur la créature liée (cf. engine). Toute autre forme → null.
 */
function compileActorBoundBody(
  rawBody: string,
  sourceElement: string,
): EffectOp[] | null {
  const body = rawBody.replace(/\.$/, "").trim();
  // « inflige sa Force en Dommages à l'Allié (ou Héros) de votre choix [adverse]
  //   [dans le Monde][ ou dans un Havre-Sac] » → damageTargetByForce.
  let m = body.match(
    /^inflige sa force en dommages? a l['’ ]?\s?allie( ou heros)?( adverse)? de votre choix( dans le monde)?( ou dans (?:un|son) havre ?-?sac)?$/,
  );
  if (m)
    return [
      {
        op: "damageTargetByForce",
        element: sourceElement,
        ...(m[1] ? { heroes: true } : {}),
        ...(m[2] ? { controller: "opponent" as const } : {}),
        zones: targetZones(m[3], m[4]),
      },
    ];
  // « inflige N Dommages à l'Allié (ou Héros) de votre choix [dans le Monde]
  //   [ ou dans un Havre-Sac] » → damageTarget (montant fixe).
  m = body.match(
    /^inflige (\d+) dommages? a l['’ ]?\s?allie( ou heros)? de votre choix( dans le monde)?( ou dans (?:un|son) havre ?-?sac)?$/,
  );
  if (m)
    return [
      {
        op: "damageTarget",
        n: toNumber(m[1]),
        element: sourceElement,
        heroes: !!m[2],
        zones: targetZones(m[3], m[4]),
      },
    ];
  // « gagne +N en Force jusqu'à la fin du tour » → buffForceSelf (sur la créature
  //   liée). buffForceSelf lit le sourceId réécrit par le moteur.
  m = body.match(/^gagne \+(\d+) en force jusqu['’]a la fin d[ue] tour$/);
  if (m) return [{ op: "buffForceSelf", n: toNumber(m[1]) }];
  return null;
}

/** Spécification de condition « Si <cond> » (cf. schéma effects). */
type CondSpec = Extract<EffectOp, { op: "conditional" }>["cond"];

/**
 * Parse une CONDITION « si <cond> » (déjà normalisée, sans « si » initial, sans
 * virgule de fin) → `CondSpec`, ou null si la condition n'est PAS faithfully
 * évaluable. STRICT : seules les formes ci-dessous (lisibles exactement de
 * l'état) sont admises ; tout le reste reste manuel.
 *  - « [self] est dans le Monde / son Havre-Sac » → selfInZone (le sujet doit
 *    être la carte elle-même ; « dans votre Défausse » est REJETÉ — le
 *    déclencheur onTurnStart ne scanne pas la Défausse, ce serait infidèle) ;
 *  - « votre Héros est de Niveau N (ou plus / ou moins) » → heroLevel ;
 *  - « vous contrôlez (au moins N) [Allié] <Famille> » → controlsAlly.
 */
function parseCond(raw: string, cardName: string): CondSpec | null {
  const cond = raw.trim();
  // « [self] est dans le Monde / dans son|votre Havre-Sac » (la SOURCE en jeu).
  let m = cond.match(
    /^(.{1,60}?) (?:est|se trouve) dans (le monde|(?:son|votre) havre[- ]?sac)$/,
  );
  if (m && subjectIsSelfRef(m[1].trim(), cardName)) {
    return {
      cond: "selfInZone",
      zone: m[2] === "le monde" ? "monde" : "havreSac",
    };
  }
  // « votre Héros est de Niveau N » / « … de Niveau N ou plus » / « … ou moins ».
  m = cond.match(
    /^votre heros est (?:de )?niveau (\d+)( ou plus| et plus| ou moins)?$/,
  );
  if (m) {
    const n = toNumber(m[1]);
    const op = m[2]
      ? /plus/.test(m[2])
        ? (">=" as const)
        : ("<=" as const)
      : ("==" as const);
    return { cond: "heroLevel", op, n };
  }
  // « vous contrôlez [au moins N] [un] [Allié] <Famille> » → controlsAlly. Le
  // dénombrement (« au moins trois Kitsous ») ou le singulier (« un Enclos » —
  // hors champ : Enclos n'est pas une Famille d'Allié) ; on n'admet QUE les
  // Familles non ambiguës d'Allié (ALLIED_FAMILIES). « moins d'Alliés que … »,
  // « un Niveau cumulé … » (valeurs comparatives dynamiques) → rejet.
  m = cond.match(
    /^vous controlez (?:au moins (une|deux|trois|\d+) )?(?:un |des |le |la )?([a-z-]+?)s?$/,
  );
  if (m) {
    const fam = m[2].replace(/s$/, "");
    if (!ALLIED_FAMILIES.has(fam)) return null;
    const min = m[1] ? toNumber(m[1]) : 1;
    return { cond: "controlsAlly", sub: fam, min };
  }
  return null;
}

/** Le sujet du déclencheur désigne-t-il la carte elle-même ? */
function subjectIsSelf(subject: string, cardName: string): boolean {
  const s = subject.replace(/^(le |la |les |l['’]\s?|un |une )/, "").trim();
  const n = norm(cardName);
  return n.includes(s) || s.includes(n);
}

/**
 * Le sujet d'un COÛT désigne-t-il la carte elle-même ? Plus large que
 * `subjectIsSelf` : reconnaît aussi les RÉFÉRENTS DÉMONSTRATIFS auto-référents
 * « cette carte » (toujours = soi) et « ce/cet/cette <type> » (on retire le
 * démonstratif puis on rapproche du nom, comme la phrase « Redressez ce X. »).
 * Conservateur : tout sujet hors de ces formes / du nom de la carte → faux.
 */
function subjectIsSelfRef(subject: string, cardName: string): boolean {
  const s = subject.trim();
  if (s === "cette carte") return true;
  return subjectIsSelf(s.replace(/^cet?t?e? /, ""), cardName);
}

/**
 * Compile un texte d'effet en forme machine, ou null si une seule partie
 * n'est pas comprise. Pur — utilisé par le script de compilation hors-ligne
 * et comme repli runtime.
 */
export function compileEffectText(
  text: string,
  cardName: string,
  sourceElement = "Neutre",
): CompiledEffect | null {
  // Une phrase de LIEU optionnelle (« apparaît dans le Monde, … », « apparaît
  // depuis votre Pioche, … ») peut s'intercaler avant la virgule sans changer
  // le déclencheur (toujours onArrive) — cf. APPEAR_LOC (allowlist locative).
  const m = norm(text).match(
    new RegExp(
      "^(?:quand|lorsque) (.{1,60}?) apparait" + APPEAR_LOC + "\\s*,\\s*(.+)$",
    ),
  );
  if (!m || !subjectIsSelf(m[1], cardName)) return null;
  let rest = m[2].replace(/\.$/, "").trim();
  let optional = false;
  const opt = rest.match(/^vous pouvez (.+)$/);
  if (opt) {
    optional = true;
    rest = opt[1];
  }
  // « vous pouvez » ne porte que sur sa phrase : un optionnel multi-phrases
  // est ambigu (le reste serait-il obligatoire ?) → on ne compile pas.
  if (optional && /\.\s+\S/.test(rest)) return null;
  const ops = compileBody(rest, cardName, sourceElement);
  if (!ops) return null;
  return optional
    ? { trigger: "onArrive", optional, ops }
    : { trigger: "onArrive", ops };
}

/**
 * Compile un POUVOIR À INCLINAISON (`requiresIncline`) : pas de préfixe de
 * déclencheur, le texte est directement la suite d'opérations. Strict :
 * toute phrase incomprise (condition, restriction…) → pas de compilation.
 */
export function compileTapEffectText(
  text: string,
  cardName: string,
  sourceElement = "Neutre",
  // Carte ACTION (302.1) : un coût de RECYCLAGE sur une Action est sa résolution
  // au moment où elle est jouée → trigger "onPlay" (lu par playEffects), pas
  // "onTap" (pouvoir à inclinaison). Les Parchemins (« Recyclez jusqu'à N … : … »)
  // en relèvent. N'affecte QUE les coûts de recyclage (les autres formes onTap —
  // inclinaison/sacrifice — ne s'appliquent pas aux Actions). Défaut false.
  asAction = false,
): CompiledEffect | null {
  const normalized = norm(text);
  const recycleTrigger: CompiledEffect["trigger"] = asAction
    ? "onPlay"
    : "onTap";
  // COÛT PAYÉ « Inclinez / Détruisez un [autre] de vos [Allié(s) | Allié(s) ou
  // Héros] [Famille] [de Niveau ≤ N] : CORPS » (806 — coûts d'activation). Le
  // coût est modélisé comme la PREMIÈRE op (ciblage costTap/costDestroyControlled,
  // controller self) ; le CORPS suit et a pour sujet le contrôleur (acteur).
  // Le CORPS doit se compiler ENTIÈREMENT via compileBody, OU être un corps
  // ACTOR-BINDING « il/elle … » sur un coût d'inclinaison (créature payée =
  // acteur, `actor:"costTarget"`). Testé avant la forme sacrificeSelf (« un de
  // vos » n'est pas soi → l'ancienne forme renverrait null).
  const paid = compileTapPaidCost(normalized, cardName, sourceElement);
  if (paid) return paid;
  // COÛT DE RECYCLAGE « JUSQU'À N » À VALEUR « nombre recyclé » (« Recyclez jusqu'à
  // N Monstres … : … le même nombre de Dommages … ») — testé AVANT la forme à coût
  // fixe (« une carte »), qu'il ne capte pas. Recyclage optionnel 0..N, magnitude
  // du corps = compte réel (fromCount).
  const recycleCount = compileRecycleCountCost(
    normalized,
    cardName,
    sourceElement,
  );
  if (recycleCount) return { ...recycleCount, trigger: recycleTrigger };
  // COÛT DE RECYCLAGE « Recyclez … : CORPS » (Défausse / main / soi-depuis-le-
  // Monde) → cost:"paidOps" avec costRecycle en première op. Testé avant la
  // forme incline/sacrifice (le préfixe « Recyclez » ne capte ni l'un ni l'autre).
  const recycle = compileRecyclePaidCost(normalized, cardName, sourceElement);
  if (recycle) return { ...recycle, trigger: recycleTrigger };
  let body = normalized;
  // COÛT D'INCLINAISON DE SOI « Inclinez [cette carte] : CORPS » — la phrase
  // de coût explicite la même inclinaison de la SOURCE qu'un pouvoir
  // `requiresIncline` (l'inclinaison par défaut d'activateTapPower) ; elle ne
  // produit donc AUCUNE op (pas de cost field) — seul le CORPS est compilé. Le
  // sujet du « : » doit être la carte elle-même (subjectIsSelf) ; « Inclinez un
  // de vos … » (coût payé, déjà routé) et « Inclinez l'Allié … de votre choix »
  // (cible — pas de « : », corps tapTarget) ne sont PAS captés ici. Un corps
  // actor-binding (« il/elle … ») n'a pas de sens sur l'inclinaison de la source
  // (le sujet du corps EST la source, pas une créature payée) → rejet, manuel.
  const inclineCost = body.match(/^inclinez ([^:]{1,50}?)\s*:\s*(.+)$/);
  if (inclineCost) {
    if (!subjectIsSelfRef(inclineCost[1].trim(), cardName)) return null;
    if (/^(?:il|elle)\s/.test(inclineCost[2].trim())) return null;
    const inclineOps = compileBody(inclineCost[2], cardName, sourceElement);
    if (!inclineOps) return null;
    return { trigger: "onTap", ops: inclineOps };
  }
  // Coût « Détruisez [cette carte] : effet » — le sacrifice remplace
  // l'inclinaison ; un coût dont le sujet n'est pas la carte → rejet.
  let cost: "sacrificeSelf" | undefined;
  const costMatch = body.match(/^detruisez ([^:]{1,50}?)\s*:\s*(.+)$/);
  if (costMatch) {
    if (!subjectIsSelf(costMatch[1].trim(), cardName)) return null;
    cost = "sacrificeSelf";
    body = costMatch[2];
  }
  const ops = compileBody(body, cardName, sourceElement);
  if (!ops) return null;
  return cost ? { trigger: "onTap", cost, ops } : { trigger: "onTap", ops };
}

/**
 * Le texte a-t-il la forme d'un POUVOIR À COÛT PAYÉ « Inclinez/Détruisez un de
 * vos X : … » ? Reconnaissance LARGE (préfixe seul) : sert à router vers le
 * parseur tap même sans `requiresIncline` ; la compilation effective reste
 * strict (corps entièrement compilable, non actor-binding) — sinon → manuel.
 */
export function isPaidCostText(text: string): boolean {
  // Accepte « un de vos … » et « l'un de vos … » (variante d'édition courante).
  return /^(?:inclinez|detruisez) (?:un|l['’ ]?\s?un) (?:autre )?de vos allies/.test(
    norm(text),
  );
}

/**
 * Le texte a-t-il la forme d'un POUVOIR À COÛT DE SACRIFICE « Détruisez [cette
 * carte] : … » ? Reconnaissance LARGE (préfixe « détruisez <X> : ») : sert à
 * router vers `compileTapEffectText` même sans `requiresIncline`. La compilation
 * effective reste STRICTE — `compileTapEffectText` n'accepte le sacrifice que si
 * `subjectIsSelf` (le X est la carte elle-même) ET si le CORPS se compile
 * entièrement via compileBody ; sinon → manuel. On EXCLUT ici le préfixe de
 * coût payé « Détruisez un/l'un de vos … » (routé par isPaidCostText) et la
 * forme « Détruisez un … que vous contrôlez : … » (coût générique non modélisé).
 */
export function isSacrificeCostText(text: string): boolean {
  const n = norm(text);
  if (isPaidCostText(n)) return false;
  // « Détruisez un … que vous contrôlez : … » = coût payé non modélisé → manuel.
  if (/^detruisez .* que vous controlez\s*:/.test(n)) return false;
  return /^detruisez [^:]{1,50}\s*:/.test(n);
}

/**
 * Le texte a-t-il la forme d'un POUVOIR À COÛT D'INCLINAISON DE SOI « Inclinez
 * [cette carte] : … » ? Reconnaissance LARGE (préfixe « inclinez <X> : ») : sert
 * à router vers `compileTapEffectText` même quand `requiresIncline` est absent
 * des données. La compilation effective reste STRICTE — `compileTapEffectText`
 * n'accepte cette forme que si `subjectIsSelf` (le X désigne la carte
 * elle-même : « cette carte », « ce <type> », ou son nom) ET si le CORPS se
 * compile entièrement via compileBody ; sinon → manuel. On EXCLUT ici le coût
 * PAYÉ « Inclinez un/l'un de vos … » (routé par isPaidCostText). Le `:` est
 * REQUIS : « Inclinez l'Allié … de votre choix » (sans « : ») est une CIBLE
 * (corps tapTarget compilé directement), pas un coût d'inclinaison de soi.
 */
export function isInclineCostText(text: string): boolean {
  const n = norm(text);
  if (isPaidCostText(n)) return false;
  return /^inclinez [^:]{1,50}\s*:/.test(n);
}

/**
 * Parse un POUVOIR À COÛT PAYÉ « Inclinez / Détruisez un [autre] de vos X :
 * CORPS » → `{ trigger:"onTap", cost:"paidOps", [actor:"costTarget",] ops:[costOp,
 * ...body] }`, ou null si la forme ne correspond pas / le corps ne compile pas.
 * ACTOR-BINDING : un corps « il/elle … » (créature payée = acteur) est admis sur
 * le COÛT D'INCLINAISON via compileActorBoundBody (`actor:"costTarget"`) ; il est
 * REJETÉ sur un coût-destruction (la créature détruite ne peut pas agir) et pour
 * « sa Force » sans sujet explicite. `text` est DÉJÀ normalisé.
 */
function compileTapPaidCost(
  text: string,
  cardName: string,
  sourceElement: string,
): CompiledEffect | null {
  // (1) verbe de coût ; (2) « autre » ; (3) « allies » / « allies ou heros » ;
  // (4) « ou heros » présent ? ; (5) Famille éventuelle ; (6) « de niveau ≤ N » ;
  // (7) le Niveau ; (8) le CORPS après « : ».
  const m = text.match(
    /^(inclinez|detruisez) (?:un|l['’ ]?\s?un) (autre )?de vos (allies( ou heros)?)( [a-z-]+)?( de niveau inferieur ou egal a (\d+))?\s*:\s*(.+)$/,
  );
  if (!m) return null;
  const heroes = !!m[4];
  const sub = m[5]?.trim();
  // mots de liaison captés par la classe famille → pas une vraie Famille
  if (sub && ["ou", "non", "de", "et", "dans"].includes(sub)) return null;
  // « non Monstre » et autres qualificatifs négatifs : hors champ (rejet).
  if (m[5] && /\bnon\b/.test(m[5])) return null;
  const bodyText = m[8].trim();
  // ACTOR-BINDING : CORPS « il/elle … » — la créature SÉLECTIONNÉE par le coût
  // est l'acteur (sujet du corps). Réservé au COÛT D'INCLINAISON (« Inclinez … »)
  // : la créature inclinée reste EN JEU, donc sa Force est lisible au corps. On
  // REJETTE l'actor-binding sur un coût de DESTRUCTION (la créature détruite ne
  // peut pas agir → infidèle). Le sujet « il/elle » est retiré, le reste compilé
  // par compileActorBoundBody (damageTargetByForce / damageTarget / buffForceSelf).
  // Toute autre forme reste MANUELLE.
  let actor: "costTarget" | undefined;
  let body: EffectOp[] | null;
  const actorBound = bodyText.match(/^(?:il|elle)\s+(.+)$/);
  if (actorBound) {
    if (m[1] !== "inclinez") return null; // pas d'acteur sur un coût-destruction
    body = compileActorBoundBody(actorBound[1], sourceElement);
    if (!body) return null;
    actor = "costTarget";
  } else {
    // « sa Force » hors actor-binding explicite (« Gagnez un bonus égal à sa
    // Force ») : acteur implicite non modélisé → MANUEL.
    if (/\bsa force\b/.test(bodyText)) return null;
    body = compileBody(bodyText, cardName, sourceElement);
    if (!body) return null;
  }
  const costOp: EffectOp =
    m[1] === "inclinez"
      ? {
          op: "costTapControlled",
          ...(heroes ? { heroes: true } : {}),
          ...(sub ? { sub } : {}),
          ...(m[7] ? { maxLevel: toNumber(m[7]) } : {}),
          ...(m[2] ? { excludeSource: true } : {}),
          zones: ["monde", "havreSac"],
        }
      : {
          op: "costDestroyControlled",
          ...(heroes ? { heroes: true } : {}),
          ...(sub ? { sub } : {}),
          ...(m[7] ? { maxLevel: toNumber(m[7]) } : {}),
          ...(m[2] ? { excludeSource: true } : {}),
          zones: ["monde", "havreSac"],
        };
  return {
    trigger: "onTap",
    cost: "paidOps",
    ...(actor ? { actor } : {}),
    ops: [costOp, ...body],
  };
}

/**
 * Le texte a-t-il la forme d'un POUVOIR À COÛT DE RECYCLAGE « Recyclez … :
 * CORPS » ? Reconnaissance LARGE (préfixe « recyclez … : ») : sert à router vers
 * `compileTapEffectText` même sans `requiresIncline`. La compilation effective
 * reste STRICTE (`compileRecyclePaidCost` n'accepte que les trois formes
 * connues — Défausse / main / soi-depuis-le-Monde — avec un CORPS entièrement
 * compilable). Le `:` est REQUIS : « Recyclez une carte, puis piochez … »
 * (recyclage LIBRE, pas un coût — op recycleFromDiscard) n'est PAS capté.
 */
export function isRecycleCostText(text: string): boolean {
  return /^recycle[zr] [^:]{1,60}:/.test(norm(text));
}

/**
 * Parse un POUVOIR À COÛT DE RECYCLAGE « Recyclez … : CORPS » →
 * `{ trigger:"onTap", cost:"paidOps", ops:[costRecycle{...}, ...body] }`, ou null.
 * Trois formes (mirroir de la sémantique de costRecycle.from) :
 *  - « Recyclez une carte de votre Défausse : CORPS » → from:"defausse" ;
 *  - « Recyclez une carte de votre main : CORPS »     → from:"main" ;
 *  - « Recyclez [cette carte / <nom>] depuis le Monde [ou votre Havre-Sac] :
 *    CORPS » → from:"self" (le sujet DOIT être la carte elle-même, subjectIsSelf).
 * Le CORPS se compile ENTIÈREMENT via compileBody (sinon manuel). Un corps
 * actor-binding (« il/elle … ») est REJETÉ (non modélisé sur ce coût). « depuis
 * la Défausse / votre Défausse » avec « X cartes » / « jusqu'à N » / « même
 * nombre » / « élément de la carte recyclée » (valeurs dynamiques) ne correspond
 * pas aux formes ci-dessus → reste MANUEL (SKIP fidèle). `text` déjà normalisé.
 */
function compileRecyclePaidCost(
  text: string,
  cardName: string,
  sourceElement: string,
): CompiledEffect | null {
  let from: "defausse" | "main" | "self" | null = null;
  let bodyText: string | null = null;
  // « Recyclez une carte de votre Défausse : CORPS »
  let m = text.match(/^recyclez une carte de votre defausse\s*:\s*(.+)$/);
  if (m) {
    from = "defausse";
    bodyText = m[1];
  }
  // « Recyclez une carte de votre main : CORPS »
  if (!from) {
    m = text.match(/^recyclez une carte de votre main\s*:\s*(.+)$/);
    if (m) {
      from = "main";
      bodyText = m[1];
    }
  }
  // « Recyclez [cette carte / <nom>] depuis le Monde [ou votre Havre-Sac] : CORPS »
  if (!from) {
    m = text.match(
      /^recyclez (.{1,50}?) depuis le monde(?: ou (?:votre|son) havre[- ]?sac)?\s*:\s*(.+)$/,
    );
    if (m && subjectIsSelfRef(m[1].trim(), cardName)) {
      from = "self";
      bodyText = m[2];
    }
  }
  if (!from || !bodyText) return null;
  // Corps actor-binding (« il/elle … ») non modélisé sur ce coût → manuel.
  if (/^(?:il|elle)\s/.test(bodyText.trim())) return null;
  const body = compileBody(bodyText, cardName, sourceElement);
  if (!body) return null;
  return {
    trigger: "onTap",
    cost: "paidOps",
    ops: [{ op: "costRecycle", from }, ...body],
  };
}

/**
 * Mot-type d'un coût de recyclage (« jusqu'à N MONSTRES / ALLIÉS / cartes ») →
 * filtre `{what?, sub?}`, ou null si le mot n'est ni « cartes » (aucun filtre)
 * ni un type/Famille reconnu. `word` est déjà normalisé et SANS le « s » final.
 */
function recycleTypeFilter(
  word: string,
): { what?: "Allié"; sub?: string } | null {
  if (word === "carte") return {};
  if (word === "allie") return { what: "Allié" };
  if (ALLIED_FAMILIES.has(word)) return { what: "Allié", sub: word };
  return null;
}

/**
 * Parse un CORPS À VALEUR « nombre de cartes recyclées » (lié à un coût « Recyclez
 * JUSQU'À N … »). Le sujet de la magnitude est le NOMBRE de cartes effectivement
 * recyclées (op `fromCount:true`, lu au runtime sur frame.boundCount). STRICT —
 * seules les formes SCALAIRES non ambiguës sont admises (un seul nombre = compte
 * recyclé) :
 *   - « Le Héros de votre choix regagne N PV par carte recyclée » → healHeroTarget
 *     fromCount perCount=N ;
 *   - « Votre Héros regagne X PV » → heroGainPv fromCount (X = compte recyclé) ;
 *   - « Infligez le même nombre de Dommages à l'Allié (ou Héros) de votre choix »
 *     → damageTarget fromCount ;
 *   - « <self> inflige le même nombre de Dommages à l'Allié (ou Héros) de votre
 *     choix » → damageTarget fromCount (sujet = la carte elle-même) ;
 *   - « La Force de l'Allié (ou Héros) de votre choix est augmentée du même nombre
 *     jusqu'à la fin du tour » → buffForceTarget fromCount.
 * SKIP (→ null, manuel) : multi-cible par compte (« le même nombre d'Alliés »),
 * « Force cumulée », création de jetons, etc. `body` est déjà normalisé, sans
 * point final.
 */
function compileRecycleCountBody(
  body: string,
  cardName: string,
  sourceElement: string,
): EffectOp[] | null {
  // « Le Héros de votre choix regagne N PV par carte recyclée » → soin ciblé,
  // magnitude = compte × N.
  let m = body.match(
    /^le heros de votre choix regagne (\d+) (?:pv|points? de vie) par carte recyclee$/,
  );
  if (m)
    return [
      {
        op: "healHeroTarget",
        n: 0,
        fromCount: true,
        ...(toNumber(m[1]) !== 1 ? { perCount: toNumber(m[1]) } : {}),
      },
    ];
  // « Votre Héros regagne X PV » (X = compte recyclé, forme « Recyclez X … : … X PV »).
  m = body.match(/^votre heros regagne x (?:pv|points? de vie)$/);
  if (m) return [{ op: "heroGainPv", n: 0, fromCount: true }];
  // « Infligez le même nombre de Dommages à l'Allié (ou Héros) de votre choix »
  // ou « <self> inflige le même nombre … » → Dommages ciblés = compte recyclé.
  m = body.match(
    /^(?:infligez|(.{1,50}?) inflige) le meme nombre de dommages? a l['’ ]?\s?allie( ou heros)? de votre choix( dans le monde)?( ou dans (?:un|son) havre ?-?sac)?$/,
  );
  if (m) {
    if (m[1] !== undefined && !subjectIsSelf(m[1], cardName)) return null;
    return [
      {
        op: "damageTarget",
        n: 0,
        fromCount: true,
        element: sourceElement,
        heroes: !!m[2],
        zones: targetZones(m[3], m[4]),
      },
    ];
  }
  // « La Force de l'Allié (ou Héros) de votre choix est augmentée du même nombre
  // jusqu'à la fin du tour » → bonus de Force ciblé = compte recyclé.
  m = body.match(
    /^la force de l['’ ]?\s?allie( ou heros)? de votre choix est augmentee du meme nombre jusqu['’]a la fin d[ue] tour$/,
  );
  if (m)
    return [
      {
        op: "buffForceTarget",
        n: 0,
        fromCount: true,
        heroes: !!m[1],
        zones: ["monde", "havreSac"],
      },
    ];
  return null;
}

/**
 * Parse un POUVOIR À COÛT DE RECYCLAGE « JUSQU'À N » À VALEUR DYNAMIQUE « nombre
 * de cartes recyclées » : « Recyclez jusqu'à N [Monstres|Alliés|cartes] de votre
 * Défausse : CORPS » (ou « Recyclez X [Monstres|cartes] … » — X = compte libre).
 * → `{ trigger:"onTap", cost:"paidOps", ops:[costRecycle{from:"defausse", n, max:true,
 * [what,sub]}, ...countBody] }`, ou null. Le coût est OPTIONNEL (0..N, « jusqu'à »)
 * et TOUJOURS payé ; la magnitude du CORPS suit le compte réel (compileRecycleCountBody).
 * SKIP (manuel) toute forme dont le corps n'est pas un scalaire « compte recyclé »
 * non ambigu. `text` déjà normalisé.
 */
function compileRecycleCountCost(
  text: string,
  cardName: string,
  sourceElement: string,
): CompiledEffect | null {
  // (1) quantité : « jusqu'à N » (cap N) OU « X » (compte libre, cap pratique) ;
  // (2) le nombre N (forme « jusqu'à ») ; (3) le mot-type (Monstres/Alliés/cartes).
  const m = text.match(
    /^recyclez (?:jusqu['’]a (une|deux|trois|\d+)|(x)) ([a-zéèêàùûôîç]+?)s? de votre defausse\s*:\s*(.+)$/,
  );
  if (!m) return null;
  const filter = recycleTypeFilter(m[3]);
  if (!filter) return null;
  // « jusqu'à N » → cap = N ; « X » (compte libre) → cap pratique élevé (la pile
  // borne de toute façon ; le joueur peut s'arrêter avant).
  const n = m[1] ? toNumber(m[1]) : 99;
  const bodyText = m[4].replace(/\.$/, "").trim();
  if (/^(?:il|elle)\s/.test(bodyText)) return null; // actor-binding non modélisé
  const body = compileRecycleCountBody(bodyText, cardName, sourceElement);
  if (!body) return null;
  return {
    trigger: "onTap",
    cost: "paidOps",
    ops: [
      {
        op: "costRecycle",
        from: "defausse",
        n,
        max: true,
        ...(filter.what ? { what: filter.what } : {}),
        ...(filter.sub ? { sub: filter.sub } : {}),
      },
      ...body,
    ],
  };
}

/**
 * Effets d'apparition automatisables de cette carte : forme compilée des
 * données si présente, sinon re-parsing strict du texte.
 */
/** Élément d'une carte pour les Dommages de ses effets (410.1). */
export function effectSourceElement(card: Card): string {
  return card.stats?.force?.element ?? card.stats?.niveau?.element ?? "Neutre";
}

/**
 * Effets réellement IMPRIMÉS sur la carte : exclut les notes de règles et
 * erratas du site (`kind`, posé à la compilation des données) et les
 * descriptions vides. C'est le bon dénominateur pour « tous les effets de
 * la carte sont automatisés » (ex. gate de résolution des Actions).
 */
export function printedEffects(card: Card | null): CardEffect[] {
  if (!card) return [];
  const effects = card.effects?.length
    ? card.effects
    : isHeroCard(card)
      ? (card.recto?.effects ?? [])
      : [];
  return effects.filter((e) => String(e?.description ?? "").trim() && !e.kind);
}

/**
 * Effets IMPRIMÉS non automatisés (aucune forme `compiled`) : à résoudre à la
 * main. Même critère que l'audit des starters — un effet « couvert » porte une
 * forme compilée, tout trigger confondu (onArrive/onPlay/onTap/onTurnStart/
 * static/onSelfAttacks). Sert au rappel manuel non bloquant de la table.
 */
export function manualEffects(card: Card | null): CardEffect[] {
  return printedEffects(card).filter((e) => !e.compiled);
}

export function arrivalEffects(card: Card | null): EffectAtom[] {
  if (!card) return [];
  const atoms: EffectAtom[] = [];
  for (const e of card.effects ?? []) {
    if (e?.kind) continue; // note de règle / errata : pas un effet imprimé
    const text = String(e?.description ?? "").trim();
    const compiled =
      e?.compiled ??
      (text && !e?.requiresIncline
        ? compileEffectText(text, card.name, effectSourceElement(card))
        : null);
    if (compiled && compiled.trigger === "onArrive")
      atoms.push({ ...compiled, text });
  }
  return atoms;
}

/**
 * Compile un POUVOIR CONTINU (805 / 812.2) : « Tant que … », « [X] ne peut
 * pas bloquer », « La force de [X] est toujours égale … ». Strict : le texte
 * ENTIER doit correspondre à une forme connue dont le sujet est la carte
 * elle-même, sinon null. Ces effets n'émettent jamais d'événement : ils sont
 * relus à la volée par la couche dérivée (`rules/modifiers.ts`).
 */
export function compileStaticEffectText(
  text: string,
  cardName: string,
): CompiledEffect | null {
  const body = norm(text).replace(/\.$/, "").trim();
  // « La force du Vrombyx est toujours égale au nombre de vos cartes en main. »
  let m = body.match(
    /^la force (?:du |de la |de l['’]\s?|des |de )?(.{1,60}?) est toujours egale au nombre de vos cartes en main$/,
  );
  if (m && subjectIsSelf(m[1], cardName))
    return {
      trigger: "static",
      static: { kind: "forceEqualsHandSize" },
      ops: [],
    };
  // « Tant que [self] est dans le Monde, vos autres Alliés [Famille] [et/ou
  //   Héros] [dans le Monde] gagnent/ont +N en Force. » (805.2). Le `$` impose
  //   que la TOTALITÉ du texte corresponde : une variante avec clause résiduelle
  //   (débuff adverse, condition « tant qu'il bloque », « jusqu'à la fin du
  //   tour »…) ne compile PAS — elle resterait une approximation infidèle.
  //   Sous-groupes : (2) « tous » optionnel ; (3) famille après « Alliés »
  //   (absente = toutes) ; (4) « et/ou Héros » ; (5) variante « vos autres
  //   <Famille> » (la Famille remplace « Alliés ») ; (6) « gagnent » / « ont »
  //   (synonymes) ; (7) la valeur. « ont +N en Force » = « gagnent +N en Force »
  //   (même bonus continu).
  m = body.match(
    /^tant que (.{1,60}?) est dans le monde\s*,\s*(tous )?vos autres (?:allies( [a-z-]+)?( (?:et|ou) heros)?|([a-z-]+))(?: dans le monde)? (?:gagnent|ont) \+(\d+) en force$/,
  );
  if (m && subjectIsSelf(m[1], cardName)) {
    // Famille soit après « Alliés » (m[3]), soit en remplacement (m[5]).
    const famRaw = (m[3] ?? m[5])?.trim();
    // mot de liaison / type capté → pas une Famille de créature non ambiguë.
    if (
      famRaw &&
      !ALLIED_FAMILIES.has(famRaw.replace(/s$/, "")) &&
      // « vos autres Alliés » nu (m[5] absent, m[3] absent) reste licite.
      m[5] !== undefined
    )
      return null;
    if (famRaw && ["et", "ou", "dans"].includes(famRaw)) return null;
    const fam = famRaw ? famRaw.replace(/s$/, "") : undefined;
    return {
      trigger: "static",
      static: {
        kind: "forceAura",
        n: toNumber(m[6]),
        ...(fam ? { sub: fam } : {}),
        ...(m[4] ? { heroes: true } : {}),
      },
      ops: [],
    };
  }
  // AURA DE MOT-CLÉ (805.2) :
  //   « Tant que <self> est dans le Monde, (tous|toutes)? vos [autres]?
  //     (Alliés [Famille] [et/ou Héros] | <Famille>) [dans le Monde]? gagnent
  //     <Mot-clé>. »
  //   → static keywordAura{ keyword, sub?, heroes?, excludeSource? }. Miroir exact
  //   de forceAura (mêmes sous-groupes / règles de Famille) mais octroie un mot-clé
  //   de COMBAT au lieu de Force. STRICT — seuls les mots-clés CÂBLÉS
  //   (GRANTABLE_KEYWORDS : Géant/Agilité/Agressivité/Tacle) sont compilés ;
  //   octroyer un mot-clé inerte (Fantôme, Défense, Renfort…) serait un no-op =
  //   approximation → manuel. Le `$` impose que la TOTALITÉ du texte corresponde
  //   (toute clause résiduelle ou condition « tant qu'il bloque » → manuel).
  //   Sous-groupes : (2) « tous/toutes » optionnel ; (3) « autres » optionnel ;
  //   (4) famille après « Alliés » (absente = toutes) ; (5) « et/ou Héros » ;
  //   (6) variante « vos <Famille> » (la Famille remplace « Alliés ») ; (7) le
  //   mot-clé.
  m = body.match(
    /^tant que (.{1,60}?) est dans le monde\s*,\s*(?:tous |toutes )?vos (autres )?(?:allies( [a-z-]+)?( (?:et|ou) heros)?|([a-z-]+))(?: dans le monde)? gagnent ([a-z]+)$/,
  );
  // « le Porteur de <self> » est un sujet de PORTEUR (l'aura ne vit que tant que
  // le PORTEUR est en jeu — pas l'Équipement seul) → SKIP (manuel, comme costAura).
  // subjectIsSelf accepte « le porteur de X » car la chaîne contient le nom : on
  // l'exclut explicitement ici.
  if (m && !/\bporteur\b/.test(m[1]) && subjectIsSelf(m[1], cardName)) {
    const keyword = GRANTABLE_KEYWORDS[m[6]];
    // Mot-clé inerte / inconnu → no-op = approximation → manuel.
    if (keyword) {
      // Famille soit après « Alliés » (m[3]), soit en remplacement (m[5]).
      const famRaw = (m[3] ?? m[5])?.trim();
      const liaison = famRaw ? ["et", "ou", "dans"].includes(famRaw) : false;
      // mot de liaison / type capté → pas une Famille de créature non ambiguë.
      const badFamily =
        m[5] !== undefined && famRaw
          ? !ALLIED_FAMILIES.has(famRaw.replace(/s$/, ""))
          : false;
      if (!liaison && !badFamily) {
        const fam = famRaw ? famRaw.replace(/s$/, "") : undefined;
        return {
          trigger: "static",
          static: {
            kind: "keywordAura",
            keyword,
            ...(fam ? { sub: fam } : {}),
            ...(m[4] ? { heroes: true } : {}),
            ...(m[2] ? { excludeSource: true } : {}),
          },
          ops: [],
        };
      }
    }
  }
  // « Tant qu'il bloque, le Maître Bolet gagne +2 en Force. »
  m = body.match(
    /^tant qu['’]\s?(?:il|elle) bloque\s*,\s*(.{1,60}?) gagne \+(\d+) en force$/,
  );
  if (m && subjectIsSelf(m[1], cardName))
    return {
      trigger: "static",
      static: { kind: "forceWhileBlocking", n: toNumber(m[2]) },
      ops: [],
    };
  // « Jicé Aouaire ne peut pas bloquer. »
  m = body.match(/^(.{1,60}?) ne peut pas bloquer$/);
  if (m && subjectIsSelf(m[1], cardName))
    return { trigger: "static", static: { kind: "cannotBlock" }, ops: [] };
  // « [self] ne peut ni attaquer, ni bloquer. » (Épouvantail, Aero/Akwa/Pyro/
  //   Terra) — restriction CONTINUE retirant la créature des attaquants ET des
  //   bloqueurs éligibles. Les deux ordres (« ni attaquer, ni bloquer » /
  //   « ni bloquer, ni attaquer ») sont admis. STRICT : la clause doit
  //   constituer TOUT le texte (le `$` rejette les suites conditionnelles).
  m = body.match(
    /^(.{1,60}?) ne peut (?:ni attaquer\s*,?\s*ni bloquer|ni bloquer\s*,?\s*ni attaquer)$/,
  );
  if (m && subjectIsSelf(m[1], cardName))
    return {
      trigger: "static",
      static: { kind: "cannotAttackOrBlock" },
      ops: [],
    };
  // « [self] ne peut pas porter d'Équipement. » (Aero/Akwa/Pyro/Terra) —
  //   restriction CONTINUE : la créature ne peut jamais devenir Porteur.
  m = body.match(/^(.{1,60}?) ne peut pas porter d['’]\s?equipements?$/);
  if (m && subjectIsSelf(m[1], cardName))
    return {
      trigger: "static",
      static: { kind: "cannotCarryEquipment" },
      ops: [],
    };
  // « Tant que Poum Ondacié est attaquant, bloqueur ou cible d'une attaque,
  //   tous les Dommages sur le point de lui être infligés sont réduits de N. »
  m = body.match(
    /^tant que (.{1,60}?) est attaquant\s*,\s*bloqueur ou cible d['’]\s?une attaque\s*,\s*tous les dommages sur le point de lui etre infliges sont reduits de (\d+)$/,
  );
  if (m && subjectIsSelf(m[1], cardName))
    return {
      trigger: "static",
      static: { kind: "combatDamageReduction", n: toNumber(m[2]) },
      ops: [],
    };
  // RÉDUCTION DE COÛT DE SOI gated par la CLASSE du Héros (~12 Dopeuls) :
  //   « Si votre Héros est <Classe>, le coût du/de <self> est réduit de N. »
  //   → static selfCostMod{ n, ifHeroClass }. Lu par planCost UNIQUEMENT pour la
  //   carte elle-même : son coût baisse de N si le Héros du contrôleur est de la
  //   Classe nommée (plancher 0). STRICT : le sujet du coût doit désigner la carte
  //   elle-même (subjectIsSelf — « le coût du Dopeul Sram » sur la carte « Dopeul
  //   Sram ») ; sinon manuel. La Classe (m[1]) est stockée capitalisée comme
  //   heroCard.class (la comparaison runtime passe par normWord). Le `$` rejette
  //   toute clause résiduelle (« … jusqu'à un minimum de 1 », autres conditions).
  m = body.match(
    /^si votre heros est ([a-zâäàéèêëïîôöûü-]+)\s*,\s*le cout (?:du |de la |de l['’]\s?|des |de )(.{1,60}?) est reduit de (\d+)$/,
  );
  if (m && subjectIsSelf(m[2], cardName))
    return {
      trigger: "static",
      static: {
        kind: "selfCostMod",
        n: toNumber(m[3]),
        // Classe capitalisée (1re lettre) — heroCard.class l'est aussi.
        ifHeroClass: m[1].charAt(0).toUpperCase() + m[1].slice(1),
      },
      ops: [],
    };
  // AURA DE RÉDUCTION DE COÛT (805.2) :
  //   « Tant que <self> est dans le Monde, le coût de vos <scope> est réduit de N. »
  //   → static costAura{ n, scope }. Tant que la SOURCE est en jeu, le coût des
  //   cartes du contrôleur correspondant au scope baisse de N (plancher 0, planCost).
  //   STRICT — seuls trois scopes fidèlement calculables sont compilés :
  //     - « vos Alliés <Famille> » → family (Famille validée ALLIED_FAMILIES) ;
  //     - « vos Alliés » / « vos Actions » → type (mainType) ;
  //     - « vos cartes Uniques » → unique (trait Unique).
  //   Les autres (« Capture de vos Dragodindes », « vos Invocations », « réduit
  //   à 0 », « jusqu'à un minimum de 1 »…) ne matchent pas → manuel. Le `$` final
  //   rejette toute clause de plancher / scope non modélisé.
  m = body.match(
    /^tant que (.{1,60}?) est dans le monde\s*,\s*le cout de vos (allies( [a-z-]+)?|actions|cartes uniques) est reduit de (\d+)$/,
  );
  // « le Porteur de <self> » est un sujet de PORTEUR (l'aura ne vit que tant que
  // le PORTEUR est en jeu — pas l'Équipement seul) → SKIP (bearer cost-mod manuel,
  // « an approximation … is worse … »). subjectIsSelf accepte « le porteur de X »
  // car la chaîne contient le nom : on l'exclut explicitement ici.
  if (m && !/\bporteur\b/.test(m[1]) && subjectIsSelf(m[1], cardName)) {
    const scopeRaw = m[2];
    const n = toNumber(m[4]);
    let scope:
      | { kind: "family"; sub: string }
      | { kind: "type"; mainType: "Allié" | "Action" }
      | { kind: "unique" }
      | null = null;
    if (scopeRaw === "actions") scope = { kind: "type", mainType: "Action" };
    else if (scopeRaw === "cartes uniques") scope = { kind: "unique" };
    else if (scopeRaw === "allies") scope = { kind: "type", mainType: "Allié" };
    else {
      // « allies <famille> » : la Famille (m[3]) doit être non ambiguë.
      const fam = m[3]?.trim().replace(/s$/, "");
      if (fam && ALLIED_FAMILIES.has(fam)) scope = { kind: "family", sub: fam };
    }
    if (scope)
      return {
        trigger: "static",
        static: { kind: "costAura", n, scope },
        ops: [],
      };
  }
  return null;
}

/**
 * Compile un BONUS DE PORTEUR (305.x) : pouvoir CONTINU d'une carte PORTÉE
 * (Équipement ou Monture) qui s'applique à son Porteur tant qu'elle est en jeu.
 * Texte « Le Porteur de <self> gagne +N en Force[.] », « … gagne Résistance N
 * (Élément)[(Élément)…][.] » (mono- ou multi-éléments) ou « … gagne <Mot-clé>[.] »
 * (Géant, Tacle, Agilité, Portée, Critique, Parade — un seul mot-clé).
 *
 * STRICT (« an approximation of gameplay is worse than a manual effect ») :
 *  - le sujet « Le Porteur de X » doit désigner la carte elle-même (X = son nom) ;
 *  - le bonus doit être CONTINU : la clause « jusqu'à la fin du tour / du combat »
 *    décrit une autre durée (buff temporaire, pas un bonus de Porteur porté) →
 *    PAS compilé ici (resterait infidèle) ;
 *  - la TOTALITÉ du texte doit correspondre (le `$` rejette « … et <icône> »,
 *    « … et ne peut pas être choisi … », bonus composés → manuel). Les très
 *    nombreux « gagne . » (icône perdue au scrape) ne matchent rien → manuel.
 *
 * N peut être NÉGATIF (« gagne -N en Force » / « gagne -N en Force ») : un malus
 * de Porteur est un bonus de Force signé.
 */
export function compileBearerBonusText(
  text: string,
  cardName: string,
): CompiledEffect | null {
  const body = norm(text).replace(/\.$/, "").trim();
  // « Le Porteur de/du/des/d' <self> gagne +N / -N en Force »
  let m = body.match(
    /^le porteur (?:de |du |des |de la |de l['’]\s?|d['’]\s?)?(.{1,60}?) gagne ([+-]?\d+) en force$/,
  );
  if (m && subjectIsSelf(m[1], cardName))
    return {
      trigger: "static",
      static: { kind: "bearerBonus", force: toNumber(m[2]) },
      ops: [],
    };
  // « Le Porteur de <self> gagne Résistance N (Élément)[(Élément)…] » —
  // prévention continue par Élément, possiblement MULTI-ÉLÉMENTS (Croum :
  // « Résistance 1 (air)(eau)(terre)(feu) »). Chaque Élément (capitalisé comme
  // les autres Éléments des données) est stocké tel quel ; la lecture
  // (effectiveKeywords) les normalise.
  m = body.match(
    /^le porteur (?:de |du |des |de la |de l['’]\s?|d['’]\s?)?(.{1,60}?) gagne resistance (\d+) ((?:\((?:feu|eau|terre|air|neutre)\))+)$/,
  );
  if (m && subjectIsSelf(m[1], cardName)) {
    const els = [...m[3].matchAll(/\((feu|eau|terre|air|neutre)\)/g)].map(
      (g) => g[1].charAt(0).toUpperCase() + g[1].slice(1),
    );
    return {
      trigger: "static",
      static: {
        kind: "bearerBonus",
        resistance: {
          element: els.length === 1 ? els[0] : els,
          n: toNumber(m[2]),
        },
      },
      ops: [],
    };
  }
  // « Le Porteur de <self> gagne <Mot-clé>. » — mot-clé conféré au Porteur
  // (Géant, Tacle, Agilité, Portée, Critique, Parade). STRICT : un SEUL mot-clé,
  // tout le corps consommé (le `$` rejette les bonus composés « … et … » et les
  // « gagne . » à icône perdue). Géant alimente le combat ; les autres sont
  // enregistrés fidèlement (même niveau qu'imprimés).
  m = body.match(
    /^le porteur (?:de |du |des |de la |de l['’]\s?|d['’]\s?)?(.{1,60}?) gagne (geant|tacle|agilite|portee|critique|parade)$/,
  );
  if (m && subjectIsSelf(m[1], cardName)) {
    const keyword = BEARER_KEYWORDS[m[2]];
    if (keyword)
      return {
        trigger: "static",
        static: { kind: "bearerBonus", keyword },
        ops: [],
      };
  }
  return null;
}

/** Mot-clé conféré normalisé (norm()) → forme canonique de `CardKeyword`. */
const BEARER_KEYWORDS: Record<string, CardKeyword> = {
  geant: "Géant",
  tacle: "Tacle",
  agilite: "Agilité",
  portee: "Portée",
  critique: "Critique",
  parade: "Parade",
};

/**
 * Compile un DÉCLENCHÉ DE COMBAT « Quand [self] attaque, CORPS » (804.5).
 * STRICT : le sujet du déclencheur doit être la carte elle-même.
 *
 * Deux voies, dans cet ordre :
 *
 *  (1) FORME FIXE de durée COMBAT — « …, il gagne +N en Force et +N PM
 *      [et Géant] jusqu'à la fin du COMBAT » (Bruss Ouilis). Modélisée par
 *      `combatModSelf` : ses jetons (`forceCombatMod`/`pmCombatMod`/
 *      `geantCombatMod`) sont purgés à la FIN DU COMBAT. C'est le SEUL op qui
 *      capture fidèlement la durée « combat » d'un bonus de Force, d'où sa
 *      priorité — un même bonus routé vers `buffForceSelf` (durée TOUR) serait
 *      infidèle.
 *
 *  (2) CORPS ACTOR-BOUND GÉNÉRALISÉ « …, il/elle BODY » où BODY se compile via
 *      `compileActorBoundBody` (SELF = acteur). Le bus (`attackerFrames` →
 *      `enqueueTriggered`) enfile la frame avec `sourceId = attaquant` et
 *      `seat = contrôleur` : self est donc déjà l'acteur des ops
 *      `damageTarget`/`damageTargetByForce`/`buffForceSelf`. Formes admises :
 *        - « il/elle inflige N Dommages à l'Allié (ou Héros) de votre choix … »
 *          (Klara Vane) → damageTarget ;
 *        - « il/elle inflige sa Force en Dommages à … » → damageTargetByForce ;
 *        - « il/elle gagne +N en Force jusqu'à la fin du TOUR » (Barak Oktel)
 *          → buffForceSelf (durée TOUR — distincte de la voie (1)).
 *
 * DURÉE — distinction critique (« an approximation of gameplay is worse than a
 * manual effect ») : « jusqu'à la fin du combat » ⇒ combatModSelf (voie 1),
 * « jusqu'à la fin du tour » ⇒ buffForceSelf (voie 2). Un bonus de Force sans
 * durée (ou de durée non reconnue) n'est PAS compilé par compileActorBoundBody
 * → il reste manuel. Toute autre forme (conditionnelle « si … », valeur
 * dynamique « égal à … », référence à la cible du combat…) → null (manuel).
 */
export function compileCombatTriggerText(
  text: string,
  cardName: string,
  sourceElement = "Neutre",
): CompiledEffect | null {
  const body = norm(text).replace(/\.$/, "").trim();
  // (1) Forme fixe de durée COMBAT (combatModSelf) — priorité absolue.
  const fixed = body.match(
    /^quand (.{1,60}?) attaque\s*,\s*(?:il|elle) gagne \+(\d+) en force\s*(?:,\s*|\s+et\s+)\+(\d+) pm( et geant)? jusqu['’]a la fin du combat$/,
  );
  if (fixed && subjectIsSelf(fixed[1], cardName))
    return {
      trigger: "onSelfAttacks",
      ops: [
        {
          op: "combatModSelf",
          force: toNumber(fixed[2]),
          pm: toNumber(fixed[3]),
          ...(fixed[4] ? { geant: true } : {}),
        },
      ],
    };
  // (2) CORPS ACTOR-BOUND généralisé « il/elle BODY » (SELF = acteur via le bus).
  const m = body.match(/^quand (.{1,60}?) attaque\s*,\s*(?:il|elle)\s+(.+)$/);
  if (!m || !subjectIsSelf(m[1], cardName)) return null;
  const ops = compileActorBoundBody(m[2], sourceElement);
  if (!ops) return null;
  return { trigger: "onSelfAttacks", ops };
}

/**
 * Effets « Quand [self] attaque » d'une carte (face courante pour un
 * Héros) : forme compilée des données si présente, sinon re-parsing strict
 * du texte. Consommé par le bus (`collectTriggeredEffects`) et par
 * `attackPmBonus` (ruling Bruss : PM compté AVANT la légalité).
 */
export function selfAttackEffects(
  card: Card | null,
  side: "recto" | "verso" = "recto",
): EffectAtom[] {
  if (!card) return [];
  const face = isHeroCard(card)
    ? side === "verso"
      ? (card.verso ?? card.recto)
      : card.recto
    : null;
  const effects: CardEffect[] = (face ? face.effects : card.effects) ?? [];
  const atoms: EffectAtom[] = [];
  for (const e of effects) {
    if (e?.kind) continue; // note de règle / errata : pas un effet imprimé
    const text = String(e?.description ?? "").trim();
    const compiled =
      e?.compiled ??
      (text && !e?.requiresIncline
        ? compileCombatTriggerText(text, card.name, effectSourceElement(card))
        : null);
    if (compiled && compiled.trigger === "onSelfAttacks")
      atoms.push({ ...compiled, text });
  }
  return atoms;
}

/**
 * Compile un DÉCLENCHÉ D'APPARITION NON-SOI (804) : « Quand / Chaque fois
 * qu'un Allié [Famille]? [adverse]? apparaît [dans le Monde], CORPS. » où le
 * CORPS a pour sujet le contrôleur de la carte qui VEILLE (ops génériques :
 * piochez, gagnez X XP, le Héros adverse perd…). Le texte décrit la carte qui
 * APPARAÎT (mainType/Famille/contrôleur), distinct de la carte source.
 *
 * ACTOR-BINDING : un CORPS « il/elle … » prend pour sujet l'Allié APPARU (pas le
 * veilleur). On compile les formes sûres (compileActorBoundBody) en posant
 * `actor:"appeared"` ; le moteur enfile alors la frame avec sourceId = instance
 * apparue, seat = contrôleur du veilleur (le « de votre choix » lui appartient).
 *
 * STRICT et NARROW (« an approximation of gameplay is worse than a manual
 * effect ») : on REJETTE (→ manuel) toute forme flottante ou non mappée :
 *  - préfixe « Jusqu'à la fin du tour, chaque fois qu'un … » (déclencheur
 *    flottant temporaire) ;
 *  - CORPS « il/elle … » hors des formes de compileActorBoundBody ;
 *  - toute clause de condition/coût/porteur résiduelle (le CORPS générique doit
 *    se compiler ENTIÈREMENT via compileBody avec le veilleur comme acteur).
 */
export function compileAppearanceTriggerText(
  text: string,
  cardName: string,
  sourceElement = "Neutre",
): CompiledEffect | null {
  const n = norm(text);
  // « Jusqu'à la fin du tour, chaque fois qu'un … » : déclencheur flottant —
  // HORS champ de cette tranche (rejet explicite avant tout le reste).
  if (/^jusqu['’]a la fin du tour\s*,/.test(n)) return null;
  // (1) Quand/Chaque fois qu'un Allié [Famille]? [adverse]? apparaît [dans le
  //     Monde], CORPS.  La Famille et « adverse » sont mutuellement exclusifs
  //     ici (un Allié adverse n'a pas de Famille capturée). « sous votre
  //     contrôle » → contrôleur self.
  // Même généralisation locative que compileEffectText (APPEAR_LOC) : une phrase
  // de lieu / provenance optionnelle (« apparaît dans le Monde, … », « apparaît
  // depuis votre Défausse, … ») peut s'intercaler avant la virgule sans changer
  // le déclencheur. « sous votre contrôle » reste admis (il identifie le
  // contrôleur self ; non modélisé en watch — les corps de ces cartes sont des
  // choix-joueur hors champ, comportement inchangé).
  // Sujet : « un Allié [Famille]? [adverse]? » OU « un <Famille> » nu (« un
  // Bwork apparaît »). Le premier mot (m[1]) est soit « allie », soit une Famille
  // de créature non ambiguë (ALLIED_FAMILIES) — dans ce dernier cas le sujet est
  // un Allié de cette Famille (même convention que pickType : « un Monstre » =
  // Allié + sub). m[2]/m[3] (« adverse » / Famille après « allie ») ne s'appliquent
  // qu'au sujet « allie ».
  const m = n.match(
    new RegExp(
      "^(?:quand |chaque fois qu['’]\\s?)un ([a-zéèêàùûôîç-]+)(?:( adverse)|( [a-z-]+))? apparait" +
        "(?:" +
        APPEAR_LOC +
        "| sous votre controle)?\\s*,\\s*(.+)$",
    ),
  );
  if (!m) return null;
  const head = m[1];
  // Sujet Famille nu (« un Bwork ») : aucun qualificatif (adverse/famille) après
  // — sinon la forme est inattendue → rejet. Le mot doit être une Famille connue.
  const headFamily =
    head !== "allie"
      ? ALLIED_FAMILIES.has(head.replace(/s$/, ""))
        ? head.replace(/s$/, "")
        : null
      : null;
  if (head !== "allie" && (!headFamily || m[2] || m[3])) return null;
  const sub = headFamily ?? m[3]?.trim();
  // mot de liaison capté par la classe famille → pas une vraie Famille
  if (sub && ["adverse", "non", "ou", "de", "et", "sous"].includes(sub))
    return null;
  const watch: NonNullable<CompiledEffect["watch"]> = {
    mainType: "Allié",
    ...(sub ? { sub: sub.replace(/s$/, "") } : {}),
    ...(m[2] ? { controller: "opponent" as const } : {}),
  };
  let body = m[4].replace(/\.$/, "").trim();
  // ACTOR-BINDING : CORPS « il/elle … » — l'Allié APPARU est l'acteur (sujet du
  // corps). STRICT : seules les formes de compileActorBoundBody sont admises
  // (« inflige sa Force… », « inflige N Dommages… », « gagne +N en Force… ») ;
  // à la résolution le moteur fournit comme sourceId l'instance apparue. Toute
  // autre forme « il/elle … » reste MANUELLE. Les optionnels (« vous pouvez »)
  // sur un corps actor-bound ne sont pas modélisés → non captés ici.
  const actorBound = body.match(/^(?:il|elle)\s+(.+)$/);
  if (actorBound) {
    const ops = compileActorBoundBody(actorBound[1], sourceElement);
    if (!ops) return null;
    return { trigger: "onOtherAppears", watch, actor: "appeared", ops };
  }
  // CORPS générique (sujet = contrôleur du veilleur). « vous pouvez … » →
  // optionnel (une seule phrase, sinon ambigu).
  let optional = false;
  const opt = body.match(/^vous pouvez (.+)$/);
  if (opt) {
    optional = true;
    body = opt[1];
  }
  if (optional && /\.\s+\S/.test(body)) return null;
  const ops = compileBody(body, cardName, sourceElement);
  if (!ops) return null;
  return {
    trigger: "onOtherAppears",
    watch,
    ...(optional ? { optional } : {}),
    ops,
  };
}

/**
 * Déclenchés d'apparition non-soi (« Quand un Allié … apparaît ») d'une carte :
 * forme compilée des données si présente, sinon re-parsing strict du texte.
 * Consommé par le moteur (queueArrivalEffects) lors de l'apparition d'une AUTRE
 * carte qui correspond au `watch`. Pendant de `selfAttackEffects`.
 */
export function appearanceTriggerEffects(
  card: Card | null,
  side: "recto" | "verso" = "recto",
): EffectAtom[] {
  if (!card) return [];
  const face = isHeroCard(card)
    ? side === "verso"
      ? (card.verso ?? card.recto)
      : card.recto
    : null;
  const effects: CardEffect[] = (face ? face.effects : card.effects) ?? [];
  const atoms: EffectAtom[] = [];
  for (const e of effects) {
    if (e?.kind) continue; // note de règle / errata : pas un effet imprimé
    const text = String(e?.description ?? "").trim();
    const compiled =
      e?.compiled ??
      (text && !e?.requiresIncline
        ? compileAppearanceTriggerText(
            text,
            card.name,
            effectSourceElement(card),
          )
        : null);
    if (compiled && compiled.trigger === "onOtherAppears")
      atoms.push({ ...compiled, text });
  }
  return atoms;
}

/**
 * Compile l'effet d'une carte ACTION : pas de préfixe, le texte est ce qui
 * se résout quand la carte est jouée (302.1). Strict comme le reste.
 */
export function compileActionEffectText(
  text: string,
  cardName: string,
  sourceElement = "Neutre",
): CompiledEffect | null {
  const ops = compileBody(norm(text), cardName, sourceElement);
  if (!ops) return null;
  return { trigger: "onPlay", ops };
}

/**
 * Compile un effet « Au début de votre tour, … » (602). Deux formes :
 * directe (ops), ou coût d'entretien « X ou détruisez [cette carte] » —
 * refuser X détruit la source (`orElse`). « Vous pouvez X » → optionnel.
 */
export function compileTurnStartEffectText(
  text: string,
  cardName: string,
  sourceElement = "Neutre",
): CompiledEffect | null {
  const m = norm(text).match(/^au debut de votre tour\s*,\s*(.+)$/);
  if (!m) return null;
  let body = m[1].replace(/\.$/, "").trim();
  // CONDITIONNEL « Au début de votre tour, si <cond>, <CORPS>. » → un op
  // `conditional` enveloppant le CORPS compilé. STRICT : la condition doit être
  // FAITHFULLY évaluable (parseCond) ET le CORPS doit se compiler ENTIÈREMENT.
  // « Vous pouvez … » DANS le corps conditionnel n'est pas modélisé (optionnel
  // imbriqué dans un conditionnel → ambigu) → manuel. « ou détruisez [cette
  // carte] » résiduel idem (rejeté par le `$` de compileBody du corps).
  const condM = body.match(/^si ([^,]{1,80}?)\s*,\s*(.+)$/);
  if (condM) {
    const cond = parseCond(condM[1], cardName);
    if (!cond) return null;
    const inner = condM[2].replace(/\.$/, "").trim();
    if (/^vous pouvez /.test(inner)) return null;
    const innerOps = compileBody(inner, cardName, sourceElement);
    if (!innerOps) return null;
    return {
      trigger: "onTurnStart",
      ops: [{ op: "conditional", cond, ops: innerOps }],
    };
  }
  let orElse: "destroySelf" | undefined;
  const alt = body.match(/^(.+?) ou detruisez (.+)$/);
  if (alt && subjectIsSelf(alt[2].trim(), cardName)) {
    orElse = "destroySelf";
    body = alt[1].trim();
  }
  let optional = false;
  const opt = body.match(/^vous pouvez (.+)$/);
  if (opt) {
    optional = true;
    body = opt[1];
  }
  if (optional && /\.\s+\S/.test(body)) return null;
  const ops = compileBody(body, cardName, sourceElement);
  if (!ops) return null;
  return {
    trigger: "onTurnStart",
    ...(optional ? { optional } : {}),
    ...(orElse ? { orElse } : {}),
    ops,
  };
}

/** Effets « Au début de votre tour » de cette carte (trigger onTurnStart). */
export function turnStartEffects(card: Card | null): EffectAtom[] {
  if (!card) return [];
  const atoms: EffectAtom[] = [];
  for (const e of card.effects ?? []) {
    if (e?.kind) continue; // note de règle / errata : pas un effet imprimé
    const text = String(e?.description ?? "").trim();
    const compiled =
      e?.compiled ??
      (text && !e?.requiresIncline
        ? compileTurnStartEffectText(text, card.name, effectSourceElement(card))
        : null);
    if (compiled && compiled.trigger === "onTurnStart")
      atoms.push({ ...compiled, text });
  }
  return atoms;
}

/** Effets de résolution d'une carte Action (trigger onPlay). */
export function playEffects(card: Card | null): EffectAtom[] {
  if (!card || card.mainType !== "Action") return [];
  const atoms: EffectAtom[] = [];
  for (const e of card.effects ?? []) {
    if (e?.kind) continue; // note de règle / errata : pas un effet imprimé
    const text = String(e?.description ?? "").trim();
    // Repli (données non migrées / tests) : un coût de RECYCLAGE sur une Action
    // (Parchemins) se compile en "onPlay" via compileTapEffectText(asAction=true) ;
    // sinon résolution d'Action standard. `requiresIncline` n'a pas de sens sur une
    // Action — on ne re-parse pas dans ce cas (cohérent avec l'historique).
    const compiled =
      e?.compiled ??
      (text && !e?.requiresIncline
        ? isRecycleCostText(text)
          ? compileTapEffectText(
              text,
              card.name,
              effectSourceElement(card),
              true,
            )
          : compileActionEffectText(text, card.name, effectSourceElement(card))
        : null);
    if (compiled && compiled.trigger === "onPlay")
      atoms.push({ ...compiled, text });
  }
  return atoms;
}

/** Pouvoirs à inclinaison automatisables de cette carte (trigger onTap). */
export function tapPowers(card: Card | null): EffectAtom[] {
  if (!card) return [];
  const atoms: EffectAtom[] = [];
  for (const e of card.effects ?? []) {
    if (e?.kind) continue; // note de règle / errata : pas un effet imprimé
    const text = String(e?.description ?? "").trim();
    // Repli (données non migrées / tests) : un pouvoir à coût d'inclinaison
    // (`requiresIncline`), un POUVOIR À COÛT PAYÉ « Inclinez/Détruisez un de
    // vos X : … » (isPaidCostText), un POUVOIR À COÛT D'INCLINAISON DE SOI
    // « Inclinez [cette carte] : … » (isInclineCostText) OU un POUVOIR À COÛT DE
    // SACRIFICE « Détruisez [cette carte] : … » (isSacrificeCostText), même sans
    // `requiresIncline`. On NE re-parse PAS tout texte arbitraire en onTap.
    const compiled =
      e?.compiled ??
      (text &&
      (e?.requiresIncline ||
        isPaidCostText(text) ||
        isInclineCostText(text) ||
        isSacrificeCostText(text) ||
        isRecycleCostText(text))
        ? compileTapEffectText(text, card.name, effectSourceElement(card))
        : null);
    if (compiled && compiled.trigger === "onTap")
      atoms.push({ ...compiled, text });
  }
  return atoms;
}
