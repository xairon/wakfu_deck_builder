<template>
  <div v-if="errata.length || canEdit" class="mt-4" data-testid="errata-panel">
    <div class="mb-2 flex flex-wrap items-center justify-between gap-2">
      <p class="eyebrow text-primary">Errata officiel</p>
      <div v-if="canEdit" class="flex items-center gap-3">
        <button
          type="button"
          class="btn btn-ghost btn-xs"
          data-testid="edit-errata"
          @click="openForm"
        >
          {{ errata.length ? "Éditer l'errata" : "Ajouter un errata" }}
        </button>
        <RouterLink
          to="/admin/journal"
          class="link text-xs opacity-70"
          data-testid="errata-history"
          >historique</RouterLink
        >
      </div>
    </div>

    <div
      v-for="(e, i) in errata"
      :key="i"
      class="border-l-2 border-primary bg-primary/5 p-3"
      :class="i > 0 ? 'mt-2' : ''"
    >
      <p class="text-sm leading-relaxed">{{ e.summary }}</p>

      <!-- Structuré : on montre précisément quel champ a changé. -->
      <table v-if="visibleChanges(e).length" class="mt-2 w-full text-xs">
        <thead>
          <tr class="text-left text-base-content/50">
            <th class="pr-3 font-normal">Champ</th>
            <th class="pr-3 font-normal">Version imprimée</th>
            <th class="font-normal">À jouer</th>
          </tr>
        </thead>
        <tbody class="font-mono">
          <tr v-for="(c, j) in visibleChanges(e)" :key="j">
            <td class="pr-3 align-top">{{ c.label }}</td>
            <td class="pr-3 align-top text-base-content/50 line-through">
              {{ c.before }}
            </td>
            <td class="align-top font-bold">{{ c.after }}</td>
          </tr>
        </tbody>
      </table>

      <!-- Non structuré : repli sur la prose (état des errata pas encore saisis). -->
      <p v-else-if="e.before || e.after" class="mt-1 font-mono text-xs">
        <span v-if="e.before" class="text-base-content/50 line-through">{{
          e.before
        }}</span>
        <span v-if="e.before && e.after"> → </span>
        <span v-if="e.after" class="text-base-content">{{ e.after }}</span>
      </p>

      <p
        class="mt-1.5 font-mono text-[10px] uppercase tracking-wider text-base-content/45"
      >
        {{ formatFrenchDate(e.date)
        }}<span v-if="e.source"> · {{ e.source }}</span>
      </p>
    </div>

    <!-- Édition en place : ouvre le formulaire partagé avec /admin/errata.
         `canEdit` ne gouverne que l'AFFICHAGE de cette affordance — la RLS
         refuse réellement l'écriture côté base si l'utilisateur n'a pas les
         droits, ce n'est donc pas la protection. -->
    <section
      v-if="formOpen"
      class="mt-3 border border-base-content/20 p-3"
      data-testid="errata-edit-form"
    >
      <ErrataForm
        :model-value="form"
        :cards="cardStore.cards"
        @submit="submit"
        @cancel="closeForm"
      />
      <p v-if="formError" class="mt-2 text-sm text-error" role="alert">
        {{ formError }}
      </p>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import type { ErrataEntry } from "@/services/errataService";
import { formatFrenchDate } from "@/utils/date";
import { useAuthStore } from "@/stores/authStore";
import { useCardStore } from "@/stores/cardStore";
import { useToast } from "@/composables/useToast";
import {
  listErrataAdmin,
  createErratum,
  updateErratum,
  type ErratumInput,
} from "@/services/adminService";
import ErrataForm, {
  type ErrataFormState,
} from "@/components/admin/ErrataForm.vue";

const props = defineProps<{
  errata: ErrataEntry[];
  /** Fournie ET admin → affiche l'affordance d'édition en place. */
  cardId?: string;
}>();

/**
 * Émis après une écriture RÉUSSIE (création ou mise à jour). La prop `errata`
 * est possédée par le parent (`CollectionView`/`CardZoomModal`, via
 * `fetchErrata`) : ce composant ne peut pas se rafraîchir lui-même, il ne
 * fait que prévenir que la base a changé. Le parent doit re-fetch sur cet
 * événement, sinon le panneau reste affiché avec le contenu périmé jusqu'à
 * ce que l'utilisateur re-sélectionne la carte.
 */
