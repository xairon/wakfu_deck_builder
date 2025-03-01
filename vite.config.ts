import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'
import fs from 'fs'
import tailwindcss from 'tailwindcss'
import autoprefixer from 'autoprefixer'

// Fonction pour vérifier l'existence des répertoires d'images
function checkImageDirectories() {
  const imageDir = path.resolve(__dirname, 'public/images/cards')
  if (!fs.existsSync(imageDir)) {
    console.error('❌ Le répertoire des images n\'existe pas:', imageDir)
    fs.mkdirSync(imageDir, { recursive: true })
    console.log('✅ Répertoire des images créé:', imageDir)
  } else {
    console.log('✅ Répertoire des images trouvé:', imageDir)
    const files = fs.readdirSync(imageDir)
    console.log(`📸 Nombre d'images trouvées: ${files.length}`)
  }
}

// Vérifier les répertoires au démarrage
checkImageDirectories()

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    vue({
      script: {
        defineModel: true,
        propsDestructure: true
      }
    })
  ],
  base: '/',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '~': path.resolve(__dirname, './'),
      'test': path.resolve(__dirname, './tests'),
      '@images': path.resolve(__dirname, './data/images'),
      '@data': path.resolve(__dirname, './data')
    },
    extensions: ['.mjs', '.js', '.ts', '.jsx', '.tsx', '.json', '.vue']
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    alias: {
      '@': path.resolve(__dirname, './src'),
      'test': path.resolve(__dirname, './tests')
    }
  },
  server: {
    port: 3000,
    fs: {
      strict: false,
      allow: ['..']
    }
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    assetsInlineLimit: 4096,
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor': ['vue', 'vue-router', 'pinia'],
          'ui': ['@headlessui/vue', 'daisyui'],
        },
        assetFileNames: (assetInfo) => {
          if (assetInfo.name?.endsWith('.png')) {
            return 'assets/images/[name][extname]'
          }
          return 'assets/[name]-[hash][extname]'
        },
        chunkFileNames: 'js/[name]-[hash].js',
        entryFileNames: 'js/[name]-[hash].js'
      }
    },
    target: 'esnext',
    minify: 'esbuild',
    sourcemap: true
  },
  optimizeDeps: {
    include: ['vue', 'vue-router', 'pinia', '@vueuse/core', 'pouchdb-browser']
  },
  css: {
    devSourcemap: true,
    postcss: {
      plugins: [
        tailwindcss,
        autoprefixer
      ]
    }
  }
}) 