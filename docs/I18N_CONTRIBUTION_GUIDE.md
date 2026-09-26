# Multi-Language & Community Translation Contribution Guide

Welcome to the Clips Internationalization (i18n) Contributor Guide. Our mission is to make Clips accessible to video creators and editors worldwide.

> For a full technical reference — architecture, hook API, interpolation, RTL guidelines, number formatting, and known limitations — see [docs/I18N.md](./I18N.md).

## Supported Languages (Top Languages + RTL)
Clips natively supports:
- **English (`en`)** - Default base schema (LTR)
- **Spanish (`es`)** - Español (LTR)
- **French (`fr`)** - Français (LTR)
- **German (`de`)** - Deutsch (LTR)
- **Arabic (`ar`)** - العربية (RTL)
- **Portuguese (`pt`)** - Português (LTR)

RTL is also pre-configured for Hebrew (`he`), Farsi (`fa`), and Urdu (`ur`) — adding a JSON file and locale config is all that's needed to activate them.

## Automatic Browser Language Detection
When a user visits Clips for the first time without a saved preference, Clips inspects `navigator.languages` to detect their preferred language and immediately activates the appropriate translation and text direction (`ltr` vs `rtl`).

## RTL Support
Clips fully supports Right-to-Left (RTL) languages like Arabic (`ar`) and Hebrew (`he`). When an RTL language is selected:
1. `document.documentElement.dir` is set to `"rtl"`.
2. `document.documentElement.lang` is set to the language code.
3. The layout automatically mirrors via CSS flow and flex direction.

## In-App Community Translation Tool
Creators can translate and test new languages without writing code:
1. Open the **Language Switcher** in the top navigation bar.
2. Click **Community Translations**.
3. Download the base `en.json` template.
4. Translate keys into your language, preserving all `{placeholder}` tokens exactly as written.
5. Upload the JSON file to preview the live application immediately.
6. Click **Submit Translation** to register it directly via our API endpoint (`/api/i18n/contribute`).

The submission response includes a **coverage percentage** and a list of any missing keys. Aim for 100% before submitting.

## Adding a Locale via Pull Request
To contribute a new permanent locale:

1. **Create the locale file** — copy `app/lib/i18n/locales/en.json` to `app/lib/i18n/locales/<locale_code>.json` (e.g. `it.json`, `ja.json`, `ko.json`) and translate all string values.

2. **Register the translation** — import the new file in `app/lib/i18n/translations.ts` and add it to the `translations` map:
   ```ts
   import it from "./locales/it.json";
   const translations = { en, es, fr, de, ar, pt, it };
   ```

3. **Add the locale config** — add an entry to `DEFAULT_LOCALES` in `app/lib/i18n/I18nProvider.tsx`:
   ```ts
   { value: "it", label: "Italian", nativeName: "Italiano", direction: "ltr", flag: "🇮🇹" }
   ```
   Use `direction: "rtl"` for right-to-left languages.

4. **Add the new code to the validation script** — open `scripts/validate-translations.js` and append your locale code to `otherLocales`:
   ```js
   const otherLocales = ['es', 'fr', 'pt', 'de', 'ar', 'it']; // ← add here
   ```

5. **Validate key coverage** — run the validation script and fix any reported missing keys before opening a PR:
   ```bash
   npm run validate:translations
   ```
   A passing run prints:
   ```
   ✅ All translation keys are present in all locale files.
   ```

6. **Run the test suite**:
   ```bash
   npm test __tests__/lib/i18n.test.ts
   ```
   Add at least two test cases for the new locale: one that confirms a key translates correctly and one that confirms English fallback for a missing key.

7. **Open a Pull Request** with title `i18n: add <Language> (<code>) locale`. Include the coverage percentage in the description and confirm a native or near-native speaker has reviewed the translations.
