<template>
  <div class="mx-auto max-w-3xl space-y-10">
    <header class="animate-fadeIn">
      <p class="eyebrow text-primary">Informations légales</p>
      <h1 class="mt-4 font-display text-4xl leading-[1.05] sm:text-5xl">
        Mentions légales
      </h1>
    </header>

    <div
      class="border-l-4 border-warning bg-warning/10 p-4 text-sm text-base-content/80"
      role="note"
    >
      <strong>Modèle à compléter.</strong> Remplacez les champs entre crochets
      par vos informations. Ce texte est un point de départ et ne constitue pas
      un conseil juridique&nbsp;; faites-le relire si nécessaire.
    </div>

    <section class="space-y-3">
      <h2 class="font-display text-2xl">Éditeur du site</h2>
      <p class="leading-relaxed text-base-content/80">
        Ce site est édité par <strong>[VOTRE NOM / PSEUDO]</strong>, à titre
        personnel et non commercial.<br />
        Contact&nbsp;: <strong>[EMAIL DE CONTACT]</strong>.<br />
        Directeur de la publication&nbsp;:
        <strong>[VOTRE NOM / PSEUDO]</strong>.
      </p>
    </section>

    <section class="space-y-3">
      <h2 class="font-display text-2xl">Hébergement</h2>
      <p class="leading-relaxed text-base-content/80">
        Le site est hébergé par <strong>Vercel Inc.</strong>, 340 S Lemon Ave
        #4133, Walnut, CA 91789, États-Unis — vercel.com.
        <em class="text-base-content/55"
          >(À adapter si vous changez d'hébergeur.)</em
        >
      </p>
    </section>

    <section class="space-y-3">
      <h2 class="font-display text-2xl">Propriété intellectuelle</h2>
      <p class="leading-relaxed text-base-content/80">
        <strong>Wakfu</strong>, le <strong>Wakfu TCG</strong>, leurs cartes,
        illustrations, noms et univers sont la propriété
        d'<strong>Ankama</strong>. Ce site est un projet de fan indépendant,
        sans aucune affiliation, partenariat ni approbation d'Ankama. Les
        illustrations et données de cartes proviennent du travail communautaire
        partagé par Safranil (wtcg-return.fr). Toute demande de retrait peut
        être adressée à l'éditeur à l'adresse de contact ci-dessus.
      </p>
    </section>

    <section
      class="flex flex-wrap items-center justify-between gap-4 border-t border-base-content/80 py-8"
    >
      <p class="text-base-content/70">Voir aussi&nbsp;:</p>
      <router-link to="/cgu" class="btn btn-neutral shrink-0">
        → Conditions générales d'utilisation
      </router-link>
    </section>
  </div>
</template>

<script setup lang="ts"></script>
