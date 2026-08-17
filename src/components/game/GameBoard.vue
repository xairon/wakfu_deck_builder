<template>
  <div class="gtable" :class="{ 'gtable--dragging': dnd.isDragging.value }">
    <!-- Bandeau de ciblage combat (Attaquant / Bloquant) -->
    <div
      v-if="pendingCombatTarget"
      class="gcombat-banner gcombat-banner--targeting"
      data-testid="combat-targeting-banner"
    >
      <span>
        {{ pendingCombatTarget.role === 'attacking' ? '⚔️' : '🛡️' }}
        <strong>Ciblage de combat</strong> : Cliquez sur une carte dans le Monde pour la cibler
      </span>
      <button
        class="gbtn gbtn--sm gbtn--ghost"
        @click="pendingCombatTarget = null"
      >
        ✕ Annuler
      </button>
    </div>

    <!-- Bandeau de Résolution d'Effet (ciblage) -->

    <!-- Panneau de combat : liste les affrontements + aperçu de dégâts (remplace
         les anciennes flèches CombatLinks — les contours gslot--* suffisent au
         « qui frappe qui », le tray donne le détail lisible). -->
    <CombatTray />

    <!-- ════════ ADVERSAIRE : bande (HUD · socle · main · piles) puis champ ════════ -->
    <section class="gseat gseat--opp">
      <div class="gseat__strip">
        <SeatHud
          :name="store.players[opp].name"
          :active="store.turn.active === opp"
          :portrait="heroPortrait(opp)"
          :hero-name="heroName(opp)"
          :accent="heroAccent(opp)"
          :counters="heroCounters(opp)"
          :resources="store.resourcesOf(opp)"
          :bonus="manaBonus(opp)"
          @bump="(c, d) => bumpHero(opp, c, d)"
        />
        <div class="ghavre" aria-label="Havre-Sac adverse et son intérieur">
          <div class="gzone ghavre__bag">
            <span class="gzone__label">Havre-Sac</span>
            <div
              v-for="inst in havreCard(opp)"
              :key="inst.instanceId"
              class="gslot gslot--wide"
              :class="slotCls(inst.instanceId)"
              :data-iid="inst.instanceId"
            >
              <GameCard
                :instance="inst"
                :card="resolveCard(inst.cardId)"
                :selected="inst.instanceId === selectedId"
                @select="select(inst.instanceId)"
                @zoom="zoomInst(inst.instanceId)"
              />
            </div>
          </div>
          <div
            class="gzone ghavre__inside"
            aria-label="Intérieur du Havre-Sac adverse"
          >
            <span class="gzone__label"
              >Intérieur · {{ interiorCards(opp).length }}/{{
                havreTaille(opp)
              }}</span
            >
            <TransitionGroup tag="div" name="zone" class="gzone__cards">
              <div
                v-for="inst in interiorCards(opp)"
                :key="inst.instanceId"
                class="gslot gslot--small"
                :class="slotCls(inst.instanceId)"
                :data-iid="inst.instanceId"
              >
                <GameCard
                  :instance="inst"
                  :card="resolveCard(inst.cardId)"
                  :selected="inst.instanceId === selectedId"
                  @select="select(inst.instanceId)"
                  @zoom="zoomInst(inst.instanceId)"
                />
                <AttachedEquip
                  :bearer="inst"
                  :selected-id="selectedId"
                  @select="select"
                  @zoom="zoomInst"
                />
              </div>
              <div
                v-for="n in emptyInteriorSlots(opp)"
                :key="`ghost-opp-${n}`"
                class="gslot gslot--small gslot--ghost"
                aria-hidden="true"
              />
            </TransitionGroup>
          </div>
        </div>
        <HandFan
          class="gseat__handzone gseat__handzone--opp"
          :items="handList(opp)"
          :resolve-card="resolveCard"
          :selected-id="selectedId"
          @select="select"
          @zoom="zoomInst"
        />
        <div class="gpiles">
          <PileStack label="Pioche" :count="piocheCount(opp)" deck />
          <PileStack
            label="Défausse"
            :count="discardCount(opp)"
            :top="topDiscard(opp)"
            :top-card="resolveCard(topDiscard(opp)?.cardId ?? null)"
            browse
            @browse="openPileBrowser(opp, 'defausse')"
            @zoom="zoomInst"
          />
          <PileStack
            label="Bannie"
            :count="exileCount(opp)"
            :top="topExile(opp)"
            :top-card="resolveCard(topExile(opp)?.cardId ?? null)"
            browse
            @browse="openPileBrowser(opp, 'exil')"
            @zoom="zoomInst"
          />
          <PileStack label="Réserve" :count="reserveCount(opp)" deck reserve />
        </div>
      </div>
      <div class="gzone gzone--field" role="group" aria-label="Alliés adverses">
        <span v-if="!allies(opp).length" class="gzone__hint"
          >Alliés adverses</span
        >
        <TransitionGroup tag="div" name="zone" class="gzone__cards">
          <div
            v-for="inst in allies(opp)"
            :key="inst.instanceId"
            class="gslot"
            :class="slotCls(inst.instanceId)"
            :data-iid="inst.instanceId"
          >
            <div
              v-if="inst.instanceId === store.opponentTargetedCardId"
              class="gslot__target-badge"
            >
              🎯 Ciblée par l'adversaire
            </div>
            <GameCard
              :instance="inst"
              :card="resolveCard(inst.cardId)"
              :selected="inst.instanceId === selectedId"
              @select="select(inst.instanceId)"
              @zoom="zoomInst(inst.instanceId)"
            />
            <AttachedEquip
              :bearer="inst"
              :selected-id="selectedId"
              @select="select"
              @zoom="zoomInst"
            />
          </div>
        </TransitionGroup>
      </div>
    </section>

    <!-- ════════ LIGNE MÉDIANE — LE MONDE / FILE D'ATTENTE ════════ -->
    <div
      class="gmid"
      :class="zoneCls('queue')"
      :ref="
        (el) =>
          registerZone('queue', el, { zone: 'fileAttente' }, 'File d\'attente')
      "
    >
      <span class="gmid__label">⬩ Le Monde ⬩</span>
      <div v-if="queue.length" class="gmid__queue">
        <span class="gmid__queue-label">File d'attente</span>
        <TransitionGroup tag="div" name="zone" class="gzone__cards">
          <div
            v-for="inst in queue"
            :key="inst.instanceId"
            class="gslot gslot--small"
          >
            <GameCard
              :instance="inst"
              :card="resolveCard(inst.cardId)"
              draggable
              :selected="inst.instanceId === selectedId"
              @select="select(inst.instanceId)"
              @zoom="zoomInst(inst.instanceId)"
            />
          </div>
        </TransitionGroup>
      </div>
    </div>

    <!-- ════════ TOI : champ pleine largeur puis bande (HUD · socle · main · piles) ════════ -->
    <section class="gseat">
      <div
        class="gzone gzone--field gzone--play"
        :class="zoneCls('monde')"
        role="group"
        aria-label="Vos alliés"
        :ref="(el) => registerZone('monde', el, { zone: 'monde' }, 'Monde')"
      >
        <span v-if="!allies(me).length" class="gzone__hint"
          >⬇ Glissez une carte ici pour la jouer</span
        >
        <TransitionGroup tag="div" name="zone" class="gzone__cards">
          <div
            v-for="inst in allies(me)"
            :key="inst.instanceId"
            class="gslot"
            :class="slotCls(inst.instanceId)"
            :data-iid="inst.instanceId"
          >
            <div
              v-if="inst.instanceId === store.opponentTargetedCardId"
              class="gslot__target-badge"
            >
              🎯 Ciblée par l'adversaire
            </div>
            <GameCard
              :instance="inst"
              :card="resolveCard(inst.cardId)"
              draggable
              :selected="inst.instanceId === selectedId"
              @select="select(inst.instanceId)"
              @zoom="zoomInst(inst.instanceId)"
            />
            <AttachedEquip
              :bearer="inst"
              :selected-id="selectedId"
              @select="select"
              @zoom="zoomInst"
            />
          </div>
        </TransitionGroup>
      </div>
      <div class="gseat__strip">
        <SeatHud
          :name="store.players[me].name"
          :active="store.turn.active === me"
          :portrait="heroPortrait(me)"
          :hero-name="heroName(me)"
          :accent="heroAccent(me)"
          :counters="heroCounters(me)"
          :resources="store.resourcesOf(me)"
          :bonus="manaBonus(me)"
          @bump="(c, d) => bumpHero(me, c, d)"
        />
        <div class="ghavre" aria-label="Havre-Sac et son intérieur">
          <div class="gzone ghavre__bag">
            <span class="gzone__label">Havre-Sac</span>
            <div
              v-for="inst in havreCard(me)"
              :key="inst.instanceId"
              class="gslot gslot--wide"
              :class="slotCls(inst.instanceId)"
              :data-iid="inst.instanceId"
            >
              <div
                v-if="inst.instanceId === store.opponentTargetedCardId"
                class="gslot__target-badge"
              >
                🎯 Ciblée par l'adversaire
              </div>
              <GameCard
                :instance="inst"
                :card="resolveCard(inst.cardId)"
                :selected="inst.instanceId === selectedId"
                @select="select(inst.instanceId)"
                @zoom="zoomInst(inst.instanceId)"
              />
            </div>
          </div>
          <div
            class="gzone ghavre__inside"
            :class="zoneCls('socle')"
            aria-label="Intérieur du Havre-Sac"
            :ref="
              (el) =>
                registerZone(
                  'socle',
                  el,
                  { zone: 'havreSac', owner: me },
                  'Intérieur du Havre-Sac',
                )
            "
          >
            <span class="gzone__label"
              >Intérieur · {{ interiorCards(me).length }}/{{
                havreTaille(me)
              }}</span
            >
            <TransitionGroup tag="div" name="zone" class="gzone__cards">
              <div
                v-for="inst in interiorCards(me)"
                :key="inst.instanceId"
                class="gslot gslot--small"
                :class="slotCls(inst.instanceId)"
                :data-iid="inst.instanceId"
              >
                <GameCard
                  :instance="inst"
                  :card="resolveCard(inst.cardId)"
                  draggable
                  :selected="inst.instanceId === selectedId"
                  @select="select(inst.instanceId)"
                  @zoom="zoomInst(inst.instanceId)"
                />
                <AttachedEquip
                  :bearer="inst"
                  :selected-id="selectedId"
                  @select="select"
                  @zoom="zoomInst"
                />
              </div>
              <div
                v-for="n in emptyInteriorSlots(me)"
                :key="`ghost-me-${n}`"
                class="gslot gslot--small gslot--ghost"
                aria-hidden="true"
              />
            </TransitionGroup>
          </div>
        </div>
        <div
          class="gseat__handzone"
          :class="zoneCls('main')"
          :ref="
            (el) =>
              registerZone('main', el, { zone: 'main', owner: me }, 'Main')
          "
        >
          <HandFan
            mine
            draggable
            :items="handList(me)"
            :resolve-card="resolveCard"
            :selected-id="selectedId"
            @select="select"
            @zoom="zoomInst"
          />
        </div>
        <div class="gpiles">
          <span
            :class="zoneCls('pioche')"
            class="gpiles__slot"
            :ref="
              (el) =>
                registerZone(
                  'pioche',
                  el,
                  { zone: 'pioche', owner: me },
                  'Pioche',
                  { at: 'top' },
                )
            "
          >
            <PileStack
              label="Pioche"
              :count="piocheCount(me)"
              deck
              @act="onPiocheClick"
            />
          </span>
          <span
            :class="zoneCls('defausse')"
            class="gpiles__slot"
            :ref="
              (el) =>
                registerZone(
                  'defausse',
                  el,
                  { zone: 'defausse', owner: me },
                  'Défausse (Cimetière)',
                  { at: 'top' },
                )
            "
          >
            <PileStack
              label="Défausse"
              :count="discardCount(me)"
              :top="topDiscard(me)"
              :top-card="resolveCard(topDiscard(me)?.cardId ?? null)"
              browse
              @browse="openPileBrowser(me, 'defausse')"
              @zoom="zoomInst"
            />
          </span>
          <span
            :class="zoneCls('exil')"
            class="gpiles__slot"
            :ref="
              (el) =>
                registerZone(
                  'exil',
                  el,
                  { zone: 'exil', owner: me },
                  'Zone Bannie (Exil)',
                  { at: 'top' },
                )
            "
          >
            <PileStack
              label="Bannie"
              :count="exileCount(me)"
              :top="topExile(me)"
              :top-card="resolveCard(topExile(me)?.cardId ?? null)"
              browse
              @browse="openPileBrowser(me, 'exil')"
              @zoom="zoomInst"
            />
          </span>
          <span
            :class="zoneCls('reserve')"
            class="gpiles__slot"
            :ref="
              (el) =>
                registerZone(
                  'reserve',
                  el,
                  { zone: 'reserve', owner: me },
                  'Réserve',
                )
            "
          >
            <!-- 101.4 : la Réserve est un sideboard (entre les parties) — affichée
                 pour info mais NON piochable en jeu. -->
            <PileStack label="Réserve" :count="reserveCount(me)" reserve />
          </span>
          <!-- TL4 / TL5 — gestes manuels (table libre non assistée) : Piocher
               (double le clic sur la pile) + Montrer sa main à l'adversaire
               (Filouterie). Masqués en mode assisté / hors ligne. -->
          <span
            class="gpiles__slot gpiles__manual"
          >

            <div class="gmore-wrapper">
              <button
                type="button"
                class="gbtn gbtn--sm gbtn--more"
                data-testid="action-more-menu"
                title="Actions de table et utilitaires…"
                @click.stop="showMoreMenu = !showMoreMenu"
              >
                💬 ...
              </button>

              <div
                v-if="showMoreMenu"
                class="gmore-dropdown"
                @click.stop
              >
                <button
                  class="gmore-item"
                  data-testid="action-draw"
                  title="Piocher une carte de ta Pioche."
                  @click="runMoreAction(drawOne)"
                >
                  🎴 Piocher
                </button>
                <button
                  class="gmore-item"
                  data-testid="action-mill"
                  title="Envoyer la carte du dessus de la Pioche à la Défausse (Mill)."
                  @click="runMoreAction(millOne)"
                >
                  💀 Mill (Défausser du dessus)
                </button>
                <button
                  v-if="canRevealHand"
                  class="gmore-item"
                  data-testid="action-reveal-hand"
                  title="Montrer ta main à l'adversaire (Filouterie)."
                  @click="runMoreAction(revealHandToOpponent)"
                >
                  👁 Montrer ma main
                </button>
                <button
                  class="gmore-item"
                  title="Incliner toutes les cartes sur le plateau"
                  @click="runMoreAction(tapAllOnBoard)"
                >
                  🔄 Incliner tout
                </button>
                <button
                  class="gmore-item"
                  title="Redresser toutes les cartes sur le plateau"
                  @click="runMoreAction(untapAllOnBoard)"
                >
                  ⬆️ Redresser tout
                </button>
                <button
                  class="gmore-item"
                  data-testid="action-search-deck"
                  title="Chercher dans ta Pioche (elle sera mélangée en refermant)."
                  @click="runMoreAction(openDeckSearch)"
                >
                  🔍 Chercher dans la pioche
                </button>
                <button
                  class="gmore-item"
                  data-testid="action-create-token"
                  title="Mettre en jeu un jeton de créature (effet joué à la main)."
                  @click="runMoreAction(() => { tokenDialog = true; })"
                >
                  ⬚ Créer un Jeton
                </button>
                <button
                  class="gmore-item"
                  title="Lancer un d6 (résultat au journal, tiré par le serveur)."
                  @click="runMoreAction(() => store.rollDie(6))"
                >
                  🎲 Lancer un Dé (d6)
                </button>
                <button
                  class="gmore-item"
                  title="Chi-Fu-Mi aléatoire (résultat au journal, tiré par le serveur)."
                  @click="runMoreAction(() => store.rollDie(3))"
                >
                  ✊✋✌ Pierre - Feuille - Ciseaux
                </button>
              </div>
            </div>
          </span>
        </div>
      </div>
    </section>



    <!-- ════════ Bouton Fin du tour (façon MTGA) ════════ -->
    <!-- N'apparaît que pour le joueur DONT c'est le tour : en local hot-seat la
         perspective suit le joueur actif (toujours visible) ; en ligne, seul le
         joueur actif le voit. -->
    <button
      v-show="
        store.turn.active === store.perspective &&
        !store.pendingChifumi &&
        !store.pendingResolution &&
        !store.combat &&
        !store.pendingPayment &&
        !store.effectTargeting &&
        !store.pendingBearer &&
        !store.effectChoice
      "
      type="button"
      class="gendturn"
      aria-label="Finir le tour"
      data-testid="end-turn"
      @click="store.endTurn()"
    >
      <span class="gendturn__ring" aria-hidden="true"></span>
      <span class="gendturn__txt">Fin du<br />tour</span>
    </button>

    <!-- ════════ Bandeau de PAIEMENT au choix (coût de lancement) ════════ -->
    <Transition name="slidedown">
      <div
        v-if="store.pendingPayment"
        class="gcombat gcombat--effect"
        role="toolbar"
        aria-label="Paiement du coût"
        data-testid="payment-banner"
      >
        <span class="gcombat__step">
          💠 Incline tes producteurs de Ressources —
          {{ store.pendingPayment.chosen.length }}/{{
            store.pendingPayment.cost
          }}
          (clique tes cartes, re-clic pour retirer)
        </span>
        <div class="gcombat__btns">
          <button
            class="gbtn gbtn--accent"
            data-testid="payment-auto"
            @click="store.payAuto()"
          >
            ⚡ Auto
          </button>
          <button
            class="gbtn gbtn--ghost"
            data-testid="payment-cancel"
            @click="store.payCancel()"
          >
            Annuler
          </button>
        </div>
      </div>
    </Transition>
    <!-- ════════ Bandeau de ciblage d'effet ════════ -->
    <Transition name="slidedown">
      <div
        v-if="store.pendingBearer"
        class="gcombat gcombat--effect"
        role="toolbar"
        aria-label="Ciblage de Porteur"
      >
        <span class="gcombat__step">
          🛡️ choisis la créature qui portera cet équipement
        </span>
        <div class="gcombat__btns">
          <button
            class="gbtn gbtn--ghost"
            @click="store.cancelBearerTargeting()"
          >
            Annuler
          </button>
        </div>
      </div>
    </Transition>
    <Transition name="slidedown">
      <div
        v-if="store.effectTargeting"
        class="gcombat gcombat--effect"
        role="toolbar"
        aria-label="Ciblage d'effet"
      >
        <span class="gcombat__step">
          ✨ {{ store.effectTargeting.cardName }} —
          {{
            targetingLabel(
              store.effectTargeting.op,
              store.effectTargeting.multi,
            )
          }}
        </span>
        <div class="gcombat__btns">
          <button class="gbtn gbtn--ghost" @click="store.effectTargetSkip()">
            Passer
          </button>
        </div>
      </div>
    </Transition>

    <!-- ════ Fenêtre d'annulation (Échec Critique) : l'adversaire réagit ════ -->
    <Transition name="slidedown">
      <div
        v-if="store.pendingResolution"
        class="gcombat"
        role="status"
        aria-live="polite"
      >
        <span class="gcombat__step">
          {{ store.pendingResolution.cardName }} vient d'être joué — jouez Échec
          Critique pour en annuler les effets, ou passez.
        </span>
        <div class="gcombat__btns">
          <button
            class="gbtn gbtn--ghost"
            @click="store.passPendingResolution()"
          >
            Passer
          </button>
        </div>
      </div>
    </Transition>

    <!-- ════ Mini-jeu Chi-Fu-Mi (Kanigrou : prévention pré-dégâts) ════ -->
    <Transition name="slidedown">
      <div
        v-if="store.pendingChifumi"
        class="gcombat"
        role="status"
        aria-live="polite"
      >
        <span class="gcombat__step">
          <template v-if="chifumiBotActing">
            Chi-Fu-Mi — l'adversaire joue son coup…
          </template>
          <template v-else-if="store.pendingChifumi.phase === 'offer'">
            Le Kanigrou est sur le point de recevoir des Dommages — jouer à
            Chi-Fu-Mi ?
          </template>
          <template v-else-if="store.pendingChifumi.oppChoice === null">
            Chi-Fu-Mi — l'adversaire choisit (en secret).
          </template>
          <template v-else> Chi-Fu-Mi — à votre tour de choisir. </template>
        </span>
        <!-- Boutons masqués quand c'est au BOT d'agir (le driver répond pour
             lui) — sinon l'humain pouvait cliquer À SA PLACE avant le tick. -->
        <div v-if="!chifumiBotActing" class="gcombat__btns">
          <template v-if="store.pendingChifumi.phase === 'offer'">
            <button class="gbtn" @click="store.chifumiAccept()">Jouer</button>
            <button class="gbtn gbtn--ghost" @click="store.chifumiDecline()">
              Subir
            </button>
          </template>
          <template v-else>
            <button class="gbtn" @click="store.chifumiChoose('pierre')">
              ✊ Pierre
            </button>
            <button class="gbtn" @click="store.chifumiChoose('feuille')">
              ✋ Feuille
            </button>
            <button class="gbtn" @click="store.chifumiChoose('ciseaux')">
              ✌ Ciseaux
            </button>
          </template>
        </div>
      </div>
    </Transition>

    <!-- ════════ Bandeau de combat (déclaration → blocage → résolution) ════════ -->
    <Transition name="slidedown">
      <div
        v-if="store.combat"
        ref="combatBar"
        tabindex="-1"
        class="gcombat"
        role="toolbar"
        aria-label="Combat en cours"
        @keydown.esc.prevent="store.combatCancel()"
      >
        <span
          v-if="store.online"
          class="gcombat__step"
          role="status"
          aria-live="polite"
        >
          {{
            store.combat.step === "strikes"
              ? "🎯 Clique le bloqueur qui encaisse la Force de l'attaquant surligné (6105)"
              : store.combat.step === "geant"
                ? "🗿 Répartis la Force du Géant entre ses bloqueurs (6135), puis confirme"
                : store.combat.step === "riposte"
                  ? "↩ Clique l'attaquant que la Cible riposte (707.1)"
                  : store.combat.step === "attackers"
                    ? "⚔ Choisis tes attaquants puis une cible adverse"
                    : store.combatCanConfirmBlocks
                      ? store.combat.pendingBlocker
                        ? "🛡 Choisis l'attaquant que ce bloqueur affronte"
                        : "🛡 Déclare tes bloqueurs puis « Confirmer les blocages » (ou confirme à vide pour laisser passer)"
                      : store.combatWaitingForBlocks
                        ? "⏳ En attente des blocages adverses…"
                        : store.combatCanResolve
                          ? "⚔ Blocages déclarés — « Résoudre le combat »"
                          : "⏳ En attente de l'adversaire…"
          }}
        </span>
        <span v-else class="gcombat__step" role="status" aria-live="polite">
          {{
            store.combat.reactingSeat
              ? `↩ Réaction de ${store.players[store.combat.reactingSeat].name} — joue puis « Fini de réagir »`
              : store.combat.step === "attackers"
                ? "⚔ Choisis tes attaquants puis une cible adverse"
                : store.combat.step === "strikes"
                  ? "🎯 Choisis le bloqueur qui encaisse la Force de l'attaquant en vert"
                  : store.combat.step === "geant"
                    ? "🗿 Répartis la Force du Géant entre ses bloqueurs (clic ou +/−), puis confirme"
                    : store.combat.step === "riposte"
                      ? "↩ La Cible riposte : choisis l'attaquant qu'elle frappe"
                      : store.combat.pendingBlocker
                        ? "🛡 Choisis l'attaquant que ce bloqueur affronte"
                        : store.defenderCanReact
                          ? "⚡ Tu peux RÉAGIR : joue une Action ou un pouvoir, puis bloque et « Résoudre le combat »"
                          : `🛡 Déclare les bloqueurs de ${store.players[opp].name} (ou « Résoudre le combat » pour laisser passer)`
          }}
        </span>
        <span class="gcombat__info">
          {{ store.combat.attackers.length }} attaquant(s)
          <template v-if="store.combat.step === 'attackers'">
            <template v-if="!store.combat.attackers.length">
              · choisis un attaquant</template
            >
            <template v-else-if="!store.combat.target">
              · cible : à choisir</template
            >
            <template v-else> · prêt à confirmer</template>
          </template>
          <template v-else>
            <template v-if="store.combat.target"> · cible choisie</template>
            <template v-if="store.combat.step === 'blockers'">
              · {{ Object.keys(store.combat.blocks).length }} bloqueur(s)
            </template>
          </template>
        </span>
        <!-- Aperçu (dry-run) : ce que la résolution donnerait MAINTENANT. -->
        <span
          v-if="store.combatPreview"
          class="gcombat__preview"
          data-testid="combat-preview"
        >
          👁 Aperçu :
          <template
            v-if="
              previewHpAfter(store.combat.target?.instanceId ?? '') !== null
            "
          >
            cible {{ previewHpAfter(store.combat.target?.instanceId ?? "") }}
            {{ targetVitalLabel() }}
          </template>
          <template v-if="store.combatPreview.lethal.length">
            · ☠ {{ store.combatPreview.lethal.length }} détruite(s)
          </template>
          <template
            v-else-if="
              previewHpAfter(store.combat.target?.instanceId ?? '') === null
            "
          >
            aucun dégât
          </template>
        </span>
        <!-- Annonce a11y : le ☠/grisage des cartes vouées à mourir n'est pas
             perceptible au lecteur d'écran ; on le verbalise ici. -->
        <p v-if="lethalCardNames().length" class="sr-only" role="status">
          Si le combat est résolu maintenant,
          {{ lethalCardNames().length }} carte(s) seront détruite(s) :
          {{ lethalCardNames().join(", ") }}.
        </p>
        <!-- 6135 — répartition de la Force du GÉANT : préremplie avec la
             politique auto, ajustable par +/− (ou clic sur une carte surlignée),
             la Cible n'acceptant le reliquat que si tous les bloqueurs sont
             létaux (validation whyBadGeantAssign, motif affiché). -->
        <div
          v-if="store.combat.step === 'geant' && store.combat.geantFor"
          class="gcombat__geant"
          role="group"
          aria-label="Répartition de la Force du Géant"
        >
          <span class="gcombat__info">
            🗿 {{ cardNameOf(store.combat.geantFor) }} — reste
            <strong>{{ geantRemaining }}</strong>
          </span>
          <span
            v-for="id in store.combatGeantIds"
            :key="id"
            class="gcombat__geantrow"
          >
            <span class="gcombat__geantname">
              {{ cardNameOf(id)
              }}<template v-if="id === store.combat.target?.instanceId">
                (Cible)</template
              >
            </span>
            <button
              class="gbtn gbtn--ghost gbtn--tiny"
              :aria-label="`Retirer 1 Dommage à ${cardNameOf(id)}`"
              @click="store.combatGeantAdjust(id, -1)"
            >
              −
            </button>
            <span class="gcombat__geantn">{{ geantShare(id) }}</span>
            <button
              class="gbtn gbtn--ghost gbtn--tiny"
              :disabled="geantRemaining <= 0"
              :aria-label="`Ajouter 1 Dommage à ${cardNameOf(id)}`"
              @click="store.combatGeantAdjust(id, +1)"
            >
              +
            </button>
          </span>
          <button
            class="gbtn gbtn--accent"
            data-testid="geant-confirm"
            :disabled="!!store.combatGeantReason"
            :title="store.combatGeantReason ?? undefined"
            @click="store.combatGeantConfirm()"
          >
            Confirmer la répartition
          </button>
          <span
            v-if="store.combatGeantReason"
            class="gcombat__info"
            role="status"
          >
            {{ store.combatGeantReason }}
          </span>
        </div>
        <div class="gcombat__btns">
          <!-- EN LIGNE (P3) : combat au journal, contrôles selon le rôle -->
          <template v-if="store.online">
            <!-- Choix fin LOCAL (frappe 6105 / riposte 707.1) : on clique une
                 carte (pas de bouton de confirmation). L'attaquant peut annuler. -->
            <template
              v-if="
                store.combat.step === 'strikes' ||
                store.combat.step === 'riposte'
              "
            >
              <span class="gcombat__info">Clique une carte pour choisir…</span>
              <button
                v-if="store.combat.step === 'strikes'"
                class="gbtn gbtn--ghost"
                @click="store.combatCancel()"
              >
                Annuler l'attaque
              </button>
            </template>
            <template v-else>
              <button
                v-if="store.combat.step === 'attackers'"
                class="gbtn gbtn--accent"
                :disabled="
                  !store.combat.attackers.length || !store.combat.target
                "
                data-testid="combat-confirm"
                @click="store.combatConfirmAttackers()"
              >
                Confirmer l'attaque
              </button>
              <button
                v-else-if="store.combatCanConfirmBlocks"
                class="gbtn gbtn--accent"
                data-testid="combat-confirm-blocks"
                @click="store.combatConfirmBlocks()"
              >
                Confirmer les blocages
              </button>
              <button
                v-else-if="store.combatCanResolve"
                class="gbtn gbtn--accent"
                data-testid="combat-resolve"
                @click="store.combatResolve()"
              >
                Résoudre le combat
              </button>
              <button
                v-if="
                  store.combat.step === 'attackers' ||
                  store.combatWaitingForBlocks ||
                  store.combatCanResolve
                "
                class="gbtn gbtn--ghost"
                @click="store.combatCancel()"
              >
                {{
                  store.combat.step === "attackers"
                    ? "Annuler"
                    : "Annuler l'attaque"
                }}
              </button>
            </template>
          </template>
          <!-- LOCAL (hot-seat) : pilotage à un écran, inchangé -->
          <template v-else>
            <button
              v-if="store.combat.reactingSeat"
              class="gbtn gbtn--accent"
              @click="store.combatEndReaction()"
            >
              Fini de réagir
            </button>
            <template v-else>
              <button
                v-if="store.combat.step === 'attackers'"
                class="gbtn gbtn--accent"
                :disabled="
                  !store.combat.attackers.length || !store.combat.target
                "
                data-testid="combat-confirm"
                @click="store.combatConfirmAttackers()"
              >
                Confirmer l'attaque
              </button>
              <template v-else-if="store.combat.step === 'blockers'">
                <button
                  class="gbtn gbtn--accent"
                  data-testid="combat-resolve"
                  @click="store.combatResolve()"
                >
                  Résoudre le combat
                </button>
                <!-- Passation de réaction explicite : hot-seat uniquement (en solo,
                     le défenseur réagit AUTO pendant l'attaque — cf. defenderCanReact). -->
                <button
                  v-if="!store.botSeat"
                  class="gbtn gbtn--ghost"
                  @click="store.combatOfferReaction()"
                >
                  Laisser réagir l'adversaire
                </button>
              </template>
              <button class="gbtn gbtn--ghost" @click="store.combatCancel()">
                {{
                  store.combat.step === "attackers"
                    ? "Annuler"
                    : "Annuler l'attaque"
                }}
              </button>
            </template>
          </template>
        </div>
      </div>
    </Transition>

    <!-- ════════ Barre d'action de la carte sélectionnée ════════ -->
    <Transition name="slideup">
      <div
        v-if="selectedInst"
        ref="actionbarRef"
        class="gactionbar"
        role="toolbar"
        aria-label="Actions de la carte sélectionnée"
        @keydown.esc.prevent="selectedId = null"
      >
        <span class="gactionbar__name">{{ selectedName }}</span>
        <div class="gactionbar__btns">
          <button
            v-if="canAttackSelected"
            class="gbtn gbtn--accent"
            data-testid="action-attack"
            @click="attackWithSelected"
          >
            ⚔ Attaquer
          </button>
          <button
            v-if="canActivateSelected"
            class="gbtn gbtn--accent"
            @click="activateSelected"
          >
            ⚡ Activer
          </button>
          <button
            v-if="selectedIsMyHero && heroMove"
            class="gbtn gbtn--accent"
            data-testid="action-move-hero"
            :disabled="!!heroMove.reason"
            :title="
              heroMove.reason ??
              (heroMove.to === 'monde'
                ? 'Ton Héros s’expose (ciblable) pour attaquer.'
                : 'Ton Héros se met à l’abri dans son Havre-Sac.')
            "
            @click="moveHeroSelected"
          >
            {{
              heroMove.to === "monde"
                ? "⚔ Sortir dans le Monde"
                : "🛡 Rentrer au Havre-Sac"
            }}
          </button>
          <!-- Allié : Sortir/Rentrer (414.1) — même geste que le Héros, appliqué à
               une créature sélectionnée qui n'est pas le Héros. -->
          <button
            v-else-if="allyMove"
            class="gbtn gbtn--accent"
            data-testid="action-move-ally"
            :disabled="!!allyMove.reason"
            :title="
              allyMove.reason ??
              (allyMove.to === 'monde'
                ? 'Cet Allié sort dans le Monde (exposé, il peut attaquer).'
                : 'Cet Allié rentre à l’abri dans ton Havre-Sac.')
            "
            @click="moveCreatureSelected"
          >
            {{
              allyMove.to === "monde"
                ? "⚔ Sortir dans le Monde"
                : "🛡 Rentrer au Havre-Sac"
            }}
          </button>
          <button class="gbtn gbtn--accent" @click="tapSelected">
            {{
              selectedInst.orientation === "tapped"
                ? "↺ Redresser"
                : "↻ Incliner"
            }}
          </button>
          <button
            class="gbtn gbtn--accent"
            title="Incliner toute la pile (le Porteur + tous ses Équipements attachés)"
            @click="tapStackSelected"
          >
            🥞 Incliner pile
          </button>
          <button
            class="gbtn gbtn--accent"
            title="Redresser toute la pile (le Porteur + tous ses Équipements attachés)"
            @click="untapStackSelected"
          >
            ⬆️ Redresser pile
          </button>
          <!-- A19 — FABRICATION (305.4/418.6) : carte de MA main portant une
               Recette. Actif quand la fabrication est légale ; sinon désactivé
               avec la raison lisible (affordance MTGA : l'option existe, la
               contrainte est expliquée). -->
          <button
            v-if="selectedCraft"
            class="gbtn gbtn--accent"
            data-testid="action-craft"
            :disabled="!!selectedCraft.reason"
            :title="
              selectedCraft.reason ??
              `Recette : ${selectedCraft.recette.metier} — incliner un Artisan et recycler ${selectedCraft.recette.n} carte(s) ${selectedCraft.recette.element} de ta Défausse.`
            "
            @click="craftSelected"
          >
            🔨 Fabriquer
          </button>
          <!-- TL3 — ÉQUIPER (table libre) : attacher cet Équipement sur un
               Porteur (clic ensuite sur la créature surlignée). -->
          <button
            v-if="canEquipSelected"
            class="gbtn gbtn--accent"
            data-testid="action-equip"
            title="Attacher cet Équipement à un Porteur (clique ensuite la créature)."
            @click="equipSelected"
          >
            🔗 Équiper
          </button>
          <!-- F5 — « révélez une carte » : montrer CETTE carte de ma main. -->
          <button
            v-if="canShowSelected"
            class="gbtn"
            data-testid="action-show-card"
            title="Montrer cette carte à l'adversaire (elle reste en main)."
            @click="showSelectedCard"
          >
            👁 Montrer
          </button>
          <span class="gactionbar__sep"></span>
          <button class="gbtn" @click="moveSelected('monde')">→ Monde</button>
          <button class="gbtn" @click="moveSelected('havreSac')">→ Socle</button>
          <button class="gbtn" @click="moveSelected('main')">→ Main</button>

          <button class="gbtn" @click="moveSelected('defausse', { at: 'top' })">
            Défausser
          </button>
          <button class="gbtn" @click="moveSelected('exil', { at: 'top' })">
            🚫 Bannir
          </button>
          <button class="gbtn" @click="moveSelected('pioche', { at: 'top' })">
            ↑ Pioche
          </button>
          <button
            class="gbtn"
            @click="moveSelected('pioche', { at: 'bottom' })"
          >
            ↓ Pioche
          </button>
          <span class="gactionbar__sep"></span>
          <button class="gbtn gbtn--counter" @click="bumpDamage(1)">
            + Dmg
          </button>
          <button class="gbtn gbtn--counter" @click="bumpDamage(-1)">
            − Dmg
          </button>
          <!-- CADRE — effets « ±N Force » joués à la main : compteur nommé
               « force », public et LU PAR LE COMBAT SERVEUR (effectiveForce). -->
          <template v-if="store.manualTable">
            <button
              class="gbtn gbtn--counter"
              data-testid="bump-force-up"
              title="Effet manuel : +1 Force (pris en compte par le combat)"
              @click="bumpForce(1)"
            >
              + Force
            </button>
            <button
              class="gbtn gbtn--counter"
              title="Effet manuel : −1 Force (pris en compte par le combat)"
              @click="bumpForce(-1)"
            >
              − Force
            </button>
          </template>
          <button class="gbtn" @click="zoomInst(selectedInst.instanceId); selectedId = null">
            ⤢ Agrandir
          </button>
          <button
            class="gbtn gbtn--ghost"
            aria-label="Fermer"
            @click="selectedId = null"
          >
            ✕
          </button>
        </div>
      </div>
    </Transition>

    <!-- ════ Consultation d'une pile publique (Défausse, façon cimetière MTGA) :
         la pile n'affiche que la carte du dessus — ce panneau liste TOUT son
         contenu, du dessus au dessous ; clic sur une carte = agrandir. ════ -->
    <div
      v-if="pileBrowse"
      class="gpilebrowser"
      data-testid="pile-browser"
      role="dialog"
      aria-modal="true"
      :aria-label="`Défausse de ${store.players[pileBrowse.seat].name}`"
      tabindex="-1"
      @click.self="pileBrowse = null"
      @keydown.esc.prevent="pileBrowse = null"
    >
      <div class="gpilebrowser__panel">
        <header class="gpilebrowser__head">
          <h2 class="gpilebrowser__title">
            {{ pileBrowse.zone === 'exil' ? 'Zone Bannie (Exil)' : 'Défausse (Cimetière)' }} — {{ store.players[pileBrowse.seat].name }}
            <span class="gpilebrowser__count"
              >{{ browsedPile.length }} carte(s)</span
            >
          </h2>
          <button
            class="gbtn gbtn--ghost"
            aria-label="Fermer"
            data-testid="pile-browser-close"
            @click="pileBrowse = null"
          >
            ✕
          </button>
        </header>
        <p class="gpilebrowser__hint">
          Du dessus (la plus récente) au dessous — clique une carte pour
          l'agrandir.
          <template v-if="pileBrowse.seat === me">
            Les effets « Récupérez… » se jouent d'ici : reprends la carte en
            main, en jeu ou sur la Pioche.
          </template>
        </p>
        <div class="gpilebrowser__grid">
          <div
            v-for="inst in browsedPile"
            :key="inst.instanceId"
            class="gpilebrowser__slot"
          >
            <GameCard
              :instance="inst"
              :card="resolveCard(inst.cardId)"
              @select="zoomInst(inst.instanceId)"
              @zoom="zoomInst(inst.instanceId)"
            />
            <!-- Récupération depuis MA Défausse (effets « Récupérez… ») —
                 demandée par les playtesters : la Défausse était consultable
                 mais inerte. moveTo/MOVE_CARD portent la légalité. -->
            <div v-if="pileBrowse.seat === me" class="gpilebrowser__actions">
              <button
                class="gbtn gbtn--sm"
                :data-testid="`pile-recover-main-${inst.instanceId}`"
                title="Reprendre cette carte en main"
                @click="recoverFromPile(inst.instanceId, 'main')"
              >
                → Main
              </button>
              <button
                class="gbtn gbtn--sm"
                title="Mettre cette carte en jeu dans le Monde"
                @click="recoverFromPile(inst.instanceId, 'monde')"
              >
                → Monde
              </button>
              <button
                class="gbtn gbtn--sm"
                title="Mettre cette carte dans ton Havre-Sac"
                @click="recoverFromPile(inst.instanceId, 'havreSac')"
              >
                → Socle
              </button>
              <button
                class="gbtn gbtn--sm"
                title="Poser cette carte sur le dessus de ta Pioche"
                @click="recoverFromPile(inst.instanceId, 'pioche')"
              >
                ↑ Pioche
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ════ F2 — Recherche dans MA Pioche (tuteur) ════ -->
    <div
      v-if="deckBrowse"
      class="gpilebrowser"
      data-testid="deck-browser"
      role="dialog"
      aria-modal="true"
      aria-label="Recherche dans ta Pioche"
      tabindex="-1"
      @click.self="closeDeckSearch"
      @keydown.esc.prevent="closeDeckSearch"
    >
      <div class="gpilebrowser__panel">
        <header class="gpilebrowser__head">
          <h2 class="gpilebrowser__title">
            Ta Pioche (Ordre réel du deck)
            <span class="gpilebrowser__count"
              >{{ myDeckCards.length }} carte(s)</span
            >
          </h2>
          <button
            class="gbtn gbtn--ghost"
            aria-label="Fermer et mélanger"
            @click="closeDeckSearch"
          >
            ✕
          </button>
        </header>
        <p class="gpilebrowser__hint">
          Consultation privée : les cartes sont présentées dans <strong>l'ordre exact de la pioche</strong> (du sommet #1 au fond du deck). En refermant, ta Pioche sera <strong>mélangée</strong> (507.4).
        </p>
        <div class="gpilebrowser__grid">
          <div
            v-for="(inst, idx) in myDeckCards"
            :key="inst.instanceId"
            class="gpilebrowser__slot"
          >
            <div class="gpilebrowser__pos">
              #{{ idx + 1 }} {{ idx === 0 ? '· (Sommet)' : idx === myDeckCards.length - 1 ? '· (Fond)' : '' }}
            </div>
            <GameCard
              :instance="inst"
              :card="resolveCard(inst.instanceId) || resolveCard(inst.cardId)"
              @select="zoomInst(inst.instanceId)"
              @zoom="zoomInst(inst.instanceId)"
            />
            <div class="gpilebrowser__actions">
              <button
                class="gbtn gbtn--sm"
                :data-testid="`deck-take-main-${inst.instanceId}`"
                title="Prendre cette carte en main"
                @click="takeFromDeck(inst.instanceId, 'main')"
              >
                → Main
              </button>
              <button
                class="gbtn gbtn--sm"
                title="Mettre cette carte en jeu dans le Monde"
                @click="takeFromDeck(inst.instanceId, 'monde')"
              >
                → Monde
              </button>
              <button
                class="gbtn gbtn--sm"
                title="Mettre cette carte dans ton Havre-Sac"
                @click="takeFromDeck(inst.instanceId, 'havreSac')"
              >
                → Socle
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>

    <!-- ════ F4 — Créer un jeton de créature ════ -->
    <div
      v-if="tokenDialog"
      class="gpilebrowser"
      data-testid="token-dialog"
      role="dialog"
      aria-modal="true"
      aria-label="Créer un jeton de créature"
      tabindex="-1"
      @click.self="tokenDialog = false"
      @keydown.esc.prevent="tokenDialog = false"
    >
      <div class="gpilebrowser__panel gtokendialog">
        <header class="gpilebrowser__head">
          <h2 class="gpilebrowser__title">Créer un jeton</h2>
          <button
            class="gbtn gbtn--ghost"
            aria-label="Fermer"
            @click="tokenDialog = false"
          >
            ✕
          </button>
        </header>
        <p class="gpilebrowser__hint">
          Pour les effets « Mettez en jeu un jeton "Monstre - X" de Force N
          [Élément] ». Le jeton apparaît dans le Monde, avec le mal
          d'invocation.
        </p>
        <form class="gtokendialog__form" @submit.prevent="submitToken">
          <label class="gtokendialog__field">
            <span>Nom</span>
            <input
              v-model="tokenName"
              data-testid="token-name"
              placeholder="Monstre - Arakne"
              maxlength="60"
              required
            />
          </label>
          <label class="gtokendialog__field">
            <span>Force</span>
            <input
              v-model.number="tokenForce"
              type="number"
              min="0"
              max="99"
              required
            />
          </label>
          <label class="gtokendialog__field">
            <span>Élément</span>
            <select v-model="tokenElement">
              <option value="">Neutre</option>
              <option value="Air">Air</option>
              <option value="Eau">Eau</option>
              <option value="Feu">Feu</option>
              <option value="Terre">Terre</option>
            </select>
          </label>
          <button
            class="gbtn gbtn--accent"
            type="submit"
            data-testid="token-create"
          >
            Mettre en jeu
          </button>
        </form>
      </div>
    </div>

    <CardZoomModal
      :card="zoomCard"
      :open="zoomOpen"
      @close="zoomOpen = false"
    />


  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import type { ComponentPublicInstance } from "vue";
import { useCardStore } from "@/stores/cardStore";
import { useGameStore } from "@/stores/gameStore";
import type { Card } from "@/types/cards";
import type {
  CardCounters,
  Position,
  RedactedInstance,
  RedactedZone,
  Seat,
  ZoneRef,
} from "@/game";
import GameCard from "./GameCard.vue";
import AttachedEquip from "./AttachedEquip.vue";
import HandFan from "./HandFan.vue";
import type { HandItem } from "./HandFan.vue";
import SeatHud from "./SeatHud.vue";
import PileStack from "./PileStack.vue";
import CombatTray from "./CombatTray.vue";
import CardZoomModal from "@/components/card/CardZoomModal.vue";

import { recetteOf } from "@/game/rules";
import { chifumiActingSeat } from "@/game/ai/botPolicy";
import { getThumbPath } from "@/utils/imagePaths";
import { elementColor } from "@/config/elementColors";
import { useBoardDnd } from "@/composables/useBoardDnd";
import { useAccessibility } from "@/composables/useAccessibility";

const store = useGameStore();
const cardStore = useCardStore();
const dnd = useBoardDnd();
const { announce } = useAccessibility();
// Barre d'actions : réf. pour piloter le focus au clavier.
const actionbarRef = ref<HTMLElement | null>(null);
let lastSelectedTrigger: HTMLElement | null = null;

const me = computed(() => store.perspective);
const opp = computed(() => store.opponent);

const cardIndex = computed(() => {
  const m = new Map<string, Card>();
  for (const c of cardStore.cards) {
    if (!c) continue;
    m.set(c.id, c);
    m.set(String(c.id), c);
    if ((c as any).code) m.set(String((c as any).code), c);
  }
  return m;
});
function resolveCard(cardId: string | null): Card | null {
  if (!cardId) return null;
  const fromInstance = store.resolveInstanceCard(cardId);
  if (fromInstance) return fromInstance;
  const s = String(cardId);
  return cardIndex.value.get(s) ?? cardIndex.value.get(cardId) ?? cardStore.cards.find((c) => String(c.id) === s || String((c as any).code) === s) ?? null;
}

onMounted(() => {
  if (!cardStore.cards.length) {
    void cardStore.initialize().catch(() => {});
  }

});

const view = computed(() => store.view);






function instancesOf(z: RedactedZone | null): RedactedInstance[] {
  return z && z.kind === "full" ? z.instances : [];
}
function mondeOwned(seat: Seat): RedactedInstance[] {
  return instancesOf(view.value.monde).filter((i) => i.owner === seat);
}
function havreId(seat: Seat): string | undefined {
  return view.value.seats[seat].havreSacInstanceId;
}
/** La carte Havre-Sac elle-même (vit dans le Monde, c'est le « socle » du joueur). */
function havreCard(seat: Seat): RedactedInstance[] {
  return mondeOwned(seat).filter((i) => i.instanceId === havreId(seat));
}
/** L'intérieur du Havre-Sac : Héros, Salles, Équipements… (zone `havreSac`). */
function interiorCards(seat: Seat): RedactedInstance[] {
  return instancesOf(view.value.seats[seat].havreSac);
}
/** Taille (capacité) du Havre-Sac = nombre d'emplacements intérieurs (2315). */
function havreTaille(seat: Seat): number {
  const inst = havreCard(seat)[0];
  const taille = resolveCard(inst?.cardId ?? null)?.stats?.taille;
  return typeof taille === "number" && taille > 0 ? taille : 4;
}
/** Une seule case « libre » visible (cible de dépôt) tant qu'il reste de la
 * place : la capacité totale est rappelée par le compteur du label, sinon
 * l'intérieur monopolise la largeur au détriment de la main. */
function emptyInteriorSlots(seat: Seat): number {
  return Math.min(
    1,
    Math.max(0, havreTaille(seat) - interiorCards(seat).length),
  );
}
function allies(seat: Seat): RedactedInstance[] {
  return mondeOwned(seat).filter((i) => i.instanceId !== havreId(seat));
}
const queue = computed(() => instancesOf(view.value.fileAttente));

function handList(seat: Seat): HandItem[] {
  const z = view.value.seats[seat].main;
  if (z.kind === "full")
    return z.instances.map((i) => ({
      key: i.instanceId,
      inst: i,
      // affordance MTGA : ma main uniquement (l'adverse est masquée) → jouable si
      // aucune raison de refus (coût, phase, tour, 1er tour…).
      playable:
        seat === store.perspective
          ? store.cannotPlayReason(i.instanceId) === null
          : undefined,
    }));
  return Array.from({ length: z.count }, (_, i) => ({
    key: `back-${seat}-${i}`,
    inst: null,
  }));
}
function piocheCount(seat: Seat): number {
  const z = view.value.seats[seat].pioche;
  return z.kind === "count" ? z.count : z.instances.length;
}
/**
 * Clic sur MA Pioche. En RÈGLES ASSISTÉES, la pioche est AUTOMATIQUE (fin de
 * tour : la main est complétée jusqu'aux PA — cf. endTurn ; les effets
 * « Piochez … » se résolvent seuls) — cliquer la pile ne doit PAS piocher en
 * douce (façon MTGA : la bibliothèque n'est pas cliquable) ; on explique via
 * l'assistant de règles. Le clic-pioche reste l'affordance du mode MANUEL
 * (assist désactivé, table libre).
 */
function onPiocheClick(): void {
  if (store.assist) {
    store.ruleError =
      "La pioche est automatique : en finissant ton tour, ta main est complétée jusqu'à tes PA (et les effets « Piochez … » se résolvent seuls).";
    return;
  }
  store.ruleError =
    "Pour piocher une carte en mode manuel, utilisez le bouton « Piocher ».";
}
function discardCount(seat: Seat): number {
  return instancesOf(view.value.seats[seat].defausse).length;
}
function topDiscard(seat: Seat): RedactedInstance | null {
  return instancesOf(view.value.seats[seat].defausse)[0] ?? null;
}
function exileCount(seat: Seat): number {
  return instancesOf(view.value.seats[seat].exil).length;
}
function topExile(seat: Seat): RedactedInstance | null {
  return instancesOf(view.value.seats[seat].exil)[0] ?? null;
}
// ── Consultation d'une pile publique (Défausse / Exil) ─────────────────────
const pileBrowse = ref<{ seat: Seat; zone?: "defausse" | "exil" } | null>(null);
const browsedPile = computed<RedactedInstance[]>(() => {
  if (!pileBrowse.value) return [];
  const z = pileBrowse.value.zone ?? "defausse";
  return instancesOf(view.value.seats[pileBrowse.value.seat][z]);
});
/**
 * RÉCUPÉRATION depuis MA Défausse (effets « Récupérez… ») : déplace la carte
 * vers la main / le jeu / le dessus de la Pioche. La légalité (tour, 506.3,
 * Taille…) est portée par moveTo → MOVE_CARD (serveur en ligne) ; un refus
 * revient en toast. Le browser reste ouvert (récupérations multiples).
 */
function recoverFromPile(
  instanceId: string,
  zone: "main" | "monde" | "havreSac" | "pioche" | "exil",
): void {
  const ref =
    zone === "monde"
      ? ({ zone } as const)
      : ({ zone, owner: me.value } as const);
  store.moveTo(
    instanceId,
    ref,
    zone === "pioche" ? { at: "top" } : { at: "any" },
  );
}
// ── F2 — Recherche dans MA Pioche (tuteur « Cherchez… ») ────────────────────
const deckBrowse = ref(false);
/** Instances de MA Pioche (identités révélées à MOI par le LOOK de
 *  searchMyDeck ; l'ordre affiché n'est PAS l'ordre réel — sans importance,
 *  la fermeture mélange). */
const myDeckCards = computed<RedactedInstance[]>(() =>
  deckBrowse.value
    ? store.state.seats[me.value].pioche.map((id) => {
        const inst = store.state.instances[id];
        return {
          instanceId: id,
          cardId: inst?.cardId ?? null,
          owner: me.value,
          controller: me.value,
          face: "recto",
          orientation: null,
          counters: inst?.counters ?? {},
          attachments: [],
        } as RedactedInstance;
      })
    : [],
);
function openDeckSearch(): void {
  if (store.searchMyDeck()) deckBrowse.value = true;
}
function closeDeckSearch(): void {
  deckBrowse.value = false;
  store.shuffleMyDeck(); // 507.4 — l'ordre a été vu → mélange obligatoire
}
function takeFromDeck(
  instanceId: string,
  zone: "main" | "monde" | "havreSac",
): void {
  const ref =
    zone === "monde"
      ? ({ zone } as const)
      : ({ zone, owner: me.value } as const);
  store.moveTo(instanceId, ref, { at: "any" });
}

// ── F4 — Créer un jeton de créature (effet joué à la main) ──────────────────
const tokenDialog = ref(false);
const tokenName = ref("");
const tokenForce = ref(1);
const tokenElement = ref("");
function submitToken(): void {
  const ok = store.createManualToken({
    name: tokenName.value,
    force: tokenForce.value,
    ...(tokenElement.value ? { element: tokenElement.value } : {}),
  });
  if (ok) {
    tokenDialog.value = false;
    tokenName.value = "";
    tokenForce.value = 1;
    tokenElement.value = "";
  }
}

function openPileBrowser(seat: Seat, zone: "defausse" | "exil" = "defausse"): void {
  pileBrowse.value = { seat, zone };
  // Focus sur le dialogue → Échap fonctionne immédiatement.
  nextTick(() => {
    (
      document.querySelector("[data-testid=pile-browser]") as HTMLElement | null
    )?.focus?.();
  });
}
function reserveCount(seat: Seat): number {
  const z = view.value.seats[seat].reserve;
  return !z ? 0 : z.kind === "count" ? z.count : z.instances.length;
}

// ── Glisser-déposer (pointer, façon MTGA) ────────────────────────────────────
function registerZone(
  id: string,
  el: Element | ComponentPublicInstance | null,
  zone: ZoneRef,
  label: string,
  position?: Position,
): void {
  dnd.registerZone(id, el as HTMLElement | null, { zone, position, label });
}
function zoneCls(id: string): Record<string, boolean> {
  return {
    gdrop: true,
    "gdrop--on": dnd.isDragging.value,
    "gdrop--over": dnd.hoveredZoneId.value === id,
  };
}
onMounted(() => {
  dnd.setDropHandler((instanceId, spec) => {
    // EN LIGNE pendant un COMBAT : tryIntent refuse les MOVE/PLAY (combat en
    // cours), et le drop retomberait sur une mutation LOCALE non soumise au
    // serveur → désync. On refuse explicitement (le combat se joue via le HUD).
    if (store.online && store.combat) {
      store.ruleError = "Termine le combat avant de déplacer une carte.";
      return;
    }
    // règles assistées : un drop main → table passe par le moteur de règles
    // (légalité + inclinaison automatique des Ressources)
    const inst = store.state.instances[instanceId];
    const toPlay = spec.zone.zone === "monde" || spec.zone.zone === "havreSac";
    if (
      store.assist &&
      toPlay &&
      inst?.location.zone === "main" &&
      inst.owner === me.value
    ) {
      // 303.1 — la zone de drop porte le choix de destination du contrôleur :
      // déposer un Allié sur SON Havre-Sac l'y fait apparaître (façon MTGA).
      const dest: "monde" | "havreSac" =
        spec.zone.zone === "havreSac" && spec.zone.owner === me.value
          ? "havreSac"
          : "monde";
      store.playFromHand(instanceId, undefined, dest);
      return;
    }
    store.moveTo(instanceId, spec.zone, spec.position ?? { at: "any" });
  });
});
onUnmounted(() => {
  dnd.setDropHandler(null);
  dnd.resetZones();
});

// ── Refus de coup ────────────────────────────────────────────────────────────
// L'affichage VISUEL du refus appartient au coach (RuleAssistant — bandeau
// haut avec la règle dépliable ; il capture store.ruleError AVANT le clear,
// via son propre watch) : plus de toast générique en bas-droite, qui faisait
// DOUBLON et recouvrait la main (pile orange sur refus répétés). On garde
// l'annonce assertive pour les lecteurs d'écran, puis on consomme l'erreur.
watch(
  () => store.ruleError,
  (msg) => {
    if (msg) {
      announce(msg, { politeness: "assertive" });
      store.clearRuleError();
    }
  },
);

// ── Sélection / actions ──────────────────────────────────────────────────────
const selectedId = ref<string | null>(null);
// changement de joueur (passation) → on referme la barre d'action
watch(
  () => store.perspective,
  () => {
    selectedId.value = null;
    store.cancelBearerTargeting(); // un ciblage de Porteur ne survit pas à la passation
  },
);
const selectedInst = computed(() =>
  selectedId.value ? (store.state.instances[selectedId.value] ?? null) : null,
);
const selectedName = computed(() => {
  const inst = selectedInst.value;
  if (!inst) return "";
  return resolveCard(inst.cardId)?.name ?? "Carte face cachée";
});
// Mouvement du Héros (414.1 / 508.x) : le bouton n'apparaît que si la carte
// sélectionnée EST le Héros du joueur affiché. `heroMove.reason` (null = OK)
// désactive le bouton hors Phase Principale / au 1er tour, avec l'explication.
const heroMove = computed(() => store.heroMoveOption);
const selectedIsMyHero = computed(
  () =>
    !!selectedInst.value &&
    !!heroMove.value &&
    selectedInst.value.instanceId === heroMove.value.heroInstanceId,
);

function moveHeroSelected(): void {
  const opt = heroMove.value;
  if (!opt) return;
  store.moveHero(me.value, opt.to); // rejette avec le motif si illégal
  selectedId.value = null; // la zone du Héros a changé → referme la barre
}
// Mouvement d'un ALLIÉ sélectionné (414.1) — exclut le Héros (qui a son propre
// bouton ci-dessus). `creatureMoveOption` renvoie null si ce n'est pas une
// créature contrôlée en jeu ; `reason` (null = OK) désactive avec l'explication.
const allyMove = computed(() => {
  const inst = selectedInst.value;
  if (!inst) return null;
  if (heroMove.value && inst.instanceId === heroMove.value.heroInstanceId)
    return null;
  return store.creatureMoveOption(inst.instanceId);
});
function moveCreatureSelected(): void {
  const inst = selectedInst.value;
  const opt = inst ? store.creatureMoveOption(inst.instanceId) : null;
  if (!inst || !opt) return;
  store.moveCreature(inst.instanceId, opt.to); // rejette avec le motif si illégal
  selectedId.value = null; // la zone a changé → referme la barre
}
/**
 * Libellé du bandeau de CIBLAGE D'EFFET — un libellé DÉDIÉ par op (le vieux
 * ternaire repliait tout op inconnu sur « subit N Dommages », affichant un
 * effet FAUX : Amal Odoua « le Héros regagne 3 PV » annonçait des dégâts).
 * Repli désormais NEUTRE : ne jamais mentir sur un effet.
 */
function targetingLabel(
  op: NonNullable<(typeof store)["effectTargeting"]>["op"],
  multi: NonNullable<(typeof store)["effectTargeting"]>["multi"],
): string {
  switch (op.op) {
    case "destroyTarget":
      return op.whatAny
        ? "choisis la cible à détruire"
        : `choisis ${
            op.what === "Allié"
              ? "l'Allié"
              : op.what === "Zone"
                ? "la Zone"
                : "l'Équipement"
          } à détruire`;
    case "banishTarget":
      return "choisis la cible à bannir (retirée de la partie)";
    case "damageTarget":
      return `choisis ${op.heroes ? "l'Allié ou Héros" : "l'Allié"} qui subit ${op.n} Dommage(s)`;
    case "healHeroTarget":
      return `choisis le Héros qui regagne ${op.n} PV`;
    case "buffForceTarget":
      return `choisis la cible qui gagne +${op.n} en Force${op.alsoKeyword ? ` et ${op.alsoKeyword}` : ""} jusqu'à la fin du tour`;
    case "buffForceMultiTarget":
      return `choisis une cible qui gagne +${op.n} en Force${op.alsoKeyword ? ` et ${op.alsoKeyword}` : ""} (jusqu'à ${multi?.remaining ?? 0} restante(s)) — « Passer » pour arrêter`;
    case "tapTarget":
      return "choisis la cible à incliner";
    case "untapTarget":
      return "choisis la cible à redresser";
    case "returnToHand":
      return "choisis la cible à renvoyer en main";
    case "removeFromCombatTarget":
      return "choisis l'attaquant ou bloqueur à retirer du combat";
    case "costTapControlled":
      return "coût : choisis une de tes créatures à incliner";
    case "costTapResource":
      return "coût : choisis une carte à incliner pour produire une Ressource";
    case "costDestroyControlled":
      return "coût : choisis une de tes créatures à détruire";
    case "costRecycleControlled":
      return "coût : choisis une de tes créatures à recycler";
    case "damageTargetByForce":
      return "choisis la cible qui subit la Force en Dommages";
    case "playerDraw":
    case "playerLoseStatTurn":
    case "playerGainStat":
      return "choisis le Héros du joueur concerné";
    case "grantKeywordTarget":
      return `choisis la cible qui gagne ${op.keyword}`;
    case "grantResistanceTarget":
      return "choisis la cible qui gagne de la Résistance";
    case "damageMultiTarget":
      return `choisis une cible qui subit ${op.n} Dommage(s) (jusqu'à ${multi?.remaining ?? 0} restante(s)) — « Passer » pour arrêter`;
    case "tapMultiTarget":
      return `choisis une créature à incliner (${multi?.remaining ?? 0} restante(s)) — « Passer » pour arrêter`;
    case "untapMultiTarget":
      return `choisis une créature à redresser (${multi?.remaining ?? 0} restante(s)) — « Passer » pour arrêter`;
    case "drawTargetXp":
      return "choisis l'Allié dont tu piocheras la valeur d'XP";
    case "costPayX":
      return `incline une carte pour payer (${multi?.chosen?.length ?? 0} Ressource(s) payée(s)) — « Passer » pour arrêter`;
    case "distributeDamage":
      return `répartis les Dommages (${multi?.remaining ?? 0} point(s) restant(s)) — clique une cible par point`;
    case "duelTapDuelist":
      return "choisis l'un de tes Alliés ou Héros dressés à incliner (le duelliste)";
    case "duelChooseChallenged":
      return "choisis l'Allié ou Héros adverse à défier en duel";
    default:
      // Repli NEUTRE : jamais un effet inventé (cf. bug Amal Odoua).
      return "choisis la cible de l'effet";
  }
}
function select(instanceId: string): void {
  // ciblage combat (Attaquant / Bloquant) en cours : le clic désigne la cible et lance l'animation
  if (pendingCombatTarget.value) {
    const targetId = instanceId;
    const { sourceId, role } = pendingCombatTarget.value;
    pendingCombatTarget.value = null;

    launchCombatProjectile(sourceId, targetId, role, () => {
      if (typeof store.setCardCombatState === "function") {
        store.setCardCombatState(sourceId, role);
      }
      if (role === "attacking") {
        if (!store.combat && store.canDeclareAttack && store.eligibleAttackerIds.includes(sourceId)) {
          store.beginCombat(sourceId);
          if (store.combatTargetIds.includes(targetId)) {
            store.combatChooseTarget(targetId);
          }
        } else if (store.combat && store.combat.step === "attackers") {
          if (store.combatTargetIds.includes(targetId)) {
            store.combatChooseTarget(targetId);
          }
        }
      } else if (role === "blocking" && store.combat && store.combat.step === "blockers") {
        if (store.combat.pendingBlocker && store.combat.attackers.includes(targetId)) {
          store.combatChooseBlockTarget(targetId);
        } else {
          store.combatToggleBlock(sourceId);
        }
      }
    });
    return;
  }
  // PAIEMENT au choix (coût de lancement) : le clic désigne un producteur à
  // incliner (re-clic = désélection) ; « Auto » / « Annuler » au bandeau.
  if (store.pendingPayment) {
    store.payPick(instanceId);
    return;
  }
  // ciblage de Porteur en cours (305.x) : le clic désigne la créature qui
  // portera l'équipement / la Monture en attente de jeu.
  if (store.pendingBearer) {
    store.attachToBearer(instanceId);
    return;
  }
  // effet à cible en cours : le clic désigne la cible
  if (store.effectTargeting) {
    store.effectTargetChoose(instanceId);
    return;
  }
  // combat en cours : les clics désignent attaquants / cible / bloqueurs / riposte
  if (store.combat) {
    if (store.combat.step === "attackers") {
      if (store.combatTargetIds.includes(instanceId))
        store.combatChooseTarget(instanceId);
      else store.combatToggleAttacker(instanceId);
    } else if (store.combat.step === "strikes") {
      store.combatChooseStrike(instanceId);
    } else if (store.combat.step === "geant") {
      // 6135 — clic sur un bloqueur (ou la Cible) = +1 Dommage (façon MTGA) ;
      // le réglage fin (−) se fait dans le bandeau de répartition.
      store.combatGeantAdjust(instanceId, +1);
    } else if (store.combat.step === "riposte") {
      store.combatChooseRiposte(instanceId);
    } else {
      // blockers : un Équipement à pouvoir CONDITIONNÉ au combat (Dora) reste
      // SÉLECTIONNABLE pendant la fenêtre (l'action-bar propose l'activation) —
      // sans quoi tous les clics plateau seraient consommés par le blocage.
      if (store.tapPowerNeedsCombat(instanceId)) {
        selectedId.value = selectedId.value === instanceId ? null : instanceId;
        return;
      }
      // si un bloqueur attend, le clic sur un attaquant l'assigne
      if (
        store.combat.pendingBlocker &&
        store.combat.attackers.includes(instanceId)
      )
        store.combatChooseBlockTarget(instanceId);
      else store.combatToggleBlock(instanceId);
    }
    return;
  }
  selectedId.value = selectedId.value === instanceId ? null : instanceId;
}

// A11y clavier : le glisser-déposer souris reste dispo, mais n'est plus la
// SEULE façon de jouer. À la sélection (Entrée/Espace sur la carte, qui est un
// <button>), on annonce et on déplace le focus vers la barre d'actions ;
// au déselect on rend le focus à la carte d'origine.
watch(selectedId, async (id) => {
  if (id) {
    lastSelectedTrigger =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    announce(`${selectedName.value} sélectionnée. Barre d'actions disponible.`);
    await nextTick();
    actionbarRef.value?.querySelector<HTMLElement>(".gbtn")?.focus();
  } else if (lastSelectedTrigger?.isConnected) {
    lastSelectedTrigger.focus();
    lastSelectedTrigger = null;
  }
});

// A11y combat : à l'OUVERTURE du combat, déplacer le focus sur le bandeau (sinon
// il retombe sur <body> quand la barre d'action démonte) + annonce. Le bandeau
// gère @keydown.esc → combatCancel. À la fermeture, le focus suit le plateau.
const combatBar = ref<HTMLElement | null>(null);
watch(
  () => !!store.combat,
  async (on) => {
    if (!on) return;
    await nextTick();
    combatBar.value?.focus();
    announce(
      "Combat. Utilise le bandeau pour déclarer, bloquer ou résoudre ; Échap pour annuler.",
    );
  },
);

watch(selectedId, (newId) => {
  store.setTargetedCard(newId);
});

// ── Combat assisté : surbrillances + bouton Attaquer ────────────────────────
function slotCls(instanceId: string): Record<string, boolean> {
  const inst = store.state.instances[instanceId];
  const isSelected = selectedId.value === instanceId;
  const isAdverse = inst?.controller !== me.value;
  const isTargetedByOpponent = store.opponentTargetedCardId === instanceId;
  const isTargeted = (isSelected && isAdverse) || isTargetedByOpponent;

  if (pendingCombatTarget.value) {
    const isSource = pendingCombatTarget.value.sourceId === instanceId;
    const isEligibleTarget =
      !isSource &&
      (inst?.location.zone === "monde" || inst?.location.zone === "havreSac");
    return {
      "gslot--atk": isSource,
      "gslot--target-can": isEligibleTarget,
      "gslot--targeted-strong": isTargeted,
    };
  }
  if (store.pendingPayment) {
    return {
      "gslot--target-can":
        store.pendingPayment.eligible.includes(instanceId) &&
        !store.pendingPayment.chosen.includes(instanceId),
      "gslot--atk": store.pendingPayment.chosen.includes(instanceId),
      "gslot--targeted-strong": isTargeted,
    };
  }
  if (store.effectTargeting) {
    return {
      "gslot--target-can": store.effectTargetIdsList.includes(instanceId),
      "gslot--targeted-strong": isTargeted,
    };
  }
  if (store.pendingBearer) {
    return {
      "gslot--target-can": store.pendingBearer.eligible.includes(instanceId),
      "gslot--targeted-strong": isTargeted,
    };
  }
  const c = store.combat;
  if (!c) {
    return {
      "gslot--targeted-strong": isTargeted,
    };
  }
  return {
    "gslot--atk-can":
      c.step === "attackers" && store.combatAttackerIds.includes(instanceId),
    "gslot--atk":
      c.attackers.includes(instanceId) ||
      (c.step === "strikes" && c.strikeFor === instanceId) ||
      (c.step === "riposte" && c.riposteFrom === instanceId),
    "gslot--target-can":
      (c.step === "attackers" && store.combatTargetIds.includes(instanceId)) ||
      (c.step === "strikes" && store.combatStrikeIds.includes(instanceId)) ||
      (c.step === "geant" && store.combatGeantIds.includes(instanceId)) ||
      (c.step === "riposte" && store.combatRiposteIds.includes(instanceId)) ||
      (c.step === "blockers" &&
        !!c.pendingBlocker &&
        c.attackers.includes(instanceId)),
    "gslot--target": c.target?.instanceId === instanceId,
    "gslot--blk-can":
      c.step === "blockers" && store.combatBlockerIds.includes(instanceId),
    "gslot--blk":
      (c.step === "blockers" && !!c.blocks[instanceId]) ||
      c.pendingBlocker === instanceId,
    "gslot--lethal": store.combatPreview?.lethal.includes(instanceId) ?? false,
    "gslot--targeted-strong": isTargeted,
  };
}
/** PV/Résistance projetés d'une cible (Héros/Havre-Sac) après résolution, ou null. */
function previewHpAfter(instanceId: string): number | null {
  const hp = store.combatPreview?.hpAfter[instanceId];
  return hp === undefined ? null : Math.max(0, hp);
}
/** Libellé de la jauge ciblée : « PV » (Héros/Allié) ou « Rés. » (Havre-Sac, 306.3). */
function targetVitalLabel(): string {
  return store.combat?.target?.kind === "havreSac" ? "Rés." : "PV";
}
/** Nom lisible d'une instance du plateau (bandeau Géant, a11y). */
function cardNameOf(instanceId: string): string {
  const inst = store.state.instances[instanceId];
  return resolveCard(inst?.cardId ?? null)?.name ?? "Carte";
}
/** 6135 — part de Dommages actuellement assignée à `id` par le Géant courant. */
function geantShare(id: string): number {
  const c = store.combat;
  if (!c?.geantFor) return 0;
  return c.geantAssign[c.geantFor]?.[id] ?? 0;
}
/** 6135 — Dommages du Géant courant restant à répartir. */
const geantRemaining = computed(() => {
  const c = store.combat;
  if (!c?.geantFor) return 0;
  const sum = Object.values(c.geantAssign[c.geantFor] ?? {}).reduce(
    (s, n) => s + n,
    0,
  );
  return (store.effectiveForceOf(c.geantFor)?.value ?? 0) - sum;
});
/** Noms des cartes qui seront détruites si le combat est résolu (pour l'a11y). */
function lethalCardNames(): string[] {
  const ids = store.combatPreview?.lethal ?? [];
  return ids.map((id) => {
    const inst = store.state.instances[id];
    return resolveCard(inst?.cardId ?? null)?.name ?? "carte";
  });
}
const canAttackSelected = computed(() => {
  const inst = selectedInst.value;
  // N'offrir « Attaquer » que si la carte est un attaquant LÉGAL (redressé, hors
  // mal d'invocation, type combattant) ET qu'une attaque est déclarable ce tour
  // (1/tour, pas au premier tour) — sinon le bouton ouvrait un combat vide + erreur.
  // CADRE : le combat automatisé fait partie du socle de TOUTE partie en ligne
  // (la résolution est serveur) — plus seulement du mode assisté local.
  return (
    (store.assist || store.online) &&
    !store.combat &&
    !!inst &&
    store.canDeclareAttack &&
    store.eligibleAttackerIds.includes(inst.instanceId)
  );
});
function attackWithSelected(): void {
  const id = selectedInst.value?.instanceId;
  selectedId.value = null;
  if (id) store.beginCombat(id);
}
// CHI-FU-MI vs BOT : c'est au bot d'agir dans le mini-jeu → boutons masqués
// (le driver useBotOpponent joue pour lui au prochain tick).
const chifumiBotActing = computed(
  () => !!store.botSeat && chifumiActingSeat(store) === store.botSeat,
);
const canActivateSelected = computed(() => {
  const inst = selectedInst.value;
  // CADRE : les pouvoirs (onTap) restent activables en ligne — activateTapPower
  // gère déjà les relâchements table libre (hors-tour, coût manuel).
  if ((!store.assist && !store.online) || store.effectTargeting || !inst)
    return false;
  if (inst.controller !== me.value) return false;
  // POUVOIR DEPUIS LA MAIN (Polter Tofu) : carte en main portant un pouvoir
  // activable depuis la main — orientation non pertinente ; la légalité de timing
  // (tour / réaction) est jugée par activateTapPower (refus expliqué en toast).
  if (inst.location.zone === "main") return store.hasHandPower(inst.instanceId);
  return (
    // EN COMBAT, seuls les pouvoirs CONDITIONNÉS au combat (Dora : « … que si le
    // Porteur est attaquant ou bloqueur ») restent proposés — la légalité fine
    // (tour / fenêtre de réaction / rôle du Porteur) est jugée par
    // activateTapPower, refus expliqué en toast.
    (!store.combat || store.tapPowerNeedsCombat(inst.instanceId)) &&
    inst.orientation === "upright" &&
    (inst.location.zone === "monde" || inst.location.zone === "havreSac") &&
    store.hasTapPower(inst.instanceId)
  );
});
function activateSelected(): void {
  const id = selectedInst.value?.instanceId;
  selectedId.value = null;
  if (id) store.activateTapPower(id);
}
function moveSelected(
  zone: "monde" | "havreSac" | "main" | "defausse" | "pioche" | "exil",
  position: Position = { at: "any" },
): void {
  const inst = selectedInst.value;
  if (!inst) return;
  // Jouer depuis la main (clavier/clic) : même chemin que le glisser-déposer,
  // via playFromHand (légalité + coût + inclinaison des Ressources), et non un
  // moveTo brut qui contournerait les règles. Les autres déplacements
  // (Monde→Main, Défausser, Pioche, ou une source hors main) restent en moveTo.
  const toPlay = zone === "monde" || zone === "havreSac";
  if (
    store.assist &&
    toPlay &&
    inst.location.zone === "main" &&
    inst.owner === me.value
  ) {
    // 303.1 — le bouton visé (« → Monde » / « → Socle ») porte le choix de
    // zone d'arrivée du contrôleur (un Allié peut apparaître dans les deux).
    store.playFromHand(inst.instanceId, undefined, zone);
    selectedId.value = null;
    return;
  }
  const ref =
    zone === "monde" ? { zone } : ({ zone, owner: inst.owner } as const);
  store.moveTo(inst.instanceId, ref, position);
  selectedId.value = null;
}
function tapSelected(): void {
  if (selectedInst.value) store.toggleTap(selectedInst.value.instanceId);
  selectedId.value = null;
}
function tapAllOnBoard(): void {
  if (typeof store.tapAllOnBoard === "function") {
    store.tapAllOnBoard();
  }
}
function untapAllOnBoard(): void {
  if (typeof store.untapAllOnBoard === "function") {
    store.untapAllOnBoard();
  }
}
const showMoreMenu = ref(false);
function runMoreAction(fn: () => void): void {
  showMoreMenu.value = false;
  fn();
}
function millOne(): void {
  store.millTopDeck(me.value);
}
function onDocClick(): void {
  showMoreMenu.value = false;
}
onMounted(() => window.addEventListener("click", onDocClick));
onUnmounted(() => window.removeEventListener("click", onDocClick));
function tapStackSelected(): void {
  const id = selectedInst.value?.instanceId;
  if (id && typeof store.tapStack === "function") {
    store.tapStack(id);
  }
  selectedId.value = null;
}
function untapStackSelected(): void {
  const id = selectedInst.value?.instanceId;
  if (id && typeof store.untapStack === "function") {
    store.untapStack(id);
  }
  selectedId.value = null;
}
interface PendingCombatTarget {
  sourceId: string;
  role: "attacking" | "blocking";
}
const pendingCombatTarget = ref<PendingCombatTarget | null>(null);

interface FlyingProjectile {
  id: number;
  icon: string;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  angle: number;
}
const activeProjectiles = ref<FlyingProjectile[]>([]);
let projectileIdCounter = 0;

function launchCombatProjectile(
  sourceId: string,
  targetId: string,
  role: "attacking" | "blocking",
  onComplete?: () => void,
): void {
  const sourceEl =
    document.querySelector(`[data-instance-id="${sourceId}"]`) ??
    document.querySelector(`[data-id="${sourceId}"]`);
  const targetEl =
    document.querySelector(`[data-instance-id="${targetId}"]`) ??
    document.querySelector(`[data-id="${targetId}"]`);

  const icon = role === "attacking" ? "⚔️" : "🛡️";

  let startX = window.innerWidth / 2;
  let startY = window.innerHeight / 2;
  let endX = window.innerWidth / 2;
  let endY = window.innerHeight / 3;

  if (sourceEl) {
    const rect = sourceEl.getBoundingClientRect();
    startX = rect.left + rect.width / 2;
    startY = rect.top + rect.height / 2;
  }
  if (targetEl) {
    const rect = targetEl.getBoundingClientRect();
    endX = rect.left + rect.width / 2;
    endY = rect.top + rect.height / 2;
  }

  const dx = endX - startX;
  const dy = endY - startY;
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI;

  const proj: FlyingProjectile = {
    id: ++projectileIdCounter,
    icon,
    startX,
    startY,
    endX,
    endY,
    angle,
  };

  activeProjectiles.value.push(proj);

  setTimeout(() => {
    activeProjectiles.value = activeProjectiles.value.filter((p) => p.id !== proj.id);
    if (onComplete) onComplete();
  }, 650);
}



// TL3 — ÉQUIPER (table libre) : bouton pour attacher À LA MAIN un Équipement
// sélectionné (de ma main ou déjà posé) sur un Porteur, via le ciblage
// pendingBearer → intent ATTACH. Le jeu assisté attache déjà à la pose ; ce
// geste comble le mode manuel (online non assisté), où jouer un Équipement le
// laissait posé sans Porteur.
const canEquipSelected = computed(() => {
  const inst = selectedInst.value;
  if (store.combat || !inst) return false;
  if (inst.controller !== me.value) return false;
  const card = resolveCard(inst.cardId);
  return !!card;
});
function equipSelected(): void {
  const id = selectedInst.value?.instanceId;
  if (!id) return;
  if (store.attachSelected(id)) selectedId.value = null; // le plateau prend le relais (clic Porteur)
}
// F5 — montrer UNE carte de ma main (« révélez une carte ») : en ligne
// uniquement (en local hot-seat tout est déjà visible).
const canShowSelected = computed(() => {
  const inst = selectedInst.value;
  return (
    store.online &&
    !!inst &&
    inst.owner === me.value &&
    inst.location.zone === "main"
  );
});
function showSelectedCard(): void {
  const id = selectedInst.value?.instanceId;
  if (id) store.revealCardToOpponent(id);
  selectedId.value = null;
}
// TL5 — MONTRER SA MAIN (Filouterie / geste manuel) : révèle toute ma main à
// l'adversaire. Réservé au jeu en ligne (en local hot-seat, tout est déjà
// visible). Bouton global (indépendant de la carte sélectionnée).
const canRevealHand = computed(
  () => store.online && handList(me.value).length > 0,
);
function revealHandToOpponent(): void {
  store.revealMyHand();
}

function drawOne(): void {
  store.draw(me.value);
}
// A19 — FABRICATION : Recette de la carte de MA main sélectionnée (null si la
// carte n'en porte pas ou n'est pas dans ma main) + raison d'illégalité
// éventuelle (whyCannotCraft — Artisan du Métier dressé, Défausse typée…).
const selectedCraft = computed(() => {
  const inst = selectedInst.value;
  if (!inst || inst.location.zone !== "main" || inst.controller !== me.value)
    return null;
  const recette = recetteOf(resolveCard(inst.cardId));
  if (!recette) return null;
  return { recette, reason: store.whyCannotCraft(inst.instanceId) };
});
function craftSelected(): void {
  const inst = selectedInst.value;
  if (!inst) return;
  // La séquence (Artisan → recyclage → Porteur) prend le relais en overlay.
  if (store.craftFromHand(inst.instanceId)) selectedId.value = null;
}
function bumpDamage(delta: number): void {
  if (selectedInst.value)
    store.adjustCounter(selectedInst.value.instanceId, "damage", delta);
  selectedId.value = null;
}
// CADRE : delta de Force manuel (compteur nommé « force », lu par le combat).
function bumpForce(delta: number): void {
  if (selectedInst.value)
    store.adjustCounter(selectedInst.value.instanceId, "force", delta);
  selectedId.value = null;
}

// ── Zoom ─────────────────────────────────────────────────────────────────────
const zoomCard = ref<Card | null>(null);
const zoomOpen = ref(false);
function zoomInst(instanceId: string): void {
  const inst = store.state.instances[instanceId];
  const card = inst ? resolveCard(inst.cardId) : null;
  if (card) {
    zoomCard.value = card;
    zoomOpen.value = true;
  }
}

// ── HUD de siège ─────────────────────────────────────────────────────────────
function heroInst(seat: Seat) {
  const id = view.value.seats[seat].heroInstanceId;
  return id ? (store.state.instances[id] ?? null) : null;
}
function heroPortrait(seat: Seat): string | null {
  const inst = heroInst(seat);
  if (!inst?.cardId) return null;
  const cleanId = inst.cardId.replace(/_(recto|verso)$/, "");
  const faceSuffix = inst.face === "verso" ? "verso" : "recto";
  return getThumbPath(`/images/cards/${cleanId}_${faceSuffix}.webp`);
}
function heroName(seat: Seat): string | null {
  return resolveCard(heroInst(seat)?.cardId ?? null)?.name ?? null;
}
function heroAccent(seat: Seat): string {
  const card = resolveCard(heroInst(seat)?.cardId ?? null);
  return elementColor(card?.stats?.niveau?.element);
}
function heroCounters(seat: Seat): CardCounters {
  return heroInst(seat)?.counters ?? {};
}
function bumpHero(seat: Seat, counter: string, delta: number): void {
  const id = view.value.seats[seat].heroInstanceId;
  if (!id) return;
  if (counter === "level") {
    store.toggleFlip(id);
  } else {
    store.adjustCounter(id, counter, delta);
  }
}
/** Bonus du 2e joueur à son 1er tour : Havre-Sac ×2 Ressources (règle 2342).
 *  Disparaît dès que le bonus est CONSOMMÉ (Havre-Sac incliné / jeton d'usage),
 *  pour que le badge « +1 » « parte » quand on l'utilise. */
function manaBonus(seat: Seat): boolean {
  return store.sacBonusAvailable(seat);
}
</script>

<style scoped>
.gtable {
  /* Menu déroulant utilitaire "..." */
}
.gmore-wrapper {
  position: relative;
  display: inline-block;
}
.gmore-dropdown {
  position: absolute;
  bottom: 100%;
  right: 0;
  margin-bottom: 8px;
  width: 240px;
  background: rgba(18, 14, 10, 0.95);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(240, 166, 43, 0.4);
  border-radius: 12px;
  padding: 6px;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.85);
  display: flex;
  flex-direction: column;
  gap: 4px;
  z-index: 100;
}
.gmore-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 12px;
  border-radius: 8px;
  background: transparent;
  color: #f6f5f1;
  font-size: 12px;
  font-weight: 500;
  text-align: left;
  transition: background 0.15s ease, color 0.15s ease;
}
.gmore-item:hover {
  background: rgba(240, 166, 43, 0.2);
  color: #f0a62b;
}

