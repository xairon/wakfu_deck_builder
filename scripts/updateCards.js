import axios from "axios";
import * as cheerio from "cheerio";
import { promises as fs } from "fs";
import path from "path";
import { Worker } from "worker_threads";
import os from "os";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_URL = "https://www.wtcg-return.fr";
const CARDS_DIR = "./cartes";
const DELAY = 1000; // 1 seconde entre chaque requête
const MAX_CONCURRENT_REQUESTS = 5;
const MAX_WORKERS = Math.min(os.cpus().length, 8); // Limiter à 8 workers maximum
const BATCH_SIZE = 5; // Nombre de cartes par lot

console.log(`Configuration:
- ${MAX_WORKERS} workers maximum
- ${MAX_CONCURRENT_REQUESTS} requêtes concurrentes maximum
- ${BATCH_SIZE} cartes par lot
`);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractNumberFromText(text) {
  const match = text.match(/\d+/);
  return match ? parseInt(match[0]) : null;
}

async function fetchCardDetails(url) {
  try {
    console.log(`\nRécupération des détails depuis ${url}...`);
    const response = await axios.get(url);
    const $ = cheerio.load(response.data);

    // Extraire le type et les informations supplémentaires
    const typeText = $("h1 small.text-muted").text().trim();
    console.log("Type trouvé:", typeText);

    // Extraire toutes les informations de la première div hstack
    const cardInfo = {
      type: "",
      class: "",
      specialization: null,
      unique: false,
    };

    // Parcourir tous les divs de la première hstack
    const firstHstack = $(".hstack").first();
    console.log("Contenu de la première hstack:", firstHstack.text().trim());

    firstHstack.children("div").each((i, el) => {
      const text = $(el).text().trim();
      console.log("Div trouvé:", text);

      if (i === 0) {
        cardInfo.type = text;
      } else if (text === "Unique") {
        cardInfo.unique = true;
      } else {
        // Si ce n'est pas le type ni "Unique", c'est soit une classe soit une spécialisation
        if (!cardInfo.class) {
          cardInfo.class = text;
        } else {
          cardInfo.specialization = text;
        }
      }
    });
    console.log("Informations de carte trouvées:", cardInfo);

    // Extraire les informations de niveau et de force avec leurs éléments
    const stats = {
      level: null,
      force: null,
    };

    // Parcourir tous les divs de la deuxième hstack
    const secondHstack = $(".hstack").eq(1);
    console.log("Contenu de la deuxième hstack:", secondHstack.text().trim());

    secondHstack.children("div").each((i, el) => {
      const $el = $(el);
      const text = $el.text().trim();
      console.log("Stats div trouvé:", text);

      // Extraire l'élément de l'image
      const img = $el.find("img.symbole-ressource");
      const element = img.length ? img.attr("alt") : null;
      console.log("Élément trouvé dans l'image:", element);

      // Extraire la valeur numérique
      const value = extractNumberFromText(text);
      console.log("Valeur numérique trouvée:", value);

      if (text.includes("Niveau") && value !== null) {
        stats.level = {
          value: value,
          element: element || null,
        };
      } else if (text.includes("Force") && value !== null) {
        stats.force = {
          value: value,
          element: element || null,
        };
      }
    });
    console.log("Statistiques trouvées:", stats);

    // Extraire la rareté
    const rareteSpan = $(".badge[title]");
    const rarete = rareteSpan.attr("title");
    console.log("Rareté trouvée:", rarete);

    // Construire l'objet final en s'assurant qu'il n'y a pas de valeurs undefined
    const result = {
      type: cardInfo.type || "",
      class: cardInfo.class || "",
      specialization: cardInfo.specialization || null,
      unique: cardInfo.unique || false,
      stats: {
        level: stats.level
          ? {
              value: stats.level.value || null,
              element: stats.level.element || null,
            }
          : null,
        force: stats.force
          ? {
              value: stats.force.value || null,
              element: stats.force.element || null,
            }
          : null,
      },
      rarete: rarete || "",
    };

    console.log("Résultat final:", result);
    return result;
  } catch (error) {
    console.error(
      `Erreur lors de la récupération des détails pour ${url}:`,
      error,
    );
    throw error;
  }
}

class WorkerPool {
  constructor(size) {
    this.size = size;
    this.workers = [];
    this.freeWorkers = [];
    this.queue = [];

    for (let i = 0; i < size; i++) {
      const worker = new Worker(path.join(__dirname, "cardWorker.js"));
      this.workers.push(worker);
      this.freeWorkers.push(worker);
    }
  }

  async execute(card, delay) {
    return new Promise((resolve, reject) => {
      const processTask = (worker) => {
        worker.postMessage({ card, delay });

        const cleanup = () => {
          worker.removeAllListeners();
          this.freeWorkers.push(worker);
          this.processQueue();
        };

        worker.once("message", (result) => {
          cleanup();
          if (!result.success) {
            reject(new Error(result.error));
          } else {
            resolve(result.data);
          }
        });

        worker.once("error", (error) => {
          cleanup();
          reject(error);
        });
      };

      if (this.freeWorkers.length > 0) {
        const worker = this.freeWorkers.pop();
        processTask(worker);
      } else {
        this.queue.push({ card, delay, resolve, reject });
      }
    });
  }

