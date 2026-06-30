import { test, expect, type Page } from "@playwright/test";

// ───────────────────────── Helpers ──────────────────────────────────────
// L'app est cloud-only : /decks, /deck-builder sont protégés par un garde
// `requiresAuth`. Pour tester ces pages sans backend réel, on injecte un
// utilisateur directement dans le store Pinia (aucun appel Supabase), puis on
// navigue côté client (router.push) pour que l'état d'auth survive (un
// page.goto rechargerait la page et réinitialiserait Pinia).

/** Injecte un utilisateur authentifié dans le store Pinia `auth`. */
async function authenticate(page: Page): Promise<void> {
  await page.evaluate(() => {
    const gp = (document.querySelector("#app") as any)?.__vue_app__?.config
      ?.globalProperties;
    const auth = gp?.$pinia?._s?.get("auth");
    if (auth) auth.user = { id: "e2e-user", email: "e2e@test.local" };
  });
}

/** Navigation SPA (sans rechargement) — l'état Pinia injecté est conservé. */
async function spaNavigate(page: Page, path: string): Promise<void> {
  await page.evaluate((p) => {
    const gp = (document.querySelector("#app") as any)?.__vue_app__?.config
      ?.globalProperties;
    gp?.$router?.push(p);
  }, path);
}

/** Va sur une route protégée en tant qu'utilisateur connecté. */
async function gotoAuthed(page: Page, path: string): Promise<void> {
  await page.goto("/");
  await authenticate(page);
  await spaNavigate(page, path);
}

/** Attend que le catalogue de cartes soit chargé dans le store. */
async function waitForCatalog(page: Page): Promise<void> {
  await page.waitForFunction(
    () => {
      const gp = (document.querySelector("#app") as any)?.__vue_app__?.config
        ?.globalProperties;
      const cards = gp?.$pinia?._s?.get("cards")?.cards;
      return Array.isArray(cards) && cards.length > 0;
    },
    { timeout: 20000 },
  );
}

/** Construit deux decks valides depuis le catalogue et les injecte dans le store. */
async function seedValidDecks(page: Page): Promise<void> {
  await page.evaluate(() => {
    const gp = (document.querySelector("#app") as any)?.__vue_app__?.config
      ?.globalProperties;
    const cards = gp?.$pinia?._s?.get("cards")?.cards ?? [];
    const deckStore = gp?.$pinia?._s?.get("deck");
    const clone = (x: unknown) => JSON.parse(JSON.stringify(x));
    const hero = cards.find((c: any) => c.mainType === "Héros");
    const havreSac = cards.find((c: any) => c.mainType === "Havre-Sac");
    // 48 Alliés DISTINCTS en 1 exemplaire : valide même pour les cartes
    // « Unique » (1 copie max), donc on n'a pas à filtrer le trait Unique.
    const allies = cards
      .filter((c: any) => c.mainType === "Allié")
      .slice(0, 48);
    const mk = (id: string, name: string) => ({
      id,
      name,
      hero: clone(hero),
      havreSac: clone(havreSac),
      cards: allies.map((a: any) => ({
        card: clone(a),
        quantity: 1,
        isReserve: false,
      })),
      reserve: [],
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
    deckStore.decks = [mk("e2e-a", "Deck E2E A"), mk("e2e-b", "Deck E2E B")];
  });
}

// ───────────────────────── Tests ────────────────────────────────────────

test.describe("Navigation principale", () => {
  test("devrait afficher la page d'accueil", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/Wakfu/);
    await expect(
      page.getByText("Wakfu TCG — Constructeur de deck"),
    ).toBeVisible();
  });

  test("devrait naviguer vers la collection", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Collection", exact: true }).click();
    await expect(page).toHaveURL(/\/collection/);
  });

  test("devrait naviguer vers les decks (utilisateur connecté)", async ({
    page,
  }) => {
    await page.goto("/");
    await authenticate(page);
    await page.getByRole("link", { name: "Decks", exact: true }).click();
    await expect(page).toHaveURL(/\/decks/);
  });

  test("devrait avoir un lien de navigation au clavier", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("Tab");
    const skipLink = page.locator('a[href="#main-content"]');
    await expect(skipLink).toBeFocused();
  });
});

