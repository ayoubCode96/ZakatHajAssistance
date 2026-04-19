// services/zakatService.js
import { supabase } from './supabase';
import { getCurrentHijriYear, checkExistingZakatForYear } from '../utils/zakatUtils';

// ─── MAPPING FUNCTION: Translate asset names (French) → translation keys ───
export const getAssetTranslationKey = (frenchAssetName) => {
  if (!frenchAssetName) return 'asset_cash';
  
  const mappings = {
    'Argent liquide': 'asset_cash',
    'Épargne': 'asset_savings',
    'Compte courant': 'asset_current_account',
    'Dépôt fixe': 'asset_fixed_deposit',
    'Or 24k': 'asset_gold_24k',
    'Or 21k': 'asset_gold_21k',
    'Or 20k': 'asset_gold_20k',
    'Or 18k': 'asset_gold_18k',
    'Argent métal': 'asset_silver_metal',
    'Biens commerciaux': 'asset_commercial_goods',
    'Inventaire': 'asset_inventory',
    'Immobilier locatif': 'asset_rental_property',
    'Véhicules': 'asset_vehicles',
    'Récoltes': 'asset_crops',
    'Chameaux': 'asset_camels',
    'Vaches': 'asset_cows',
    'Chèvres': 'asset_goats',
    'Moutons': 'asset_sheep',
    'Créances': 'asset_receivables',
    'Créances douteuses': 'asset_doubtful_receivables',
  };
  
  // Special cases: Récoltes with modifiers
  if (frenchAssetName?.includes('Récoltes')) {
    if (frenchAssetName.includes('Pluie')) return 'asset_crops_rain';
    if (frenchAssetName.includes('Risque')) return 'asset_crops_cost';
    return 'asset_crops';
  }
  
  // Special cases: Argent métal with purity
  if (frenchAssetName?.startsWith('Argent métal')) {
    return 'asset_silver_metal';
  }
  
  // Check direct mapping
  if (mappings[frenchAssetName]) return mappings[frenchAssetName];
  
  return 'asset_cash'; // Default fallback
};

// ─── MAPPING FUNCTION: Translate zakat type names (French) → translation keys ───
export const getZakatTypeTranslationKey = (frenchTypeName) => {
  if (!frenchTypeName) return 'type_cash';
  
  const mappings = {
    'OR': 'type_or',
    'ARGENT': 'type_argent',
    'EPARGNE': 'type_epargne',
    'COMMERCE': 'type_commerce',
    'AGRICULTURE': 'type_agriculture',
    'BETAIL': 'type_betail',
    'CREANCES': 'type_creances',
    'CASH': 'type_cash',
    'LIQUIDE': 'type_cash',
  };
  
  // Normalize and check mapping
  const normalized = frenchTypeName.trim().toUpperCase();
  if (mappings[normalized]) return mappings[normalized];
  
  return 'type_cash'; // Default fallback
};

