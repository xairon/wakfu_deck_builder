import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import PlayTableView from "../PlayTableView.vue";
import { createRouter, createWebHistory } from "vue-router";

describe("PlayTableView — montage initial", () => {
  it("se monte correctement sans lancer d'exception ReferenceError", () => {
    setActivePinia(createPinia());
    const router = createRouter({
      history: createWebHistory(),
      routes: [{ path: "/", component: PlayTableView }],
    });

    const wrapper = mount(PlayTableView, {
      global: {
        plugins: [router],
        stubs: {
          GameBoard: true,
          InGameChat: true,
          VictoryDefeatOverlay: true,
          DialogModal: true,
          CardDetailModal: true,
          CardZoomModal: true,
          OnlineRoomModal: true,
        },
      },
    });

    expect(wrapper.exists()).toBe(true);
  });
});
