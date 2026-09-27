import { describe, it, expect, vi } from "vitest";
import { mount } from "@vue/test-utils";
import LobbyWaitingRoom from "../LobbyWaitingRoom.vue";

describe("LobbyWaitingRoom.vue", () => {
  it("affiche le code du salon et le nombre de joueurs connectés vs requis", () => {
    const wrapper = mount(LobbyWaitingRoom, {
      props: {
        code: "WAK123",
        mode: "1v1",
        isHost: true,
        currentPlayers: 1,
        maxPlayers: 2,
        players: [{ name: "Yugo", isHost: true, ready: true }],
      },
    });

    expect(wrapper.text()).toContain("WAK123");
    expect(wrapper.text()).toContain("1 / 2");
    expect(wrapper.text()).toContain("Yugo");
    expect(wrapper.text()).toContain("Hôte");
    expect(wrapper.text()).toContain("Deck masqué");
    expect(wrapper.text()).toContain("Copier le lien d'invitation");
  });

  it("ne montre pas le nom du deck même s'il est fourni dans les données du slot", () => {
    const wrapper = mount(LobbyWaitingRoom, {
      props: {
        code: "WAK123",
        players: [{ name: "Yugo", deckName: "Deck Secret Cra", isHost: true }],
      },
    });

    expect(wrapper.text()).not.toContain("Deck Secret Cra");
    expect(wrapper.text()).toContain("Deck masqué");
  });

  it("émet l'événement leave quand l'utilisateur clique sur Quitter le salon", async () => {
    const wrapper = mount(LobbyWaitingRoom, {
      props: {
        code: "WAK123",
      },
    });

    const leaveBtn = wrapper.find("button.text-error");
    await leaveBtn.trigger("click");
    expect(wrapper.emitted("leave")).toBeTruthy();
  });

  it("copie le lien d'invitation dans le presse-papier lors du clic", async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: { writeText: writeTextMock },
    });

    const wrapper = mount(LobbyWaitingRoom, {
      props: {
        code: "ABCDEF",
      },
    });

    const copyBtn = wrapper.findAll("button").find((b) => b.text().includes("Copier le lien d'invitation"));
    expect(copyBtn).toBeTruthy();
    await copyBtn!.trigger("click");

    expect(writeTextMock).toHaveBeenCalledWith(expect.stringContaining("ABCDEF"));
  });
});
