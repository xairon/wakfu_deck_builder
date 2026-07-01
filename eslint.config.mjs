import globals from "globals";
import pluginVue from "eslint-plugin-vue";
import tseslint from "typescript-eslint";
import eslintConfigPrettier from "eslint-config-prettier";

export default tseslint.config(
  // Ignorés GLOBAUX : doit être un objet contenant UNIQUEMENT `ignores`
  // (sinon les exclusions ne s'appliquent pas globalement en flat config).
  {
    ignores: [
      "dist/",
      "node_modules/",
      "coverage/",
      "public/",
      "supabase/",
      "uploads/",
      "debug/",
      ".venv/",
      "**/.venv/**",
      "analysis/",
      "playwright-report/",
      "test-results/",
      "raw-card-data/",
      "data/",
      "**/*.min.js",
      "**/*.config.js",
      "**/*.config.ts",
      "**/*.config.mjs",
      "e2e/",
      "scripts/",
    ],
  },

  {
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.es2021,
        "vue/setup-compiler-macros": "readonly",
      },
    },
  },

  ...tseslint.configs.recommended,

  {
    files: ["**/*.ts", "**/*.tsx", "**/*.vue"],
    languageOptions: {
      parserOptions: {
        project: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },

  {
    files: ["vite.config.ts", "vitest.config.ts", "*.config.ts"],
    languageOptions: {
      parserOptions: {
        project: "./tsconfig.node.json",
      },
    },
  },

  {
    files: ["src/**/*.ts", "src/**/*.tsx", "tests/**/*.ts", "scripts/**/*.ts"],
    languageOptions: {
      parserOptions: {
        project: "./tsconfig.json",
      },
    },
  },

  {
    files: [
      "**/*.js",
      "**/*.mjs",
      "**/*.cjs",
      "*.config.js",
      "scripts/**/*.js",
    ],
    rules: {
      "@typescript-eslint/no-var-requires": "off",
      "@typescript-eslint/no-require-imports": "off",
    },
  },

  ...pluginVue.configs["flat/base"],
  ...pluginVue.configs["flat/essential"],
  {
    files: ["src/**/*.vue"],
    languageOptions: {
      parserOptions: {
        parser: tseslint.parser,
        project: "./tsconfig.json",
        tsconfigRootDir: import.meta.dirname,
        extraFileExtensions: [".vue"],
      },
    },
    rules: {
      "vue/multi-word-component-names": "off",
      "vue/no-reserved-component-names": "off",
    },
  },

  eslintConfigPrettier,

  {
    rules: {
      // Dead variables fail the lint gate; unused args allowed only when prefixed "_".
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_" },
      ],
      // `any` stays a warning: ~56 legit cases remain at JSON-normalization boundaries.
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
);
