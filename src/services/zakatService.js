// services/zakatService.js
// ═══════════════════════════════════════════════════════════════════
// Règles Malékites implémentées :
//   1. Zakat = min(montant_debut_hawl, montant_fin) × 2.5%
//   2. Nisab perdu → hawl interrompu + zakat = 0 + statut EXEMPTE
//   3. Hawl complété en nouvelle année hijri → INSERT annee_hijri courante
//   4. Ancien estimatif (même période) → marqué REMPLACE, visible=false
//   5. date_fin = date_debut_hawl + 354j hijri (pas +1 an grégorien)
//   6. Paiement complet → nouveau hawl démarre (géré dans ZakatMainScreen)
// ═══════════════════════════════════════════════════════════════════

import { supabase } from "./supabase";
import hawlService from "./hawlService";
import {
  getCurrentHijriYear,
  getHijriYearFromDate,
  computeDateEcheanceGreg,
  checkExistingZakatForYear,
} from "../utils/zakatUtils";

// ─── MAPPING ASSETS ──────────────────────────────────────────────────────────
export const getAssetTranslationKey = (frenchAssetName) => {
  if (!frenchAssetName) return "asset_cash";
  const mappings = {
    "Argent liquide": "asset_cash",
    Épargne: "asset_savings",
    "Compte courant": "asset_current_account",
    "Dépôt fixe": "asset_fixed_deposit",
    "Or 24k": "asset_gold_24k",
    "Or 21k": "asset_gold_21k",
    "Or 20k": "asset_gold_20k",
    "Or 18k": "asset_gold_18k",
    "Argent métal": "asset_silver_metal",
    "Biens commerciaux": "asset_commercial_goods",
    Inventaire: "asset_inventory",
    "Immobilier locatif": "asset_rental_property",
    Véhicules: "asset_vehicles",
    Récoltes: "asset_crops",
    Chameaux: "asset_camels",
    Vaches: "asset_cows",
    Chèvres: "asset_goats",
    Moutons: "asset_sheep",
    Créances: "asset_receivables",
    "Créances douteuses": "asset_doubtful_receivables",
  };
  if (frenchAssetName?.includes("Récoltes")) {
    if (frenchAssetName.includes("Pluie")) return "asset_crops_rain";
    if (
      frenchAssetName.includes("Risque") ||
      frenchAssetName.includes("Irrigation")
    )
      return "asset_crops_cost";
    return "asset_crops";
  }
  if (frenchAssetName?.startsWith("Argent métal")) return "asset_silver_metal";
  if (mappings[frenchAssetName]) return mappings[frenchAssetName];
  return "asset_cash";
};

export const getZakatTypeTranslationKey = (frenchTypeName) => {
  if (!frenchTypeName) return "type_cash";
  const mappings = {
    OR: "type_or",
    ARGENT: "type_argent",
    EPARGNE: "type_epargne",
    COMMERCE: "type_commerce",
    AGRICULTURE: "type_agriculture",
    BETAIL: "type_betail",
    CREANCES: "type_creances",
    CASH: "type_cash",
    LIQUIDE: "type_cash",
  };
  return mappings[frenchTypeName.trim().toUpperCase()] || "type_cash";
};

// ─── HELPERS PRIVÉS ──────────────────────────────────────────────────────────
function _mapNisabApplique(typeNisabApplique) {
  const map = {
    OR: "or_24k",
    OR_24K: "or_24k",
    OR_20K: "or_20k",
    OR_18K: "or_18k",
    ARGENT: "argent",
    SILVER: "argent",
  };
  if (!typeNisabApplique) return null;
  return map[typeNisabApplique.toUpperCase()] || null;
}

function _buildTypeNisabApplique(nisabBase) {
  const map = {
    or_24k: "OR_24K",
    or_20k: "OR_20K",
    or_18k: "OR_18K",
    argent: "ARGENT",
    gold: "OR_24K",
    silver: "ARGENT",
  };
  return map[nisabBase] || "OR_24K";
}