  processQueue() {
    if (this.queue.length === 0 || this.freeWorkers.length === 0) return;

    const worker = this.freeWorkers.pop();
    const { card, delay, resolve, reject } = this.queue.shift();

    worker.postMessage({ card, delay });

    const cleanup = () => {
      worker.removeAllListeners();
      this.freeWorkers.push(worker);
      this.processQueue();
    };

    worker.once("message", (result) => {
      cleanup();
      if (!result.success) {
        reject(new Error(result.error));
      } else {
        resolve(result.data);
      }
    });

    worker.once("error", (error) => {
      cleanup();
      reject(error);
    });
  }

  async shutdown() {
    await Promise.all(this.workers.map((worker) => worker.terminate()));
  }
}

async function processCards(cards, pool) {
  const results = [];
  for (let i = 0; i < cards.length; i += BATCH_SIZE) {
    const batch = cards.slice(i, i + BATCH_SIZE);
    const batchPromises = batch.map((card, index) =>
      pool.execute(card, DELAY * (index % MAX_CONCURRENT_REQUESTS)),
    );

    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);

    // Afficher la progression
    const progress = Math.min(100, ((i + BATCH_SIZE) / cards.length) * 100);
    console.log(
      `Progress: ${progress.toFixed(1)}% (${i + BATCH_SIZE}/${cards.length})`,
    );

    // Petit délai entre les lots pour éviter la surcharge
    await sleep(DELAY);
  }
  return results;
}

async function updateCardsFile(filePath, pool) {
  try {
    // Lire le fichier
    const content = await fs.readFile(filePath, "utf-8");
    const cards = JSON.parse(content);
    let hasChanges = false;

    console.log(`\nTraitement du fichier ${filePath}...`);

    // Traiter toutes les cartes
    const updatedCards = await processCards(cards, pool);

    // Vérifier les changements
    for (let i = 0; i < cards.length; i++) {
      const oldCard = cards[i];
      const newCard = updatedCards[i];

      if (!newCard) continue; // Ignorer si pas de nouvelles données

      // Fusionner les nouvelles données avec les données existantes
      const mergedCard = {
        ...oldCard,
        type: newCard.type || oldCard.type,
        class: newCard.class || oldCard.class,
        specialization: newCard.specialization,
        unique: newCard.unique,
        stats: newCard.stats || oldCard.stats || {},
        rarete: newCard.rarete || oldCard.rarete,
        element: newCard.element || oldCard.element,
      };

      // Vérifier s'il y a des changements
      const changes = [];

      if (oldCard.type !== mergedCard.type) {
        changes.push(
          `Type: ${oldCard.type || "non défini"} -> ${mergedCard.type}`,
        );
      }
      if (oldCard.class !== mergedCard.class) {
        changes.push(
          `Classe: ${oldCard.class || "non définie"} -> ${mergedCard.class}`,
        );
      }
      if (oldCard.specialization !== mergedCard.specialization) {
        changes.push(
          `Spécialisation: ${oldCard.specialization || "non définie"} -> ${mergedCard.specialization}`,
        );
      }
      if (oldCard.unique !== mergedCard.unique) {
        changes.push(
          `Unique: ${oldCard.unique || false} -> ${mergedCard.unique}`,
        );
      }

      // Vérifier les changements dans les stats
      const oldStats = JSON.stringify(oldCard.stats || {});
      const newStats = JSON.stringify(mergedCard.stats);
      if (oldStats !== newStats) {
        changes.push(`Stats modifiées:
  Avant: ${oldStats}
  Après: ${newStats}`);
      }

      if (oldCard.rarete !== mergedCard.rarete) {
        changes.push(
          `Rareté: ${oldCard.rarete || "non définie"} -> ${mergedCard.rarete}`,
        );
      }
      if (oldCard.element !== mergedCard.element) {
        changes.push(
          `Élément: ${oldCard.element || "non défini"} -> ${mergedCard.element}`,
        );
      }

      if (changes.length > 0) {
        hasChanges = true;
        cards[i] = mergedCard;
        console.log(`\nMise à jour de ${oldCard.name}:`);
        changes.forEach((change) => console.log(`- ${change}`));
      }
    }

    // Sauvegarder les changements
    if (hasChanges) {
      console.log(`\nSauvegarde des modifications dans ${filePath}...`);
      const jsonContent = JSON.stringify(cards, null, 2);
      await fs.writeFile(filePath, jsonContent, "utf-8");
      console.log("✅ Fichier sauvegardé avec succès");
    } else {
      console.log("\nAucun changement à sauvegarder");
    }
  } catch (error) {
    console.error(
      `Erreur lors de la mise à jour du fichier ${filePath}:`,
      error,
    );
    throw error;
  }
}

async function main() {
  const pool = new WorkerPool(MAX_WORKERS);

  try {
    console.log(`🚀 Démarrage avec ${MAX_WORKERS} workers`);

    // Lister tous les fichiers JSON dans le dossier cartes
    const files = await fs.readdir(CARDS_DIR);
    const jsonFiles = files.filter((file) => file.endsWith(".json"));

    // Traiter les fichiers en séquence pour éviter de surcharger
    for (const file of jsonFiles) {
      console.log(`\n📄 Traitement du fichier ${file}...`);
      await updateCardsFile(path.join(CARDS_DIR, file), pool);
    }

    console.log("\n✨ Mise à jour terminée");
  } catch (error) {
    console.error("Erreur lors de la mise à jour des cartes:", error);
  } finally {
    await pool.shutdown();
  }
}

main();
