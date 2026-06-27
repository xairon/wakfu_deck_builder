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

const TARGET_WHAT: Record<string, "Allié" | "Zone" | "Équipement" | "Dofus"> = {
  "l allie": "Allié",
  "l'allie": "Allié",
  "la zone": "Zone",
  "l equipement": "Équipement",
  "l'equipement": "Équipement",
  "le dofus": "Dofus",
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
  // « Mettez en jeu [gratuitement] un(e) [Allié|Zone|Salle|Équipement]
  //   [Famille]? [de votre choix]? [de Niveau ≤ N]? [gratuitement] de/depuis
  //   votre (main|défausse) [dans le Monde]. » → putInPlay (pick d'une carte
  //   existante de la main/Défausse, mise en Monde). « gratuitement » = sans
  //   coût (la mise en jeu par effet est déjà gratuite — pas de clause
  //   résiduelle). Le `$` final REJETTE toute condition/cible-porteur résiduelle
  //   (« … sur l'Allié … », « … et placez-le … ») → ces formes restent
  //   manuelles. La CRÉATION de jeton (« Mettez en jeu un jeton … », « Invoquez
  //   … ») ne correspond pas (pas de mot-type Allié/Zone/Salle/Équipement nu).
  m = sentence.match(
    /^mett(?:ez|re) en jeu (?:gratuitement )?(?:un |une |l['’ ]?\s?|le |la )(allie|zone|salle|equipement)( [a-z-]+)?( de votre choix)?( de niveau inferieur ou egal a (\d+))?(?: gratuitement)? (?:de|depuis) votre (main|defausse)( dans le monde)?$/,
  );
  if (m) {
    const PUT_WHAT: Record<string, "Allié" | "Zone" | "Salle" | "Équipement"> =
      {
        allie: "Allié",
        zone: "Zone",
        salle: "Salle",
        equipement: "Équipement",
      };
    const sub = m[2]?.trim();
    // mots de liaison captés par la classe famille → pas une vraie Famille
    if (sub && ["ou", "non", "de", "et", "gratuitement"].includes(sub))
      return null;
    return {
      op: "putInPlay",
      from: m[6] === "main" ? "main" : "defausse",
      what: PUT_WHAT[m[1]],
      ...(sub ? { sub } : {}),
      ...(m[5] ? { maxLevel: toNumber(m[5]) } : {}),
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
  const normalized = norm(text);
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
  let body = normalized;
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
  //   Héros] [dans le Monde] gagnent +N en Force. » (805.2). Le `$` impose que
  //   la TOTALITÉ du texte corresponde : une variante avec clause résiduelle
  //   (débuff adverse, condition « tant qu'il bloque », « jusqu'à la fin du
  //   tour »…) ne compile PAS — elle resterait une approximation infidèle.
  //   Sous-groupes : (2) « tous » optionnel ; (3) famille (absente = toutes) ;
  //   (4) « et/ou Héros » ; (N) la valeur.
  m = body.match(
    /^tant que (.{1,60}?) est dans le monde\s*,\s*(tous )?vos autres allies( [a-z-]+)?( (?:et|ou) heros)?(?: dans le monde)? gagnent \+(\d+) en force$/,
  );
  if (m && subjectIsSelf(m[1], cardName)) {
    const fam = m[3]?.trim();
    // mot de liaison capté par la classe famille → pas une Famille réelle :
    // sans « et/ou Héros » explicite, « et »/« ou » seul ne doit pas matcher.
    if (fam && ["et", "ou", "dans"].includes(fam)) return null;
    return {
      trigger: "static",
      static: {
        kind: "forceAura",
        n: toNumber(m[5]),
        ...(fam ? { sub: fam.replace(/s$/, "") } : {}), // famille au singulier
        ...(m[4] ? { heroes: true } : {}),
      },
      ops: [],
    };
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
  return null;
}

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
  const m = n.match(
    /^(?:quand |chaque fois qu['’]\s?)un allie(?:( adverse)|( [a-z-]+))? apparait(?: dans le monde| sous votre controle)?\s*,\s*(.+)$/,
  );
  if (!m) return null;
  const sub = m[2]?.trim();
  // mot de liaison capté par la classe famille → pas une vraie Famille
  if (sub && ["adverse", "non", "ou", "de", "et", "sous"].includes(sub))
    return null;
  const watch: NonNullable<CompiledEffect["watch"]> = {
    mainType: "Allié",
    ...(sub ? { sub: sub.replace(/s$/, "") } : {}),
    ...(m[1] ? { controller: "opponent" as const } : {}),
  };
  let body = m[3].replace(/\.$/, "").trim();
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
    // Repli (données non migrées / tests) : un pouvoir à coût d'inclinaison
    // (`requiresIncline`) OU un POUVOIR À COÛT PAYÉ « Inclinez/Détruisez un de
    // vos X : … » (reconnu à sa grammaire propre via isPaidCostText, même sans
    // `requiresIncline`). On NE re-parse PAS tout texte arbitraire en onTap.
    const compiled =
      e?.compiled ??
      (text && (e?.requiresIncline || isPaidCostText(text))
        ? compileTapEffectText(text, card.name, effectSourceElement(card))
        : null);
    if (compiled && compiled.trigger === "onTap")
      atoms.push({ ...compiled, text });
  }
  return atoms;
}
