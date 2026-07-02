/**
 * Moteur de RÉSOLUTION D'EFFETS — orchestrateur à états extrait de gameStore.
 * Possède la file d'exécution et le modèle d'interaction pause/reprise
 * (ciblage / pile / choix). Toutes les dépendances couplées au store sont
 * INJECTÉES (EffectEngineDeps) ; les helpers purs (@/game, @/game/rules) sont
 * importés directement. Voir
 * docs/superpowers/plans/2026-06-18-effect-engine-extraction.md.
 */
import { computed, ref } from "vue";
import type {
  Card,
  CompiledEffect,
  CondSpec,
  CountSpec,
  ValueExpr,
} from "@/types/cards";
import type { DraftEvent, GameState, Position, Seat, ZoneRef } from "@/game";
import {
  createToken as createTokenVerb,
  incCounter as incCounterVerb,
  move,
  otherSeat,
  say,
  setCounter as setCounterVerb,
} from "@/game";
import { ensureTokenCard, tokenCardId } from "./tokens";
import type {
  EffectOp,
  RuleEvent,
  RulesCtx,
  TargetingOp,
  TriggeredFrame,
} from "@/game/rules";
import {
  activeGlobalMods,
  appearanceTriggerEffects,
  arrivalEffects,
  collectTriggeredEffects,
  effectiveForce,
  effectSourceElement,
  effectTargetIds,
  GRANT_KEYWORD_TOKEN,
  grantXpEvents,
  heroLevel,
  isCostTargetingOp,
  isPlayerChoiceOp,
  isTargetingOp,
  manualEffects,
  normElement,
  producedElement,
  resolveBanishTarget,
  resolveBuffForceTarget,
  resolveDamageTarget,
  resolveDamageTargetByForce,
  resolveDestroyTarget,
  resolveGrantKeywordTarget,
  resolveHealHeroTarget,
  resolveGrantResistanceTarget,
  resolveRecycleControlled,
  resolveReturnToHand,
  resolveTapTarget,
  resolveUntapTarget,
  xpValue,
  resistanceLabel,
} from "@/game/rules";

/** Une « frame » de la file : la suite d'ops d'un effet à résoudre. */
export interface EffectFrame {
  seat: Seat;
  cardName: string;
  ops: EffectOp[];
  sourceId?: string;
  /**
   * ACTOR-BINDING par coût (« Inclinez un de vos X : il/elle … ») : quand la
   * première op (coût de ciblage) est résolue, le moteur réécrit `sourceId` de
   * la frame en attente vers la créature SÉLECTIONNÉE, qui devient le sujet du
   * corps (damageTargetByForce/buffForceSelf lisent ce sourceId). L'apparence
   * (actor:"appeared") est résolue en amont — la frame est enfilée directement
   * avec sourceId = instance apparue, sans ce marqueur.
   */
  actorBind?: "costTarget";
  /**
   * VALEUR LIÉE AU COÛT « Recyclez jusqu'à N … » (costRecycle{max:true}) : nombre
   * de cartes RÉELLEMENT recyclées au paiement du coût. Les ops du corps marquées
   * `fromCount:true` lisent ce nombre comme magnitude (× perCount éventuel). Le
   * moteur le pose sur la frame retenue (holdRest) quand le recyclage « jusqu'à »
   * se termine. Absent (ou 0) = aucune carte recyclée → magnitude 0 (no-op fidèle
   * pour « jusqu'à »).
   */
  boundCount?: number;
}

/** Filtre de recherche dans une pile (type, famille, niveau max, élément). */
export interface PickFilter {
  mainType?: string;
  sub?: string;
  maxLevel?: number;
  /** Niveau EXACT (« … de Niveau N ») : carte sans Niveau = inéligible. */
  exactLevel?: number;
  /** Niveau dans un ENSEMBLE (« … de Niveau 1 ou 2 ») : carte sans Niveau = inéligible. */
  levelIn?: number[];
  /** « une carte [Feu] » : seules les cartes de cet Élément. */
  element?: string;
}

