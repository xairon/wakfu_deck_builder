<template>
  <main class="container mx-auto px-4 py-8">
    <h1 class="text-3xl font-bold">Administration</h1>
    <p class="mt-2 opacity-80">
      Édition du contenu du site. Toute action est journalisée.
    </p>
    <ul class="mt-6 grid gap-4 sm:grid-cols-2">
      <li v-for="link in links" :key="link.to">
        <RouterLink
          :to="link.to"
          class="block rounded-lg border border-base-content/20 p-4 hover:border-primary"
        >
          <span class="font-display text-xl">{{ link.label }}</span>
          <span class="mt-1 block text-sm opacity-70">{{ link.desc }}</span>
        </RouterLink>
      </li>
    </ul>
  </main>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useAuthStore } from "@/stores/authStore";

const authStore = useAuthStore();
const links = computed(() => {
  const base = [
    {
      to: "/admin/errata",
      label: "Errata",
      desc: "Ajouter, corriger, supprimer les errata de cartes.",
    },
    {
      to: "/admin/regles",
      label: "Règles",
      desc: "Corriger le texte officiel ou ajouter une règle manquante.",
    },
    {
      to: "/admin/journal",
      label: "Journal",
      desc: "Qui a modifié quoi, et quand.",
    },
  ];
  if (authStore.isOwner)
    base.push({
      to: "/admin/comptes",
      label: "Comptes",
      desc: "Attribuer ou retirer le rôle admin.",
    });
  return base;
});
</script>
