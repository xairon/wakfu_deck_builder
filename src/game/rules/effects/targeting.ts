/**
 * Moteur de règles — étape C : résolution des ops d'effet À CIBLE
 * (« Détruisez … de votre choix », « Infligez N Dommages à l'Allié de votre
 * choix »). Le store met la table en mode ciblage ; le clic du joueur
 * appelle ces helpers purs qui émettent les events.
 */
import type { CompiledEffectOp } from "@/types/cards";
import type { DraftEvent, InstanceId } from "../../types/events";
import type { Seat } from "../../types/zones";
import { otherSeat } from "../../types/zones";
import type { CombatStance, DamageMod, RuleEvent, RulesCtx } from "../types";
import {
  discard,
  incCounter,
  move,
  setCounter,
  tap,
  untap,
} from "../../engine/verbs";
import { normElement, normWord, xpValue } from "../cardAttrs";
import { effectiveForce } from "../stats";
import { reduceDamage } from "./damageMods";
import { grantXpEvents } from "../progress";
import { GRANT_KEYWORD_TOKEN, resistanceLabel } from "./keywords";

export type TargetingOp = Extract<
  CompiledEffectOp,
  | { op: "destroyTarget" }
  | { op: "damageTarget" }
  | { op: "damageMultiTarget" }
  | { op: "damageTargetByForce" }
  | { op: "healHeroTarget" }
  | { op: "buffForceTarget" }
  | { op: "grantKeywordTarget" }
  | { op: "grantResistanceTarget" }
  | { op: "tapTarget" }
  | { op: "untapTarget" }
  | { op: "returnToHand" }
  | { op: "costTapControlled" }
  | { op: "costDestroyControlled" }
  // OPS « LE JOUEUR DE VOTRE CHOIX … » : on choisit un JOUEUR en CIBLANT son
  // Héros (éligibilité = tous les Héros en jeu, les deux contrôleurs). L'effet
  // s'applique au contrôleur du Héros choisi (résolu dans effectTargetChoose).
  | { op: "playerDraw" }
  | { op: "playerLoseStatTurn" }
  | { op: "playerGainStat" }
>;

export function isTargetingOp(op: CompiledEffectOp): op is TargetingOp {
  return (
    op.op === "destroyTarget" ||
    op.op === "damageTarget" ||
    op.op === "damageMultiTarget" ||
    op.op === "damageTargetByForce" ||
    op.op === "healHeroTarget" ||
    op.op === "buffForceTarget" ||
    op.op === "grantKeywordTarget" ||
    op.op === "grantResistanceTarget" ||
    op.op === "tapTarget" ||
    op.op === "untapTarget" ||
    op.op === "returnToHand" ||
    op.op === "costTapControlled" ||
    op.op === "costDestroyControlled" ||
    op.op === "playerDraw" ||
    op.op === "playerLoseStatTurn" ||
    op.op === "playerGainStat"
  );
}

/** Op « le joueur de votre choix … » : choix de joueur via ciblage de Héros. */
export type PlayerChoiceOp = Extract<
  CompiledEffectOp,
  { op: "playerDraw" } | { op: "playerLoseStatTurn" } | { op: "playerGainStat" }
>;

export function isPlayerChoiceOp(op: CompiledEffectOp): op is PlayerChoiceOp {
  return (
    op.op === "playerDraw" ||
    op.op === "playerLoseStatTurn" ||
    op.op === "playerGainStat"
  );
}

/** Une op de ciblage est-elle un COÛT de pouvoir payé (« Inclinez/Détruisez un
 * de vos X : … ») ? Si son éligibilité est vide, la frame doit être ABANDONNÉE
 * (le corps ne s'exécute pas — le coût n'est pas payé), au lieu de continuer. */
export function isCostTargetingOp(op: CompiledEffectOp): boolean {
  return op.op === "costTapControlled" || op.op === "costDestroyControlled";
}

/**
 * Cibles légales d'une op. `actor` (le siège qui résout) sert au filtre de
 * contrôleur des ops « un de vos … » (self) / « … adverse » (opponent) ;
 * omis, aucun filtre de contrôleur n'est appliqué (rétro-compatible).
 */