export const zakatService = {

  // ─── LOAD EXISTING ACTIFS FOR CURRENT YEAR → for pre-filling the form ───
  async loadExistingActifsForYear(userId, hijriYear = null) {
    try {
      const year = hijriYear || getCurrentHijriYear();

      const { data: zakatAnnuel } = await supabase
        .from('zakat_annuel')
        .select('id')
        .eq('utilisateur_id', userId)
        .eq('annee_hijri', year)
        .maybeSingle();

      if (!zakatAnnuel) return { success: true, data: null };

      const { data: actifs, error } = await supabase
        .from('zakat_actif')
        .select('*, type_zakat(nom_type, taux_zakat, unite_mesure)')
        .eq('zakat_annuel_id', zakatAnnuel.id)
        .eq('actif', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return { success: true, data: actifs || [], zakatAnnuelId: zakatAnnuel.id };
    } catch (error) {
      console.error('Erreur loadExistingActifsForYear:', error);
      return { success: false, error: error.message };
    }
  },

  // ─── CONVERT DB ACTIFS → formData fields (for pre-filling) ──────────────
  // CRITICAL: nom_actif here MUST match exactly what _buildActifsFromFormData writes
  actifsToFormData(actifs) {
    const fd = {};

    // Helper: find actif by exact nom_actif, return its valeur_totale as string
    const getVal = (nomActif) => {
      const a = actifs.find(x => x.nom_actif === nomActif && x.actif !== false);
      return a ? (a.valeur_totale?.toString() || '') : '';
    };

    // Helper: find actif by exact nom_actif, return its quantite as string
    const getQty = (nomActif) => {
      const a = actifs.find(x => x.nom_actif === nomActif && x.actif !== false);
      return a ? (a.quantite?.toString() || '') : '';
    };

    // ── Money (type 3) ── names match _buildActifsFromFormData exactly
    fd.cash            = getVal('Argent liquide');
    fd.savings         = getVal('Épargne');
    fd.currentAccounts = getVal('Compte courant');
    fd.fixedDeposits   = getVal('Dépôt fixe');

    // ── Gold (type 1) ── name is "Or 24k" / "Or 21k" / "Or 20k" / "Or 18k"
    const orActif = actifs.find(x =>
      x.nom_actif?.startsWith('Or ') && x.actif !== false
    );
    if (orActif) {
      fd.goldWeight = orActif.quantite?.toString() || '';
      // Extract purity: "Or 24k" → "24k"
      fd.goldPurity = orActif.nom_actif.replace('Or ', '').trim() || '24k';
    } else {
      fd.goldWeight = '';
      fd.goldPurity = '24k';
    }

    // ── Silver (type 2) ── name is "Argent métal 999" or "Argent métal 925"
    const argentActif = actifs.find(x =>
      x.nom_actif?.startsWith('Argent métal') && x.actif !== false
    );
    if (argentActif) {
      fd.silverWeight = argentActif.quantite?.toString() || '';
      // Extract purity: "Argent métal 925" → "925"
      fd.silverPurity = argentActif.nom_actif.replace('Argent métal ', '').trim() || '925';
    } else {
      fd.silverWeight = '';
      fd.silverPurity = '925';
    }

    // ── Trade (type 4) ──
    fd.tradeGoodsValue   = getVal('Biens commerciaux');
    fd.businessInventory = getVal('Inventaire');
    fd.rentalProperties  = getVal('Immobilier locatif');
    fd.vehiclesValue     = getVal('Véhicules');

    // ── Agriculture (type 5) ──
    const recoltesActif = actifs.find(x =>
      x.nom_actif?.startsWith('Récoltes') && x.actif !== false
    );
    if (recoltesActif) {
      fd.cropsWeight      = recoltesActif.quantite?.toString() || '';
      fd.cropsMarketValue = recoltesActif.valeur_totale?.toString() || '';
      fd.irrigationType   = recoltesActif.nom_actif?.includes('Pluie') ? 'rain' : 'cost';
    } else {
      fd.cropsWeight      = '';
      fd.cropsMarketValue = '';
      fd.irrigationType   = 'rain';
    }

    // ── Livestock (type 6) ──
    fd.camelsCount = getQty('Chameaux');
    fd.cowsCount   = getQty('Vaches');
    fd.goatsCount  = getQty('Chèvres');
    fd.sheepCount  = getQty('Moutons');

    // ── Receivables (type 7) ──
    fd.receivables          = getVal('Créances');
    fd.doubtfulReceivables  = getVal('Créances douteuses');
    fd.includeAllReceivables = actifs.some(x => x.nom_actif === 'Créances douteuses' && x.actif !== false);

    return fd;
  },

  // ─── SAVE ASSETS (upsert per nom_actif for this year) ───────────────────
  async saveZakatActifs(userId, formData, metalPrices, zakatAnnuelId = null) {
    try {
      const actifs = this._buildActifsFromFormData(userId, formData, metalPrices, zakatAnnuelId);

      for (const actif of actifs) {
        if (zakatAnnuelId) {
          // Soft-delete previous entry with same nom_actif for this year
          await supabase
            .from('zakat_actif')
            .update({ actif: false })
            .eq('zakat_annuel_id', zakatAnnuelId)
            .eq('nom_actif', actif.nom_actif);
        }
        // Insert fresh entry
        await supabase.from('zakat_actif').insert(actif);
      }

      return { success: true };
    } catch (error) {
      console.error('Erreur saveZakatActifs:', error);
      return { success: false, error: error.message };
    }
  },

  // ─── BUILD ACTIFS LIST FROM FORM DATA ───────────────────────────────────
  // CRITICAL: nom_actif here MUST match exactly what actifsToFormData reads
  _buildActifsFromFormData(userId, formData, metalPrices, zakatAnnuelId) {
    const actifs = [];
    const push = (nom, typeId, quantite, valeur) => {
      if (valeur > 0) actifs.push({
        utilisateur_id:  userId,
        zakat_annuel_id: zakatAnnuelId,
        type_zakat_id:   typeId,
        nom_actif:       nom,
        quantite,
        valeur_unitaire: quantite > 0 ? valeur / quantite : valeur,
        valeur_totale:   valeur,
        actif:           true,
      });
    };
    const p = (v) => Math.max(0, parseFloat(v || 0));

    // ── Money (type 3) ──
    push('Argent liquide',  3, p(formData.cash),            p(formData.cash));
    push('Épargne',         3, p(formData.savings),         p(formData.savings));
    push('Compte courant',  3, p(formData.currentAccounts), p(formData.currentAccounts));
    push('Dépôt fixe',      3, p(formData.fixedDeposits),   p(formData.fixedDeposits));

    // ── Gold (type 1) ── → "Or 24k", "Or 21k", "Or 20k", "Or 18k"
    const goldWeight = p(formData.goldWeight);
    if (goldWeight > 0) {
      const goldPrice =
        formData.goldPurity === '24k' ? (metalPrices.gold24k || metalPrices.gold || 650) :
        formData.goldPurity === '21k' ? (metalPrices.gold21k || (metalPrices.gold || 650) * 0.875) :
        formData.goldPurity === '20k' ? (metalPrices.gold20k || (metalPrices.gold || 650) * (20/24)) :
        (metalPrices.gold18k || (metalPrices.gold || 650) * 0.75);
      push(`Or ${formData.goldPurity}`, 1, goldWeight, goldWeight * goldPrice);
    }

    // ── Silver (type 2) ── → "Argent métal 999" or "Argent métal 925"
    const silverWeight = p(formData.silverWeight);
    if (silverWeight > 0) {
      const silverPrice = formData.silverPurity === '999'
        ? (metalPrices.silver999 || metalPrices.silver || 8.5)
        : (metalPrices.silver925 || (metalPrices.silver || 8.5) * 0.925);
      push(`Argent métal ${formData.silverPurity || '925'}`, 2, silverWeight, silverWeight * silverPrice);
    }

    // ── Trade (type 4) ──
    push('Biens commerciaux',  4, 1, p(formData.tradeGoodsValue));
    push('Inventaire',         4, 1, p(formData.businessInventory));
    push('Immobilier locatif', 4, 1, p(formData.rentalProperties));
    push('Véhicules',          4, 1, p(formData.vehiclesValue));

    // ── Agriculture (type 5) ──
    const cropsWeight = p(formData.cropsWeight);
    if (cropsWeight > 0) {
      const cropsValue = p(formData.cropsMarketValue) || cropsWeight * 0.5;
      push(
        `Récoltes (${formData.irrigationType === 'rain' ? 'Pluie' : 'Irrigation'})`,
        5, cropsWeight, cropsValue
      );
    }

    // ── Livestock (type 6) ──
    const camelCount = p(formData.camelsCount);
    const cowCount   = p(formData.cowsCount);
    const goatCount  = p(formData.goatsCount);
    const sheepCount = p(formData.sheepCount);
    if (camelCount > 0) push('Chameaux', 6, camelCount, camelCount * 2500);
    if (cowCount   > 0) push('Vaches',   6, cowCount,   cowCount   * 1200);
    if (goatCount  > 0) push('Chèvres',  6, goatCount,  goatCount  * 150);
    if (sheepCount > 0) push('Moutons',  6, sheepCount, sheepCount * 120);

    // ── Receivables (type 7) ──
    const receivables = p(formData.receivables);
    if (receivables > 0) push('Créances', 7, 1, receivables);
    if (formData.includeAllReceivables) {
      const doubtful = p(formData.doubtfulReceivables);
      if (doubtful > 0) push('Créances douteuses', 7, 1, doubtful);
    }

    return actifs;
  },

  // ─── SAVE DEBTS ──────────────────────────────────────────────────────────
  async saveDettes(userId, formData) {
    try {
      await supabase
        .from('dettes')
        .update({ rembourse: true })
        .eq('utilisateur_id', userId)
        .eq('rembourse', false);

      if (parseFloat(formData.debts) > 0) {
        const { data, error } = await supabase
          .from('dettes')
          .insert({
            utilisateur_id: userId,
            montant_dette:  parseFloat(formData.debts),
            type_dette:     'DETTE_GENERALE',
            deductible:     true,
            rembourse:      false,
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

  // ─── SAVE / UPDATE ZAKAT ANNUEL ──────────────────────────────────────────
  async saveZakatAnnuel(userId, results, formData) {
    try {
      const currentHijriYear = getCurrentHijriYear();

      const { data: existing } = await supabase
        .from('zakat_annuel')
        .select('id, annee_hijri, statut, montant_zakat_paye')
        .eq('utilisateur_id', userId)
        .eq('annee_hijri', currentHijriYear)
        .maybeSingle();

      const calcFields = {
        montant_total_actifs:  results.totalAssets,
        montant_total_dettes:  results.totalDeductions,
        montant_imposable:     results.netWorth,
        nisab_applique:        results.nisabThreshold,
        type_nisab_applique:   (formData.nisabBase || 'silver').toUpperCase(),
        depasse_nisab:         results.isNisabReached,
        montant_zakat_calcule: results.zakatAmount,
        notes: `Calcul Maliki - Hawl: ${results.hawlCompleted ? 'Complété' : 'Non complété'} - ${new Date().toISOString()}`,
      };

      if (existing) {
        const dejaPaye      = parseFloat(existing.montant_zakat_paye) || 0;
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
            ...calcFields,
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
        const { data, error } = await supabase
          .from('zakat_annuel')
          .insert({
            utilisateur_id: userId,
            annee_hijri:    currentHijriYear,
            date_debut:     new Date(),
            date_fin:       new Date(new Date().setFullYear(new Date().getFullYear() + 1)),
            ...calcFields,
            montant_zakat_paye: 0,
            montant_restant:    results.zakatAmount,
            statut:             results.isZakatDue ? 'NON_PAYE' : 'EXEMPTE',
            recalcule_auto:     false,
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

  // ─── SAVE COMPLETE CALCULATION ───────────────────────────────────────────
  async saveCompleteCalculation(userId, formData, results, metalPrices) {
    try {
      const zakatAnnuelResult = await this.saveZakatAnnuel(userId, results, formData);
      if (!zakatAnnuelResult.success) throw new Error(zakatAnnuelResult.error);

      const zakatAnnuelId = zakatAnnuelResult.data?.id;

      const actifsResult = await this.saveZakatActifs(userId, formData, metalPrices, zakatAnnuelId);
      if (!actifsResult.success) throw new Error(actifsResult.error);

      const dettesResult = await this.saveDettes(userId, formData);
      if (!dettesResult.success) throw new Error(dettesResult.error);

      return {
        success: true,
        data: {
          zakatAnnuel:   zakatAnnuelResult.data,
          alreadyExists: zakatAnnuelResult.alreadyExists || false,
          updated:       zakatAnnuelResult.updated || false,
          zakatAnnuelId,
        },
      };
    } catch (error) {
      console.error('Erreur saveCompleteCalculation:', error);
      return { success: false, error: error.message };
    }
  },

  // ─── CHECK EXISTING ZAKAT FOR CURRENT YEAR ───────────────────────────────
  async checkExistingZakatForCurrentYear(userId) {
    try {
      const currentHijriYear = getCurrentHijriYear();
      const { data, error } = await supabase
        .from('zakat_annuel')
        .select('id, annee_hijri, montant_zakat_calcule, statut, created_at')
        .eq('utilisateur_id', userId)
        .eq('annee_hijri', currentHijriYear)
        .maybeSingle();

      if (error) throw error;
      return { success: true, exists: !!data, data };
    } catch (error) {
      return { success: false, exists: false, error: error.message };
    }
  },

  // ─── HISTORY ─────────────────────────────────────────────────────────────
  async getZakatActifsHistory(userId) {
    try {
      const { data, error } = await supabase
        .from('zakat_actif')
        .select(`*, type_zakat(nom_type, taux_zakat, unite_mesure)`)
        .eq('utilisateur_id', userId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

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
      return { success: false, error: error.message };
    }
  },

  // ─── PAYMENT ─────────────────────────────────────────────────────────────
  async savePaiement(zakatAnnuelId, beneficiaireId, montant, moyenPaiement) {
    try {
      const { data, error } = await supabase
        .from('paiement_zakat')
        .insert({
          zakat_annuel_id: zakatAnnuelId,
          beneficiaire_id: beneficiaireId,
          montant_paye:    montant,
          date_paiement:   new Date(),
          moyen_paiement:  moyenPaiement,
          valide:          true,
        })
        .select();
      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // ─── CHECK EXISTING ───────────────────────────────────────────────────────
  async checkExistingZakat(userId, year = null) {
    return await checkExistingZakatForYear(userId, year);
  },

  // ─── RECALCULATE ZAKAT ANNUEL (used after edit/delete of an actif) ───────
  async recalculateZakatAnnuel(zakatAnnuelId) {
    try {
      const { data: zakatRecord, error: recordError } = await supabase
        .from('zakat_annuel')
        .select('id, utilisateur_id, montant_zakat_paye, annee_hijri')
        .eq('id', zakatAnnuelId)
        .single();

      if (recordError || !zakatRecord) throw new Error('Zakat record not found: ' + recordError?.message);

      const { data: actifs } = await supabase
        .from('zakat_actif')
        .select('valeur_totale')
        .eq('zakat_annuel_id', zakatAnnuelId)
        .eq('actif', true);

      const { data: dettes } = await supabase
        .from('dettes')
        .select('montant_dette')
        .eq('utilisateur_id', zakatRecord.utilisateur_id)
        .eq('deductible', true)
        .eq('rembourse', false);

      const totalAssets      = (actifs || []).reduce((s, a) => s + (a.valeur_totale || 0), 0);
      const totalDebts       = (dettes || []).reduce((s, d) => s + (d.montant_dette || 0), 0);
      const montantImposable    = totalAssets - totalDebts;
      const montantZakatCalcule = montantImposable > 0 ? montantImposable * 0.025 : 0;

      const montantZakatPaye = parseFloat(zakatRecord.montant_zakat_paye) || 0;
      const montantRestant   = Math.max(0, montantZakatCalcule - montantZakatPaye);

      let statut = 'EXEMPTE';
      if (montantZakatCalcule > 0) {
        statut = montantRestant <= 0 ? 'PAYE' : 'NON_PAYE';
      }

      const { error: updateError } = await supabase
        .from('zakat_annuel')
        .update({
          montant_total_actifs:  totalAssets,
          montant_total_dettes:  totalDebts,
          montant_imposable:     montantImposable,
          montant_zakat_calcule: montantZakatCalcule,
          montant_restant:       montantRestant,
          depasse_nisab:         montantZakatCalcule > 0,
          statut,
          recalcule_auto:        true,
        })
        .eq('id', zakatAnnuelId);

      if (updateError) throw updateError;

      return {
        success: true,
        data: { montantZakatCalcule, montantImposable, montantRestant, statut, zakatAnnuelId },
      };
    } catch (error) {
      console.error('Erreur recalculateZakatAnnuel:', error);
      return { success: false, error: error.message };
    }
  },
};