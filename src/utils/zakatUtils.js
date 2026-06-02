// utils/zakatUtils.js
import { supabase } from "../services/supabase";

// ─── CONSTANTE CANONIQUE MALÉKITE ────────────────────────────────────────────
// Hawl = 1 année lunaire hijri = 354 jours hijri
// Calculé en JOURS HIJRI réels (pas grégoriens)
export const HAWL_DAYS_MALIKI = 354;

// ─── CONVERSION GRÉGORIEN → HIJRI ────────────────────────────────────────────
const _gregorianToHijri = (date) => {
  try {
    const formatted = new Intl.DateTimeFormat("ar-SA-u-ca-islamic-umalqura", {
      day: "numeric",
      month: "numeric",
      year: "numeric",
    }).format(date);
    const parts = formatted.split("/");
    if (parts.length === 3) {
      const toWestern = (s) =>
        s
          .replace(/٠/g, "0")
          .replace(/١/g, "1")
          .replace(/٢/g, "2")
          .replace(/٣/g, "3")
          .replace(/٤/g, "4")
          .replace(/٥/g, "5")
          .replace(/٦/g, "6")
          .replace(/٧/g, "7")
          .replace(/٨/g, "8")
          .replace(/٩/g, "9");
      const day = parseInt(toWestern(parts[0]), 10);
      const month = parseInt(toWestern(parts[1]), 10);
      const year = parseInt(toWestern(parts[2]), 10);
      if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
        return { day, month, year };
      }
    }
  } catch {}
  return null;
};

// Algorithme Kuwaiti : date hijri → jour julien
const _hijriToJulianDay = (year, month, day) => {
  return (
    Math.trunc((11 * year + 3) / 30) +
    354 * year +
    30 * month -
    Math.trunc((month - 1) / 2) +
    day +
    1948440 -
    385
  );
};

// ─── JOURS HIJRI ENTRE DEUX DATES GRÉGORIENNES ───────────────────────────────
// Calcul RÉEL en jours hijri (pas de conversion approximative)
export const hijriDaysBetween = (dateDebut, dateFin) => {
  try {
    const d1 = new Date(dateDebut);
    const d2 = dateFin ? new Date(dateFin) : new Date();
    const h1 = _gregorianToHijri(d1);
    const h2 = _gregorianToHijri(d2);
    if (!h1 || !h2) {
      // Fallback : approximation proportionnelle
      const joursGreg = Math.floor((d2 - d1) / 86400000);
      return Math.floor((joursGreg * 354) / 365.25);
    }
    const jd1 = _hijriToJulianDay(h1.year, h1.month, h1.day);
    const jd2 = _hijriToJulianDay(h2.year, h2.month, h2.day);
    return Math.max(0, jd2 - jd1);
  } catch {
    const d1 = new Date(dateDebut);
    const d2 = dateFin ? new Date(dateFin) : new Date();
    const joursGreg = Math.floor((d2 - d1) / 86400000);
    return Math.floor((joursGreg * 354) / 365.25);
  }
};

// ─── ANNÉE HIJRI D'UNE DATE GRÉGORIENNE ──────────────────────────────────────
export const getHijriYearFromDate = (dateGregorienne) => {
  try {
    const date = new Date(dateGregorienne);
    const h = _gregorianToHijri(date);
    if (h && h.year > 1400 && h.year < 1600) return h.year;
    return null;
  } catch {
    return null;
  }
};

// ─── DATE D'ÉCHÉANCE HIJRI → GRÉGORIEN ───────────────────────────────────────
// 354 jours hijri ≈ 354.367 jours grégoriens
export const computeDateEcheanceGreg = (dateDebutGreg) => {
  if (!dateDebutGreg) return new Date(Date.now() + 354 * 86400000);
  const msEcheance = Math.round(354.367 * 86400000);
  return new Date(new Date(dateDebutGreg).getTime() + msEcheance);
};

