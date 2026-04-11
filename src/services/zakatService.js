// services/zakatService.js
import { supabase } from './supabase';
import { getCurrentHijriYear, checkExistingZakatForYear } from '../utils/zakatUtils';

export const zakatService = {
  // FIXED: Save assets WITHOUT affecting past zakat records
  async saveZakatActifs(userId, formData, metalPrices, zakatAnnuelId = null) {
    try {
      // IMPORTANT: First deactivate old assets (soft delete)
      if (zakatAnnuelId) {
      const { error: deactivateError } = await supabase
        .from('zakat_actif')
        .update({ actif: false })
        .eq('zakat_annuel_id', zakatAnnuelId)   // ← ciblé par année
        .eq('actif', true);

      if (deactivateError) throw deactivateError;
    }
      
      const actifs = [];

      // Convertir les données du formulaire en actifs
      // Argent liquide
      if (parseFloat(formData.cash) > 0) {
        actifs.push({
          utilisateur_id: userId,
          zakat_annuel_id: zakatAnnuelId,
          type_zakat_id: 3,
          nom_actif: 'Argent liquide',
          quantite: parseFloat(formData.cash),
          valeur_unitaire: 1,
          valeur_totale: parseFloat(formData.cash),
          actif: true,
        });
      }

      // Comptes épargne
      if (parseFloat(formData.savings) > 0) {
        actifs.push({
          utilisateur_id: userId,
          zakat_annuel_id: zakatAnnuelId,
          type_zakat_id: 3,
          nom_actif: 'Comptes épargne',
          quantite: parseFloat(formData.savings),
          valeur_unitaire: 1,
          valeur_totale: parseFloat(formData.savings),
          actif: true,
        });
      }

      // Comptes courants
      if (parseFloat(formData.currentAccounts) > 0) {
        actifs.push({
          utilisateur_id: userId,
          zakat_annuel_id: zakatAnnuelId,
          type_zakat_id: 3,
          nom_actif: 'Comptes courants',
          quantite: parseFloat(formData.currentAccounts),
          valeur_unitaire: 1,
          valeur_totale: parseFloat(formData.currentAccounts),
          actif: true,
        });
      }

      // Dépôts à terme
      if (parseFloat(formData.fixedDeposits) > 0) {
        actifs.push({
          utilisateur_id: userId,
          zakat_annuel_id: zakatAnnuelId,
          type_zakat_id: 3,
          nom_actif: 'Dépôts à terme',
          quantite: parseFloat(formData.fixedDeposits),
          valeur_unitaire: 1,
          valeur_totale: parseFloat(formData.fixedDeposits),
          actif: true,
        });
      }

      // Or
      if (parseFloat(formData.goldWeight) > 0) {
        const goldPrice = formData.goldPurity === "24k" ? metalPrices.gold24k :
                         formData.goldPurity === "21k" ? metalPrices.gold21k :
                         metalPrices.gold18k;
        
        actifs.push({
          utilisateur_id: userId,
          zakat_annuel_id: zakatAnnuelId,
          type_zakat_id: 1,
          nom_actif: `Or ${formData.goldPurity}`,
          quantite: parseFloat(formData.goldWeight),
          valeur_unitaire: goldPrice,
          valeur_totale: parseFloat(formData.goldWeight) * goldPrice,
          actif: true,
        });
      }

      // Argent
      if (parseFloat(formData.silverWeight) > 0) {
        const silverPrice = formData.silverPurity === "999" ? 
                           metalPrices.silver999 : 
                           metalPrices.silver925;
        
        actifs.push({
          utilisateur_id: userId,
          zakat_annuel_id: zakatAnnuelId,
          type_zakat_id: 2,
          nom_actif: `Argent ${formData.silverPurity}`,
          quantite: parseFloat(formData.silverWeight),
          valeur_unitaire: silverPrice,
          valeur_totale: parseFloat(formData.silverWeight) * silverPrice,
          actif: true,
        });
      }

      // Biens commerciaux
      if (parseFloat(formData.tradeGoodsValue) > 0) {
        actifs.push({
          utilisateur_id: userId,
          zakat_annuel_id: zakatAnnuelId,
          type_zakat_id: 4,
          nom_actif: 'Biens commerciaux',
          quantite: parseFloat(formData.tradeGoodsValue),
          valeur_unitaire: 1,
          valeur_totale: parseFloat(formData.tradeGoodsValue),
          actif: true,
        });
      }

      // Inventaire commercial
      if (parseFloat(formData.businessInventory) > 0) {
        actifs.push({
          utilisateur_id: userId,
          zakat_annuel_id: zakatAnnuelId,
          type_zakat_id: 4,
          nom_actif: 'Inventaire commercial',
          quantite: parseFloat(formData.businessInventory),
          valeur_unitaire: 1,
          valeur_totale: parseFloat(formData.businessInventory),
          actif: true,
        });
      }

      // Propriétés locatives
      if (parseFloat(formData.rentalProperties) > 0) {
        actifs.push({
          utilisateur_id: userId,
          zakat_annuel_id: zakatAnnuelId,
          type_zakat_id: 4,
          nom_actif: 'Propriétés locatives',
          quantite: parseFloat(formData.rentalProperties),
          valeur_unitaire: 1,
          valeur_totale: parseFloat(formData.rentalProperties),
          actif: true,
        });
      }

      // Véhicules
      if (parseFloat(formData.vehiclesValue) > 0) {
        actifs.push({
          utilisateur_id: userId,
          zakat_annuel_id: zakatAnnuelId,
          type_zakat_id: 4,
          nom_actif: 'Véhicules',
          quantite: parseFloat(formData.vehiclesValue),
          valeur_unitaire: 1,
          valeur_totale: parseFloat(formData.vehiclesValue),
          actif: true,
        });
      }

      // Agriculture
      if (parseFloat(formData.cropsWeight) > 0) {
        const cropsValue = parseFloat(formData.cropsMarketValue) || 
                          parseFloat(formData.cropsWeight) * 0.5;
        
        actifs.push({
          utilisateur_id: userId,
          zakat_annuel_id: zakatAnnuelId,
          type_zakat_id: 5,
          nom_actif: `Récoltes (${formData.irrigationType === 'rain' ? 'Pluie' : 'Irrigation'})`,
          quantite: parseFloat(formData.cropsWeight),
          valeur_unitaire: cropsValue / parseFloat(formData.cropsWeight),
          valeur_totale: cropsValue,
          actif: true,
        });
      }

      // Bétail
      if (parseFloat(formData.camelsCount) > 0) {
        actifs.push({
          utilisateur_id: userId,
          zakat_annuel_id: zakatAnnuelId,
          type_zakat_id: 6,
          nom_actif: 'Chameaux',
          quantite: parseFloat(formData.camelsCount),
          valeur_unitaire: 2500,
          valeur_totale: parseFloat(formData.camelsCount) * 2500,
          actif: true,
        });
      }

      if (parseFloat(formData.cowsCount) > 0) {
        actifs.push({
          utilisateur_id: userId,
          zakat_annuel_id: zakatAnnuelId,
          type_zakat_id: 6,
          nom_actif: 'Vaches',
          quantite: parseFloat(formData.cowsCount),
          valeur_unitaire: 1200,
          valeur_totale: parseFloat(formData.cowsCount) * 1200,
          actif: true,
        });
      }

      if (parseFloat(formData.goatsCount) > 0) {
        actifs.push({
          utilisateur_id: userId,
          zakat_annuel_id: zakatAnnuelId,
          type_zakat_id: 6,
          nom_actif: 'Chèvres',
          quantite: parseFloat(formData.goatsCount),
          valeur_unitaire: 150,
          valeur_totale: parseFloat(formData.goatsCount) * 150,
          actif: true,
        });
      }

      if (parseFloat(formData.sheepCount) > 0) {
        actifs.push({
          utilisateur_id: userId,
          zakat_annuel_id: zakatAnnuelId,
          type_zakat_id: 6,
          nom_actif: 'Moutons',
          quantite: parseFloat(formData.sheepCount),
          valeur_unitaire: 120,
          valeur_totale: parseFloat(formData.sheepCount) * 120,
          actif: true,
        });
      }

      // Créances
      if (parseFloat(formData.receivables) > 0) {
        actifs.push({
          utilisateur_id: userId,
          zakat_annuel_id: zakatAnnuelId,
          type_zakat_id: 7,
          nom_actif: 'Créances certaines',
          quantite: parseFloat(formData.receivables),
          valeur_unitaire: 1,
          valeur_totale: parseFloat(formData.receivables),
          actif: true,
        });
      }

      if (parseFloat(formData.doubtfulReceivables) > 0 && formData.includeAllReceivables) {
        actifs.push({
          utilisateur_id: userId,
          zakat_annuel_id: zakatAnnuelId,
          type_zakat_id: 7,
          nom_actif: 'Créances douteuses',
          quantite: parseFloat(formData.doubtfulReceivables),
          valeur_unitaire: 1,
          valeur_totale: parseFloat(formData.doubtfulReceivables),
          actif: true,
        });
      }

      // Insérer tous les actifs
      if (actifs.length > 0) {
        const { data, error } = await supabase
          .from('zakat_actif')
          .insert(actifs)
          .select();

        if (error) throw error;
        return { success: true, data };
      }

      return { success: true, data: [] };
    } catch (error) {
      console.error('Erreur saveZakatActifs:', error);
      return { success: false, error: error.message };
    }
  },

  // 2. SAUVEGARDER LES DETTES
  async saveDettes(userId, formData) {
    try {
      // Désactiver les anciennes dettes non remboursées
      const { error: deactivateError } = await supabase
        .from('dettes')
        .update({ rembourse: true })
        .eq('utilisateur_id', userId)
        .eq('rembourse', false);
      
      if (deactivateError) throw deactivateError;
      
      if (parseFloat(formData.debts) > 0) {
        const { data, error } = await supabase
          .from('dettes')
          .insert({
            utilisateur_id: userId,
            montant_dette: parseFloat(formData.debts),
            type_dette: 'DETTE_GENERALE',
            deductible: true,
            rembourse: false,
          })
          .select();

        if (error) throw error;
        return { success: true, data };
      }
      return { success: true, data: null };
    } catch (error) {
      console.error('Erreur saveDettes:', error);
      return { success: false, error: error.message };
    }
  },

  // FIXED: Save zakat annuel with proper year check
async saveZakatAnnuel(userId, results, formData) {
  try {
    const currentHijriYear = getCurrentHijriYear();

    const { data: existing } = await supabase
      .from('zakat_annuel')
      .select('id, annee_hijri, statut, montant_zakat_paye')
      .eq('utilisateur_id', userId)
      .eq('annee_hijri', currentHijriYear)
      .maybeSingle();

    // ✅ Données communes pour insert ET update
    const zakatData = {
      montant_total_actifs:   results.totalAssets,
      montant_total_dettes:   results.totalDeductions,
      montant_imposable:      results.netWorth,
      nisab_applique:         results.nisabThreshold,
      type_nisab_applique:    formData.nisabBase.toUpperCase(),
      depasse_nisab:          results.isNisabReached,          // ✅ toujours mis à jour
      montant_zakat_calcule:  results.zakatAmount,             // ✅ toujours mis à jour
      notes: `Calcul Maliki - Hawl: ${results.hawlCompleted ? 'Complété' : 'Non complété'} - ${new Date().toISOString()}`,
    };

    if (existing) {
      // ✅ UPDATE : recalculer montant_restant en tenant compte de ce déjà payé
      const dejaPaye = parseFloat(existing.montant_zakat_paye) || 0;
      const montantRestant = Math.max(0, results.zakatAmount - dejaPaye);
      
      let statut;
      if (!results.isNisabReached || results.zakatAmount === 0) {
        statut = 'EXEMPTE';
      } else if (montantRestant <= 0) {
        statut = 'PAYE';
      } else {
        statut = 'NON_PAYE';
      }

      const { data, error } = await supabase
        .from('zakat_annuel')
        .update({
          ...zakatData,
          montant_restant: montantRestant,
          statut,
          recalcule_auto: false,
        })
        .eq('id', existing.id)
        .select()
        .single();

      if (error) throw error;
      return { success: true, data, alreadyExists: true, updated: true };

    } else {
      // INSERT première fois
      const { data, error } = await supabase
        .from('zakat_annuel')
        .insert({
          utilisateur_id: userId,
          annee_hijri: currentHijriYear,
          date_debut: new Date(),
          date_fin: new Date(new Date().setFullYear(new Date().getFullYear() + 1)),
          ...zakatData,
          montant_zakat_paye: 0,
          montant_restant: results.zakatAmount,
          statut: results.isZakatDue ? 'NON_PAYE' : 'EXEMPTE',
          recalcule_auto: false,
        })
        .select()
        .single();

      if (error) throw error;
      return { success: true, data, alreadyExists: false };
    }
  } catch (error) {
    console.error('Erreur saveZakatAnnuel:', error);
    return { success: false, error: error.message };
  }
},

  // 4. RÉCUPÉRER L'HISTORIQUE DES ACTIFS
  async getZakatActifsHistory(userId) {
    try {
      const { data, error } = await supabase
        .from('zakat_actif')
        .select(`
          *,
          type_zakat (
            nom_type,
            taux_zakat,
            unite_mesure
          )
        `)
        .eq('utilisateur_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Erreur getZakatActifsHistory:', error);
      return { success: false, error: error.message };
    }
  },

  // 5. RÉCUPÉRER L'HISTORIQUE DES CALCULS ANNUELS
  async getZakatAnnuelHistory(userId) {
    try {
      const { data, error } = await supabase
        .from('zakat_annuel')
        .select('*')
        .eq('utilisateur_id', userId)
        .order('annee_hijri', { ascending: false });

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Erreur getZakatAnnuelHistory:', error);
      return { success: false, error: error.message };
    }
  },

  // 6. ENREGISTRER UN PAIEMENT
  async savePaiement(zakatAnnuelId, beneficiaireId, montant, moyenPaiement) {
    try {
      const { data, error } = await supabase
        .from('paiement_zakat')
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
      console.error('Erreur savePaiement:', error);
      return { success: false, error: error.message };
    }
  },

  // FIXED: SAUVEGARDER TOUT LE CALCUL (GLOBAL) - ORDRE CORRECT
  async saveCompleteCalculation(userId, formData, results, metalPrices) {
    try {
      // ✅ 1. CRÉER LA ZAKAT D'ABORD (on a besoin de son ID)
      const zakatAnnuelResult = await this.saveZakatAnnuel(userId, results, formData);
      if (!zakatAnnuelResult.success && !zakatAnnuelResult.alreadyExists) {
        throw new Error(zakatAnnuelResult.error);
      }

      const zakatAnnuelId = zakatAnnuelResult.data?.id;

      // ✅ 2. SAUVEGARDER LES ACTIFS (avec l'ID de la zakat)
      const actifsResult = await this.saveZakatActifs(userId, formData, metalPrices, zakatAnnuelId);
      if (!actifsResult.success) throw new Error(actifsResult.error);

      // ✅ 3. SAUVEGARDER LES DETTES
      const dettesResult = await this.saveDettes(userId, formData);
      if (!dettesResult.success) throw new Error(dettesResult.error);

      return { 
        success: true, 
        data: {
          actifs: actifsResult.data,
          dettes: dettesResult.data,
          zakatAnnuel: zakatAnnuelResult.data,
          alreadyExists: zakatAnnuelResult.alreadyExists || false
        }
      };
    } catch (error) {
      console.error('Erreur saveCompleteCalculation:', error);
      return { success: false, error: error.message };
    }
  },

  // FIXED: Check if zakat exists for current year
  async checkExistingZakat(userId, year = null) {
    return await checkExistingZakatForYear(userId, year);
  },

  // ✅ NEW: Recalculate zakat_annuel when assets are modified
  async recalculateZakatAnnuel(zakatAnnuelId) {
    try {
      console.log("[recalculateZakatAnnuel] Starting for ID:", zakatAnnuelId);
      
      // 0. First, get zakat record to verify it exists and get user info
      const { data: zakatRecord, error: recordError } = await supabase
        .from("zakat_annuel")
        .select("id, utilisateur_id, montant_zakat_paye, annee_hijri")
        .eq("id", zakatAnnuelId)
        .single();

      if (recordError || !zakatRecord) {
        throw new Error("Zakat record not found: " + recordError?.message);
      }
      
      console.log("[recalculateZakatAnnuel] Found zakat record:", zakatRecord);
      
      // 1. Get all assets for this year
      const { data: actifs, error: actifsError } = await supabase
        .from("zakat_actif")
        .select("id, nom_actif, valeur_totale")
        .eq("zakat_annuel_id", zakatAnnuelId)
        .eq("actif", true);

      if (actifsError) throw actifsError;

      const totalAssets = (actifs || []).reduce((sum, a) => sum + (a.valeur_totale || 0), 0);
      console.log("[recalculateZakatAnnuel] Assets found:", actifs?.length, "Total:", totalAssets);

      // 2. Get debts for this user
      const { data: dettes, error: dettesError } = await supabase
        .from("dettes")
        .select("montant_dette")
        .eq("utilisateur_id", zakatRecord.utilisateur_id)
        .eq("deductible", true)
        .eq("rembourse", false);

      if (dettesError) throw dettesError;

      const totalDebts = (dettes || []).reduce((sum, d) => sum + (d.montant_dette || 0), 0);
      console.log("[recalculateZakatAnnuel] Debts found:", dettes?.length, "Total:", totalDebts);

      // 3. Calculate net worth and zakat
      const montantImposable = totalAssets - totalDebts;
      const montantZakatCalcule = montantImposable > 0 ? montantImposable * 0.025 : 0;
      console.log("[recalculateZakatAnnuel] Calculation:", { montantImposable, montantZakatCalcule });
      
      // 4. Calculate remaining amount and status
      const montantZakatPaye = parseFloat(zakatRecord.montant_zakat_paye) || 0;
      const montantRestant = Math.max(0, montantZakatCalcule - montantZakatPaye);
      console.log("[recalculateZakatAnnuel] Payment info:", { montantZakatPaye, montantRestant });
      
      // Determine status based on new calculation
      let statut = "EXEMPTE";
      let zakatDue = false;
      
      if (montantZakatCalcule > 0) {
        zakatDue = true;
        statut = montantRestant <= 0 ? "PAYE" : "NON_PAYE";
      }
      console.log("[recalculateZakatAnnuel] Status:", statut, "Zakat due:", zakatDue);

      // 5. Update zakat_annuel with new values
      console.log("[recalculateZakatAnnuel] Updating record...");
      
      const { error: updateError, data: updatedData } = await supabase
        .from("zakat_annuel")
        .update({
          montant_total_actifs: totalAssets,
          montant_total_dettes: totalDebts,
          montant_imposable: montantImposable,
          montant_zakat_calcule: montantZakatCalcule,
          montant_restant: montantRestant,
          depasse_nisab: zakatDue,
          statut: statut,
          recalcule_auto: true,
        })
        .eq("id", zakatAnnuelId)
        .select();

      if (updateError) {
        console.error("[recalculateZakatAnnuel] Update error:", updateError);
        throw updateError;
      }

      console.log("✅ [recalculateZakatAnnuel] SUCCESS! Updated record:", updatedData);
      console.log("✅ Zakat recalculée avec succès:", {
        montantZakatCalcule,
        montantImposable,
        montantRestant,
        statut,
        totalAssets,
        totalDebts,
      });

      return { 
        success: true, 
        data: { 
          montantZakatCalcule, 
          montantImposable, 
          montantRestant,
          statut,
          zakatDue,
          zakatAnnuelId,
        } 
      };
    } catch (error) {
      console.error("Erreur recalculateZakatAnnuel:", error);
      return { success: false, error: error.message };
    }
  }
};