/** minuscules + accents retirés (la casse/les accents varient dans les données). */
function normWord(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

/** Une carte passe-t-elle le filtre d'une recherche/pile ? PUR. */
export function matchesPickFilter(card: Card | null, f?: PickFilter): boolean {
  if (!f) return true;
  if (!card) return false;
  if (f.mainType && card.mainType !== f.mainType) return false;
  if (f.sub && !(card.subTypes ?? []).some((s) => normWord(s) === f.sub))
    return false;
  if (f.element && producedElement(card) !== normElement(f.element))
    return false;
  if (
    f.maxLevel !== undefined &&
    (card.stats?.niveau?.value ?? Number.POSITIVE_INFINITY) > f.maxLevel
  )
    return false;
  if (f.exactLevel !== undefined && card.stats?.niveau?.value !== f.exactLevel)
    return false;
  if (f.levelIn && !f.levelIn.includes(card.stats?.niveau?.value ?? Number.NaN))
    return false;
  return true;
}

/** Rappel non bloquant : un effet imprimé non automatisé, à jouer à la main. */
export interface ManualReminder {
  id: string;
  seat: Seat;
  cardName: string;
  text: string;
}

/**
 * Couplages au store, injectés pour découpler le moteur. Les fonctions
 * `getXxx` lisent l'état réactif au moment de l'appel (pas de capture figée).
 */
export interface EffectEngineDeps {
  getState: () => GameState;
  rulesCtx: () => RulesCtx;
  getCard: (cardId: string | null) => Card | null;
  isAssist: () => boolean;
  isAssistEffects: () => boolean;
  getMatchPhase: () => "lobby" | "mulligan" | "playing" | "finished";
  playerName: (seat: Seat) => string;
  paOf: (seat: Seat) => number;
  dispatch: (...drafts: DraftEvent[]) => void;
  moveTo: (instanceId: string, to: ZoneRef, position?: Position) => void;
  shufflePioche: (seat: Seat) => void;
  checkVictory: () => void;
  draw: (seat: Seat, n: number) => void;
  adjustCounter: (instanceId: string, counter: string, delta: number) => void;
  /** Fin de partie immédiate (gainXp gagnant) : pose winner + matchPhase. */
  onMatchWon: (seat: Seat) => void;
}

/**
 * Fabrique le moteur d'effets pour un store donné : possède la file et le
 * modèle d'interaction, pilote la résolution via les dépendances injectées.
 */
export function createEffectEngine(deps: EffectEngineDeps) {
  /** Effets optionnels (« vous pouvez… ») en attente de confirmation. */
  const effectChoices = ref<
    {
      seat: Seat;
      cardName: string;
      text: string;
      ops: EffectOp[];
      /** Branche exécutée si le joueur décline (« ou détruisez X »). */
      declineOps?: EffectOp[];
      /**
       * CHOIX EXCLUSIF « A ou B » (op chooseOne) : étiquettes des deux boutons
       * (`[label A, label B]`). `ops` = branche A (bouton 0, accept=true),
       * `declineOps` = branche B (bouton 1, accept=false). Présent ⇒ ce n'est PAS
       * un effet optionnel « vous pouvez … » mais un choix obligatoire entre deux
       * effets — l'UI rend deux boutons étiquetés au lieu d'Appliquer/Décliner.
       */
      optionLabels?: [string, string];
      sourceId?: string;
    }[]
  >([]);
  const effectChoice = computed(() => effectChoices.value[0] ?? null);

  /** Op à cible en attente du clic du joueur (mode ciblage du plateau). */
  const effectTargeting = ref<{
    seat: Seat;
    cardName: string;
    op: TargetingOp;
    sourceId?: string;
    /**
     * DOMMAGES MULTI-CIBLES BORNÉS (« Choisissez jusqu'à N … leur inflige X
     * Dommages », op damageMultiTarget) : état d'un ciblage RÉPÉTÉ. `remaining`
     * = nombre de choix encore possibles (décrémenté à chaque cible) ; `distinct`
     * = « … différents » (les cibles déjà touchées, `chosen`, sont retirées de
     * l'éligibilité). « Jusqu'à » : le joueur peut s'ARRÊTER avant (effectTargetSkip
     * clôt la boucle sans abandonner l'effet). Absent = ciblage simple (1 cible).
     */
    multi?: {
      remaining: number;
      distinct: boolean;
      chosen: string[];
    };
  } | null>(null);

  /** Choix de carte(s) dans une pile (recycler / défausser / chercher). */
  const effectPicking = ref<{
    seat: Seat;
    cardName: string;
    zone: "defausse" | "main" | "pioche";
    /**
     * PROPRIÉTAIRE de la pile où l'on choisit. Absent = `seat` (l'acteur — cas
     * historique : on pioche/recycle/défausse dans SES propres piles). Posé à
     * l'adversaire pour « … de la Défausse d'un adversaire » (banishFromZone) :
     * le pick lit alors `seats[owner][zone]`, et la carte choisie va en EXIL de
     * son propriétaire (= owner).
     */
    owner?: Seat;
    action: "recycle" | "discard" | "toHand" | "toMonde" | "banish";
    /** Filtre de la recherche dans la Pioche. */
    filter?: PickFilter;
    /** « Il apparaît incliné. » — la carte mise en jeu arrive inclinée. */
    enterTapped?: boolean;
    /** Choix imposé par une règle (pas de bouton « Passer »). */
    mandatory?: boolean;
    /**
     * COÛT payé interactif (costRecycle from defausse/main) : si le joueur PASSE
     * le choix (effectPickSkip), le coût n'est PAS payé → la frame en tête de
     * file (le CORPS, retenu via holdRest) doit être ABANDONNÉE, comme pour les
     * coûts de ciblage (costTap/costDestroyControlled). Sans ce drapeau, passer
     * un recycle « libre » poursuit simplement l'effet.
     */
    cost?: boolean;
    /**
     * COÛT « Recyclez JUSQU'À N … » (costRecycle{max:true}) : recyclage OPTIONNEL
     * 0..N. Passer le choix (effectPickSkip) ne l'ANNULE PAS (« jusqu'à » admet 0)
     * — au lieu d'abandonner la frame, on FIXE `frame.boundCount` au nombre déjà
     * recyclé (`picked`) et on poursuit le CORPS. Distinct de `cost` (recyclage
     * imposé : passer = abandon). `picked` compte les cartes recyclées jusqu'ici.
     */
    upTo?: boolean;
    picked?: number;
    remaining: number;
    sourceId?: string;
  } | null>(null);

  /**
   * FILE D'EXÉCUTION des effets : chaque effet est une « frame » d'ops.
   * Une op interactive (cible, pile) met la frame en pause — le reste de ses
   * ops reste en tête de file ; les effets déclenchés en cascade (carte mise
   * en jeu par un effet) s'ajoutent en queue. C'est l'embryon de la File
   * d'Attente du jeu (503).
   */
  const effectQueue = ref<EffectFrame[]>([]);

  /**
   * Rappels d'effets NON automatisés (assistEffects ON) : la file ne les résout
   * pas, on les signale au joueur qui les applique à la main. Non bloquant.
   */
  const manualReminders = ref<ManualReminder[]>([]);
  let reminderSeq = 0;

  function noteManualEffects(seat: Seat, card: Card | null): void {
    if (!deps.isAssistEffects() || !card) return;
    // `manualEffects` (via printedEffects) garantit une description non vide.
    for (const e of manualEffects(card)) {
      manualReminders.value = [
        ...manualReminders.value,
        {
          id: `mr${++reminderSeq}`,
          seat,
          cardName: card.name,
          text: e.description.trim(),
        },
      ];
    }
  }

  function dismissManualReminder(id: string): void {
    manualReminders.value = manualReminders.value.filter((r) => r.id !== id);
  }

  /**
   * Limite de main = PA (4873) : « à n'importe quel instant », l'excédent
   * doit être défaussé. Ouvre un choix OBLIGATOIRE dans la main.
   */
  function enforceHandLimit(seat: Seat): void {
    if (!deps.isAssist() || deps.getMatchPhase() !== "playing") return;
    if (effectPicking.value || effectTargeting.value) return; // re-vérifié après
    const excess = deps.getState().seats[seat].main.length - deps.paOf(seat);
    if (excess <= 0) return;
    deps.dispatch(
      say(
        seat,
        `Main pleine (maximum ${deps.paOf(seat)} = PA) : défausse ${excess} carte(s).`,
      ),
    );
    effectPicking.value = {
      seat,
      cardName: "Limite de main",
      zone: "main",
      action: "discard",
      mandatory: true,
      remaining: excess,
    };
  }

  function enqueueEffect(frame: EffectFrame): void {
    effectQueue.value = [...effectQueue.value, frame];
    pumpEffects();
  }

  /**
   * Enfile les frames du bus de déclenchement (804.7) : « Quand [self]
   * attaque » à la déclaration, déclenchés des Dommages à la résolution.
   * L'ordre (joueur actif d'abord) est garanti par `collectTriggeredEffects`.
   */
  function enqueueTriggered(frames: TriggeredFrame[]): void {
    for (const f of frames) {
      if (f.text)
        deps.dispatch(say(f.seat, `Déclenché — ${f.cardName} : « ${f.text} »`));
      // « Vous pouvez … » : le déclenché est OPTIONNEL → choix à confirmer
      // (effectChoices), pas une exécution d'office (ex. onSelfDestroyed de la
      // Daguette : « vous pouvez détruire la Zone ou l'Équipement … »).
      if (f.optional) {
        effectChoices.value = [
          ...effectChoices.value,
          {
            seat: f.seat,
            cardName: f.cardName,
            text: f.text,
            ops: f.ops,
            sourceId: f.sourceId,
          },
        ];
        continue;
      }
      enqueueEffect({
        seat: f.seat,
        cardName: f.cardName,
        ops: f.ops,
        sourceId: f.sourceId,
      });
    }
  }

  /** Avance la file tant qu'aucune interaction n'est en attente. */
  function pumpEffects(): void {
    while (
      effectQueue.value.length &&
      !effectTargeting.value &&
      !effectPicking.value
    ) {
      const frame = effectQueue.value[0];
      if (runFrame(frame)) return; // en pause — la frame reste en tête
      effectQueue.value = effectQueue.value.slice(1);
    }
    // file vidée : destructions d'état (1414/3019) puis limite de main
    // (« à n'importe quel instant »)
    if (
      !effectQueue.value.length &&
      !effectTargeting.value &&
      !effectPicking.value
    ) {
      deps.checkVictory();
      enforceHandLimit(deps.getState().turn.active);
    }
  }

  /** Remplace les ops restantes de la frame en tête de file. */
  function holdRest(frame: EffectFrame, rest: EffectOp[]): void {
    effectQueue.value = [
      { ...frame, ops: rest },
      ...effectQueue.value.slice(1),
    ];
  }

  const effectPickIds = computed(() => {
    const p = effectPicking.value;
    if (!p) return [];
    const ids = [...deps.getState().seats[p.owner ?? p.seat][p.zone]];
    if (!p.filter) return ids;
    return ids.filter((id) =>
      matchesPickFilter(
        deps.getCard(deps.getState().instances[id]?.cardId ?? null),
        p.filter,
      ),
    );
  });

  /** Le joueur choisit une carte dans la pile ; continue l'effet une fois fini. */
  function effectPick(instanceId: string): void {
    const p = effectPicking.value;
    if (!p || !effectPickIds.value.includes(instanceId)) return;
    if (p.action === "recycle") {
      deps.moveTo(
        instanceId,
        { zone: "pioche", owner: p.seat },
        { at: "bottom" },
      );
      deps.dispatch(
        say(p.seat, `${p.cardName} : une carte est recyclée sous la Pioche.`),
      );
    } else if (p.action === "discard") {
      deps.moveTo(
        instanceId,
        { zone: "defausse", owner: p.seat },
        { at: "top" },
      );
    } else if (p.action === "toHand") {
      deps.moveTo(instanceId, { zone: "main", owner: p.seat });
      deps.dispatch(
        say(
          p.seat,
          `${p.cardName} : ${deps.getCard(deps.getState().instances[instanceId]?.cardId ?? null)?.name ?? "une carte"} rejoint la main.`,
        ),
      );
    } else if (p.action === "banish") {
      // « Bannissez la carte de votre choix de la Défausse d'un adversaire » :
      // la carte choisie part en EXIL de SON propriétaire (= owner de la pile),
      // « retirée de la partie ». PAS de destruction (aucun XP), PAS de retour
      // en jeu. preservesIdentity:false → un éventuel jeton cesse d'exister.
      const owner = p.owner ?? p.seat;
      const cardLabel =
        deps.getCard(deps.getState().instances[instanceId]?.cardId ?? null)
          ?.name ?? "une carte";
      deps.moveTo(instanceId, { zone: "exil", owner });
      deps.dispatch(
        say(
          p.seat,
          `${p.cardName} : ${cardLabel} est bannie de la Défausse (retirée de la partie).`,
        ),
      );
    } else {
      deps.moveTo(instanceId, { zone: "monde" });
      if (p.enterTapped) {
        deps.dispatch({
          actor: p.seat,
          type: "SET_ORIENTATION",
          payload: { instanceId, orientation: "tapped" },
        });
      }
      deps.dispatch(
        say(
          p.seat,
          `${p.cardName} : la carte cherchée entre en jeu${p.enterTapped ? " (inclinée)" : ""}.`,
        ),
      );
      // la carte mise en jeu par l'effet « apparaît » : son propre effet
      // d'apparition part en cascade (en queue de file)
      queueArrivalEffects(
        p.seat,
        deps.getCard(deps.getState().instances[instanceId]?.cardId ?? null),
        instanceId,
      );
    }
    const remaining = p.remaining - 1;
    const picked = (p.picked ?? 0) + 1;
    const stillHas = effectPickIds.value.length > 0;
    if (remaining > 0 && stillHas) {
      effectPicking.value = { ...p, remaining, picked };
      return;
    }
    effectPicking.value = null;
    // COÛT « Recyclez jusqu'à N … » (upTo) terminé (max atteint / pile épuisée) :
    // lie le nombre RÉELLEMENT recyclé à la frame retenue avant de reprendre le corps.
    if (p.upTo) bindCountToHeldFrame(picked);
    pumpEffects();
  }

  /**
   * Pose `boundCount` sur la frame en tête de file (le CORPS retenu via holdRest)
   * — fin d'un recyclage « jusqu'à N » (costRecycle{max:true}). Les ops du corps
   * `fromCount:true` lisent ce nombre comme magnitude.
   */
  function bindCountToHeldFrame(count: number): void {
    const head = effectQueue.value[0];
    if (!head) return;
    effectQueue.value = [
      { ...head, boundCount: count },
      ...effectQueue.value.slice(1),
    ];
  }

  /** Passe le choix en cours (pile vide / décision du joueur). */
  function effectPickSkip(): void {
    const p = effectPicking.value;
    if (!p || p.mandatory) return; // un choix imposé ne se passe pas
    effectPicking.value = null;
    // COÛT payé interactif (costRecycle) décliné : le coût n'est PAS payé → le
    // CORPS (retenu en tête de file via holdRest) ne doit PAS s'exécuter. On
    // retire la frame abandonnée, comme effectTargetSkip pour un coût de ciblage.
    if (p.cost) {
      effectQueue.value = effectQueue.value.slice(1);
      deps.dispatch(
        say(p.seat, `${p.cardName} : coût non payé, pouvoir annulé.`),
      );
      pumpEffects();
      return;
    }
    // COÛT « Recyclez JUSQU'À N … » (upTo) : passer ARRÊTE le recyclage sans
    // annuler le pouvoir (« jusqu'à » admet d'en recycler moins, voire 0). On lie
    // le nombre déjà recyclé (`picked`) à la frame retenue et on poursuit le CORPS.
    if (p.upTo) {
      const picked = p.picked ?? 0;
      bindCountToHeldFrame(picked);
      deps.dispatch(
        say(p.seat, `${p.cardName} : ${picked} carte(s) recyclée(s).`),
      );
      pumpEffects();
      return;
    }
    deps.dispatch(say(p.seat, `${p.cardName} : choix passé.`));
    pumpEffects();
  }

  const effectTargetIdsList = computed(() =>
    effectTargeting.value
      ? effectTargetIds(
          deps.rulesCtx(),
          effectTargeting.value.op,
          effectTargeting.value.seat,
          effectTargeting.value.sourceId,
          // Ciblage multi-cibles « différents » : exclure les cibles déjà choisies.
          effectTargeting.value.multi?.distinct
            ? new Set(effectTargeting.value.multi.chosen)
            : undefined,
        )
      : [],
  );

  /**
   * Nombre d'instances EN JEU (Monde + Havre-Sac) contrôlées par `seat` qui
   * matchent le `countSpec` (« … que vous contrôlez ») : type `what` et Famille
   * `sub` éventuelle. Un Équipement attaché est co-localisé avec son Porteur
   * (ATTACH → equip.location = bearer.location), donc bien compté. Miroir de la
   * condition `controlsAlly` (compte exact, aucune approximation).
   */
  function countControlled(spec: CountSpec, seat: Seat): number {
    const sub = spec.sub ? normWord(spec.sub) : undefined;
    let count = 0;
    for (const inst of Object.values(deps.getState().instances)) {
      if (inst.controller !== seat) continue;
      const zone = inst.location.zone;
      if (zone !== "monde" && zone !== "havreSac") continue;
      const card = deps.getCard(inst.cardId);
      if (!card || card.mainType !== spec.what) continue;
      if (sub && !(card.subTypes ?? []).some((s) => normWord(s) === sub))
        continue;
      count++;
    }
    return count;
  }

  /**
   * ÉVALUATEUR UNIQUE d'une `ValueExpr` (représentation canonique d'une valeur
   * dynamique, modèle Forge « Count$ ») à la résolution. Un `switch` exhaustif
   * sur `kind` — chaque nœud a une sémantique fidèle et déterministe :
   *  - `fixed` : le littéral porté par le nœud ;
   *  - `count` : compte d'état « … que vous contrôlez » (countControlled).
   * Les futurs nœuds (boundCount / statOf / mirror / plus) s'ajoutent ici avec
   * leur effet consommateur.
   */
  function evalValue(expr: ValueExpr, frame: EffectFrame): number {
    switch (expr.kind) {
      case "fixed":
        return expr.n;
      case "count":
        return countControlled(expr.of, frame.seat);
    }
  }

  /**
   * Magnitude EFFECTIVE d'une op à valeur scalaire, résolue à la résolution :
   *  - `value` (ValueExpr) → évaluateur canonique `evalValue`, prioritaire ;
   *  - `fromCount` (COÛT « Recyclez jusqu'à N … », forme LEGACY) → nombre
   *    recyclé lié à la frame (boundCount, défaut 0) × `perCount` (défaut 1) —
   *    sera replié en `value:{kind:"boundCount"}` dans un incrément ultérieur ;
   *  - sinon la valeur fixe `n`.
   */
  function opMagnitude(
    op: {
      n?: number;
      fromCount?: boolean;
      perCount?: number;
      value?: ValueExpr;
    },
    frame: EffectFrame,
  ): number {
    if (op.value) return evalValue(op.value, frame);
    if (op.fromCount) return (frame.boundCount ?? 0) * (op.perCount ?? 1);
    return op.n ?? 0;
  }

  /**
   * Évalue une CONDITION « Si <cond> » contre l'état courant, bornée à l'acteur
   * (`seat`) et à la source (`sourceId`) de la frame. PURE de lecture (aucune
   * mutation) — chaque branche ne lit que ce qu'elle peut FAITHFULLY déterminer.
   * Une condition dont la source/le Héros est absent retourne `false` (le corps
   * ne s'exécute pas — fidèle : la prémisse n'est pas remplie).
   */
  function evalCond(cond: CondSpec, seat: Seat, sourceId?: string): boolean {
    switch (cond.cond) {
      case "selfInZone": {
        // « si [self] est dans le Monde / son Havre-Sac » : la SOURCE de l'effet
        // est-elle dans la zone donnée à la résolution ?
        const src = sourceId ? deps.getState().instances[sourceId] : null;
        return !!src && src.location.zone === cond.zone;
      }
      case "heroLevel": {
        // « si votre Héros est de Niveau N (ou plus / ou moins) ».
        const lvl = heroLevel(deps.rulesCtx(), seat);
        if (cond.op === ">=") return lvl >= cond.n;
        if (cond.op === "<=") return lvl <= cond.n;
        return lvl === cond.n;
      }
      case "controlsAlly": {
        // « si vous contrôlez (au moins `min`) [Allié] [Famille] » : compte VOS
        // Alliés en jeu (Monde + Havre-Sac) matchant la Famille `sub`.
        const sub = cond.sub ? normWord(cond.sub) : undefined;
        const min = cond.min ?? 1;
        let count = 0;
        for (const inst of Object.values(deps.getState().instances)) {
          if (inst.controller !== seat) continue;
          const zone = inst.location.zone;
          if (zone !== "monde" && zone !== "havreSac") continue;
          const card = deps.getCard(inst.cardId);
          if (!card || card.mainType !== "Allié") continue;
          if (sub && !(card.subTypes ?? []).some((s) => normWord(s) === sub))
            continue;
          count++;
          if (count >= min) return true;
        }
        return count >= min;
      }
    }
  }

  /**
   * Exécute les ops de la frame de tête ; retourne `true` si une op
   * interactive met la frame en pause (le reste attend via `holdRest`).
   */
  function runFrame(frame: EffectFrame): boolean {
    const { seat, cardName, sourceId } = frame;
    const ops = frame.ops;
    for (let i = 0; i < ops.length; i++) {
      let op = ops[i];
      if (op.op === "conditional") {
        // « Si <cond>, <corps> » : on évalue la condition à la RÉSOLUTION. Si
        // vraie, on APLATIT le corps dans le flux d'ops (devant le reste de la
        // frame) et on relance la frame ainsi reconstruite — les ops à cible /
        // pile du corps mettent alors la frame en pause exactement comme à plat.
        // Si fausse, le corps est sauté (no-op fidèle), on poursuit.
        if (evalCond(op.cond, seat, sourceId)) {
          const body = op.ops as EffectOp[];
          holdRest(frame, [...body, ...ops.slice(i + 1)]);
          return runFrame(effectQueue.value[0]);
        }
        deps.dispatch(
          say(seat, `${cardName} : condition non remplie, effet passé.`),
        );
        continue;
      }
      if (op.op === "chooseOne") {
        // « A ou B » — CHOIX EXCLUSIF du joueur. On présente les deux branches
        // étiquetées (effectChoices : deux boutons) ; la branche choisie
        // s'exécute, l'autre est ignorée. Le RESTE de la frame (ops après le
        // choix) est aplati dans CHAQUE branche pour reprendre après résolution
        // (« … ou … Piochez une carte »). La frame courante est CONSOMMÉE (return
        // false) : sa continuation vit désormais dans les branches du choix, en
        // attente du clic du joueur (effectChoices n'est pas une barrière de pump,
        // résolu hors-bande via l'overlay). Les ops AVANT le choix ont déjà tourné.
        const rest = ops.slice(i + 1);
        const [a, b] = op.options;
        effectChoices.value = [
          ...effectChoices.value,
          {
            seat,
            cardName,
            text: op.prompt ?? `${a.label} ou ${b.label}`,
            ops: [...(a.ops as EffectOp[]), ...rest],
            declineOps: [...(b.ops as EffectOp[]), ...rest],
            optionLabels: [a.label, b.label],
            ...(sourceId ? { sourceId } : {}),
          },
        ];
        return false;
      }
      if (op.op === "eachPlayerOptional") {
        // « CHAQUE JOUEUR PEUT <corps> » : une confirmation INDÉPENDANTE par
        // siège (joueur actif d'abord), chacune exécutant le corps DE SON POINT
        // DE VUE (effectChoiceResolve enfile une frame avec choice.seat → un
        // ciblage controller:"self" vise SES créatures). Le reste de la frame
        // (ops après) continue immédiatement (les confirmations sont hors-bande).
        const body = op.ops as EffectOp[];
        for (const s of [seat, otherSeat(seat)]) {
          effectChoices.value = [
            ...effectChoices.value,
            {
              seat: s,
              cardName,
              text: `${cardName} — ${deps.playerName(s)} : peut agir`,
              ops: body,
            },
          ];
        }
        continue;
      }
      if (isTargetingOp(op)) {
        // VALEUR DYNAMIQUE liée au coût « Recyclez jusqu'à N … » : pour les ops à
        // cible à magnitude (damageTarget/buffForceTarget/healHeroTarget) marquées
        // `fromCount`, on FIGE `n` au nombre recyclé AVANT le ciblage (le clic du
        // joueur lit `t.op.n`). Recyclé 0 → n 0 (Dommages/soin/bonus de 0, fidèle).
        // NB : uniquement les ops SCALAIRES (avec `n`) — tapMultiTarget/
        // untapMultiTarget portent aussi `fromCount` mais n'ont pas de `n` (le
        // compte pilote `multi.remaining`, calculé plus bas), on ne les fige pas.
        if ("fromCount" in op && op.fromCount && "n" in op) {
          op = { ...op, n: opMagnitude(op, frame) };
        }
        // INCLINAISON/REDRESSEMENT MULTI-CIBLES À COMPTE LIÉ : si le compte
        // (boundCount, ex. cartes défaussées/recyclées) est 0, aucun choix →
        // no-op fidèle (rien à incliner/redresser), pas de picker vide.
        if (
          (op.op === "tapMultiTarget" || op.op === "untapMultiTarget") &&
          opMagnitude(op, frame) === 0
        ) {
          deps.dispatch(
            say(seat, `${cardName} : aucune cible (0), effet passé.`),
          );
          continue;
        }
        const eligible = effectTargetIds(deps.rulesCtx(), op, seat, sourceId);
        if (!eligible.length) {
          // COÛT payé sans cible éligible : le coût ne peut PAS être payé, donc
          // le CORPS ne doit pas s'exécuter — on ABANDONNE toute la frame
          // (au lieu de `continue` vers les ops suivantes du corps).
          if (isCostTargetingOp(op)) {
            deps.dispatch(
              say(
                seat,
                `${cardName} : aucune créature pour payer le coût, pouvoir annulé.`,
              ),
            );
            return false; // frame consommée sans pause (corps non exécuté)
          }
          deps.dispatch(
            say(seat, `${cardName} : aucune cible légale, effet passé.`),
          );
          continue;
        }
        effectTargeting.value = {
          seat,
          cardName,
          op,
          sourceId,
          // DOMMAGES MULTI-CIBLES BORNÉS : ouvre un ciblage RÉPÉTÉ (jusqu'à
          // op.count cibles). effectTargetChoose ré-ouvre tant que `remaining > 0`
          // et qu'il reste des cibles ; effectTargetSkip clôt (« jusqu'à »).
          ...(op.op === "damageMultiTarget"
            ? {
                multi: {
                  remaining: op.count,
                  distinct: !!op.distinct,
                  chosen: [],
                },
              }
            : op.op === "tapMultiTarget" || op.op === "untapMultiTarget"
              ? {
                  // Compte = boundCount (fromCount) ; cibles DISTINCTES (on
                  // n'incline pas deux fois la même). « Jusqu'à » implicite : le
                  // joueur peut s'arrêter (effectTargetSkip).
                  multi: {
                    remaining: opMagnitude(op, frame),
                    distinct: true,
                    chosen: [],
                  },
                }
              : {}),
        };
        holdRest(frame, ops.slice(i + 1));
        return true;
      }
      if (op.op === "shuffleDeck") {
        deps.shufflePioche(seat);
        continue;
      }
      if (op.op === "searchDeck") {
        // « Cherchez … dans votre Pioche / Défausse … » : même machinerie de
        // pick, la pile source dépend de `from` (défaut "pioche").
        const fromZone = op.from === "defausse" ? "defausse" : "pioche";
        const filter: PickFilter = {
          mainType: op.what,
          ...(op.sub ? { sub: op.sub } : {}),
          ...(op.maxLevel !== undefined ? { maxLevel: op.maxLevel } : {}),
          ...(op.exactLevel !== undefined ? { exactLevel: op.exactLevel } : {}),
        };
        const hasMatch = deps
          .getState()
          .seats[
            seat
          ][fromZone].some((id) => matchesPickFilter(deps.getCard(deps.getState().instances[id]?.cardId ?? null), filter));
        if (!hasMatch) {
          deps.dispatch(
            say(
              seat,
              `${cardName} : aucune carte correspondante dans la ${fromZone === "defausse" ? "Défausse" : "Pioche"}.`,
            ),
          );
          continue;
        }
        effectPicking.value = {
          seat,
          cardName,
          zone: fromZone,
          action: op.dest === "main" ? "toHand" : "toMonde",
          filter,
          ...(op.tapped ? { enterTapped: true } : {}),
          remaining: 1,
          sourceId,
        };
        holdRest(frame, ops.slice(i + 1));
        return true;
      }
      if (op.op === "putInPlay") {
        // « Mettez en jeu un [type] [Famille]? [de Niveau ≤ N]? de votre
        // main / Défausse. » — même machinerie de pick que searchDeck, mais la
        // zone source est la main ou la Défausse (action toMonde : le pick
        // déplace en Monde, oriente si enterTapped, et déclenche les effets
        // d'apparition de la carte mise en jeu via queueArrivalEffects).
        const filter: PickFilter = {
          mainType: op.what,
          ...(op.sub ? { sub: op.sub } : {}),
          ...(op.maxLevel !== undefined ? { maxLevel: op.maxLevel } : {}),
          ...(op.exactLevel !== undefined ? { exactLevel: op.exactLevel } : {}),
          ...(op.levelIn ? { levelIn: op.levelIn } : {}),
        };
        const hasMatch = deps
          .getState()
          .seats[
            seat
          ][op.from].some((id) => matchesPickFilter(deps.getCard(deps.getState().instances[id]?.cardId ?? null), filter));
        if (!hasMatch) {
          deps.dispatch(
            say(
              seat,
              `${cardName} : rien à mettre en jeu (aucune carte correspondante en ${op.from === "main" ? "main" : "Défausse"}).`,
            ),
          );
          continue;
        }
        effectPicking.value = {
          seat,
          cardName,
          zone: op.from,
          action: "toMonde",
          filter,
          ...(op.tapped ? { enterTapped: true } : {}),
          remaining: 1,
          sourceId,
        };
        holdRest(frame, ops.slice(i + 1));
        return true;
      }
      if (op.op === "recycleFromDiscard" || op.op === "discardFromHand") {
        const zone = op.op === "recycleFromDiscard" ? "defausse" : "main";
        const filter: PickFilter | undefined =
          op.op === "recycleFromDiscard" && op.element
            ? { element: op.element }
            : undefined;
        const hasMatch = deps
          .getState()
          .seats[
            seat
          ][zone].some((id) => matchesPickFilter(deps.getCard(deps.getState().instances[id]?.cardId ?? null), filter));
        if (!hasMatch) {
          deps.dispatch(
            say(
              seat,
              `${cardName} : rien à ${op.op === "recycleFromDiscard" ? "recycler" : "défausser"}${filter ? ` (aucune carte ${filter.element})` : ""}, effet passé.`,
            ),
          );
          continue;
        }
        effectPicking.value = {
          seat,
          cardName,
          zone,
          action: op.op === "recycleFromDiscard" ? "recycle" : "discard",
          ...(filter ? { filter } : {}),
          remaining: op.n,
          sourceId,
        };
        holdRest(frame, ops.slice(i + 1));
        return true;
      }
      if (op.op === "banishFromZone") {
        // « Bannissez la carte [l'Équipement…] de votre choix de la Défausse
        // d'un adversaire » : choix INTERACTIF dans la Défausse de l'adversaire
        // (owner = otherSeat), la carte choisie part en EXIL de son propriétaire
        // (action "banish"). Si la pile (filtrée) est vide → no-op fidèle (rien
        // à bannir), on poursuit le reste de la frame (« puis piochez … »).
        const owner = op.controller === "opponent" ? otherSeat(seat) : seat;
        const filter: PickFilter | undefined = op.what
          ? { mainType: op.what }
          : undefined;
        const hasMatch = deps
          .getState()
          .seats[
            owner
          ][op.from].some((id) => matchesPickFilter(deps.getCard(deps.getState().instances[id]?.cardId ?? null), filter));
        if (!hasMatch) {
          deps.dispatch(
            say(
              seat,
              `${cardName} : rien à bannir dans la Défausse adverse, effet passé.`,
            ),
          );
          continue;
        }
        effectPicking.value = {
          seat,
          cardName,
          owner,
          zone: op.from,
          action: "banish",
          ...(filter ? { filter } : {}),
          remaining: 1,
          sourceId,
        };
        holdRest(frame, ops.slice(i + 1));
        return true;
      }
      if (op.op === "costDiscard") {
        // COÛT « Défaussez [jusqu'à] N carte(s) : CORPS » — défausse depuis la
        // MAIN (première op d'une séquence paidOps). Miroir de costRecycle{max}
        // mais zone=main / action=discard. `max` → défausse OPTIONNELLE 0..N
        // (toujours payée ; boundCount = nombre réellement défaussé, lu par les
        // ops `fromCount`). Sans `max` : défausse IMPOSÉE de `n` (abandon si la
        // main n'a pas assez — le corps ne s'exécute pas).
        const hand = deps.getState().seats[seat].main;
        if (op.max) {
          if (hand.length === 0) {
            holdRest(frame, [...ops.slice(i + 1)]);
            effectQueue.value = [
              { ...effectQueue.value[0], boundCount: 0 },
              ...effectQueue.value.slice(1),
            ];
            deps.dispatch(
              say(
                seat,
                `${cardName} : aucune carte à défausser (0 défaussée).`,
              ),
            );
            continue;
          }
          effectPicking.value = {
            seat,
            cardName,
            zone: "main",
            action: "discard",
            upTo: true,
            picked: 0,
            remaining: op.n ?? 1,
            sourceId,
          };
          holdRest(frame, ops.slice(i + 1));
          return true;
        }
        if (hand.length < (op.n ?? 1)) {
          deps.dispatch(
            say(
              seat,
              `${cardName} : pas assez de cartes en main pour payer le coût, pouvoir annulé.`,
            ),
          );
          return false; // coût impayable → corps non exécuté
        }
        effectPicking.value = {
          seat,
          cardName,
          zone: "main",
          action: "discard",
          remaining: op.n ?? 1,
          sourceId,
        };
        holdRest(frame, ops.slice(i + 1));
        return true;
      }
      if (op.op === "costRecycle") {
        // COÛT « Recyclez … : CORPS » — première op d'une séquence cost:"paidOps".
        // Recycler = remettre une carte SOUS la Pioche de son propriétaire. Le
        // coût doit être payé ENTIÈREMENT, sinon le CORPS (ops suivantes) ne
        // s'exécute pas — on ABANDONNE la frame (return false sans pause), comme
        // costTap/costDestroyControlled.
        const from = op.from ?? "defausse";
        if (from === "self") {
          // Recycle la SOURCE elle-même (aucune interaction). La source doit être
          // en jeu (Monde / Havre-Sac) ; sinon le coût ne peut pas être payé.
          const src = sourceId ? deps.getState().instances[sourceId] : null;
          const inPlay =
            src &&
            (src.location.zone === "monde" || src.location.zone === "havreSac");
          if (!inPlay) {
            deps.dispatch(
              say(
                seat,
                `${cardName} : la carte n'est pas en jeu, pouvoir annulé.`,
              ),
            );
            return false; // coût non payable → corps non exécuté
          }
          deps.moveTo(
            sourceId!,
            { zone: "pioche", owner: src!.owner },
            { at: "bottom" },
          );
          deps.dispatch(
            say(seat, `${cardName} : la carte est recyclée sous la Pioche.`),
          );
          continue; // coût payé → le corps suit
        }
        // from "defausse" / "main" : choix INTERACTIF dans la pile.
        const zone = from === "main" ? "main" : "defausse";
        // Filtre éventuel : Élément (« une carte [Feu] ») et/ou TYPE/Famille
        // (« jusqu'à N Monstres / Alliés »). Absent = toute carte recyclable.
        const filter: PickFilter | undefined =
          op.element || op.what || op.sub
            ? {
                ...(op.element ? { element: op.element } : {}),
                ...(op.what ? { mainType: op.what } : {}),
                ...(op.sub ? { sub: op.sub } : {}),
              }
            : undefined;
        const hasMatch = deps
          .getState()
          .seats[
            seat
          ][zone].some((id) => matchesPickFilter(deps.getCard(deps.getState().instances[id]?.cardId ?? null), filter));
        // « Recyclez JUSQU'À N … » (max) : recyclage OPTIONNEL 0..N. Le coût est
        // TOUJOURS payé (« jusqu'à » admet 0) ; si rien n'est recyclable, on lie
        // boundCount = 0 et le CORPS tourne (magnitude 0, no-op fidèle) — pas
        // d'abandon. Sinon (W21) : recyclage IMPOSÉ de `n` cartes, abandon si rien.
        if (op.max) {
          if (!hasMatch) {
            holdRest(frame, [...ops.slice(i + 1)]);
            // boundCount = 0 sur la frame retenue, puis on poursuit.
            effectQueue.value = [
              { ...effectQueue.value[0], boundCount: 0 },
              ...effectQueue.value.slice(1),
            ];
            deps.dispatch(
              say(seat, `${cardName} : aucune carte à recycler (0 recyclée).`),
            );
            continue;
          }
          effectPicking.value = {
            seat,
            cardName,
            zone,
            action: "recycle",
            ...(filter ? { filter } : {}),
            upTo: true,
            picked: 0,
            remaining: op.n ?? 1,
            sourceId,
          };
          holdRest(frame, ops.slice(i + 1));
          return true;
        }
        // Si rien n'est recyclable (pile vide / aucune carte de l'Élément), le coût
        // ne peut pas être payé → on abandonne la frame (corps non exécuté).
        if (!hasMatch) {
          deps.dispatch(
            say(
              seat,
              `${cardName} : rien à recycler${filter ? ` (aucune carte ${filter.element})` : ""}, pouvoir annulé.`,
            ),
          );
          return false; // coût non payable → corps non exécuté
        }
        effectPicking.value = {
          seat,
          cardName,
          zone,
          action: "recycle",
          ...(filter ? { filter } : {}),
          cost: true,
          remaining: op.n ?? 1,
          sourceId,
        };
        holdRest(frame, ops.slice(i + 1));
        return true;
      }
      if (op.op === "buffForceSelf") {
        const src = sourceId ? deps.getState().instances[sourceId] : null;
        const inPlay =
          src &&
          (src.location.zone === "monde" || src.location.zone === "havreSac");
        if (inPlay) {
          deps.dispatch(
            incCounterVerb(seat, sourceId!, "forceMod", op.n, true),
            say(
              seat,
              `${cardName} gagne +${op.n} en Force jusqu'à la fin du tour.`,
            ),
          );
        }
      } else if (op.op === "grantKeywordSelf") {
        // « [self] gagne <Mot-clé> jusqu'à la fin du tour. » (Ouassingue : Géant) —
        // jeton TURN-scoped `<kw>TurnMod` (geantTurnMod / agiliteTurnMod /
        // agressiviteTurnMod) sur la SOURCE (uniquement en jeu), purgé en fin de
        // tour (isTurnToken), lu par effectiveKeywords → légalité de combat.
        // Distinct de combatModSelf (geantCombatMod, portée combat).
        const src = sourceId ? deps.getState().instances[sourceId] : null;
        const inPlay =
          src &&
          (src.location.zone === "monde" || src.location.zone === "havreSac");
        if (inPlay) {
          deps.dispatch(
            setCounterVerb(
              seat,
              sourceId!,
              GRANT_KEYWORD_TOKEN[op.keyword],
              1,
              true,
            ),
            say(
              seat,
              `${cardName} gagne ${op.keyword} jusqu'à la fin du tour.`,
            ),
          );
        }
      } else if (op.op === "grantKeywordBearerSelf") {
        // « Le Porteur de <self> gagne <Mot-clé> jusqu'à la fin du tour. »
        // (Scarature Blanche) — la SOURCE est un Équipement ; on pose le jeton
        // TURN-scoped sur SON PORTEUR (l'instance dont `attachments` contient la
        // source, en jeu). No-op fidèle si la source n'est pas portée.
        const insts = deps.getState().instances;
        const bearer = sourceId
          ? Object.values(insts).find((i) => i.attachments?.includes(sourceId))
          : null;
        const inPlay =
          bearer &&
          (bearer.location.zone === "monde" ||
            bearer.location.zone === "havreSac");
        if (bearer && inPlay) {
          deps.dispatch(
            setCounterVerb(
              seat,
              bearer.instanceId,
              GRANT_KEYWORD_TOKEN[op.keyword],
              1,
              true,
            ),
            say(
              seat,
              `Le Porteur de ${cardName} gagne ${op.keyword} jusqu'à la fin du tour.`,
            ),
          );
        }
      } else if (op.op === "grantResistanceSelf") {
        // « [self] gagne Résistance N (Élément)[…] jusqu'à la fin du tour. » —
        // jeton TURN-scoped `resMod_<el>` (+N par Élément) sur la SOURCE (en jeu),
        // purgé en fin de tour (préfixe resMod_), lu par effectiveKeywords →
        // resistances → prévention de Dommages (7469). Multi-éléments : un jeton
        // par Élément normalisé.
        const src = sourceId ? deps.getState().instances[sourceId] : null;
        const inPlay =
          src &&
          (src.location.zone === "monde" || src.location.zone === "havreSac");
        if (inPlay) {
          for (const r of op.resist) {
            deps.dispatch(
              incCounterVerb(
                seat,
                sourceId!,
                `resMod_${normElement(r.element)}`,
                r.n,
                true,
              ),
            );
          }
          deps.dispatch(
            say(
              seat,
              `${cardName} gagne ${resistanceLabel(op.resist)} jusqu'à la fin du tour.`,
            ),
          );
        }
      } else if (op.op === "createToken") {
        // « Mettez en jeu un jeton "Monstre - <Famille>" de Force N [Élément]. »
        // MINTE une créature SYNTHÉTIQUE dans le Monde du contrôleur (carte de
        // registre, pas de carte de deck) : participant de combat à part entière.
        // Un jeton n'a AUCUN effet d'apparition → on n'appelle PAS
        // queueArrivalEffects (fidèle). En revanche son apparition VEILLE les
        // autres cartes (« Quand un Allié [Famille] apparaît ») exactement comme
        // une mise en jeu normale (queueAppearanceWatchers).
        const cardId = tokenCardId({
          name: op.name,
          force: op.force,
          ...(op.element ? { element: op.element } : {}),
          ...(op.sub ? { sub: op.sub } : {}),
        });
        const tokenCard = ensureTokenCard({
          name: op.name,
          force: op.force,
          ...(op.element ? { element: op.element } : {}),
          ...(op.sub ? { sub: op.sub } : {}),
        });
        // « Mettez en jeu LE MÊME NOMBRE de jetons … » (countFromRecycled) : le
        // nombre de jetons = compte recyclé lié à la frame (boundCount, 0..N).
        // Recyclé 0 → 0 jeton (no-op fidèle). Sinon, un seul jeton (défaut W24).
        const tokenCount = op.countFromRecycled ? (frame.boundCount ?? 0) : 1;
        for (let k = 0; k < tokenCount; k++) {
          const instanceId = mintTokenInstanceId(seat);
          deps.dispatch(
            createTokenVerb(seat, {
              instanceId,
              cardId,
              controller: seat,
              // « … inclinés dans le Monde. » : entre incliné (sinon dressé).
              ...(op.tapped ? { orientation: "tapped" as const } : {}),
            }),
            say(
              seat,
              `${cardName} : un jeton « ${op.name} » (Force ${op.force})${op.tapped ? " (incliné)" : ""} entre en jeu.`,
            ),
          );
          queueAppearanceWatchers(seat, tokenCard, instanceId);
        }
      } else if (op.op === "draw") {
        // « Piochez N cartes » ou « … un nombre égal au nombre de <X> que vous
        // contrôlez » (count) → magnitude dynamique via opMagnitude.
        deps.draw(seat, opMagnitude(op, frame));
      } else if (op.op === "eachPlayerDraws") {
        // « Chaque joueur pioche N carte(s). » — joueur actif (la source) d'abord.
        deps.draw(seat, op.n);
        deps.draw(otherSeat(seat), op.n);
      } else if (op.op === "gainXp") {
        const grant = grantXpEvents(deps.rulesCtx(), seat, op.n);
        deps.dispatch(
          ...grant.events,
          ...grant.log.map((l) =>
            say(seat, `Le Héros de ${deps.playerName(seat)} ${l}`),
          ),
        );
        if (grant.won) {
          deps.onMatchWon(seat);
        }
      } else if (op.op === "heroGainPv") {
        // « Votre Héros regagne X PV » (X = nombre recyclé, costRecycle{max}) →
        // magnitude dynamique via opMagnitude (recyclé 0 → +0 PV, no-op fidèle).
        const heroId = deps.getState().seats[seat].heroInstanceId;
        const amount = opMagnitude(op, frame);
        if (heroId && amount) deps.adjustCounter(heroId, "hp", amount);
      } else if (op.op === "heroLosePv") {
        const heroId = deps.getState().seats[seat].heroInstanceId;
        if (heroId) deps.adjustCounter(heroId, "hp", -op.n);
      } else if (op.op === "damageOppHero") {
        const oppHeroId = deps.getState().seats[otherSeat(seat)].heroInstanceId;
        if (oppHeroId) deps.adjustCounter(oppHeroId, "hp", -op.n);
      } else if (op.op === "havreSacGainResistance") {
        const sacId = deps.getState().seats[seat].havreSacInstanceId;
        if (sacId) deps.adjustCounter(sacId, "resistance", op.n);
      } else if (op.op === "tapSelf") {
        const src = sourceId ? deps.getState().instances[sourceId] : null;
        const inPlay =
          src &&
          (src.location.zone === "monde" || src.location.zone === "havreSac");
        if (inPlay && src!.orientation === "upright") {
          deps.dispatch({
            actor: seat,
            type: "SET_ORIENTATION",
            payload: { instanceId: sourceId!, orientation: "tapped" },
          });
        }
      } else if (op.op === "untapSelf") {
        // « Redressez [cette carte] » — SET_ORIENTATION upright sur la source
        // (no-op si déjà dressée). Pendant de tapSelf.
        const src = sourceId ? deps.getState().instances[sourceId] : null;
        const inPlay =
          src &&
          (src.location.zone === "monde" || src.location.zone === "havreSac");
        if (inPlay && src!.orientation === "tapped") {
          deps.dispatch({
            actor: seat,
            type: "SET_ORIENTATION",
            payload: { instanceId: sourceId!, orientation: "upright" },
          });
        }
      } else if (op.op === "loseStatTurn") {
        const heroId = deps.getState().seats[seat].heroInstanceId;
        if (heroId) {
          deps.dispatch(
            incCounterVerb(
              seat,
              heroId,
              op.stat === "pa" ? "paMod" : "pmMod",
              -op.n,
              true,
            ),
            say(
              seat,
              `${deps.playerName(seat)} perd ${op.n} ${op.stat.toUpperCase()} jusqu'à la fin du tour.`,
            ),
          );
        }
      } else if (op.op === "oppLoseStatTurn") {
        // « Tous vos adversaires perdent N PA/PM » — en 1v1, le Héros adverse.
        const oppHeroId = deps.getState().seats[otherSeat(seat)].heroInstanceId;
        if (oppHeroId) {
          deps.dispatch(
            incCounterVerb(
              otherSeat(seat),
              oppHeroId,
              op.stat === "pa" ? "paMod" : "pmMod",
              -op.n,
              true,
            ),
            say(
              seat,
              `${deps.playerName(otherSeat(seat))} perd ${op.n} ${op.stat.toUpperCase()} jusqu'à la fin du tour.`,
            ),
          );
        }
      } else if (op.op === "buffForceHeroSelf") {
        // « Votre Héros gagne +N en Force » — jeton forceMod (fin de tour).
        const heroId = deps.getState().seats[seat].heroInstanceId;
        if (heroId) {
          deps.dispatch(
            incCounterVerb(seat, heroId, "forceMod", op.n, true),
            say(
              seat,
              `Votre Héros gagne +${op.n} en Force jusqu'à la fin du tour.`,
            ),
          );
        }
      } else if (op.op === "teamCombatDmgReduction") {
        // « Jusqu'à la fin du combat, vos Alliés/Héros attaquants ou bloqueurs
        // subissent −N Dommages » : jeton teamDmgRedCombatMod sur le Héros (suffixe
        // *CombatMod → purgé en fin de tour ; reduceDamage le lit pour les cibles
        // en rôle de combat de ce siège). CUMUL si joué plusieurs fois (incCounter).
        const heroId = deps.getState().seats[seat].heroInstanceId;
        if (heroId) {
          deps.dispatch(
            incCounterVerb(seat, heroId, "teamDmgRedCombatMod", op.n, true),
            say(
              seat,
              `${cardName} : vos attaquants/bloqueurs subissent ${op.n} Dommage(s) de moins jusqu'à la fin du combat.`,
            ),
          );
        }
      } else if (op.op === "untapHeroSelf") {
        // « Redressez votre Héros » — SET_ORIENTATION upright (no-op si déjà dressé).
        const heroId = deps.getState().seats[seat].heroInstanceId;
        const hero = heroId ? deps.getState().instances[heroId] : null;
        if (heroId && hero && hero.orientation === "tapped") {
          deps.dispatch(
            {
              actor: seat,
              type: "SET_ORIENTATION",
              payload: { instanceId: heroId, orientation: "upright" },
            },
            say(seat, "Votre Héros est redressé."),
          );
        }
      } else if (op.op === "destroySelf") {
        const src = sourceId ? deps.getState().instances[sourceId] : null;
        const inPlay =
          src &&
          (src.location.zone === "monde" || src.location.zone === "havreSac");
        if (inPlay) {
          deps.dispatch(
            move(seat, {
              instanceId: sourceId!,
              from: src!.location,
              to: { zone: "defausse", owner: src!.owner },
              position: { at: "top" },
              visibility: { faceDown: false, visibleTo: "all" },
              preservesIdentity: false,
            }),
            say(seat, `${cardName} est détruit.`),
          );
        }
      } else if (op.op === "combatModSelf") {
        const src = sourceId ? deps.getState().instances[sourceId] : null;
        const inPlay =
          src &&
          (src.location.zone === "monde" || src.location.zone === "havreSac");
        if (inPlay) {
          // Jetons de COMBAT posés sur la source (purgés en fin de combat/tour
          // par isTurnToken) : Force lue par effectiveForce, Géant par
          // effectiveKeywords. Le +PM a déjà servi au plafond d'attaquants.
          const drafts: DraftEvent[] = [];
          if (op.force)
            drafts.push(
              incCounterVerb(seat, sourceId!, "forceCombatMod", op.force, true),
            );
          if (op.pm)
            drafts.push(
              incCounterVerb(seat, sourceId!, "pmCombatMod", op.pm, true),
            );
          if (op.geant)
            drafts.push(
              setCounterVerb(seat, sourceId!, "geantCombatMod", 1, true),
            );
          const parts = [
            op.force ? `+${op.force} en Force` : null,
            op.geant ? "Géant" : null,
          ].filter(Boolean);
          deps.dispatch(
            ...drafts,
            say(
              seat,
              `${cardName} — pendant ce combat : ${parts.join(" et ") || "modificateur"}.`,
            ),
          );
        }
      } else if (op.op === "buffForceAlliesMondeTurn") {
        const heroId = deps.getState().seats[seat].heroInstanceId;
        if (heroId) {
          // 812.3b — jeton de SIÈGE sur le Héros (ensemble dynamique) : tout
          // Allié du Monde du siège en profite. "heroLevel" est figé au Niveau
          // courant au moment de résoudre.
          const n =
            op.n === "heroLevel" ? heroLevel(deps.rulesCtx(), seat) : op.n;
          deps.dispatch(
            incCounterVerb(seat, heroId, "teamForceMod", n, true),
            say(
              seat,
              `Vos Alliés du Monde gagnent +${n} en Force jusqu'à la fin du tour.`,
            ),
          );
        }
      } else if (op.op === "globalDamageShield") {
        const heroId = deps.getState().seats[seat].heroInstanceId;
        if (heroId) {
          // « jusqu'au début de votre prochain tour » : actif pendant le tour
          // adverse, purgé à l'entrée de votre tour suivant (numéro + 2).
          deps.dispatch(
            setCounterVerb(
              seat,
              heroId,
              "treveUntilTurn",
              deps.getState().turn.number + 2,
              true,
            ),
            say(
              seat,
              "Trêve — tous les Dommages sont réduits à 0 jusqu'au début de votre prochain tour.",
            ),
          );
        }
      } else if (op.op === "destroyAll") {
        // DESTRUCTION DE MASSE (board-wipe, non interactive) : détruit TOUTES les
        // créatures en jeu correspondant aux filtres, sans choix du joueur. Chaque
        // cible passe par resolveDestroyTarget (415.1 : un Allié détruit rapporte
        // son XP à l'adversaire de son contrôleur). Ordre STABLE (tri des
        // instanceId) pour un déroulé déterministe.
        const ids = massEligibleIds(op, seat).sort();
        const wipeFrames: TriggeredFrame[] = [];
        for (const id of ids) {
          // 804.7 — collecte « Quand [self] est détruit » AVANT le dispatch (l'art
          // est encore lisible, même pour un jeton supprimé par le reducer en
          // quittant le jeu) ; chaque cible de masse va en Défausse (415.1).
          const ctx = deps.rulesCtx();
          const inst = ctx.state.instances[id];
          if (inst)
            wipeFrames.push(
              ...collectTriggeredEffects(ctx, [
                {
                  kind: "destroyed",
                  instanceId: id,
                  controller: inst.controller,
                },
              ]),
            );
          const res = resolveDestroyTarget(ctx, seat, id);
          deps.dispatch(...res.events, ...res.log.map((l) => say(seat, l)));
        }
        if (ids.length)
          deps.dispatch(
            say(seat, `${cardName} : créatures détruites en masse.`),
          );
        // Les déclenchés de mort partent APRÈS toutes les destructions de la
        // rafale (804.7) ; frames collectées sur l'état pré-destruction de chaque
        // cible (art lisible), enfilées maintenant.
        if (deps.isAssistEffects() && wipeFrames.length)
          enqueueTriggered(wipeFrames);
        deps.checkVictory();
      } else if (
        op.op === "tapAll" ||
        op.op === "untapAll" ||
        op.op === "damageAll"
      ) {
        // OPS DE MASSE (non interactives) : appliquent l'effet à TOUTES les
        // créatures en jeu correspondant aux filtres, sans choix du joueur. Ordre
        // STABLE (tri des instanceId) pour un déroulé déterministe côté joueur actif.
        const ids = massEligibleIds(op, seat).sort();
        if (op.op === "tapAll") {
          for (const id of ids) {
            const inst = deps.getState().instances[id];
            if (!inst || inst.orientation !== "upright") continue;
            deps.dispatch({
              actor: seat,
              type: "SET_ORIENTATION",
              payload: { instanceId: id, orientation: "tapped" },
            });
          }
          deps.dispatch(
            say(seat, `${cardName} : créatures inclinées en masse.`),
          );
        } else if (op.op === "untapAll") {
          for (const id of ids) {
            const inst = deps.getState().instances[id];
            if (!inst || inst.orientation !== "tapped") continue;
            deps.dispatch({
              actor: seat,
              type: "SET_ORIENTATION",
              payload: { instanceId: id, orientation: "upright" },
            });
          }
          deps.dispatch(
            say(seat, `${cardName} : créatures redressées en masse.`),
          );
        } else {
          // damageAll : chaque cible subit resolveDamageTarget (Résistance /
          // létalité / XP par cible), de l'Élément de la source vivante (410.1)
          // ou, à défaut, de l'Élément figé à la compilation.
          const element = liveSourceElement(sourceId) ?? op.element;
          const mods = activeGlobalMods(deps.rulesCtx());
          for (const id of ids) {
            const res = resolveDamageTarget(
              deps.rulesCtx(),
              seat,
              id,
              op.n,
              element,
              { mods, ...(sourceId ? { sourceId } : {}) },
            );
            deps.dispatch(...res.events, ...res.log.map((l) => say(seat, l)));
            if (deps.isAssistEffects() && res.ruleEvents?.length)
              enqueueTriggered(
                collectTriggeredEffects(deps.rulesCtx(), res.ruleEvents),
              );
          }
          deps.checkVictory();
        }
      }
    }
    return false;
  }

  /**
   * Instances EN JEU correspondant aux filtres d'une op de MASSE (tapAll /
   * untapAll / damageAll / destroyAll) : zones autorisées, contrôleur (« vos »
   * self / « adverses » opponent / « tous » any, relatif à l'acteur), mainType
   * Allié (+ Héros si `heroes`), Famille `sub` (subTypes), Force effective ≤
   * `maxForce`, Niveau ≤ `maxLevel` / = `exactLevel` (carte sans Niveau =
   * inéligible quand un filtre de Niveau est posé), et orientation imprimée
   * (`orientation`). PUR de choix — l'effet s'applique à TOUTES les correspondances.
   */
  function massEligibleIds(
    op: {
      controller?: "self" | "opponent" | "any";
      heroes?: boolean;
      sub?: string;
      maxForce?: number;
      maxLevel?: number;
      exactLevel?: number;
      orientation?: "tapped" | "upright";
      zones: ("monde" | "havreSac")[];
    },
    actor: Seat,
  ): string[] {
    const ctx = deps.rulesCtx();
    const sub = op.sub ? normWord(op.sub) : undefined;
    const out: string[] = [];
    for (const inst of Object.values(deps.getState().instances)) {
      if (!op.zones.includes(inst.location.zone as "monde" | "havreSac"))
        continue;
      if (op.controller === "self" && inst.controller !== actor) continue;
      if (op.controller === "opponent" && inst.controller !== otherSeat(actor))
        continue;
      const card = deps.getCard(inst.cardId);
      if (!card) continue;
      const typeOk =
        card.mainType === "Allié" || (op.heroes && card.mainType === "Héros");
      if (!typeOk) continue;
      if (sub && !(card.subTypes ?? []).some((s) => normWord(s) === sub))
        continue;
      if (
        op.maxForce !== undefined &&
        effectiveForce(ctx, inst.instanceId) > op.maxForce
      )
        continue;
      // Niveau imprimé : une carte SANS Niveau est inéligible dès qu'un filtre de
      // Niveau est posé (manquant ≠ N, comme matchesPickFilter).
      const level = card.stats?.niveau?.value;
      if (
        op.maxLevel !== undefined &&
        (level === undefined || level > op.maxLevel)
      )
        continue;
      if (op.exactLevel !== undefined && level !== op.exactLevel) continue;
      if (op.orientation !== undefined && inst.orientation !== op.orientation)
        continue;
      out.push(inst.instanceId);
    }
    return out;
  }

  /**
   * Met en file les effets d'apparition d'une carte qui vient d'entrer en
   * jeu (jouée de la main ou mise en jeu par un effet).
   */
  function queueArrivalEffects(
    seat: Seat,
    card: Card | null,
    sourceId?: string,
  ): void {
    if (!deps.isAssistEffects() || !card) return;
    noteManualEffects(seat, card);
    for (const atom of arrivalEffects(card)) {
      if (atom.optional) {
        effectChoices.value = [
          ...effectChoices.value,
          {
            seat,
            cardName: card.name,
            text: atom.text,
            ops: atom.ops,
            sourceId,
          },
        ];
        continue;
      }
      deps.dispatch(
        say(seat, `Effet automatique — ${card.name} : « ${atom.text} »`),
      );
      enqueueEffect({ seat, cardName: card.name, ops: atom.ops, sourceId });
    }
    // VEILLE non-soi (804) : d'AUTRES cartes en jeu déclenchent « Quand un Allié
    // [Famille]? [adverse]? apparaît … ». La carte qui apparaît (`card`,
    // contrôlée par `seat`) ne se veille jamais elle-même au moment de sa propre
    // apparition (exclusion de `sourceId`) : elle n'est pas encore « en jeu en
    // train de veiller » à cet instant (fidélité).
    queueAppearanceWatchers(seat, card, sourceId);
  }

  /**
   * La carte qui apparaît correspond-elle au descripteur de veille ? (mainType,
   * Famille via subTypes, contrôleur relatif au veilleur.)
   */
  function appearedMatchesWatch(
    appeared: Card,
    appearedController: Seat,
    watch: NonNullable<CompiledEffect["watch"]>,
    watcherController: Seat,
  ): boolean {
    if (appeared.mainType !== watch.mainType) return false;
    if (
      watch.sub &&
      !(appeared.subTypes ?? []).some((s) => normWord(s) === watch.sub)
    )
      return false;
    if (watch.controller) {
      const want =
        watch.controller === "opponent"
          ? otherSeat(watcherController)
          : watcherController;
      if (appearedController !== want) return false;
    }
    return true;
  }

  /**
   * Scanne toutes les instances EN JEU (Monde + Havre-Sac des deux sièges) et,
   * pour chacune qui veille « Quand un Allié … apparaît » et dont le `watch`
   * correspond à la carte apparue, enfile une frame avec le contrôleur du
   * veilleur comme acteur. Exclut l'instance apparue elle-même.
   */
  function queueAppearanceWatchers(
    appearedSeat: Seat,
    appeared: Card,
    appearedId?: string,
  ): void {
    const state = deps.getState();
    const inPlayIds = [
      ...state.monde,
      ...state.seats.A.havreSac,
      ...state.seats.B.havreSac,
    ];
    for (const watcherId of inPlayIds) {
      if (watcherId === appearedId) continue; // pas de veille sur sa propre apparition
      const watcher = state.instances[watcherId];
      if (!watcher) continue;
      const watcherCard = deps.getCard(watcher.cardId);
      if (!watcherCard) continue;
      for (const atom of appearanceTriggerEffects(watcherCard)) {
        if (
          !atom.watch ||
          !appearedMatchesWatch(
            appeared,
            appearedSeat,
            atom.watch,
            watcher.controller,
          )
        )
          continue;
        // ACTOR-BINDING « il/elle … » : l'instance APPARUE est le sujet du corps
        // (sourceId = appearedId) ; le « de votre choix » reste au contrôleur du
        // veilleur (seat). Sinon, le veilleur lui-même est la source.
        const bodySourceId =
          atom.actor === "appeared" && appearedId ? appearedId : watcherId;
        if (atom.optional) {
          effectChoices.value = [
            ...effectChoices.value,
            {
              seat: watcher.controller,
              cardName: watcherCard.name,
              text: atom.text,
              ops: atom.ops,
              sourceId: bodySourceId,
            },
          ];
          continue;
        }
        deps.dispatch(
          say(
            watcher.controller,
            `Effet automatique — ${watcherCard.name} : « ${atom.text} »`,
          ),
        );
        enqueueEffect({
          seat: watcher.controller,
          cardName: watcherCard.name,
          ops: atom.ops,
          sourceId: bodySourceId,
        });
      }
    }
  }

  /**
   * Élément des Dommages d'une op à cible, lu sur la carte de l'instance SOURCE
   * vivante (410.1). Pour l'actor-binding, `sourceId` est la créature liée
   * (apparue / sélectionnée par le coût) : l'Élément suit donc cette créature,
   * pas la carte qui porte l'effet. Retourne undefined si la source est absente
   * (repli sur l'Élément figé à la compilation).
   */
  function liveSourceElement(sourceId?: string): string | undefined {
    if (!sourceId) return undefined;
    const inst = deps.getState().instances[sourceId];
    const card = inst ? deps.getCard(inst.cardId) : null;
    return card ? effectSourceElement(card) : undefined;
  }

  /**
   * Forge un `instanceId` UNIQUE pour un nouveau jeton. Déterministe à partir de
   * l'état courant : `tok_<seat>_<N>` où N est le plus petit entier libre (aucune
   * instance existante ne porte cet id). L'id est capturé DANS l'event
   * CREATE_TOKEN → le rejeu du journal reste fidèle (l'id ne dépend pas du moment
   * de génération). Sans collision avec les `ci_*` du setup ni les autres jetons.
   */
  function mintTokenInstanceId(seat: Seat): string {
    const instances = deps.getState().instances;
    let n = 1;
    let id = `tok_${seat}_${n}`;
    while (instances[id]) {
      n += 1;
      id = `tok_${seat}_${n}`;
    }
    return id;
  }

  /** Le joueur clique une cible légale : résout l'op puis continue l'effet. */
  function effectTargetChoose(instanceId: string): void {
    const t = effectTargeting.value;
    if (!t || !effectTargetIdsList.value.includes(instanceId)) return;
    // DOMMAGES MULTI-CIBLES BORNÉS (« Choisissez jusqu'à N … leur inflige X
    // Dommages ») : chaque cible choisie subit X Dommages immédiatement, puis on
    // RÉ-OUVRE le ciblage tant qu'il reste des choix (remaining) ET des cibles
    // éligibles. Le joueur peut s'arrêter avant via effectTargetSkip (« jusqu'à »).
    if (t.op.op === "damageMultiTarget" && t.multi) {
      const op = t.op;
      const res = resolveDamageTarget(
        deps.rulesCtx(),
        t.seat,
        instanceId,
        op.n,
        liveSourceElement(t.sourceId) ?? op.element,
        {
          mods: activeGlobalMods(deps.rulesCtx()),
          ...(t.sourceId ? { sourceId: t.sourceId } : {}),
        },
      );
      deps.dispatch(...res.events, ...res.log.map((l) => say(t.seat, l)));
      if (deps.isAssistEffects() && res.ruleEvents?.length)
        enqueueTriggered(
          collectTriggeredEffects(deps.rulesCtx(), res.ruleEvents),
        );
      const chosen = [...t.multi.chosen, instanceId];
      const remaining = t.multi.remaining - 1;
      // Re-calcule l'éligibilité APRÈS résolution (une cible détruite a quitté le
      // jeu) en excluant les cibles déjà touchées si « différents ».
      const stillEligible =
        remaining > 0
          ? effectTargetIds(
              deps.rulesCtx(),
              op,
              t.seat,
              t.sourceId,
              op.distinct ? new Set(chosen) : undefined,
            )
          : [];
      if (remaining > 0 && stillEligible.length) {
        effectTargeting.value = {
          ...t,
          multi: { remaining, distinct: t.multi.distinct, chosen },
        };
        // la frame (corps restant) reste retenue via holdRest ; on attend le clic.
        deps.checkVictory();
        return;
      }
      effectTargeting.value = null;
      deps.checkVictory();
      pumpEffects();
      return;
    }
    // INCLINAISON / REDRESSEMENT MULTI-CIBLES À COMPTE LIÉ (« Inclinez / Redressez
    // LE MÊME NOMBRE d'Alliés ou Héros de votre choix ») : chaque cible choisie
    // est inclinée / redressée immédiatement, puis on RÉ-OUVRE le ciblage tant
    // qu'il reste des choix (remaining) ET des cibles éligibles distinctes.
    if (
      (t.op.op === "tapMultiTarget" || t.op.op === "untapMultiTarget") &&
      t.multi
    ) {
      const op = t.op;
      const res =
        op.op === "tapMultiTarget"
          ? resolveTapTarget(deps.rulesCtx(), t.seat, instanceId)
          : resolveUntapTarget(deps.rulesCtx(), t.seat, instanceId);
      deps.dispatch(...res.events, ...res.log.map((l) => say(t.seat, l)));
      const chosen = [...t.multi.chosen, instanceId];
      const remaining = t.multi.remaining - 1;
      // Cibles TOUJOURS distinctes (une créature déjà inclinée/redressée ne se
      // repropose pas) — on exclut `chosen` de l'éligibilité recalculée.
      const stillEligible =
        remaining > 0
          ? effectTargetIds(
              deps.rulesCtx(),
              op,
              t.seat,
              t.sourceId,
              new Set(chosen),
            )
          : [];
      if (remaining > 0 && stillEligible.length) {
        effectTargeting.value = {
          ...t,
          multi: { remaining, distinct: true, chosen },
        };
        return;
      }
      effectTargeting.value = null;
      pumpEffects();
      return;
    }
    effectTargeting.value = null;
    // MAGNITUDE DYNAMIQUE À CIBLE (« Piochez un nombre de cartes égal à la valeur
    // d'XP de l'Allié de votre choix ») : on pioche la valeur d'XP (xpValue,
    // card.experience) de la cible choisie.
    if (t.op.op === "drawTargetXp") {
      const chosen = deps.getState().instances[instanceId];
      const card = chosen ? deps.getCard(chosen.cardId) : null;
      const xp = card ? xpValue(card) : 0;
      if (xp) deps.draw(t.seat, xp);
      deps.dispatch(
        say(
          t.seat,
          `${t.cardName} : pioche ${xp} carte(s) (valeur d'XP de la cible).`,
        ),
      );
      pumpEffects();
      return;
    }
    // OPS « LE JOUEUR DE VOTRE CHOIX … » : la cible choisie est un HÉROS ; l'effet
    // s'applique au CONTRÔLEUR de ce Héros (vous ou l'adversaire). Résolution via
    // deps.draw / jeton paMod·pmMod (purgé en fin de tour), pas un resolve* pur.
    if (isPlayerChoiceOp(t.op)) {
      const pop = t.op;
      const chosen = deps.getState().instances[instanceId];
      const targetSeat = chosen?.controller;
      if (targetSeat !== undefined) {
        if (pop.op === "playerDraw") {
          deps.draw(targetSeat, pop.n);
          deps.dispatch(
            say(
              t.seat,
              `${deps.playerName(targetSeat)} pioche ${pop.n} carte(s).`,
            ),
          );
        } else if (
          pop.op === "playerLoseStatTurn" ||
          pop.op === "playerGainStat"
        ) {
          // playerLoseStatTurn (perd −N) / playerGainStat (gagne +N) : jeton
          // paMod/pmMod sur le Héros choisi, purgé en fin de tour (isTurnToken).
          const delta = pop.op === "playerLoseStatTurn" ? -pop.n : pop.n;
          deps.dispatch(
            incCounterVerb(
              targetSeat,
              instanceId,
              pop.stat === "pa" ? "paMod" : "pmMod",
              delta,
              true,
            ),
            say(
              t.seat,
              `${deps.playerName(targetSeat)} ${delta < 0 ? "perd" : "gagne"} ${Math.abs(delta)} ${pop.stat.toUpperCase()} jusqu'à la fin du tour.`,
            ),
          );
        }
      }
      deps.checkVictory();
      pumpEffects();
      return;
    }
    const res =
      t.op.op === "banishTarget"
        ? // « Bannissez l'X de votre choix » : la cible est BANNIE (exil de son
          // propriétaire), SANS XP ni destruction — ne route PAS via
          // resolveDestroyTarget (fidélité : un banni n'est pas détruit).
          resolveBanishTarget(deps.rulesCtx(), t.seat, instanceId)
        : t.op.op === "destroyTarget" || t.op.op === "costDestroyControlled"
          ? // COÛT « Détruisez un de vos X » : même résolution que destroyTarget
            // (un Allié détruit rapporte son XP à l'adversaire, 415.1).
            resolveDestroyTarget(deps.rulesCtx(), t.seat, instanceId)
          : t.op.op === "costRecycleControlled"
            ? // COÛT « Recyclez un <X> de votre choix » (Vampyro) : recycle la
              // créature choisie sous la Pioche de son propriétaire.
              resolveRecycleControlled(deps.rulesCtx(), t.seat, instanceId)
            : t.op.op === "costTapControlled"
              ? // COÛT « Inclinez un de vos X » : incline la cible choisie (déjà
                // garantie dressée par l'éligibilité).
                resolveTapTarget(deps.rulesCtx(), t.seat, instanceId)
              : t.op.op === "healHeroTarget"
                ? resolveHealHeroTarget(
                    deps.rulesCtx(),
                    t.seat,
                    instanceId,
                    t.op.n,
                  )
                : t.op.op === "buffForceTarget"
                  ? resolveBuffForceTarget(
                      deps.rulesCtx(),
                      t.seat,
                      instanceId,
                      t.op.n,
                    )
                  : t.op.op === "grantKeywordTarget"
                    ? resolveGrantKeywordTarget(
                        deps.rulesCtx(),
                        t.seat,
                        instanceId,
                        t.op.keyword,
                      )
                    : t.op.op === "grantResistanceTarget"
                      ? resolveGrantResistanceTarget(
                          deps.rulesCtx(),
                          t.seat,
                          instanceId,
                          t.op.resist,
                        )
                      : t.op.op === "tapTarget"
                        ? resolveTapTarget(
                            deps.rulesCtx(),
                            t.seat,
                            instanceId,
                            // « … ne peut pas se redresser jusqu'au début de votre
                            // prochain tour » : jeton noUntapUntilTurn = tour + 2 (même
                            // borne que la Trêve), posé sur la cible choisie.
                            t.op.cannotRedress
                              ? deps.getState().turn.number + 2
                              : undefined,
                          )
                        : t.op.op === "untapTarget"
                          ? resolveUntapTarget(
                              deps.rulesCtx(),
                              t.seat,
                              instanceId,
                            )
                          : t.op.op === "returnToHand"
                            ? resolveReturnToHand(
                                deps.rulesCtx(),
                                t.seat,
                                instanceId,
                              )
                            : t.op.op === "damageTargetByForce"
                              ? resolveDamageTargetByForce(
                                  deps.rulesCtx(),
                                  t.seat,
                                  instanceId,
                                  // Élément des Dommages = Élément de la SOURCE liée
                                  // (410.1), lu sur la carte de l'instance source vivante
                                  // (acteur lié pour l'actor-binding) ; repli sur l'Élément
                                  // figé à la compilation si la source est absente.
                                  liveSourceElement(t.sourceId) ?? t.op.element,
                                  {
                                    mods: activeGlobalMods(deps.rulesCtx()),
                                    ...(t.sourceId
                                      ? { sourceId: t.sourceId }
                                      : {}),
                                  },
                                )
                              : t.op.op === "damageTarget"
                                ? resolveDamageTarget(
                                    deps.rulesCtx(),
                                    t.seat,
                                    instanceId,
                                    t.op.n,
                                    // idem : Dommages de l'Élément de la source liée.
                                    liveSourceElement(t.sourceId) ??
                                      t.op.element,
                                    {
                                      mods: activeGlobalMods(deps.rulesCtx()),
                                      ...(t.sourceId
                                        ? { sourceId: t.sourceId }
                                        : {}),
                                    },
                                  )
                                : // Inatteignable : tapMultiTarget/untapMultiTarget
                                  // (dans TargetingOp) sont résolus dans leur branche
                                  // dédiée EN AMONT (return). Repli défensif typé.
                                  { events: [], log: [] };
    // ACTOR-BINDING par coût : la créature qu'on vient de choisir au COÛT devient
    // le sujet (sourceId) du CORPS resté en tête de file (holdRest). On réécrit la
    // frame en attente AVANT de la reprendre, pour que buffForceSelf /
    // damageTargetByForce y lisent la bonne créature.
    if (isCostTargetingOp(t.op)) {
      const head = effectQueue.value[0];
      if (head?.actorBind === "costTarget")
        effectQueue.value = [
          { ...head, sourceId: instanceId },
          ...effectQueue.value.slice(1),
        ];
    }
    // 804.7 — bus : « Quand [self] est détruit » de la cible DÉTRUITE (415.1).
    // Collecté AVANT le dispatch (l'instance est encore lisible) ; n'émet que
    // pour une vraie DESTRUCTION (destroyTarget / costDestroyControlled → Défausse),
    // jamais pour un bannissement (banishTarget → Exil) ni un recyclage (→ Pioche).
    const destroyedEvents: RuleEvent[] =
      t.op.op === "destroyTarget" || t.op.op === "costDestroyControlled"
        ? (() => {
            const inst = deps.getState().instances[instanceId];
            return inst
              ? [
                  {
                    kind: "destroyed" as const,
                    instanceId,
                    controller: inst.controller,
                  },
                ]
              : [];
          })()
        : [];
    const destroyedCtx = deps.rulesCtx();
    deps.dispatch(...res.events, ...res.log.map((l) => say(t.seat, l)));
    // 804.7 — bus : déclenchés des Dommages ciblés (riposte… dormant lot F).
    if (deps.isAssistEffects() && res.ruleEvents?.length)
      enqueueTriggered(
        collectTriggeredEffects(deps.rulesCtx(), res.ruleEvents),
      );
    if (deps.isAssistEffects() && destroyedEvents.length)
      enqueueTriggered(collectTriggeredEffects(destroyedCtx, destroyedEvents));
    deps.checkVictory();
    pumpEffects();
  }

  /** Passe l'op à cible en cours (cible illégale / choix du joueur). */
  function effectTargetSkip(): void {
    const t = effectTargeting.value;
    if (!t) return;
    effectTargeting.value = null;
    // COÛT payé décliné : le coût n'est pas payé → le CORPS (restant en tête de
    // file via holdRest) ne doit PAS s'exécuter. On retire la frame abandonnée.
    if (isCostTargetingOp(t.op)) {
      effectQueue.value = effectQueue.value.slice(1);
      deps.dispatch(
        say(t.seat, `${t.cardName} : coût non payé, pouvoir annulé.`),
      );
      pumpEffects();
      return;
    }
    // DOMMAGES MULTI-CIBLES « jusqu'à N » : passer = s'ARRÊTER avant la borne
    // (les cibles déjà touchées le restent) — l'effet n'est pas annulé, le corps
    // restant (holdRest) reprend normalement.
    if (
      (t.op.op === "damageMultiTarget" ||
        t.op.op === "tapMultiTarget" ||
        t.op.op === "untapMultiTarget") &&
      t.multi
    ) {
      deps.dispatch(
        say(
          t.seat,
          `${t.cardName} : ${t.multi.chosen.length} cible(s) choisie(s).`,
        ),
      );
      pumpEffects();
      return;
    }
    deps.dispatch(say(t.seat, `${t.cardName} : ciblage passé.`));
    pumpEffects();
  }

  /** Le joueur accepte (ou refuse) l'effet optionnel en tête de file. */
  function effectChoiceResolve(accept: boolean): void {
    const choice = effectChoices.value[0];
    if (!choice) return;
    effectChoices.value = effectChoices.value.slice(1);
    // CHOIX « A ou B » (optionLabels) : « décliner » n'est pas un refus mais le
    // choix de la branche B — on journalise l'option retenue, pas « décliné ».
    const chosenLabel = choice.optionLabels?.[accept ? 0 : 1];
    if (!accept) {
      deps.dispatch(
        say(
          choice.seat,
          chosenLabel
            ? `${choice.cardName} : ${chosenLabel}.`
            : `Effet décliné — ${choice.cardName}.`,
        ),
      );
      if (choice.declineOps?.length) {
        enqueueEffect({
          seat: choice.seat,
          cardName: choice.cardName,
          ops: choice.declineOps,
          sourceId: choice.sourceId,
        });
      }
      return;
    }
    deps.dispatch(
      say(
        choice.seat,
        chosenLabel
          ? `${choice.cardName} : ${chosenLabel}.`
          : `Effet appliqué — ${choice.cardName} : « ${choice.text} »`,
      ),
    );
    enqueueEffect({
      seat: choice.seat,
      cardName: choice.cardName,
      ops: choice.ops,
      sourceId: choice.sourceId,
    });
  }

  /** Réinitialise tout l'état du moteur (nouvelle partie / sortie de match). */
  function reset(): void {
    effectChoices.value = [];
    effectTargeting.value = null;
    effectPicking.value = null;
    effectQueue.value = [];
    manualReminders.value = [];
  }

  return {
    // état réactif (exposé tel quel par le store)
    effectChoices,
    effectChoice,
    effectTargeting,
    effectPicking,
    effectQueue,
    effectPickIds,
    effectTargetIdsList,
    manualReminders,
    // entrées
    enqueueEffect,
    enqueueTriggered,
    queueArrivalEffects,
    enforceHandLimit,
    noteManualEffects,
    dismissManualReminder,
    // interactions joueur
    effectPick,
    effectPickSkip,
    effectTargetChoose,
    effectTargetSkip,
    effectChoiceResolve,
    // cycle de vie
    reset,
  };
}
