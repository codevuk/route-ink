import js from "@eslint/js"
import stylistic from "@stylistic/eslint-plugin"
import eslintConfigPrettier from "eslint-config-prettier"
import onlyWarn from "eslint-plugin-only-warn"
import tseslint from "typescript-eslint"

/**
 * A shared ESLint configuration for the repository.
 *
 * @type {import("eslint").Linter.Config}
 * */
export const config = [
  js.configs.recommended,
  eslintConfigPrettier,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx,mts,cts}"],
    languageOptions: {
      parserOptions: {
        projectService: true,
      },
    },
    rules: {
      "@typescript-eslint/switch-exhaustiveness-check": "error",
    },
  },
  {
    plugins: {
      "@stylistic": stylistic,
    },
    rules: {
      "turbo/no-undeclared-env-vars": "warn",
      "@stylistic/indent": ["error", 2],
      "@stylistic/semi": ["error", "always"],
      "@stylistic/quotes": ["error", "double"],
      "@stylistic/comma-dangle": ["error", "always-multiline"],
      "curly": ["error", "all"],
    },
  },
  {
    plugins: {
      onlyWarn,
    },
  },
  {
    ignores: ["dist/**"],
  },
]
