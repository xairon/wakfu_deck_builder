<template>
  <div class="mx-auto max-w-lg space-y-8">
    <header>
      <p class="eyebrow text-primary">Profil</p>
      <h1 class="mt-3 font-display text-4xl">Ton pseudo public</h1>
      <p class="mt-2 text-base-content/70">
        Ce pseudo s'affiche comme auteur sur les decks que tu publies dans la
        galerie communautaire (et, plus tard, en partie en ligne). Ton e-mail
        reste privé.
      </p>
    </header>

    <div class="space-y-4 border border-base-content/15 p-6">
      <label class="block">
        <span class="eyebrow">Pseudo</span>
        <input
          v-model="username"
          type="text"
          maxlength="24"
          placeholder="Ex. KareyDass62"
          class="input input-bordered mt-2 w-full bg-base-200"
          aria-label="Pseudo public"
          @keyup.enter="save"
        />
      </label>
      <p
        class="font-mono text-[11px] uppercase tracking-wider text-base-content/45"
      >
        2 à 24 caractères · visible publiquement
      </p>
      <button
        class="btn btn-primary"
        :disabled="saving || !dirty"
        @click="save"
      >
        {{ saving ? "Enregistrement…" : "Enregistrer" }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { getMyProfile, setUsername } from "@/services/profileService";
import { useToast } from "@/composables/useToast";

const toast = useToast();
const username = ref("");
const initial = ref("");
const saving = ref(false);
const dirty = computed(
  () =>
    username.value.trim() !== initial.value &&
    username.value.trim().length >= 2,
);

onMounted(async () => {
  const p = await getMyProfile();
  if (p) {
    username.value = p.username;
    initial.value = p.username;
  }
});

async function save(): Promise<void> {
  if (saving.value || !dirty.value) return;
  saving.value = true;
  const res = await setUsername(username.value);
  saving.value = false;
  if (res.ok) {
    initial.value = username.value.trim();
    toast.success("Pseudo enregistré.");
  } else {
    toast.error(res.error ?? "Enregistrement impossible.");
  }
}
</script>