// ─── HAWL STATUS (jours HIJRI réels) ─────────────────────────────────────────
export const getHawlStatus = (zakatAnniversaryDate) => {
  if (!zakatAnniversaryDate) {
    return {
      completed: false,
      daysRemaining: 354,
      nextAnniversary: null,
      message: "not_started",
    };
  }
  const anniversary = new Date(zakatAnniversaryDate);
  if (isNaN(anniversary.getTime())) {
    return {
      completed: true,
      daysRemaining: 0,
      nextAnniversary: null,
      message: "completed",
    };
  }
  const joursHijriEcoules = hijriDaysBetween(anniversary, new Date());
  const completed = joursHijriEcoules >= HAWL_DAYS_MALIKI;
  const daysRemaining = completed ? 0 : HAWL_DAYS_MALIKI - joursHijriEcoules;
  const nextAnniversary = computeDateEcheanceGreg(anniversary);
  return {
    completed,
    daysRemaining,
    joursHijriEcoules,
    nextAnniversary,
    message: completed ? "completed" : "in_progress",
  };
};

// ─── HAWL COMPLETION CHECK ───────────────────────────────────────────────────
export const checkHawlCompletion = (zakatAnniversaryDate) => {
  if (!zakatAnniversaryDate) return false;
  const anniversary = new Date(zakatAnniversaryDate);
  if (isNaN(anniversary.getTime())) return true;
  return hijriDaysBetween(anniversary, new Date()) >= HAWL_DAYS_MALIKI;
};

// ─── HIJRI YEAR COURANT ───────────────────────────────────────────────────────
export const getCurrentHijriYear = () => {
  try {
    const today = new Date();
    const formatted = new Intl.DateTimeFormat("ar-SA-u-ca-islamic-umalqura", {
      year: "numeric",
    }).format(today);
    const digits = formatted.replace(/[^\d٠١٢٣٤٥٦٧٨٩]/g, "");
    const western = digits
      .replace(/٠/g, "0")
      .replace(/١/g, "1")
      .replace(/٢/g, "2")
      .replace(/٣/g, "3")
      .replace(/٤/g, "4")
      .replace(/٥/g, "5")
      .replace(/٦/g, "6")
      .replace(/٧/g, "7")
      .replace(/٨/g, "8")
      .replace(/٩/g, "9");
    const year = parseInt(western, 10);
    if (!isNaN(year) && year > 1400 && year < 1600) return year;
    return _hijriYearFallback(today);
  } catch {
    return _hijriYearFallback(new Date());
  }
};

// Alias compatibilité (double r)
export const getCurrentHijriYearr = getCurrentHijriYear;

const _hijriYearFallback = (date) => {
  const julianDay = Math.floor(date.getTime() / 86400000 + 2440587.5);
  const l = julianDay - 1948440 + 10632;
  const n = Math.floor((l - 1) / 10631);
  const l2 = l - 10631 * n + 354;
  const j =
    Math.floor((10985 - l2) / 5316) * Math.floor((50 * l2) / 17719) +
    Math.floor(l2 / 5670) * Math.floor((43 * l2) / 15238);
  const l3 =
    l2 -
    Math.floor((30 - j) / 15) * Math.floor((17719 * j) / 50) -
    Math.floor(j / 16) * Math.floor((15238 * j) / 43) +
    29;
  return 30 * n + Math.floor(l3 / 10631);
};

