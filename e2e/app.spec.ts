import { test, expect } from "@playwright/test";

test.describe("Navigation principale", () => {
  test("devrait afficher la page d'accueil", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/Wakfu/);
    await expect(page.locator("text=Wakfu Deck Builder")).toBeVisible();
  });

  test("devrait naviguer vers la collection", async ({ page }) => {
    await page.goto("/");
    await page.click("text=Collection");
    await expect(page).toHaveURL(/\/collection/);
  });

  test("devrait naviguer vers les decks", async ({ page }) => {
    await page.goto("/");
    await page.click("text=Decks");
    await expect(page).toHaveURL(/\/decks/);
  });

  test("devrait avoir un lien de navigation au clavier", async ({ page }) => {
    await page.goto("/");
    // Skip nav link should be first focusable element
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

    // Récupérer le thème initial
    const initialTheme = await html.getAttribute("data-theme");

    // Trouver et cliquer sur le bouton de thème
    const themeButton = page.locator(
      '[aria-label*="thème"], [aria-label*="Thème"], button:has(svg)',
    );
    if ((await themeButton.count()) > 0) {
      await themeButton.first().click();
      const newTheme = await html.getAttribute("data-theme");
      expect(newTheme).not.toBe(initialTheme);
    }
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

    // Attendre que les cartes soient chargées
    await page.waitForTimeout(2000);

    const searchInput = page.locator('input[placeholder*="Rechercher"]');
    await searchInput.fill("Feca");
    await page.waitForTimeout(500);

    // Les cartes affichées devraient contenir "Feca"
    const visibleCards = page.locator("[data-card-name]");
    if ((await visibleCards.count()) > 0) {
      const firstName = await visibleCards
        .first()
        .getAttribute("data-card-name");
      expect(firstName?.toLowerCase()).toContain("feca");
    }
  });

  test("devrait filtrer par extension", async ({ page }) => {
    await page.goto("/collection");
    await page.waitForTimeout(2000);

    const extensionSelect = page.locator('select[aria-label*="extension"]');
    const options = await extensionSelect.locator("option").allTextContents();
    expect(options.length).toBeGreaterThan(1);
  });

  test("devrait filtrer par rareté", async ({ page }) => {
    await page.goto("/collection");
    const raritySelect = page.locator('select[aria-label*="rareté"]');
    await expect(raritySelect).toBeVisible();
  });

  test("devrait filtrer par élément", async ({ page }) => {
    await page.goto("/collection");
    const elementSelect = page.locator('select[aria-label*="élément"]');
    await expect(elementSelect).toBeVisible();
  });
});

test.describe("Decks", () => {
  test("devrait afficher la liste des decks", async ({ page }) => {
    await page.goto("/decks");
    await expect(page.locator("text=Mes Decks")).toBeVisible();
  });

  test("devrait pouvoir créer un nouveau deck", async ({ page }) => {
    await page.goto("/decks");

    // Cliquer sur "Nouveau deck"
    const newDeckBtn = page.locator("text=Nouveau deck");
    if ((await newDeckBtn.count()) > 0) {
      await newDeckBtn.click();
      await expect(page).toHaveURL(/\/deck-builder/);
    }
  });

  test("devrait afficher le lien vers les decks officiels", async ({
    page,
  }) => {
    await page.goto("/decks");
    const officialLink = page.locator("text=Decks officiels");
    if ((await officialLink.count()) > 0) {
      await officialLink.click();
      await expect(page).toHaveURL(/\/decks\/official/);
    }
  });
});

test.describe("Deck Builder", () => {
  test("devrait afficher le formulaire de construction", async ({ page }) => {
    await page.goto("/deck-builder");

    // Vérifier la présence des sections clés
    await expect(
      page.getByRole("heading", { name: "Héros", exact: true }),
    ).toBeVisible();
  });

  test("devrait afficher les filtres de collection", async ({ page }) => {
    await page.goto("/deck-builder");
    await expect(
      page.locator('input[placeholder*="Rechercher"]'),
    ).toBeVisible();
  });

  test("devrait afficher le compteur de cartes", async ({ page }) => {
    await page.goto("/deck-builder");
    // Le compteur "Cartes (0 / 48)" devrait être visible
    await expect(page.getByText("0 / 48")).toBeVisible();
  });
});

test.describe("Partage de deck", () => {
  test("devrait gérer un lien de partage invalide", async ({ page }) => {
    await page.goto("/deck/share?deck=invalid-data");
    // Devrait afficher un message d'erreur ou la page de partage
    await page.waitForTimeout(1000);
    // La page ne devrait pas crasher
    await expect(page.locator("body")).toBeVisible();
  });
});

test.describe("PWA", () => {
  test("devrait avoir un manifest web", async ({ page }) => {
    await page.goto("/");
    const manifest = page.locator('link[rel="manifest"]');
    await expect(manifest).toHaveCount(1);
  });

  test("devrait enregistrer un service worker", async ({ page }) => {
    await page.goto("/");
    // Attendre que le SW s'enregistre
    await page.waitForTimeout(3000);

    const swRegistered = await page.evaluate(async () => {
      if ("serviceWorker" in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        return registrations.length > 0;
      }
      return false;
    });
    expect(swRegistered).toBe(true);
  });
});

test.describe("Accessibilité", () => {
  test('devrait avoir lang="fr" sur le html', async ({ page }) => {
    await page.goto("/");
    const lang = await page.locator("html").getAttribute("lang");
    expect(lang).toBe("fr");
  });

  test("devrait avoir des meta descriptions", async ({ page }) => {
    await page.goto("/");
    const desc = page.locator('meta[name="description"]');
    await expect(desc).toHaveCount(1);
  });

  test("devrait avoir un contenu principal avec id", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#main-content")).toBeVisible();
  });

  test("tous les inputs doivent avoir des labels", async ({ page }) => {
    await page.goto("/collection");
    await page.waitForTimeout(1000);

    const inputs = page.locator(
      'input:not([type="hidden"]):not([type="checkbox"])',
    );
    const count = await inputs.count();

    for (let i = 0; i < Math.min(count, 10); i++) {
      const input = inputs.nth(i);
      const ariaLabel = await input.getAttribute("aria-label");
      const id = await input.getAttribute("id");
      const placeholder = await input.getAttribute("placeholder");
      // Input should have either aria-label, associated label, or placeholder
      expect(ariaLabel || id || placeholder).toBeTruthy();
    }
  });
});
