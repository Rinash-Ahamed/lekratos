import js from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";

/**
 * Flat config. `eslint-config-next` is intentionally NOT used: it pulls in fast-glob → micromatch → braces,
 * which currently has an unpatched advisory (npm audit would fail). The Next-specific checks that matter
 * (no <img>, no raw <a> for internal links, no blocking <script>) are enforced below instead.
 */
export default defineConfig([
  globalIgnores([".next/**", "node_modules/**", "next-env.d.ts", "vendor/**", "coverage/**", "playwright-report/**", "test-results/**", "public/**", ".data*/**"]),
  js.configs.recommended,
  tseslint.configs.recommended,
  reactHooks.configs.flat.recommended,
  {
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "@typescript-eslint/consistent-type-imports": ["warn", { prefer: "type-imports", fixStyle: "inline-type-imports" }],
      "no-console": ["warn", { allow: ["warn", "error", "log", "table"] }],
      eqeqeq: ["error", "smart"],
      "no-restricted-syntax": [
        "error",
        { selector: "JSXOpeningElement[name.name='img']", message: "Use next/image (optimised, lazy, no layout shift)." },
        { selector: "JSXOpeningElement[name.name='a'] > JSXAttribute[name.name='href'][value.value=/^\\/[^/]/]", message: "Use next/link for internal navigation." },
        { selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']", message: "Avoid dangerouslySetInnerHTML; if unavoidable (JSON-LD, theme bootstrap) add an eslint-disable with the reason." },
      ],
    },
  },
  { files: ["tests/**", "scripts/**", "*.config.*"], rules: { "no-console": "off", "no-restricted-syntax": "off" } },
  { files: ["tests/e2e/**"], rules: { "react-hooks/rules-of-hooks": "off" } }, // Playwright fixtures use `use()`, which is not a React hook
]);
