const nextConfig = require("eslint-config-next");

module.exports = [
  ...nextConfig,
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "warn"
    }
  }
];
