// services/metalPriceService.js
// Source unique des prix métaux → table prix_metaux_precieux (BDD)
// Remplace l'usage de metalsPrices depuis CurrencyContext dans le calculateur

import { supabase } from "./supabase";

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const _cache = {};

const metalPriceService = {
  /**
   * Récupère tous les prix actifs pour une devise depuis prix_metaux_precieux.
   * Structure retournée :
   * {
   *   OR:     { prix_gramme, prix_gramme_24k, prix_gramme_20k, prix_gramme_18k, devise, source, date_application }
   *   ARGENT: { prix_gramme, devise, source, date_application }
   * }
   */
  async getPricesByDevise(devise = "MAD") {
    const key = `prices_${devise}`;
    const now = Date.now();

    if (_cache[key] && now - _cache[key].ts < CACHE_TTL) {
      return _cache[key].data;
    }

    try {
      const { data, error } = await supabase
        .from("prix_metaux_precieux")
        .select(
          "type_metal, prix_gramme, prix_gramme_24k, prix_gramme_20k, prix_gramme_18k, devise, date_application, source",
        )
        .eq("devise", devise)
        .eq("actif", true)
        .order("date_application", { ascending: false });

      if (error) throw error;

      // Fallback MAD si devise introuvable
      if ((!data || data.length === 0) && devise !== "MAD") {
        return this.getPricesByDevise("MAD");
      }

      const prices = {};
      for (const row of data || []) {
        if (!prices[row.type_metal]) {
          prices[row.type_metal] = {
            prix_gramme: parseFloat(row.prix_gramme) || 0,
            prix_gramme_24k: parseFloat(row.prix_gramme_24k) || 0,
            prix_gramme_20k: parseFloat(row.prix_gramme_20k) || 0,
            prix_gramme_18k: parseFloat(row.prix_gramme_18k) || 0,
            devise: row.devise,
            source: row.source,
            date_application: row.date_application,
          };
        }
      }

      const result = {
        success: true,
        prices,
        devise,
        lastUpdated: data?.[0]?.date_application || null,
      };

      _cache[key] = { data: result, ts: now };
      return result;
    } catch (error) {
      console.error("[metalPriceService] getPricesByDevise:", error);
      return { success: false, prices: {}, devise, error: error.message };
    }
  },

  /**
   * Retourne le prix au gramme pour un métal + pureté donnée.
   * @param {"OR"|"ARGENT"} typeMetal
   * @param {"24k"|"20k"|"18k"|null} purete  — null pour ARGENT
   * @param {string} devise
   */
  async getPrixGramme(typeMetal, purete = null, devise = "MAD") {
    const { success, prices } = await this.getPricesByDevise(devise);
    if (!success || !prices[typeMetal]) {
      return {
        success: false,
        prixGramme: 0,
        error: `Prix ${typeMetal} introuvable`,
      };
    }

    const m = prices[typeMetal];
    let prixGramme = 0;

    if (typeMetal === "ARGENT") {
      prixGramme = m.prix_gramme;
    } else {
      switch (purete) {
        case "24k":
          prixGramme = m.prix_gramme_24k;
          break;
        case "20k":
          prixGramme = m.prix_gramme_20k;
          break;
        case "18k":
          prixGramme = m.prix_gramme_18k;
          break;
        default:
          prixGramme = m.prix_gramme_24k;
      }
    }

    return {
      success: true,
      prixGramme,
      devise: m.devise,
      source: m.source,
      date_application: m.date_application,
    };
  },

  /**
   * Retourne un objet "prices" plat compatible avec zakatService._buildActifsFromFormData.
   * Structure : { gold, gold24k, gold20k, gold18k, silver, silver999, silver925 }
   */
  async getPricesForZakatCalc(devise = "MAD") {
    const { success, prices } = await this.getPricesByDevise(devise);

    if (!success) {
      // Valeurs de secours si BDD inaccessible
      return {
        success: false,
        prices: {
          gold: 650,
          gold24k: 650,
          gold20k: parseFloat((650 * (20 / 24)).toFixed(4)),
          gold18k: parseFloat((650 * 0.75).toFixed(4)),
          gold21k: parseFloat((650 * 0.875).toFixed(4)),
          silver: 8.5,
          silver999: 8.5,
          silver925: parseFloat((8.5 * 0.925).toFixed(4)),
        },
      };
    }

    const or = prices["OR"] || {};
    const argent = prices["ARGENT"] || {};
    const g24 = or.prix_gramme_24k || or.prix_gramme || 650;
    const silver = argent.prix_gramme || 8.5;

    return {
      success: true,
      prices: {
        gold: g24,
        gold24k: g24,
        gold20k: or.prix_gramme_20k || parseFloat((g24 * (20 / 24)).toFixed(4)),
        gold18k: or.prix_gramme_18k || parseFloat((g24 * 0.75).toFixed(4)),
        gold21k: parseFloat((g24 * 0.875).toFixed(4)),
        silver,
        silver999: silver,
        silver925: parseFloat((silver * 0.925).toFixed(4)),
      },
      lastUpdated: or.date_application || argent.date_application || null,
      source: or.source || argent.source || null,
    };
  },

  clearCache(devise = null) {
    if (devise) {
      delete _cache[`prices_${devise}`];
    } else {
      Object.keys(_cache).forEach((k) => delete _cache[k]);
    }
  },
};

export default metalPriceService;
