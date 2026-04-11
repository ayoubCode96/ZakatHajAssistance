// src/services/currencyService.js
import { supabase } from "../supabaseClient";

// Cache local
let cache = {
  metals: null,
  timestamp: 0,
};

export const currencyService = {
  // ============================
  // 🟡 GET METALS PRICES FROM DB
  // ============================
  async getMetalsPrices() {
    try {
      const now = Date.now();

      // cache 5 minutes
      if (cache.metals && now - cache.timestamp < 300000) {
        return { success: true, ...cache.metals, fromCache: true };
      }

      const { data, error } = await supabase
        .from("prix_metaux_precieux")
        .select("*")
        .eq("actif", true);

      if (error) throw error;

      const gold = data.find((m) => m.type_metal === "OR");
      const silver = data.find((m) => m.type_metal === "ARGENT");

      // fallback بسيط فقط إذا DB فارغة
      if (!gold || !silver) {
        return {
          success: true,
          gold: 650,
          silver: 8.5,
          currency: "MAD",
          isFallback: true,
        };
      }

      const metalsData = {
        gold: gold.prix_gramme,
        silver: silver.prix_gramme,
        currency: gold.devise,
        lastUpdated: gold.updated_at,
      };

      // cache
      cache.metals = metalsData;
      cache.timestamp = now;

      return {
        success: true,
        ...metalsData,
      };
    } catch (error) {
      console.error("Erreur DB:", error);

      return {
        success: false,
        gold: 650,
        silver: 8.5,
        currency: "MAD",
        isFallback: true,
        error: error.message,
      };
    }
  },

  // ============================
  // 💱 FORMAT CURRENCY
  // ============================
  formatCurrency(amount, currency = "MAD") {
    try {
      const formatter = new Intl.NumberFormat("fr-MA", {
        style: "currency",
        currency: currency,
        minimumFractionDigits: 2,
      });

      return formatter.format(amount);
    } catch (error) {
      return `${amount} ${currency}`;
    }
  },

  // ============================
  // 📊 GET HISTORIQUE (OPTIONAL)
  // ============================
  async getMetalsHistory(type = "OR") {
    try {
      const { data, error } = await supabase
        .from("historique_prix_metaux")
        .select("*")
        .eq("type_metal", type)
        .order("date_changement", { ascending: false })
        .limit(50);

      if (error) throw error;

      return {
        success: true,
        data,
      };
    } catch (error) {
      return {
        success: false,
        data: [],
      };
    }
  },
};