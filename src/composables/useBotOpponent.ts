/**
 * DRIVER « jouer contre l'ordinateur » — pilote le siège `store.botSeat` via l'IA
 * heuristique (botLiveStep), en LOCAL, avec une boucle de POLLING robuste.
 *
 * PHILOSOPHIE D'AFFICHAGE (solo) : le joueur REGARDE le bot jouer — pas de rideau
 * « Tour adverse ». La vue reste TOUJOURS celle de l'humain (son plateau en bas,
 * la main du bot masquée en haut). Le bot a pourtant besoin que `perspective`
 * pointe sur son siège pour AGIR (playFromHand / activateTapPower / beginCombat
 * lisent `perspective`). On concilie les deux ainsi :
 *  - phase principale du bot : on bascule `perspective` sur le bot LE TEMPS
 *    (synchrone, dans le même battement) d'exécuter UN coup + de résoudre toute
 *    fenêtre d'effet qu'il ouvre, puis on REND la vue à l'humain avant que Vue ne
 *    peigne → aucun basculement visible, le coup apparaît sur le plateau humain ;
 *  - combat du bot : la DÉCLARATION d'attaque (toggle/cible/confirm) est
 *    seat-agnostique → elle tourne directement en vue humaine ; l'humain voit les
 *    flèches se former, puis défend et clique « Résoudre » (combat mono-écran, sans
 *    gate de siège en local).
 *  - tour de l'humain : le bot ne fait que DÉFENDRE (déclare ses blocages).
 * On ne pose donc JAMAIS `passPending` pour le bot en jeu (plus de rideau).
 */
import { botLiveStep, botReactInCombat } from "@/game/ai/botPolicy";
import type { useGameStore } from "@/stores/gameStore";

type Store = ReturnType<typeof useGameStore>;
type Seat = "A" | "B";
const other = (s: Seat): Seat => (s === "A" ? "B" : "A");

