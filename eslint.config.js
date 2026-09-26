module.exports = {
  root: true,
  env: {
    browser: true,
    es2021: true,
    node: true,
  },
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  rules: {
    // Disallow nested ternary expressions to keep control flow readable.
    // Nested ternaries should be rewritten as if/else statements.
    'no-nested-ternary': 'error',
  },
};
