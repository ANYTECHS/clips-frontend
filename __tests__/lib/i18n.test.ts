import {
  translate,
  detectBrowserLocale,
  registerCommunityTranslations,
  getBaseTranslationSchema,
} from "@/app/lib/i18n/translations";

describe("i18n translations", () => {
  describe("translate", () => {
    it("should return the key for missing translations", () => {
      expect(translate("en", "nonexistent.key")).toBe("nonexistent.key");
    });

    it("should return the English translation for existing keys", () => {
      const result = translate("en", "wallet.connect");
      expect(result).toBe("Connect Wallet");
    });

    it("should return the Spanish translation for existing keys", () => {
      const result = translate("es", "wallet.connect");
      expect(result).toBe("Conectar Cartera");
    });

    it("should return German translation for existing keys", () => {
      const result = translate("de", "comparison.sync_playback");
      expect(result).toBe("Wiedergabe synchronisieren");
    });

    it("should return Arabic translation for existing keys with RTL support", () => {
      const result = translate("ar", "comparison.title");
      expect(result).toBe("مقارنة المقاطع");
    });

    it("should fall back to English when locale translation is missing", () => {
      const result = translate("es", "wallet.send");
      expect(result).toBe("Enviar");
    });

    it("should substitute parameters in translations", () => {
      const result = translate("en", "activity.minutes_ago", { minutes: 5 });
      expect(result).toBe("5m ago");
    });

    it("should substitute multiple parameters", () => {
      const result = translate("en", "activity.showing", {
        count: 5,
        total: 20,
      });
      expect(result).toBe("Showing 5 of 20 transactions");
    });

    it("should handle nested translation keys", () => {
      const result = translate("en", "common.loading");
      expect(result).toBe("Loading...");
    });

    it("should handle Spanish nested keys with parameters", () => {
      const result = translate("es", "activity.showing", {
        count: 3,
        total: 15,
      });
      expect(result).toBe("Mostrando 3 de 15 transacciones");
    });

    it("should handle French nested keys with parameters", () => {
      const result = translate("fr", "activity.showing", {
        count: 10,
        total: 50,
      });
      expect(result).toBe("Affichage de 10 sur 50 transactions");
    });

    it("should handle Portuguese nested keys with parameters", () => {
      const result = translate("pt", "activity.showing", {
        count: 2,
        total: 10,
      });
      expect(result).toBe("Mostrando 2 de 10 transações");
    });

    it("should return brand kit keys across all top languages", () => {
      expect(translate("en", "brand_kit.create_kit")).toBe("Create Brand Kit");
      expect(translate("de", "brand_kit.create_kit")).toBe("Brand Kit erstellen");
      expect(translate("ar", "brand_kit.create_kit")).toBe("إنشاء مجموعة علامة تجارية");
      expect(translate("fr", "brand_kit.create_kit")).toBe("Créer un kit de marque");
      expect(translate("es", "brand_kit.create_kit")).toBe("Crear Kit de Marca");
    });

    it("should return voiceover keys across all top languages", () => {
      expect(translate("en", "voiceover.record")).toBe("Record Voiceover");
      expect(translate("de", "voiceover.record")).toBe("Voiceover aufnehmen");
      expect(translate("ar", "voiceover.record")).toBe("بدء تسجيل صوتي");
      expect(translate("fr", "voiceover.record")).toBe("Enregistrer une voix off");
      expect(translate("es", "voiceover.record")).toBe("Grabar Voz");
    });
  });

  describe("detectBrowserLocale", () => {
    const originalNavigator = global.navigator;

    afterEach(() => {
      Object.defineProperty(global, "navigator", {
        value: originalNavigator,
        configurable: true,
        writable: true,
      });
    });

    it("should match exact browser language", () => {
      Object.defineProperty(global, "navigator", {
        value: { languages: ["es", "en"], language: "es" },
        configurable: true,
        writable: true,
      });
      expect(detectBrowserLocale(["en", "es", "fr", "de", "ar"])).toBe("es");
    });

    it("should match language prefix (e.g. de-DE -> de, ar-EG -> ar)", () => {
      Object.defineProperty(global, "navigator", {
        value: { languages: ["de-DE", "en-US"], language: "de-DE" },
        configurable: true,
        writable: true,
      });
      expect(detectBrowserLocale(["en", "es", "fr", "de", "ar"])).toBe("de");

      Object.defineProperty(global, "navigator", {
        value: { languages: ["ar-SA"], language: "ar-SA" },
        configurable: true,
        writable: true,
      });
      expect(detectBrowserLocale(["en", "es", "fr", "de", "ar"])).toBe("ar");
    });

    it("should return null when no language matches", () => {
      Object.defineProperty(global, "navigator", {
        value: { languages: ["ja-JP"], language: "ja-JP" },
        configurable: true,
        writable: true,
      });
      expect(detectBrowserLocale(["en", "es", "fr", "de", "ar"])).toBe(null);
    });
  });

  describe("community translations", () => {
    it("should register and use custom community translation dictionary", () => {
      registerCommunityTranslations("it", {
        greeting: {
          hello: "Ciao, {name}!",
        },
      });

      expect(translate("it", "greeting.hello", { name: "Mario" })).toBe("Ciao, Mario!");
    });

    it("should export base translation schema for contributors", () => {
      const schema = getBaseTranslationSchema();
      expect(schema).toBeDefined();
      expect(schema.dashboard).toBeDefined();
      expect(schema.comparison).toBeDefined();
      expect(schema.brand_kit).toBeDefined();
      expect(schema.voiceover).toBeDefined();
    });
  });
});
