/**
 * JETONS DE CRÉATURE — op `createToken` (« Mettez en jeu un jeton "Monstre - X"
 * de Force N [Élément] », Abraknyde / Vampyro).
 *
 * Trois volets :
 *  1) DSL — `parseCreateToken` (via `compileEffectText`/`compileTapEffectText`) :
 *     positifs (Abraknyde tap-power once-per-turn ; Vampyro costRecycleControlled)
 *     et négatifs (forme dynamique « le même nombre de jetons » → manuel).
 *  2) Moteur isolé — `createEffectEngine` (deps mockées) : `createToken` DISPATCHE
 *     un CREATE_TOKEN avec le bon cardId synthétique ; `costRecycleControlled`
 *     ouvre un ciblage parmi VOS créatures et recycle la cible choisie.
 *  3) REDUCER — `applyEvent(CREATE_TOKEN)` minte une instance Allié "Monstre" de
 *     Force/Élément lisibles, et un jeton quittant le jeu CESSE D'EXISTER.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Card, CompiledEffect } from "@/types/cards";
import type { GameState, PersistedEvent } from "@/game";
import { applyEvent, emptyState } from "@/game";
import { effectiveForce } from "../../stats";
import {
  compileEffectText,
  compileTapEffectText,
  isTokenTapPowerText,
} from "../dsl";
import { createEffectEngine } from "../engine";
import type { EffectEngineDeps } from "../engine";
import {
  ensureTokenCard,
  getTokenCard,
  isTokenCardId,
  resetTokenRegistry,
  tokenCardId,
} from "../tokens";

beforeEach(() => resetTokenRegistry());

// ── Volet 1 : DSL ──────────────────────────────────────────────────────────
describe("DSL — createToken", () => {
  it("Abraknyde (tap power once-per-turn) → onTap createToken Arakne Force 1 Terre", () => {
    // requiresIncline absent des données : le routage passe par isTokenTapPowerText,
    // la clause « N'utilisez ce pouvoir qu'une seule fois par tour » est retirée.
    const text =
      "Mettez en jeu un jeton \"Monstre - Arakne\" de Force 1 Terre. N'utilisez ce pouvoir qu'une seule fois par tour.";
    expect(isTokenTapPowerText(text)).toBe(true);
    const c = compileTapEffectText(text, "Abraknyde");
    expect(c).toEqual<CompiledEffect>({
      trigger: "onTap",
      ops: [
        {
          op: "createToken",
          name: "Monstre - Arakne",
          force: 1,
          sub: "Arakne",
          element: "Terre",
        },
      ],
    });
  });

  it("tiret em — « Monstre — Arakne » (variante de scrape) compile aussi", () => {
    const text =
      "Mettez en jeu un jeton \"Monstre — Arakne\" de Force 1 Terre. N'utilisez ce pouvoir qu'une seule fois par tour.";
    const c = compileTapEffectText(text, "Abraknyde");
    expect(c?.ops[0]).toEqual({
      op: "createToken",
      name: "Monstre - Arakne",
      force: 1,
      sub: "Arakne",
      element: "Terre",
    });
  });

  it("Vampyro → onTap paidOps costRecycleControlled(Monstre) + createToken Vampyre Force 1 (sans Élément)", () => {
    const c = compileTapEffectText(
      'Recyclez un Monstre de votre choix : Mettez en jeu un jeton "Monstre - Vampyre" de Force 1 .',
      "Vampyro",
    );
    expect(c).toEqual<CompiledEffect>({
      trigger: "onTap",
      cost: "paidOps",
      ops: [
        {
          op: "costRecycleControlled",
          sub: "monstre",
          zones: ["monde", "havreSac"],
        },
        {
          op: "createToken",
          name: "Monstre - Vampyre",
          force: 1,
          sub: "Vampyre",
        },
      ],
    });
  });

  it("NÉGATIF : « le même nombre de jetons » (Classe de Vampyro) → non compilé (manuel)", () => {
    const c = compileTapEffectText(
      "Recyclez jusqu'à 3 Monstres de votre Défausse : Mettez en jeu le même nombre de jetons « Monstre - Vampyre » de Force 1 inclinés dans le Monde.",
      "Classe de Vampyro",
    );
    expect(c).toBeNull();
  });

  it("NÉGATIF : jeton de Famille inconnue → non compilé (pas de devinette de type)", () => {
    // « Bidule » n'est pas une Famille d'ALLIED_FAMILIES.
    const c = compileTapEffectText(
      "Mettez en jeu un jeton \"Monstre - Bidule\" de Force 1 Terre. N'utilisez ce pouvoir qu'une seule fois par tour.",
      "Carte X",
    );
    expect(c).toBeNull();
  });

  it("NÉGATIF : « Mettez en jeu un jeton … » SANS once-per-turn n'est PAS routé en tap-power", () => {
    // isTokenTapPowerText exige la clause once-per-turn (verrou d'inclinaison) :
    // une création nue ne doit pas devenir un pouvoir à inclinaison fantôme.
    expect(
      isTokenTapPowerText(
        'Mettez en jeu un jeton "Monstre - Arakne" de Force 1 Terre.',
      ),
    ).toBe(false);
  });

  it("createToken comme corps d'apparition (onArrive)", () => {
    const c = compileEffectText(
      'Quand Truc apparaît, mettez en jeu un jeton "Monstre - Arakne" de Force 2 Feu.',
      "Truc",
    );
    expect(c).toEqual<CompiledEffect>({
      trigger: "onArrive",
      ops: [
        {
          op: "createToken",
          name: "Monstre - Arakne",
          force: 2,
          sub: "Arakne",
          element: "Feu",
        },
      ],
    });
  });
});

// ── Registre de jetons ───────────────────────────────────────────────────────
describe("registre de jetons", () => {
  it("ensureTokenCard : carte Allié 'Monstre' + Famille, Force/Élément imprimés", () => {
    const card = ensureTokenCard({
      name: "Monstre - Arakne",
      force: 1,
      element: "Terre",
      sub: "Arakne",
    });
    expect(card.mainType).toBe("Allié");
    expect(card.subTypes).toEqual(["Monstre", "Arakne"]);
    expect(card.name).toBe("Monstre - Arakne");
    expect(card.stats?.force).toEqual({ value: 1, element: "Terre" });
  });

  it("idempotent : même gabarit → MÊME entrée (cardId déterministe)", () => {
    const a = ensureTokenCard({ name: "Monstre - Vampyre", force: 1 });
    const b = ensureTokenCard({ name: "Monstre - Vampyre", force: 1 });
    expect(a).toBe(b);
    expect(tokenCardId({ name: "Monstre - Vampyre", force: 1 })).toBe(
      tokenCardId({ name: "Monstre - Vampyre", force: 1 }),
    );
  });

  it("isTokenCardId / getTokenCard : reconnaît le cardId synthétique, ignore une carte réelle", () => {
    const id = tokenCardId({
      name: "Monstre - Arakne",
      force: 1,
      sub: "Arakne",
    });
    expect(isTokenCardId(id)).toBe(true);
    expect(isTokenCardId("abraknyde-incarnam")).toBe(false);
    expect(getTokenCard("abraknyde-incarnam")).toBeNull();
    ensureTokenCard({ name: "Monstre - Arakne", force: 1, sub: "Arakne" });
    expect(getTokenCard(id)?.name).toBe("Monstre - Arakne");
  });
});

// ── Volet 3 : REDUCER ────────────────────────────────────────────────────────
function ev(
  type: PersistedEvent["type"],
  payload: unknown,
  seq: number,
): PersistedEvent {
  return {
    gameId: "g",
    seq,
    parentSeq: seq - 1,
    actor: "A",
    type,
    payload,
    ts: seq,
  };
}

describe("reducer — CREATE_TOKEN & disparition du jeton", () => {
  it("CREATE_TOKEN minte une instance Allié 'Monstre' de Force lisible dans le Monde", () => {
    resetTokenRegistry();
    const spec = {
      name: "Monstre - Arakne",
      force: 1,
      element: "Terre",
      sub: "Arakne",
    };
    const cardId = tokenCardId(spec);
    ensureTokenCard(spec);
    let s: GameState = emptyState();
    s.status = "active";
    s = applyEvent(
      s,
      ev("CREATE_TOKEN", { instanceId: "tok_A_1", cardId, controller: "A" }, 1),
    );
    const inst = s.instances["tok_A_1"];
    expect(inst).toBeDefined();
    expect(inst.location.zone).toBe("monde");
    expect(inst.controller).toBe("A");
    expect(inst.orientation).toBe("upright");
    expect(s.monde).toContain("tok_A_1");
    // Force EFFECTIVE = sa Force imprimée (participant de combat fidèle).
    const ctx = { state: s, getCard: getTokenCard };
    expect(effectiveForce(ctx, "tok_A_1")).toBe(1);
  });

  it("un jeton quittant le jeu (MOVE vers Défausse) CESSE D'EXISTER (retiré des instances)", () => {
    resetTokenRegistry();
    const spec = { name: "Monstre - Arakne", force: 1, sub: "Arakne" };
    const cardId = tokenCardId(spec);
    ensureTokenCard(spec);
    let s: GameState = emptyState();
    s.status = "active";
    s = applyEvent(
      s,
      ev("CREATE_TOKEN", { instanceId: "tok_A_1", cardId, controller: "A" }, 1),
    );
    s = applyEvent(
      s,
      ev(
        "MOVE",
        {
          instanceId: "tok_A_1",
          from: { zone: "monde" },
          to: { zone: "defausse", owner: "A" },
          position: { at: "top" },
          visibility: { faceDown: false, visibleTo: "all" },
          preservesIdentity: false,
        },
        2,
      ),
    );
    // Le jeton n'est NI dans la Défausse NI dans les instances : il a disparu.
    expect(s.instances["tok_A_1"]).toBeUndefined();
    expect(s.seats.A.defausse).not.toContain("tok_A_1");
    expect(s.monde).not.toContain("tok_A_1");
  });

  it("CREATE_TOKEN idempotent au reducer : une instanceId existante n'est pas dupliquée", () => {
    resetTokenRegistry();
    const cardId = tokenCardId({ name: "Monstre - Arakne", force: 1 });
    let s: GameState = emptyState();
    s.status = "active";
    const e = ev(
      "CREATE_TOKEN",
      { instanceId: "tok_A_1", cardId, controller: "A" },
      1,
    );
    s = applyEvent(s, e);
    s = applyEvent(s, { ...e, seq: 2, parentSeq: 1 });
    expect(s.monde.filter((id) => id === "tok_A_1")).toHaveLength(1);
  });
});

// ── Volet 2 : moteur isolé ───────────────────────────────────────────────────
const MONSTRE_CARD: Card = {
  id: "cardMonstre",
  name: "Un Monstre",
  mainType: "Allié",
  extension: "Test",
  rarity: "Commune",
  subTypes: ["Monstre"],
  stats: { force: { value: 3, element: "Feu" } },
} as unknown as Card;

const HERO_CARD: Card = {
  id: "cardHeroA",
  name: "Héros A",
  mainType: "Héros",
  extension: "Test",
  rarity: "Commune",
} as unknown as Card;

function makeState(opts: { monstreInPlay?: boolean } = {}): GameState {
  const { monstreInPlay = true } = opts;
  const inst = (id: string, cardId: string, controller: "A" | "B") => ({
    instanceId: id,
    cardId,
    owner: controller,
    controller,
    orientation: "upright" as const,
    location: { zone: "monde" as const },
    counters: {},
    attachments: [],
    revealedTo: ["A", "B"],
  });
  const instances: Record<string, unknown> = {
    "hero-A": inst("hero-A", "cardHeroA", "A"),
    "hero-B": inst("hero-B", "cardHeroA", "B"),
  };
  const monde = ["hero-A", "hero-B"];
  if (monstreInPlay) {
    instances.m1 = inst("m1", "cardMonstre", "A");
    monde.push("m1");
  }
  return {
    turn: { active: "A", number: 1 },
    monde,
    instances,
    seats: {
      A: {
        main: [],
        pioche: [],
        defausse: [],
        havreSac: [],
        heroInstanceId: "hero-A",
      },
      B: {
        main: [],
        pioche: [],
        defausse: [],
        havreSac: [],
        heroInstanceId: "hero-B",
      },
    },
  } as unknown as GameState;
}

function mockDeps(
  state: GameState,
  over: Partial<EffectEngineDeps> = {},
): EffectEngineDeps {
  const getCard = (id: string | null) =>
    id === "cardMonstre"
      ? MONSTRE_CARD
      : id === "cardHeroA"
        ? HERO_CARD
        : getTokenCard(id);
  return {
    getState: () => state,
    rulesCtx: () => ({ state, getCard }),
    getCard,
    isAssist: () => true,
    isAssistEffects: () => true,
    getMatchPhase: () => "playing",
    playerName: () => "Joueur",
    paOf: () => 6,
    dispatch: vi.fn(),
    moveTo: vi.fn(),
    shufflePioche: vi.fn(),
    checkVictory: vi.fn(),
    draw: vi.fn(),
    adjustCounter: vi.fn(),
    onMatchWon: vi.fn(),
    ...over,
  };
}

describe("moteur — createToken (isolé)", () => {
  it("dispatche un CREATE_TOKEN avec le cardId synthétique et l'enregistre", () => {
    const state = makeState({ monstreInPlay: false });
    const dispatch = vi.fn();
    const engine = createEffectEngine(mockDeps(state, { dispatch }));
    engine.enqueueEffect({
      seat: "A",
      cardName: "Abraknyde",
      sourceId: "hero-A",
      ops: [
        {
          op: "createToken",
          name: "Monstre - Arakne",
          force: 1,
          sub: "Arakne",
          element: "Terre",
        },
      ],
    });
    const expectedCardId = tokenCardId({
      name: "Monstre - Arakne",
      force: 1,
      sub: "Arakne",
      element: "Terre",
    });
    const created = dispatch.mock.calls
      .flat()
      .find((d) => d?.type === "CREATE_TOKEN");
    expect(created).toBeDefined();
    expect(created.payload.cardId).toBe(expectedCardId);
    expect(created.payload.controller).toBe("A");
    // la carte synthétique est désormais résolvable.
    expect(getTokenCard(expectedCardId)?.subTypes).toEqual([
      "Monstre",
      "Arakne",
    ]);
    expect(engine.effectQueue.value).toHaveLength(0);
  });

  it("costRecycleControlled : ouvre un ciblage parmi VOS Monstres en jeu, recycle la cible PUIS crée le jeton", () => {
    const state = makeState({ monstreInPlay: true });
    const dispatch = vi.fn();
    const engine = createEffectEngine(mockDeps(state, { dispatch }));
    engine.enqueueEffect({
      seat: "A",
      cardName: "Vampyro",
      sourceId: "hero-A",
      ops: [
        {
          op: "costRecycleControlled",
          sub: "monstre",
          zones: ["monde", "havreSac"],
        },
        {
          op: "createToken",
          name: "Monstre - Vampyre",
          force: 1,
          sub: "Vampyre",
        },
      ],
    });
    // pause sur le ciblage du coût ; seul VOTRE Monstre (m1) est éligible.
    expect(engine.effectTargeting.value).not.toBeNull();
    expect(engine.effectTargetIdsList.value).toEqual(["m1"]);
    engine.effectTargetChoose("m1");
    // m1 recyclé sous la Pioche de son propriétaire (MOVE).
    const recycled = dispatch.mock.calls
      .flat()
      .find((d) => d?.type === "MOVE" && d.payload?.instanceId === "m1");
    expect(recycled?.payload.to).toEqual({ zone: "pioche", owner: "A" });
    // puis le corps : un jeton Vampyre est créé.
    const created = dispatch.mock.calls
      .flat()
      .find((d) => d?.type === "CREATE_TOKEN");
    expect(created?.payload.cardId).toBe(
      tokenCardId({ name: "Monstre - Vampyre", force: 1, sub: "Vampyre" }),
    );
    expect(engine.effectTargeting.value).toBeNull();
    expect(engine.effectQueue.value).toHaveLength(0);
  });

  it("costRecycleControlled SANS Monstre éligible : coût non payable → corps non exécuté", () => {
    const state = makeState({ monstreInPlay: false });
    const dispatch = vi.fn();
    const engine = createEffectEngine(mockDeps(state, { dispatch }));
    engine.enqueueEffect({
      seat: "A",
      cardName: "Vampyro",
      sourceId: "hero-A",
      ops: [
        {
          op: "costRecycleControlled",
          sub: "monstre",
          zones: ["monde", "havreSac"],
        },
        {
          op: "createToken",
          name: "Monstre - Vampyre",
          force: 1,
          sub: "Vampyre",
        },
      ],
    });
    expect(engine.effectTargeting.value).toBeNull();
    expect(
      dispatch.mock.calls.flat().some((d) => d?.type === "CREATE_TOKEN"),
    ).toBe(false);
    expect(engine.effectQueue.value).toHaveLength(0);
  });
});
