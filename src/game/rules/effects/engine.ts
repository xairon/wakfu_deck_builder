/**
 * Moteur de RÉSOLUTION D'EFFETS — orchestrateur à états extrait de gameStore.
 * Possède la file d'exécution et le modèle d'interaction pause/reprise
 * (ciblage / pile / choix). Toutes les dépendances couplées au store sont
 * INJECTÉES (EffectEngineDeps) ; les helpers purs (@/game, @/game/rules) sont
 * importés directement. Voir
 * docs/superpowers/plans/2026-06-18-effect-engine-extraction.md.
 */
import { computed, ref } from "vue";
import type { Card, CompiledEffect } from "@/types/cards";
import type { DraftEvent, GameState, Position, Seat, ZoneRef } from "@/game";
import {
  incCounter as incCounterVerb,
  move,
  otherSeat,
  say,
  setCounter as setCounterVerb,
} from "@/game";
import type {
  EffectOp,
  RulesCtx,
  TargetingOp,
  TriggeredFrame,
} from "@/game/rules";
import {
  activeGlobalMods,
  appearanceTriggerEffects,
  arrivalEffects,
  collectTriggeredEffects,
  effectSourceElement,
  effectTargetIds,
  grantXpEvents,
  heroLevel,
  isCostTargetingOp,
  isTargetingOp,
  manualEffects,
  normElement,
  producedElement,
  resolveBuffForceTarget,
  resolveDamageTarget,
  resolveDamageTargetByForce,
  resolveDestroyTarget,
  resolveHealHeroTarget,
  resolveReturnToHand,
  resolveTapTarget,
  resolveUntapTarget,
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
}

