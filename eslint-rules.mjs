export const rules = {
  // Best Practices
  "eqeqeq"         : "error",
  "no-eval"        : "error",
  "no-implied-eval": "error",
  "no-with"        : "error",
  "no-alert"       : "error",
  "no-debugger"    : "error",

  // Code Style
  "no-tabs"                 : "error",
  "comma-dangle"            : ["error", "always-multiline"],
  "eol-last"                : "error",
  "linebreak-style"         : ["error", "unix"],
  "no-duplicate-imports"    : "error",
  "no-trailing-spaces"      : "error",
  "no-var"                  : "error",
  "prefer-const"            : "error",
  "quotes"                  : ["error", "double", { avoidEscape: true }],
  "semi"                    : "error",
  "no-mixed-spaces-and-tabs": "error",

  // ESLint v10 Recommended
  "no-useless-assignment": "error",
  "preserve-caught-error": "error",

  // TypeScript - Recommended & Strict
  "@typescript-eslint/await-thenable"                : "error",
  "@typescript-eslint/consistent-type-definitions"   : ["error", "interface"],
  "@typescript-eslint/consistent-type-imports"       : ["error", { "prefer": "type-imports" }],
  "@typescript-eslint/explicit-function-return-type" : ["error", { "allowExpressions": true }],
  "@typescript-eslint/no-base-to-string"             : "error",
  "@typescript-eslint/no-explicit-any"               : "error",
  "@typescript-eslint/no-floating-promises"          : "error",
  "@typescript-eslint/no-misused-promises"           : "error",
  "@typescript-eslint/no-non-null-assertion"         : "error",
  "@typescript-eslint/no-shadow"                     : "error",
  "@typescript-eslint/no-unnecessary-type-assertion" : "error",
  "@typescript-eslint/no-unsafe-assignment"          : "error",
  "@typescript-eslint/no-unsafe-call"                : "error",
  "@typescript-eslint/no-unused-vars"                : ["error", { "argsIgnorePattern": "^_" }],
  "@typescript-eslint/no-use-before-define"          : ["error", { "functions": false, "classes": true, "variables": true }],
  "@typescript-eslint/prefer-as-const"               : "error",
  "@typescript-eslint/prefer-nullish-coalescing"     : "error",
  "@typescript-eslint/prefer-optional-chain"         : "error",
  "@typescript-eslint/prefer-readonly"               : "error",
  "@typescript-eslint/prefer-reduce-type-parameter"  : "error",
  "@typescript-eslint/prefer-string-starts-ends-with": "error",
  "@typescript-eslint/require-await"                 : "error",

  // TypeScript - Disabled/Overridden
  "@typescript-eslint/no-inferrable-types"     : "off",
  "@typescript-eslint/no-unnecessary-condition": "off",
};
