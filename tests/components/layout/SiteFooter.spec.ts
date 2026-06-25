import { describe, it, expect } from "vitest";
import { mount, RouterLinkStub } from "@vue/test-utils";
import SiteFooter from "@/components/layout/SiteFooter.vue";

function mountFooter() {
  return mount(SiteFooter, {
    global: { stubs: { RouterLink: RouterLinkStub } },
  });
}

describe("SiteFooter", () => {
  it("lie les pages légales et institutionnelles", () => {
    const w = mountFooter();
    const targets = w
      .findAllComponents(RouterLinkStub)
      .map((l) => l.props("to"));
    for (const route of [
      "/a-propos",
      "/credits",
      "/regles/apprendre",
      "/mentions-legales",
      "/cgu",
    ]) {
      expect(targets).toContain(route);
    }
  });

  it("pointe vers le Discord en lien externe sécurisé", () => {
    const w = mountFooter();
    const discord = w
      .findAll("a")
      .find((a) => a.attributes("href")?.includes("discord.com"));
    expect(discord).toBeTruthy();
    expect(discord!.attributes("target")).toBe("_blank");
    expect(discord!.attributes("rel")).toContain("noopener");
  });

  it("crédite Safranil et Ankama dans le disclaimer", () => {
    const w = mountFooter();
    expect(w.text()).toContain("Safranil");
    expect(w.text()).toContain("Ankama");
    expect(w.text().toLowerCase()).toContain("non-officiel");
  });
});
