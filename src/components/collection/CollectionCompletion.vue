<template>
  <div class="space-y-10">
    <!-- ── REGISTRE GLOBAL ── -->
    <section class="border-y border-base-content/80 py-5">
      <div class="grid grid-cols-2 gap-6 sm:grid-cols-4">
        <div>
          <p class="eyebrow">Au catalogue</p>
          <p class="mt-1 font-mono text-3xl tabular">{{ overall.total }}</p>
        </div>
        <div>
          <p class="eyebrow">Possédées</p>
          <p class="mt-1 font-mono text-3xl tabular">{{ overall.owned }}</p>
        </div>
        <div>
          <p class="eyebrow">Manquantes</p>
          <p class="mt-1 font-mono text-3xl tabular">{{ overall.missing }}</p>
        </div>
        <div>
          <p class="eyebrow">Complétion</p>
          <p class="mt-1 font-mono text-3xl tabular text-primary">
            {{ overall.pct }}%
          </p>
        </div>
      </div>
      <!-- Filet de progression global -->
      <div class="mt-5 h-px w-full bg-base-content/15">
        <div
          class="h-px bg-primary"
          :style="{ width: overall.pct + '%' }"
        ></div>
      </div>
    </section>

    <!-- ── PAR EXTENSION ── -->
    <section>
      <p class="section-rule eyebrow">Par extension</p>
      <div class="mt-4 border-t border-base-content/15">
        <article
          v-for="row in byExtension"
          :key="row.name"
          class="grid grid-cols-[1fr_auto] items-baseline gap-x-5 gap-y-2 border-b border-base-content/15 py-4"
        >
          <h3 class="font-display text-lg leading-tight">{{ row.name }}</h3>
          <p
            class="shrink-0 font-mono text-[12px] tabular text-base-content/60"
          >
            <span class="text-base-content">{{ row.pct }}%</span>
            <span class="text-base-content/30"> · </span>
            <span>{{ row.owned }}/{{ row.total }}</span>
            <span class="text-base-content/30"> · </span>
            <span
              >{{ row.missing }} manquante{{ row.missing > 1 ? "s" : "" }}</span
            >
          </p>
          <!-- Filet de progression 1px qui se remplit en cinabre -->
          <div class="col-span-2 h-px w-full bg-base-content/15">
            <div
              class="h-px bg-primary"
              :style="{ width: row.pct + '%' }"
            ></div>
          </div>
        </article>
        <p
          v-if="!byExtension.length"
          class="py-12 text-center font-mono text-[12px] uppercase text-base-content/45"
        >
          Catalogue non chargé.
        </p>
      </div>
    </section>

    <!-- ── PAR RARETÉ ── -->
    <section>
      <p class="section-rule eyebrow">Par rareté</p>
      <ul class="mt-4 border-t border-base-content/15">
        <li
          v-for="row in byRarity"
          :key="row.name"
          class="spine border-b border-base-content/15"
          :style="{ '--spine': row.color }"
        >
          <div class="flex items-baseline gap-3 py-2.5">
            <span class="font-mono text-[12px] uppercase tracking-wide">{{
              row.name
            }}</span>
            <span class="leader"></span>
            <span
              class="shrink-0 font-mono text-[12px] tabular text-base-content/60"
            >
              <span class="text-base-content">{{ row.pct }}%</span>
              <span class="text-base-content/30"> · </span>
              <span>{{ row.owned }}/{{ row.total }}</span>
            </span>
          </div>
        </li>
        <li
          v-if="!byRarity.length"
          class="py-12 text-center font-mono text-[12px] uppercase text-base-content/45"
        >
          Catalogue non chargé.
        </li>
      </ul>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useCardStore } from "@/stores/cardStore";
import { EXTENSION_LEVELS, RARITIES } from "@/config/cards";
import type { CardRarity } from "@/types/cards";

const cardStore = useCardStore();

// Encres élémentaires détournées en échelle de rareté (du plus commun au plus rare)
const rarityColors: Record<CardRarity, string> = {
  Commune: "#98A1AF",
  "Peu Commune": "#5FB22A",
  Rare: "#1F9CEC",
  Mythique: "#F0A62B",
  Légendaire: "#F04E22",
  Krosmaster: "#1A1714",
};

function isOwned(cardId: string): boolean {
  return (
    cardStore.getCardQuantity(cardId) + cardStore.getFoilCardQuantity(cardId) >
    0
  );
}

function pct(owned: number, total: number): number {
  return total > 0 ? Math.round((owned / total) * 100) : 0;
}

interface Bucket {
  owned: number;
  total: number;
}

// Agrégation en un seul passage sur le catalogue
const buckets = computed(() => {
  const extMap: Record<string, Bucket> = {};
  const rarMap: Record<string, Bucket> = {};
  let total = 0;
  let owned = 0;

  for (const card of cardStore.cards) {
    const has = isOwned(card.id);
    total += 1;
    if (has) owned += 1;

    const ext = card.extension?.name ?? "—";
    if (!extMap[ext]) extMap[ext] = { owned: 0, total: 0 };
    extMap[ext].total += 1;
    if (has) extMap[ext].owned += 1;

    const rar = card.rarity ?? "—";
    if (!rarMap[rar]) rarMap[rar] = { owned: 0, total: 0 };
    rarMap[rar].total += 1;
    if (has) rarMap[rar].owned += 1;
  }

  return { extMap, rarMap, total, owned };
});

const overall = computed(() => {
  const { total, owned } = buckets.value;
  return {
    total: total.toLocaleString("fr-FR"),
    owned: owned.toLocaleString("fr-FR"),
    missing: (total - owned).toLocaleString("fr-FR"),
    pct: pct(owned, total),
  };
});

const byExtension = computed(() => {
  const { extMap } = buckets.value;
  const order = Object.keys(EXTENSION_LEVELS) as string[];
  return Object.entries(extMap)
    .map(([name, b]) => ({
      name,
      owned: b.owned,
      total: b.total,
      missing: b.total - b.owned,
      pct: pct(b.owned, b.total),
    }))
    .sort((a, b) => {
      const ia = order.indexOf(a.name);
      const ib = order.indexOf(b.name);
      if (ia !== -1 && ib !== -1) return ia - ib;
      if (ia !== -1) return -1;
      if (ib !== -1) return 1;
      return a.name.localeCompare(b.name);
    });
});

const byRarity = computed(() => {
  const { rarMap } = buckets.value;
  const order = RARITIES as readonly string[];
  return Object.entries(rarMap)
    .map(([name, b]) => ({
      name,
      owned: b.owned,
      total: b.total,
      pct: pct(b.owned, b.total),
      color: rarityColors[name as CardRarity] ?? "#98A1AF",
    }))
    .sort((a, b) => {
      const ia = order.indexOf(a.name);
      const ib = order.indexOf(b.name);
      if (ia !== -1 && ib !== -1) return ia - ib;
      if (ia !== -1) return -1;
      if (ib !== -1) return 1;
      return a.name.localeCompare(b.name);
    });
});
</script>
