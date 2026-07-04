/**
 * IA de jeu — bot HEURISTIQUE « intelligent » (règles de bon sens, pas de
 * recherche d'arbre). Point d'entrée unique `botStep(store)` : résout la décision
 * EN COURS pour l'acteur courant (`store.perspective`), OU joue un coup de phase
 * principale. Retourne `false` s'il ne reste qu'à finir le tour (l'appelant
 * appelle alors `endTurn`).
 *
 * Réutilisable par : le harnais QA bot-vs-bot ET le futur mode « jouer contre
 * l'ordinateur ». Les rôles de COMBAT sont dérivés de `turn.active` (toujours
 * l'attaquant) — pas de `perspective` — donc corrects quel que soit l'affichage.
 *
 * Principes (vs le bot « glouton » qui joue le 1er coup légal) :
 *  - développe le plateau (joue ce qui est jouable) ;
 *  - n'attaque pas en suicide (attaque si l'attaquant survit au meilleur bloqueur
 *    adverse, ou si l'adversaire n'a aucun bloqueur → dégâts au Héros) ;
 *  - bloque pour tuer l'attaquant (Force ≥) ou pour éviter la mort du Héros ;
 *  - vise les meilleures cibles (dégâts/destruction sur la plus grosse menace ;
 *    buff/soin sur sa meilleure créature).
 */
import type { useGameStore } from "@/stores/gameStore";

type Store = ReturnType<typeof useGameStore>;
type Seat = "A" | "B";
const other = (s: Seat): Seat => (s === "A" ? "B" : "A");
const CHIFUMI = ["pierre", "feuille", "ciseaux"] as const;

// ── lecteurs d'état ───────────────────────────────────────────────────────────
function forceOf(store: Store, id: string): number {
  return store.effectiveForceOf?.(id)?.value ?? 0;
}
function instOf(store: Store, id: string) {
  return store.state.instances[id];
}
/** Une instance est une créature en jeu (effectiveForceOf ≠ null ⇔ Allié/Héros en jeu). */
function isCreature(store: Store, id: string): boolean {
  return store.effectiveForceOf?.(id) != null;
}
function creatures(store: Store, seat: Seat): string[] {
  return Object.values(store.state.instances)
    .filter((i) => i.controller === seat && isCreature(store, i.instanceId))
    .map((i) => i.instanceId);
}
function heroIdOf(store: Store, seat: Seat): string | undefined {
  return store.state.seats[seat]?.heroInstanceId;
}
/** Bloqueurs potentiels d'un siège : créatures NON-Héros dressées. */
function potentialBlockers(store: Store, seat: Seat): string[] {
  const hero = heroIdOf(store, seat);
  return creatures(store, seat).filter(
    (id) => id !== hero && instOf(store, id)?.orientation === "upright",
  );
}
function heroHp(store: Store, seat: Seat): number {
  const hid = heroIdOf(store, seat);
  const c = hid
    ? (instOf(store, hid)?.counters as Record<string, number>)
    : null;
  return c?.hp ?? Infinity;
}

// ── ciblage intelligent ───────────────────────────────────────────────────────
const HARMFUL_OPS = new Set([
  "damageTarget",
  "damageMultiTarget",
  "distributeDamage",
  "destroyTarget",
  "banishTarget",
  "tapTarget",
  "removeFromCombatTarget",
  "duelChooseChallenged",
  "damageTargetByForce",
]);

function pickTarget(store: Store, me: Seat): void {
  const t = store.effectTargeting;
  const ids = store.effectTargetIdsList;
  if (!t || !ids.length) {
    store.effectTargetSkip();
    return;
  }
  const harmful = HARMFUL_OPS.has(t.op.op);
  const scored = ids.map((id) => ({
    id,
    f: forceOf(store, id),
    mine: instOf(store, id)?.controller === me,
  }));
  // nuisible → viser la plus grosse créature ADVERSE ; bénéfique → la mienne.
  const pool = harmful
    ? scored.filter((s) => !s.mine)
    : scored.filter((s) => s.mine);
  const chosen = (pool.length ? pool : scored).sort((a, b) => b.f - a.f)[0];
  store.effectTargetChoose(chosen.id);
}

// ── combat (rôles dérivés de turn.active) ─────────────────────────────────────
/** L'attaquant survit-il au meilleur bloqueur adverse (ou l'adversaire n'a-t-il
 *  aucun bloqueur) ? → attaque rentable, pas un suicide. */
function worthAttacking(
  store: Store,
  atkSeat: Seat,
  attackerId: string,
): boolean {
  const blk = potentialBlockers(store, other(atkSeat));
  if (!blk.length) return true; // aucun bloqueur → dégâts gratuits au Héros
  const af = forceOf(store, attackerId);
  if (af >= Math.max(...blk.map((b) => forceOf(store, b)))) return true; // survit au meilleur bloqueur
  // SUBMERSION : si j'ai plus d'attaquants dressés que l'adversaire de bloqueurs,
  // certains passent → attaquer reste rentable (pression sur le Héros).
  const myAtk = potentialBlockers(store, atkSeat).length; // mes créatures dressées non-Héros
  return myAtk > blk.length;
}

