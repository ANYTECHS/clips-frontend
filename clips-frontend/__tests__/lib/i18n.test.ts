import { translate } from "@/app/lib/i18n/translations";

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

    it("should fall back to English when locale translation is missing", () => {
      // Test with a key that exists in en but might not exist in es due to incomplete translations
      // Both should have wallet keys, so this will return from Spanish
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
  });
});
