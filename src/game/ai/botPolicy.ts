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
  // Aucune cible du bon camp : l'effet est OBLIGATOIRE (une cible légale existe,
  // « Passer » est désormais refusé — P2-10). On choisit la cible la MOINS
  // pénalisante — Force la plus faible parmi toutes les éligibles (auto-dégât
  // minimal pour un op nuisible, bonus minimal à l'adversaire pour un bénéfique).
  if (!pool.length) {
    const forced = [...scored].sort((a, b) => a.f - b.f)[0];
    store.effectTargetChoose(forced.id);
    return;
  }
  const chosen = pool.sort((a, b) => b.f - a.f)[0];
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

/** Déclare l'attaque (une étape par appel) : cible manquante → viser ; sinon
 *  sélectionner les attaquants rentables et confirmer (ou renoncer). */
function declareAttack(store: Store, atkSeat: Seat): void {
  const c = store.combat;
  if (!c) return;
  if (!c.target) {
    const tids = store.combatTargetIds;
    if (!tids.length) return void store.combatCancel();
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
}

/** Sélectionne les blocages du DÉFENSEUR (tue l'attaquant si possible, sinon
 *  chump uniquement si le Héros mourrait). Ne RÉSOUT PAS (l'humain/attaquant résout). */
function selectBlocks(store: Store, defSeat: Seat): void {
  const c = store.combat;
  if (!c || Object.keys(c.blocks).length) return;
  const incoming = [...c.attackers].sort(
    (a, b) => forceOf(store, b) - forceOf(store, a),
  );
  const legal = store.combatBlockerIds;
  const totalDmg = incoming.reduce((s, a) => s + forceOf(store, a), 0);
  const heroLethal = heroHp(store, defSeat) <= totalDmg;
  const used = new Set<string>();
  for (const atk of incoming) {
    const af = forceOf(store, atk);
    const free = legal.filter((b) => !used.has(b));
    const killer = free
      .sort((a, b) => forceOf(store, b) - forceOf(store, a))
      .find((b) => forceOf(store, b) >= af);
    const blocker = killer ?? (heroLethal ? free[0] : undefined);
    if (blocker) {
      used.add(blocker);
      store.combatToggleBlock(blocker);
      if (store.combat?.pendingBlocker) store.combatChooseBlockTarget(atk);
    }
  }
}

function chooseStrike(store: Store): void {
  const s = store.combatStrikeIds;
  if (s.length)
    store.combatChooseStrike(
      [...s].sort((a, b) => forceOf(store, a) - forceOf(store, b))[0],
    );
  else store.combatResolve();
}
function chooseRiposte(store: Store): void {
  const r = store.combatRiposteIds;
  if (r.length)
    store.combatChooseRiposte(
      [...r].sort((a, b) => forceOf(store, b) - forceOf(store, a))[0],
    );
  else store.combatResolve();
}

/** Combat AUTONOME (harnais bot-vs-bot) : un seul pilote résout tout, RÉSOUT compris. */
function driveCombat(store: Store): void {
  const c = store.combat;
  if (!c) return;
  if (c.reactingSeat) return void store.combatEndReaction();
  const atkSeat = store.state.turn.active as Seat;
  if (c.step === "attackers") return declareAttack(store, atkSeat);
  if (c.step === "blockers") {
    selectBlocks(store, other(atkSeat));
    return void store.combatResolve();
  }
  if (c.step === "strikes") return chooseStrike(store);
  // 6135 — répartition Géant : le préremplissage est déjà la politique auto
  // (létal le moins cher d'abord) → le bot confirme tel quel.
  if (c.step === "geant") return void store.combatGeantConfirm();
  if (c.step === "riposte") return chooseRiposte(store);
  store.combatCancel();
}

/**
 * CHI-FU-MI (Kanigrou) — le siège du mini-jeu qui doit AGIR maintenant :
 * l'offre revient au contrôleur ; au reveal, l'adversaire engage (caché) puis
 * le contrôleur tranche. Exporté pour que le driver solo (useBotOpponent)
 * fasse répondre le bot MÊME pendant le tour de l'humain (l'humain attaque
 * avec SON Kanigrou → le bot est l'adversaire du mini-jeu) — sans cette voie,
 * la fenêtre attendait un choix bot qui ne venait jamais (attaque jamais
 * résolue, bug playtest « Apprendre en jouant »).
 */
export function chifumiActingSeat(store: Store): Seat | null {
  const p = store.pendingChifumi;
  if (!p) return null;
  if (p.phase === "offer") return p.controller;
  return p.oppChoice === null ? p.opponent : p.controller;
}

/** Fait jouer AU BOT son coup du mini-jeu Chi-Fu-Mi (offre ou signe). */
export function botChifumiStep(
  store: Store,
  rng: () => number = Math.random,
): void {
  const p = store.pendingChifumi;
  if (!p) return;
  if (p.phase === "offer") {
    const f = forceOf(store, p.kanigrouId);
    const dmg = instOf(store, p.kanigrouId)?.counters.damage ?? 0;
    if (f >= 3 && dmg === 0) store.chifumiAccept();
    else store.chifumiDecline();
  } else {
    store.chifumiChoose(CHIFUMI[Math.floor(rng() * 3) % 3]);
  }
}

/** Résout une FENÊTRE d'interaction ouverte pour l'acteur ; `true` si traitée. */
function resolveInteraction(
  store: Store,
  me: Seat,
  rng: () => number,
): boolean {
  if (store.pendingChifumi) {
    botChifumiStep(store, rng);
    return true;
  }
  if (store.pendingResolution) {
    store.passPendingResolution();
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
  // Paiement au choix du joueur : le bot prend toujours le plan AUTO (garde-
  // fou — l'invite ne s'ouvre normalement pas pour le siège du bot).
  if (store.pendingPayment) {
    if (!store.payAuto()) store.payCancel();
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
    else store.effectChoiceResolve(true);
    return true;
  }
  return false;
}

/** Coup de PHASE PRINCIPALE. Ordre CRUCIAL : ATTAQUER D'ABORD (avec les créatures
 *  prêtes), AVANT de jouer des cartes — car payer une carte INCLINE des créatures
 *  productrices, qui ne pourraient alors plus attaquer (le bot restait passif à
 *  s'auto-tapper). Puis développer (jouer cartes) + activer les pouvoirs.
 *  `false` = plus rien à faire → finir le tour. */
function mainPhase(store: Store, me: Seat, tried: Set<string>): boolean {
  // 1. ATTAQUE (une fois) — avec les attaquants rentables encore dressés. Bot
  // « doux » (botAggressive=false, phase guidée du tutoriel) → ne déclare pas.
  if (
    store.botAggressive !== false &&
    store.canDeclareAttack &&
    !tried.has("__atk__")
  ) {
    tried.add("__atk__");
    const good = store.eligibleAttackerIds.filter((id) =>
      worthAttacking(store, me, id),
    );
    if (good.length && store.beginCombat(good[0])) return true;
  }
  // 2. Jouer les cartes de la main (développement / effets). On NE marque PLUS
  //    « tried » une carte injouable : un échec par manque de Ressources est
  //    RÉVERSIBLE — poser un Allié producteur rend jouable, au tick suivant, une
  //    carte trop chère jusque-là (rampe multi-cartes ; avant, la 1re carte non
  //    payable était blacklistée pour tout le tour → « le bot ne posait qu'une
  //    carte »). Progrès garanti : un succès retire la carte de la main, donc pas
  //    de boucle infinie (une passe sans aucun succès renvoie `false` → fin de tour).
  for (const id of [...(store.state.seats[me]?.main ?? [])]) {
    if (store.playFromHand(id)) return true;
    // SONDAGE MUET : un échec (carte impayable / mal timée) pose un ruleError que
    // l'humain verrait (assistant + annonce lecteur d'écran). On l'efface — comme
    // les sondages fabrication (whyCannotCraft) et pouvoir (hasTapPower).
    store.clearRuleError();
  }
  // 2bis. FABRIQUER (A19, 418.6) : une carte à Recette injouable au coût
  //    normal peut être fabriquée (Artisan du Métier dressé + Défausse typée).
  //    Sondé via whyCannotCraft (silencieux) — jamais craftFromHand à
  //    l'aveugle, dont le rejet poserait un ruleError visible par l'humain.
  //    Les interactions ouvertes (Artisan → recyclage → Porteur) sont ensuite
  //    résolues par les handlers génériques du bot (targeting / picking /
  //    pendingBearer ci-dessus).
  for (const id of [...(store.state.seats[me]?.main ?? [])]) {
    if (store.whyCannotCraft(id) === null && store.craftFromHand(id))
      return true;
  }
  // 3. Activer les pouvoirs à inclinaison (valeur gratuite). On NE SONDE QUE les
  //    cartes qui portent un pouvoir COMPILÉ (hasTapPower). Sans ce garde,
  //    activateTapPower sur une carte sans pouvoir rejette « Pas de pouvoir à
  //    inclinaison automatisé » — un rejet qui pose un `ruleError` VISIBLE par
  //    l'humain (l'assistant de règles), alors que le bot ne fait que sonder.
  for (const i of Object.values(store.state.instances)) {
    if (i.controller !== me) continue;
    if (i.location.zone !== "monde" && i.location.zone !== "havreSac") continue;
    if (!store.hasTapPower(i.instanceId)) continue;
    // Ne pas incliner pour rien un pouvoir PUREMENT offensif sans cible adverse
    // légale (Tirlangue « inflige 2 Dommages » vs Héros embagé hors de portée) —
    // ré-évalué à chaque battement (le plateau adverse peut changer dans le tour).
    if (store.tapPowerLacksAdverseTarget(i.instanceId)) continue;
    if (tried.has("pw:" + i.instanceId)) continue;
    tried.add("pw:" + i.instanceId);
    if (store.activateTapPower(i.instanceId)) return true;
  }
  return false;
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
  if (resolveInteraction(store, me, rng)) return true;
  if (store.combat) {
    driveCombat(store);
    return true;
  }
  if (store.state.turn.active !== me) return false;
  return mainPhase(store, me, tried);
}

/**
 * RÉACTION du bot DÉFENSEUR à l'attaque adverse (706.5 — « lorsqu'il attaque »).
 * Active UN pouvoir à inclinaison UTILE (cible adverse légale, non gaspillé) hors
 * de son tour, puis rend la main (l'appelant résout la fenêtre éventuelle et
 * rappelle). Ne bloque PAS et ne résout PAS le combat. Suppose la vue déjà côté
 * bot (l'appelant `useBotOpponent` bascule `perspective`). `true` si un pouvoir a
 * été activé (rappeler), `false` s'il n'y a rien d'utile à jouer en réaction.
 */
export function botReactInCombat(
  store: Store,
  botSeat: Seat,
  tried: Set<string>,
): boolean {
  const c = store.combat;
  if (!c || c.step === "attackers") return false;
  // Le bot n'est défenseur que si l'attaquant (turn.active) est l'adversaire.
  if ((store.state.turn.active as Seat) === botSeat) return false;
  for (const inst of Object.values(store.state.instances)) {
    if (inst.controller !== botSeat) continue;
    const zone = inst.location.zone;
    if (zone !== "monde" && zone !== "havreSac") continue;
    if (inst.orientation !== "upright") continue;
    if (!store.hasTapPower(inst.instanceId)) continue;
    // seulement un pouvoir qui peut RÉELLEMENT frapper (cf. Tirlangue vs embagé).
    if (store.tapPowerLacksAdverseTarget(inst.instanceId)) continue;
    if (tried.has("rpw:" + inst.instanceId)) continue;
    tried.add("rpw:" + inst.instanceId);
    if (store.activateTapPower(inst.instanceId)) return true;
  }
  return false;
}

/**
 * Décision de l'IA en LIVE (mode « jouer contre l'ordinateur »), pour le siège
 * `botSeat` — RÔLE-CONSCIENT et NON RÉSOLVANT : le bot déclare ses attaques (en
 * tant qu'attaquant) et ses blocages (en tant que défenseur), mais ne RÉSOUT
 * jamais le combat — c'est l'humain (seul présent) qui clique « Résoudre » dans
 * les deux cas (le combat local est mono-écran, sans passation d'appareil).
 * `true` = un coup joué (rappeler) ; `false` = rien à faire (attendre l'humain
 * ou finir le tour, décidé par l'appelant `useBotOpponent`).
 */
export function botLiveStep(
  store: Store,
  botSeat: Seat,
  tried: Set<string>,
  rng: () => number = Math.random,
): boolean {
  // Fenêtres d'interaction : le moteur met `perspective` sur le décideur.
  if (store.perspective === botSeat && resolveInteraction(store, botSeat, rng))
    return true;

  const c = store.combat;
  if (c) {
    if (c.reactingSeat === botSeat) {
      store.combatEndReaction();
      return true;
    }
    const atk = store.state.turn.active as Seat;
    const def = other(atk);
    if (c.step === "attackers" && atk === botSeat) {
      declareAttack(store, botSeat);
      return true;
    }
    if (
      c.step === "blockers" &&
      def === botSeat &&
      !Object.keys(c.blocks).length
    ) {
      selectBlocks(store, botSeat);
      return true;
    }
    if (c.step === "strikes" && atk === botSeat) {
      chooseStrike(store);
      return true;
    }
    // 6135 — le Géant du bot répartit sa Force : confirmer le préremplissage
    // (= politique auto, identique au comportement historique).
    if (c.step === "geant" && atk === botSeat) {
      store.combatGeantConfirm();
      return true;
    }
    if (c.step === "riposte" && atk === botSeat) {
      chooseRiposte(store);
      return true;
    }
    return false; // sinon : attendre que l'humain bloque / résolve
  }

  // Phase principale du bot (uniquement quand c'est son tour et sa vue).
  if (store.state.turn.active === botSeat && store.perspective === botSeat)
    return mainPhase(store, botSeat, tried);
  return false;
}
