/**
 * DRIVER « jouer contre l'ordinateur » — pilote automatiquement le siège
 * `store.botSeat` via l'IA heuristique (botLiveStep), en LOCAL. Modèle de POLLING
 * (comme le `tick` du tutoriel) : une boucle se re-planifie en continu et, à
 * chaque battement, si le jeu attend une décision du bot, joue UN coup. Robuste
 * par construction — aucune dépendance à un watcher pour « redémarrer » (un état
 * bloqué est corrigé au battement suivant).
 *
 * Le bot ne RÉSOUT jamais le combat : en local le combat est mono-écran, donc
 * c'est l'humain (seul présent) qui clique « Résoudre » — pour l'attaque du bot
 * ET pour la sienne. Aucune passation d'appareil n'est nécessaire.
 */
import { botLiveStep } from "@/game/ai/botPolicy";
import type { useGameStore } from "@/stores/gameStore";

type Store = ReturnType<typeof useGameStore>;
type Seat = "A" | "B";

export function useBotOpponent(
  store: Store,
  delayMs = 550,
): { stop: () => void } {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let tried = new Set<string>();
  let lastTurn = -1;
  let stopped = false;

  /** Le jeu attend-il une décision du bot maintenant ? */
  function shouldAct(): boolean {
    const bot = store.botSeat;
    if (!bot || store.online || store.winner || store.matchPhase !== "playing")
      return false;
    if (store.mulliganSeat === bot) return true;
    if (
      store.perspective === bot &&
      (store.pendingChifumi ||
        store.pendingResolution ||
        store.effectChoice ||
        store.effectTargeting ||
        store.effectPicking ||
        store.pendingBearer)
    )
      return true;
    const c = store.combat;
    if (c) {
      const def: Seat = store.state.turn.active === "A" ? "B" : "A";
      if (c.step === "blockers" && def === bot && !Object.keys(c.blocks).length)
        return true;
      if (store.state.turn.active === bot && store.perspective === bot)
        return true;
    }
    if (store.state.turn.active === bot && store.perspective === bot)
      return true;
    return false;
  }

  function step(): void {
    const bot = store.botSeat;
    if (!bot || !shouldAct()) return;
    if (store.state.turn.number !== lastTurn) {
      lastTurn = store.state.turn.number;
      tried = new Set();
    }
    if (store.mulliganSeat === bot) {
      store.keepHand();
      return;
    }
    const acted = botLiveStep(store, bot, tried);
    // finir le tour SI c'est proprement le tour du bot, hors combat, rien à jouer.
    if (
      !acted &&
      store.state.turn.active === bot &&
      store.perspective === bot &&
      !store.combat
    ) {
      store.endTurn();
      tried = new Set();
    }
  }

  function loop(): void {
    if (stopped) return;
    timer = setTimeout(loop, delayMs); // se re-planifie TOUJOURS (poll robuste)
    try {
      step();
    } catch (e) {
      // un coup illégal ne doit jamais figer la boucle — on trace et on continue.
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
