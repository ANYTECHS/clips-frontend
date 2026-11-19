// Standalone verification of the i18n logic (mirrors lib/i18n/index.ts) using
// only Node built-ins, so it runs before vitest/tsc are available. Writes a
// PASS/FAIL report to scripts/_verify-result.txt.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIR = join(__dirname, "..", "lib", "i18n", "locales");
const load = (f) => JSON.parse(readFileSync(join(DIR, f), "utf8"));
const en = load("en.json"), es = load("es.json"), fr = load("fr.json"), pt = load("pt.json"), ar = load("ar.json");
const translations = { en, es, fr, pt, ar };
const PLURAL_CATEGORIES = ["zero", "one", "two", "few", "many", "other"];
const isPluralNode = (v) => v && typeof v === "object" && !Array.isArray(v) && Object.keys(v).length > 0 && Object.keys(v).every((k) => PLURAL_CATEGORIES.includes(k));
const interpolate = (tpl, p) => !p ? tpl : tpl.replace(/\{\{(\w+)\}\}/g, (_, n) => (p[n] === undefined || p[n] === null ? "" : String(p[n])));
function resolveKey(loc, key) {
  let cur = translations[loc];
  for (const part of key.split(".")) {
    if (!cur || typeof cur !== "object" || Array.isArray(cur)) return undefined;
    cur = cur[part];
  }
  return cur;
}
function pluralCategory(loc, count) {
  const c = new Intl.PluralRules(loc).select(count);
  return PLURAL_CATEGORIES.includes(c) ? c : "other";
}
function t(key, params, locale) {
  const loc = ["en","es","fr","pt","ar"].includes(locale) ? locale : "en";
  let value = resolveKey(loc, key);
  if (value === undefined && loc !== "en") value = resolveKey("en", key);
  if (isPluralNode(value)) {
    const count = params && "count" in params ? Number(params.count) : NaN;
    const cat = Number.isFinite(count) ? pluralCategory(loc, count) : "other";
    let form = value[cat]; if (form === undefined) form = value["other"]; if (form === undefined) form = Object.values(value)[0];
    return typeof form === "string" ? interpolate(form, params) : key;
  }
  return typeof value === "string" ? interpolate(value, params) : key;
}
const formatXlm = (v, loc) => new Intl.NumberFormat(loc, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(typeof v === "string" ? Number(v) : v);
const formatNumber = (v, loc) => new Intl.NumberFormat(loc).format(typeof v === "string" ? Number(v) : v);
const formatDate = (d, loc, opts) => new Intl.DateTimeFormat(loc, opts || { month: "short", day: "numeric", year: "numeric" }).format(d instanceof Date ? d : new Date(d));
const formatCurrency = (v, cur, loc) => new Intl.NumberFormat(loc, { style: "currency", currency: cur }).format(typeof v === "string" ? Number(v) : v);

const lines = [];
let failures = 0;
const check = (name, actual, expected) => {
  const ok = actual === expected;
  if (!ok) failures++;
  lines.push(`${ok ? "✓" : "✗"} ${name}: got ${JSON.stringify(actual)} expected ${JSON.stringify(expected)}`);
};

const LOCALES = ["en","es","fr","pt","ar"];
const DATE = new Date(2024, 5, 15);
const DO = { month: "short", day: "numeric", year: "numeric" };

// formatDate
check("formatDate en", formatDate(DATE, "en"), "Jun 15, 2024");
for (const l of LOCALES) check(`formatDate ${l} delegates`, formatDate(DATE, l), new Intl.DateTimeFormat(l, DO).format(DATE));
check("formatDate en != es", formatDate(DATE, "en") !== formatDate(DATE, "es"), true);

// formatNumber
check("formatNumber en", formatNumber(1234567.89, "en"), "1,234,567.89");
check("formatNumber en 1.5", formatNumber(1.5, "en"), "1.5");
check("formatNumber es 1.5", formatNumber(1.5, "es"), "1,5");
for (const l of LOCALES) check(`formatNumber ${l} delegates`, formatNumber(9876543.21, l), new Intl.NumberFormat(l).format(9876543.21));

// formatXlm
check("formatXlm en 1234.5", formatXlm(1234.5, "en"), "1,234.50");
check("formatXlm en 0", formatXlm(0, "en"), "0.00");
check("formatXlm en 1", formatXlm(1, "en"), "1.00");
for (const l of LOCALES) check(`formatXlm ${l} delegates`, formatXlm(1234567.5, l), new Intl.NumberFormat(l, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(1234567.5));
check("formatXlm en 1.5", formatXlm(1.5, "en"), "1.50");
check("formatXlm es 1.5", formatXlm(1.5, "es"), "1,50");

// formatCurrency
check("formatCurrency usd en", formatCurrency(12.5, "USD", "en"), "$12.50");

// plural — delegation
const COUNTS = [0,1,2,3,5,10,11,15,20,100,101,1000];
for (const l of LOCALES) {
  const node = translations[l].clips.count;
  for (const c of COUNTS) {
    const cat = pluralCategory(l, c);
    const form = node[cat] ?? node["other"];
    const expected = interpolate(form, { count: c });
    check(`plural ${l} count=${c} (${cat})`, t("clips.count", { count: c }, l), expected);
  }
}
// plural — concrete
check("en 1", t("clips.count",{count:1},"en"), "1 clip");
check("en 0", t("clips.count",{count:0},"en"), "0 clips");
check("en 2", t("clips.count",{count:2},"en"), "2 clips");
check("en 5", t("clips.count",{count:5},"en"), "5 clips");
check("es 1", t("clips.count",{count:1},"es"), "1 clip");
check("es 0", t("clips.count",{count:0},"es"), "0 clips");
check("es 2", t("clips.count",{count:2},"es"), "2 clips");
check("fr 0", t("clips.count",{count:0},"fr"), "0 clip");
check("fr 1", t("clips.count",{count:1},"fr"), "1 clip");
check("fr 2", t("clips.count",{count:2},"fr"), "2 clips");
check("pt 1", t("clips.count",{count:1},"pt"), "1 clipe");
check("pt 2", t("clips.count",{count:2},"pt"), "2 clips");
check("ar 0", t("clips.count",{count:0},"ar"), "لا مقاطع");
check("ar 1", t("clips.count",{count:1},"ar"), "مقطع واحد");
check("ar 2", t("clips.count",{count:2},"ar"), "مقطعان");
check("ar 5", t("clips.count",{count:5},"ar"), "5 مقاطع");
check("ar 15", t("clips.count",{count:15},"ar"), "15 مقطعًا");
check("ar 100", t("clips.count",{count:100},"ar"), "100 مقطع");

// Print plural categories observed per locale (diagnostic)
lines.push("");
lines.push("Plural categories observed:");
for (const l of LOCALES) {
  const seen = {};
  for (const c of [0,1,2,3,5,10,11,15,20,100,101,1000]) seen[c] = pluralCategory(l, c);
  lines.push(`  ${l}: ${JSON.stringify(seen)}`);
}

lines.unshift(`RESULT: ${failures === 0 ? "PASS" : "FAIL"} (${failures} failures)`);
writeFileSync(join(__dirname, "_verify-result.txt"), lines.join("\n") + "\n", "utf8");
