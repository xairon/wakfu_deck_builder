import { describe, it, expect, beforeEach, vi } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { flushPromises } from "@vue/test-utils";

// ---- Mocks ----

let mockSupabaseInstance: any = null;

vi.mock("@/services/supabase", () => ({
  get supabase() {
    return mockSupabaseInstance;
  },
  isSupabaseConfigured: () => !!mockSupabaseInstance,
}));

// hydrateForUser importe ces stores : on les neutralise pour isoler l'auth.
const cardStub = {
  initialize: vi.fn().mockResolvedValue(undefined),
  reloadCollection: vi.fn(),
  clearCollection: vi.fn(),
  pullCloudCollection: vi.fn().mockResolvedValue(undefined),
};
const deckStub = {
  loadDecks: vi.fn(),
  clearAll: vi.fn(),
  pullCloudDecks: vi.fn().mockResolvedValue(undefined),
};
vi.mock("@/stores/cardStore", () => ({ useCardStore: () => cardStub }));
vi.mock("@/stores/deckStore", () => ({ useDeckStore: () => deckStub }));

import { useAuthStore } from "@/stores/authStore";

function createMockSupabase(overrides: Record<string, any> = {}) {
  const callbacks: Array<(...args: any[]) => void> = [];
  return {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: overrides.session ?? null },
        error: null,
      }),
      signUp: vi.fn().mockResolvedValue({
        data: overrides.signUpData ?? {
          user: { id: "u-new", email: "new@test.com" },
          session: null, // confirmation e-mail requise par défaut
        },
        error: overrides.signUpError ?? null,
      }),
      signInWithPassword: vi.fn().mockResolvedValue({
        data: overrides.signInData ?? {
          user: { id: "u-1", email: "user@test.com" },
          session: {
            access_token: "tok",
            user: { id: "u-1", email: "user@test.com" },
          },
        },
        error: overrides.signInError ?? null,
      }),
      signOut: vi
        .fn()
        .mockResolvedValue({ error: overrides.signOutError ?? null }),
      resetPasswordForEmail: vi
        .fn()
        .mockResolvedValue({ error: overrides.resetError ?? null }),
      onAuthStateChange: vi.fn((cb: (...args: any[]) => void) => {
        callbacks.push(cb);
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      }),
    },
    _callbacks: callbacks,
  };
}