test.describe("Thème", () => {
  test("devrait basculer entre les thèmes clair et sombre", async ({
    page,
  }) => {
    await page.goto("/");
    const html = page.locator("html");
    const initialTheme = await html.getAttribute("data-theme");

    const themeButton = page.getByTestId("theme-toggle");
    await expect(themeButton).toBeVisible();
    await themeButton.click();

    await expect(html).not.toHaveAttribute("data-theme", initialTheme ?? "");
  });
});

test.describe("Collection", () => {
  test("devrait afficher les filtres de recherche", async ({ page }) => {
    await page.goto("/collection");
    await expect(
      page.locator('input[placeholder*="Rechercher"]'),
    ).toBeVisible();
    await expect(page.locator('select[aria-label*="extension"]')).toBeVisible();
  });

  test("devrait filtrer les cartes par recherche textuelle", async ({
    page,
  }) => {
    await page.goto("/collection");
    // Attendre le rendu de la grille (au lieu d'un sleep arbitraire).
    const cards = page.locator('[role="listitem"]');
    await expect(cards.first()).toBeVisible({ timeout: 15000 });

    const search = page.locator('input[placeholder*="Rechercher"]');
    // Une requête sans résultat vide la grille : le filtre texte s'applique.
    await search.fill("zzzznoperesultat");
    await expect(page.getByText("Aucune carte trouvée")).toBeVisible({
      timeout: 10000,
    });

    // En effaçant la recherche, les cartes réapparaissent.
    await search.fill("");
    await expect(cards.first()).toBeVisible({ timeout: 10000 });
  });

  test("devrait filtrer par extension", async ({ page }) => {
    await page.goto("/collection");
    const extensionSelect = page.locator('select[aria-label*="extension"]');
    await expect(extensionSelect).toBeVisible();
    const options = await extensionSelect.locator("option").allTextContents();
    expect(options.length).toBeGreaterThan(1);
  });

  test("devrait filtrer par rareté", async ({ page }) => {
    await page.goto("/collection");
    await expect(page.locator('select[aria-label*="rareté"]')).toBeVisible();
  });

  test("devrait filtrer par élément", async ({ page }) => {
    await page.goto("/collection");
    await expect(page.locator('select[aria-label*="élément"]')).toBeVisible();
  });
});

test.describe("Decks", () => {
  test("devrait afficher la liste des decks", async ({ page }) => {
    await gotoAuthed(page, "/decks");
    await expect(
      page.getByRole("heading", { name: "Mes decks" }),
    ).toBeVisible();
  });

  test("devrait pouvoir créer un nouveau deck", async ({ page }) => {
    await gotoAuthed(page, "/decks");
    const newDeckBtn = page.getByRole("link", { name: /Nouveau deck/i });
    await expect(newDeckBtn).toBeVisible();
    await newDeckBtn.click();
    await expect(page).toHaveURL(/\/deck-builder/);
  });

  test("devrait afficher le lien vers les decks officiels", async ({
    page,
  }) => {
    await gotoAuthed(page, "/decks");
    const officialLink = page.getByRole("link", { name: /Decks officiels/i });
    await expect(officialLink).toBeVisible();
    await officialLink.click();
    await expect(page).toHaveURL(/\/decks\/official/);
  });
});

