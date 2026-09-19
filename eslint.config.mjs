import js from "@eslint/js";
import babelParser from "@babel/eslint-parser";
import reactPlugin from "eslint-plugin-react";
import reactHooksPlugin from "eslint-plugin-react-hooks";
import globals from "globals";
import prettierConfig from "eslint-config-prettier";

/** @type {import('eslint').Linter.Config[]} */
const eslintConfig = [
  // Ignorované adresáře (generované, deps)
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "dist/**",
      "build/**",
      "coverage/**",
      "playwright-report/**",
      "test-results/**",
      "next-env.d.ts",
    ],
  },

  // Základní ESLint recommended pravidla
  js.configs.recommended,

  // React + TypeScript parser konfigurace
  {
    files: ["**/*.{ts,tsx,js,jsx,mjs}"],
    languageOptions: {
      parser: babelParser,
      parserOptions: {
        requireConfigFile: false,
        babelOptions: {
          presets: [
            ["@babel/preset-react", { runtime: "automatic" }],
            "@babel/preset-typescript",
          ],
        },
      },
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    plugins: {
      react: reactPlugin,
      "react-hooks": reactHooksPlugin,
    },
    settings: {
      react: {
        version: "detect",
      },
    },
    rules: {
      // React
      ...reactPlugin.configs.recommended.rules,
      "react/react-in-jsx-scope": "off", // Next.js nepotřebuje React v scope
      "react/prop-types": "off", // TypeScript plně nahrazuje prop-types

      // React Hooks (pravidla hooks, vyčerpávající deps)
      ...reactHooksPlugin.configs.recommended.rules,

      // Pravidla kvality kódu
      "no-console": ["warn", { allow: ["warn", "error"] }],
      "prefer-const": "error",
      "no-var": "error",
      eqeqeq: ["error", "smart"],
      "no-duplicate-imports": "error",

      // TypeScript projekty: no-undef a no-unused-vars jsou plně zajištěny tsc (strict: true)
      // Standardní JS pravidla generují false positives na TS type pozicích
      "no-undef": "off",
      "no-unused-vars": "off",
    },
  },

  // Prettier musí být jako poslední – vypíná konflikty s formátováním
  prettierConfig,
];

export default eslintConfig;