function driveCombat(store: Store): void {
  const c = store.combat;
  if (!c) return;
  if (c.reactingSeat) {
    store.combatEndReaction(); // v1 : l'IA ne joue pas de cartes Réaction
    return;
  }
  const atkSeat = store.state.turn.active as Seat;
  const defSeat = other(atkSeat);

  if (c.step === "attackers") {
    if (!c.target) {
      const tids = store.combatTargetIds;
      if (!tids.length) return void store.combatCancel();
      // viser le Héros adverse le plus bas en PV.
      const tgt = [...tids].sort(
        (a, b) =>
          heroHp(store, instOf(store, a)?.controller as Seat) -
          heroHp(store, instOf(store, b)?.controller as Seat),
      )[0];
      store.combatChooseTarget(tgt);
      return;
    }
    const good = store.combatAttackerIds.filter((id) =>
      worthAttacking(store, atkSeat, id),
    );
    for (const id of [...c.attackers])
      if (!good.includes(id)) store.combatToggleAttacker(id);
    for (const id of good)
      if (!store.combat?.attackers.includes(id)) store.combatToggleAttacker(id);
    if (!store.combat?.attackers.length) return void store.combatCancel();
    store.combatConfirmAttackers();
    return;
  }

  if (c.step === "blockers") {
    // Décision de blocage POUR LE DÉFENSEUR (indépendante de la perspective).
    if (!Object.keys(c.blocks).length) {
      const incoming = [...c.attackers].sort(
        (a, b) => forceOf(store, b) - forceOf(store, a),
      );
      const legal = store.combatBlockerIds;
      const totalDmg = incoming.reduce((s, a) => s + forceOf(store, a), 0);
      const heroLethal = heroHp(store, defSeat) <= totalDmg;
      const used = new Set<string>();
      for (const atk of incoming) {
        const af = forceOf(store, atk);
        const killer = legal
          .filter((b) => !used.has(b))
          .sort((a, b) => forceOf(store, b) - forceOf(store, a))
          .find((b) => forceOf(store, b) >= af);
        const chump = heroLethal
          ? legal.filter((b) => !used.has(b))[0]
          : undefined;
        const blocker = killer ?? chump;
        if (blocker) {
          used.add(blocker);
          store.combatToggleBlock(blocker);
          if (store.combat?.pendingBlocker) store.combatChooseBlockTarget(atk);
        }
      }
    }
    store.combatResolve();
    return;
  }

  if (c.step === "strikes") {
    const s = store.combatStrikeIds;
    if (s.length)
      store.combatChooseStrike(
        [...s].sort((a, b) => forceOf(store, a) - forceOf(store, b))[0],
      );
    else store.combatResolve();
    return;
  }
  if (c.step === "riposte") {
    const r = store.combatRiposteIds;
    if (r.length)
      store.combatChooseRiposte(
        [...r].sort((a, b) => forceOf(store, b) - forceOf(store, a))[0],
      );
    else store.combatResolve();
    return;
  }
  store.combatCancel();
}

// ── point d'entrée ────────────────────────────────────────────────────────────
/**
 * Exécute UNE décision de l'IA pour l'acteur courant (`store.perspective`).
 * `true` = un coup joué (rappeler) ; `false` = il ne reste qu'à finir le tour.
 * `rng` injectable (Chi-Fu-Mi) pour la reproductibilité des tests.
 */
export function botStep(
  store: Store,
  tried: Set<string> = new Set(),
  rng: () => number = Math.random,
): boolean {
  const me = store.perspective as Seat;

  if (store.pendingChifumi) {
    const p = store.pendingChifumi;
    if (p.phase === "offer") {
      // parier au Chi-Fu-Mi seulement si le Kanigrou vaut la peine (Force ≥ 3,
      // intact) ; sinon subir (éviter les 2/3 d'auto-destruction).
      const f = forceOf(store, p.kanigrouId);
      const dmg = instOf(store, p.kanigrouId)?.counters.damage ?? 0;
      if (f >= 3 && dmg === 0) store.chifumiAccept();
      else store.chifumiDecline();
    } else {
      store.chifumiChoose(CHIFUMI[Math.floor(rng() * 3) % 3]);
    }
    return true;
  }
  if (store.pendingResolution) {
    store.passPendingResolution(); // v1 : ne pas gaspiller Échec Critique
    return true;
  }
  if (store.pendingBearer) {
    const best = [...store.pendingBearer.eligible].sort(
      (a, b) => forceOf(store, b) - forceOf(store, a),
    )[0];
    if (best) store.attachToBearer(best);
    else store.cancelBearerTargeting();
    return true;
  }
  if (store.effectPicking) {
    const ids = store.effectPickIds;
    if (ids.length) store.effectPick(ids[0]);
    else store.effectPickSkip();
    return true;
  }
  if (store.effectTargeting) {
    pickTarget(store, me);
    return true;
  }
  if (store.effectChoice) {
    if (store.effectChoice.options?.length) store.effectChoiceSelect(0);
    else store.effectChoiceResolve(true); // prendre l'effet (souvent bénéfique)
    return true;
  }
  if (store.combat) {
    driveCombat(store);
    return true;
  }

  // Phase principale — seulement si c'est mon tour. `tried` évite de re-tenter
  // une carte injouable / un prompt annulé en boucle (vidé à chaque tour).
  if (store.state.turn.active !== me) return false;
  for (const id of [...(store.state.seats[me]?.main ?? [])]) {
    if (tried.has(id)) continue;
    tried.add(id);
    if (store.playFromHand(id)) return true; // peut ouvrir une interaction
  }
  for (const i of Object.values(store.state.instances)) {
    if (i.controller !== me) continue;
    if (i.location.zone !== "monde" && i.location.zone !== "havreSac") continue;
    if (tried.has("pw:" + i.instanceId)) continue;
    tried.add("pw:" + i.instanceId);
    if (store.activateTapPower(i.instanceId)) return true;
  }
  if (store.canDeclareAttack && !tried.has("__atk__")) {
    tried.add("__atk__");
    const good = store.eligibleAttackerIds.filter((id) =>
      worthAttacking(store, me, id),
    );
    if (good.length && store.beginCombat(good[0])) return true;
  }
  return false;
}
