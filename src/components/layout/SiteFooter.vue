<template>
  <footer class="mt-16 border-t border-base-content/80 bg-base-100">
    <div class="container mx-auto px-4 py-12 sm:px-6">
      <div class="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
        <nav v-for="col in columns" :key="col.title" :aria-label="col.title">
          <p class="eyebrow mb-3 text-base-content/55">{{ col.title }}</p>
          <ul class="space-y-2">
            <li v-for="link in col.links" :key="link.label">
              <a
                v-if="link.external"
                :href="link.to"
                target="_blank"
                rel="noopener noreferrer"
                class="inline-flex items-center gap-1 text-base-content/70 transition-colors hover:text-base-content"
              >
                {{ link.label }}
                <span aria-hidden="true">↗</span>
              </a>
              <router-link
                v-else
                :to="link.to"
                class="text-base-content/70 transition-colors hover:text-base-content"
              >
                {{ link.label }}
              </router-link>
            </li>
          </ul>
        </nav>
      </div>

      <div
        class="mt-10 flex flex-col gap-4 border-t border-base-content/15 pt-6 sm:flex-row sm:items-center sm:justify-between"
      >
        <p class="max-w-2xl text-sm leading-relaxed text-base-content/55">
          Projet de fan <strong>non-officiel</strong>, hommage au Wakfu TCG.
          Wakfu TCG © Ankama. Illustrations et listes de cartes grâce au
          travail de <strong>Safranil</strong> — wtcg-return.fr.
        </p>
        <a
          :href="DISCORD_INVITE_URL"
          target="_blank"
          rel="noopener noreferrer"
          class="btn btn-primary btn-sm shrink-0 gap-2"
        >
          Rejoindre le Discord
          <span aria-hidden="true">↗</span>
        </a>
      </div>
    </div>
  </footer>
</template>

<script setup lang="ts">
import { DISCORD_INVITE_URL } from "@/config/links";

interface FooterLink {
  label: string;
  to: string;
  external?: boolean;
}
interface FooterColumn {
  title: string;
  links: FooterLink[];
}

const columns: FooterColumn[] = [
  {
    title: "Le projet",
    links: [
      { label: "À propos", to: "/a-propos" },
      { label: "Crédits", to: "/credits" },
    ],
  },
  {
    title: "Le jeu",
    links: [
      { label: "Premiers pas", to: "/regles/apprendre" },
      { label: "Règles & glossaire", to: "/regles" },
      { label: "Decks officiels", to: "/decks/official" },
    ],
  },
  {
    title: "Communauté",
    links: [
      { label: "Discord", to: DISCORD_INVITE_URL, external: true },
      { label: "Decks de la communauté", to: "/decks/community" },
    ],
  },
  {
    title: "Légal",
    links: [
      { label: "Mentions légales", to: "/mentions-legales" },
      { label: "CGU", to: "/cgu" },
    ],
  },
];
</script>
