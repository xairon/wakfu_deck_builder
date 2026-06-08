/**
 * Script pour récupérer et afficher les logs de l'application Wakfu Deck Builder
 * Utilisé par le système MCP pour permettre à Claude d'accéder aux logs
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const os = require("os");

// Configuration
const LOG_FILE_PATH = path.join(process.cwd(), "debug", "app_logs.log");
const LOG_HISTORY_SIZE = 100; // Nombre de lignes à conserver
const MAX_DISPLAY_LINES = 50; // Nombre maximum de lignes à afficher

// Crée un fichier de logs s'il n'existe pas
function ensureLogFile() {
  const debugDir = path.join(process.cwd(), "debug");

  if (!fs.existsSync(debugDir)) {
    fs.mkdirSync(debugDir, { recursive: true });
    console.log(`📁 Création du dossier debug: ${debugDir}`);
  }

  if (!fs.existsSync(LOG_FILE_PATH)) {
    fs.writeFileSync(LOG_FILE_PATH, "--- Début des logs ---\n", "utf-8");
    console.log(`📄 Création du fichier de logs: ${LOG_FILE_PATH}`);
  }
}

// Extraire les logs du processus Node.js en cours d'exécution
function getProcessLogs() {
  try {
    // Commande différente selon le système d'exploitation
    let cmd;
    if (os.platform() === "win32") {
      cmd =
        "powershell -Command \"Get-Process node | Where-Object {$_.CommandLine -match 'ts-node'} | Select-Object Id\"";
    } else {
      cmd = "ps aux | grep 'ts-node' | grep -v grep | awk '{print $2}'";
    }

    const processIds = execSync(cmd).toString().trim().split("\n");

    if (processIds.length === 0 || !processIds[0]) {
      return "❓ Aucun processus serveur en cours d'exécution.";
    }

    // Ajouter cette information au fichier de logs
    const timestamp = new Date().toISOString();
    fs.appendFileSync(
      LOG_FILE_PATH,
      `\n[${timestamp}] Info: Processus serveur détecté (PID: ${processIds[0]})\n`,
      "utf-8",
    );

    return `✅ Processus serveur en cours d'exécution (PID: ${processIds[0]})`;
  } catch (error) {
    console.error("❌ Erreur lors de la récupération des processus:", error);
    return `❌ Erreur lors de la vérification des processus: ${error.message}`;
  }
}

// Récupérer les erreurs de console récentes
function getRecentConsoleErrors() {
  try {
    // Lire le contenu du fichier de logs
    let logs = "";
    if (fs.existsSync(LOG_FILE_PATH)) {
      logs = fs.readFileSync(LOG_FILE_PATH, "utf-8");
    }

    const errorLines = logs
      .split("\n")
      .filter(
        (line) =>
          line.includes("❌ Erreur") ||
          line.includes("Error:") ||
          line.includes("ERROR"),
      )
      .slice(-MAX_DISPLAY_LINES);

    if (errorLines.length === 0) {
      return "✅ Aucune erreur récente dans les logs.";
    }

    return "🔍 Erreurs récentes détectées:\n" + errorLines.join("\n");
  } catch (error) {
    console.error("❌ Erreur lors de la lecture des logs:", error);
    return `❌ Erreur lors de la lecture des logs: ${error.message}`;
  }
}

// Récupère et affiche les informations d'état de l'application
function getAppInfo() {
  try {
    const timestamp = new Date().toISOString();
    let info = `\n=== État de l'application au ${timestamp} ===\n\n`;

    // Vérifier l'espace disque
    const diskInfo =
      os.platform() === "win32"
        ? execSync(
            'powershell -Command "Get-PSDrive C | Select-Object Used,Free"',
          ).toString()
        : execSync("df -h .").toString();

    info += "💾 Informations disque:\n" + diskInfo + "\n";

    // Vérifier la mémoire
    const totalMem =
      Math.round((os.totalmem() / (1024 * 1024 * 1024)) * 100) / 100;
    const freeMem =
      Math.round((os.freemem() / (1024 * 1024 * 1024)) * 100) / 100;
    const usedMem = Math.round((totalMem - freeMem) * 100) / 100;

    info += `💻 Mémoire: ${usedMem}GB utilisés / ${totalMem}GB total (${freeMem}GB libre)\n\n`;

    // Vérifier les fichiers importants
    const collectionFile = path.join(process.cwd(), "data", "collection.json");
    let collectionStatus = "❌ N'existe pas";

    if (fs.existsSync(collectionFile)) {
      const stats = fs.statSync(collectionFile);
      const fileSizeKB = Math.round((stats.size / 1024) * 100) / 100;
      const lastModified = stats.mtime.toISOString();
      collectionStatus = `✅ ${fileSizeKB}KB, dernière modification: ${lastModified}`;
    }

    info += `📄 collection.json: ${collectionStatus}\n`;

    // Ajouter cette information au fichier de logs
    fs.appendFileSync(LOG_FILE_PATH, info, "utf-8");

    return info;
  } catch (error) {
    console.error(
      "❌ Erreur lors de la récupération des informations système:",
      error,
    );
    return `❌ Erreur: ${error.message}`;
  }
}

// Fonction principale
function main() {
  console.log(
    "📝 Récupération des logs et informations de l'application Wakfu Deck Builder...\n",
  );

  // S'assurer que le fichier de logs existe
  ensureLogFile();

  // Récupérer l'état du processus serveur
  const processStatus = getProcessLogs();
  console.log(processStatus);

  // Récupérer les erreurs récentes
  const recentErrors = getRecentConsoleErrors();
  console.log("\n" + recentErrors);

  // Récupérer les informations système
  const appInfo = getAppInfo();
  console.log(appInfo);

  // Limiter la taille du fichier de logs
  const logs = fs.readFileSync(LOG_FILE_PATH, "utf-8");
  const logLines = logs.split("\n");

  if (logLines.length > LOG_HISTORY_SIZE) {
    const trimmedLogs = logLines.slice(-LOG_HISTORY_SIZE).join("\n");
    fs.writeFileSync(LOG_FILE_PATH, trimmedLogs, "utf-8");
    console.log(`\n📄 Fichier de logs tronqué à ${LOG_HISTORY_SIZE} lignes.`);
  }

  console.log("\n✅ Récupération des logs terminée.");
}

// Exécuter le script
main();
