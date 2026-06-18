<template>
  <div class="flex min-h-[78vh] items-center justify-center">
    <div class="w-full max-w-md animate-fadeIn">
      <!-- ── PAGE DE TITRE RELIÉE ── -->
      <div class="text-center">
        <p class="eyebrow text-primary">L'Almanach des Douze</p>
        <div class="mt-4 border-t border-base-content"></div>
        <h1 class="py-5 font-display text-4xl sm:text-5xl">
          Grimoire —
          {{
            authStore.passwordRecovery
              ? "Nouveau mot de passe"
              : activeTab === "login"
                ? "Connexion"
                : "Inscription"
          }}
        </h1>
        <div class="border-t border-base-content"></div>
        <p class="mt-4 text-base-content/65">
          Connectez-vous pour retrouver votre registre.
        </p>
      </div>

      <!-- Onglets : texte, soulignement cinabre actif (comme le masthead) -->
      <div
        v-if="!authStore.passwordRecovery"
        class="mt-8 flex justify-center gap-8 border-b border-base-content/15 pb-px"
      >
        <button
          type="button"
          class="border-b-2 pb-1 font-display text-xl transition-colors"
          :class="
            activeTab === 'login'
              ? 'border-primary text-base-content'
              : 'border-transparent text-base-content/55 hover:text-base-content'
          "
          @click="activeTab = 'login'"
          aria-label="Onglet connexion"
        >
          Connexion
        </button>
        <button
          type="button"
          class="border-b-2 pb-1 font-display text-xl transition-colors"
          :class="
            activeTab === 'register'
              ? 'border-primary text-base-content'
              : 'border-transparent text-base-content/55 hover:text-base-content'
          "
          @click="activeTab = 'register'"
          aria-label="Onglet inscription"
        >
          Inscription
        </button>
      </div>

      <!-- Bande d'erreur : filet cinabre de 2px à gauche -->
      <div
        v-if="errorMessage"
        class="mt-6 border-l-2 border-primary bg-base-200 px-4 py-3"
        role="alert"
      >
        <p class="eyebrow text-primary">Erreur</p>
        <p class="mt-1 text-sm text-base-content/80">{{ errorMessage }}</p>
      </div>

      <!-- Bande de succès : filet vert de 2px à gauche -->
      <div
        v-if="successMessage"
        class="mt-6 border-l-2 border-success bg-base-200 px-4 py-3"
        role="alert"
      >
        <p class="eyebrow text-success">Confirmation</p>
        <p class="mt-1 text-sm text-base-content/80">{{ successMessage }}</p>
      </div>

      <!-- Formulaire : nouveau mot de passe (retour du lien de réinitialisation) -->
      <form
        v-if="authStore.passwordRecovery"
        @submit.prevent="handleUpdatePassword"
        class="mt-6 space-y-5"
      >
        <p class="text-sm text-base-content/70">
          Choisissez votre nouveau mot de passe pour finaliser la
          réinitialisation.
        </p>
        <div class="form-control">
          <label class="eyebrow mb-1.5 block" for="new-password">
            Nouveau mot de passe
          </label>
          <input
            id="new-password"
            v-model="newPassword"
            type="password"
            placeholder="Au moins 6 caractères"
            class="input input-bordered w-full"
            required
            autocomplete="new-password"
            aria-required="true"
          />
        </div>
        <div class="form-control">
          <label class="eyebrow mb-1.5 block" for="new-password-confirm">
            Confirmer le mot de passe
          </label>
          <input
            id="new-password-confirm"
            v-model="newPasswordConfirm"
            type="password"
            placeholder="Confirmez"
            class="input input-bordered w-full"
            required
            autocomplete="new-password"
            aria-required="true"
          />
        </div>
        <button
          type="submit"
          class="btn btn-primary w-full"
          :disabled="isLoading"
        >
          {{ isLoading ? "…" : "Mettre à jour le mot de passe" }}
        </button>
      </form>

      <!-- Formulaire de connexion -->
      <form
        v-if="!authStore.passwordRecovery && activeTab === 'login'"
        @submit.prevent="handleLogin"
        class="mt-6 space-y-5"
      >
        <div class="form-control">
          <label class="eyebrow mb-1.5 block" for="login-email">
            Adresse e-mail
          </label>
          <input
            id="login-email"
            v-model="email"
            type="email"
            placeholder="votre@email.com"
            class="input input-bordered w-full"
            required
            autocomplete="email"
            aria-required="true"
          />
        </div>

        <div class="form-control">
          <label class="eyebrow mb-1.5 block" for="login-password">
            Mot de passe
          </label>
          <input
            id="login-password"
            v-model="password"
            type="password"
            placeholder="Votre mot de passe"
            class="input input-bordered w-full"
            required
            minlength="6"
            autocomplete="current-password"
            aria-required="true"
          />
        </div>

        <button
          type="submit"
          class="btn btn-primary w-full"
          :disabled="isLoading"
        >
          <span
            v-if="isLoading"
            class="loading loading-spinner loading-sm mr-2"
          ></span>
          Se connecter
        </button>

        <div v-if="canResetPassword" class="text-center">
          <button
            type="button"
            class="font-mono text-[11px] uppercase tracking-wider text-base-content/55 underline-offset-4 hover:text-base-content hover:underline"
            @click="handleForgotPassword"
            :disabled="isLoading"
          >
            Mot de passe oublié ?
          </button>
        </div>
      </form>

      <!-- Formulaire d'inscription -->
      <form
        v-if="!authStore.passwordRecovery && activeTab === 'register'"
        @submit.prevent="handleRegister"
        class="mt-6 space-y-5"
      >
        <div class="form-control">
          <label class="eyebrow mb-1.5 block" for="register-email">
            Adresse e-mail
          </label>
          <input
            id="register-email"
            v-model="email"
            type="email"
            placeholder="votre@email.com"
            class="input input-bordered w-full"
            required
            autocomplete="email"
            aria-required="true"
          />
        </div>

        <div class="form-control">
          <label class="eyebrow mb-1.5 block" for="register-password">
            Mot de passe
          </label>
          <input
            id="register-password"
            v-model="password"
            type="password"
            placeholder="Minimum 6 caracteres"
            class="input input-bordered w-full"
            required
            minlength="6"
            autocomplete="new-password"
            aria-required="true"
          />
        </div>

        <div class="form-control">
          <label class="eyebrow mb-1.5 block" for="register-password-confirm">
            Confirmer le mot de passe
          </label>
          <input
            id="register-password-confirm"
            v-model="passwordConfirm"
            type="password"
            placeholder="Confirmez votre mot de passe"
            class="input input-bordered w-full"
            required
            minlength="6"
            autocomplete="new-password"
            aria-required="true"
          />
        </div>

        <button
          type="submit"
          class="btn btn-primary w-full"
          :disabled="isLoading"
        >
          <span
            v-if="isLoading"
            class="loading loading-spinner loading-sm mr-2"
          ></span>
          Creer un compte
        </button>
      </form>

      <!-- Note cloud -->
      <p class="mt-8 text-center text-xs leading-relaxed text-base-content/50">
        Vos données (collection et decks) sont synchronisées dans le cloud et
        accessibles depuis tous vos appareils.
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from "vue";
import { useRouter, useRoute } from "vue-router";
import { useAuthStore } from "@/stores/authStore";
import { useToast } from "@/composables/useToast";

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();
const toast = useToast();