.gtable {
  /* Largeur des cartes : bornée à la fois par la largeur (vw) ET la hauteur
     (vh) du viewport. Sur grand écran le terme vw (ou le plafond du clamp)
     l'emporte ; sur écran de portable court, le terme vh fait rétrécir les
     cartes pour que la main ne soit plus rognée (cf. overflow:hidden). */
  --card-field: clamp(78px, min(6.9vw, 9.4vh), 126px);
  --card-wide: clamp(70px, min(6vw, 8vh), 110px);
  --card-hand: clamp(92px, min(8.6vw, 11.5vh), 152px);
  --card-opp: clamp(54px, min(4.6vw, 6vh), 84px);
  --card-havre: clamp(80px, min(6.9vw, 9.4vh), 126px);
  --pile: clamp(56px, min(5vw, 6.5vh), 90px);
  position: relative;
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 6px clamp(12px, 2.5vw, 36px);
  border-radius: 12px;
  color: #f6f5f1;
  background:
    radial-gradient(
      60% 38% at 50% 50%,
      rgba(240, 78, 34, 0.07) 0%,
      transparent 100%
    ),
    radial-gradient(120% 90% at 50% 50%, #2c2720 0%, #1a1611 58%, #0d0a07 100%);
  box-shadow:
    inset 0 0 140px rgba(0, 0, 0, 0.65),
    inset 0 0 0 1px rgba(240, 78, 34, 0.16);
  overflow: hidden;
}
.gtable::before {
  content: "";
  position: absolute;
  inset: 0;
  background-image: radial-gradient(
    rgba(255, 255, 255, 0.022) 1px,
    transparent 1px
  );
  background-size: 5px 5px;
  pointer-events: none;
}
.gseat {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
  min-height: 0;
}
/* Réserve sous la main du joueur : l'éventail fait « plonger » les cartes
   extérieures (rotation au bas-centre) sous la zone de main. Comme la zone de
   terrain est flex:1 et remplit toujours le plateau, sans réserve cette
   plongée serait rognée par l'overflow:hidden, quelle que soit la hauteur
   d'écran. La réserve rend de la place au terrain (qui se contracte) et fait
   remonter la main pour que l'éventail tienne entièrement. Proportionnelle à
   la taille des cartes (donc à l'amplitude de la plongée). */
.gseat:not(.gseat--opp) {
  padding-bottom: calc(var(--card-hand) * 0.2 + 10px);
}

/* ── Bande de siège : HUD · socle · main · piles ── */
.gseat__strip {
  display: grid;
  grid-template-columns: auto auto minmax(0, 1fr) auto;
  gap: clamp(10px, 1.2vw, 18px);
  align-items: stretch;
}
.gseat__handzone {
  display: flex;
  align-items: flex-end;
  justify-content: center;
  min-width: 0;
  border-radius: 12px;
}
.gseat__handzone--opp {
  align-items: center;
}

/* ── Zones ── */
.gzone {
  position: relative;
  border-radius: 10px;
  background: rgba(0, 0, 0, 0.22);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.03);
  padding: 18px 12px 10px;
}
/* ── Havre-Sac : la carte (le socle) + son intérieur (Héros, Salles, Équip.) ── */
.ghavre {
  display: flex;
  gap: 8px;
  align-items: stretch;
}
.ghavre__bag,
.ghavre__inside {
  border: 1px solid rgba(240, 78, 34, 0.28);
  display: flex;
  align-items: center;
}
.ghavre__inside .gzone__cards {
  flex-wrap: nowrap;
}
/* Héros + Havre-Sac + Salles/Équip. : plus grands que les cartes adverses. */
.ghavre .gslot {
  width: var(--card-havre);
}
/* case vide de l'intérieur : matérialise l'espace disponible (dépôt) */
.gslot--ghost {
  aspect-ratio: 63 / 88;
  border: 1px dashed rgba(246, 245, 241, 0.16);
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.18);
}
.gzone--field {
  flex: 1;
  min-height: calc(var(--card-field) * 88 / 63 + 10px);
  display: flex;
  align-items: center;
}
.gzone--play {
  border: 1px dashed rgba(240, 78, 34, 0.3);
}
.gzone__cards {
  position: relative;
  display: flex;
  align-items: center;
  gap: clamp(8px, 1vw, 14px);
  flex-wrap: wrap;
}
.gzone--field .gzone__cards {
  width: 100%;
  justify-content: center;
}
.gzone__label {
  position: absolute;
  top: 5px;
  left: 10px;
  font-family: "Space Mono", ui-monospace, monospace;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: rgba(246, 245, 241, 0.4);
}
.gzone__hint {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  font-family: "Space Mono", ui-monospace, monospace;
  font-size: 11px;
  font-style: italic;
  color: rgba(240, 78, 34, 0.55);
  pointer-events: none;
}

