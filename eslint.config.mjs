import { FlatCompat } from "@eslint/eslintrc";
import js from "@eslint/js";

const compat = new FlatCompat({
  baseDirectory: import.meta.dirname,
});

export default [
  {
    ignores: ["dist/**", "web-build/**", ".expo/**", "ios/**", "android/**"],
  },
  js.configs.recommended,
  ...compat.extends("expo"),
];
