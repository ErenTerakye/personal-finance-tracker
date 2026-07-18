import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "node_modules/**",
      "build/**",
      "dist/**",
      "src/finance_tracker/web/static/**",
      "frontend/src/generated/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["frontend/src/**/*.{ts,tsx}"],
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": "off",
      "no-empty": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_" },
      ],
    },
  },
  {
    files: ["frontend/src/**/*.{ts,tsx}"],
    ignores: ["frontend/src/api/client.ts"],
    rules: {
      "no-restricted-globals": [
        "error",
        { name: "fetch", message: "Use api/client.ts for browser transport." },
      ],
    },
  },
  {
    files: ["frontend/src/api/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["react", "react/*"],
              message: "API transport must not depend on React.",
            },
            {
              group: ["../app/**", "../features/**", "../shared/**"],
              message:
                "API transport depends only on generated/root types and browser primitives.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["frontend/src/shared/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "../../app/**",
                "../../features/**",
                "../../../app/**",
                "../../../features/**",
              ],
              message:
                "Shared modules must not import app composition or features.",
            },
          ],
        },
      ],
    },
  },
  {
    files: [
      "frontend/src/**/*.test.{ts,tsx}",
      "frontend/src/test/**/*.{ts,tsx}",
    ],
    rules: {
      "no-restricted-imports": "off",
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
);