export function useBotOpponent(
  store: Store,
  delayMs = 550,
  opts?: {
    /**
     * PAUSE CINÉMATIQUE : tant que ce prédicat est vrai, le bot NE JOUE PAS.
     * Sert au jet de dé d'entame (l'overlay est purement visuel par-dessus un
     * état déjà « playing » — sans cette garde, un bot premier joueur jouait
     * son tour EN FOND pendant l'animation, avant que le joueur désigné soit
     * révélé). L'humain est de toute façon bloqué par l'overlay : la garde
     * rend les deux camps symétriques.
     */
    hold?: () => boolean;
  },
): { stop: () => void } {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let tried = new Set<string>();
  let lastTurn = -1;
  let stopped = false;

  /** Une fenêtre d'interaction du bot est-elle ouverte (à résoudre par lui) ? */
  function botHasPending(): boolean {
    return !!(
      store.pendingChifumi ||
      store.pendingResolution ||
      store.effectChoice ||
      store.effectTargeting ||
      store.effectPicking ||
      store.pendingBearer
    );
  }

  function step(): void {
    const bot = store.botSeat as Seat | null;
    // Pause cinématique (jet de dé d'entame…) : personne ne joue tant que
    // l'overlay est à l'écran — le joueur désigné n'est pas encore révélé.
    if (opts?.hold?.()) return;
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
    // branches de tour/combat plus bas joueraient le tour du bot PENDANT que
    // l'humain mulligane encore (endTurn en pleine phase mulligan → corruption).
    // On ne joue le tour du bot QUE lorsque matchPhase === "playing". ─────────────
    if (store.matchPhase === "mulligan") {
      if (store.mulliganSeat === bot) {
        if (store.perspective === bot && store.passPending) store.reveal();
        else store.keepHand();
      }
      return;
    }

    // ── CHOIX destinés au BOT (eachPlayerOptional / Défi) : ces ops NE basculent
    // PAS la perspective — on route par le siège du choix. ────────────────────────
    const choice = store.effectChoice as {
      seat?: Seat;
      options?: unknown[];
    } | null;
    if (choice && choice.seat === bot) {
      if (choice.options?.length) store.effectChoiceSelect(0);
      else store.effectChoiceResolve(true);
      return;
    }

    // ── FENÊTRE DE RÉACTION offerte au bot (défenseur) : la clore. ────────────────
    if (c && c.reactingSeat === bot) {
      botLiveStep(store, bot, tried);
      return;
    }

    // ── COMBAT PENDANT LE TOUR DU BOT (le bot attaque) ───────────────────────────
    // Tout est visible côté HUMAIN : la déclaration d'attaque est seat-agnostique
    // (toggle/cible/confirm agissent sur `combat`, pas sur `perspective`). On garde
    // donc la vue humaine (aucun rideau) ; l'humain voit les flèches, défend, résout.
    if (active === bot && c) {
      if (store.perspective !== human) {
        store.perspective = human;
        store.passPending = false;
      }
      botLiveStep(store, bot, tried); // déclare les attaquants si step="attackers"
      return;
    }

    // ── PHASE PRINCIPALE DU BOT (son tour, hors combat) ──────────────────────────
    // On REGARDE le bot : la vue reste humaine. On bascule perspective sur le bot
    // juste le temps (synchrone) d'exécuter son coup et de résoudre toute fenêtre
    // d'effet ouverte, puis on rétablit la vue humaine avant le rendu.
    if (active === bot) {
      store.perspective = bot; // acteur = bot (playFromHand/… lisent perspective)
      const acted = botLiveStep(store, bot, tried);
      // Résoudre SYNCHRONEMENT toute fenêtre que ce coup vient d'ouvrir (ciblage,
      // choix, pick, porteur…) pour ne jamais laisser la vue coincée côté bot.
      let guard = 0;
      while (botHasPending() && guard++ < 40) {
        if (!botLiveStep(store, bot, tried)) break;
      }
      // Rien à jouer et pas de combat déclaré → finir le tour (endTurn rend la vue
      // au joueur suivant). NE PAS réinitialiser `tried` ici (reset au vrai
      // changement de tour, en tête) sinon on re-tenterait tout après un refus.
      if (!acted && !store.combat) store.endTurn();
      // Rendre la vue à l'humain (le bot vient de jouer, ou a déclenché un combat
      // dont la déclaration se fera en vue humaine au prochain battement). Filet :
      // si une fenêtre du bot restait ouverte (non résolue synchroniquement), on
      // GARDE perspective=bot pour que le prochain battement la clôture (auto-répare).
      if (store.perspective === bot && !botHasPending()) {
        store.perspective = human;
        store.passPending = false;
      }
      return;
    }

    // ── TOUR DE L'HUMAIN : le bot DÉFEND (réagit puis déclare ses blocages) ───────
    if (c && c.step === "blockers" && active === human) {
      const def = other(active); // = bot
      if (def === bot) {
        // 1) RÉACTION du bot (706.5) : activer un pouvoir UTILE avant de bloquer. On
        //    bascule la vue sur le bot le temps d'agir (comme sa phase principale),
        //    on résout la fenêtre ouverte, puis on rend la vue à l'humain. Un pouvoir
        //    activé par battement (chacun marqué `rpw:` → borné) ; `__react__` clôt
        //    quand il ne reste rien d'utile.
        const reactTok = "__react__" + c.attackers.join(",");
        if (!tried.has(reactTok)) {
          store.perspective = bot;
          const reacted = botReactInCombat(store, bot, tried);
          let guard = 0;
          while (botHasPending() && guard++ < 40) {
            if (!botLiveStep(store, bot, tried)) break;
          }
          if (store.perspective === bot && !botHasPending()) {
            store.perspective = human;
            store.passPending = false;
          }
          if (reacted) return; // rappeler (réagir encore / bloquer au prochain battement)
          tried.add(reactTok); // plus rien d'utile en réaction
        }
        // 2) Blocages (une fois). Jeton par ensemble d'attaquants (anti-spin).
        const tok = "__blk__" + c.attackers.join(",");
        if (!Object.keys(c.blocks).length && !tried.has(tok)) {
          tried.add(tok);
          botLiveStep(store, bot, tried);
        }
      }
      return;
    }

    // ── Interactions du bot ouvertes hors de son tour (le moteur met perspective=bot). ─
    if (store.perspective === bot && botHasPending()) {
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
