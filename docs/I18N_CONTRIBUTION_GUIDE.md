# Multi-Language & Community Translation Contribution Guide

Welcome to the Clips Internationalization (i18n) Contributor Guide. Our mission is to make Clips accessible to video creators and editors worldwide.

## Supported Languages (Top Languages + RTL)
Clips natively supports:
- **English (`en`)** - Default base schema (LTR)
- **Spanish (`es`)** - Español (LTR)
- **French (`fr`)** - Français (LTR)
- **German (`de`)** - Deutsch (LTR)
- **Arabic (`ar`)** - العربية (RTL)
- **Portuguese (`pt`)** - Português (LTR)

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
4. Translate keys into your language.
5. Upload the JSON file to preview the live application immediately.
6. Click **Submit Translation** to register it directly via our API endpoint (`/api/i18n/contribute`).

## Adding a Locale via Pull Request
To contribute a new permanent locale:
1. Copy `app/lib/i18n/locales/en.json` to `app/lib/i18n/locales/<locale_code>.json` (e.g. `it.json`, `ja.json`, `ko.json`).
2. Translate all strings while preserving interpolation parameters like `{name}`, `{count}`, `{minutes}`.
3. Register your locale in `app/lib/i18n/translations.ts` and `app/lib/i18n/I18nProvider.tsx`.
4. Run tests: `npm test __tests__/lib/i18n.test.ts`.
5. Open a Pull Request!