test.describe("Deck Builder", () => {
  test("devrait afficher le formulaire de construction", async ({ page }) => {
    await gotoAuthed(page, "/deck-builder");
    // Intitulé de la section « Héros » du constructeur (libellé eyebrow,
    // pas une <option> de filtre qui serait masquée).
    await expect(
      page.locator("span.eyebrow", { hasText: "Héros" }).first(),
    ).toBeVisible();
  });

  test("devrait afficher les filtres de collection", async ({ page }) => {
    await gotoAuthed(page, "/deck-builder");
    await expect(
      page.locator('input[placeholder*="Rechercher"]'),
    ).toBeVisible();
  });

  test("devrait afficher le compteur de cartes", async ({ page }) => {
    await gotoAuthed(page, "/deck-builder");
    await waitForCatalog(page);
    // Compteur du panneau de deck (testid stable : le libellé d'onglet mobile
    // « Deck 0/48 » contient aussi « 0/48 » mais reste caché ≥ xl).
    await expect(page.getByTestId("deck-count")).toContainText("0/48");
  });

  test("filtre par texte d'effet + zoom avant ajout (le clic n'ajoute pas)", async ({
    page,
  }) => {
    await gotoAuthed(page, "/deck-builder");
    await waitForCatalog(page);
    await expect(page.getByTestId("deck-count")).toContainText("0/48");

    // Filtre avancé « dans les effets » : présent et filtrant
    const effectInput = page.locator('[data-testid="filter-effect-query"]');
    await expect(effectInput).toBeVisible();
    await effectInput.fill("invocation");
    await expect(
      page.locator('[data-testid="pool-tile"]').first(),
    ).toBeVisible();
    await effectInput.fill("");

    // Cliquer une carte OUVRE la lecture détaillée (modale) …
    await page.locator('[data-testid="pool-tile"]').first().click();
    await expect(page.getByTestId("card-zoom")).toBeVisible();
    // … mais N'AJOUTE PAS : le deck reste à 0/48 (fin du piège clic = ajout)
    await expect(page.getByTestId("deck-count")).toContainText("0/48");
  });
});

test.describe("Partage de deck", () => {
  test("devrait gérer un lien de partage invalide", async ({ page }) => {
    await page.goto("/deck/share?deck=invalid-data");
    // La page ne crashe pas : le contenu principal reste rendu.
    await expect(page.locator("#main-content")).toBeVisible();
  });
});

