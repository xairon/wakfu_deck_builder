/**
 * Sons de table (audit UX MTGA) — le mapping journal → repère est PUR et
 * verrouillé sur les libellés réels de describe()/say() ; la coupure est
 * persistée ; play() est un no-op silencieux muet ou sans AudioContext
 * (jsdom n'en a pas — aucune erreur ne doit fuiter).
 */
import { describe, it, expect } from "vitest";
import { sfxForLogLine, useGameSounds } from "@/composables/useGameSounds";

describe("sfxForLogLine — mapping journal → repère", () => {
  it("classe les libellés réels du journal", () => {
    expect(sfxForLogLine("Toi pioche une carte.")).toBe("draw");
    expect(sfxForLogLine("L'ordinateur joue Tofu dans son Havre-Sac.")).toBe(
      "play",
    );
    expect(sfxForLogLine("Joueur 1 met Craqueleur des Plaines en jeu.")).toBe(
      "play",
    );
    expect(sfxForLogLine("Toi incline Poum Ondacié.")).toBe("tap");
    expect(sfxForLogLine("Tirlangue Portey inflige 2 Dommages à Tofu.")).toBe(
      "damage",
    );
  });

  it("ignore les lignes sans repère (mélange, tour, compteurs)", () => {
    expect(sfxForLogLine("Table mélange sa Pioche.")).toBeNull();
    expect(sfxForLogLine("Toi entame le tour 2.")).toBeNull();
    expect(sfxForLogLine("Toi ajuste « pv ».")).toBeNull();
  });
});

describe("useGameSounds — coupure et robustesse", () => {
  it("toggleMute persiste la préférence et play() reste silencieux (jsdom sans AudioContext)", () => {
    const s = useGameSounds();
    const before = s.muted.value;
    // play() ne doit JAMAIS jeter, muet ou non, avec ou sans AudioContext.
    expect(() => s.play("draw")).not.toThrow();
    s.toggleMute();
    expect(s.muted.value).toBe(!before);
    // localStorage est un MOCK vi.fn() dans le harnais (tests/setup.ts) : on
    // vérifie l'ÉCRITURE de la préférence, pas la relecture.
    expect(localStorage.setItem).toHaveBeenCalledWith(
      "wakfu-table-sound-muted",
      s.muted.value ? "1" : "0",
    );
    expect(() => s.play("victory")).not.toThrow();
    s.toggleMute(); // remettre l'état initial (singleton partagé entre tests)
  });
});
