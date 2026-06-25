<template>
  <div class="mx-auto max-w-3xl space-y-12">
    <header class="animate-fadeIn">
      <p class="eyebrow text-primary">Remerciements</p>
      <h1 class="mt-4 font-display text-4xl leading-[1.05] sm:text-5xl">
        Crédits
      </h1>
      <p class="mt-5 text-lg leading-relaxed text-base-content/75">
        Cette application n'existe que grâce au travail d'autres passionnés.
        Voici à qui l'on doit le Wakfu TCG et les ressources qui font vivre ce
        projet.
      </p>
    </header>

    <div class="h-px w-full bg-base-content/80"></div>

    <section class="space-y-8">
      <article
        v-for="c in credits"
        :key="c.name"
        class="grid gap-1 border-l-2 border-primary/40 pl-5"
      >
        <p class="eyebrow text-base-content/50">{{ c.role }}</p>
        <h2 class="font-display text-2xl">{{ c.name }}</h2>
        <p class="mt-1 leading-relaxed text-base-content/80">
          {{ c.description }}
        </p>
        <a
          v-if="c.url"
          :href="c.url"
          target="_blank"
          rel="noopener noreferrer"
          class="mt-1 inline-flex w-fit items-center gap-1 text-sm text-primary hover:underline"
        >
          {{ c.url.replace(/^https?:\/\//, "") }}
          <span aria-hidden="true">↗</span>
        </a>
      </article>
    </section>

    <section
      class="flex flex-wrap items-center justify-between gap-4 border-t border-base-content/80 py-8"
    >
      <p class="max-w-md text-base-content/70">
        Envie d'en savoir plus sur la démarche du projet&nbsp;?
      </p>
      <router-link to="/a-propos" class="btn btn-neutral shrink-0">
        → À propos
      </router-link>
    </section>
  </div>
</template>

<script setup lang="ts">
import { CREDITS } from "@/data/credits";
const credits = CREDITS;
</script>
