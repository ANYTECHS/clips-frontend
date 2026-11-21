#!/usr/bin/env node


import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const LOCALES_DIR = join(__dirname, "..", "lib", "i18n", "locales");

const PLURAL_CATEGORIES = new Set([
  "zero",
  "one",
  "two",
  "few",
  "many",
  "other",
]);


const report = [];
function out(line) {
  report.push(line);
  console.log(line);
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}


function isPluralNode(value) {
  if (!isPlainObject(value)) return false;
  const keys = Object.keys(value);
  if (keys.length === 0) return false;
  return keys.every((k) => PLURAL_CATEGORIES.has(k));
}


function collectKeys(value, prefix, outArr) {
  if (isPluralNode(value)) {
    outArr.push(prefix);
    return;
  }
  if (isPlainObject(value)) {
    for (const key of Object.keys(value)) {
      const path = prefix ? `${prefix}.${key}` : key;
      collectKeys(value[key], path, outArr);
    }
    return;
  }
  outArr.push(prefix);
}

function resolvePath(root, path) {
  const parts = path.split(".");
  let current = root;
  for (const part of parts) {
    if (!isPlainObject(current) || !(part in current)) return undefined;
    current = current[part];
  }
  return current;
}

function loadLocales() {
  const files = readdirSync(LOCALES_DIR).filter((f) => f.endsWith(".json"));
  const locales = {};
  for (const file of files) {
    const code = file.replace(/\.json$/, "");
    const raw = readFileSync(join(LOCALES_DIR, file), "utf8");
    try {
      locales[code] = JSON.parse(raw);
    } catch (err) {
      out(`✗ ${file}: invalid JSON — ${err.message}`);
      return null;
    }
  }
  return locales;
}

function main() {
  const outIdx = process.argv.indexOf("--out");
  const outFile = outIdx > -1 ? process.argv[outIdx + 1] : null;

  const locales = loadLocales();
  if (!locales) {
    if (outFile) writeFileSync(outFile, report.join("\n") + "\n", "utf8");
    process.exitCode = 1;
    return;
  }

  if (!locales.en) {
    out("✗ No en.json reference locale found in " + LOCALES_DIR);
    if (outFile) writeFileSync(outFile, report.join("\n") + "\n", "utf8");
    process.exitCode = 1;
    return;
  }

  const enKeys = [];
  collectKeys(locales.en, "", enKeys);
  enKeys.sort();

  const otherLocales = Object.keys(locales)
    .filter((code) => code !== "en")
    .sort();

  out(`Reference: en (${enKeys.length} keys)`);
  out("");

  let hasMissing = false;

  for (const code of otherLocales) {
    const missing = enKeys.filter((k) => resolvePath(locales[code], k) === undefined);

    const localeKeys = [];
    collectKeys(locales[code], "", localeKeys);
    const extra = localeKeys.filter((k) => resolvePath(locales.en, k) === undefined);

    if (missing.length === 0) {
      out(`✓ ${code}: ${localeKeys.length} keys — OK`);
      if (extra.length > 0) {
        out(`  ⚠ ${extra.length} extra key(s) not in en:`);
        for (const k of extra) out(`    + ${k}`);
      }
    } else {
      hasMissing = true;
      out(`✗ ${code}: missing ${missing.length} key(s) present in en:`);
      for (const k of missing) out(`    - ${k}`);
      if (extra.length > 0) {
        out(`  ⚠ ${extra.length} extra key(s) not in en:`);
        for (const k of extra) out(`    + ${k}`);
      }
    }
  }

  out("");

  if (hasMissing) {
    out("❌ Translation key parity check FAILED — see missing keys above.");
    if (outFile) writeFileSync(outFile, report.join("\n") + "\n", "utf8");
    process.exitCode = 1;
    return;
  }

  out("✅ Translation key parity check passed — all locales match en.");
  if (outFile) writeFileSync(outFile, report.join("\n") + "\n", "utf8");
}

main();
