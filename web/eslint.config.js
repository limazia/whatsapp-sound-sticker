import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import { defineConfig, globalIgnores } from "eslint/config";
import globals from "globals";
import tseslint from "typescript-eslint";

import project from "./eslint-rules.js";

export default defineConfig([
  globalIgnores(["dist"]),
  {
    files: ["**/*.{ts,tsx}"],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat["recommended-latest"],
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      "project/no-em-dash": "error",
      "@typescript-eslint/no-explicit-any": "off",
      "react-refresh/only-export-components": [
        "error",
        { allowConstantExport: true },
      ],
    },
    plugins: {
      project,
    },
  },
  {
    files: ["src/**/*.tsx"],
    rules: {
      "project/no-component-comments": "error",
    },
  },
  {
    files: [
      "src/shared/components/ui/**/*.{ts,tsx}",
      "src/assets/logos/**/*.{ts,tsx}",
    ],
    rules: {
      "react-refresh/only-export-components": "off",
    },
  },
]);
