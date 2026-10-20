/**
 * Stryker mutation testing configuration.
 * Runs against Jest using the existing jest config.
 */
module.exports = function(config) {
  config.set({
    mutate: [
      "app/lib/auth.ts",
      "app/lib/walletStorage.ts",
      "app/lib/uploadValidation.ts",
      "app/lib/sanitize.ts"
    ],
    mutator: "typescript",
    packageManager: "npm",
    reporters: ["clear-text", "progress", "html", "json"],
    htmlReporter: {
      fileName: "reports/mutation/mutation.html"
    },
    jsonReporter: {
      fileName: "reports/mutation/mutation.json"
    },
    testRunner: "jest",
    jest: {
      projectType: "custom",
      config: require('./jest.config.js')
    },
    coverageAnalysis: "perTest",
    thresholds: { high: 80, low: 70, break: 70 }
  });
};
