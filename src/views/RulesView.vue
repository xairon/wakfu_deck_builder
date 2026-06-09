<template>
  <div class="space-y-12 sm:space-y-16">
    <!-- ── EN-TÊTE ── -->
    <header class="animate-fadeIn">
      <p class="eyebrow text-primary">Le règlement des Douze</p>
      <h1 class="mt-4 font-display text-4xl leading-[1.05] sm:text-5xl">
        Règles &amp; Glossaire
      </h1>
      <p class="mt-5 max-w-2xl text-lg leading-relaxed text-base-content/75">
        {{ rulesIntro }}
      </p>
    </header>

    <div class="h-px w-full bg-base-content/80"></div>

    <!-- ── CONSTRUCTION DU DECK ── -->
    <section>
      <p class="section-rule eyebrow">Construction d'un deck</p>
      <div class="mt-4 border-t border-base-content/15">
        <article
          v-for="(rule, i) in deckRules"
          :key="rule.title"
          class="grid grid-cols-[auto_1fr_auto] items-baseline gap-4 border-b border-base-content/15 py-5 sm:gap-6"
        >
          <span class="font-mono text-2xl tabular text-base-content/35"
            >0{{ i + 1 }}</span
          >
          <div>
            <h3 class="font-display text-xl sm:text-2xl">{{ rule.title }}</h3>
            <p class="mt-1 max-w-2xl text-base-content/70">{{ rule.desc }}</p>
          </div>
          <span
            class="shrink-0 font-mono text-2xl tabular text-base-content sm:text-3xl"
            >{{ rule.value }}</span
          >
        </article>
      </div>
    </section>

    <!-- ── ENCRES ÉLÉMENTAIRES ── -->
    <section>
      <p class="section-rule eyebrow">Les cinq éléments</p>
      <dl class="mt-4 border-t border-base-content/15">
        <div
          v-for="el in elements"
          :key="el.name"
          class="spine flex items-baseline border-b border-base-content/15 py-3"
          :style="{ '--spine': el.color }"
        >
          <dt
            class="flex items-center gap-3 font-mono text-[13px] uppercase tracking-wide"
          >
            <img
              :src="`/images/elements/ressource-${el.name.toLowerCase()}.png`"
              :alt="el.name"
              class="h-5 w-5"
            />
            {{ el.name }}
          </dt>
          <span class="leader"></span>
          <dd class="max-w-md text-right text-[15px] text-base-content/70">
            {{ el.desc }}
          </dd>
        </div>
      </dl>
    </section>

    <!-- ── RÈGLES COMPLÈTES ── -->
    <section>
      <p class="section-rule eyebrow">Règles du jeu</p>
      <div class="mt-6 space-y-10">
        <article
          v-for="(s, i) in rulesSections"
          :key="s.title"
          class="grid gap-x-6 gap-y-2 sm:grid-cols-[3rem_1fr]"
        >
          <span
            class="font-mono text-xl tabular text-base-content/30 sm:text-2xl"
            >{{ String(i + 1).padStart(2, "0") }}</span
          >
          <div>
            <h3 class="font-display text-2xl">{{ s.title }}</h3>
            <p
              class="mt-2 max-w-3xl whitespace-pre-line leading-relaxed text-base-content/80"
            >
              {{ s.content }}
            </p>
          </div>
        </article>
      </div>
    </section>

    <!-- ── GLOSSAIRE ── -->
    <section>
      <div class="flex flex-wrap items-center justify-between gap-3">
        <p class="section-rule eyebrow grow">
          Glossaire · {{ filteredGlossary.length }} termes
        </p>
        <label class="relative shrink-0 sm:w-72">
          <svg
            viewBox="0 0 24 24"
            class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-base-content/40"
            fill="none"
            stroke="currentColor"
            stroke-width="1.7"
          >
            <circle cx="11" cy="11" r="7" />
            <path stroke-linecap="round" d="m20 20-3.5-3.5" />
          </svg>
          <input
            v-model="glossarySearch"
            type="text"
            placeholder="Rechercher un terme…"
            class="input input-bordered input-sm w-full pl-9"
            aria-label="Rechercher un terme du glossaire"
          />
        </label>
      </div>
      <dl class="mt-4 border-t border-base-content/15">
        <div
          v-for="g in filteredGlossary"
          :key="g.term"
          class="grid gap-x-8 gap-y-1 border-b border-base-content/15 py-4 sm:grid-cols-[12rem_1fr]"
        >
          <dt
            class="font-mono text-[13px] font-bold uppercase tracking-wide text-base-content"
          >
            {{ g.term }}
          </dt>
          <dd class="max-w-3xl leading-relaxed text-base-content/80">
            {{ g.definition }}
          </dd>
        </div>
        <p
          v-if="!filteredGlossary.length"
          class="py-8 text-center text-base-content/45"
        >
          Aucun terme pour « {{ glossarySearch }} ».
        </p>
      </dl>
    </section>

    <!-- ── PIED ── -->
    <section
      class="flex flex-wrap items-center justify-between gap-4 border-t border-base-content/80 py-8"
    >
      <p class="max-w-md text-base-content/70">
        Prêt à composer ? L'atelier vérifie ces règles en continu et appose le
        sceau dès que le deck est complet.
      </p>
      <router-link to="/decks" class="btn btn-neutral shrink-0">
        → Mes decks
      </router-link>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { matchesSearch } from "@/utils/text";
