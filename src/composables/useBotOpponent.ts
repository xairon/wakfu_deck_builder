/**
 * DRIVER « jouer contre l'ordinateur » — pilote le siège `store.botSeat` via l'IA
 * heuristique (botLiveStep), en LOCAL, avec une boucle de POLLING robuste.
 *
 * PASSATION D'ÉCRAN (le point délicat en solo). Le combat local n'a AUCUN gate de
 * siège (n'importe quel écran peut déclarer blocages/résolution — la perspective
 * ne cache que les mains). Donc :
 *  - Tour du bot, phase principale / déclaration d'attaque → écran au BOT
 *    (perspective = bot, overlay « Tour adverse »).
 *  - Dès que le bot a DÉCLARÉ son attaque (combat.step ≠ "attackers"), l'écran
 *    passe à l'HUMAIN (perspective = humain, overlay masqué) pour qu'il défende et
 *    clique « Résoudre » — sinon l'humain resterait bloqué derrière l'overlay.
 *  - Après résolution (combat = null), l'écran revient au bot pour finir son tour.
 *  - Tour de l'humain : le bot ne fait que DÉFENDRE (déclare ses blocages), puis
 *    l'humain résout sur son propre écran.
 */
import { botLiveStep } from "@/game/ai/botPolicy";
import type { useGameStore } from "@/stores/gameStore";

type Store = ReturnType<typeof useGameStore>;
type Seat = "A" | "B";
const other = (s: Seat): Seat => (s === "A" ? "B" : "A");

export function useBotOpponent(
  store: Store,
  delayMs = 550,
): { stop: () => void } {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let tried = new Set<string>();
  let lastTurn = -1;
  let stopped = false;

  function step(): void {
    const bot = store.botSeat as Seat | null;
    // Actif en mulligan (le bot garde sa main) ET en jeu.
    if (
      !bot ||
      store.online ||
      store.winner ||
      (store.matchPhase !== "playing" && store.matchPhase !== "mulligan")
    )
      return;
    const human = other(bot);
    const active = store.state.turn.active as Seat;
    const c = store.combat;
    if (store.state.turn.number !== lastTurn) {
      lastTurn = store.state.turn.number;
      tried = new Set();
    }

    // ── PHASE DE MULLIGAN : le bot ne gère QUE son propre mulligan, RIEN d'autre.
    // CRUCIAL : pendant le mulligan, `turn.active` vaut déjà le 1er joueur (le bot,
    // first="B"), mais la partie n'a PAS commencé. Sans ce court-circuit, les
    // branches de tour/combat plus bas voyaient « active === bot && pas de combat »
    // et (1) grabbaient l'écran pour le bot (perspective=bot + passation) PENDANT
    // que l'HUMAIN mulliganait encore, puis (2) appelaient endTurn() pour le bot en
    // pleine phase mulligan → partie corrompue + humain coincé derrière l'overlay.
    // On ne joue le tour du bot QUE lorsque matchPhase === "playing". ─────────────
    if (store.matchPhase === "mulligan") {
      if (store.mulliganSeat === bot) {
        if (store.perspective === bot && store.passPending) store.reveal();
        else store.keepHand();
      }
      return;
    }

    // ── CHOIX destinés au BOT (eachPlayerOptional / Défi) : ces ops NE basculent
    // PAS la perspective — on route par le siège du choix (sinon l'humain devrait
    // répondre pour le bot, ou la partie se fige). ──────────────────────────────
    const choice = store.effectChoice as {
      seat?: Seat;
      options?: unknown[];
    } | null;
    if (choice && choice.seat === bot) {
      if (choice.options?.length) store.effectChoiceSelect(0);
      else store.effectChoiceResolve(true);
      return;
    }

    // ── FENÊTRE DE RÉACTION offerte au bot (défenseur) : la clore (sinon freeze
    // si l'humain a cliqué « Laisser réagir l'adversaire »). ────────────────────
    if (c && c.reactingSeat === bot) {
      botLiveStep(store, bot, tried);
      return;
    }

    // ── LE BOT EST L'ATTAQUANT (son tour, combat en cours) ────────────────────
    if (active === bot && c) {
      if (c.step === "attackers") {
        // le bot déclare ses attaquants → il lui faut l'écran.
        if (store.perspective !== bot) {
          store.perspective = bot;
          store.passPending = true;
        }
        botLiveStep(store, bot, tried);
        return;
      }
      // attaque DÉCLARÉE → l'humain défend et résout (écran rendu, overlay masqué).
      if (store.perspective !== human) {
        store.perspective = human;
        store.passPending = false;
      }
      return; // on attend la résolution humaine (combat → null)
    }

    // ── Le bot a fini d'attaquer, l'humain a résolu → rendre la main au bot ────
    if (active === bot && !c && store.perspective !== bot) {
      store.perspective = bot;
      store.passPending = true;
      return;
    }

    // ── TOUR DU BOT, phase principale (perspective = bot) ─────────────────────
    if (active === bot && store.perspective === bot) {
      const acted = botLiveStep(store, bot, tried);
      // Rien à jouer → finir le tour. NE PAS réinitialiser `tried` ici : si endTurn
      // est refusé (ex. main pleine → défausse d'abord), on ne doit pas re-tenter
      // toutes les actions ; le reset se fait au vrai changement de tour (en tête).
      if (!acted && !store.combat) store.endTurn();
      return;
    }

    // ── TOUR DE L'HUMAIN : le bot DÉFEND (déclare ses blocages, UNE fois) ──────
    if (c && c.step === "blockers" && active === human) {
      const def = other(active); // = bot
      // jeton par ensemble d'attaquants : si le bot décide de ne PAS bloquer
      // (aucun bloqueur rentable), on ne re-tente pas chaque battement (anti-spin).
      const tok = "__blk__" + c.attackers.join(",");
      if (def === bot && !Object.keys(c.blocks).length && !tried.has(tok)) {
        tried.add(tok);
        botLiveStep(store, bot, tried);
      }
      return;
    }

    // ── Interactions du bot (le moteur met perspective=bot) ───────────────────
    if (
      store.perspective === bot &&
      (store.pendingChifumi ||
        store.pendingResolution ||
        store.effectChoice ||
        store.effectTargeting ||
        store.effectPicking ||
        store.pendingBearer)
    ) {
      botLiveStep(store, bot, tried);
    }
  }

  function loop(): void {
    if (stopped) return;
    timer = setTimeout(loop, delayMs); // se re-planifie TOUJOURS (poll robuste)
    try {
      step();
    } catch (e) {
      console.warn("[useBotOpponent] step a échoué :", e);
    }
  }

  loop();

  return {
    stop() {
      stopped = true;
      if (timer) clearTimeout(timer);
      timer = null;
    },
  };
}
