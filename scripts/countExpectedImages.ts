import * as fs from "fs";
import * as path from "path";
import { glob } from "glob";

interface Card {
  id: string;
  mainType: string;
}

async function countExpectedImages(): Promise<void> {
  // Trouver tous les fichiers JSON
  const jsonFiles = await glob("data/*.json");
  const allCards: Card[] = [];

  // Charger toutes les cartes
  for (const jsonFile of jsonFiles) {
    try {
      const fileContent = fs.readFileSync(jsonFile, "utf-8");
      const cards: Card[] = JSON.parse(fileContent);
      allCards.push(...cards);
    } catch (error) {
      console.error(
        `❌ Erreur lors de la lecture du fichier ${jsonFile}:`,
        error,
      );
    }
  }

  // Compter les images attendues
  const heroCount = allCards.filter((card) => card.mainType === "Héros").length;
  const nonHeroCount = allCards.filter(
    (card) => card.mainType !== "Héros",
  ).length;

  const totalExpectedImages = heroCount * 2 + nonHeroCount;

  console.log(`📊 Statistiques des images attendues :`);
  console.log(`🦸 Héros : ${heroCount} cartes (${heroCount * 2} images)`);
  console.log(`🎴 Autres cartes : ${nonHeroCount} images`);
  console.log(`📈 Total des images attendues : ${totalExpectedImages}`);
}

countExpectedImages().catch(console.error);
