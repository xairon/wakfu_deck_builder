import { vi } from "vitest";
import { config } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";

// Configuration globale de Vue Test Utils
config.global.mocks = {
  $t: (key: string) => key,
  $route: {
    params: {},
    query: {},
    path: "/",
  },
  $router: {
    push: vi.fn(),
    replace: vi.fn(),
  },
};

// Stub global de RouterLink : évite le `[Vue warn]: Failed to resolve
// component: RouterLink` (bruit dans la sortie des tests) quand un composant
// qui l'utilise (ex. ErrataPanel) est monté sans router installé. Un test qui
// a besoin d'inspecter le lien (ex. sa prop `to`) peut toujours le
// sur-stubber localement via `global: { stubs: { RouterLink: ... } } }`.
config.global.stubs = {
  ...config.global.stubs,
  RouterLink: { props: ["to"], template: "<a><slot /></a>" },
};

// Mock de ResizeObserver
class ResizeObserverMock {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}

// Mock de IntersectionObserver
class IntersectionObserverMock {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}

// Configuration globale
beforeEach(() => {
  // Reset des mocks
  vi.clearAllMocks();

  // Configuration de Pinia
  setActivePinia(createPinia());

  // Mock des APIs du navigateur
  global.ResizeObserver = ResizeObserverMock;
  global.IntersectionObserver =
    IntersectionObserverMock as unknown as typeof IntersectionObserver;

  // Mock de localStorage
  const localStorageMock = {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
  };
  Object.defineProperty(window, "localStorage", { value: localStorageMock });

  // Mock de fetch
  global.fetch = vi.fn();

  // Mock de Image
  global.Image = class {
    onload: () => void = () => {};
    onerror: () => void = () => {};
    src: string = "";
  } as unknown as typeof Image;
});

// Nettoyage après chaque test
afterEach(() => {
  vi.clearAllTimers();
  document.body.innerHTML = "";
});