export function effectTargetIds(
  ctx: RulesCtx,
  op: TargetingOp,
  actor?: Seat,
  sourceId?: InstanceId,
  // Cibles DÉJÀ choisies à exclure (« … N Alliés ou Héros DIFFÉRENTS » —
  // damageMultiTarget distinct : on ne re-propose pas une cible déjà touchée).
  excludeIds?: ReadonlySet<InstanceId>,
): InstanceId[] {
  // COÛTS payés (« Inclinez/Détruisez un de vos X : … ») : éligibilité dédiée —
  // VOS créatures (controller === acteur), dans op.zones, de mainType Allié (ou
  // Héros si `heroes`), matchant `sub`/`maxLevel`, hors source si `excludeSource`,
  // et — pour le coût d'inclinaison — actuellement DRESSÉES (on ne peut pas
  // incliner une carte déjà inclinée).
  if (op.op === "costTapControlled" || op.op === "costDestroyControlled") {
    if (actor === undefined) return [];
    const out: InstanceId[] = [];
    for (const inst of Object.values(ctx.state.instances)) {
      if (!op.zones.includes(inst.location.zone as "monde" | "havreSac"))
        continue;
      if (inst.controller !== actor) continue;
      if (op.excludeSource && inst.instanceId === sourceId) continue;
      if (op.op === "costTapControlled" && inst.orientation !== "upright")
        continue;
      const card = ctx.getCard(inst.cardId);
      if (!card) continue;
      const typeOk =
        card.mainType === "Allié" || (op.heroes && card.mainType === "Héros");
      if (!typeOk) continue;
      if (op.sub && !(card.subTypes ?? []).some((s) => normWord(s) === op.sub))
        continue;
      if (
        op.maxLevel !== undefined &&
        (card.stats?.niveau?.value ?? Number.POSITIVE_INFINITY) > op.maxLevel
      )
        continue;
      out.push(inst.instanceId);
    }
    return out;
  }
  // OPS « LE JOUEUR DE VOTRE CHOIX … » : éligibilité = TOUS les Héros en jeu
  // (Monde / Havre-Sac), des DEUX contrôleurs — on peut se choisir soi-même OU
  // l'adversaire (c'est le sens de « le joueur de votre choix »). L'effet
  // s'appliquera au contrôleur du Héros choisi (résolu dans effectTargetChoose).
  if (
    op.op === "playerDraw" ||
    op.op === "playerLoseStatTurn" ||
    op.op === "playerGainStat"
  ) {
    const out: InstanceId[] = [];
    for (const inst of Object.values(ctx.state.instances)) {
      if (inst.location.zone !== "monde" && inst.location.zone !== "havreSac")
        continue;
      const card = ctx.getCard(inst.cardId);
      if (card?.mainType === "Héros") out.push(inst.instanceId);
    }
    return out;
  }
  const zones: ("monde" | "havreSac")[] =
    op.op === "healHeroTarget" ? ["monde", "havreSac"] : op.zones;
  // ops à filtre de contrôleur (« vos » / « adverse »)
  const controller =
    op.op === "tapTarget" ||
    op.op === "untapTarget" ||
    op.op === "returnToHand" ||
    op.op === "damageTargetByForce" ||
    op.op === "grantKeywordTarget" ||
    op.op === "grantResistanceTarget"
      ? op.controller
      : undefined;
  // Rôles du combat EN COURS (state.combat) : un instance est « attaquant »
  // s'il figure dans combat.attackers, « bloqueur » s'il est une clé de
  // combat.blocks. Hors combat (combat null), ces ensembles sont vides ⇒
  // aucune cible éligible pour un filtre combatRole (fidèle : pas de cible).
  const combat = ctx.state.combat ?? null;
  const attackers = new Set(combat?.attackers ?? []);
  const blockers = new Set(combat ? Object.keys(combat.blocks) : []);
  const out: InstanceId[] = [];
  for (const inst of Object.values(ctx.state.instances)) {
    if (!zones.includes(inst.location.zone as "monde" | "havreSac")) continue;
    const card = ctx.getCard(inst.cardId);
    if (!card) continue;
    let ok =
      op.op === "destroyTarget"
        ? card.mainType === op.what ||
          !!op.whatAny?.some((w) => w === card.mainType)
        : // « Renvoyez l'Allié, la Zone ou l'Équipement … » (returnToHand
          // multi-type) : la cible est de l'un des types listés. Sans `whatAny`,
          // la forme mono-type tombe dans le défaut (Allié + Héros si `heroes`).
          op.op === "returnToHand" && op.whatAny
          ? op.whatAny.some((w) => w === card.mainType)
          : op.op === "healHeroTarget"
            ? card.mainType === "Héros"
            : // « … au Héros de votre choix » (damageTarget targetHeroOnly) : seuls
              // les Héros sont éligibles (aucun Allié). Sinon, Allié (+ Héros si
              // `heroes`).
              op.op === "damageTarget" && op.targetHeroOnly
              ? card.mainType === "Héros"
              : card.mainType === "Allié" ||
                (op.heroes && card.mainType === "Héros");
    // famille requise (« le Monstre de votre choix »)
    if (
      ok &&
      (op.op === "buffForceTarget" ||
        op.op === "destroyTarget" ||
        op.op === "damageTarget" ||
        op.op === "grantKeywordTarget" ||
        op.op === "grantResistanceTarget") &&
      op.sub
    ) {
      ok = (card.subTypes ?? []).some((s) => normWord(s) === op.sub);
    }
    // Niveau max (« … de Niveau inférieur ou égal à N ») : une cible sans
    // valeur de Niveau est INÉLIGIBLE (manquant = +Infinity > N), comme
    // matchesPickFilter pour searchDeck.
    if (ok && op.op === "destroyTarget" && op.maxLevel !== undefined) {
      ok =
        (card.stats?.niveau?.value ?? Number.POSITIVE_INFINITY) <= op.maxLevel;
    }
    // Niveau EXACT (« … de Niveau N ») : une cible sans Niveau est inéligible
    // (manquant ≠ N), comme maxLevel. Sur les ops qui portent le champ.
    if (
      ok &&
      (op.op === "destroyTarget" ||
        op.op === "damageTarget" ||
        op.op === "buffForceTarget") &&
      "exactLevel" in op &&
      op.exactLevel !== undefined
    ) {
      ok = card.stats?.niveau?.value === op.exactLevel;
    }
    // Type d'Équipement (« Détruisez l'Arme / l'Armure … de votre choix ») :
    // lu sur card.equipmentType (présent uniquement sur les Équipements). Une
    // carte sans equipmentType est inéligible.
    if (ok && op.op === "destroyTarget" && op.equipType) {
      ok =
        card.mainType === "Équipement" &&
        normWord((card as { equipmentType?: string }).equipmentType ?? "") ===
          normWord(op.equipType);
    }
    // Orientation imprimée (« l'Allié incliné / dressé de votre choix ») : la
    // cible doit avoir l'orientation demandée (inst.orientation). Sur les ops
    // qui portent le champ.
    if (
      ok &&
      (op.op === "destroyTarget" ||
        op.op === "damageTarget" ||
        op.op === "buffForceTarget" ||
        op.op === "tapTarget" ||
        op.op === "untapTarget") &&
      "orientation" in op &&
      op.orientation
    ) {
      ok = inst.orientation === op.orientation;
    }
    // Rôle de combat (« l'Allié ou Héros attaquant / bloqueur de votre choix »)
    // — uniquement les instances jouant ce rôle dans le combat en cours. Hors
    // combat, les ensembles sont vides ⇒ inéligible.
    if (
      ok &&
      (op.op === "destroyTarget" ||
        op.op === "damageTarget" ||
        op.op === "damageMultiTarget" ||
        op.op === "buffForceTarget" ||
        op.op === "grantKeywordTarget" ||
        op.op === "grantResistanceTarget" ||
        op.op === "tapTarget" ||
        op.op === "untapTarget") &&
      "combatRole" in op &&
      op.combatRole
    ) {
      ok =
        op.combatRole === "attacking"
          ? attackers.has(inst.instanceId)
          : op.combatRole === "blocking"
            ? blockers.has(inst.instanceId)
            : // « attaquant ou bloqueur » : participe au combat dans l'un
              // OU l'autre rôle.
              attackers.has(inst.instanceId) || blockers.has(inst.instanceId);
    }
    // filtre de contrôleur (« un de vos … » / « … adverse »)
    if (ok && controller && actor !== undefined) {
      const want = controller === "self" ? actor : otherSeat(actor);
      ok = inst.controller === want;
    }
    // cibles déjà choisies (« … différents ») — exclues de l'éligibilité.
    if (ok && excludeIds?.has(inst.instanceId)) ok = false;
    if (ok) out.push(inst.instanceId);
  }
  return out;
}

