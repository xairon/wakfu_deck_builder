<template>
  <main class="container mx-auto px-4 py-8">
    <div class="flex flex-wrap items-center justify-between gap-4">
      <div>
        <h1 class="text-3xl font-bold">Règles (admin)</h1>
        <p class="mt-2 max-w-3xl opacity-80">
          Corriger le texte d'une règle, en ajouter une manquante, ou rétablir
          le texte officiel. Toute écriture passe par la RLS : un refus affiche
          le message exact de la base.
        </p>
      </div>
      <button
        class="btn btn-primary"
        data-testid="new-rule"
        @click="openNewForm"
      >
        Ajouter une règle
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
    <p
      v-if="reuseBanner"
      class="mt-6 rounded-lg bg-info/10 p-3 text-sm"
      data-testid="reuse-banner"
    >
      {{ reuseBanner }}
    </p>

    <section
      v-if="newFormOpen"
      class="mt-6 rounded-lg border border-base-content/20 p-4"
    >
      <h2 class="text-lg font-semibold">Nouvelle règle</h2>

      <div class="mt-4 grid gap-4 sm:grid-cols-2">
        <label class="form-control">
          <span class="label-text">Numéro *</span>
          <input
            v-model="newForm.number"
            type="text"
            class="input input-bordered"
            data-testid="f-number"
            placeholder="ex. 418.5c"
          />
        </label>

        <label class="form-control">
          <span class="label-text">Chapitre *</span>
          <input
            v-model.number="newForm.chapter"
            type="number"
            min="1"
            max="8"
            class="input input-bordered"
            data-testid="f-chapter"
          />
        </label>

        <label class="form-control sm:col-span-2">
          <span class="label-text">Texte *</span>
          <textarea
            v-model="newForm.body"
            class="textarea textarea-bordered"
            data-testid="f-body"
          ></textarea>
        </label>
      </div>

      <p v-if="newFormError" class="mt-3 text-sm text-error" role="alert">
        {{ newFormError }}
      </p>

      <div class="mt-4 flex gap-2">
        <button
          class="btn btn-primary"
          data-testid="add-rule-submit"
          @click="submitNewRule"
        >
          Enregistrer
        </button>
        <button class="btn btn-ghost" @click="closeNewForm">Annuler</button>
      </div>
    </section>

    <input
      v-model="query"
      type="search"
      class="input input-bordered mt-6 w-full max-w-md"
      placeholder="Rechercher dans les règles…"
      aria-label="Rechercher dans les règles"
    />

    <p v-if="loading" class="mt-6 text-sm opacity-70">Chargement…</p>

    <div
      v-for="row in visible"
      :key="row.number"
      :id="row.number"
      class="mt-4 scroll-mt-24"
    >
      <h2 v-if="row.kind === 'chapter'" class="mt-8 text-2xl font-bold">
        {{ row.number }}. {{ row.title }}
      </h2>
      <h3 v-else-if="row.kind === 'section'" class="mt-6 text-xl font-semibold">
        {{ row.number }}. {{ row.title }}
      </h3>
      <div v-else class="rounded-lg border border-base-content/10 p-3">
        <p class="leading-relaxed">
          <span class="font-mono text-sm opacity-70">{{ row.number }}</span>
          {{ row.body }}
          <span v-if="row.is_edited" class="badge badge-sm badge-info ml-2">{{
            row.body_official != null ? "Corrigée" : "Ajoutée"
          }}</span>
        </p>

        <p
          v-if="row.is_edited && row.body_official != null"
          class="mt-2 text-sm opacity-70"
        >
          <span class="font-semibold">Texte officiel :</span>
          {{ row.body_official }}
        </p>

        <div class="mt-2 flex flex-wrap gap-2">
          <button
            class="btn btn-sm"
            :data-testid="`edit-${row.number}`"
            @click="openEditForm(row)"
          >
            Corriger
          </button>
          <button
            v-if="row.is_edited && row.body_official != null"
            class="btn btn-sm btn-error"
            :data-testid="`restore-${row.number}`"
            @click="askRestore(row.number)"
          >
            Rétablir l'officiel
          </button>
        </div>

        <div v-if="editing === row.number" class="mt-3">
          <textarea
            v-model="editBody"
            class="textarea textarea-bordered w-full"
            :data-testid="`body-${row.number}`"
          ></textarea>
          <p v-if="editError" class="mt-2 text-sm text-error" role="alert">
            {{ editError }}
          </p>
          <div class="mt-2 flex gap-2">
            <button
              class="btn btn-sm btn-primary"
              :data-testid="`save-${row.number}`"
              @click="saveEdit(row)"
            >
              Enregistrer
            </button>
            <button class="btn btn-sm btn-ghost" @click="cancelEdit">
              Annuler
            </button>
          </div>
        </div>
      </div>
    </div>
    <p v-if="!loading && visible.length === 0" class="mt-6 text-sm opacity-70">
      Aucune règle.
    </p>

    <ConfirmDialog
      :open="confirmOpen"
      title="Rétablir le texte officiel ?"
      message="La correction sera supprimée ; le texte importé reprendra sa place."
      confirm-label="Rétablir"
      danger
      @confirm="confirmRestore"
      @cancel="confirmOpen = false"
    />
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { loadRules, getRules } from "@/services/rulesService";
import {
  upsertRuleOverride,
  deleteRuleOverride,
} from "@/services/adminService";
import { useReuseFromAudit } from "@/composables/useReuseFromAudit";
import { useToast } from "@/composables/useToast";
import { matchesSearch } from "@/utils/text";
import ConfirmDialog from "@/components/common/ConfirmDialog.vue";
import type { RuleEffectiveRow } from "@/schema";