function _mapNisabAppliqueTOBase(typeNisabApplique) {
  const map = {
    OR: "or_24k",
    OR_24K: "or_24k",
    OR_20K: "or_20k",
    OR_18K: "or_18k",
    ARGENT: "argent",
    SILVER: "argent",
  };
  if (!typeNisabApplique) return "or_24k";
  return map[typeNisabApplique.toUpperCase()] || "or_24k";
}

function _deduplicateActifsByName(actifs) {
  const map = {};
  for (const a of actifs) {
    if (!map[a.nom_actif]) {
      map[a.nom_actif] = a;
    } else {
      const existingDate = new Date(
        map[a.nom_actif].updated_at || map[a.nom_actif].created_at || 0,
      );
      const newDate = new Date(a.updated_at || a.created_at || 0);
      if (newDate > existingDate) map[a.nom_actif] = a;
    }
  }
  return Object.values(map);
}

// ─── ZAKATSERVICE ─────────────────────────────────────────────────────────────
export const zakatService = {
  // ─── LOAD EXISTING ACTIFS ─────────────────────────────────────────────────
  async loadExistingActifsForYear(userId, hijriYear = null) {
    try {
      const year = hijriYear || getCurrentHijriYear();

      const { data: zakatAnnuel } = await supabase
        .from("zakat_annuel")
        .select("id, type_nisab_applique, montant_total_dettes")
        .eq("utilisateur_id", userId)
        .eq("annee_hijri", year)
        .maybeSingle();

      if (!zakatAnnuel) {
        const { data: lastActifs } = await supabase
          .from("zakat_actif")
          .select("*, type_zakat(nom_type, taux_zakat, unite_mesure)")
          .eq("utilisateur_id", userId)
          .eq("actif", true)
          .order("updated_at", { ascending: false });

        if (lastActifs && lastActifs.length > 0) {
          return {
            success: true,
            data: _deduplicateActifsByName(lastActifs),
            zakatAnnuelId: null,
            nisabBase: null,
            montantDettes: 0,
          };
        }
        return {
          success: true,
          data: null,
          zakatAnnuelId: null,
          nisabBase: null,
          montantDettes: 0,
        };
      }

      const { data: actifs, error } = await supabase
        .from("zakat_actif")
        .select("*, type_zakat(nom_type, taux_zakat, unite_mesure)")
        .eq("zakat_annuel_id", zakatAnnuel.id)
        .eq("actif", true)
        .order("updated_at", { ascending: false });

      if (error) throw error;

      return {
        success: true,
        data: _deduplicateActifsByName(actifs || []),
        zakatAnnuelId: zakatAnnuel.id,
        nisabBase: _mapNisabApplique(zakatAnnuel.type_nisab_applique),
        montantDettes: parseFloat(zakatAnnuel.montant_total_dettes) || 0,
      };
    } catch (error) {
      console.error("Erreur loadExistingActifsForYear:", error);
      return { success: false, error: error.message };
    }
  },

  // ─── ACTIFS → FORM DATA ───────────────────────────────────────────────────
  actifsToFormData(actifs, montantDettes = 0) {
    const fd = {};
    const getVal = (nomActif) => {
      const a = actifs.find(
        (x) => x.nom_actif === nomActif && x.actif !== false,
      );
      return a ? a.valeur_totale?.toString() || "" : "";
    };
    const getQty = (nomActif) => {
      const a = actifs.find(
        (x) => x.nom_actif === nomActif && x.actif !== false,
      );
      return a ? a.quantite?.toString() || "" : "";
    };

    fd.cash = getVal("Argent liquide");
    fd.savings = getVal("Épargne");
    fd.currentAccounts = getVal("Compte courant");
    fd.fixedDeposits = getVal("Dépôt fixe");

    const orActif = actifs.find(
      (x) => x.nom_actif?.startsWith("Or ") && x.actif !== false,
    );
    fd.goldWeight = orActif ? orActif.quantite?.toString() || "" : "";
    fd.goldPurity = orActif
      ? orActif.nom_actif.replace("Or ", "").trim() || "24k"
      : "24k";

    const argentActif = actifs.find(
      (x) => x.nom_actif?.startsWith("Argent métal") && x.actif !== false,
    );
    fd.silverWeight = argentActif ? argentActif.quantite?.toString() || "" : "";
    fd.silverPurity = argentActif
      ? argentActif.nom_actif.replace("Argent métal ", "").trim() || "925"
      : "925";

    fd.tradeGoodsValue = getVal("Biens commerciaux");
    fd.businessInventory = getVal("Inventaire");
    fd.rentalProperties = getVal("Immobilier locatif");
    fd.vehiclesValue = getVal("Véhicules");

    const recoltesActif = actifs.find(
      (x) => x.nom_actif?.startsWith("Récoltes") && x.actif !== false,
    );
    fd.cropsWeight = recoltesActif
      ? recoltesActif.quantite?.toString() || ""
      : "";
    fd.cropsMarketValue = recoltesActif
      ? recoltesActif.valeur_totale?.toString() || ""
      : "";
    fd.irrigationType = recoltesActif?.nom_actif?.includes("Pluie")
      ? "rain"
      : "cost";

    fd.camelsCount = getQty("Chameaux");
    fd.cowsCount = getQty("Vaches");
    fd.goatsCount = getQty("Chèvres");
    fd.sheepCount = getQty("Moutons");

    fd.receivables = getVal("Créances");
    fd.doubtfulReceivables = getVal("Créances douteuses");
    fd.includeAllReceivables = actifs.some(
      (x) => x.nom_actif === "Créances douteuses" && x.actif !== false,
    );
    // fd.debts = montantDettes > 0 ? montantDettes.toString() : "";
    fd.debts = montantDettes.toString();
    return fd;
  },

  // ─── SAVE ASSETS ─────────────────────────────────────────────────────────
async saveZakatActifs(userId, formData, metalPrices, zakatAnnuelId = null, prixBetail = null) {
    try {
      if (!zakatAnnuelId)
        return { success: false, error: "zakatAnnuelId requis" };

      const actifsAttendus = this._buildActifsFromFormData(
        userId,
        formData,
        metalPrices,
        zakatAnnuelId,
        prixBetail
      );

      const { data: actifsExistants } = await supabase
        .from("zakat_actif")
        .select("id, nom_actif, quantite, valeur_totale, actif, updated_at")
        .eq("zakat_annuel_id", zakatAnnuelId)
        .eq("actif", true)
        .order("updated_at", { ascending: false });

      const existantsMap = {};
      const doublonsIds = [];
      for (const a of actifsExistants || []) {
        if (!existantsMap[a.nom_actif]) existantsMap[a.nom_actif] = a;
        else doublonsIds.push(a.id);
      }
      if (doublonsIds.length > 0) {
        await supabase
          .from("zakat_actif")
          .update({ actif: false, updated_at: new Date().toISOString() })
          .in("id", doublonsIds);
      }

      const attendusMap = {};
      for (const a of actifsAttendus) attendusMap[a.nom_actif] = a;

      for (const nomActif of Object.keys(existantsMap)) {
        if (!attendusMap[nomActif]) {
          await supabase
            .from("zakat_actif")
            .update({ actif: false, updated_at: new Date().toISOString() })
            .eq("id", existantsMap[nomActif].id);
        }
      }

      for (const attendu of actifsAttendus) {
        const existant = existantsMap[attendu.nom_actif];
        if (existant) {
          const qChanged =
            Math.abs((existant.quantite || 0) - (attendu.quantite || 0)) >
            0.0001;
          const vChanged =
            Math.abs(
              (existant.valeur_totale || 0) - (attendu.valeur_totale || 0),
            ) > 0.01;
          if (qChanged || vChanged) {
            await supabase
              .from("zakat_actif")
              .update({
                quantite: attendu.quantite,
                valeur_unitaire: attendu.valeur_unitaire,
                valeur_totale: attendu.valeur_totale,
                updated_at: new Date().toISOString(),
              })
              .eq("id", existant.id);
          }
        } else {
          await supabase
            .from("zakat_actif")
            .insert({ ...attendu, date_ajout: new Date().toISOString() });
        }
      }

      return { success: true };
    } catch (error) {
      console.error("Erreur saveZakatActifs:", error);
      return { success: false, error: error.message };
    }
  },

  // ─── BUILD ACTIFS FROM FORM DATA ──────────────────────────────────────────
  _buildActifsFromFormData(userId, formData, metalPrices, zakatAnnuelId,prixBetail = null) {
    const actifs = [];
    const push = (nom, typeId, quantite, valeur) => {
      if (valeur > 0)
        actifs.push({
          utilisateur_id: userId,
          zakat_annuel_id: zakatAnnuelId,
          type_zakat_id: typeId,
          nom_actif: nom,
          quantite,
          valeur_unitaire: quantite > 0 ? valeur / quantite : valeur,
          valeur_totale: valeur,
          actif: true,
        });
    };
    const p = (v) => Math.max(0, parseFloat(v || 0));

    push("Argent liquide", 3, p(formData.cash), p(formData.cash));
    push("Épargne", 3, p(formData.savings), p(formData.savings));
    push(
      "Compte courant",
      3,
      p(formData.currentAccounts),
      p(formData.currentAccounts),
    );
    push("Dépôt fixe", 3, p(formData.fixedDeposits), p(formData.fixedDeposits));

    const goldWeight = p(formData.goldWeight);
    if (goldWeight > 0) {
      const goldPrice =
        formData.goldPurity === "24k"
          ? metalPrices.gold24k || metalPrices.gold || 650
          : formData.goldPurity === "21k"
            ? metalPrices.gold21k || (metalPrices.gold || 650) * 0.875
            : formData.goldPurity === "20k"
              ? metalPrices.gold20k || (metalPrices.gold || 650) * (20 / 24)
              : metalPrices.gold18k || (metalPrices.gold || 650) * 0.75;
      push(`Or ${formData.goldPurity}`, 1, goldWeight, goldWeight * goldPrice);
    }

    const silverWeight = p(formData.silverWeight);
    if (silverWeight > 0) {
      const silverPrice =
        formData.silverPurity === "999"
          ? metalPrices.silver999 || metalPrices.silver || 8.5
          : metalPrices.silver925 || (metalPrices.silver || 8.5) * 0.925;
      push(
        `Argent métal ${formData.silverPurity || "925"}`,
        2,
        silverWeight,
        silverWeight * silverPrice,
      );
    }

    push("Biens commerciaux", 4, 1, p(formData.tradeGoodsValue));
    push("Inventaire", 4, 1, p(formData.businessInventory));
    push("Immobilier locatif", 4, 1, p(formData.rentalProperties));
    push("Véhicules", 4, 1, p(formData.vehiclesValue));

    const cropsWeight = p(formData.cropsWeight);
    if (cropsWeight > 0) {
      const cropsValue = p(formData.cropsMarketValue) || cropsWeight * 0.5;
      const typeLabel =
        formData.irrigationType === "rain" ? "Pluie" : "Irrigation";
      push(`Récoltes (${typeLabel})`, 5, cropsWeight, cropsValue);
    }

 const camelCount = p(formData.camelsCount);
const cowCount   = p(formData.cowsCount);
const goatCount  = p(formData.goatsCount);
const sheepCount = p(formData.sheepCount);

const pChameau = prixBetail?.CHAMEAU?.prix_unitaire ?? 2500;
const pVache   = prixBetail?.VACHE?.prix_unitaire   ?? 1200;
const pChevre  = prixBetail?.CHEVRE?.prix_unitaire  ?? 150;
const pMouton  = prixBetail?.MOUTON?.prix_unitaire  ?? 120;

if (camelCount > 0) push("Chameaux", 6, camelCount, camelCount * pChameau);
if (cowCount   > 0) push("Vaches",   6, cowCount,   cowCount   * pVache);
if (goatCount  > 0) push("Chèvres",  6, goatCount,  goatCount  * pChevre);
if (sheepCount > 0) push("Moutons",  6, sheepCount, sheepCount * pMouton);


    const receivables = p(formData.receivables);
    if (receivables > 0) push("Créances", 7, 1, receivables);
    if (formData.includeAllReceivables) {
      const doubtful = p(formData.doubtfulReceivables);
      if (doubtful > 0) push("Créances douteuses", 7, 1, doubtful);
    }

    return actifs;
  },

  // ─── SAVE DETTES ─────────────────────────────────────────────────────────
  async saveDettes(userId, formData, zakatAnnuelId = null) {
    try {
      const montantDette = parseFloat(formData.debts) || 0;

      await supabase
        .from("dettes")
        .update({ rembourse: true })
        .eq("utilisateur_id", userId)
        .eq("rembourse", false);

      if (montantDette > 0) {
        const { error } = await supabase.from("dettes").insert({
          utilisateur_id: userId,
          montant_dette: montantDette,
          type_dette: "DETTE_GENERALE",
          deductible: true,
          rembourse: false,
        });
        if (error) throw error;
      }

      if (zakatAnnuelId) {
        await supabase
          .from("zakat_annuel")
          .update({ montant_total_dettes: montantDette })
          .eq("id", zakatAnnuelId);
      }

      return { success: true, montantDette };
    } catch (error) {
      console.error("Erreur saveDettes:", error);
      return { success: false, error: error.message };
    }
  },

  // ─── SAVE / UPDATE ZAKAT ANNUEL ──────────────────────────────────────────
  // Logique complète :
  //   1. Lire hawl actif pour obtenir date_debut et montant_debut
  //   2. date_fin = date_debut_hawl + 354j hijri (pas +1 an greg)
  //   3. Si hawl COMPLETE → zakat = min(montant_debut, montant_fin)
  //   4. Si hawl EN_COURS → zakat estimative sur montant actuel
  //   5. Si nisab perdu → zakat = 0, statut EXEMPTE
  //   6. Si ancienne entrée pour l'année du début du hawl → REMPLACE
  async saveZakatAnnuel(userId, results, formData) {
    try {
      const currentHijriYear = getCurrentHijriYear();

      // ✅ Lire hawl pour date_debut et montant_debut
      const { data: hawlData } = await supabase
        .from("hawl_tracking")
        .select("id, date_debut, montant_debut, statut")
        .eq("utilisateur_id", userId)
        .in("statut", ["EN_COURS", "COMPLETE"])
        .order("date_debut", { ascending: false })
        .limit(1)
        .single();

      const hawlDateDebut = hawlData?.date_debut || null;
      const montantDebut = parseFloat(hawlData?.montant_debut || 0);
      const hawlComplete =
        hawlData?.statut === "COMPLETE" || results.hawlCompleted;

      // ✅ date_fin = date_debut_hawl + 354j hijri (source de vérité)
      const dateFin = computeDateEcheanceGreg(hawlDateDebut || new Date());

      // ✅ Si hawl vient de se compléter en nouvelle année hijri →
      //    marquer l'estimatif de l'année du début du hawl comme REMPLACE
      if (hawlComplete && hawlDateDebut) {
        const anneeDebutHawl = getHijriYearFromDate(hawlDateDebut);
        if (anneeDebutHawl && anneeDebutHawl !== currentHijriYear) {
          await supabase
            .from("zakat_annuel")
            .update({
              statut: "REMPLACE",
              visible: false,
              notes: `Remplacé par annee_hijri=${currentHijriYear} — hawl complété le ${new Date().toISOString().split("T")[0]}`,
            })
            .eq("utilisateur_id", userId)
            .eq("annee_hijri", anneeDebutHawl)
            .in("statut", ["EN_COURS_HAWL", "EXEMPTE"]);
        }
      }

      // Chercher enregistrement existant pour l'année courante
      const { data: existing } = await supabase
        .from("zakat_annuel")
        .select(
          "id, annee_hijri, statut, montant_zakat_paye, montant_total_dettes",
        )
        .eq("utilisateur_id", userId)
        .eq("annee_hijri", currentHijriYear)
        .maybeSingle();

      const typeNisabApplique = _buildTypeNisabApplique(formData.nisabBase);
      const nisabAtteint = results.isNisabReached;

      const dettesToSave =
        results.totalDeductions > 0
          ? results.totalDeductions
          : existing
            ? parseFloat(existing.montant_total_dettes) || 0
            : 0;

      const montantImposable = Math.max(0, results.totalAssets - dettesToSave);

      // ✅ RÈGLE MALÉKITE : zakat = min(debut, fin) × 2.5%
      // results.montantPourZakat est calculé par calculateMalikiZakat()
      // Il contient déjà min(montantDebut, netWorth) si hawl complété
      let montantPourZakat = montantImposable;
      if (nisabAtteint) {
        if (results.montantPourZakat > 0) {
          montantPourZakat = results.montantPourZakat;
        } else if (montantDebut > 0 && hawlComplete) {
          montantPourZakat = Math.min(montantDebut, montantImposable);
        } else if (montantDebut > 0 && !hawlComplete) {
          // Estimatif en cours de hawl
          montantPourZakat = Math.min(montantDebut, montantImposable);
        }
      }

      const zakatAmount = nisabAtteint ? montantPourZakat * 0.025 : 0;

      // Statut selon état du hawl
      let statut;
      if (!nisabAtteint || zakatAmount === 0) {
        statut = "EXEMPTE";
      } else if (!hawlComplete) {
        statut = "EN_COURS_HAWL"; // Estimatif — hawl pas encore terminé
      } else {
        statut = "NON_PAYE"; // Hawl complété — zakat réellement due
      }

      const calcFields = {
        montant_total_actifs: results.totalAssets,
        montant_total_dettes: dettesToSave,
        montant_imposable: montantImposable,
        nisab_applique: results.nisabThreshold,
        type_nisab_applique: typeNisabApplique,
        depasse_nisab: nisabAtteint,
        montant_zakat_calcule: zakatAmount,
        date_fin: dateFin,
        notes: `Maliki - Nisab: ${nisabAtteint ? "OUI" : "NON"} - Hawl: ${hawlComplete ? "COMPLET" : "EN_COURS"} - Base: ${montantPourZakat} - ${new Date().toISOString()}`,
      };

      if (existing) {
        // Si PAYE → nouveau cycle → remettre paiements à zéro
        const wasFullyPaid = existing.statut === "PAYE";
        const dejaPaye =
          !nisabAtteint || wasFullyPaid
            ? 0
            : parseFloat(existing.montant_zakat_paye) || 0;
        const montantRestant = nisabAtteint
          ? Math.max(0, zakatAmount - dejaPaye)
          : 0;

        const statutFinal = wasFullyPaid
          ? nisabAtteint && hawlComplete
            ? "NON_PAYE"
            : statut
          : statut;

        const { data, error } = await supabase
          .from("zakat_annuel")
          .update({
            ...calcFields,
            montant_zakat_paye: wasFullyPaid ? 0 : dejaPaye,
            montant_restant: montantRestant,
            statut: statutFinal,
            recalcule_auto: false,
          })
          .eq("id", existing.id)
          .select()
          .single();

        if (error) throw error;
        return { success: true, data, alreadyExists: true, updated: true };
      } else {
        const { data, error } = await supabase
          .from("zakat_annuel")
          .insert({
            utilisateur_id: userId,
            annee_hijri: currentHijriYear,
            date_debut: hawlDateDebut || new Date(),
            date_fin: dateFin,
            ...calcFields,
            montant_zakat_paye: 0,
            montant_restant: zakatAmount,
            statut,
            recalcule_auto: false,
          })
          .select()
          .single();

        if (error) throw error;
        return { success: true, data, alreadyExists: false };
      }
    } catch (error) {
      console.error("Erreur saveZakatAnnuel:", error);
      return { success: false, error: error.message };
    }
  },

  // ─── SAVE COMPLETE CALCULATION ────────────────────────────────────────────
async saveCompleteCalculation(userId, formData, results, metalPrices, prixBetail = null) {
  try {
    const zakatAnnuelResult = await this.saveZakatAnnuel(
      userId,
      results,
      formData,
    );
    if (!zakatAnnuelResult.success) throw new Error(zakatAnnuelResult.error);

    const zakatAnnuelId = zakatAnnuelResult.data?.id;
    if (!zakatAnnuelId)
      throw new Error("zakatAnnuelId introuvable après saveZakatAnnuel");

    const actifsResult = await this.saveZakatActifs(
      userId,
      formData,
      metalPrices,
      zakatAnnuelId,
      prixBetail,
    );
    if (!actifsResult.success) throw new Error(actifsResult.error);

    const dettesResult = await this.saveDettes(userId, formData, zakatAnnuelId);
    if (!dettesResult.success) throw new Error(dettesResult.error);

    // ✅ CORRECTION CRITIQUE : recalculer montant_total_actifs
    // depuis les actifs réellement sauvegardés en BDD
    // pour éviter le décalage entre frontend et BDD
    const { data: actifsRéels } = await supabase
      .from("zakat_actif")
      .select("valeur_totale")
      .eq("zakat_annuel_id", zakatAnnuelId)
      .eq("actif", true);

    const totalActifsReels = (actifsRéels || []).reduce(
      (s, a) => s + (parseFloat(a.valeur_totale) || 0),
      0,
    );
    const dettesReelles = dettesResult.montantDette || 0;
    const montantImposableReel = Math.max(0, totalActifsReels - dettesReelles);

    // Recalculer zakat avec le vrai total actifs
    const { data: hawlData } = await supabase
      .from("hawl_tracking")
      .select("montant_debut, statut")
      .eq("utilisateur_id", userId)
      .in("statut", ["EN_COURS", "COMPLETE"])
      .order("date_debut", { ascending: false })
      .limit(1)
      .maybeSingle();

    const montantDebut = parseFloat(hawlData?.montant_debut || 0);
    const nisabAtteint = results.isNisabReached;
    const montantPourZakatReel =
      nisabAtteint && montantDebut > 0
        ? Math.min(montantDebut, montantImposableReel)
        : montantImposableReel;

    const zakatAmountReel = nisabAtteint ? montantPourZakatReel * 0.025 : 0;

    // Mise à jour avec les vrais montants
    await supabase
      .from("zakat_annuel")
      .update({
        montant_total_actifs: totalActifsReels,
        montant_imposable: montantImposableReel,
        montant_zakat_calcule: zakatAmountReel,
        montant_restant: Math.max(
          0,
          zakatAmountReel -
            (parseFloat(zakatAnnuelResult.data?.montant_zakat_paye) || 0),
        ),
      })
      .eq("id", zakatAnnuelId);

    if (!results.isNisabReached) {
      await hawlService.interruptHawlIfActive(userId, results.netWorth || 0);
    }

    return {
      success: true,
      data: {
        zakatAnnuel: zakatAnnuelResult.data,
        alreadyExists: zakatAnnuelResult.alreadyExists || false,
        updated: zakatAnnuelResult.updated || false,
        zakatAnnuelId,
        isZakatDue: results.isZakatDue,
        zakatAmount: zakatAmountReel,
        montantPourZakat: montantPourZakatReel,
        nisabAtteint: results.isNisabReached,
      },
    };
  } catch (error) {
    console.error("Erreur saveCompleteCalculation:", error);
    return { success: false, error: error.message };
  }
},

  // ─── CHECK EXISTING ───────────────────────────────────────────────────────
  async checkExistingZakatForCurrentYear(userId) {
    try {
      const currentHijriYear = getCurrentHijriYear();
      const { data, error } = await supabase
        .from("zakat_annuel")
        .select("id, annee_hijri, montant_zakat_calcule, statut, created_at")
        .eq("utilisateur_id", userId)
        .eq("annee_hijri", currentHijriYear)
        .maybeSingle();
      if (error) throw error;
      return { success: true, exists: !!data, data };
    } catch (error) {
      return { success: false, exists: false, error: error.message };
    }
  },

  // ─── RECALCULATE ZAKAT ANNUEL (après suppression/édition actif) ──────────
  async recalculateZakatAnnuel(zakatAnnuelId) {
    try {
      const { data: zakatRecord, error: recordError } = await supabase
        .from("zakat_annuel")
        .select(
          "id, utilisateur_id, montant_zakat_paye, annee_hijri, montant_total_dettes, statut",
        )
        .eq("id", zakatAnnuelId)
        .single();

      if (recordError || !zakatRecord)
        throw new Error("Zakat record not found: " + recordError?.message);

      const { data: actifs } = await supabase
        .from("zakat_actif")
        .select("valeur_totale")
        .eq("zakat_annuel_id", zakatAnnuelId)
        .eq("actif", true);

      const totalAssets = (actifs || []).reduce(
        (s, a) => s + (a.valeur_totale || 0),
        0,
      );
      const totalDebts = parseFloat(zakatRecord.montant_total_dettes) || 0;
      const montantImposable = Math.max(0, totalAssets - totalDebts);

      // ✅ Règle min(debut, fin)
      const { data: hawlData } = await supabase
        .from("hawl_tracking")
        .select("montant_debut, statut")
        .eq("utilisateur_id", zakatRecord.utilisateur_id)
        .in("statut", ["EN_COURS", "COMPLETE"])
        .order("date_debut", { ascending: false })
        .limit(1)
        .single();

      const montantDebut = parseFloat(hawlData?.montant_debut || 0);
      const montantPourZakat =
        montantDebut > 0
          ? Math.min(montantDebut, montantImposable)
          : montantImposable;

      const montantZakatCalcule =
        montantPourZakat > 0 ? montantPourZakat * 0.025 : 0;
      const montantZakatPaye = parseFloat(zakatRecord.montant_zakat_paye) || 0;
      const montantRestant = Math.max(
        0,
        montantZakatCalcule - montantZakatPaye,
      );

      const statut =
        montantZakatCalcule <= 0
          ? "EXEMPTE"
          : montantRestant <= 0
            ? "PAYE"
            : zakatRecord.statut === "EN_COURS_HAWL"
              ? "EN_COURS_HAWL"
              : "NON_PAYE";

      await supabase
        .from("zakat_annuel")
        .update({
          montant_total_actifs: totalAssets,
          montant_total_dettes: totalDebts,
          montant_imposable: montantImposable,
          montant_zakat_calcule: montantZakatCalcule,
          montant_restant: montantRestant,
          depasse_nisab: montantZakatCalcule > 0,
          statut,
          recalcule_auto: true,
        })
        .eq("id", zakatAnnuelId);

      return {
        success: true,
        data: {
          montantZakatCalcule,
          montantImposable,
          montantRestant,
          montantPourZakat,
          totalDebts,
          statut,
          zakatAnnuelId,
        },
      };
    } catch (error) {
      console.error("Erreur recalculateZakatAnnuel:", error);
      return { success: false, error: error.message };
    }
  },

  // ─── HISTORY ─────────────────────────────────────────────────────────────
  async getZakatActifsHistory(userId) {
    try {
      const { data, error } = await supabase
        .from("zakat_actif")
        .select("*, type_zakat(nom_type, taux_zakat, unite_mesure)")
        .eq("utilisateur_id", userId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  async getZakatAnnuelHistory(userId) {
    try {
      // ✅ Filtrer les enregistrements REMPLACE (ne pas afficher dans l'historique)
      const { data, error } = await supabase
        .from("zakat_annuel")
        .select("*")
        .eq("utilisateur_id", userId)
        .neq("statut", "REMPLACE")
        .order("annee_hijri", { ascending: false });
      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // ─── PAYMENT ─────────────────────────────────────────────────────────────
  async savePaiement(zakatAnnuelId, beneficiaireId, montant, moyenPaiement) {
    try {
      const { data, error } = await supabase
        .from("paiement_zakat")
        .insert({
          zakat_annuel_id: zakatAnnuelId,
          beneficiaire_id: beneficiaireId,
          montant_paye: montant,
          date_paiement: new Date(),
          moyen_paiement: moyenPaiement,
          valide: true,
        })
        .select();
      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  async checkExistingZakat(userId, year = null) {
    return await checkExistingZakatForYear(userId, year);
  },

  // ─── HELPER : base nisab BDD → clé formulaire ────────────────────────────
  mapNisabAppliqueTOBase: _mapNisabAppliqueTOBase,
};