/** « regagne N PV » : soin du Héros ciblé (pas de plafond suivi en V1). */
export function resolveHealHeroTarget(
  ctx: RulesCtx,
  actor: Seat,
  targetId: InstanceId,
  n: number,
): EffectResolution {
  const inst = ctx.state.instances[targetId];
  if (!inst) return { events: [], log: [] };
  return {
    events: [incCounter(actor, targetId, "hp", n)],
    log: [`${nameOf(ctx, targetId)} regagne ${n} PV.`],
  };
}

export interface EffectResolution {
  events: DraftEvent[];
  log: string[];
  /** Événements de règles émis par la résolution (bus de déclenchement). */
  ruleEvents?: RuleEvent[];
}

/** Contexte optionnel d'une résolution de Dommages (passe unique A2). */
export interface DamageOpts {
  sourceId?: InstanceId;
  /** Posture du combat en cours, s'il y en a un (rôles de Poum). */
  stance?: CombatStance;
  /** Modificateurs globaux actifs (Trêve…). */
  mods?: DamageMod[];
}

function nameOf(ctx: RulesCtx, id: InstanceId): string {
  const inst = ctx.state.instances[id];
  return ctx.getCard(inst?.cardId ?? null)?.name ?? "Carte";
}

/** Détruit la cible ; un Allié adverse détruit rapporte son XP (415.1). */
export function resolveDestroyTarget(
  ctx: RulesCtx,
  actor: Seat,
  targetId: InstanceId,
): EffectResolution {
  const inst = ctx.state.instances[targetId];
  if (!inst) return { events: [], log: [] };
  const events: DraftEvent[] = [discard(inst.owner, targetId, inst.location)];
  const log = [`${nameOf(ctx, targetId)} est détruit.`];
  const card = ctx.getCard(inst.cardId);
  if (card?.mainType === "Allié") {
    const grant = grantXpEvents(ctx, otherSeat(inst.controller), xpValue(card));
    events.push(...grant.events);
    log.push(
      ...grant.log.map((l) => `Le Héros de ${otherSeat(inst.controller)} ${l}`),
    );
  }
  return { events, log };
}

