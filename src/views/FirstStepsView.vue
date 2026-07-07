<template>
  <div class="mx-auto max-w-3xl space-y-12">
    <header class="animate-fadeIn">
      <p class="eyebrow text-primary">Débuter</p>
      <h1 class="mt-4 font-display text-4xl leading-[1.05] sm:text-5xl">
        Apprendre à jouer
      </h1>
      <p class="mt-5 text-lg leading-relaxed text-base-content/75">
        L'essentiel pour lancer votre première partie de Wakfu TCG. Pour le
        détail complet, consultez les
        <router-link to="/regles" class="text-primary hover:underline"
          >règles &amp; le glossaire</router-link
        >.
      </p>
      <router-link to="/play/table" class="btn btn-primary mt-6 gap-2">
        ▶ Lancer le tutoriel jouable
      </router-link>
    </header>

    <div class="h-px w-full bg-base-content/80"></div>

    <section>
      <ol class="space-y-8">
        <li
          v-for="(s, i) in steps"
          :key="s.title"
          class="grid grid-cols-[auto_1fr] items-baseline gap-4 sm:gap-6"
        >
          <span class="font-mono text-2xl tabular text-base-content/35">
            {{ String(i + 1).padStart(2, "0") }}
          </span>
          <div>
            <h2 class="font-display text-2xl">{{ s.title }}</h2>
            <p class="mt-1 leading-relaxed text-base-content/80">
              {{ s.body }}
            </p>
          </div>
        </li>
      </ol>
    </section>

    <section class="space-y-5">
      <div>
        <p class="eyebrow text-primary">Deux façons de jouer</p>
        <h2 class="mt-3 font-display text-3xl">La table, deux modes</h2>
      </div>
      <div class="grid gap-4 sm:grid-cols-2">
        <div class="border border-base-content/15 p-5">
          <p class="eyebrow text-secondary">Apprendre en jouant</p>
          <p class="mt-2 text-sm leading-relaxed text-base-content/80">
            Une partie complète contre l'ordinateur, guidée pas à pas au début
            puis libre.
            <span class="font-semibold"
              >Tout est automatisé pour vous : coûts, combat, victoire — et les
              effets des cartes.</span
            >
            Seuls les decks starter d'Incarnam sont proposés : ce sont les seuls
            dont chaque effet est programmé.
          </p>
        </div>
        <div class="border border-base-content/15 p-5">
          <p class="eyebrow text-primary">Jouer en ligne</p>
          <p class="mt-2 text-sm leading-relaxed text-base-content/80">
            Affrontez un ami à distance, en temps réel, avec le deck complet de
            votre choix. Les règles peuvent être assistées,
            <span class="font-semibold"
              >mais les effets des cartes se jouent toujours à la main</span
            >
            : c'est à vous de les appliquer, comme sur une vraie table.
          </p>
        </div>
      </div>
    </section>

    <section
      class="flex flex-wrap items-center justify-between gap-4 border-t border-base-content/80 py-8"
    >
      <p class="max-w-md text-base-content/70">
        Le meilleur moyen d'apprendre, c'est de jouer&nbsp;: la table guide
        chaque étape.
      </p>
      <router-link to="/play/table" class="btn btn-neutral shrink-0">
        → Ouvrir la table
      </router-link>
    </section>
  </div>
</template>

<script setup lang="ts">
import { FIRST_STEPS } from "@/data/firstSteps";
const steps = FIRST_STEPS;
</script>
