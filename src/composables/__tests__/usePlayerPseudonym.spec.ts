import { describe, it, expect, beforeEach, vi } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { usePlayerPseudonym, _resetPseudonymForTesting } from "../usePlayerPseudonym";

describe("usePlayerPseudonym", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    _resetPseudonymForTesting();
  });

  it("initialise un pseudonyme par défaut et appelle localStorage.setItem", () => {
    const { pseudonym } = usePlayerPseudonym();
    expect(pseudonym.value).toBeTruthy();
    expect(localStorage.setItem).toHaveBeenCalledWith(
      "wakfu_player_pseudonym",
      pseudonym.value,
    );
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

  it("initialise depuis la valeur déjà stockée dans localStorage", () => {
    vi.mocked(localStorage.getItem).mockReturnValueOnce("Goultard");
    const { pseudonym } = usePlayerPseudonym();
    expect(pseudonym.value).toBe("Goultard");
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
