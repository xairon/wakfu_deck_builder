<template>
  <main class="container mx-auto px-4 py-8">
    <h1 class="text-3xl font-bold">Comptes</h1>
    <p class="mt-2 max-w-3xl opacity-80">
      Attribution du rôle admin. Cet écran ne fait qu'appeler la RPC
      <code>set_user_role</code> : c'est elle qui décide (owner uniquement,
      jamais sur un owner) — un refus affiche son message exact.
    </p>

    <p v-if="loading" class="mt-6 text-sm opacity-70">Chargement…</p>
    <ul v-else class="mt-8 space-y-3">
      <li
        v-for="profile in profiles"
        :key="profile.user_id"
        class="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-base-content/20 p-4"
        :data-testid="`profile-${profile.user_id}`"
      >
        <div>
          <span class="font-semibold">{{ profile.username }}</span>
          <span class="ml-3 text-sm opacity-70">{{
            roleLabel(profile.role)
          }}</span>
        </div>
        <button
          v-if="profile.role === 'user'"
          class="btn btn-sm btn-primary"
          :data-testid="`promote-${profile.user_id}`"
          @click="askPromote(profile)"
        >
          Promouvoir admin
        </button>
        <button
          v-else-if="profile.role === 'admin'"
          class="btn btn-sm"
          :data-testid="`demote-${profile.user_id}`"
          @click="askDemote(profile)"
        >
          Rétrograder
        </button>
        <!-- owner : aucune action — la RPC refuse de toucher un owner -->
      </li>
    </ul>
    <p v-if="!loading && profiles.length === 0" class="mt-6 text-sm opacity-70">
      Aucun compte.
    </p>

    <ConfirmDialog
      :open="confirmOpen"
      :title="confirmTitle"
      :confirm-label="pendingRole === 'admin' ? 'Promouvoir' : 'Rétrograder'"
      :danger="pendingRole === 'admin'"
      @confirm="confirmAction"
      @cancel="cancelAction"
    />
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { listProfiles, setUserRole } from "@/services/adminService";
import { useToast } from "@/composables/useToast";
import ConfirmDialog from "@/components/common/ConfirmDialog.vue";

interface Profile {
  user_id: string;
  username: string;
  role: "user" | "admin" | "owner";
}

const toast = useToast();

const profiles = ref<Profile[]>([]);
const loading = ref(true);

async function reload() {
  profiles.value = await listProfiles();
  loading.value = false;
}

onMounted(reload);

const roleLabels: Record<Profile["role"], string> = {
  user: "Utilisateur",
  admin: "Administrateur",
  owner: "Propriétaire",
};
function roleLabel(role: Profile["role"]): string {
  return roleLabels[role] ?? role;
}

// ── Confirmation ──────────────────────────────────────────────────────────
// `pendingRole` n'est jamais "owner" : ce rôle n'est jamais proposé (il se
// pose à la main en SQL, par design — cf. CLAUDE.md).
const confirmOpen = ref(false);
const pendingTarget = ref<Profile | null>(null);
const pendingRole = ref<"user" | "admin" | null>(null);

const confirmTitle = computed(() => {
  const name = pendingTarget.value?.username ?? "";
  return pendingRole.value === "admin"
    ? `Promouvoir ${name} administrateur ?`
    : `Rétrograder ${name} en utilisateur ?`;
});

function askPromote(profile: Profile) {
  pendingTarget.value = profile;
  pendingRole.value = "admin";
  confirmOpen.value = true;
}

function askDemote(profile: Profile) {
  pendingTarget.value = profile;
  pendingRole.value = "user";
  confirmOpen.value = true;
}

function cancelAction() {
  confirmOpen.value = false;
  pendingTarget.value = null;
  pendingRole.value = null;
}

async function confirmAction() {
  confirmOpen.value = false;
  const target = pendingTarget.value;
  const role = pendingRole.value;
  pendingTarget.value = null;
  pendingRole.value = null;
  if (!target || !role) return;

  const res = await setUserRole(target.user_id, role);
  if (res.ok) {
    toast.success(
      role === "admin"
        ? `${target.username} est désormais administrateur.`
        : `${target.username} est redevenu utilisateur.`,
    );
    await reload();
  } else {
    toast.error(res.error ?? "Action refusée.");
  }
}
</script>
