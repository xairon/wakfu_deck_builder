import { describe, it, expect, beforeEach, vi } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { usePlayerPseudonym, _resetPseudonymForTesting, generateRandomFallback } from "../usePlayerPseudonym";
import { useAuthStore } from "@/stores/authStore";

describe("usePlayerPseudonym", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    _resetPseudonymForTesting();
  });

  it("initialise un pseudonyme par défaut 'Joueur <chiffre>' et appelle localStorage.setItem", () => {
    const { pseudonym } = usePlayerPseudonym();
    expect(pseudonym.value).toMatch(/^Joueur \d+$/);
    expect(localStorage.setItem).toHaveBeenCalledWith(
      "wakfu_player_pseudonym",
      pseudonym.value,
    );
  });

  it("génère un fallback 'Joueur <chiffre>' déterministe pour un userId", () => {
    const name1 = generateRandomFallback("user-12345");
    const name2 = generateRandomFallback("user-12345");
    expect(name1).toMatch(/^Joueur \d+$/);
    expect(name1).toBe(name2);
  });

  it("ne fuit JAMAIS l'email de l'utilisateur comme pseudo", () => {
    const authStore = useAuthStore();
    authStore.user = { id: "u-99", email: "secret.player@domain.com" } as any;

    const { pseudonym } = usePlayerPseudonym();
    expect(pseudonym.value).not.toContain("secret.player");
    expect(pseudonym.value).not.toContain("@");
    expect(pseudonym.value).toMatch(/^Joueur \d+$/);
  });

  it("rejette la saisie manuelle d'un email en tant que pseudo", () => {
    const { setPseudonym } = usePlayerPseudonym();
    const res = setPseudonym("mon.mail@test.com");
    expect(res.ok).toBe(false);
    expect(res.error).toContain("email");
  });

  it("utilise le pseudo du profil utilisateur Supabase s'il existe", () => {
    const authStore = useAuthStore();
    authStore.username = "YugoHero";

    const { pseudonym } = usePlayerPseudonym();
    expect(pseudonym.value).toBe("YugoHero");
  });

  it("met à jour et persiste le nouveau pseudonyme valide", () => {
    const { pseudonym, setPseudonym, isCustomized } = usePlayerPseudonym();
    const res = setPseudonym("Tristepin");
    expect(res.ok).toBe(true);
    expect(pseudonym.value).toBe("Tristepin");
    expect(localStorage.setItem).toHaveBeenCalledWith(
      "wakfu_player_pseudonym",
      "Tristepin",
    );
    expect(isCustomized.value).toBe(true);
  });

  it("initialise depuis la valeur déjà stockée dans localStorage si ce n'est pas un email", () => {
    vi.mocked(localStorage.getItem).mockReturnValueOnce("Goultard");
    const { pseudonym } = usePlayerPseudonym();
    expect(pseudonym.value).toBe("Goultard");
  });

  it("ignore une ancienne valeur de localStorage contenant un email et génère un fallback", () => {
    vi.mocked(localStorage.getItem).mockReturnValueOnce("old.email@test.com");
    const { pseudonym } = usePlayerPseudonym();
    expect(pseudonym.value).toMatch(/^Joueur \d+$/);
    expect(pseudonym.value).not.toContain("@");
  });

  it("rejette les pseudonymes trop courts ou trop longs", () => {
    const { setPseudonym } = usePlayerPseudonym();
    const resShort = setPseudonym("A");
    expect(resShort.ok).toBe(false);
    expect(resShort.error).toContain("au moins 2 caractères");

    const resLong = setPseudonym("A".repeat(25));
    expect(resLong.ok).toBe(false);
    expect(resLong.error).toContain("24 caractères");
  });
});
