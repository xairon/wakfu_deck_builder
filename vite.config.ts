import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";
import fs from "fs";
import tailwindcss from "tailwindcss";
import autoprefixer from "autoprefixer";

// Fonction pour vérifier l'existence des répertoires d'images
function checkImageDirectories() {
  const imageDir = path.resolve(__dirname, "public/images/cards");
  if (!fs.existsSync(imageDir)) {
    console.error("❌ Le répertoire des images n'existe pas:", imageDir);
    fs.mkdirSync(imageDir, { recursive: true });
    console.log("✅ Répertoire des images créé:", imageDir);
  } else {
    console.log("✅ Répertoire des images trouvé:", imageDir);
    const files = fs.readdirSync(imageDir);
    console.log(`📸 Nombre d'images trouvées: ${files.length}`);
  }
}

// Vérifier les répertoires au démarrage
checkImageDirectories();

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    vue({
      script: {
        defineModel: true,
        propsDestructure: true,
      },
    }),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["images/pwa-192x192.png", "images/pwa-512x512.png"],
      manifest: {
        name: "Wakfu Deck Builder",
        short_name: "WakfuDeck",
        description: "Construisez et gerez vos decks Wakfu TCG",
        theme_color: "#1a1a2e",
        background_color: "#1a1a2e",
        display: "standalone",
        start_url: "/",
        scope: "/",
        icons: [
          {
            src: "/images/pwa-192x192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "/images/pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "/images/pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff,woff2}"],
        // Runtime caching strategies
        runtimeCaching: [
          {
            // Card images: CacheFirst with 30-day expiration, max 2000 entries
            urlPattern: /\/images\/cards\/.+\.png$/i,
            handler: "CacheFirst",
            options: {
              cacheName: "card-images-cache",
              expiration: {
                maxEntries: 2000,
                maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            // Card data JSON: StaleWhileRevalidate
            urlPattern: /\/data\/.+\.json$/i,
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "card-data-cache",
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 7 * 24 * 60 * 60, // 7 days
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            // App shell and static assets: CacheFirst
            urlPattern: /\.(?:js|css|woff2?)$/i,
            handler: "CacheFirst",
            options: {
              cacheName: "app-shell-cache",
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
        // Offline fallback
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api/],
      },
      devOptions: {
        enabled: false, // Set to true to test PWA in dev mode
      },
    }),
  ],
  base: "/",
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "~": path.resolve(__dirname, "./"),
      test: path.resolve(__dirname, "./tests"),
      "@images": path.resolve(__dirname, "./data/images"),
      "@data": path.resolve(__dirname, "./data"),
    },
    extensions: [".mjs", ".js", ".ts", ".jsx", ".tsx", ".json", ".vue"],
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    alias: {
      "@": path.resolve(__dirname, "./src"),
      test: path.resolve(__dirname, "./tests"),
    },
  },
  server: {
    port: 3000,
    fs: {
      strict: true,
      allow: ["."],
    },
  },
  build: {
    outDir: "dist",
    assetsDir: "assets",
    assetsInlineLimit: 4096,
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ["vue", "vue-router", "pinia"],
          ui: ["@headlessui/vue", "daisyui"],
        },
        assetFileNames: (assetInfo) => {
          if (assetInfo.name?.endsWith(".png")) {
            return "assets/images/[name][extname]";
          }
          return "assets/[name]-[hash][extname]";
        },
        chunkFileNames: "js/[name]-[hash].js",
        entryFileNames: "js/[name]-[hash].js",
      },
    },
    target: "esnext",
    minify: "esbuild",
    sourcemap: false,
  },
  esbuild: {
    drop: process.env.NODE_ENV === "production" ? ["console", "debugger"] : [],
  },
  optimizeDeps: {
    include: ["vue", "vue-router", "pinia", "@vueuse/core"],
  },
  css: {
    devSourcemap: true,
    postcss: {
      plugins: [tailwindcss, autoprefixer],
    },
  },
});