/** Filtre de recherche dans une pile (type, famille, niveau max, élément). */
export interface PickFilter {
  mainType?: string;
  sub?: string;
  maxLevel?: number;
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
  } | null>(null);

  /** Choix de carte(s) dans une pile (recycler / défausser / chercher). */
  const effectPicking = ref<{
    seat: Seat;
    cardName: string;
    zone: "defausse" | "main" | "pioche";
    action: "recycle" | "discard" | "toHand" | "toMonde";
    /** Filtre de la recherche dans la Pioche. */
    filter?: PickFilter;
    /** « Il apparaît incliné. » — la carte mise en jeu arrive inclinée. */
    enterTapped?: boolean;
    /** Choix imposé par une règle (pas de bouton « Passer »). */
    mandatory?: boolean;
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
    const ids = [...deps.getState().seats[p.seat][p.zone]];
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
    const stillHas = effectPickIds.value.length > 0;
    if (remaining > 0 && stillHas) {
      effectPicking.value = { ...p, remaining };
      return;
    }
    effectPicking.value = null;
    pumpEffects();
  }

  /** Passe le choix en cours (pile vide / décision du joueur). */
  function effectPickSkip(): void {
    const p = effectPicking.value;
    if (!p || p.mandatory) return; // un choix imposé ne se passe pas
    effectPicking.value = null;
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
        )
      : [],
  );

  /**
   * Exécute les ops de la frame de tête ; retourne `true` si une op
   * interactive met la frame en pause (le reste attend via `holdRest`).
   */
  function runFrame(frame: EffectFrame): boolean {
    const { seat, cardName, sourceId } = frame;
    const ops = frame.ops;
    for (let i = 0; i < ops.length; i++) {
      const op = ops[i];
      if (isTargetingOp(op)) {
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
        effectTargeting.value = { seat, cardName, op, sourceId };
        holdRest(frame, ops.slice(i + 1));
        return true;
      }
      if (op.op === "shuffleDeck") {
        deps.shufflePioche(seat);
        continue;
      }
      if (op.op === "searchDeck") {
        const filter: PickFilter = {
          mainType: op.what,
          ...(op.sub ? { sub: op.sub } : {}),
          ...(op.maxLevel !== undefined ? { maxLevel: op.maxLevel } : {}),
        };
        const hasMatch = deps
          .getState()
          .seats[
            seat
          ].pioche.some((id) => matchesPickFilter(deps.getCard(deps.getState().instances[id]?.cardId ?? null), filter));
        if (!hasMatch) {
          deps.dispatch(
            say(
              seat,
              `${cardName} : aucune carte correspondante dans la Pioche.`,
            ),
          );
          continue;
        }
        effectPicking.value = {
          seat,
          cardName,
          zone: "pioche",
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
      } else if (op.op === "draw") {
        deps.draw(seat, op.n);
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
        const heroId = deps.getState().seats[seat].heroInstanceId;
        if (heroId) deps.adjustCounter(heroId, "hp", op.n);
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
      }
    }
    return false;
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

  /** Le joueur clique une cible légale : résout l'op puis continue l'effet. */
  function effectTargetChoose(instanceId: string): void {
    const t = effectTargeting.value;
    if (!t || !effectTargetIdsList.value.includes(instanceId)) return;
    effectTargeting.value = null;
    const res =
      t.op.op === "destroyTarget" || t.op.op === "costDestroyControlled"
        ? // COÛT « Détruisez un de vos X » : même résolution que destroyTarget
          // (un Allié détruit rapporte son XP à l'adversaire, 415.1).
          resolveDestroyTarget(deps.rulesCtx(), t.seat, instanceId)
        : t.op.op === "costTapControlled"
          ? // COÛT « Inclinez un de vos X » : incline la cible choisie (déjà
            // garantie dressée par l'éligibilité).
            resolveTapTarget(deps.rulesCtx(), t.seat, instanceId)
          : t.op.op === "healHeroTarget"
            ? resolveHealHeroTarget(deps.rulesCtx(), t.seat, instanceId, t.op.n)
            : t.op.op === "buffForceTarget"
              ? resolveBuffForceTarget(
                  deps.rulesCtx(),
                  t.seat,
                  instanceId,
                  t.op.n,
                )
              : t.op.op === "tapTarget"
                ? resolveTapTarget(deps.rulesCtx(), t.seat, instanceId)
                : t.op.op === "untapTarget"
                  ? resolveUntapTarget(deps.rulesCtx(), t.seat, instanceId)
                  : t.op.op === "returnToHand"
                    ? resolveReturnToHand(deps.rulesCtx(), t.seat, instanceId)
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
                            ...(t.sourceId ? { sourceId: t.sourceId } : {}),
                          },
                        )
                      : resolveDamageTarget(
                          deps.rulesCtx(),
                          t.seat,
                          instanceId,
                          t.op.n,
                          // idem : Dommages de l'Élément de la source liée.
                          liveSourceElement(t.sourceId) ?? t.op.element,
                          {
                            mods: activeGlobalMods(deps.rulesCtx()),
                            ...(t.sourceId ? { sourceId: t.sourceId } : {}),
                          },
                        );
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
    deps.dispatch(...res.events, ...res.log.map((l) => say(t.seat, l)));
    // 804.7 — bus : déclenchés des Dommages ciblés (riposte… dormant lot F).
    if (deps.isAssistEffects() && res.ruleEvents?.length)
      enqueueTriggered(
        collectTriggeredEffects(deps.rulesCtx(), res.ruleEvents),
      );
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
    deps.dispatch(say(t.seat, `${t.cardName} : ciblage passé.`));
    pumpEffects();
  }

  /** Le joueur accepte (ou refuse) l'effet optionnel en tête de file. */
  function effectChoiceResolve(accept: boolean): void {
    const choice = effectChoices.value[0];
    if (!choice) return;
    effectChoices.value = effectChoices.value.slice(1);
    if (!accept) {
      deps.dispatch(say(choice.seat, `Effet décliné — ${choice.cardName}.`));
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
        `Effet appliqué — ${choice.cardName} : « ${choice.text} »`,
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
