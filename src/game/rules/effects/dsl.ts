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
  CompiledEffect,
  CompiledEffectOp,
} from "@/types/cards";
import { isHeroCard } from "@/types/cards";

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

const TARGET_WHAT: Record<string, "Allié" | "Zone" | "Équipement"> = {
  "l allie": "Allié",
  "l'allie": "Allié",
  "la zone": "Zone",
  "l equipement": "Équipement",
  "l'equipement": "Équipement",
};

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
  m = sentence.match(
    /^defaussez[- ]vous d['’ ]?\s?(une|deux|trois|\d+) cartes?(?: de votre main)?$/,
  );
  if (m) return { op: "discardFromHand", n: toNumber(m[1]) };
  // « Cherchez un [type] [Famille] [de Niveau ≤ N] dans votre Pioche,
  // révélez-le et prenez-le en main » ou « … et mettez-le en jeu »
  // (le mélange arrive en op suivante).
  m = sentence.match(
    /^cherchez (?:un|une) (dofus|action|equipement|zone|salle|allie)( [a-z]+)?( de niveau inferieur ou egal a (\d+))? dans votre pioche,? (?:revelez-l[ea] et prenez-l[ea] en main|et mettez-l[ea] en jeu)$/,
  );
  if (m) {
    const WHAT: Record<
      string,
      "Dofus" | "Action" | "Équipement" | "Zone" | "Salle" | "Allié"
    > = {
      dofus: "Dofus",
      action: "Action",
      equipement: "Équipement",
      zone: "Zone",
      salle: "Salle",
      allie: "Allié",
    };
    const sub = m[2]?.trim();
    // mots de liaison = pas une famille (« ou non Unique », « portant… »)
    if (sub && ["ou", "non", "portant", "de", "et"].includes(sub)) return null;
    return {
      op: "searchDeck",
      what: WHAT[m[1]],
      ...(sub ? { sub } : {}),
      ...(m[4] ? { maxLevel: toNumber(m[4]) } : {}),
      dest: sentence.includes("en jeu") ? "monde" : "main",
    };
  }
  m = sentence.match(/^melangez(?:[- ]la)? votre pioche$/);
  if (m) return { op: "shuffleDeck" };
  m = sentence.match(/^votre heros regagne (\d+) (?:pv|points? de vie)$/);
  if (m) return { op: "heroGainPv", n: toNumber(m[1]) };
  m = sentence.match(
    /^le heros de votre choix regagne (\d+) (?:pv|points? de vie)$/,
  );
  if (m) return { op: "healHeroTarget", n: toNumber(m[1]) };
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
  m = sentence.match(
    /^detrui(?:sez|re) (l['’ ]?\s?allie|la zone|l['’ ]?\s?equipement) de votre choix( dans le monde)?( ou dans un havre ?-?sac)?$/,
  );
  if (m) {
    const what = TARGET_WHAT[m[1].replace(/['’]/g, "'").replace(/\s+/g, " ")];
    if (!what) return null;
    const zones: ("monde" | "havreSac")[] = m[3]
      ? ["monde", "havreSac"]
      : ["monde"];
    return { op: "destroyTarget", what, zones };
  }
  // « Infligez N Dommages à l'Allié de votre choix » (impératif) ou
  // « [La carte] inflige N Dommages à l'Allié ou Héros de votre choix … »
  m = sentence.match(
    /^(?:inflige[zr]|(.{1,50}?) inflige) (\d+) dommages? a l['’ ]?\s?allie( ou heros)? de votre choix( dans le monde)?( ou dans (?:un|son) havre ?-?sac)?$/,
  );
  if (m) {
    if (m[1] !== undefined && !subjectIsSelf(m[1], cardName)) return null;
    return {
      op: "damageTarget",
      n: toNumber(m[2]),
      element: sourceElement,
      heroes: !!m[3],
      zones: targetZones(m[4], m[5]),
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
  for (const s of sentences) {
    if (s === "il apparait incline") {
      // se rapporte à la dernière recherche-mise-en-jeu (le mélange peut
      // s'être intercalé : « …mettez-le en jeu, puis mélangez… »)
      const search = [...ops]
        .reverse()
        .find(
          (o): o is Extract<EffectOp, { op: "searchDeck" }> =>
            o.op === "searchDeck",
        );
      if (search && search.dest === "monde") {
        search.tapped = true;
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

/** Le sujet du déclencheur désigne-t-il la carte elle-même ? */
function subjectIsSelf(subject: string, cardName: string): boolean {
  const s = subject.replace(/^(le |la |les |l['’]\s?|un |une )/, "").trim();
  const n = norm(cardName);
  return n.includes(s) || s.includes(n);
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
  const m = norm(text).match(
    /^(?:quand|lorsque) (.{1,60}?) apparait\s*,\s*(.+)$/,
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
): CompiledEffect | null {
  let body = norm(text);
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
    const compiled =
      e?.compiled ??
      (text && !e?.requiresIncline
        ? compileActionEffectText(text, card.name, effectSourceElement(card))
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
    const compiled =
      e?.compiled ??
      (text && e?.requiresIncline
        ? compileTapEffectText(text, card.name, effectSourceElement(card))
        : null);
    if (compiled && compiled.trigger === "onTap")
      atoms.push({ ...compiled, text });
  }
  return atoms;
}
