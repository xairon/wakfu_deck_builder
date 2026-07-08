<template>
  <Teleport to="body">
    <Transition name="cardhov">
      <div
        v-if="card"
        ref="el"
        class="cardhov border border-base-content/80 bg-base-100"
        :style="style"
        aria-hidden="true"
        data-testid="card-hover-preview"
      >
        <!-- Carte agrandie -->
        <div class="plate-frame" :style="{ '--spine': spine }">
          <img
            :src="img"
            :alt="card.name"
            class="block aspect-[7/10] w-full object-cover"
            @error="onImgError"
          />
        </div>
        <!-- Infos -->
        <div class="p-3">
          <p class="eyebrow text-base-content/50">{{ subtitle }}</p>
          <h4 class="font-display text-lg leading-tight">{{ card.name }}</h4>
          <div
            v-if="statRows.length"
            class="mt-2 flex flex-wrap gap-x-3 gap-y-1"
          >
            <span
              v-for="s in statRows"
              :key="s.label"
              class="font-mono text-[11px] tabular"
            >
              <span class="text-base-content/45">{{ s.label }}</span>
              <span class="ml-1 font-bold">{{ s.value }}</span>
            </span>
          </div>
          <ul v-if="effects.length" class="cardhov__effects mt-2 space-y-1.5">
            <!-- eslint-disable-next-line vue/no-v-html -->
            <li
              v-for="(e, i) in effects"
              :key="i"
              class="border-l-2 border-base-content/20 pl-2 text-[12px] leading-relaxed"
              v-html="highlightEffectHtml(e.description)"
            ></li>
          </ul>
          <!-- Définitions de mots-clés (glossaire) : Agilité, Tacle, Géant… -->
          <dl v-if="keywords.length" class="cardhov__kw mt-2 space-y-1">
            <div
              v-for="(k, i) in keywords"
              :key="`kw-${i}`"
              class="rounded bg-base-content/5 px-2 py-1 text-[11px] leading-snug"
            >
              <dt class="font-bold text-primary">{{ k.label }}</dt>
              <dd v-if="k.description" class="text-base-content/70">
                {{ k.description }}
              </dd>
            </div>
          </dl>
          <!-- Glossaire : termes de mécanique cités dans l'effet (Métier, etc.) -->
          <dl v-if="glossary.length" class="cardhov__kw mt-2 space-y-1">
            <div
              v-for="g in glossary"
              :key="`gl-${g.term}`"
              class="rounded bg-base-content/5 px-2 py-1 text-[11px] leading-snug"
            >
              <dt class="font-bold text-base-content/80">{{ g.term }}</dt>
              <dd class="text-base-content/70">{{ g.definition }}</dd>
            </div>
          </dl>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
/**
 * Aperçu de carte au survol pour l'atelier de deck : survoler une carte (tuile
 * du vivier, ligne de deck/réserve) affiche cette petite fenêtre flottante qui
 * suit le curseur — carte agrandie + caractéristiques + effets. Réutilise le
 * singleton useCardPreview (un seul calque actif à la fois). Inerte au toucher
 * (les écrans tactiles n'émettent pas mouseenter), comme le reste de l'app.
 */
import { computed, nextTick, onUnmounted, ref, watch } from "vue";
import { useCardPreview } from "@/composables/useCardPreview";
import { isHeroCard } from "@/types/cards";
import { elementColor } from "@/config/elementColors";
import { highlightEffectHtml, isEffectAnnotation } from "@/utils/effectText";
import { glossaryHints } from "@/utils/glossaryHints";

const { card, mouseX, mouseY, hide } = useCardPreview();

// `card` est un singleton partagé (cf. CardPreviewLayer du plateau). Sans ce
// nettoyage, quitter l'atelier alors qu'une carte est survolée laisserait
// l'aperçu « armé » et il réapparaîtrait sur une autre page.
onUnmounted(hide);

const WIDTH = 270;
const el = ref<HTMLElement | null>(null);
const measured = ref(440);

const img = computed(() => {
  const c = card.value;
  if (!c) return "";
  if (c.imageUrl) return c.imageUrl;
  if (c.mainType === "Héros") return `/images/cards/${c.id}_recto.webp`;
  return `/images/cards/${c.id}.webp`;
});

function onImgError(e: Event) {
  (e.target as HTMLImageElement).src = "/images/card-back.webp";
}

const spine = computed(() => {
  const c = card.value;
  const elName = (
    c?.stats?.niveau?.element ||
    c?.stats?.force?.element ||
    "neutre"
  )
    .toString()
    .toLowerCase();
  return elementColor(elName);
});

const subtitle = computed(() => {
  const c = card.value;
  if (!c) return "";
  return c.subTypes?.join(" · ") || c.mainType;
});

const statRows = computed(() => {
  const s = card.value?.stats;
  if (!s) return [] as { label: string; value: string }[];
  const rows: { label: string; value: string }[] = [];
  if (s.niveau)
    rows.push({
      label: "Niveau",
      value: `${s.niveau.value} ${s.niveau.element}`,
    });
  if (s.force)
    rows.push({ label: "Force", value: `${s.force.value} ${s.force.element}` });
  if (s.pa !== undefined) rows.push({ label: "PA", value: String(s.pa) });
  if (s.pm !== undefined) rows.push({ label: "PM", value: String(s.pm) });
  if (s.pv !== undefined) rows.push({ label: "PV", value: String(s.pv) });
  return rows;
});

