// utils/zakatUtils.js
import { supabase } from '../services/supabase';

// ─── HAWL STATUS ──────────────────────────────────────────────────────────────
// If no date_anniversaire_zakat is set → hawl is considered COMPLETE
// (first registration: user has not yet set their anniversary date)
export const getHawlStatus = (zakatAnniversaryDate) => {
  if (!zakatAnniversaryDate) {
    return {
      completed: true,  // Default TRUE for first-time users
      daysRemaining: 0,
      nextAnniversary: null,
      message: "Premier enregistrement — Hawl considéré complété"
    };
  }

  const today = new Date();
  const anniversary = new Date(zakatAnniversaryDate);
  
  if (isNaN(anniversary.getTime())) {
    return { completed: true, daysRemaining: 0, nextAnniversary: null, message: "" };
  }

  const oneYearLater = new Date(anniversary);
  oneYearLater.setFullYear(anniversary.getFullYear() + 1);

  const completed = today >= oneYearLater;
  const daysRemaining = completed
    ? 0
    : Math.ceil((oneYearLater - today) / (1000 * 60 * 60 * 24));

  return {
    completed,
    daysRemaining,
    nextAnniversary: oneYearLater,
    message: completed ? "Hawl complété" : `${daysRemaining} jours restants`,
  };
};

// ─── HIJRI YEAR ───────────────────────────────────────────────────────────────
// Robust parser — never returns NaN
export const getCurrentHijriYear = () => {
  try {
    const today = new Date();

    // Method 1: Intl with ar-SA locale (most reliable)
    const formatted = new Intl.DateTimeFormat("ar-SA-u-ca-islamic", {
      year: "numeric",
    }).format(today);

    // Extract digits only (handles Arabic-Indic numerals like ١٤٤٦)
    const digits = formatted.replace(/[^\d٠١٢٣٤٥٦٧٨٩]/g, "");
    
    // Convert Arabic-Indic digits to Western digits if needed
    const western = digits
      .replace(/٠/g, "0").replace(/١/g, "1").replace(/٢/g, "2")
      .replace(/٣/g, "3").replace(/٤/g, "4").replace(/٥/g, "5")
      .replace(/٦/g, "6").replace(/٧/g, "7").replace(/٨/g, "8")
      .replace(/٩/g, "9");

    const year = parseInt(western, 10);
    if (!isNaN(year) && year > 1400 && year < 1600) return year;

    // Method 2: Mathematical approximation as fallback
    return hijriYearFallback(today);
  } catch (e) {
    return hijriYearFallback(new Date());
  }
};

// Mathematical fallback for Hijri year (approximate ±1 year)
const hijriYearFallback = (date) => {
  const julianDay = Math.floor((date.getTime() / 86400000) + 2440587.5);
  const l = julianDay - 1948440 + 10632;
  const n = Math.floor((l - 1) / 10631);
  const l2 = l - 10631 * n + 354;
  const j = Math.floor((10985 - l2) / 5316) * Math.floor((50 * l2) / 17719) +
            Math.floor(l2 / 5670) * Math.floor((43 * l2) / 15238);
  const l3 = l2 - Math.floor((30 - j) / 15) * Math.floor((17719 * j) / 50) -
             Math.floor(j / 16) * Math.floor((15238 * j) / 43) + 29;
  const year = 30 * n + Math.floor(l3 / 10631);
  return year;
};

