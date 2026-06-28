/**
 * Moteur de règles — étape C : mots-clés de combat extraits des DONNÉES.
 *
 * Couverture réelle mesurée sur public/data/*.json (1613 cartes) :
 * - « Résistance [Élément] N » : 185 cartes, structuré dans `keywords[]`
 *   (name: 'Résistance', description: '<N>', elements: ['terre']) — règle
 *   7469 : prévention de N Dommages de cet Élément, par infliction.
 * - « Géant » : 93 cartes, texte d'effet strictement égal à « Géant » —
 *   règle 7258/6135 : l'attaquant répartit sa Force entre ses bloqueurs.
 * Les autres mots-clés du type `CardKeyword` (Riposte, Portée, Critique,
 * Parade) n'existent pas dans les données scrapées — rien à automatiser.
 */
import type { Card } from "@/types/cards";
import { isHeroCard } from "../../../types/cards.ts";
import type { InstanceId } from "../../types/events";
import type { RulesCtx } from "../types";
import { normElement, normWord } from "../cardAttrs.ts";
import { bearerBonuses, staticAbilitiesOf } from "../modifiers.ts";

export interface CombatKeywords {
  /** Prévention par élément normalisé (minuscules). */
  resistances: Record<string, number>;
  geant: boolean;
  /**
   * Agilité (pouvoir continu) : « Ce Héros ou cet Allié ne peut pas être bloqué
   * par un Allié ou un Héros qui ne possède pas Agilité » — légalité de blocage.
   */
  agilite: boolean;
  /**
   * Agressivité : « Un Allié possédant Agressivité peut être déclaré comme
   * attaquant le tour où il apparaît » — lève le mal d'invocation à l'attaque.
   */
  agressivite: boolean;
  /**
   * Tacle (pouvoir continu de la Phase d'Actions) : « jusqu'à la fin du combat,
   * les Alliés ou Héros qui bloquent ou qui sont bloqués par un Allié ou Héros
   * possédant Tacle ne peuvent pas s'incliner ». Verrou RELATIONNEL de combat :
   * appliqué par `resolveCombat` (les bloqueurs survivants en relation de blocage
   * avec un possesseur de Tacle ne sont pas inclinés en fin de combat) — cf.
   * combat.ts.
   */
  tacle: boolean;
  /**
   * Défense (mot-clé de TIMING de jeu) : « Un Allié jouable durant la Phase
   * d'Actions d'un combat si son contrôleur est le défenseur ; il est placé comme
   * bloqueur. » Relâche la barrière tour/phase de `whyCannotPlay` quand un combat
   * est en cours et que `seat` en est le défenseur (cf. legality.ts). Le placement
   * « comme bloqueur » se fait par le flux normal de déclaration de blocage :
   * l'Allié arrive redressé dans le Monde → immédiatement éligible (eligibleBlockers).
   */
  defense: boolean;
  /**
   * Renfort (mot-clé de TIMING de jeu) : « Un Allié possédant Renfort peut être
   * joué pendant la phase d'actions d'un combat où son propriétaire est le joueur
   * attaquant, et que son Héros est attaquant dans ce combat. » Relâche la barrière
   * tour/phase de `whyCannotPlay` dans cette fenêtre précise (cf. legality.ts).
   */
  renfort: boolean;
}

const NONE: CombatKeywords = {
  resistances: {},
  geant: false,
  agilite: false,
  agressivite: false,
  tacle: false,
  defense: false,
  renfort: false,
};