/**
 * Inflige n Dommages (élément de la source, Résistance déduite) : un Héros
 * perd des PV (410.2), un Allié cumule des Dommages + létalité (204.6).
 */
export function resolveDamageTarget(
  ctx: RulesCtx,
  actor: Seat,
  targetId: InstanceId,
  n: number,
  element: string,
  opts: DamageOpts = {},
): EffectResolution {
  const inst = ctx.state.instances[targetId];
  const card = inst ? ctx.getCard(inst.cardId) : null;
  if (!inst || !card) return { events: [], log: [] };
  // Passe unique A2 : toute infliction de Dommages traverse reduceDamage
  // (Résistance, puis Poum/Trêve si la posture/les mods s'appliquent — hors
  // combat, sans posture ni mod, seule la Résistance 7469 joue).
  const eff = reduceDamage(
    ctx,
    {
      targetId,
      amount: n,
      element,
      combat: false,
      sourceId: opts.sourceId ?? null,
    },
    opts.mods ?? [],
    opts.stance,
  );
  const events: DraftEvent[] = [];
  const log: string[] = [];
  if (eff < n) log.push(`Prévention : ${n - eff} Dommage(s) prévenu(s).`);
  if (eff <= 0) return { events, log };
  // 811.4 : Dommages effectivement infligés → événement de bus (jamais à ≤ 0)
  const ruleEvents: RuleEvent[] = [
    {
      kind: "damageDealt",
      source: opts.sourceId ?? null,
      target: targetId,
      amount: eff,
      element: element.toLowerCase(),
      combat: false,
    },
  ];
  if (card.mainType === "Héros") {
    events.push(incCounter(actor, targetId, "hp", -eff));
    log.push(`${nameOf(ctx, targetId)} perd ${eff} PV.`);
    return { events, log, ruleEvents };
  }
  events.push(incCounter(actor, targetId, "damage", eff));
  log.push(`${eff} Dommage(s) sur ${nameOf(ctx, targetId)}.`);
  const total = (inst.counters.damage ?? 0) + eff;
  const force = effectiveForce(ctx, targetId, opts.stance);
  if (force > 0 && total >= force) {
    const destroy = resolveDestroyTarget(ctx, actor, targetId);
    events.push(...destroy.events);
    log.push(...destroy.log);
  }
  return { events, log, ruleEvents };
}

