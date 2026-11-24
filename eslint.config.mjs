// @Author: Jonathan Serna
// @Date:   2026-11-23 20:50:15
// @Last Modified by:   Jonathan Serna
// @Last Modified time: 2026-11-23 20:50:15

/**
 * ESLint flat configuration for Next.js and TypeScript.
 */

import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const currentFile = fileURLToPath(import.meta.url);
const currentDir = dirname(currentFile);

const compat = new FlatCompat({
  baseDirectory: currentDir,
});

const eslintConfig = [
  {
    ignores: [".next/**", "node_modules/**", "assets/**", "scripts/**"],
  },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      "@next/next/no-img-element": "off",
    },
  },
];

export default eslintConfig;