// Application cloud-only : la réinitialisation par e-mail est toujours dispo.
const canResetPassword = true;

function goAfterAuth() {
  // En mode réinitialisation, on reste sur /auth pour saisir le nouveau mot de
  // passe au lieu de rediriger vers la collection.
  if (authStore.passwordRecovery) return;
  // N'accepte qu'un chemin interne ("/...") : empêche une redirection ouverte
  // (`//evil.com`, `https://evil.com`) injectée via le paramètre ?redirect=.
  const raw = route.query.redirect;
  const redirect =
    typeof raw === "string" && /^\/(?!\/)/.test(raw) ? raw : "/collection";
  router.push(redirect);
}

// Si l'utilisateur arrive déjà connecté, ou se connecte via un lien e-mail
// (la session est détectée de façon asynchrone), on redirige automatiquement.
onMounted(() => {
  if (authStore.isAuthenticated) goAfterAuth();
});
watch(
  () => authStore.isAuthenticated,
  (authed) => {
    if (authed) goAfterAuth();
  },
);

const activeTab = ref<"login" | "register">("login");
const email = ref("");
const password = ref("");
const passwordConfirm = ref("");
const isLoading = ref(false);
const errorMessage = ref<string | null>(null);
const successMessage = ref<string | null>(null);

function clearMessages() {
  errorMessage.value = null;
  successMessage.value = null;
}