/**
 * « [X] inflige sa Force en Dommages à l'Allié (ou Héros) de votre choix » :
 * le montant est la Force EFFECTIVE de la SOURCE (`sourceId`) au moment de la
 * résolution (204.4/410.1), de l'Élément de la source ; le reste est identique
 * à `resolveDamageTarget` (Résistance, létalité, XP). Source absente / hors jeu
 * → effectiveForce = 0 → 0 Dommage (no-op fidèle).
 */
export function resolveDamageTargetByForce(
  ctx: RulesCtx,
  actor: Seat,
  targetId: InstanceId,
  element: string,
  opts: DamageOpts = {},
): EffectResolution {
  const n = opts.sourceId ? effectiveForce(ctx, opts.sourceId, opts.stance) : 0;
  return resolveDamageTarget(ctx, actor, targetId, n, element, opts);
}

/**
 * « Inclinez l'Allié (ou Héros) de votre choix » : incline la cible
 * (SET_ORIENTATION tapped). No-op si déjà inclinée (« Incliner » du glossaire
 * = passer d'une carte dressée à inclinée ; sans effet sur une carte inclinée).
 *
 * `cannotRedressUntil` (clause « cet Allié ne peut pas se redresser jusqu'au
 * début de votre prochain tour » — Pandrista, Kolo-Kolko, Boufdégou…) : pose en
 * plus un jeton `noUntapUntilTurn` (= tour courant + 2) sur la MÊME cible. Le
 * jeton fait sauter le redressement de début de tour (cf. nextTurnEvents) tant
 * qu'il est actif, puis se purge au début du prochain tour du contrôleur de
 * l'effet (isTurnToken). FIDÉLITÉ (ruling Pandrista) : le jeton est posé MÊME
 * si la cible est DÉJÀ inclinée (« il n'est pas incliné de nouveau mais ne peut
 * tout de même pas se redresser par la suite ») — l'inclinaison reste un no-op,
 * pas l'interdiction.
 */
export function resolveTapTarget(
  ctx: RulesCtx,
  actor: Seat,
  targetId: InstanceId,
  cannotRedressUntil?: number,
): EffectResolution {
  const inst = ctx.state.instances[targetId];
  if (!inst) return { events: [], log: [] };
  const events: DraftEvent[] = [];
  const log: string[] = [];
  if (inst.orientation === "upright") {
    events.push(tap(actor, targetId));
    log.push(`${nameOf(ctx, targetId)} est incliné.`);
  } else {
    log.push(`${nameOf(ctx, targetId)} est déjà incliné.`);
  }
  if (cannotRedressUntil !== undefined) {
    events.push(
      setCounter(actor, targetId, "noUntapUntilTurn", cannotRedressUntil, true),
    );
    log.push(
      `${nameOf(ctx, targetId)} ne peut pas se redresser jusqu'au début de votre prochain tour.`,
    );
  }
  return { events, log };
}

/**
 * « Redressez l'Allié (ou Héros) de votre choix » : redresse la cible
 * (SET_ORIENTATION upright). No-op si déjà dressée.
 */
export function resolveUntapTarget(
  ctx: RulesCtx,
  actor: Seat,
  targetId: InstanceId,
): EffectResolution {
  const inst = ctx.state.instances[targetId];
  if (!inst) return { events: [], log: [] };
  if (inst.orientation !== "tapped")
    return {
      events: [],
      log: [`${nameOf(ctx, targetId)} est déjà dressé.`],
    };
  return {
    events: [untap(actor, targetId)],
    log: [`${nameOf(ctx, targetId)} est redressé.`],
  };
}

