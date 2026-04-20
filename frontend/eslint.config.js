import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: "latest",
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
    },
  },
  {
    // TanStack Router routes co-export their route factory alongside the
    // component. Same shape for the UI state provider (context + provider
    // component live together). Disable the fast-refresh-only warning here
    // — HMR just does a full reload for these files, which is acceptable.
    files: [
      "src/routes/**/*.tsx",
      "src/ui/UIStateProvider.tsx",
      "src/auth/session.tsx",
    ],
    rules: { "react-refresh/only-export-components": "off" },
  },
);
