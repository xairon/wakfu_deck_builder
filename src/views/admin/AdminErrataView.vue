<template>
  <main class="container mx-auto px-4 py-8">
    <div class="flex flex-wrap items-center justify-between gap-4">
      <div>
        <h1 class="text-3xl font-bold">Errata (admin)</h1>
        <p class="mt-2 max-w-3xl opacity-80">
          Créer, modifier ou supprimer les corrections officielles. Toute
          écriture passe par la RLS : un refus affiche le message exact de la
          base.
        </p>
      </div>
      <button
        class="btn btn-primary"
        data-testid="new-errata"
        @click="openNewForm"
      >
        Ajouter
      </button>
    </div>

    <p
      v-if="reuseError"
      class="mt-6 rounded-lg bg-error/10 p-3 text-sm text-error"
      role="alert"
      data-testid="reuse-error"
    >
      {{ reuseError }}
    </p>

    <section
      v-if="formOpen"
      class="mt-6 rounded-lg border border-base-content/20 p-4"
    >
      <p
        v-if="reuseBanner"
        class="mb-4 rounded bg-info/10 p-3 text-sm"
        data-testid="reuse-banner"
      >
        {{ reuseBanner }}
      </p>

      <h2 class="text-lg font-semibold">
        {{ form.id != null ? "Modifier l'errata" : "Nouvel errata" }}
      </h2>

      <ErrataForm
        class="mt-4"
        :model-value="form"
        :cards="cardStore.cards"
        @submit="submit"
        @cancel="closeForm"
      />

      <p v-if="formError" class="mt-3 text-sm text-error" role="alert">
        {{ formError }}
      </p>
    </section>

    <p v-if="loading" class="mt-6 text-sm opacity-70">Chargement…</p>
    <ul v-else class="mt-8 space-y-4">
      <li
        v-for="item in items"
        :key="item.entry.id"
        class="flex gap-4 rounded-lg border border-base-content/20 p-4"
      >
        <img
          v-if="item.thumb"
          :src="item.thumb"
          :alt="item.name"
          class="h-24 w-auto flex-shrink-0 rounded"
          loading="lazy"
        />
        <div class="min-w-0 flex-1">
          <div class="flex items-baseline justify-between gap-3">
            <span class="font-semibold">{{ item.name }}</span>
            <span v-if="item.entry.errata_date" class="text-sm opacity-70">
              {{ item.entry.errata_date }}
            </span>
          </div>
          <p class="mt-1">{{ item.entry.summary }}</p>
          <p v-if="item.entry.source" class="mt-2 text-xs opacity-60">
            Source : {{ item.entry.source }}
          </p>
        </div>
        <div class="flex flex-shrink-0 items-start gap-2">
          <button
            class="btn btn-sm"
            :data-testid="`edit-${item.entry.id}`"
            @click="openEditForm(item.entry)"
          >
            Modifier
          </button>
          <button
            class="btn btn-sm btn-error"
            :data-testid="`delete-${item.entry.id}`"
            @click="askDelete(item.entry.id)"
          >
            Supprimer
          </button>
        </div>
      </li>
    </ul>
    <p v-if="!loading && items.length === 0" class="mt-6 text-sm opacity-70">
      Aucun errata.
    </p>

    <ConfirmDialog
      :open="confirmOpen"
      title="Supprimer cet errata ?"
      message="Cette action est définitive."
      confirm-label="Supprimer"
      danger
      @confirm="confirmDelete"
      @cancel="confirmOpen = false"
    />
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import {
  listErrataAdmin,
  createErratum,
  updateErratum,
  deleteErratum,
  type AdminErratum,
  type ErratumInput,
} from "@/services/adminService";
import { useCardStore } from "@/stores/cardStore";
import { useToast } from "@/composables/useToast";
import { getThumbPath } from "@/utils/imagePaths";
import ConfirmDialog from "@/components/common/ConfirmDialog.vue";
import ErrataForm, {
  type ErrataFormState,
} from "@/components/admin/ErrataForm.vue";
import { useReuseFromAudit } from "@/composables/useReuseFromAudit";
import type { ErrataChange } from "@/schema";