export const getCurrentHijriDate = () => {
  try {
    return new Intl.DateTimeFormat("ar-SA-u-ca-islamic-umalqura", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(new Date());
  } catch {
    return "";
  }
};

// ─── CHECK EXISTING ZAKAT ────────────────────────────────────────────────────
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

// ─── LIBELLÉ BASE NISSAB ─────────────────────────────────────────────────────
export const getNisabBaseLabel = (base, lang = "fr") => {
  const labels = {
    fr: {
      or_24k: "Or 24K (85g)",
      or_20k: "Or 20K (85g)",
      or_18k: "Or 18K (85g)",
      argent: "Argent (595g)",
    },
    ar: {
      or_24k: "ذهب 24 قيراط",
      or_20k: "ذهب 20 قيراط",
      or_18k: "ذهب 18 قيراط",
      argent: "فضة (595 غ)",
    },
    en: {
      or_24k: "Gold 24K (85g)",
      or_20k: "Gold 20K (85g)",
      or_18k: "Gold 18K (85g)",
      argent: "Silver (595g)",
    },
  };
  return labels[lang]?.[base] ?? labels.fr[base] ?? base;
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

    const totalAssets = (assets || []).reduce(
      (s, a) => s + (a.valeur_totale || 0),
      0,
    );
    const totalDebts = (debts || []).reduce(
      (s, d) => s + (d.montant_dette || 0),
      0,
    );
    const montantImposable = totalAssets - totalDebts;

    const { data: nisab } = await supabase
      .from("nisab_zakat")
      .select("montant_nisab")
      .eq("actif", true)
      .order("date_debut", { ascending: false })
      .limit(1);

    const nisabAmount = nisab?.[0]?.montant_nisab || 0;
    const isNisabReached = montantImposable >= nisabAmount;
    const isHawlComplete = checkHawlCompletion(
      userProfile?.date_anniversaire_zakat,
    );
    const zakatAmount =
      isHawlComplete && isNisabReached ? montantImposable * 0.025 : 0;

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
    console.error("calculateZakatFromDB error:", error);
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

    if (existing)
      return {
        success: false,
        message: "Record already exists",
        data: existing,
      };

    const dateFin = computeDateEcheanceGreg(new Date());

    const { data, error } = await supabase
      .from("zakat_annuel")
      .insert({
        utilisateur_id: userId,
        annee_hijri: currentHijriYear,
        date_debut: new Date(),
        date_fin: dateFin,
        montant_total_actifs: calculation.totalAssets,
        montant_total_dettes: calculation.totalDebts,
        montant_imposable: calculation.montantImposable,
        nisab_applique: calculation.nisabAmount,
        type_nisab_applique: calculation.nisabType || "OR_24K",
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

    const { data: activeAssets } = await supabase
      .from("zakat_actif")
      .select("id")
      .eq("utilisateur_id", userId)
      .eq("actif", true)
      .is("zakat_annuel_id", null);

    if (activeAssets?.length > 0) {
      await supabase
        .from("zakat_actif")
        .update({ zakat_annuel_id: data.id })
        .in(
          "id",
          activeAssets.map((a) => a.id),
        );
    }

    return { success: true, data };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const getCurrentNisab = async () => {
  const { data, error } = await supabase
    .from("nisab_zakat")
    .select("montant_nisab, unite, type_zakat_id, type_zakat(nom_type)")
    .eq("actif", true)
    .order("date_debut", { ascending: false })
    .limit(1);
  if (error) throw error;
  return data?.[0] || null;
};
// ─── LOCALE-AWARE DATE FORMATTING ────────────────────────────────────────────
// Maps app language codes to JS locale strings for toLocaleDateString
const DATE_LOCALE_MAP = {
  fr: "fr-FR",
  en: "en-US",
  ar: "ar-SA",
};

/**
 * Returns the JS locale string for toLocaleDateString based on app language.
 * @param {string} lang - App language code ("fr", "en", or "ar")
 * @returns {string} JS locale string (e.g. "fr-FR", "en-US", "ar-SA")
 */
export const getDateLocale = (lang = "fr") => {
  return DATE_LOCALE_MAP[lang] || "fr-FR";
};

/**
 * Formats a date using the app's current language locale.
 * @param {Date|string} date - The date to format
 * @param {string} lang - App language code
 * @param {object} options - Intl.DateTimeFormat options
 * @returns {string} Formatted date string
 */
export const formatDate = (date, lang = "fr", options = {}) => {
  const d = date instanceof Date ? date : new Date(date);
  const locale = getDateLocale(lang);
  try {
    return d.toLocaleDateString(locale, options);
  } catch {
    return d.toLocaleDateString("fr-FR", options);
  }
};
