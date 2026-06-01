// services/nisabService.js
import { supabase } from "./supabase";
import metalPriceService from "./metalPriceService";

export const HAWL_DAYS_MALIKI = 354;

let _nisabsCache = null;
let _nisabsCacheTime = 0;
let _prixBetailCache = null;
let _prixBetailCacheTime = 0;
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

const nisabService = {
  // ══════════════════════════════════════════════════════════════
  // CHARGER TOUS LES NISABS DEPUIS LA BDD
  // ══════════════════════════════════════════════════════════════
  async getAllNisabs() {
    try {
      const now = Date.now();
      if (_nisabsCache && now - _nisabsCacheTime < CACHE_TTL) {
        return { success: true, nisabs: _nisabsCache };
      }

      const { data, error } = await supabase
        .from("nisab_zakat")
        .select(
          `
          id,
          montant_nisab,
          unite,
          source_religieuse,
          notes,
          type_zakat_id,
          type_zakat!inner(id, nom_type, taux_zakat, unite_mesure)
        `,
        )
        .eq("actif", true)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Déduplication — garder le plus récent par type_zakat_id
      const seen = new Set();
      const deduplicated = (data || []).filter((row) => {
        const typeId = row.type_zakat_id;
        if (seen.has(typeId)) return false;
        seen.add(typeId);
        return true;
      });

      // Indexation par nom_type
      const nisabs = {};
      for (const row of deduplicated) {
        const nomType = row.type_zakat?.nom_type;
        if (nomType) {
          nisabs[nomType] = {
            montant_nisab: parseFloat(row.montant_nisab),
            unite: row.unite,
            taux_zakat: parseFloat(row.type_zakat.taux_zakat),
            source: row.source_religieuse || "",
            notes: row.notes || "",
            type_zakat_id: row.type_zakat.id,
          };
        }
      }

      _nisabsCache = nisabs;
      _nisabsCacheTime = Date.now();
      return { success: true, nisabs };
    } catch (error) {
      console.error("[nisabService] getAllNisabs:", error);
      return { success: false, nisabs: {}, error: error.message };
    }
  },

  // ══════════════════════════════════════════════════════════════
  // CHARGER LES PRIX DU BÉTAIL DEPUIS LA BDD
  // Retourne un objet indexé par type_animal :
  //   prixBetail['CHAMEAU'] → { prix_unitaire: 8000, devise: 'MAD', source: '...' }
  //   prixBetail['VACHE']   → { prix_unitaire: 5000, ... }
  //   prixBetail['CHEVRE']  → { prix_unitaire: 800,  ... }
  //   prixBetail['MOUTON']  → { prix_unitaire: 600,  ... }
  // ══════════════════════════════════════════════════════════════
  async getPrixBetail(devise = "MAD") {
    try {
      const now = Date.now();
      const cacheKey = `betail_${devise}`;

      if (
        _prixBetailCache?.[cacheKey] &&
        now - _prixBetailCacheTime < CACHE_TTL
      ) {
        return { success: true, prixBetail: _prixBetailCache[cacheKey] };
      }

      // Chercher les prix dans la devise demandée
      let { data, error } = await supabase
        .from("prix_betail")
        .select("type_animal, prix_unitaire, devise, source, updated_at")
        .eq("actif", true)
        .eq("devise", devise)
        .order("updated_at", { ascending: false });

      if (error) throw error;

      // Fallback MAD si devise non trouvée
      if ((!data || data.length === 0) && devise !== "MAD") {
        const fallback = await supabase
          .from("prix_betail")
          .select("type_animal, prix_unitaire, devise, source, updated_at")
          .eq("actif", true)
          .eq("devise", "MAD")
          .order("updated_at", { ascending: false });

        data = fallback.data;
        error = fallback.error;
        if (error) throw error;
      }

      // Indexation par type_animal (dédupliqué — garder le plus récent)
      const seen = new Set();
      const prixBetail = {};
      for (const row of data || []) {
        if (!seen.has(row.type_animal)) {
          seen.add(row.type_animal);
          prixBetail[row.type_animal] = {
            prix_unitaire: parseFloat(row.prix_unitaire),
            devise: row.devise,
            source: row.source || "",
            updated_at: row.updated_at,
          };
        }
      }

      // Vérifier que les 4 animaux sont présents
      const animauxRequis = ["CHAMEAU", "VACHE", "CHEVRE", "MOUTON"];
      const manquants = animauxRequis.filter((a) => !prixBetail[a]);
      if (manquants.length > 0) {
        console.warn("[nisabService] Prix bétail manquants en BDD:", manquants);
      }

      // Mettre en cache
      if (!_prixBetailCache) _prixBetailCache = {};
      _prixBetailCache[cacheKey] = prixBetail;
      _prixBetailCacheTime = now;

      return { success: true, prixBetail };
    } catch (error) {
      console.error("[nisabService] getPrixBetail:", error);
      return { success: false, prixBetail: {}, error: error.message };
    }
  },

  // ══════════════════════════════════════════════════════════════
  // NISAB OR / ARGENT — seuil en valeur monétaire
  // ══════════════════════════════════════════════════════════════
  async getNisabByNomType(nomType) {
    try {
      const { data, error } = await supabase
        .from("nisab_zakat")
        .select("*, type_zakat!inner(id, nom_type, taux_zakat)")
        .eq("type_zakat.nom_type", nomType)
        .eq("actif", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      return { success: false, data: null, error: error.message };
    }
  },

  async computeNisabThreshold(baseChoisie = "or_24k", devise = "MAD") {
    try {
      let typeMetal, purete, nomTypeNisab;

      switch (baseChoisie) {
        case "or_24k":
          typeMetal = "OR";
          purete = "24k";
          nomTypeNisab = "OR";
          break;
        case "or_20k":
          typeMetal = "OR";
          purete = "20k";
          nomTypeNisab = "OR";
          break;
        case "or_18k":
          typeMetal = "OR";
          purete = "18k";
          nomTypeNisab = "OR";
          break;
        case "argent":
          typeMetal = "ARGENT";
          purete = null;
          nomTypeNisab = "ARGENT";
          break;
        default:
          typeMetal = "OR";
          purete = "24k";
          nomTypeNisab = "OR";
      }

      const { data: nisabRow, success: nisabOk } =
        await this.getNisabByNomType(nomTypeNisab);
      if (!nisabOk || !nisabRow) {
        throw new Error(`Nisab introuvable pour ${nomTypeNisab}`);
      }

      const {
        success: prixOk,
        prixGramme,
        source,
        update_at,
      } = await metalPriceService.getPrixGramme(typeMetal, purete, devise);
      if (!prixOk || !prixGramme) {
        throw new Error(`Prix ${typeMetal} introuvable`);
      }

      const grammes = parseFloat(nisabRow.montant_nisab);
      const threshold = Math.round(grammes * prixGramme * 100) / 100;

      return {
        success: true,
        threshold,
        montantNisab: grammes,
        unite: nisabRow.unite,
        prixGramme,
        purete,
        typeMetal,
        baseChoisie,
        devise,
        source,
        sourceReligieuse: nisabRow.source_religieuse || "",
        update_at,
        label: this._buildLabel(typeMetal, purete, grammes),
      };
    } catch (error) {
      console.error("[nisabService] computeNisabThreshold:", error);
      return { success: false, threshold: 0, error: error.message };
    }
  },

  // ══════════════════════════════════════════════════════════════
  // NISAB AGRICULTURE — vérifie si poids ≥ 653kg
  // ══════════════════════════════════════════════════════════════
  async checkNisabAgriculture(poidsKg) {
    try {
      const { success, nisabs } = await this.getAllNisabs();
      const seuil =
        success && nisabs["AGRICULTURE"]
          ? nisabs["AGRICULTURE"].montant_nisab
          : 653;
      const source =
        success && nisabs["AGRICULTURE"]
          ? nisabs["AGRICULTURE"].source
          : "Ibn Qudama - al-Mughni";

      const poids = parseFloat(poidsKg) || 0;
      const depasse = poids >= seuil;

      return {
        success: true,
        seuil,
        poidsKg: poids,
        depasse,
        manque: depasse ? 0 : Math.round((seuil - poids) * 100) / 100,
        surplus: depasse ? Math.round((poids - seuil) * 100) / 100 : 0,
        unite: "kg",
        source,
        tauxPluie: 0.1,
        tauxIrrigation: 0.05,
      };
    } catch (error) {
      return {
        success: false,
        seuil: 653,
        depasse: parseFloat(poidsKg) >= 653,
        tauxPluie: 0.1,
        tauxIrrigation: 0.05,
      };
    }
  },

  // ══════════════════════════════════════════════════════════════
  // CHECK NISAB MONÉTAIRE
  // ══════════════════════════════════════════════════════════════
  checkNisab(montantImposable, threshold) {
    const montant = parseFloat(montantImposable) || 0;
    const seuil = parseFloat(threshold) || 0;
    const depasse = montant >= seuil;
    return {
      depasse,
      surplus: depasse ? Math.round((montant - seuil) * 100) / 100 : 0,
      manque: !depasse ? Math.round((seuil - montant) * 100) / 100 : 0,
      ratio: seuil > 0 ? Math.round((montant / seuil) * 1000) / 10 : 0,
    };
  },

  clearNisabCache() {
    _nisabsCache = null;
    _nisabsCacheTime = 0;
    _prixBetailCache = null;
    _prixBetailCacheTime = 0;
  },

  _buildLabel(typeMetal, purete, grammes) {
    if (typeMetal === "ARGENT") return `${grammes}g argent`;
    if (purete) return `${grammes}g or ${purete.toUpperCase()}`;
    return `${grammes}g or`;
  },
};

export default nisabService;