export function combatKeywords(
  card: Card | null,
  side: "recto" | "verso" = "recto",
): CombatKeywords {
  if (!card) return NONE;
  // Un Équipement ne combat pas lui-même : ses `keywords[]` scrapés sont des
  // morceaux de bonus de panoplie attribués à tort à la carte seule (ex.
  // « Résistance 1 Air » du Scaranneau Blanc). Les bonus au Porteur arrivent
  // avec le modèle Équipement (lot F).
  if (card.mainType === "Équipement") return NONE;
  const face = isHeroCard(card)
    ? side === "verso"
      ? (card.verso ?? card.recto)
      : card.recto
    : null;
  const keywords = face ? face.keywords : card.keywords;
  const effects = face ? face.effects : card.effects;

  const resistances: Record<string, number> = {};
  for (const k of keywords ?? []) {
    if (!k?.name?.toLowerCase().startsWith("résistance")) continue;
    const n = Number.parseInt(String(k.description ?? "").trim(), 10);
    if (!Number.isFinite(n) || n <= 0) continue;
    for (const el of k.elements ?? []) {
      const key = normElement(el);
      resistances[key] = (resistances[key] ?? 0) + n;
    }
  }
  // Géant : mot-clé structuré (promu à la compilation) ou texte d'effet strict
  let geant = (keywords ?? []).some((k) => k?.name === "Géant");
  for (const e of effects ?? []) {
    if (String(e?.description ?? "").trim() === "Géant") geant = true;
  }
  // Agilité / Agressivité : mots-clés structurés (glossaire, sans valeur) —
  // lus exactement comme Géant (face active du Héros incluse).
  const agilite = (keywords ?? []).some((k) => k?.name === "Agilité");
  const agressivite = (keywords ?? []).some((k) => k?.name === "Agressivité");
  // Tacle : mot-clé structuré (glossaire, sans valeur) — lu exactement comme
  // Agilité/Agressivité. Sa sémantique de combat (verrou d'inclinaison) est
  // appliquée par resolveCombat via la relation de blocage.
  const tacle = (keywords ?? []).some((k) => k?.name === "Tacle");
  // Défense / Renfort : mots-clés de TIMING de jeu (glossaire, sans valeur) — lus
  // exactement comme Agilité/Tacle. Leur sémantique (relâchement de la barrière
  // tour/phase dans une fenêtre de combat) est appliquée par whyCannotPlay
  // (legality.ts) ; ils n'ont aucun effet sur la résolution du combat lui-même.
  const defense = (keywords ?? []).some((k) => k?.name === "Défense");
  const renfort = (keywords ?? []).some((k) => k?.name === "Renfort");
  return { resistances, geant, agilite, agressivite, tacle, defense, renfort };
}

/**
 * Mots-clés CONFÉRÉS à un bénéficiaire par les auras `keywordAura` du Monde
 * (805.2). Miroir EXACT de `auraForceBonus` (stats.ts) : le bénéficiaire est soit
 * un Allié du Monde, soit (si l'aura porte `heroes`) le Héros du contrôleur ; on
 * ne scanne que les sources du MÊME contrôleur (« VOS … »), et une aura
 * `excludeSource` (« vos AUTRES Alliés … ») ne se compte jamais elle-même.
 * Renvoie l'ensemble des mots-clés câblés ainsi gagnés (Géant/Agilité/
 * Agressivité/Tacle), lu par effectiveKeywords pour les agréger aux imprimés.
 */
function auraKeywords(
  ctx: RulesCtx,
  beneficiaryId: InstanceId,
  controller: string,
  isHero: boolean,
  subTypes: string[],
): Set<"Géant" | "Agilité" | "Agressivité" | "Tacle"> {
  const granted = new Set<"Géant" | "Agilité" | "Agressivité" | "Tacle">();
  for (const srcId of ctx.state.monde) {
    const src = ctx.state.instances[srcId];
    if (!src || src.controller !== controller) continue;
    const srcCard = ctx.getCard(src.cardId);
    if (!srcCard) continue;
    const srcSide = src.face === "verso" ? "verso" : "recto";
    for (const s of staticAbilitiesOf(srcCard, srcSide)) {
      if (s.kind !== "keywordAura") continue;
      // « vos AUTRES … » : la source ne se confère pas l'aura à elle-même.
      if (s.excludeSource && srcId === beneficiaryId) continue;
      if (isHero) {
        // « … ou Héros » : votre Héros est une classe de bénéficiaire à part —
        // la Famille ne le restreint pas. Il profite de l'aura SSI elle inclut
        // « et/ou Héros ».
        if (s.heroes) granted.add(s.keyword);
        continue;
      }
      // Allié bénéficiaire : famille présente ⇒ doit la porter ; absente ⇒ tous.
      if (s.sub && !subTypes.some((st) => normWord(st) === s.sub)) continue;
      granted.add(s.keyword);
    }
  }
  return granted;
}