export const getCurrentHijriDate = () => {
  try {
    const today = new Date();
    return new Intl.DateTimeFormat("ar-SA-u-ca-islamic", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(today);
  } catch (e) {
    return "";
  }
};

// ─── HAWL COMPLETION CHECK ───────────────────────────────────────────────────
export const checkHawlCompletion = (zakatAnniversaryDate) => {
  if (!zakatAnniversaryDate) return true; // No date = first time = considered complete
  const anniversary = new Date(zakatAnniversaryDate);
  if (isNaN(anniversary.getTime())) return true;
  const oneYearLater = new Date(anniversary);
  oneYearLater.setFullYear(anniversary.getFullYear() + 1);
  return new Date() >= oneYearLater;
};

// ─── CHECK EXISTING ZAKAT FOR YEAR ───────────────────────────────────────────
export const checkExistingZakatForYear = async (userId, hijriYear = null) => {
  const year = hijriYear || getCurrentHijriYear();

  const { data, error } = await supabase
    .from("zakat_annuel")
    .select("id, annee_hijri, statut, montant_zakat_calcule, created_at")
    .eq("utilisateur_id", userId)
    .eq("annee_hijri", year)
    .maybeSingle();

  if (error) throw error;
  return { exists: !!data, data };
};

// ─── CALCULATE ZAKAT FROM DB ─────────────────────────────────────────────────
export const calculateZakatFromDB = async (userId) => {
  try {
    const { data: userProfile } = await supabase
      .from("profils_utilisateurs")
      .select("date_anniversaire_zakat")
      .eq("id_utilisateur", userId)
      .single();

    const { data: assets } = await supabase
      .from("zakat_actif")
      .select("valeur_totale")
      .eq("utilisateur_id", userId)
      .eq("actif", true);

    const { data: debts } = await supabase
      .from("dettes")
      .select("montant_dette")
      .eq("utilisateur_id", userId)
      .eq("deductible", true)
      .eq("rembourse", false);

    const totalAssets = (assets || []).reduce((s, a) => s + (a.valeur_totale || 0), 0);
    const totalDebts = (debts || []).reduce((s, d) => s + (d.montant_dette || 0), 0);
    const montantImposable = totalAssets - totalDebts;

    const { data: nisab } = await supabase
      .from("nisab_zakat")
      .select("montant_nisab")
      .eq("actif", true)
      .order("date_debut", { ascending: false })
      .limit(1);

    const nisabAmount = nisab?.[0]?.montant_nisab || 0;
    const isNisabReached = montantImposable >= nisabAmount;
    const isHawlComplete = checkHawlCompletion(userProfile?.date_anniversaire_zakat);
    const zakatAmount = isHawlComplete && isNisabReached ? montantImposable * 0.025 : 0;

    return {
      totalAssets,
      totalDebts,
      montantImposable,
      nisabAmount,
      isNisabReached,
      isHawlComplete,
      zakatAmount,
      isZakatDue: isHawlComplete && isNisabReached && zakatAmount > 0,
    };
  } catch (error) {
    console.error("Error calculating zakat:", error);
    return null;
  }
};

// ─── GENERATE ZAKAT ANNUEL ────────────────────────────────────────────────────
export const generateZakatAnnuel = async (userId, calculation) => {
  try {
    const currentHijriYear = getCurrentHijriYear();

    const { data: existing } = await supabase
      .from("zakat_annuel")
      .select("id, statut, montant_zakat_calcule")
      .eq("utilisateur_id", userId)
      .eq("annee_hijri", currentHijriYear)
      .maybeSingle();

    if (existing) {
      return { success: false, message: "Record already exists", data: existing };
    }

    const { data, error } = await supabase
      .from("zakat_annuel")
      .insert({
        utilisateur_id: userId,
        annee_hijri: currentHijriYear,
        date_debut: new Date(),
        date_fin: new Date(new Date().setFullYear(new Date().getFullYear() + 1)),
        montant_total_actifs: calculation.totalAssets,
        montant_total_dettes: calculation.totalDebts,
        montant_imposable: calculation.montantImposable,
        nisab_applique: calculation.nisabAmount,
        type_nisab_applique: calculation.nisabType || "SILVER",
        depasse_nisab: calculation.isNisabReached,
        montant_zakat_calcule: calculation.zakatAmount,
        montant_zakat_paye: 0,
        montant_restant: calculation.zakatAmount,
        statut: calculation.isZakatDue ? "NON_PAYE" : "EXEMPTE",
        recalcule_auto: false,
        notes: `Auto-generated on ${new Date().toISOString()}`,
      })
      .select()
      .single();

    if (error) throw error;

    // ✅ Associate all active assets to this zakat year
    const { data: activeAssets } = await supabase
      .from("zakat_actif")
      .select("id")
      .eq("utilisateur_id", userId)
      .eq("actif", true)
      .is("zakat_annuel_id", null); // Only unassociated assets

    if (activeAssets && activeAssets.length > 0) {
      const assetIds = activeAssets.map((a) => a.id);
      await supabase
        .from("zakat_actif")
        .update({ zakat_annuel_id: data.id })
        .in("id", assetIds);
    }

    return { success: true, data };
  } catch (error) {
    console.error("Error generating zakat annuel:", error);
    return { success: false, error: error.message };
  }
};

// ─── GET NISAB ────────────────────────────────────────────────────────────────
export const getCurrentNisab = async () => {
  const { data, error } = await supabase
    .from("nisab_zakat")
    .select(`montant_nisab, unite, devise_reference, type_zakat_id, type_zakat(nom_type)`)
    .eq("actif", true)
    .order("date_debut", { ascending: false })
    .limit(1);

  if (error) throw error;
  return data?.[0] || null;
};