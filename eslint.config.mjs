import eslint           from "@eslint/js";
import tseslint         from "typescript-eslint";
import { defineConfig } from "eslint/config";

import { rules } from "./eslint-rules.mjs";

export default defineConfig(
  {
    ignores: [
      "tests",
      "eslint-rules.mjs",
      "eslint.config.mjs",
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        projectService: true,
      },
      globals: {
      },
    },
    rules: /** @type {import("eslint").Linter.RulesRecord} */ (/** @type {unknown} */ (rules)),
  },
);