/**
 * « Renvoyez l'Allié de votre choix dans la main de son propriétaire » : la
 * cible retourne dans la MAIN DE SON PROPRIÉTAIRE (inst.owner), pas du
 * contrôleur (502 / 501.2).
 */
export function resolveReturnToHand(
  ctx: RulesCtx,
  actor: Seat,
  targetId: InstanceId,
): EffectResolution {
  const inst = ctx.state.instances[targetId];
  if (!inst) return { events: [], log: [] };
  return {
    events: [
      move(actor, {
        instanceId: targetId,
        from: inst.location,
        to: { zone: "main", owner: inst.owner },
        position: { at: "top" },
        visibility: { faceDown: false, visibleTo: [inst.owner] },
        preservesIdentity: false,
      }),
    ],
    log: [
      `${nameOf(ctx, targetId)} retourne dans la main de son propriétaire.`,
    ],
  };
}

/**
 * « L'Allié [ou Héros] [Famille] [bloqué / de votre choix] gagne <Mot-clé>
 * jusqu'à la fin du tour » (Géant : Pandaluk, Rat Klure, Petit Anneau de Force ;
 * Agilité : Petit Anneau d'Agilité, Gelée… ; Agressivité : Monstre de votre choix,
 * Petit Anneau d'Intelligence…) : pose le jeton TURN-scoped `<kw>TurnMod`
 * (geantTurnMod / agiliteTurnMod / agressiviteTurnMod) sur la cible choisie (purgé
 * en fin de tour, isTurnToken ; lu par effectiveKeywords → légalité de combat).
 */
export function resolveGrantKeywordTarget(
  ctx: RulesCtx,
  actor: Seat,
  targetId: InstanceId,
  keyword: "Géant" | "Agilité" | "Agressivité" | "Tacle",
): EffectResolution {
  const inst = ctx.state.instances[targetId];
  if (!inst) return { events: [], log: [] };
  const token = GRANT_KEYWORD_TOKEN[keyword];
  return {
    events: [setCounter(actor, targetId, token, 1, true)],
    log: [`${nameOf(ctx, targetId)} gagne ${keyword} jusqu'à la fin du tour.`],
  };
}

/**
 * « L'Allié [ou Héros] [Famille] [bloqué / de votre choix] gagne Résistance N
 * (Élément)[…] jusqu'à la fin du tour » : pose un jeton TURN-scoped `resMod_<el>`
 * (+N par Élément normalisé) sur la cible choisie (purgé en fin de tour, préfixe
 * resMod_ ; lu par effectiveKeywords → resistances → prévention de Dommages 7469).
 * Multi-éléments : un jeton par Élément (« Résistance 1 (air)(eau)(terre)(feu) »).
 */
export function resolveGrantResistanceTarget(
  ctx: RulesCtx,
  actor: Seat,
  targetId: InstanceId,
  resist: readonly { element: string; n: number }[],
): EffectResolution {
  const inst = ctx.state.instances[targetId];
  if (!inst) return { events: [], log: [] };
  return {
    events: resist.map((r) =>
      incCounter(
        actor,
        targetId,
        `resMod_${normElement(r.element)}`,
        r.n,
        true,
      ),
    ),
    log: [
      `${nameOf(ctx, targetId)} gagne ${resistanceLabel(resist)} jusqu'à la fin du tour.`,
    ],
  };
}

/** « gagne +N en Force jusqu'à la fin du tour » — token purgé en fin de tour. */
export function resolveBuffForceTarget(
  ctx: RulesCtx,
  actor: Seat,
  targetId: InstanceId,
  n: number,
): EffectResolution {
  const inst = ctx.state.instances[targetId];
  if (!inst) return { events: [], log: [] };
  return {
    events: [incCounter(actor, targetId, "forceMod", n, true)],
    log: [
      `${nameOf(ctx, targetId)} gagne +${n} en Force jusqu'à la fin du tour.`,
    ],
  };
}
