<script setup lang="ts">
/**
 * TutorialCompletionModal — Écran de fin didactique du tutoriel d'apprentissage.
 * Félicite le joueur, résume tous les points clés et règles essentiels du TCG Wakfu,
 * et invite à continuer en partie solo libre ou en 1v1 en ligne.
 */
import { useTutorialStore } from "@/stores/tutorialStore";
import { useGameStore } from "@/stores/gameStore";

const tutorial = useTutorialStore();
const game = useGameStore();

function onReplay(): void {
  tutorial.closeCompletionModal();
  game.quitMatch();
}

function onContinuePlaying(): void {
  tutorial.closeCompletionModal();
  game.continueMatch();
}
</script>

<template>
  <Transition name="modal-pop">
    <div
      v-if="tutorial.completionModalVisible"
      class="tuto-modal-overlay"
      role="dialog"
      aria-modal="true"
      data-testid="tutorial-completion-modal"
    >
      <div class="tuto-modal-backdrop" @click="onContinuePlaying"></div>
      
      <div class="tuto-modal-card">
        <!-- Badge & Titre de victoire pédagogique -->
        <div class="text-center">
          <div class="inline-block p-4 rounded-full bg-primary/20 text-4xl mb-2 animate-bounce">
            🎉
          </div>
          <p class="text-xs uppercase font-bold tracking-wider text-primary">Bilan d'Apprentissage</p>
          <h2 class="font-display text-2xl sm:text-3xl font-bold text-white mt-1">
            Félicitations, Apprenti d'Incarnam !
          </h2>
          <p class="text-sm text-base-content/80 mt-1 max-w-lg mx-auto">
            Tu as complété le tutoriel et expérimenté par toi-même toutes les mécaniques majeures du jeu de cartes Wakfu TCG.
          </p>
        </div>

        <!-- Récapitulatif des règles importantes maîtrisées -->
        <div class="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[50vh] overflow-y-auto pr-1">
          <div class="p-3 rounded-xl bg-base-200/60 border border-base-content/10 flex items-start gap-3">
            <span class="text-xl">🎴</span>
            <div>
              <h3 class="text-xs font-bold text-primary">1. Mulligan & Main de départ</h3>
              <p class="text-xs text-base-content/75 mt-0.5">
                Au début de la partie, tu peux garder ou refaire ta main. Le 1er mulligan est gratuit (6 cartes), puis -1 carte par reprise.
              </p>
            </div>
          </div>

          <div class="p-3 rounded-xl bg-base-200/60 border border-base-content/10 flex items-start gap-3">
            <span class="text-xl">⚡</span>
            <div>
              <h3 class="text-xs font-bold text-primary">2. Ressources & Paiement</h3>
              <p class="text-xs text-base-content/75 mt-0.5">
                Pour poser une carte, incline des cartes redressées (Ressources ou Havre-Sac) pour générer les PA nécessaires.
              </p>
            </div>
          </div>

          <div class="p-3 rounded-xl bg-base-200/60 border border-base-content/10 flex items-start gap-3">
            <span class="text-xl">⏳</span>
            <div>
              <h3 class="text-xs font-bold text-primary">3. Mal d'invocation</h3>
              <p class="text-xs text-base-content/75 mt-0.5">
                Un Allié qui vient d'entrer en jeu ne peut pas attaquer immédiatement le tour de son arrivée (hors mot-clé Célérité).
              </p>
            </div>
          </div>

          <div class="p-3 rounded-xl bg-base-200/60 border border-base-content/10 flex items-start gap-3">
            <span class="text-xl">⛺</span>
            <div>
              <h3 class="text-xs font-bold text-primary">4. Havre-Sac & Déplacement</h3>
              <p class="text-xs text-base-content/75 mt-0.5">
                Le Héros peut sortir dans le Monde pour combattre, ou se réfugier dans son Havre-Sac pour être protégé des attaques directes.
              </p>
            </div>
          </div>

          <div class="p-3 rounded-xl bg-base-200/60 border border-base-content/10 flex items-start gap-3">
            <span class="text-xl">⚔️</span>
            <div>
              <h3 class="text-xs font-bold text-primary">5. Combat, PM & Blocage (Ctrl + Clic)</h3>
              <p class="text-xs text-base-content/75 mt-0.5">
                Une seule attaque par tour ! Fais <strong>Ctrl + Clic</strong> sur tes attaquants puis la cible. En défense, fais <strong>Ctrl + Clic</strong> sur ton bloqueur puis l'attaquant adverse.
              </p>
            </div>
          </div>

          <div class="p-3 rounded-xl bg-base-200/60 border border-base-content/10 flex items-start gap-3">
            <span class="text-xl">🔄</span>
            <div>
              <h3 class="text-xs font-bold text-primary">6. Inclinaison Manuelle (Clic Droit)</h3>
              <p class="text-xs text-base-content/75 mt-0.5">
                Un <strong>clic droit</strong> sur n'importe quelle carte en jeu permet de l'incliner ou la redresser à tout moment pour gérer tes ressources et tes états.
              </p>
            </div>
          </div>

          <div class="p-3 rounded-xl bg-base-200/60 border border-base-content/10 flex items-start gap-3">
            <span class="text-xl">🏆</span>
            <div>
              <h3 class="text-xs font-bold text-primary">7. Deux façons de gagner</h3>
              <p class="text-xs text-base-content/75 mt-0.5">
                1) Réduire les PV du Héros adverse à 0.<br>
                2) Faire monter ton Héros au <strong>Niveau 3</strong> en accumulant <strong>18 XP</strong> !
              </p>
            </div>
          </div>
        </div>

        <!-- Rappel important sur les autres modes de jeu -->
        <div class="mt-4 p-3 rounded-xl bg-primary/10 border border-primary/30 text-xs space-y-1">
          <p class="font-bold text-primary flex items-center gap-1.5">
            <span>ℹ️</span> Prêt pour la suite ?
          </p>
          <p class="text-base-content/80 leading-relaxed">
            Seul ce <strong>Tutoriel d'Apprentissage</strong> est automatisé et assisté. Les autres modes (<strong>Seul contre soi-même</strong>, <strong>1v1 En Ligne</strong> et <strong>2v2 En Équipe</strong>) fonctionnent comme une <strong>vraie table de jeu physique</strong> : les joueurs y jouent librement sans assistance automatique au clic.
          </p>
        </div>

        <!-- Boutons d'action -->
        <div class="mt-6 flex flex-wrap justify-end gap-3 pt-3 border-t border-base-content/10">
          <button
            type="button"
            class="btn btn-outline btn-sm"
            @click="onContinuePlaying"
          >
            Observer le plateau
          </button>
          <button
            type="button"
            class="btn btn-primary btn-sm px-6"
            data-testid="tutorial-finish-btn"
            @click="onReplay"
          >
            Quitter le tutoriel & Choisir un mode
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.tuto-modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}

.tuto-modal-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(10, 8, 12, 0.88);
  backdrop-filter: blur(10px);
}

.tuto-modal-card {
  position: relative;
  z-index: 2;
  width: 100%;
  max-width: 680px;
  background: linear-gradient(145deg, #1f1b18, #2a2420);
  border: 1px solid rgba(245, 158, 11, 0.4);
  border-radius: 20px;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7), 0 0 25px rgba(245, 158, 11, 0.2);
  padding: 24px;
  color: #f6f5f1;
}

.modal-pop-enter-active,
.modal-pop-leave-active {
  transition: opacity 0.3s ease, transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

.modal-pop-enter-from,
.modal-pop-leave-to {
  opacity: 0;
  transform: scale(0.9);
}
</style>
