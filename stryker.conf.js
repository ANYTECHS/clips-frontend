/**
 * Stryker mutation testing configuration.
 * Runs against Jest using the existing jest config.
 */
module.exports = function(config) {
  config.set({
    mutate: [
      "app/**/*.ts",
      "app/**/*.tsx",
      "components/**/*.ts",
      "components/**/*.tsx",
      "lib/**/*.ts",
      "lib/**/*.tsx"
    ],
    mutator: "typescript",
    packageManager: "npm",
    reporters: ["progress", "clear-text", "html"],
    testRunner: "jest",
    jest: {
      projectType: "custom",
      config: require('./jest.config.js')
    },
    coverageAnalysis: "perTest",
    thresholds: { high: 80, low: 60 }
  });
};
