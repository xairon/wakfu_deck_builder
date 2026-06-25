<template>
  <div class="mx-auto max-w-3xl space-y-10">
    <header class="animate-fadeIn">
      <p class="eyebrow text-primary">Conditions</p>
      <h1 class="mt-4 font-display text-4xl leading-[1.05] sm:text-5xl">
        Conditions générales d'utilisation
      </h1>
      <p class="mt-4 text-base-content/70">
        Dernière mise à jour&nbsp;: 25 juin 2026.
      </p>
    </header>

    <p class="text-sm italic text-base-content/55">
      Projet de fan non-officiel à but non lucratif. Ces conditions sont
      fournies de bonne foi et ne constituent pas un conseil juridique.
    </p>

    <section v-for="(s, i) in sections" :key="s.title" class="space-y-3">
      <h2 class="font-display text-2xl">{{ i + 1 }}. {{ s.title }}</h2>
      <p class="whitespace-pre-line leading-relaxed text-base-content/80">
        {{ s.body }}
      </p>
    </section>

    <section
      class="flex flex-wrap items-center justify-between gap-4 border-t border-base-content/80 py-8"
    >
      <p class="text-base-content/70">Voir aussi&nbsp;:</p>
      <router-link to="/mentions-legales" class="btn btn-neutral shrink-0">
        → Mentions légales
      </router-link>
    </section>
  </div>
</template>

<script setup lang="ts">
const sections = [
  {
    title: "Objet",
    body: "Les présentes conditions régissent l'utilisation de cette application web, un projet de fan non-officiel dédié au Wakfu TCG. En utilisant le site, vous acceptez ces conditions.",
  },
  {
    title: "Accès au service",
    body: "Le service est fourni gratuitement et « en l'état », sans garantie de disponibilité, d'exactitude des données ou d'absence d'interruption. Certaines fonctionnalités (collection, decks) nécessitent la création d'un compte.",
  },
  {
    title: "Comptes et données",
    body: "L'authentification et le stockage des données (collection, decks) reposent sur Supabase. Vous êtes responsable de la confidentialité de vos identifiants. Vous pouvez demander la suppression de votre compte et des données associées à l'adresse de contact des mentions légales.",
  },
  {
    title: "Contenu utilisateur",
    body: "Les decks et collections que vous créez restent les vôtres. Vous vous engagez à ne pas utiliser le service à des fins illicites ou abusives.",
  },
  {
    title: "Propriété intellectuelle",
    body: "Wakfu, le Wakfu TCG, leurs cartes et illustrations appartiennent à Ankama. Ce site n'est ni affilié ni approuvé par Ankama. Les ressources de cartes proviennent du travail communautaire partagé par Safranil (wtcg-return.fr).",
  },
  {
    title: "Limitation de responsabilité",
    body: "L'éditeur ne saurait être tenu responsable des dommages directs ou indirects liés à l'utilisation du site, ni de l'indisponibilité ou de la perte de données.",
  },
  {
    title: "Données personnelles",
    body: "Les seules données collectées sont celles nécessaires au fonctionnement du compte (e-mail) et au stockage de votre collection et de vos decks. Elles ne sont ni vendues ni cédées à des tiers. Pour toute demande d'accès ou de suppression, contactez l'éditeur.",
  },
  {
    title: "Modification des conditions",
    body: "Ces conditions peuvent être mises à jour à tout moment. La version applicable est celle publiée sur cette page.",
  },
  {
    title: "Contact",
    body: "Pour toute question relative à ces conditions, écrivez à l'adresse indiquée dans les mentions légales.",
  },
];
</script>
