import { describe, it, expect } from "vitest";
import { mount, RouterLinkStub } from "@vue/test-utils";
import FirstStepsView from "@/views/FirstStepsView.vue";
import { FIRST_STEPS } from "@/data/firstSteps";

describe("FirstStepsView", () => {
  it("rend toutes les étapes et un lien vers le tutoriel jouable", () => {
    const w = mount(FirstStepsView, {
      global: { stubs: { RouterLink: RouterLinkStub } },
    });
    expect(w.text()).toContain(FIRST_STEPS[0].title);
    const targets = w
      .findAllComponents(RouterLinkStub)
      .map((l) => l.props("to"));
    expect(targets).toContain("/play/table");
    expect(targets).toContain("/regles");
  });
});