/* ── Surbrillance des zones de drop ── */
.gdrop {
  transition:
    box-shadow 0.18s ease,
    background-color 0.18s ease,
    border-color 0.18s ease,
    transform 0.18s ease;
}
.gdrop--on {
  box-shadow:
    inset 0 0 0 2px rgba(240, 166, 43, 0.4),
    0 0 14px rgba(240, 166, 43, 0.12);
  animation: gdrop-breathe 1.6s ease-in-out infinite;
}
.gdrop--over {
  background-color: rgba(240, 166, 43, 0.14);
  box-shadow:
    inset 0 0 0 2px #f0a62b,
    0 0 26px rgba(240, 166, 43, 0.4);
  animation: none;
  transform: scale(1.012);
}
@keyframes gdrop-breathe {
  0%,
  100% {
    box-shadow:
      inset 0 0 0 2px rgba(240, 166, 43, 0.4),
      0 0 14px rgba(240, 166, 43, 0.12);
  }
  50% {
    box-shadow:
      inset 0 0 0 2px rgba(240, 166, 43, 0.62),
      0 0 22px rgba(240, 166, 43, 0.24);
  }
}

/* ── Ligne médiane ── */
.gmid {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 18px;
  padding: 6px 14px;
  border-radius: 6px;
  border-top: 2px solid rgba(240, 78, 34, 0.5);
  border-bottom: 2px solid rgba(240, 78, 34, 0.5);
  background: linear-gradient(
    90deg,
    transparent,
    rgba(240, 78, 34, 0.08) 18%,
    rgba(240, 78, 34, 0.08) 82%,
    transparent
  );
}
.gmid__label {
  font-family: "Space Mono", ui-monospace, monospace;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.3em;
  text-transform: uppercase;
  color: #f04e22;
  text-shadow: 0 0 16px rgba(240, 78, 34, 0.5);
}
.gmid__queue {
  display: flex;
  align-items: center;
  gap: 8px;
}
.gmid__queue-label {
  font-size: 9px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: rgba(246, 245, 241, 0.55);
}