test.describe("Table de jeu (/play/table)", () => {
  test("« Partie » (/play) mène directement au module de jeu", async ({
    page,
  }) => {
    // L'ancien compagnon (compteurs PV / chrono) a été retiré : /play redirige
    // vers le lobby de la table.
    await page.goto("/play");
    await expect(page).toHaveURL(/\/play\/table/);
  });

  test("devrait dérouler une partie locale (mulligan → plateau)", async ({
    page,
  }) => {
    await page.goto("/play/table");
    await waitForCatalog(page);
    await seedValidDecks(page);

    // Le hot-seat n'est plus exposé dans le lobby (« en ligne uniquement ») : on
    // lance une partie locale directement via le store pour couvrir le plateau,
    // le mulligan et la passation.
    await page.evaluate(() => {
      const gp = (document.querySelector("#app") as any)?.__vue_app__?.config
        ?.globalProperties;
      const deckStore = gp.$pinia._s.get("deck");
      const game = gp.$pinia._s.get("game");
      const [a, b] = deckStore.decks;
      game.startMatch(a, b ?? a, { nameA: "J1", nameB: "J2" });
    });

    // Hot-seat : on draine les écrans de passation + mulligan des deux joueurs
    // jusqu'à ce que le plateau apparaisse (le bouton « Fin du tour »).
    const endTurn = page.getByTestId("end-turn");
    const reveal = page.getByTestId("passation-reveal");
    const keep = page.getByTestId("mulligan-keep");
    for (let i = 0; i < 8; i++) {
      if (await endTurn.isVisible()) break;
      if (await reveal.isVisible()) {
        await reveal.click();
      } else if (await keep.isVisible()) {
        await keep.click();
      } else {
        await expect(endTurn.or(reveal).or(keep).first()).toBeVisible();
      }
    }

    await expect(endTurn).toBeVisible();
  });

  test("lobby en ligne : deck pré-sélectionné, « Créer la partie » actif", async ({
    page,
  }) => {
    await gotoAuthed(page, "/play/table");
    await waitForCatalog(page);
    await seedValidDecks(page);

    // Panneau « Créer » ouvert d'emblée + deck pré-sélectionné → le bouton doit
    // être actif sans interaction (corrige l'ancien bouton grisé « marche pas »).
    const creer = page.getByRole("button", { name: "Créer la partie" });
    await expect(creer).toBeVisible();
    await expect(creer).toBeEnabled();
    // Le mode hot-seat local n'est plus présent dans le lobby.
    await expect(page.getByTestId("lobby-deck-pick")).toHaveCount(0);

    // Une fois CONNECTÉ en ligne (après « Créer la partie »), le lobby cède la
    // place à l'écran d'attente avec le code — il ne doit PAS rester bloqué sur
    // le lobby (régression : matchPhase reste 'lobby' tant que l'adversaire n'a
    // pas rejoint, donc le rendu doit dépendre de store.online).
    await page.evaluate(() => {
      const gp = (document.querySelector("#app") as any).__vue_app__.config
        .globalProperties;
      gp.$pinia._s.get("game").online = true;
    });
    await expect(
      page.getByRole("heading", { name: "Nouvelle partie" }),
    ).toBeHidden();
    await expect(page.getByText("En attente de l'adversaire")).toBeVisible();
  });

  test("devrait lancer le tutoriel interactif (découverte)", async ({
    page,
  }) => {
    await page.goto("/play/table");
    await waitForCatalog(page);

    // Bouton « Apprendre à jouer » du lobby (actif une fois le catalogue prêt).
    const startBtn = page.getByTestId("lobby-start-tutorial");
    await expect(startBtn).toBeEnabled();
    await startBtn.click();

    // Le coach apparaît sur la 1re étape de la leçon « découverte » (12 étapes).
    const progress = page.getByTestId("tutorial-progress");
    await expect(progress).toBeVisible();
    await expect(progress).toContainText("/ 12");

    // On peut quitter le tutoriel via « Passer le tutoriel ».
    await page.getByTestId("tutorial-skip").click();
    await expect(progress).toBeHidden();
  });

  test("devrait dérouler un combat (attaque → résolution → dégâts)", async ({
    page,
  }) => {
    await page.goto("/play/table");
    await waitForCatalog(page);

    // Plateau de combat légal via la leçon « combat » (attaquant prêt avec
    // Force + bloqueur adverse), puis skip() pour retirer coach/bot/auto-
    // avancement et piloter le combat de façon déterministe.
    const setup = await page.evaluate(() => {
      const gp = (document.querySelector("#app") as any)?.__vue_app__?.config
        ?.globalProperties;
      const pinia = gp?.$pinia;
      const tut = pinia?._s?.get("tutorial");
      const game = pinia?._s?.get("game");
      const ok = tut?.startLesson?.("combat") ?? false;
      tut?.skip?.();
      return { ok, atkId: game?.eligibleAttackerIds?.[0] ?? null };
    });
    expect(setup.ok).toBe(true);
    expect(setup.atkId).toBeTruthy();

    // 1) Sélectionner l'attaquant → barre d'action → « ⚔ Attaquer ».
    await page.getByTestId(`card-${setup.atkId}`).click();
    await page.getByTestId("action-attack").click();
    // La barre de combat apparaît.
    await expect(page.locator(".gcombat")).toBeVisible();

    // 2) Cibler un Allié adverse (702.2) — il encaisse la Force sans la
    // Résistance du Havre-Sac. Le clic sur une carte adverse est peu fiable dans
    // le viewport de test (recouvrement par la bannière) ; on fixe la cible via
    // le store puis on enchaîne par les boutons de la barre de combat (UI).
    const target = await page.evaluate(() => {
      const gp = (document.querySelector("#app") as any)?.__vue_app__?.config
        ?.globalProperties;
      const pinia = gp?.$pinia;
      const game = pinia?._s?.get("game");
      const cards = pinia?._s?.get("cards")?.cards ?? [];
      const ids: string[] = game?.combatTargetIds ?? [];
      const allyId =
        ids.find((id) => {
          const inst = game.state.instances[id];
          return (
            cards.find((c: any) => c.id === inst?.cardId)?.mainType === "Allié"
          );
        }) ?? ids[0];
      if (allyId) game.combatChooseTarget(allyId);
      const inst = allyId ? game.state.instances[allyId] : null;
      return { id: allyId ?? null, dmgBefore: inst?.counters?.damage ?? 0 };
    });
    expect(target.id).toBeTruthy();

    // 3) Confirmer puis résoudre via l'UI (pas de bloqueur → frappe directe).
    await page.getByTestId("combat-confirm").click();
    await page.getByTestId("combat-resolve").click();
    // Combat résolu : la barre disparaît.
    await expect(page.locator(".gcombat")).toBeHidden();

    // 4) Le combat a eu lieu : l'attaquant est incliné (déclaration) et la cible
    //    a pris des dégâts (ou a été détruite, donc retirée du Monde).
    const result = await page.evaluate(
      (arg) => {
        const { atkId, tid } = arg as { atkId: string; tid: string };
        const gp = (document.querySelector("#app") as any)?.__vue_app__?.config
          ?.globalProperties;
        const game = gp?.$pinia?._s?.get("game");
        const atk = game?.state?.instances?.[atkId];
        const tgt = game?.state?.instances?.[tid];
        const inMonde = (game?.state?.seats?.B?.monde ?? []).includes(tid);
        return {
          tapped: atk?.orientation === "tapped",
          dmg: tgt?.counters?.damage ?? 0,
          inMonde,
        };
      },
      { atkId: setup.atkId, tid: target.id },
    );
    expect(result.tapped).toBe(true);
    expect(result.dmg > target.dmgBefore || !result.inMonde).toBe(true);
  });
});

