# Hero movement & Havre-Sac protection — design

**Date:** 2026-07-08
**Status:** Approved (user delegated remaining decisions: "fait au mieux")

## Problem

The engine keeps each Hero permanently in its Havre-Sac and makes it always
targetable, so an opponent can damage/kill a Hero that the rules say is
**protected** in its bag (e.g. the bot sniping a Hero turn 1 with Tirlangue
Portey's tap-power). This violates the official range rules and the whole
Havre-Sac mechanic.

## Authoritative rules (wtcg-return.fr/regles/completes)

- **508.1a/b/c — Portée:** nothing an opponent controls can affect an object in
  the opponent's Havre-Sac. A card in a Havre-Sac reaches only the same bag +
  File d'Attente + own Défausse + Monde; a card in the Monde/Défausse reaches
  only Monde + File + Défausses (never a Havre-Sac). ⇒ a Hero in its bag is
  **unreachable** by the opponent.
- **414.1 — Mouvement:** moving a card Monde↔Havre-Sac is a "mouvement"; no
  resource cost. Allowed in Phase Principale.
- **506.3 — Premier tour:** no card enters the Monde and **no move to the Monde**
  during the first player's first turn.
- **307.3c — PM:** max number of Heroes/Allies sent into combat (attacker cap),
  unrelated to movement cost.
- **410.7 — Havre-Sac à 0 Résistance:** banned; Salles destroyed; **Allié/Héros
  inside are expelled into the Monde** (exposed).
- **103.2a / 410.4:** a Hero at ≤0 PV is destroyed → its controller loses.

**Model:** a Hero is safe in its bag. It becomes exposed (targetable, in the
Monde) only by (a) **moving out** to attack, or (b) being **expelled** when its
bag is destroyed. You win on PV only by catching it exposed or breaking its bag.

## Scope

- **Heroes only.** Allies are already played into the Monde in this engine, so
  they are already correctly exposed. Allies-played-into-a-bag is a separate
  follow-up, out of scope.
- Movement is **explicit** (player-chosen), not auto-on-attack (per user).

## Design

### 1. State + move action

- Hero instance already carries `location.zone`. Add a store action
  `moveHero(seat, to: "monde" | "havreSac")` emitting a `HERO_MOVED` event; the
  reducer relocates the hero instance between the `havreSac` interior and
  `state.monde` (updates `location.zone` and the zone arrays; `heroInstanceId`
  unchanged).
- Legality `whyCannotMoveHero(ctx, seat, to)`: your turn, Phase Principale,
  **turn.number > 1** when moving to the Monde (506.3), target zone differs from
  current. No cost. Repeatable.
- No summoning-sickness reset on move (the Hero was already in play).

### 2. Combat & effect targeting (the fix)

- `eligibleAttackers`: a **Hero is eligible only if `location.zone === "monde"`**
  (today it wrongly allows `havreSac`). Allies unchanged.
- `eligibleTargets` (combat): the opponent's Hero is a `CombatTarget` **only when
  in the Monde**. The Havre-Sac stays a separate target (Résistance). Allies in
  the Monde unchanged.
- Effect targeting range (508.x): a new reachability check excludes objects in an
  **opponent's Havre-Sac** from every targeting op (`damageTarget`,
  `damageMultiTarget`, `destroyTarget`, `tapTarget`, `buffForceTarget`,
  `healHeroTarget` restricted to own side already, etc.) and makes
  `damageOppHero` a no-op when the opponent's Hero is protected in its bag. This
  is centralised (one predicate `canReach(sourceZone, targetInst, controllers)`)
  so it can't drift per-op.
- **Consequence:** a Hero in the bag can't block either — only Monde cards
  defend; `eligibleBlockers` already iterates Monde/own creatures, verify it
  excludes a bagged Hero.

### 3. Havre-Sac destruction → expulsion (410.7)

- When a Havre-Sac reaches 0 Résistance (already banned today), **expel** its
  Hero to the Monde (move it, exposed) before continuing. This enables the
  break-the-bag kill-path and keeps 410.7 faithful.

### 4. Bot AI (`botPolicy` / `useBotOpponent`)

- v1 (safe, no stalls): the bot **keeps its Hero in the bag** (never exposes it),
  attacks with allies, targets the opponent's **Havre-Sac** to grind Résistance,
  and targets the opponent's Hero once it is exposed in the Monde. `declareAttack`
  target ranking already prefers low hero-HP; extend target eligibility to the
  exposed hero and keep the Havre-Sac as a grind target.
- No hero-movement decisions in v1 (Hero stays home). Aggressive expose/retreat
  heuristics are a future improvement.

### 5. UI (`GameBoard`, `PlayTableView`, `RuleAssistant`)

- Render the Hero in the Havre-Sac interior when bagged, in the Monde field when
  out. Action-bar on the selected own Hero: **"⚔ Sortir dans le Monde"** /
  **"🛡 Rentrer au Havre-Sac"**, gated by `whyCannotMoveHero`.
- A protected (bagged) opponent Hero is naturally absent from eligible targets,
  so the board won't offer it; add a short RuleAssistant hint ("Ton Héros est
  protégé dans son Havre-Sac ; sors-le pour attaquer — il devient alors
  vulnérable").

### 6. Testing

- Unit: `whyCannotMoveHero` (turn 1 / phase / not your turn); `moveHero`
  relocation both ways; `eligibleAttackers` (Hero only in Monde);
  `eligibleTargets` (opp Hero only in Monde); **range** (Tirlangue's
  `damageTarget` and `damageOppHero` no-op vs a bagged Hero — the reported bug);
  **expulsion** (bag Résistance→0 ⇒ Hero in Monde); heal cap unaffected.
- **Termination guard:** bot-vs-bot suite must still always reach a winner
  (grind-the-bag → expel → kill, plus the 18-XP path). This is the top risk;
  verify all 16 starter pairings terminate.
- Update existing tests that assumed a Hero is always a target / attacker.

## Risks

- **Termination / deadlock:** if neither bot breaks the other's bag and no one
  reaches 18 XP, a game could stall. Mitigation: bot grinds the Havre-Sac;
  verify termination in the harness (hard fail if not).
- **Broad combat regression:** many tests assume always-targetable Heroes; expect
  to update several and re-run the full suite.
- **Rules gap:** sections 702–705 (attacker/target declaration) were truncated on
  the rules site; the model above is derived from 508.x + 410.7 + 414.1 + 307.3c
  and the user's confirmation. If a 702-level rule contradicts, revisit.

## Build order

1. State + `moveHero` + `whyCannotMoveHero` + `HERO_MOVED` reducer + unit tests.
2. Targeting/range: `eligibleAttackers`, `eligibleTargets`, central `canReach`
   for effects, `damageOppHero` guard + unit tests (incl. the Tirlangue repro).
3. Expulsion (410.7) on Havre-Sac destruction + unit test.
4. Bot AI (defensive hero, grind bag, target exposed hero) + termination check.
5. UI (render location, Sortir/Rentrer, RuleAssistant hint).
6. Full suite + E2E smoke; deploy.