describe("authStore (cloud-only)", () => {
  let store: ReturnType<typeof useAuthStore>;

  beforeEach(() => {
    setActivePinia(createPinia());
    mockSupabaseInstance = createMockSupabase();
    vi.clearAllMocks();
  });

  it("démarre non authentifié", () => {
    store = useAuthStore();
    expect(store.isAuthenticated).toBe(false);
    expect(store.user).toBeNull();
    expect(store.loading).toBe(true);
  });

  it("initialize restaure une session existante et écoute les changements", async () => {
    mockSupabaseInstance = createMockSupabase({
      session: {
        access_token: "tok",
        user: { id: "u-9", email: "exist@test.com" },
      },
    });
    store = useAuthStore();

    await store.initialize();

    expect(store.isAuthenticated).toBe(true);
    expect(store.userId).toBe("u-9");
    expect(store.userEmail).toBe("exist@test.com");
    expect(store.loading).toBe(false);
    expect(mockSupabaseInstance.auth.onAuthStateChange).toHaveBeenCalledOnce();
    // hydratation déclenchée
    expect(deckStub.pullCloudDecks).toHaveBeenCalled();
  });

  it("initialize sans session reste non authentifié", async () => {
    mockSupabaseInstance = createMockSupabase({ session: null });
    store = useAuthStore();
    await store.initialize();
    expect(store.isAuthenticated).toBe(false);
    expect(store.loading).toBe(false);
  });

  it("signUp signale la confirmation e-mail (pas de session)", async () => {
    store = useAuthStore();
    const result = await store.signUp("new@test.com", "password123");
    expect(mockSupabaseInstance.auth.signUp).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "new@test.com",
        password: "password123",
      }),
    );
    expect(result.needsEmailConfirmation).toBe(true);
    expect(store.isAuthenticated).toBe(false); // pas connecté tant que non confirmé
  });

  it("signUp connecte immédiatement si une session est renvoyée", async () => {
    mockSupabaseInstance = createMockSupabase({
      signUpData: {
        user: { id: "u-2", email: "auto@test.com" },
        session: {
          access_token: "t",
          user: { id: "u-2", email: "auto@test.com" },
        },
      },
    });
    store = useAuthStore();
    const result = await store.signUp("auto@test.com", "password123");
    expect(result.needsEmailConfirmation).toBe(false);
    expect(store.isAuthenticated).toBe(true);
  });

  it("signIn délègue à Supabase et hydrate les données", async () => {
    store = useAuthStore();
    await store.signIn("user@test.com", "secret");
    expect(mockSupabaseInstance.auth.signInWithPassword).toHaveBeenCalledWith({
      email: "user@test.com",
      password: "secret",
    });
    expect(store.isAuthenticated).toBe(true);
    expect(store.userEmail).toBe("user@test.com");
    expect(cardStub.pullCloudCollection).toHaveBeenCalled();
    expect(deckStub.pullCloudDecks).toHaveBeenCalled();
  });

  it("signIn propage une erreur d'identifiants", async () => {
    mockSupabaseInstance = createMockSupabase();
    mockSupabaseInstance.auth.signInWithPassword.mockResolvedValueOnce({
      data: null,
      error: new Error("Invalid login credentials"),
    });
    store = useAuthStore();
    await expect(store.signIn("x@y.com", "bad")).rejects.toThrow(
      "Invalid login credentials",
    );
    expect(store.error).toBe("Invalid login credentials");
    expect(store.isAuthenticated).toBe(false);
  });

  it("signOut déconnecte et vide les données", async () => {
    mockSupabaseInstance = createMockSupabase({
      session: { access_token: "t", user: { id: "u-1", email: "a@b.com" } },
    });
    store = useAuthStore();
    await store.initialize();
    expect(store.isAuthenticated).toBe(true);

    await store.signOut();
    expect(mockSupabaseInstance.auth.signOut).toHaveBeenCalledOnce();
    expect(store.isAuthenticated).toBe(false);
    expect(cardStub.clearCollection).toHaveBeenCalled();
    expect(deckStub.clearAll).toHaveBeenCalled();
  });

  it("resetPassword délègue à Supabase avec une URL de redirection", async () => {
    store = useAuthStore();
    await store.resetPassword("reset@test.com");
    expect(
      mockSupabaseInstance.auth.resetPasswordForEmail,
    ).toHaveBeenCalledWith("reset@test.com", expect.any(Object));
  });

  // Le flux de confirmation e-mail (et le refresh de session) n'arrivent PAS via
  // signIn() mais via l'abonnement onAuthStateChange enregistré dans initialize.
  it("hydrate les données quand une session apparaît via onAuthStateChange", async () => {
    store = useAuthStore();
    await store.initialize();

    const wrapped =
      mockSupabaseInstance.auth.onAuthStateChange.mock.calls[0][0];
    // Supabase appelle (event, rawSession) ; le provider mappe la session.
    wrapped("SIGNED_IN", {
      access_token: "tok",
      user: { id: "u-cb", email: "cb@test.com" },
    });

    // setSession est synchrone
    expect(store.isAuthenticated).toBe(true);
    expect(store.userId).toBe("u-cb");

    await flushPromises();
    expect(cardStub.pullCloudCollection).toHaveBeenCalled();
    expect(deckStub.pullCloudDecks).toHaveBeenCalled();
  });

  it("vide les données quand la session disparaît via onAuthStateChange", async () => {
    mockSupabaseInstance = createMockSupabase({
      session: { access_token: "t", user: { id: "u-1", email: "a@b.com" } },
    });
    store = useAuthStore();
    await store.initialize();
    await flushPromises();

    const wrapped =
      mockSupabaseInstance.auth.onAuthStateChange.mock.calls[0][0];
    wrapped("SIGNED_OUT", null);

    expect(store.isAuthenticated).toBe(false);
    await flushPromises();
    expect(cardStub.clearCollection).toHaveBeenCalled();
    expect(deckStub.clearAll).toHaveBeenCalled();
  });
});
