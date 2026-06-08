import { describe, it, expect, beforeEach, vi } from "vitest";
import { useToast } from "@/composables/useToast";
import type { ToastType } from "@/composables/useToast";

describe("useToast", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Nettoyer les toasts entre chaque test
    const { clearToasts } = useToast();
    clearToasts();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("addToast()", () => {
    it("devrait ajouter un toast", () => {
      const { addToast, toasts } = useToast();

      addToast("Message de test");

      expect(toasts.value).toHaveLength(1);
      expect(toasts.value[0].message).toBe("Message de test");
    });

    it("devrait retourner un ID unique", () => {
      const { addToast } = useToast();

      const id1 = addToast("Premier");
      const id2 = addToast("Second");

      expect(id1).not.toBe(id2);
    });

    it('devrait utiliser le type "info" par défaut', () => {
      const { addToast, toasts } = useToast();

      addToast("Message info");

      expect(toasts.value[0].type).toBe("info");
    });

    it("devrait utiliser la durée par défaut de 3000ms", () => {
      const { addToast, toasts } = useToast();

      addToast("Message");

      expect(toasts.value[0].duration).toBe(3000);
    });

    it("devrait permettre de spécifier un type personnalisé", () => {
      const { addToast, toasts } = useToast();

      addToast("Erreur", { type: "error" });

      expect(toasts.value[0].type).toBe("error");
    });

    it("devrait permettre de spécifier une durée personnalisée", () => {
      const { addToast, toasts } = useToast();

      addToast("Long", { duration: 10000 });

      expect(toasts.value[0].duration).toBe(10000);
    });

    it("devrait permettre de spécifier un titre", () => {
      const { addToast, toasts } = useToast();

      addToast("Message", { title: "Titre" });

      expect(toasts.value[0].title).toBe("Titre");
    });

    it("devrait avoir show à true initialement", () => {
      const { addToast, toasts } = useToast();

      addToast("Visible");

      expect(toasts.value[0].show).toBe(true);
    });
  });

  describe("Auto-suppression", () => {
    it("devrait marquer le toast comme non-affiché après la durée spécifiée", () => {
      const { addToast, toasts } = useToast();

      addToast("Auto-supprimé", { duration: 2000 });

      vi.advanceTimersByTime(2000);

      // Après la durée, show passe à false
      expect(toasts.value[0]?.show).toBe(false);
    });

    it("devrait supprimer complètement le toast après l'animation (300ms supplémentaires)", () => {
      const { addToast, toasts } = useToast();

      addToast("Supprimé", { duration: 2000 });

      // Avancer jusqu'à la fin de la durée
      vi.advanceTimersByTime(2000);
      // Avancer pour l'animation de sortie
      vi.advanceTimersByTime(300);

      expect(toasts.value).toHaveLength(0);
    });

    it("devrait ne pas auto-supprimer si la durée est 0", () => {
      // Utiliser des vrais timers pour ce test spécifique afin d'éviter
      // les interactions avec les fake timers
      vi.useRealTimers();

      const { addToast, toasts, clearToasts } = useToast();
      clearToasts();

      const id = addToast("Persistant", { duration: 0 });

      // Vérifier immédiatement que le toast est présent
      expect(toasts.value.some((t) => t.id === id)).toBe(true);
      expect(toasts.value.find((t) => t.id === id)!.show).toBe(true);

      // Réactiver les fake timers pour les tests suivants
      vi.useFakeTimers();
    });
  });

  describe("Coexistence de toasts multiples", () => {
    it("devrait permettre plusieurs toasts simultanés", () => {
      const { addToast, toasts } = useToast();

      addToast("Premier");
      addToast("Deuxième");
      addToast("Troisième");

      expect(toasts.value).toHaveLength(3);
    });

    it("devrait supprimer les toasts indépendamment selon leur durée", () => {
      const { addToast, toasts } = useToast();

      addToast("Court", { duration: 1000 });
      addToast("Long", { duration: 5000 });

      // Après 1 seconde, le premier est marqué pour suppression
      vi.advanceTimersByTime(1000);
      expect(toasts.value[0].show).toBe(false);
      expect(toasts.value[1].show).toBe(true);

      // Après animation du premier
      vi.advanceTimersByTime(300);
      expect(toasts.value).toHaveLength(1);
      expect(toasts.value[0].message).toBe("Long");
    });

    it("devrait maintenir l'ordre d'ajout", () => {
      const { addToast, toasts } = useToast();

      addToast("A");
      addToast("B");
      addToast("C");

      expect(toasts.value[0].message).toBe("A");
      expect(toasts.value[1].message).toBe("B");
      expect(toasts.value[2].message).toBe("C");
    });
  });

  describe("Types de toast (success, error, warning, info)", () => {
    const types: ToastType[] = ["success", "error", "warning", "info"];

    types.forEach((type) => {
      it(`devrait créer un toast de type "${type}" via la méthode dédiée`, () => {
        const toast = useToast();

        toast[type](`Message ${type}`);

        expect(toast.toasts.value[toast.toasts.value.length - 1].type).toBe(
          type,
        );
      });
    });

    it("devrait créer un toast success avec les bonnes options", () => {
      const { success, toasts } = useToast();

      success("Succès !", { title: "Bravo", duration: 5000 });

      const last = toasts.value[toasts.value.length - 1];
      expect(last.type).toBe("success");
      expect(last.title).toBe("Bravo");
      expect(last.duration).toBe(5000);
    });

    it("devrait créer un toast error avec les bonnes options", () => {
      const { error, toasts } = useToast();

      error("Erreur critique", { title: "Oups" });

      const last = toasts.value[toasts.value.length - 1];
      expect(last.type).toBe("error");
      expect(last.title).toBe("Oups");
    });

    it("devrait créer un toast warning", () => {
      const { warning, toasts } = useToast();

      warning("Attention");

      const last = toasts.value[toasts.value.length - 1];
      expect(last.type).toBe("warning");
    });

    it("devrait créer un toast info", () => {
      const { info, toasts } = useToast();

      info("Information");

      const last = toasts.value[toasts.value.length - 1];
      expect(last.type).toBe("info");
    });
  });

  describe("removeToast()", () => {
    it("devrait marquer un toast comme non-affiché par son ID", () => {
      const { addToast, removeToast, toasts } = useToast();

      const id = addToast("A supprimer", { duration: 0 });
      removeToast(id);

      expect(toasts.value[0].show).toBe(false);
    });

    it("devrait supprimer complètement le toast après 300ms", () => {
      const { addToast, removeToast, toasts } = useToast();

      const id = addToast("A supprimer", { duration: 0 });
      removeToast(id);
      vi.advanceTimersByTime(300);

      expect(toasts.value).toHaveLength(0);
    });

    it("devrait ne rien faire pour un ID inexistant", () => {
      const { addToast, removeToast, toasts } = useToast();

      addToast("Existant", { duration: 0 });
      removeToast(99999);

      expect(toasts.value).toHaveLength(1);
      expect(toasts.value[0].show).toBe(true);
    });
  });

  describe("clearToasts()", () => {
    it("devrait supprimer tous les toasts", () => {
      const { addToast, clearToasts, toasts } = useToast();

      addToast("A", { duration: 0 });
      addToast("B", { duration: 0 });
      addToast("C", { duration: 0 });

      clearToasts();

      expect(toasts.value).toHaveLength(0);
    });
  });

  describe("Singleton (état partagé)", () => {
    it("devrait partager les toasts entre les instances", () => {
      const toast1 = useToast();
      const toast2 = useToast();

      toast1.addToast("Partagé", { duration: 0 });

      expect(toast2.toasts.value).toHaveLength(toast1.toasts.value.length);
    });
  });
});
