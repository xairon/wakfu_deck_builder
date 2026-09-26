import { test, expect, type Page } from "@playwright/test";

// Helpers pour l'authentification et l'injection SPA
async function authenticate(page: Page): Promise<void> {
  await page.evaluate(() => {
    const gp = (document.querySelector("#app") as any)?.__vue_app__?.config
      ?.globalProperties;
    const auth = gp?.$pinia?._s?.get("auth");
    if (auth) auth.user = { id: "e2e-custom-user", email: "custom@test.local" };
  });
}

async function spaNavigate(page: Page, path: string): Promise<void> {
  await page.evaluate((p) => {
    const gp = (document.querySelector("#app") as any)?.__vue_app__?.config
      ?.globalProperties;
    gp?.$router?.push(p);
  }, path);
}

async function gotoAuthed(page: Page, path: string): Promise<void> {
  await page.goto("/");
  await authenticate(page);
  await spaNavigate(page, path);
}

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

test.describe("Custom Cards E2E Workflow", () => {
  test.beforeEach(async ({ page }) => {
    // Nettoyer le localStorage avant chaque test
    await page.addInitScript(() => {
      window.localStorage.removeItem("wakfu-custom-cards");
    });
  });

  test("1. Création d'une carte personnalisée avec live preview et persistance", async ({
    page,
  }) => {
    await gotoAuthed(page, "/custom-card-creator");

    // Vérifier l'en-tête de la page
    await expect(
      page.getByRole("heading", { name: "Créateur de Cartes Personnalisées" }),
    ).toBeVisible();

    // Remplir le formulaire
    await page.fill('input[placeholder*="ex: Yugo"]', "Goultard Le Grand");
    await page.selectOption("select", "Allié");
    await page.fill(
      'input[placeholder*="Eliatrope, Tofu"]',
      "Iop, Demi-Dieu",
    );
    await page.fill(
      'input[placeholder*="https://images.unsplash.com"]',
      "https://example.com/goultard.webp",
    );

    // Vérifier la mise à jour en temps réel dans la prévisualisation (Live Preview)
    const preview = page.locator("div.w-64");
    await expect(preview).toBeVisible();
    await expect(preview.getByText("Goultard Le Grand")).toBeVisible();
    await expect(preview.getByText("Iop · Demi-Dieu")).toBeVisible();

    // Soumettre le formulaire
    await page.getByRole("button", { name: /Créer et Enregistrer/i }).click();

    // Vérifier le message de confirmation
    await expect(
      page.getByText(/La carte "Goultard Le Grand" a été créée avec succès/i),
    ).toBeVisible();

    // Ouvrir le modal 'Mes cartes' et vérifier la présence
    await page.getByRole("button", { name: /Mes cartes/i }).click();
    await expect(page.getByText("Goultard Le Grand").first()).toBeVisible();
  });

  test("2. Recherche et inclusion des Custom Cards dans le Deck Builder", async ({
    page,
  }) => {
    // 1) Injecter une custom card dans le localStorage
    await page.addInitScript(() => {
      const customCard = {
        id: "custom_e2e_test_card",
        user_id: "e2e-custom-user",
        name: "Yugo Roi des Eliatropes",
        main_type: "Allié",
        card_data: {
          id: "custom_e2e_test_card",
          name: "Yugo Roi des Eliatropes",
          mainType: "Allié",
          subTypes: ["Eliatrope", "Roi"],
          extension: { id: "custom", name: "Cartes Personnalisées" },
          rarity: "Légendaire",
          element: "Air",
          stats: {
            niveau: { value: 3, element: "Air" },
            force: { value: 4, element: "Air" },
            pv: 8,
            pa: 2,
            pm: 1,
          },
          effects: [{ description: "Téléporte un allié adjacent." }],
          artists: ["Création Joueur"],
          imageUrl: "https://example.com/yugo.webp",
          isCustom: true,
          authorId: "e2e-custom-user",
          isPublic: true,
        },
        image_url: "https://example.com/yugo.webp",
        is_public: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      window.localStorage.setItem(
        "wakfu-custom-cards",
        JSON.stringify([customCard]),
      );
    });

    await gotoAuthed(page, "/deck-builder");
    await waitForCatalog(page);

    // Activer le toggle "Inclure les Custom Cards"
    const customToggle = page.getByTestId("include-custom-cards-toggle");
    await expect(customToggle).toBeVisible();
    await customToggle.check();

    // Rechercher la carte par son nom
    const searchInput = page.locator('input[placeholder*="Rechercher"]');
    await searchInput.fill("Yugo Roi des Eliatropes");

    // Vérifier que la custom card est visible dans le pool (via son image et son bouton d'ajout)
    const cardImg = page.locator('img[alt="Yugo Roi des Eliatropes"]');
    await expect(cardImg).toBeVisible();

    // Cliquer sur le bouton d'ajout express '+'
    const addBtn = page.getByRole("button", {
      name: "Ajouter Yugo Roi des Eliatropes au deck",
    });
    await expect(addBtn).toBeAttached();
    // Le bouton express a une classe group-hover, on clique avec force pour l'ajouter
    await addBtn.click({ force: true });

    // Vérifier que le compteur du deck passe à 1/48
    await expect(page.getByTestId("deck-count")).toContainText("1/48");
  });

  test("3. Sélection du mode de jeu et option Custom Cards sur la Table de Jeu", async ({
    page,
  }) => {
    await page.goto("/play/table");
    await waitForCatalog(page);

    // Vérifier la présence des 4 modes de jeu
    await expect(page.getByText("Seul contre soi-même")).toBeVisible();
    await expect(page.getByText("1v1 En Ligne")).toBeVisible();
    await expect(page.getByText("2v2 En Équipe")).toBeVisible();
    await expect(page.getByText("Tutoriel d'Apprentissage")).toBeVisible();

    // Vérifier que chaque carte dispose de l'option "Autoriser les Custom Cards"
    const toggles = page.locator(
      'input[type="checkbox"]',
    );
    const customCardLabels = page.getByText("Autoriser les Custom Cards");
    await expect(customCardLabels).toHaveCount(4);

    // Basculer sur le mode 1v1 En Ligne
    await page.getByText("1v1 En Ligne").click();
    await expect(
      page.getByRole("heading", { name: "Parties en ligne (1v1 Duel)" }),
    ).toBeVisible();

    // Basculer sur le mode Seul contre soi-même (Sandbox)
    await page.getByText("Seul contre soi-même").click();
    await expect(
      page.getByRole("heading", { name: "Bac à sable & Hot-seat" }),
    ).toBeVisible();
  });
});
