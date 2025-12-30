// src/services/currencyService.js
// Service de taux de change et métaux avec APIs fiables
const EXCHANGE_API_URL = "https://api.frankfurter.app/latest";

// Cache
let cache = {
  rates: null,
  metals: null,
  timestamp: 0,
};

// Valeurs par défaut réalistes par devise
const defaultMetalPrices = {
  EUR: { gold: 65, silver: 0.85 },
  USD: { gold: 70, silver: 0.92 },
  MAD: { gold: 650, silver: 8.5 },
  GBP: { gold: 55, silver: 0.72 },
  CAD: { gold: 90, silver: 1.18 },
  // Ajoutez d'autres devises au besoin
};

export const currencyService = {
  // Obtenir les prix des métaux précieux
  async getMetalsPrices(currency = "EUR") {
    try {
      const now = Date.now();

      // Vérifier le cache (30 minutes)
      if (
        cache.metals &&
        cache.metals.currency === currency &&
        now - cache.timestamp < 1800000
      ) {
        return { success: true, ...cache.metals, fromCache: true };
      }

      let goldPricePerGram = 0;
      let silverPricePerGram = 0;
      let fromFallback = false;

      // =============================
      // 1️⃣ Tenter l’API des métaux
      // =============================
      try {
        const response = await fetch("https://api.metals.live/v1/spot");

        if (response.ok) {
          const metalsData = await response.json();

          if (metalsData && metalsData.length > 0) {
            const goldData = metalsData.find((item) => item.metal === "gold");
            const silverData = metalsData.find(
              (item) => item.metal === "silver"
            );

            if (goldData && goldData.price) {
              // Convertir USD/oz → USD/g
              goldPricePerGram = goldData.price / 31.1035;
            }

            if (silverData && silverData.price) {
              silverPricePerGram = silverData.price / 31.1035;
            }
          }
        } else {
          console.warn("⚠️ API métaux non accessible → valeurs par défaut");
          fromFallback = true;
        }
      } catch (apiError) {
        console.warn("⚠️ API métaux échouée → valeurs par défaut");
        fromFallback = true;
      }

      // =============================
      // 2️⃣ Valeurs par défaut réalistes
      // =============================
      if (goldPricePerGram === 0 || silverPricePerGram === 0) {
        goldPricePerGram =
          defaultMetalPrices[currency]?.gold || defaultMetalPrices.EUR.gold;
        silverPricePerGram =
          defaultMetalPrices[currency]?.silver || defaultMetalPrices.EUR.silver;
        fromFallback = true;
      }

      // =============================
      // 3️⃣ Conversion devise (USD → autre)
      //    ⚠️ seulement si ce n’est pas déjà dans la bonne devise
      // =============================
      if (currency !== "USD" && !fromFallback) {
        const rates = await this.getExchangeRates("USD");
        if (rates.success) {
          const rate = rates.rates[currency];
          // éviter double conversion : ne convertir que si valeurs faibles
          if (rate && goldPricePerGram < 200) {
            goldPricePerGram *= rate;
            silverPricePerGram *= rate;
          }
        }
      }

      // =============================
      // 4️⃣ Format et cache
      // =============================
      const metalsData = {
        gold: Math.round(goldPricePerGram * 100) / 100,
        silver: Math.round(silverPricePerGram * 100) / 100,
        lastUpdated: new Date().toISOString(),
        currency: currency,
        fromFallback: fromFallback,
      };

      cache.metals = metalsData;
      cache.timestamp = now;

      return {
        success: true,
        ...metalsData,
      };
    } catch (error) {
      console.error("Erreur API métaux:", error);

      const fallbackGold =
        defaultMetalPrices[currency]?.gold || defaultMetalPrices.EUR.gold;
      const fallbackSilver =
        defaultMetalPrices[currency]?.silver || defaultMetalPrices.EUR.silver;

      return {
        success: false,
        gold: fallbackGold,
        silver: fallbackSilver,
        currency: currency,
        isFallback: true,
        error: error.message,
      };
    }
  },

  // Obtenir les taux de change
  async getExchangeRates(baseCurrency = "EUR") {
    try {
      const now = Date.now();

      // Vérifier le cache (10 minutes)
      if (cache.rates && now - cache.timestamp < 600000) {
        return { success: true, rates: cache.rates, fromCache: true };
      }

      const response = await fetch(`${EXCHANGE_API_URL}?from=${baseCurrency}`);

      if (!response.ok) {
        throw new Error("Erreur API taux de change");
      }

      const data = await response.json();

      // Taux par défaut au cas où
      const defaultRates = {
        USD: 1.08,
        EUR: 1.0,
        GBP: 0.85,
        CAD: 1.46,
        MAD: 10.8,
        DZD: 145.5,
        TND: 3.3,
        SAR: 4.05,
        AED: 3.97,
        QAR: 3.94,
        TRY: 34.5,
        EGP: 33.2,
      };

      // Fusionner avec les taux API
      const rates = { ...defaultRates, ...data.rates };

      // Mettre en cache
      cache.rates = rates;
      cache.timestamp = now;

      return {
        success: true,
        rates: rates,
        base: data.base,
        date: data.date,
      };
    } catch (error) {
      console.warn("Erreur API taux de change:", error.message);

      return {
        success: false,
        rates: defaultRates,
        base: "EUR",
        isFallback: true,
      };
    }
  },

  formatCurrency(amount, currency) {
    try {
      // Gérer les devises spécifiques
      const currencyConfig = {
        MAD: { locale: "fr-MA", symbol: "MAD" },
        DZD: { locale: "ar-DZ", symbol: "DZD" },
        TND: { locale: "ar-TN", symbol: "TND" },
        // Ajoutez d'autres devises au besoin
      };

      const config = currencyConfig[currency];

      if (config) {
        const formatter = new Intl.NumberFormat(config.locale, {
          style: "currency",
          currency: currency,
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });
        return formatter.format(amount);
      } else {
        // Format par défaut
        const formatter = new Intl.NumberFormat("fr-FR", {
          style: "currency",
          currency: currency,
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });
        return formatter.format(amount);
      }
    } catch (error) {
      return `${amount.toFixed(2)} ${currency}`;
    }
  },
};
