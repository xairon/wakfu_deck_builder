<template>
  <main class="container mx-auto px-4 py-8">
    <h1 class="text-3xl font-bold">Journal (admin)</h1>
    <p class="mt-2 max-w-3xl opacity-80">
      Journal en lecture seule : les entrées sont écrites par des déclencheurs
      de base de données, jamais par cet écran. « Système » désigne une écriture
      sans utilisateur authentifié (ex. seed initial).
    </p>

    <div class="mt-6 flex flex-wrap gap-4">
      <label class="form-control">
        <span class="label-text">Entité</span>
        <select
          v-model="entityFilter"
          class="select select-bordered"
          data-testid="filter-entity"
        >
          <option value="all">Toutes</option>
          <option value="rule_override">Règle (correction)</option>
          <option value="errata">Errata</option>
          <option value="role">Rôle</option>
        </select>
      </label>

      <label class="form-control">
        <span class="label-text">Auteur</span>
        <select
          v-model="authorFilter"
          class="select select-bordered"
          data-testid="filter-author"
        >
          <option value="all">Tous</option>
          <option
            v-for="opt in authorOptions"
            :key="opt.value"
            :value="opt.value"
          >
            {{ opt.label }}
          </option>
        </select>
      </label>
    </div>

    <p v-if="loading" class="mt-6 text-sm opacity-70">Chargement…</p>
    <template v-else>
      <ul class="mt-8 space-y-4">
        <li
          v-for="entry in filteredEntries"
          :key="entry.id"
          class="rounded-lg border border-base-content/20 p-4"
          :data-testid="`audit-row-${entry.id}`"
        >
          <div class="flex flex-wrap items-baseline justify-between gap-3">
            <span class="font-semibold">{{ actorLabel(entry.actor) }}</span>
            <span class="text-sm opacity-70">{{
              formatTimestamp(entry.created_at)
            }}</span>
          </div>
          <p class="mt-1 text-sm">
            <span class="font-medium">{{ actionLabel(entry.action) }}</span>
            —
            <span>{{ entityLabel(entry.entity) }}</span>
            —
            <code class="opacity-80">{{ entry.entity_key }}</code>
          </p>
          <details class="mt-2 text-xs">
            <summary class="cursor-pointer opacity-70">Avant / après</summary>
            <div class="mt-2 grid gap-3 sm:grid-cols-2">
              <div>
                <p class="font-medium opacity-70">Avant</p>
                <pre class="mt-1 overflow-x-auto rounded bg-base-200 p-2">{{
                  JSON.stringify(entry.before_data ?? null, null, 2)
                }}</pre>
              </div>
              <div>
                <p class="font-medium opacity-70">Après</p>
                <pre class="mt-1 overflow-x-auto rounded bg-base-200 p-2">{{
                  JSON.stringify(entry.after_data ?? null, null, 2)
                }}</pre>
              </div>
            </div>
          </details>
        </li>
      </ul>
      <p v-if="filteredEntries.length === 0" class="mt-6 text-sm opacity-70">
        Aucune entrée.
      </p>
    </template>
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { listAudit, listProfiles } from "@/services/adminService";
import type { AuditRow } from "@/schema";

const SYSTEM = "__system__";

const entries = ref<AuditRow[]>([]);
const profiles = ref<{ user_id: string; username: string }[]>([]);
const loading = ref(true);

async function reload() {
  const [auditRows, profileRows] = await Promise.all([
    listAudit(),
    listProfiles(),
  ]);
  entries.value = auditRows;
  profiles.value = profileRows;
  loading.value = false;
}

onMounted(reload);

const pseudoByActor = computed(() => {
  const map = new Map<string, string>();
  for (const p of profiles.value) map.set(p.user_id, p.username);
  return map;
});

function actorLabel(actor: string | null | undefined): string {
  if (actor === null || actor === undefined) return "système";
  return pseudoByActor.value.get(actor) ?? actor;
}

const actionLabels: Record<AuditRow["action"], string> = {
  create: "Création",
  update: "Modification",
  delete: "Suppression",
};
function actionLabel(action: AuditRow["action"]): string {
  return actionLabels[action] ?? action;
}

const entityLabels: Record<AuditRow["entity"], string> = {
  rule_override: "Règle (correction)",
  errata: "Errata",
  role: "Rôle",
};
function entityLabel(entity: AuditRow["entity"]): string {
  return entityLabels[entity] ?? entity;
}

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("fr-FR");
}

// ── Filtres (client-side, sur la liste déjà chargée) ────────────────────
const entityFilter = ref<"all" | AuditRow["entity"]>("all");
const authorFilter = ref<string>("all");

const authorOptions = computed(() => {
  const seen = new Map<string, string>();
  for (const entry of entries.value) {
    const value = entry.actor ?? SYSTEM;
    if (!seen.has(value)) seen.set(value, actorLabel(entry.actor));
  }
  return Array.from(seen, ([value, label]) => ({ value, label })).sort((a, b) =>
    a.label.localeCompare(b.label, "fr"),
  );
});

const filteredEntries = computed(() => {
  return entries.value.filter((entry) => {
    if (entityFilter.value !== "all" && entry.entity !== entityFilter.value) {
      return false;
    }
    if (authorFilter.value !== "all") {
      const value = entry.actor ?? SYSTEM;
      if (value !== authorFilter.value) return false;
    }
    return true;
  });
});
</script>