import { DECK_RULES } from "@/validators/deck";
import { RULES_SECTIONS, RULES_INTRO } from "@/data/rules";
import { GLOSSARY } from "@/data/glossary";

const rulesIntro = RULES_INTRO;
const rulesSections = RULES_SECTIONS;

const glossarySearch = ref("");
const filteredGlossary = computed(() => {
  const q = glossarySearch.value.trim().toLowerCase();
  if (!q) return GLOSSARY;
  return GLOSSARY.filter(
    (g) => matchesSearch(g.term, q) || matchesSearch(g.definition, q),
  );
});

const deckRules = [
  {
    title: "Héros & Havre-Sac",
    desc: "Tout deck s'articule autour d'exactement 1 Héros et 1 Havre-Sac, posés en pilier.",
    value: "1 + 1",
  },
  {
    title: "Taille du paquet",
    desc: `Le paquet de base contient exactement ${DECK_RULES.TOTAL_CARDS} cartes : 1 Héros, 1 Havre-Sac et ${DECK_RULES.MAX_CARDS} autres cartes.`,
    value: `${DECK_RULES.TOTAL_CARDS}`,
  },
  {
    title: "Limite de copies",
    desc: `Au maximum ${DECK_RULES.MAX_COPIES} exemplaires d'une même carte (paquet + réserve) — réduit à 1 pour les cartes Unique.`,
    value: `${DECK_RULES.MAX_COPIES} / 1`,
  },
  {
    title: "Réserve",
    desc: `Optionnelle : elle doit contenir exactement 0 ou ${DECK_RULES.RESERVE_SIZE} cartes (ni Héros ni Havre-Sac).`,
    value: `0 / ${DECK_RULES.RESERVE_SIZE}`,
  },
];

const elements = [
  {
    name: "Air",
    color: "#5FB22A",
    desc: "Vitesse et esquive — frappes rapides et déplacements.",
  },
  {
    name: "Eau",
    color: "#1F9CEC",
    desc: "Soin et contrôle — récupération et entrave de l'adversaire.",
  },
  {
    name: "Feu",
    color: "#F04E22",
    desc: "Dégâts directs — pression offensive et brûlure.",
  },
  {
    name: "Terre",
    color: "#F0A62B",
    desc: "Puissance et défense — coups lourds et résistance.",
  },
  {
    name: "Neutre",
    color: "#98A1AF",
    desc: "Sans affinité élémentaire — utilisable par tous les decks.",
  },
];
</script>