const toast = useToast();

const query = ref("");
const rows = ref<RuleEffectiveRow[]>(getRules());
const loading = ref(true);

async function reload() {
  rows.value = await loadRules();
  loading.value = false;
}

onMounted(async () => {
  await reload();
  await consumeReuseParam();
});

const visible = computed(() =>
  query.value
    ? rows.value.filter((r) =>
        matchesSearch(
          `${r.number} ${r.title ?? ""} ${r.body ?? ""}`,
          query.value,
        ),
      )
    : rows.value,
);

// ── Correction inline ────────────────────────────────────────────────────
const editing = ref<string | null>(null);
const editBody = ref("");
const editError = ref<string | null>(null);

function openEditForm(row: RuleEffectiveRow) {
  editing.value = row.number;
  reuseBanner.value = null;
  reuseError.value = null;
  editBody.value = row.body ?? "";
  editError.value = null;
}

function cancelEdit() {
  editing.value = null;
  editBody.value = "";
  editError.value = null;
}

async function saveEdit(row: RuleEffectiveRow) {
  const body = editBody.value.trim();
  if (!body) {
    editError.value = "Le texte ne peut pas être vide.";
    return;
  }
  // `sort_order`/`kind` : l'override reprend TOUJOURS les valeurs actuelles
  // de la ligne (déjà fusionnée par `rules_effective`). Les omettre enverrait
  // les défauts de `rules_overrides` (sort_order 0) au lieu de la valeur en
  // vigueur — la correction gagne le coalesce et la règle saute en tête de
  // la page publique.
  const res = await upsertRuleOverride({
    number: row.number,
    chapter: row.chapter,
    kind: row.kind,
    body,
    sort_order: row.sort_order,
  });
  if (res.ok) {
    toast.success("Règle enregistrée.");
    cancelEdit();
    await reload();
  } else {
    const message = res.error ?? "Écriture refusée.";
    editError.value = message;
    toast.error(message);
  }
}

// ── Rétablir l'officiel ──────────────────────────────────────────────────
const confirmOpen = ref(false);
const restoreTarget = ref<string | null>(null);

function askRestore(number: string) {
  restoreTarget.value = number;
  confirmOpen.value = true;
}

async function confirmRestore() {
  confirmOpen.value = false;
  const number = restoreTarget.value;
  restoreTarget.value = null;
  if (number == null) return;

  const res = await deleteRuleOverride(number);
  if (res.ok) {
    toast.success("Texte officiel rétabli.");
    await reload();
  } else {
    toast.error(res.error ?? "Rétablissement refusé.");
  }
}

// ── Ajouter une règle ─────────────────────────────────────────────────────
interface NewRuleForm {
  number: string;
  chapter: number | null;
  body: string;
}

function emptyNewForm(): NewRuleForm {
  return { number: "", chapter: null, body: "" };
}

const newForm = reactive<NewRuleForm>(emptyNewForm());
const newFormOpen = ref(false);
const newFormError = ref<string | null>(null);

function openNewForm() {
  Object.assign(newForm, emptyNewForm());
  reuseBanner.value = null;
  reuseError.value = null;
  newFormError.value = null;
  newFormOpen.value = true;
}

function closeNewForm() {
  newFormOpen.value = false;
  newFormError.value = null;
  Object.assign(newForm, emptyNewForm());
}

/**
 * `sort_order` de la règle qui précède `number` dans l'ordre de lecture
 * actuellement chargé (`rows.value`, déjà trié par sort_order puis number).
 * Une règle AJOUTÉE reprend ce même sort_order : le tri secondaire par
 * `number` la range juste après sa devancière, sans renuméroter le reste.
 */
function predecessorSortOrder(number: string): number {
  let sortOrder = 0;
  for (const row of rows.value) {
    if (row.number < number) {
      sortOrder = row.sort_order;
    } else {
      break;
    }
  }
  return sortOrder;
}

async function submitNewRule() {
  const number = newForm.number.trim();
  const body = newForm.body.trim();
  if (!number || !body || newForm.chapter == null) {
    newFormError.value = "Numéro, chapitre et texte sont obligatoires.";
    return;
  }

  const res = await upsertRuleOverride({
    number,
    chapter: newForm.chapter,
    body,
    sort_order: predecessorSortOrder(number),
  });
  if (res.ok) {
    toast.success("Règle ajoutée.");
    closeNewForm();
    await reload();
  } else {
    const message = res.error ?? "Écriture refusée.";
    newFormError.value = message;
    toast.error(message);
  }
}

// ── Reprise d'une version du journal ──────────────────────────────────────
/** Chaîne sûre : un instantané JSONB peut contenir n'importe quel type. */
function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

const { reuseBanner, reuseError, consumeReuseParam } = useReuseFromAudit(
  "rule_override",
  (snap) => {
    const number = str(snap.number);
    const body = str(snap.body);
    if (rows.value.some((r) => r.number === number)) {
      // La règle est toujours là : éditeur inline, comme un clic sur Modifier.
      closeNewForm();
      editing.value = number;
      editBody.value = body;
      editError.value = null;
      return;
    }
    // Règle ajoutée puis rétablie : plus aucune ligne où ouvrir l'éditeur
    // inline — on bascule sur le formulaire d'ajout, qui recréera l'override.
    cancelEdit();
    Object.assign(newForm, emptyNewForm());
    newForm.number = number;
    newForm.chapter = typeof snap.chapter === "number" ? snap.chapter : null;
    newForm.body = body;
    newFormError.value = null;
    newFormOpen.value = true;
  },
);
</script>