const cardStore = useCardStore();
const toast = useToast();

const errata = ref<AdminErratum[]>([]);
const loading = ref(true);

async function reload() {
  errata.value = await listErrataAdmin();
  loading.value = false;
}

onMounted(async () => {
  await reload();
  await consumeReuseParam();
});

interface Item {
  name: string;
  thumb: string | null;
  entry: AdminErratum;
}

const items = computed<Item[]>(() => {
  const byId = new Map(cardStore.cards.map((c) => [c.id, c]));
  return errata.value.map((entry) => {
    const card = byId.get(entry.card_id);
    return {
      name: card?.name ?? entry.card_id,
      thumb: card?.imageUrl ? getThumbPath(card.imageUrl) : null,
      entry,
    };
  });
});

// ── Formulaire ────────────────────────────────────────────────────────────
function emptyForm(): ErrataFormState {
  return {
    id: undefined,
    card_id: "",
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

function openNewForm() {
  Object.assign(form, emptyForm());
  reuseBanner.value = null;
  reuseError.value = null;
  formError.value = null;
  formOpen.value = true;
}

function openEditForm(entry: AdminErratum) {
  form.id = entry.id;
  reuseBanner.value = null;
  reuseError.value = null;
  form.card_id = entry.card_id;
  form.errata_date = entry.errata_date ?? "";
  form.source = entry.source ?? "";
  form.summary = entry.summary ?? "";
  form.before_text = entry.before_text ?? "";
  form.after_text = entry.after_text ?? "";
  form.changes = entry.changes ? entry.changes.map((c) => ({ ...c })) : [];
  formError.value = null;
  formOpen.value = true;
}

function closeForm() {
  formOpen.value = false;
  reuseBanner.value = null;
  reuseError.value = null;
  formError.value = null;
  Object.assign(form, emptyForm());
}

// ── Reprise d'une version du journal ──────────────────────────────────────
/** Chaîne sûre : un instantané JSONB peut contenir n'importe quel type. */
function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

const { reuseBanner, reuseError, consumeReuseParam } = useReuseFromAudit(
  "errata",
  (snap) => {
    Object.assign(form, emptyForm());
    const snapId = typeof snap.id === "number" ? snap.id : undefined;
    // Si l'errata a été supprimé depuis, on rouvre en CRÉATION : un update sur
    // un id disparu ne toucherait aucune ligne — sans erreur, l'admin croirait
    // avoir rétabli quelque chose.
    form.id =
      snapId != null && errata.value.some((e) => e.id === snapId)
        ? snapId
        : undefined;
    form.card_id = str(snap.card_id);
    form.errata_date = str(snap.errata_date);
    form.source = str(snap.source);
    form.summary = str(snap.summary);
    form.before_text = str(snap.before_text);
    form.after_text = str(snap.after_text);
    form.changes = Array.isArray(snap.changes)
      ? (snap.changes as unknown[])
          .filter(
            (c): c is Record<string, unknown> => !!c && typeof c === "object",
          )
          .map<ErrataChange>((c) => ({
            label: str(c.label),
            before: str(c.before),
            after: str(c.after),
          }))
      : [];
    formError.value = null;
    formOpen.value = true;
  },
);

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
    closeForm();
    await reload();
  } else {
    const message = res.error ?? "Écriture refusée.";
    formError.value = message;
    toast.error(message);
  }
}

// ── Suppression ───────────────────────────────────────────────────────────
const confirmOpen = ref(false);
const deleteTargetId = ref<number | null>(null);

function askDelete(id: number) {
  deleteTargetId.value = id;
  confirmOpen.value = true;
}

async function confirmDelete() {
  confirmOpen.value = false;
  const id = deleteTargetId.value;
  deleteTargetId.value = null;
  if (id == null) return;

  const res = await deleteErratum(id);
  if (res.ok) {
    toast.success("Errata supprimé.");
    await reload();
  } else {
    toast.error(res.error ?? "Suppression refusée.");
  }
}
</script>
