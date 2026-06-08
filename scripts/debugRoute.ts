/**
 * Script pour déboguer une route spécifique de l'application
 * Utilisé par le système MCP pour permettre à Claude de déboguer les routes
 */

import axios from "axios";
import fs from "fs";
import path from "path";
import { performance } from "perf_hooks";

// Configuration
const BASE_URL = "http://localhost:3000";
const REPORT_PATH = path.join(
  process.cwd(),
  "debug",
  "route_debug_report.json",
);
const DEFAULT_ROUTES = ["/", "/api/collection/initial"];

// Obtenir la route à tester à partir des arguments de ligne de commande
// Format: npm run debug-route -- /path/to/route
const args = process.argv.slice(2);
const routes = args.length > 0 ? args : DEFAULT_ROUTES;

// Interface pour les données de performance
interface PerformanceData {
  route: string;
  status: number;
  time: number;
  size: number;
  contentType: string;
  error?: string;
  data?: any;
}

// Fonction pour déboguer une route
async function debugRoute() {
  try {
    console.log("🔍 Débogage des routes de l'application...");

    // Créer le répertoire de debug s'il n'existe pas
    const debugDir = path.dirname(REPORT_PATH);
    if (!fs.existsSync(debugDir)) {
      fs.mkdirSync(debugDir, { recursive: true });
    }

    // Rapport de débogage
    const report: {
      timestamp: string;
      routes: PerformanceData[];
      serverInfo?: any;
    } = {
      timestamp: new Date().toISOString(),
      routes: [],
    };

    // Vérifier si le serveur est en cours d'exécution
    try {
      console.log("🔄 Vérification du serveur...");
      const startTime = performance.now();
      const response = await axios.get(`${BASE_URL}/`, { timeout: 5000 });
      const endTime = performance.now();

      console.log(
        `✅ Serveur en cours d'exécution (${Math.round(endTime - startTime)}ms)`,
      );
    } catch (error) {
      console.error(
        "❌ Impossible de se connecter au serveur. Assurez-vous que le serveur est en cours d'exécution.",
      );
      console.error("   Exécutez: npm run dev");
      return;
    }

    // Obtenir des informations sur le serveur (système d'exploitation, version de Node.js, etc.)
    try {
      const response = await axios.get(`${BASE_URL}/api/system-info`, {
        timeout: 5000,
      });
      report.serverInfo = response.data;
    } catch (error) {
      console.log(
        "ℹ️ Route /api/system-info non disponible. Les informations système ne seront pas incluses.",
      );
    }

    // Déboguer chaque route
    for (const route of routes) {
      try {
        console.log(`🔍 Débogage de la route: ${route}`);

        const startTime = performance.now();
        const response = await axios.get(`${BASE_URL}${route}`, {
          timeout: 10000,
          validateStatus: () => true, // Ne pas rejeter les réponses avec code d'erreur
        });
        const endTime = performance.now();

        const timeMs = Math.round(endTime - startTime);
        const size = JSON.stringify(response.data).length;
        const contentType = response.headers["content-type"] || "unknown";

        // Ajouter les données de performance au rapport
        const performanceData: PerformanceData = {
          route,
          status: response.status,
          time: timeMs,
          size,
          contentType,
        };

        // Inclure les données de réponse pour les petites réponses
        if (size < 10000) {
          performanceData.data = response.data;
        }

        report.routes.push(performanceData);

        // Afficher les résultats
        const statusColor =
          response.status >= 200 && response.status < 300 ? "✅" : "❌";
        console.log(
          `${statusColor} Status: ${response.status}, Temps: ${timeMs}ms, Taille: ${formatBytes(size)}`,
        );
      } catch (error: any) {
        const errorMessage = error.message || "Erreur inconnue";
        console.error(`❌ Erreur pour la route ${route}:`, errorMessage);

        report.routes.push({
          route,
          status: -1,
          time: -1,
          size: 0,
          contentType: "unknown",
          error: errorMessage,
        });
      }
    }

    // Enregistrer le rapport dans un fichier
    fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2), "utf-8");

    console.log(
      `\n✅ Débogage terminé. Rapport enregistré dans: ${REPORT_PATH}`,
    );

    // Afficher un résumé
    console.log("\n📊 Résumé:");
    for (const routeData of report.routes) {
      const statusSymbol =
        routeData.status >= 200 && routeData.status < 300 ? "✅" : "❌";
      const timeInfo = routeData.time >= 0 ? `${routeData.time}ms` : "N/A";
      console.log(
        `${statusSymbol} ${routeData.route} - Status: ${routeData.status}, Temps: ${timeInfo}`,
      );
    }
  } catch (error) {
    console.error("❌ Erreur lors du débogage des routes:", error);
  }
}

// Fonction utilitaire pour formater les octets
function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
}

// Exécuter le débogage
debugRoute();