/* ── Slots ── */
.gslot {
  position: relative;
  width: var(--card-field);
}
.gslot--wide {
  width: var(--card-wide);
}
.gslot--small {
  width: var(--card-opp);
}

/* FLIP des zones du terrain */
.zone-move {
  transition: transform 0.3s cubic-bezier(0.25, 0.8, 0.3, 1);
}
.zone-enter-active {
  transition:
    transform 0.32s cubic-bezier(0.2, 1.15, 0.3, 1),
    opacity 0.22s ease;
}
.zone-enter-from {
  transform: translateY(-14px) scale(0.65);
  opacity: 0;
}
.zone-leave-active {
  position: absolute;
  transition:
    transform 0.2s ease,
    opacity 0.16s ease;
}
.zone-leave-to {
  transform: scale(0.8);
  opacity: 0;
}

/* ── Piles ── */
.gpiles {
  display: flex;
  gap: 10px;
  align-self: center;
  /* Les piles restent CLIQUABLES sous l'éventail : au-dessus des cartes de
     main AU REPOS (z-index 1..taille de main, cf. HandFan) mais SOUS la carte
     survolée (z-index 40) — comportement MTGA : la main ne passe devant qu'au
     survol. Sans ça, une main de 8+ cartes recouvrait entièrement Pioche/
     Défausse/Réserve sur laptop (vérifié à 1280×720 : 0 point atteignable). */
  position: relative;
  z-index: 30;
}
.gpiles__slot {
  display: block;
  border-radius: 8px;
}
/* TL4/TL5 — gestes manuels (table libre) : petite colonne de boutons à côté
   des piles du joueur. */
