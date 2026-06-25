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
