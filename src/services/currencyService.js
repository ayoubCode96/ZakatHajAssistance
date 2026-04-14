// src/services/currencyService.js
import { supabase } from "./supabase";

let cache = {};
const CACHE_TTL = 300000; // 5 minutes

export const currencyService = {

  async getMetalsPrices(currency = "MAD") {
    try {
      const now = Date.now();

      if (cache[currency] && now - cache[currency].timestamp < CACHE_TTL) {
        return { success: true, ...cache[currency].data, fromCache: true };
      }

      const { data, error } = await supabase
        .from("prix_metaux_precieux")
        .select("type_metal, prix_gramme, prix_gramme_24k, prix_gramme_20k, prix_gramme_18k, devise, updated_at")
        .eq("actif", true)
        .eq("devise", currency);

      if (error) throw error;

      let gold   = data?.find((m) => m.type_metal === "OR");
      let silver = data?.find((m) => m.type_metal === "ARGENT");

      // Fallback → MAD si devise non trouvée
      if ((!gold || !silver) && currency !== "MAD") {
        const { data: fallbackData } = await supabase
          .from("prix_metaux_precieux")
          .select("type_metal, prix_gramme, prix_gramme_24k, prix_gramme_20k, prix_gramme_18k, devise, updated_at")
          .eq("actif", true)
          .eq("devise", "MAD");

        if (!gold)   gold   = fallbackData?.find((m) => m.type_metal === "OR");
        if (!silver) silver = fallbackData?.find((m) => m.type_metal === "ARGENT");
      }

      if (!gold || !silver) {
        return {
          success:    true,
          gold:       650,
          gold24k:    650,
          gold20k:    541.67,
          gold18k:    487.5,
          silver:     8.5,
          currency:   "MAD",
          isFallback: true,
        };
      }

      const metalsData = {
        gold:        gold.prix_gramme,
        gold24k:     gold.prix_gramme_24k ?? gold.prix_gramme,
        gold20k:     gold.prix_gramme_20k ?? parseFloat((gold.prix_gramme * (20 / 24)).toFixed(4)),
        gold18k:     gold.prix_gramme_18k ?? parseFloat((gold.prix_gramme * 0.75).toFixed(4)),
        silver:      silver.prix_gramme,
        currency:    gold.devise,
        lastUpdated: gold.updated_at,
      };

      cache[currency] = { data: metalsData, timestamp: now };

      return { success: true, ...metalsData };

    } catch (error) {
      console.error("Erreur getMetalsPrices:", error);
      return {
        success:    false,
        gold:       650,
        gold24k:    650,
        gold20k:    541.67,
        gold18k:    487.5,
        silver:     8.5,
        currency:   "MAD",
        isFallback: true,
        error:      error.message,
      };
    }
  },

  clearCache(currency = null) {
    if (currency) {
      delete cache[currency];
    } else {
      cache = {};
    }
  },

  formatCurrency(amount, currency = "MAD") {
    try {
      return new Intl.NumberFormat("fr-MA", {
        style:                 "currency",
        currency,
        minimumFractionDigits: 2,
      }).format(amount);
    } catch {
      return `${amount} ${currency}`;
    }
  },

  async getMetalsHistory(type = "OR") {
    try {
      const { data, error } = await supabase
        .from("historique_prix_metaux")
        .select("*")
        .eq("type_metal", type)
        .order("date_changement", { ascending: false })
        .limit(50);

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      return { success: false, data: [] };
    }
  },
};