import { describe, it, expect, beforeEach, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { setActivePinia, createPinia } from "pinia";

vi.mock("@/services/errataService", () => ({
  preloadErrata: () => Promise.resolve(),
  getAllErrata: () => ({
    "opee-tissoin-incarnam": [
      {
        date: "2010-12-01",
        summary: "Passe à 6 PA.",
        before: "7 PA",
        after: "6 PA",
      },
    ],
    "skeunk-amakna": [{ date: "2009-10-13", summary: "Texte clarifié." }],
  }),
}));

import ErrataView from "@/views/ErrataView.vue";
import { useCardStore } from "@/stores/cardStore";

// RouterLink stub with `props` declared so the `to` prop can be inspected
const RouterLinkStub = {
  props: ["to"],
  template: "<a><slot /></a>",
};

function mountView() {
  const store = useCardStore();
  store.cards = [
    {
      id: "opee-tissoin-incarnam",
      name: "Opée Tissoin",
      mainType: "Allié",
      extension: { name: "Incarnam" },
    },
    {
      id: "skeunk-amakna",
      name: "Skeunk",
      mainType: "Allié",
      extension: { name: "Amakna" },
    },
  ] as any;
  // RouterLink stubbé AVEC son slot : `stubs: { RouterLink: true }` ne rendrait
  // pas le contenu par défaut, et le nom de la carte disparaîtrait de text().
  return mount(ErrataView, {
    global: {
      stubs: { RouterLink: RouterLinkStub },
    },
  });
}

describe("ErrataView", () => {
  beforeEach(() => setActivePinia(createPinia()));

  it("devrait afficher les cartes erratées avec leur résumé", async () => {
    const w = mountView();
    await w.vm.$nextTick();
    expect(w.text()).toContain("Opée Tissoin");
    expect(w.text()).toContain("Passe à 6 PA.");
  });

  it("devrait grouper par extension de la carte (pas par suffixe d'id)", async () => {
    const w = mountView();
    await w.vm.$nextTick();
    expect(w.text()).toContain("Incarnam");
    expect(w.text()).toContain("Amakna");
  });

  it("devrait afficher le avant/après quand il existe", async () => {
    const w = mountView();
    await w.vm.$nextTick();
    expect(w.text()).toContain("7 PA");
    expect(w.text()).toContain("6 PA");
  });

  it("devrait filtrer par nom de carte", async () => {
    const w = mountView();
    await w.vm.$nextTick();
    await w.find('input[type="search"]').setValue("Skeunk");
    expect(w.text()).toContain("Skeunk");
    expect(w.text()).not.toContain("Opée Tissoin");
  });

  it("devrait lier chaque entrée vers la carte", async () => {
    const w = mountView();
    await w.vm.$nextTick();

    // Find all RouterLink components by the stub reference
    const routerLinks = w.findAllComponents(RouterLinkStub);
    expect(routerLinks.length).toBeGreaterThan(0);

    // Find the link for "Opée Tissoin" and verify the `to` prop includes the query
    const opeeLink = routerLinks.find((link) =>
      link.text().includes("Opée Tissoin"),
    );

    expect(opeeLink).toBeDefined();
    expect(opeeLink?.props("to")).toEqual({
      name: "collection",
      query: { q: "Opée Tissoin" },
    });
  });

  it("devrait basculer en tri par date (un seul groupe, récent d'abord)", async () => {
    const w = mountView();
    await w.vm.$nextTick();
    await w.find("select").setValue("date");
    expect(w.findAll("section")).toHaveLength(1);
    // Opée Tissoin (2010-12-01) doit précéder Skeunk (2009-10-13).
    const text = w.text();
    expect(text.indexOf("Opée Tissoin")).toBeLessThan(text.indexOf("Skeunk"));
  });
});
