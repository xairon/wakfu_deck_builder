<template>
  <div class="mx-auto max-w-3xl space-y-14">
    <header class="animate-fadeIn">
      <p class="eyebrow text-primary">Le projet</p>
      <h1 class="mt-4 font-display text-4xl leading-[1.05] sm:text-5xl">
        Un hommage au Wakfu TCG
      </h1>
      <p class="mt-5 text-lg leading-relaxed text-base-content/75">
        Cette application est un projet de fan, indépendant et non-officiel, né
        d'une passion pour le jeu de cartes Wakfu créé par Ankama. Son but est
        simple&nbsp;: célébrer ce jeu, le garder vivant, et offrir à la
        communauté les outils qui lui manquaient.
      </p>
    </header>

    <div class="h-px w-full bg-base-content/80"></div>

    <section class="space-y-4">
      <h2 class="font-display text-2xl sm:text-3xl">
        Dans la continuité de Safranil
      </h2>
      <p class="leading-relaxed text-base-content/80">
        Le travail de préservation mené par <strong>Safranil</strong> sur son
        site
        <a
          :href="WTCG_RETURN_URL"
          target="_blank"
          rel="noopener noreferrer"
          class="text-primary hover:underline"
          >Wakfu TCG Return</a
        >
        — le partage des illustrations des cartes et des listes de decks — est
        le socle de tout ce projet. Cette application ne cherche pas à le
        remplacer, mais à le compléter&nbsp;: prolonger cet effort avec des
        outils interactifs, sans jamais perdre de vue qu'il en est l'origine.
      </p>
    </section>

    <section class="space-y-6">
      <h2 class="font-display text-2xl sm:text-3xl">Ce que l'app apporte</h2>
      <div class="grid gap-4 sm:grid-cols-2">
        <article
          v-for="f in features"
          :key="f.title"
          class="border border-base-content/15 p-5"
        >
          <h3 class="font-display text-xl">{{ f.title }}</h3>
          <p class="mt-1 text-sm leading-relaxed text-base-content/70">
            {{ f.body }}
          </p>
        </article>
      </div>
    </section>

    <section
      class="flex flex-wrap items-center gap-3 border-t border-base-content/80 py-8"
    >
      <a
        :href="DISCORD_INVITE_URL"
        target="_blank"
        rel="noopener noreferrer"
        class="btn btn-primary gap-2"
      >
        Rejoindre le Discord <span aria-hidden="true">↗</span>
      </a>
      <router-link to="/credits" class="btn btn-ghost"
        >Voir les crédits</router-link
      >
    </section>
  </div>
</template>

<script setup lang="ts">
import { DISCORD_INVITE_URL, WTCG_RETURN_URL } from "@/config/links";

const features = [
  {
    title: "Les decks des Dofus Mag",
    body: "Répertorier et explorer les listes de decks publiées par Ankama dans les Dofus Mag, souvent introuvables ailleurs.",
  },
  {
    title: "Tout le contenu des cartes",
    body: "Un catalogue complet et consultable de toutes les cartes, illustrations et effets, extension par extension.",
  },
  {
    title: "Gestion de collection",
    body: "Suivez les cartes que vous possédez et construisez vos decks avec un atelier qui vérifie les règles en continu.",
  },
  {
    title: "Partage avec la communauté",
    body: "Partagez vos decks d'un simple lien avec les membres du Discord, pour échanger et s'inspirer.",
  },
  {
    title: "Un module de jeu",
    body: "Une table jouable (avec tutoriel) pour rejouer ses parties, tester ses decks et redécouvrir le jeu.",
  },
];
</script>