test.describe("PWA", () => {
  test("devrait avoir un manifest web", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator('link[rel="manifest"]')).toHaveCount(1);
  });

  test("devrait enregistrer un service worker", async ({ page }) => {
    await page.goto("/");
    // Attendre l'enregistrement du SW de façon déterministe (au lieu d'un sleep).
    const swRegistered = await page
      .waitForFunction(
        async () => {
          if (!("serviceWorker" in navigator)) return false;
          const regs = await navigator.serviceWorker.getRegistrations();
          return regs.length > 0;
        },
        { timeout: 15000 },
      )
      .then(() => true)
      .catch(() => false);
    expect(swRegistered).toBe(true);
  });
});

test.describe("Accessibilité", () => {
  test('devrait avoir lang="fr" sur le html', async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("lang", "fr");
  });

  test("devrait avoir des meta descriptions", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator('meta[name="description"]')).toHaveCount(1);
  });

  test("devrait avoir un contenu principal avec id", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#main-content")).toBeVisible();
  });

  test("tous les inputs doivent avoir des labels", async ({ page }) => {
    await page.goto("/collection");
    const inputs = page.locator(
      'input:not([type="hidden"]):not([type="checkbox"])',
    );
    // Au moins un input rendu (sinon le test passerait à vide).
    await expect(inputs.first()).toBeVisible({ timeout: 15000 });

    const count = await inputs.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < Math.min(count, 10); i++) {
      const input = inputs.nth(i);
      const ariaLabel = await input.getAttribute("aria-label");
      const id = await input.getAttribute("id");
      const placeholder = await input.getAttribute("placeholder");
      expect(ariaLabel || id || placeholder).toBeTruthy();
    }
  });
});
