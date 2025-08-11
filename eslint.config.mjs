// eslint.config.mjs
import globals from 'globals';
import pluginVue from 'eslint-plugin-vue';
import tseslint from 'typescript-eslint';
// import eslintConfigPrettier from 'eslint-config-prettier'; // Commenté
import pluginPrettier from 'eslint-plugin-prettier'; // Gardé pour voir si on atteint le bloc suivant

export default tseslint.config(
  // 1. Configuration Globale Initiale (ignores, globals de base)
  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module', // Assumant ESM par défaut
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.es2021,
        'vue/setup-compiler-macros': 'readonly',
      },
    },
    ignores: [
      'dist/', 'node_modules/', '.DS_Store', '*.local', 'coverage/',
      'public/', 'supabase/', 'uploads/', 'debug/', '.venv/', 'analysis/',
      '*.log', '*.sublime-project', '*.sublime-workspace', '.idea/', '.vscode/',
      'temp_cursorrules.txt',
      // Ignorez les JS spécifiques de scripts pour le moment si problématiques
      // 'scripts/downloadImages.js', 'scripts/getLogs.js', 'scripts/updateCards.js',
    ],
  },

  // 2. Utiliser tseslint.configs.recommended (non type-checked par défaut)
  ...tseslint.configs.recommended,

  // 3. Configuration pour activer le parsing avec type-checking pour les fichiers TS
  // et spécifier les projets tsconfig.
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.vue'], // Inclure .vue pour le script TS
    languageOptions: {
      parserOptions: {
        project: true, // Permet à ESLint de trouver le tsconfig.json le plus proche
        tsconfigRootDir: import.meta.dirname,
      },
    },
    // Pas besoin de re-déclarer tseslint.plugin si `...tseslint.configs.recommended` le fait.
  },
  // Spécifique pour les fichiers de config node
  {
    files: ['vite.config.ts', 'vitest.config.ts', '*.config.ts'],
    languageOptions: {
      parserOptions: {
        project: './tsconfig.node.json', // tsconfigRootDir déjà défini globalement ou hérité
      },
    },
  },
  // Spécifique pour le code source principal (src, tests, scripts)
  {
    files: ['src/**/*.ts', 'src/**/*.tsx', 'tests/**/*.ts', 'scripts/**/*.ts'],
    languageOptions: {
      parserOptions: {
        project: './tsconfig.json', // tsconfigRootDir déjà défini globalement ou hérité
      },
    },
  },

  // 4. Configuration pour les fichiers JS : désactiver les règles type-checked
  {
    files: ['**/*.js', '**/*.mjs', '**/*.cjs', '*.config.js', 'scripts/**/*.js'],
    // Si `...tseslint.configs.recommended` n'est pas type-checked, extends n'est pas nécessaire ici
    // Mais pour être sûr, on peut le laisser si on active project:true globalement.
    // Solution: Ne pas mettre project:true dans un bloc trop global.
    // Je vais retirer le bloc { files: ['**/*.ts',...] languageOptions... project:true } global
    // et mettre project spécifiquement là où c'est nécessaire.
    rules: {
      '@typescript-eslint/no-var-requires': 'off',
    },
  },

  // 5. Configurations pour Vue.js
  pluginVue.configs['flat/base'],
  pluginVue.configs['flat/vue3-recommended'],
  {
    files: ['src/**/*.vue'],
    languageOptions: {
      parserOptions: { 
        parser: tseslint.parser,
        project: './tsconfig.json', 
        tsconfigRootDir: import.meta.dirname,
        extraFileExtensions: ['.vue'],
      },
    },
    rules: {
      'vue/multi-word-component-names': 'off',
      'vue/no-reserved-component-names': 'off',
    },
  },

  // 6. Configuration Prettier (doit être la dernière)
  // eslintConfigPrettier, // Commenté
  // Le bloc de règles prettier/prettier est toujours commenté aussi
);

