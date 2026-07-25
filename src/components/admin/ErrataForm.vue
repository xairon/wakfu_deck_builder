<template>
  <div>
    <div class="grid gap-4 sm:grid-cols-2">
      <label class="form-control">
        <span class="label-text">Carte</span>
        <!-- Mutation volontaire de modelValue (objet réactif partagé avec
             l'appelant) : cf. justification sur ErrataFormState ci-dessous. -->
        <!-- eslint-disable vue/no-mutating-props -->
        <input
          v-model="modelValue.card_id"
          list="admin-errata-cards"
          type="text"
          class="input input-bordered"
          data-testid="f-card"
          placeholder="Identifiant de carte"
        />
        <!-- eslint-enable vue/no-mutating-props -->
        <datalist id="admin-errata-cards">
          <option v-for="c in cards" :key="c.id" :value="c.id">
            {{ c.name }}
          </option>
        </datalist>
      </label>

      <label class="form-control">
        <span class="label-text">Date</span>
        <!-- Mutation volontaire de modelValue : cf. justification sur ErrataFormState ci-dessous. -->
        <!-- eslint-disable vue/no-mutating-props -->
        <input
          v-model="modelValue.errata_date"
          type="date"
          class="input input-bordered"
          data-testid="f-date"
        />
        <!-- eslint-enable vue/no-mutating-props -->
      </label>

      <label class="form-control">
        <span class="label-text">Source</span>
        <!-- Mutation volontaire de modelValue : cf. justification sur ErrataFormState ci-dessous. -->
        <!-- eslint-disable vue/no-mutating-props -->
        <input
          v-model="modelValue.source"
          type="text"
          class="input input-bordered"
          data-testid="f-source"
        />
        <!-- eslint-enable vue/no-mutating-props -->
      </label>

      <label class="form-control sm:col-span-2">
        <span class="label-text">Résumé *</span>
        <!-- Mutation volontaire de modelValue : cf. justification sur ErrataFormState ci-dessous. -->
        <!-- eslint-disable vue/no-mutating-props -->
        <input
          v-model="modelValue.summary"
          type="text"
          class="input input-bordered"
          data-testid="f-summary"
        />
        <!-- eslint-enable vue/no-mutating-props -->
      </label>

      <label class="form-control sm:col-span-2">
        <span class="label-text">Avant</span>
        <!-- Mutation volontaire de modelValue : cf. justification sur ErrataFormState ci-dessous. -->
        <!-- eslint-disable vue/no-mutating-props -->
        <textarea
          v-model="modelValue.before_text"
          class="textarea textarea-bordered"
          data-testid="f-before"
        ></textarea>
        <!-- eslint-enable vue/no-mutating-props -->
      </label>

      <label class="form-control sm:col-span-2">
        <span class="label-text">Après</span>
        <!-- Mutation volontaire de modelValue : cf. justification sur ErrataFormState ci-dessous. -->
        <!-- eslint-disable vue/no-mutating-props -->
        <textarea
          v-model="modelValue.after_text"
          class="textarea textarea-bordered"
          data-testid="f-after"
        ></textarea>
        <!-- eslint-enable vue/no-mutating-props -->
      </label>
    </div>

    <div class="mt-6">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <h3 class="text-sm font-semibold">Changements</h3>
        <button
          type="button"
          class="btn btn-sm"
          data-testid="add-change"
          @click="addChange"
        >
          Ajouter un changement
        </button>
      </div>
      <p class="mt-1 text-xs opacity-70">
        Optionnel. Renseigné, l'errata s'affiche champ par champ sur la fiche de
        la carte ; sinon c'est le résumé et l'avant/après qui s'affichent.
      </p>

      <div
        v-for="(change, j) in modelValue.changes"
        :key="j"
        class="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end"
      >
        <label class="form-control">
          <span class="label-text">Champ</span>
          <input
            v-model="change.label"
            type="text"
            class="input input-bordered input-sm"
            :data-testid="`change-label-${j}`"
          />
        </label>
        <label class="form-control">
          <span class="label-text">Avant</span>
          <input
            v-model="change.before"
            type="text"
            class="input input-bordered input-sm"
            :data-testid="`change-before-${j}`"
          />
        </label>
        <label class="form-control">
          <span class="label-text">Après</span>
          <input
            v-model="change.after"
            type="text"
            class="input input-bordered input-sm"
            :data-testid="`change-after-${j}`"
          />
        </label>
        <button
          type="button"
          class="btn btn-sm btn-ghost"
          :data-testid="`remove-change-${j}`"
          @click="removeChange(j)"
        >
          Retirer
        </button>
      </div>
    </div>

    <div class="mt-4 flex gap-2">
      <button
        type="button"
        class="btn btn-primary"
        data-testid="errata-submit"
        @click="emit('submit')"
      >
        Enregistrer
      </button>
      <button type="button" class="btn btn-ghost" @click="emit('cancel')">
        Annuler
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ErrataChange } from "@/schema";

/**
 * État édité par le formulaire — partagé par les deux points d'entrée
 * (écran d'admin `/admin/errata` et, à terme, la fiche de carte). Le
 * composant mute directement les propriétés de `modelValue` (même objet
 * réactif que l'appelant) : pas d'événement `update:modelValue` par champ.
 */
export interface ErrataFormState {
  id?: number;
  card_id: string;
  errata_date: string;
  source: string;
  summary: string;
  before_text: string;
  after_text: string;
  changes: ErrataChange[];
}

const props = defineProps<{
  modelValue: ErrataFormState;
  cards: { id: string; name: string }[];
}>();

const emit = defineEmits<{
  submit: [];
  cancel: [];
}>();

// Mutation volontaire de modelValue (objet réactif partagé avec l'appelant) :
// cf. justification sur ErrataFormState ci-dessus.
function addChange() {
  // eslint-disable-next-line vue/no-mutating-props
  props.modelValue.changes.push({ label: "", before: "", after: "" });
}

function removeChange(index: number) {
  // eslint-disable-next-line vue/no-mutating-props
  props.modelValue.changes.splice(index, 1);
}
</script>
