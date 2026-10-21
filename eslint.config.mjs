// eslint.config.js
import js from "@eslint/js";

export default [
  // Base recommended rules
  js.configs.recommended,

  // Node.js backend files
  {
    files: ["app.js", "data.js"],
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: "script",
      globals: {
        require: "readonly",
        module: "readonly",
        console: "readonly",
        process: "readonly"
      }
    },
    rules: {
      "no-unused-vars": ["warn", { "argsIgnorePattern": "^_" }],
      "eqeqeq": "error"
    }
  },

  // Browser (frontend) files
  {
    files: ["public/**/*.js"],
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: "script",
      globals: {
        document: "readonly",
        window: "readonly",
        alert: "readonly",
        axios: "readonly",
        console: "readonly"
      }
    },
    rules: {
      "no-unused-vars": ["warn", { "argsIgnorePattern": "^_" }]
    }
  },

  // Mocha test files
  {
    files: ["test/**/*.js"],
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: "script",
      globals: {
        describe: "readonly",
        it: "readonly",
        before: "readonly",
        after: "readonly",
        require: "readonly",
        module: "readonly"
      }
    },
    rules: {
      "no-unused-vars": ["warn", { "argsIgnorePattern": "^_" }]
    }
  }
];