const effects = computed(() => {
  const c = card.value;
  if (!c) return [] as { description: string }[];
  // Aperçu = lecture rapide des effets RÉELS ; on masque les annotations
  // (rulings/errata), visibles dans la modale (section « Notes »).
  const all = isHeroCard(c)
    ? [...(c.recto?.effects ?? []), ...(c.verso?.effects ?? [])]
    : (c.effects ?? []);
  return all.filter((e) => !isEffectAnnotation(e));
});

/** Définitions de mots-clés (glossaire) portées par la carte — « Agilité »,
 *  « Tacle », « Géant », « Résistance »… : libellé (nom + valeur + éléments) +
 *  texte de glossaire. Données mixtes : certains mots-clés (Tacle/Agilité…) ont
 *  le VRAI texte de glossaire dans `description`, d'autres (Résistance…) y mettent
 *  juste la VALEUR ("1"). On normalise : une description purement numérique
 *  devient la valeur du libellé (pas une « définition »). Dédoublonné par nom. */
const keywords = computed(() => {
  const c = card.value;
  if (!c) return [] as { label: string; description: string }[];
  const all = isHeroCard(c)
    ? [...(c.recto?.keywords ?? []), ...(c.verso?.keywords ?? [])]
    : (c.keywords ?? []);
  const seen = new Set<string>();
  const out: { label: string; description: string }[] = [];
  for (const k of all) {
    if (!k?.name || seen.has(k.name)) continue;
    seen.add(k.name);
    const raw = (k.description ?? "").trim();
    const numeric = /^\d+$/.test(raw);
    const value = k.value ?? (numeric ? Number(raw) : undefined);
    const els = (k.elements ?? []).join(", ");
    const label =
      k.name + (value != null ? ` ${value}` : "") + (els ? ` (${els})` : "");
    out.push({ label, description: numeric ? "" : raw });
  }
  return out;
});

/** Définitions de glossaire à surfacer : termes de mécanique non évidents
 *  (Métier, Recette, Agilité…) portés par la carte — texte d'effet, mots-clefs
 *  (Recette « : Bijoutier 3 »), ou Métier — hors mots-clefs déjà expliqués. */
const glossary = computed(() => {
  const c = card.value;
  if (!c) return [];
  const kws = isHeroCard(c)
    ? [...(c.recto?.keywords ?? []), ...(c.verso?.keywords ?? [])]
    : (c.keywords ?? []);
  return glossaryHints({
    effectsText: effects.value.map((e) => e.description).join("  "),
    keywordNames: kws
      .map((k) => k.name)
      .filter((n): n is NonNullable<typeof n> => !!n),
    keywordDescriptions: kws
      .map((k) => k.description)
      .filter((d): d is string => !!d),
    metier: c.metier ?? [],
  });
});

// La hauteur de la fenêtre varie selon le contenu : on la mesure après rendu
// pour la centrer/clamper verticalement sans débordement.
watch(card, async () => {
  await nextTick();
  if (el.value) measured.value = el.value.offsetHeight;
});

const style = computed(() => {
  const pad = 16;
  const offset = 28;
  const vw = typeof window !== "undefined" ? window.innerWidth : 1440;
  const vh = typeof window !== "undefined" ? window.innerHeight : 900;
  const h = measured.value;
  // À droite du curseur par défaut ; bascule à gauche si ça déborde.
  let left = mouseX.value + offset;
  if (left + WIDTH + pad > vw) left = mouseX.value - WIDTH - offset;
  left = Math.max(pad, Math.min(left, vw - WIDTH - pad));
  // Centré verticalement sur le curseur, clampé dans la fenêtre.
  let top = mouseY.value - h / 2;
  top = Math.max(pad, Math.min(top, vh - h - pad));
  return { left: `${left}px`, top: `${top}px`, width: `${WIDTH}px` };
});
</script>

<style scoped>
.cardhov {
  position: fixed;
  z-index: 9000;
  pointer-events: none;
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.45);
}
/* Effets bornés en hauteur (la fenêtre reste petite) : fondu en bas ; pour la
   lecture complète, cliquer ouvre la modale. */
.cardhov__effects {
  max-height: 9rem;
  overflow: hidden;
  -webkit-mask-image: linear-gradient(to bottom, #000 78%, transparent);
  mask-image: linear-gradient(to bottom, #000 78%, transparent);
}
.cardhov-enter-active,
.cardhov-leave-active {
  transition:
    opacity 0.12s ease,
    transform 0.12s ease;
}
.cardhov-enter-from,
.cardhov-leave-to {
  opacity: 0;
  transform: scale(0.97);
}
@media (prefers-reduced-motion: reduce) {
  .cardhov-enter-active,
  .cardhov-leave-active {
    transition: none;
  }
}
</style>