.gpiles__manual {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 6px;
}
.gbtn--sm {
  padding: 3px 8px;
  font-size: 0.72rem;
}

/* ── Bouton Fin du tour ── */
.gendturn {
  position: absolute;
  right: clamp(10px, 1.6vw, 26px);
  top: 50%;
  transform: translateY(-50%);
  z-index: 18;
  width: clamp(72px, 6.4vw, 90px);
  height: clamp(72px, 6.4vw, 90px);
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: radial-gradient(
    120% 120% at 30% 25%,
    #3a2e22 0%,
    #241c13 55%,
    #160f09 100%
  );
  border: 1px solid rgba(240, 166, 43, 0.5);
  box-shadow:
    0 6px 22px rgba(0, 0, 0, 0.6),
    inset 0 1px 0 rgba(255, 255, 255, 0.08);
  cursor: pointer;
  transition: transform 0.16s cubic-bezier(0.2, 0.9, 0.3, 1.2);
}
.gendturn:hover {
  transform: translateY(-50%) scale(1.06);
}
.gendturn:active {
  transform: translateY(-50%) scale(0.97);
}
.gendturn:focus-visible {
  outline: 2px solid #f0a62b;
  outline-offset: 3px;
}
.gendturn__ring {
  position: absolute;
  inset: -4px;
  border-radius: 50%;
  background: conic-gradient(
    from 0deg,
    rgba(240, 166, 43, 0) 0%,
    rgba(240, 166, 43, 0.75) 25%,
    rgba(240, 78, 34, 0.9) 50%,
    rgba(240, 166, 43, 0.75) 75%,
    rgba(240, 166, 43, 0) 100%
  );
  -webkit-mask: radial-gradient(
    farthest-side,
    transparent calc(100% - 3px),
    #000 calc(100% - 2px)
  );
  mask: radial-gradient(
    farthest-side,
    transparent calc(100% - 3px),
    #000 calc(100% - 2px)
  );
  animation: gendturn-spin 4s linear infinite;
  pointer-events: none;
}
@keyframes gendturn-spin {
  to {
    transform: rotate(360deg);
  }
}
.gendturn__txt {
  font-family: "Space Mono", ui-monospace, monospace;
  font-size: 11px;
  font-weight: 700;
  line-height: 1.25;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  text-align: center;
  color: #f0a62b;
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.8);
}

