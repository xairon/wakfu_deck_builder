import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";

const COLLECTION_FILE = path.join(process.cwd(), "data", "collection.json");

async function createServer() {
  const app = express();

  // Créer le serveur Vite en mode middleware
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: "spa",
  });

  // Middleware pour logger les requêtes
  app.use((req, res, next) => {
    console.log(`📝 ${req.method} ${req.url}`);
    next();
  });

  // S'assurer que les dossiers nécessaires existent
  const uploadsDir = path.join(process.cwd(), "uploads");
  const dataDir = path.join(process.cwd(), "data");

  for (const dir of [uploadsDir, dataDir]) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`📁 Création du dossier: ${dir}`);
    }
  }

  // Créer le fichier de collection s'il n'existe pas
  if (!fs.existsSync(COLLECTION_FILE)) {
    fs.writeFileSync(COLLECTION_FILE, "{}", "utf-8");
    console.log("📄 Création du fichier collection.json");
  }

  // Route pour charger la collection initiale
  app.get("/api/collection/initial", (req, res) => {
    try {
      const collection = fs.readFileSync(COLLECTION_FILE, "utf-8");
      res.json(JSON.parse(collection));
    } catch (error) {
      console.error("❌ Erreur lors de la lecture de la collection:", error);
      res.json({});
    }
  });

  // Route pour sauvegarder la collection
  app.post("/api/collection/backup", express.json(), (req, res) => {
    try {
      fs.writeFileSync(
        COLLECTION_FILE,
        JSON.stringify(req.body, null, 2),
        "utf-8",
      );
      res.json({ success: true });
    } catch (error) {
      console.error("❌ Erreur lors de la sauvegarde de la collection:", error);
      res
        .status(500)
        .json({ success: false, error: "Erreur lors de la sauvegarde" });
    }
  });

  // Middleware pour parser le JSON
  app.use(express.json());

  // Servir les fichiers statiques
  app.use("/data", express.static("data"));

  // Utiliser Vite comme middleware
  app.use(vite.middlewares);

  // Middleware de gestion des erreurs
  app.use(
    (
      err: any,
      req: express.Request,
      res: express.Response,
      next: express.NextFunction,
    ) => {
      console.error("❌ Erreur serveur:", err);
      res.status(500).json({
        success: false,
        error: err instanceof Error ? err.message : "Erreur interne du serveur",
      });
    },
  );

  // Démarrer le serveur
  const port = process.env.PORT || 3000;
  app.listen(port, () => {
    console.log(`🚀 Serveur démarré sur http://localhost:${port}`);
    console.log("📁 Dossier de travail:", process.cwd());
    console.log("📁 Dossier uploads:", uploadsDir);
    console.log("📁 Dossier data:", dataDir);
  });
}

createServer().catch((e) => {
  console.error("❌ Erreur lors du démarrage du serveur:", e);
  process.exit(1);
});
