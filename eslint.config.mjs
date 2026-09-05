import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      "react/no-unescaped-entities": "off",
      // React 19's compiler rules. All three were "off"; re-enabled because
      // they are the rules that catch stale-closure and mutation bugs — the
      // class of bug that had /tracking wiping a concurrently-saved cell off
      // the screen on an unrelated failure.
      //
      // purity and immutability report zero violations, so they are errors:
      // free to keep clean, and a new one should stop the build.
      "react-hooks/purity": "error",
      "react-hooks/immutability": "error",
      // set-state-in-effect stays a warning: 20 existing sites, and they are
      // the ordinary "load from Supabase in an effect, then setState" pattern,
      // which is what an effect syncing with an external system looks like.
      // Warning surfaces new ones without failing the build on the old ones.
      "react-hooks/set-state-in-effect": "warn",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    ".next-build/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    ".claude/**", // local AI tooling / vendored skills
    ".agents/**", // local agent tooling / vendored skills
  ]),
]);

export default eslintConfig;
