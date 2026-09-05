import { describe, it, expect, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import LobbyBrowser from "../LobbyBrowser.vue";

vi.mock("@/services/lobbyDiscoveryService", () => ({
  subscribeToHostedLobbies: vi.fn((cb) => {
    cb([
      {
        code: "OPEN99",
        hostName: "Ruel",
        mode: "1v1",
        deckName: "Enutrof Richesse",
        currentPlayers: 1,
        maxPlayers: 2,
        createdAt: Date.now(),
        status: "waiting",
      },
    ]);
    return vi.fn();
  }),
  fetchHostedLobbiesFromDb: vi.fn().mockResolvedValue([]),
}));

describe("LobbyBrowser.vue", () => {
  it("affiche la liste des salons hébergés en temps réel", async () => {
    const wrapper = mount(LobbyBrowser);
    await nextTick();

    expect(wrapper.text()).toContain("OPEN99");
    expect(wrapper.text()).toContain("Ruel");
    expect(wrapper.text()).toContain("Enutrof Richesse");
    expect(wrapper.text()).toContain("Rejoindre");
  });

  it("émet l'événement join avec le salon sélectionné", async () => {
    const wrapper = mount(LobbyBrowser);
    await nextTick();

    const joinBtn = wrapper.findAll("button").find((b) => b.text().includes("Rejoindre"));
    expect(joinBtn).toBeTruthy();
    await joinBtn!.trigger("click");

    expect(wrapper.emitted("join")).toBeTruthy();
    expect(wrapper.emitted("join")![0][0]).toMatchObject({
      code: "OPEN99",
      hostName: "Ruel",
    });
  });
});