/* ── Combat : bandeau + surbrillances ── */
.gcombat {
  position: absolute;
  left: 50%;
  top: 12px;
  transform: translateX(-50%);
  z-index: 21;
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
  justify-content: center;
  background: rgba(14, 11, 8, 0.92);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid rgba(240, 78, 34, 0.5);
  border-radius: 999px;
  padding: 9px 22px;
  box-shadow:
    0 10px 34px rgba(0, 0, 0, 0.6),
    0 0 24px rgba(240, 78, 34, 0.18);
}
.gcombat--effect {
  border-color: rgba(240, 166, 43, 0.55);
  box-shadow:
    0 10px 34px rgba(0, 0, 0, 0.6),
    0 0 24px rgba(240, 166, 43, 0.2);
  /* Ancré sur la ligne « LE MONDE » (bande VIDE par construction) plutôt qu'en
     haut : en haut, le bandeau recouvrait la rangée ADVERSE — précisément là
     où vivent les cibles d'un ciblage d'effet (audit UX 2026-07). Le bandeau
     de COMBAT, lui, reste en haut (établi, et ses étapes ne masquent pas de
     cibles : la sélection se fait sur tout le plateau). */
  top: 50%;
  transform: translate(-50%, -50%);
}
.gcombat__step {
  font-family: Fraunces, Georgia, serif;
  font-size: 15px;
}
.gcombat__info {
  font-family: "Space Mono", ui-monospace, monospace;
  font-size: 11px;
  color: rgba(246, 245, 241, 0.65);
}
.gcombat__preview {
  font-family: "Space Mono", ui-monospace, monospace;
  font-size: 11px;
  color: #f0a62b;
  background: rgba(240, 166, 43, 0.12);
  border: 1px solid rgba(240, 166, 43, 0.3);
  border-radius: 6px;
  padding: 2px 8px;
}
.gcombat__btns {
  display: flex;
  gap: 6px;
}
/* 6135 — panneau de répartition de la Force du Géant */
.gcombat__geant {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.gcombat__geantrow {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.gcombat__geantname {
  font-size: 0.78rem;
  opacity: 0.9;
  max-width: 14ch;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.gcombat__geantn {
  min-width: 1.6ch;
  text-align: center;
  font-weight: 700;
}
.gbtn--tiny {
  padding: 0 8px;
  min-width: 26px;
}
.slidedown-enter-active,
.slidedown-leave-active {
  transition:
    transform 0.2s ease,
    opacity 0.2s ease;
}
.slidedown-enter-from,
.slidedown-leave-to {
  transform: translate(-50%, -14px);
  opacity: 0;
}
/* Variante effet (ancrée à -50% vertical) : même glissé de 14px, depuis SA
   position — sans quoi l'animation partirait du haut du plateau. */
.gcombat--effect.slidedown-enter-from,
.gcombat--effect.slidedown-leave-to {
  transform: translate(-50%, calc(-50% - 14px));
}
/* MOBILE (plateau empilé, la page scrolle) : un bandeau ancré au plateau part
   SOUS la ligne de flottaison (audit UX : bandeau effet mesuré à y=928 pour
   844px d'écran → invisible). On l'épingle au VIEWPORT : les invites de
   ciblage/combat restent toujours à l'écran, comme sur MTGA mobile. */
@media (max-width: 767px) {
  .gcombat {
    position: fixed;
    top: 8px;
  }
  .gcombat--effect {
    top: 50vh;
  }
  /* Mobile : le plateau devient une colonne défilante (height:auto), donc une
     barre `absolute` tomberait au bas du board (souvent sous le pli). On l'ancre
     au VIEWPORT pour que la boucle sélection→action reste atteignable au pouce. */
  .gactionbar {
    position: fixed;
    bottom: 8px;
    z-index: 40;
  }
}
.gslot--atk-can :deep(.game-card),
.gslot--target-can :deep(.game-card),
.gslot--blk-can :deep(.game-card) {
  cursor: pointer;
}
.gslot--atk-can :deep(.game-card) {
  outline: 2px dashed rgba(95, 178, 42, 0.75);
  outline-offset: 1px;
}
.gslot--atk :deep(.game-card) {
  outline: 3px solid #5fb22a;
  outline-offset: 1px;
  box-shadow: 0 0 18px rgba(95, 178, 42, 0.5);
}
.gslot--target-can :deep(.game-card) {
  outline: 2px dashed rgba(240, 78, 34, 0.8);
  outline-offset: 1px;
}
.gslot--target :deep(.game-card) {
  outline: 3px solid #f04e22;
  outline-offset: 1px;
  box-shadow: 0 0 20px rgba(240, 78, 34, 0.6);
  animation: gtarget-pulse 1.2s ease-in-out infinite;
}
@keyframes gtarget-pulse {
  0%,
  100% {
    box-shadow: 0 0 20px rgba(240, 78, 34, 0.6);
  }
  50% {
    box-shadow: 0 0 32px rgba(240, 78, 34, 0.85);
  }
}
.gslot--blk-can :deep(.game-card) {
  outline: 2px dashed rgba(31, 156, 236, 0.8);
  outline-offset: 1px;
}
.gslot--blk :deep(.game-card) {
  outline: 3px solid #1f9cec;
  outline-offset: 1px;
  box-shadow: 0 0 18px rgba(31, 156, 236, 0.55);
}
/* Aperçu de létalité : cette carte mourra si le combat est résolu tel quel. */
.gslot--lethal {
  position: relative;
}
.gslot--lethal :deep(.game-card) {
  filter: grayscale(0.35) brightness(0.72);
}
.gslot--lethal::after {
  content: "☠";
  position: absolute;
  top: 2px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 4;
  font-size: 1.5rem;
  color: #ff5b5b;
  text-shadow: 0 1px 5px rgba(0, 0, 0, 0.85);
  pointer-events: none;
}

/* ── Barre d'action ── */
.gactionbar {
  position: absolute;
  left: 50%;
  bottom: 14px;
  transform: translateX(-50%);
  width: min(96%, 1000px);
  display: flex;
  align-items: center;
  gap: 14px;
  flex-wrap: wrap;
  justify-content: center;
  background: rgba(14, 11, 8, 0.88);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid rgba(240, 166, 43, 0.35);
  border-radius: 999px;
  padding: 9px 22px;
  box-shadow:
    0 10px 34px rgba(0, 0, 0, 0.6),
    inset 0 1px 0 rgba(255, 255, 255, 0.06);
  /* Au-dessus des rappels manuels (z-30) : quand une carte est sélectionnée, ses
     contrôles priment et ne sont pas couverts par le panneau de rappels. */
  z-index: 40;
}
.gactionbar__name {
  font-family: Fraunces, Georgia, serif;
  font-size: 16px;
  white-space: nowrap;
}
.gactionbar__btns {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
  justify-content: center;
}
.gactionbar__sep {
  width: 1px;
  height: 20px;
  background: rgba(246, 245, 241, 0.2);
}
.gbtn {
  font-size: 12px;
  font-weight: 600;
  padding: 6px 12px;
  border-radius: 999px;
  background: rgba(246, 245, 241, 0.1);
  color: #f6f5f1;
  transition:
    background 0.15s ease,
    transform 0.15s ease;
}
.gbtn:hover {
  background: rgba(246, 245, 241, 0.22);
  transform: translateY(-1px);
}
.gbtn:active {
  transform: translateY(0) scale(0.97);
}
.gbtn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.gbtn:disabled:hover {
  background: rgba(246, 245, 241, 0.1);
  transform: none;
}
.gbtn--accent {
  background: rgba(240, 78, 34, 0.32);
}
.gbtn--accent:hover {
  background: #f04e22;
}
.gbtn--counter {
  font-family: "Space Mono", ui-monospace, monospace;
}
.gbtn--ghost {
  background: transparent;
  outline: 1px solid rgba(246, 245, 241, 0.25);
}
.slideup-enter-active,
.slideup-leave-active {
  transition:
    transform 0.2s ease,
    opacity 0.2s ease;
}
.slideup-enter-from,
.slideup-leave-to {
  transform: translate(-50%, 14px);
  opacity: 0;
}

@media (max-width: 1024px) {
  .gtable {
    height: auto;
    min-height: 0;
  }
  .gzone--field {
    flex: none;
  }
  .gseat__strip {
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }
  .gseat__handzone {
    grid-column: 1 / -1;
    order: 3;
  }
  .gpiles {
    justify-self: start;
  }
  .gendturn {
    position: relative;
    right: auto;
    top: auto;
    transform: none;
    align-self: flex-end;
  }
  .gendturn:hover,
  .gendturn:active {
    transform: none;
  }
}
@media (max-width: 640px) {
  .gtable {
    padding: 10px 8px 16px;
  }
  .gseat__strip {
    grid-template-columns: 1fr;
  }
}
/* Écrans larges mais pas assez HAUTS (portables 1366×768, mais aussi le
   1080p de bureau) : le plateau garde sa disposition paysage (la bascule
   mobile n'arrive qu'à ≤1024px) mais la hauteur manque → on resserre les
   marges verticales et on aplatit l'éventail pour que la main tienne
   entièrement dans le plateau (overflow:hidden). Au-delà de 1100px (écrans
   1440p type 28″), il y a assez de place : éventail complet conservé. */
@media (min-width: 1025px) and (max-height: 1300px) {
  .gzone {
    padding: 13px 12px 5px;
  }
  .gzone--field {
    padding: 6px 12px 5px;
    min-height: calc(var(--card-field) * 88 / 63);
  }
  .gseat {
    gap: 2px;
  }
}
@media (prefers-reduced-motion: reduce) {
  .gdrop--on,
  .gendturn__ring,
  .gslot--target :deep(.game-card) {
    animation: none;
  }
  .zone-move,
  .zone-enter-active,
  .zone-leave-active {
    transition: none;
  }
}

/* ── Consultation d'une pile publique (Défausse) ─────────────────────────── */
.gpilebrowser {
  position: fixed;
  inset: 0;
  z-index: 60;
  display: grid;
  place-items: center;
  padding: 24px;
  background: rgba(10, 8, 6, 0.78);
  backdrop-filter: blur(3px);
}
.gpilebrowser__panel {
  width: min(920px, 96vw);
  max-height: 86vh;
  display: flex;
  flex-direction: column;
  border-radius: 14px;
  border: 1px solid rgba(246, 245, 241, 0.16);
  background: linear-gradient(180deg, #241d16, #1a1510);
  box-shadow: 0 18px 60px rgba(0, 0, 0, 0.65);
  padding: 16px 18px 18px;
}
.gpilebrowser__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.gpilebrowser__title {
  font-size: 18px;
  font-weight: 700;
  color: #f6f5f1;
}
.gpilebrowser__count {
  margin-left: 10px;
  font-family: "Space Mono", ui-monospace, monospace;
  font-size: 12px;
  font-weight: 700;
  color: rgba(246, 245, 241, 0.7);
}
.gpilebrowser__hint {
  margin-top: 2px;
  font-size: 12px;
  color: rgba(246, 245, 241, 0.6);
}
.gpilebrowser__pos {
  font-family: "Space Mono", ui-monospace, monospace;
  font-size: 10px;
  font-weight: 700;
  color: #fbbf24;
  text-align: center;
  margin-bottom: 3px;
  background: rgba(0, 0, 0, 0.45);
  padding: 1px 4px;
  border-radius: 4px;
  border: 1px solid rgba(251, 191, 36, 0.25);
}
.gpilebrowser__grid {

  margin-top: 12px;
  overflow-y: auto;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(108px, 1fr));
  gap: 10px;
  padding: 2px;
}
/* Récupération depuis MA Défausse : mini-boutons sous chaque carte. */
.gpilebrowser__actions {
  margin-top: 4px;
  display: flex;
  flex-wrap: wrap;
  gap: 3px;
  justify-content: center;
}
/* F4 — dialog de création de jeton. */
.gtokendialog {
  max-width: 420px;
}
.gtokendialog__form {
  margin-top: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.gtokendialog__field {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: rgba(246, 245, 241, 0.8);
}
.gtokendialog__field span {
  width: 64px;
}
.gtokendialog__field input,
.gtokendialog__field select {
  flex: 1;
  background: rgba(0, 0, 0, 0.35);
  border: 1px solid rgba(246, 245, 241, 0.2);
  border-radius: 6px;
  padding: 5px 8px;
  color: inherit;
  font-size: 13px;
}
@media (max-width: 640px) {
  .gpilebrowser {
    padding: 10px;
  }
  .gpilebrowser__grid {
    grid-template-columns: repeat(auto-fill, minmax(88px, 1fr));
  }
}
.gcombat-banner--targeting {
  border-color: rgba(255, 200, 0, 0.7);
  background: linear-gradient(135deg, rgba(40, 25, 10, 0.95), rgba(70, 45, 15, 0.95));
  color: #ffea9f;
  box-shadow: 0 4px 20px rgba(255, 200, 0, 0.35);
}

.gslot--targeted-strong :deep(.game-card) {
  outline: 4px solid #ff3300 !important;
  outline-offset: 2px !important;
  box-shadow:
    0 0 32px rgba(255, 51, 0, 0.95),
    0 0 16px rgba(255, 120, 0, 0.9),
    inset 0 0 16px rgba(255, 51, 0, 0.4) !important;
  transform: scale(1.05);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  animation: gtarget-strong-pulse 1.1s ease-in-out infinite !important;
}

@keyframes gtarget-strong-pulse {
  0%,
  100% {
    box-shadow:
      0 0 32px rgba(255, 51, 0, 0.95),
      0 0 16px rgba(255, 120, 0, 0.9);
  }
  50% {
    box-shadow:
      0 0 48px rgba(255, 80, 0, 1),
      0 0 28px rgba(255, 180, 0, 1);
  }
}

.gslot__target-badge {
  position: absolute;
  top: -24px;
  left: 50%;
  transform: translateX(-50%);
  background: linear-gradient(135deg, #ff3300, #ff8800);
  color: #ffffff;
  font-size: 0.72rem;
  font-weight: 800;
  padding: 2px 8px;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.6);
  box-shadow: 0 2px 10px rgba(255, 51, 0, 0.85);
  z-index: 100;
  white-space: nowrap;
  pointer-events: none;
  animation: gtarget-badge-pulse 1s ease-in-out infinite;
}

@keyframes gtarget-badge-pulse {
  0%, 100% { transform: translateX(-50%) scale(1); }
  50% { transform: translateX(-50%) scale(1.08); }
}

.flying-projectile {
  position: fixed;
  top: 0;
  left: 0;
  font-size: 3rem;
  z-index: 9999;
  pointer-events: none;
  filter: drop-shadow(0 0 16px rgba(255, 200, 0, 0.95));
  animation: fly-projectile 0.65s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
}

@keyframes fly-projectile {
  0% {
    transform: translate(var(--start-x), var(--start-y)) scale(0.5) rotate(var(--angle));
    opacity: 0.2;
  }
  25% {
    transform: translate(calc(var(--start-x) + (var(--end-x) - var(--start-x)) * 0.25), calc(var(--start-y) + (var(--end-y) - var(--start-y)) * 0.25)) scale(1.5) rotate(var(--angle));
    opacity: 1;
  }
  100% {
    transform: translate(var(--end-x), var(--end-y)) scale(0.9) rotate(calc(var(--angle) + 360deg));
    opacity: 0;
  }
}

/* ── Adaptation responsive mobile & petites réso ── */
@media (max-width: 900px) {
  .gactionbar {
    width: 95vw;
    border-radius: 16px;
    padding: 8px 12px;
    gap: 8px;
    max-height: 42vh;
    overflow-y: auto;
  }
  .gactionbar__name {
    font-size: 14px;
    width: 100%;
    text-align: center;
  }
}

@media (max-width: 768px) {
  .gtable {
    --card-field: clamp(58px, 13vw, 92px);
    --card-wide: clamp(52px, 11vw, 84px);
    --card-hand: clamp(68px, 15vw, 112px);
    --card-opp: clamp(42px, 9vw, 68px);
    --card-havre: clamp(60px, 13vw, 92px);
    --pile: clamp(42px, 9vw, 68px);
    padding: 4px;
  }
  .gseat__strip {
    gap: 6px;
  }
  .gmid {
    gap: 8px;
    padding: 4px 8px;
  }
  .gmid__label {
    font-size: 10px;
    letter-spacing: 0.15em;
  }
  .gbtn {
    font-size: 11px;
    padding: 5px 10px;
  }
}

@media (max-width: 480px) {
  .gseat__strip {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
  }
}

</style>