const emit = defineEmits<{ saved: [] }>();

const authStore = useAuthStore();
const cardStore = useCardStore();
const toast = useToast();

/**
 * Affichage uniquement — la sécurité réelle est la RLS côté serveur (comme
 * partout ailleurs dans l'admin, cf. `authStore.isAdmin`). Un utilisateur qui
 * forcerait cette condition à `true` obtiendrait le même refus de la base
 * qu'en appelant l'API à la main.
 */
const canEdit = computed(() => !!props.cardId && authStore.isAdmin);

/**
 * Une ligne sans libellé n'est pas affichable (colonne « Champ » vide) : on
 * l'écarte plutôt que de rendre une ligne muette. Jamais d'exception — un
 * errata mal saisi ne doit pas casser la fiche de carte.
 */
function visibleChanges(e: ErrataEntry) {
  return (e.changes ?? []).filter((c) => c?.label?.trim());
}

// ── Édition en place ───────────────────────────────────────────────────────
function emptyForm(): ErrataFormState {
  return {
    id: undefined,
    card_id: props.cardId ?? "",
    errata_date: "",
    source: "",
    summary: "",
    before_text: "",
    after_text: "",
    changes: [],
  };
}

const form = reactive<ErrataFormState>(emptyForm());
const formOpen = ref(false);
const formError = ref<string | null>(null);

/**
 * Le type public `ErrataEntry` ne porte pas l'`id` (clé nécessaire pour
 * distinguer création/mise à jour) : on va le chercher via `listErrataAdmin`
 * à l'ouverture, en filtrant sur `card_id`.
 */
async function openForm() {
  formError.value = null;
  const rows = props.cardId ? await listErrataAdmin() : [];
  // Hypothèse actuelle : au plus un erratum par carte (vérifié — 66 cartes /
  // 66 errata). Le rendu ci-dessus boucle sur TOUS les `errata` de la carte ;
  // cette édition ne cible que le premier. À corriger (choix de la ligne à
  // éditer) le jour où une carte a plusieurs errata.
  const existing = rows.find((r) => r.card_id === props.cardId);

  if (existing) {
    form.id = existing.id;
    form.card_id = existing.card_id;
    form.errata_date = existing.errata_date ?? "";
    form.source = existing.source ?? "";
    form.summary = existing.summary ?? "";
    form.before_text = existing.before_text ?? "";
    form.after_text = existing.after_text ?? "";
    form.changes = existing.changes
      ? existing.changes.map((c) => ({ ...c }))
      : [];
  } else {
    Object.assign(form, emptyForm());
  }

  formOpen.value = true;
}

function closeForm() {
  formOpen.value = false;
  formError.value = null;
  Object.assign(form, emptyForm());
}

async function submit() {
  const summary = form.summary.trim();
  if (!summary) {
    formError.value = "Le résumé est obligatoire.";
    return;
  }

  const payload: ErratumInput = {
    card_id: form.card_id,
    errata_date: form.errata_date || null,
    source: form.source || null,
    summary,
    before_text: form.before_text || null,
    after_text: form.after_text || null,
    changes: form.changes,
  };

  const res =
    form.id != null
      ? await updateErratum(form.id, payload)
      : await createErratum(payload);

  if (res.ok) {
    toast.success("Errata enregistré.");
    // Le cache module (errataService) est déjà rafraîchi par
    // createErratum/updateErratum (adminService) — pas la peine de le
    // refaire ici. `saved` prévient le parent que SA copie (la prop
    // `errata`) doit être re-fetchée.
    emit("saved");
    closeForm();
  } else {
    // Refus (RLS ou autre) : le formulaire reste ouvert avec la saisie
    // conservée — règle en vigueur sur tous les écrans d'admin de ce projet.
    const message = res.error ?? "Écriture refusée.";
    formError.value = message;
    toast.error(message);
  }
}
</script>