/** Traduit les erreurs Supabase courantes en messages clairs en français. */
function friendlyAuthError(err: unknown): string {
  const raw = (
    err instanceof Error ? err.message : String(err ?? "")
  ).toLowerCase();
  if (raw.includes("rate limit") || raw.includes("too many"))
    return "Trop de tentatives pour le moment. Réessayez dans quelques minutes.";
  if (
    raw.includes("already registered") ||
    raw.includes("already exists") ||
    raw.includes("user already")
  )
    return "Un compte existe déjà avec cette adresse e-mail. Connectez-vous.";
  if (raw.includes("invalid login") || raw.includes("invalid credentials"))
    return "E-mail ou mot de passe incorrect.";
  if (raw.includes("email not confirmed") || raw.includes("not confirmed"))
    return "Compte non confirmé. Vérifiez votre e-mail (ou contactez l'administrateur).";
  if (raw.includes("invalid email") || raw.includes("unable to validate email"))
    return "Adresse e-mail invalide.";
  if (raw.includes("password") && raw.includes("least"))
    return "Le mot de passe doit contenir au moins 6 caractères.";
  if (raw.includes("network") || raw.includes("fetch"))
    return "Problème de connexion réseau. Vérifiez votre connexion et réessayez.";
  return err instanceof Error && err.message
    ? err.message
    : "Une erreur est survenue.";
}

async function handleLogin() {
  clearMessages();
  isLoading.value = true;

  try {
    await authStore.signIn(email.value, password.value);
    toast.success("Connexion réussie !");
    // La redirection est gérée par le watch isAuthenticated (source unique).
  } catch (err) {
    errorMessage.value = friendlyAuthError(err);
    toast.error("Échec de la connexion");
  } finally {
    isLoading.value = false;
  }
}

async function handleRegister() {
  clearMessages();

  if (password.value !== passwordConfirm.value) {
    errorMessage.value = "Les mots de passe ne correspondent pas";
    return;
  }

  if (password.value.length < 6) {
    errorMessage.value = "Le mot de passe doit contenir au moins 6 caracteres";
    return;
  }

  isLoading.value = true;

  try {
    const result = await authStore.signUp(email.value, password.value);

    if (result.needsEmailConfirmation) {
      // Mode cloud avec confirmation par e-mail requise.
      successMessage.value =
        "Compte créé ! Vérifiez votre e-mail pour confirmer votre inscription.";
      toast.success("Inscription réussie ! Vérifiez votre e-mail.");
      activeTab.value = "login";
      password.value = "";
      passwordConfirm.value = "";
    } else {
      // Cloud sans confirmation e-mail : connecté immédiatement.
      // La redirection est gérée par le watch isAuthenticated (source unique).
      toast.success("Compte créé, vous êtes connecté !");
    }
  } catch (err) {
    errorMessage.value = friendlyAuthError(err);
    toast.error("Échec de l'inscription");
  } finally {
    isLoading.value = false;
  }
}

async function handleForgotPassword() {
  clearMessages();

  if (!email.value) {
    errorMessage.value = "Veuillez entrer votre adresse e-mail";
    return;
  }

  isLoading.value = true;

  try {
    await authStore.resetPassword(email.value);
    successMessage.value = "Un e-mail de reinitialisation a ete envoye.";
    toast.success("E-mail de reinitialisation envoye");
  } catch (err) {
    errorMessage.value =
      err instanceof Error ? err.message : "Erreur lors de la reinitialisation";
  } finally {
    isLoading.value = false;
  }
}

// ── Définition du nouveau mot de passe (retour du lien de réinitialisation) ──
const newPassword = ref("");
const newPasswordConfirm = ref("");
async function handleUpdatePassword() {
  clearMessages();
  if (newPassword.value.length < 6) {
    errorMessage.value = "Le mot de passe doit faire au moins 6 caractères.";
    return;
  }
  if (newPassword.value !== newPasswordConfirm.value) {
    errorMessage.value = "Les mots de passe ne correspondent pas.";
    return;
  }
  isLoading.value = true;
  try {
    await authStore.updatePassword(newPassword.value);
    toast.success("Mot de passe mis à jour");
    newPassword.value = "";
    newPasswordConfirm.value = "";
    goAfterAuth(); // passwordRecovery est maintenant false → redirige
  } catch (err) {
    errorMessage.value = friendlyAuthError(err);
  } finally {
    isLoading.value = false;
  }
}
</script>