/**
 * Mots-clés EFFECTIFS d'une instance en jeu : imprimés (face courante de
 * l'instance) + jetons (`geantMod`/`geantCombatMod` → Géant, `resMod_<el>` →
 * Résistance, posés par les effets — lots C/D) + bonus conférés par
 * l'équipement / la Monture PORTÉ(E) (305.x, `bearerBonus` → Résistance pour le
 * Porteur) + mots-clés conférés par les auras `keywordAura` du Monde (805.2,
 * « Tant que <self> est dans le Monde, vos [autres] Alliés [Famille] [et Héros]
 * gagnent <Mot-clé> »). C'est la SEULE lecture correcte en contexte de partie —
 * `combatKeywords(card)` seul ignore face, jetons, équipement porté et auras.
 */
export function effectiveKeywords(
  ctx: RulesCtx,
  id: InstanceId,
): CombatKeywords {
  const inst = ctx.state.instances[id];
  const card = inst ? ctx.getCard(inst.cardId) : null;
  const base = combatKeywords(card, inst?.face === "verso" ? "verso" : "recto");
  // 805.2 — auras de mot-clé des cartes du Monde (même contrôleur). Un Allié du
  // Monde en bénéficie ; le Héros en bénéficie SSI l'aura inclut « et Héros »
  // (il vit dans l'intérieur du Havre-Sac, comme pour forceAura).
  const auraGranted =
    inst && card
      ? card.mainType === "Allié" && inst.location.zone === "monde"
        ? auraKeywords(ctx, id, inst.controller, false, card.subTypes ?? [])
        : card.mainType === "Héros"
          ? auraKeywords(ctx, id, inst.controller, true, card.subTypes ?? [])
          : new Set<"Géant" | "Agilité" | "Agressivité" | "Tacle">()
      : new Set<"Géant" | "Agilité" | "Agressivité" | "Tacle">();
  const tokens = inst?.counters.tokens ?? {};
  const resistances = { ...base.resistances };
  for (const [name, value] of Object.entries(tokens)) {
    if (!value) continue;
    const m = name.match(/^resMod_(.+)$/);
    if (!m) continue;
    const el = normElement(m[1]);
    resistances[el] = (resistances[el] ?? 0) + value;
  }
  // 305.x — Résistance / mot-clé conféré(e) au Porteur par l'équipement / la
  // Monture porté(e) (« Le Porteur de X gagne Résistance N (Élément) » ou
  // « … gagne Géant »). Le bonus appartient au Porteur (la carte portée ne
  // combat pas) : on le lit ici, jamais sur la carte portée elle-même
  // (combatKeywords renvoie NONE pour un Équipement). La Résistance peut viser
  // plusieurs Éléments (Croum) ; le mot-clé Géant alimente la répartition de
  // Force au combat (les autres mots-clés conférés n'ont pas encore de
  // sémantique de combat, exactement comme s'ils étaient imprimés).
  let bearerGeant = false;
  for (const b of bearerBonuses(ctx, id)) {
    if (b.keyword === "Géant") bearerGeant = true;
    if (!b.resistance) continue;
    const els = Array.isArray(b.resistance.element)
      ? b.resistance.element
      : [b.resistance.element];
    for (const e of els) {
      const el = normElement(e);
      resistances[el] = (resistances[el] ?? 0) + b.resistance.n;
    }
  }
  const geant =
    base.geant ||
    bearerGeant ||
    !!tokens.geantMod ||
    !!tokens.geantCombatMod ||
    // « gagne Géant jusqu'à la fin du TOUR » (grantKeywordSelf/grantKeywordTarget) :
    // jeton TURN-scoped posé sur l'instance, purgé en fin de tour (isTurnToken).
    !!tokens.geantTurnMod ||
    // 805.2 — aura de mot-clé Géant du Monde (keywordAura).
    auraGranted.has("Géant");
  // Agilité / Agressivité : imprimés sur la face courante (`base`) OU conférés
  // « jusqu'à la fin du tour » par un jeton TURN-scoped `<kw>TurnMod`
  // (grantKeywordSelf/grantKeywordTarget), purgé en fin de tour (isTurnToken).
  // Ces jetons alimentent EXACTEMENT les mêmes légalités que les mots-clés
  // imprimés (Agilité → blocage 704 ; Agressivité → mal d'invocation à l'attaque),
  // lus par eligibleBlockers/eligibleAttackers via effectiveKeywords.
  const agilite =
    base.agilite || !!tokens.agiliteTurnMod || auraGranted.has("Agilité");
  const agressivite =
    base.agressivite ||
    !!tokens.agressiviteTurnMod ||
    auraGranted.has("Agressivité");
  // Tacle : imprimé (`base`) OU conféré « jusqu'à la fin du tour » par un jeton
  // TURN-scoped `tacleTurnMod` (grantKeywordSelf/grantKeywordTarget) OU par une
  // aura de mot-clé du Monde (keywordAura). Le verrou d'inclinaison reste appliqué
  // par resolveCombat (relation de blocage).
  const tacle = base.tacle || !!tokens.tacleTurnMod || auraGranted.has("Tacle");
  // Défense / Renfort : mots-clés de TIMING de jeu attachés à la carte imprimée
  // (face courante). Ils ne sont ni octroyés par jeton ni conférés par aura dans
  // les données (aucune carte « accorde Défense/Renfort ») — donc passés tels
  // quels depuis `base`. (Si un tel octroi apparaissait, il serait câblé ici.)
  return {
    resistances,
    geant,
    agilite,
    agressivite,
    tacle,
    defense: base.defense,
    renfort: base.renfort,
  };
}

