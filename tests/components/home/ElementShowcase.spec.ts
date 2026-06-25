import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import ElementShowcase from "@/components/home/ElementShowcase.vue";
import ElementIcon from "@/components/elements/ElementIcon.vue";

describe("ElementShowcase", () => {
  it("rend les 5 éléments avec leur icône", () => {
    const w = mount(ElementShowcase);
    expect(w.findAllComponents(ElementIcon)).toHaveLength(5);
    const t = w.text();
    for (const el of ["Air", "Eau", "Feu", "Terre", "Neutre"]) {
      expect(t).toContain(el);
    }
  });
});