/**
 * Mot-clé octroyable « jusqu'à la fin du tour » → nom du jeton TURN-scoped
 * correspondant (`<kw>TurnMod`), lu par effectiveKeywords et purgé en fin de tour
 * (TURN_TOKENS). Centralise la correspondance Mot-clé → jeton pour le moteur
 * (grantKeywordSelf) et le ciblage (grantKeywordTarget). N'admet QUE les mots-clés
 * de combat câblés (grantKeywordSchema) — les autres ne sont pas octroyés (no-op
 * = approximation, donc laissés manuels en amont par le DSL).
 */
export const GRANT_KEYWORD_TOKEN: Record<
  "Géant" | "Agilité" | "Agressivité" | "Tacle",
  "geantTurnMod" | "agiliteTurnMod" | "agressiviteTurnMod" | "tacleTurnMod"
> = {
  Géant: "geantTurnMod",
  Agilité: "agiliteTurnMod",
  Agressivité: "agressiviteTurnMod",
  Tacle: "tacleTurnMod",
};

/**
 * Étiquette « Résistance N (élément)[(élément)…] » pour le JOURNAL d'un octroi de
 * Résistance (grantResistance{Self,Target}). Regroupe les Éléments par valeur N
 * (la majorité des cartes accordent la même valeur à plusieurs Éléments :
 * « Résistance 1 (air)(eau)(terre)(feu) »). Purement cosmétique.
 */
export function resistanceLabel(
  resist: readonly { element: string; n: number }[],
): string {
  const byN = new Map<number, string[]>();
  for (const r of resist) {
    const list = byN.get(r.n) ?? [];
    list.push(normElement(r.element));
    byN.set(r.n, list);
  }
  return [...byN.entries()]
    .map(([n, els]) => `Résistance ${n} ${els.map((e) => `(${e})`).join("")}`)
    .join(", ");
}

/** Dommages effectifs après Résistance de la cible (par infliction, 7469). */
export function preventDamage(
  target: CombatKeywords,
  amount: number,
  element: string,
): number {
  return Math.max(0, amount - (target.resistances[element] ?? 0));
}
