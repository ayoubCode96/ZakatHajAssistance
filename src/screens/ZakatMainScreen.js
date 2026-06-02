import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, Modal,
  Animated, Platform, StatusBar, Dimensions,
  ActivityIndicator, KeyboardAvoidingView, TextInput,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import {
  Calculator, History, CreditCard, ChevronRight, ChevronLeft, X,
  Plus, CheckCircle, AlertCircle, Clock, Coins, Gem, DollarSign,
  ShoppingCart, Leaf, Package, Building, Wallet, Banknote,
  TrendingUp, Edit3, Trash2, Menu, Crown, BookOpen, Bell, Settings,
  RefreshCw, Filter, ChevronDown,
} from "lucide-react-native";
import { useAppTranslation } from "../hooks/useTranslation";
import { useTheme } from "../context/ThemeContext";
import { useCurrency } from "../context/CurrencyContext";
import { useAuth } from "../context/AuthContext";
import { useAlert } from "../context/AlertContext";
import { zakatService, getZakatTypeTranslationKey, getAssetTranslationKey } from "../services/zakatService";
import { supabase } from "../services/supabase";
import { getCurrentHijriYear, formatDate } from "../utils/zakatUtils";
import InputField from "../components/InputField";
import Button from "../components/Button";
import ZakatCalculatorScreen from "./ZakatCalculatorScreen";
import BeneficiarySelector from "./BeneficiarySelector";
import hawlService from '../services/hawlService';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

const COLORS = {
  primary:        "#1a5d1a",
  primaryLight:   "#2e7d32",
  gold:           "#c9991a",
  goldLight:      "#d4af37",
  goldPale:       "#f5e99a",
  accent:         "#8b4513",
  success:        "#16a34a",
  successBg:      "#dcfce7",
  successText:    "#14532d",
  warning:        "#d97706",
  warningBg:      "#fef3c7",
  warningText:    "#92400e",
  danger:         "#dc2626",
  dangerBg:       "#fee2e2",
  dangerText:     "#991b1b",
  lightBg:        "#f0f7f0",
  lightBg2:       "#e8f2e8",
  lightCard:      "#ffffff",
  lightBorder:    "#c8ddc8",
  lightText:      "#1a2a1a",
  lightTextSec:   "#4a6b4a",
  lightTextTer:   "#7a9b7a",
  darkBg:         "#0c1f0c",
  darkBg2:        "#112011",
  darkCard:       "#172317",
  darkCard2:      "#1e2e1e",
  darkBorder:     "#2a3f2a",
  darkText:       "#e8f0e8",
  darkTextSec:    "#9ebf9e",
  darkTextTer:    "#6a8f6a",
};

const DRAWER_ITEMS = [
  { id: "zakat_annuel",         labelKey: "zakat_annuel",         icon: Crown,      screen: "ZakatAnnuel" },
  { id: "calcul_zakat",         labelKey: "calcul_zakat",         icon: Calculator, screen: "Calculator" },
  { id: "mes_actifs",           labelKey: "mes_actifs",           icon: Wallet,     screen: "MesActifs" },
  { id: "historique_paiements", labelKey: "historique_paiements", icon: CreditCard, screen: "HistoriquePaiements" },
  { id: "rappels",              labelKey: "rappels",              icon: Bell,       screen: "Rappels" },
];

const getTypeIcon = (typeName) => {
  const n = (typeName || "").toLowerCase();
  if (n.includes("or") || n.includes("gold"))               return Gem;
  if (n.includes("argent") || n.includes("silver"))         return Coins;
  if (n.includes("epargne") || n.includes("cash") || n.includes("compte")) return Banknote;
  if (n.includes("commerce") || n.includes("marchandise"))  return ShoppingCart;
  if (n.includes("agriculture") || n.includes("récolte"))   return Leaf;
  if (n.includes("bétail") || n.includes("chameau") || n.includes("vache")) return Package;
  if (n.includes("immo") || n.includes("locatif"))           return Building;
  return Wallet;
};

const getCategoryColor = (categoryId) => {
  const colors = { 1: "#dc2626", 2: "#f59e0b", 3: "#0891b2", 4: "#8b5cf6", 5: "#06b6d4", 6: "#ec4899", 7: "#3b82f6", 8: "#10b981" };
  return colors[categoryId] || "#6b7280";
};

const ZakatMainScreen = ({ onSaveSuccess }) => {
  const { t, currentLanguage, isRTL }    = useAppTranslation();
  const { currentTheme }          = useTheme();
  const { formatCurrency }        = useCurrency();
  const { user }                  = useAuth();
  const { alert, success, error: showError, confirm } = useAlert();

  const isDark = currentTheme === "dark";

  const th = {
    bg:        () => isDark ? COLORS.darkBg        : COLORS.lightBg,
    bg2:       () => isDark ? COLORS.darkBg2       : COLORS.lightBg2,
    card:      () => isDark ? COLORS.darkCard       : COLORS.lightCard,
    card2:     () => isDark ? COLORS.darkCard2      : "#f7faf7",
    border:    () => isDark ? COLORS.darkBorder     : COLORS.lightBorder,
    text:      () => isDark ? COLORS.darkText       : COLORS.lightText,
    textSec:   () => isDark ? COLORS.darkTextSec    : COLORS.lightTextSec,
    textTer:   () => isDark ? COLORS.darkTextTer    : COLORS.lightTextTer,
    primary:   () => isDark ? "#4daf52"             : COLORS.primary,
  };

  const [activeScreen, setActiveScreen] = useState("ZakatAnnuel");
  const [drawerOpen,   setDrawerOpen]   = useState(false);
  const drawerAnim  = useRef(new Animated.Value(-SCREEN_WIDTH * 0.78)).current;
  const overlayAnim = useRef(new Animated.Value(0)).current;

  const [zakatHistory,       setZakatHistory]       = useState([]);
  const [actifsHistory,      setActifsHistory]      = useState([]);
  const [paiementsHistory,   setPaiementsHistory]   = useState([]);
  const [hawlStatus, setHawlStatus] = useState({
    completed: false,
    daysRemaining: 354,
    daysElapsed: 0,
    progressPercent: 0,
    nextAnniversary: null,
    dateDebut: null,
    montantDebut: 0,
    message: "not_started",
    isLoading: true,
  });
  const [selectedActif,      setSelectedActif]      = useState(null);
  const [showActifModal,     setShowActifModal]      = useState(false);
  const [selectedYear,       setSelectedYear]        = useState(null);
  const [selectedYearActifs, setSelectedYearActifs]  = useState([]);
  const [showYearModal,      setShowYearModal]       = useState(false);
  const [showPaymentModal,   setShowPaymentModal]    = useState(false);
  const [beneficiaires,      setBeneficiaires]       = useState([]);
  const [categories,         setCategories]          = useState([]);

  // ── Filtres MesActifs ──────────────────────────────────────────
  const [actifFilterStatus, setActifFilterStatus] = useState('actif');
  const [actifFilterYear,   setActifFilterYear]   = useState(getCurrentHijriYear());
  const [allHijriYears,     setAllHijriYears]     = useState([]);

  const [loadingMain,       setLoadingMain]       = useState(false);
  const [loadingActifs,     setLoadingActifs]     = useState(false);
  const [loadingPaiements,  setLoadingPaiements]  = useState(false);
  const [loadingYearActifs, setLoadingYearActifs] = useState(false);
  const [loadingHawl,       setLoadingHawl]       = useState(false);
  const [deletingActifId,   setDeletingActifId]   = useState(null);
  const [editingActif,      setEditingActif]      = useState(false);
  const [paiementFilterYear, setPaiementFilterYear] = useState('all');


  const openDrawer = () => {
    setDrawerOpen(true);
    Animated.parallel([
      Animated.spring(drawerAnim,  { toValue: 0,   useNativeDriver: true, friction: 8 }),
      Animated.timing(overlayAnim, { toValue: 0.6, duration: 250, useNativeDriver: true }),
    ]).start();
  };
  const closeDrawer = () => {
    Animated.parallel([
      Animated.spring(drawerAnim,  { toValue: -SCREEN_WIDTH * 0.78, useNativeDriver: true, friction: 8 }),
      Animated.timing(overlayAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => setDrawerOpen(false));
  };
  const navigate = (screen) => {
    setActiveScreen(screen);
    Animated.parallel([
      Animated.spring(drawerAnim,  { toValue: -SCREEN_WIDTH * 0.78, useNativeDriver: true, friction: 8 }),
      Animated.timing(overlayAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => setDrawerOpen(false));
  };

  useEffect(() => {
    if (user) { loadHawlStatus(); loadZakatHistory(); loadBeneficiaries(); loadCategories(); }
  }, [user]);

  useEffect(() => {
    if (activeScreen === "MesActifs"           && !selectedYear) loadActifs();
    if (activeScreen === "HistoriquePaiements") loadPaiements(paiementFilterYear === 'all' ? null : paiementFilterYear);
    if (activeScreen === "ZakatAnnuel")        {
      setSelectedYear(null);
      setSelectedYearActifs([]);
      if (user) { loadZakatHistory(); loadHawlStatus(); }
    }
  }, [activeScreen]);
  useEffect(() => {
  if (activeScreen === "HistoriquePaiements") {
    loadPaiements(paiementFilterYear === 'all' ? null : paiementFilterYear);
  }
}, [paiementFilterYear]);

  useFocusEffect(useCallback(() => {
    if (user) {
      loadHawlStatus(); loadZakatHistory();
      if (activeScreen === "MesActifs")           loadActifs();
      if (activeScreen === "HistoriquePaiements") loadPaiements();
    }
  }, [user, activeScreen]));

  const loadHawlStatus = async () => {
    setLoadingHawl(true);
    try {
      const status = await hawlService.loadHawlStatusForUser(user.id);
      setHawlStatus({
        completed:       status.completed,
        daysRemaining:   status.daysRemaining,
        daysElapsed:     status.daysElapsed,
        progressPercent: status.progressPercent,
        nextAnniversary: status.nextAnniversary,
        dateDebut:       status.dateDebut,
        montantDebut:    status.montantDebut || 0,  // ✅ toujours inclus
        message:         status.message,
        isLoading:       false,
      });
    } catch {
      setHawlStatus({
        completed: false, daysRemaining: 354, daysElapsed: 0,
        progressPercent: 0, nextAnniversary: null, dateDebut: null,
        montantDebut: 0, message: 'not_started', isLoading: false,
      });
    } finally {
      setLoadingHawl(false);
    }
  };

  const loadZakatHistory = async () => {
    setLoadingMain(true);
    const result = await zakatService.getZakatAnnuelHistory(user.id);
    if (result.success) {
      setZakatHistory(result.data);
      const years = [...new Set((result.data || []).map(z => z.annee_hijri))].sort((a, b) => b - a);
      setAllHijriYears(years);
    }
    setLoadingMain(false);
  };

  // ✅ FIX : loadActifs avec filtre correct et déduplication par (annee_hijri + nom_actif)
  const loadActifs = async () => {
    setLoadingActifs(true);
    try {
      const { data, error } = await supabase
        .from('zakat_actif')
        .select('*, type_zakat(nom_type, taux_zakat, unite_mesure), zakat_annuel(annee_hijri)')
        .eq('utilisateur_id', user.id)
        .order('updated_at', { ascending: false });

      if (!error) {
        // ✅ FIX : déduplication par (annee_hijri + nom_actif) pour éviter doublons
        const seen = new Set();
        const deduped = (data || []).filter(a => {
          // Les supprimés ne sont jamais dédupliqués (on veut voir tous)
          if (a.actif === false) return true;
          const key = `${a.zakat_annuel?.annee_hijri}_${a.nom_actif}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
        setActifsHistory(deduped);
      }
    } catch {
      setActifsHistory([]);
    } finally {
      setLoadingActifs(false);
    }
  };

  const loadPaiements = async (hijriYear = null) => {
  setLoadingPaiements(true);
  try {
    let query = supabase
      .from("paiement_zakat")
      .select(`
        id,
        montant_paye,
        date_paiement,
        moyen_paiement,
        zakat_annuel!inner(utilisateur_id, annee_hijri),
        beneficiaire(nom)
      `)
      .eq("zakat_annuel.utilisateur_id", user.id)
      .order("date_paiement", { ascending: false });
 
    // ✅ FIX : filtrer par année hijri si sélectionnée
    if (hijriYear && hijriYear !== 'all') {
      query = query.eq("zakat_annuel.annee_hijri", hijriYear);
    }
 
    const { data, error } = await query;
    if (!error) setPaiementsHistory(data || []);
  } catch {
    setPaiementsHistory([]);
  } finally {
    setLoadingPaiements(false);
  }
};

  const loadCategories = async () => {
    try {
      const { data } = await supabase
        .from("categorie_beneficiaire")
        .select("id, nom_francais, description, ordre_priorite, actif")
        .eq("actif", true)
        .order("ordre_priorite", { ascending: true });
      if (data) setCategories(data);
    } catch {}
  };

  const loadBeneficiaries = async () => {
  try {
    const { data } = await supabase
      .from("beneficiaire")
      .select(`id, nom, categorie_beneficiaire_id, categorie_beneficiaire(id, nom_francais, description)`)
      .eq("utilisateur_id", user.id)   
      .eq("actif", true)
      .order("nom", { ascending: true });
    if (data) setBeneficiaires(data);
  } catch {}
};

  const loadActifsForYear = async (zakatAnnuelId) => {
    setLoadingYearActifs(true);
    try {
      const { data, error } = await supabase
        .from('zakat_actif')
        .select('*, type_zakat(nom_type, taux_zakat, unite_mesure)')
        .eq('zakat_annuel_id', zakatAnnuelId)
        .order('updated_at', { ascending: false });
      if (!error) setSelectedYearActifs(data || []);
    } catch {
      setSelectedYearActifs([]);
    } finally {
      setLoadingYearActifs(false);
    }
  };

  const handleRecalculateClick = async () => {
    setLoadingMain(true);
    try {
      const currentHijriYear = getCurrentHijriYear();
      const currYearData = zakatHistory.find(z => z.annee_hijri === currentHijriYear);
      if (!currYearData) { navigate("Calculator"); return; }
      setLoadingActifs(true);
      const { data, error } = await supabase
        .from("zakat_actif")
        .select(`*, type_zakat(nom_type, taux_zakat, unite_mesure)`)
        .eq("zakat_annuel_id", currYearData.id)
        .order("updated_at", { ascending: false });
      if (!error) setSelectedYearActifs(data || []);
      setSelectedYear(currYearData);
      navigate("Calculator");
    } catch { showError(t('error'), t('no_assets_in_year')); }
    finally  { setLoadingMain(false); setLoadingActifs(false); }
  };

  const openYearDetails = async (zakatData) => {
    setSelectedYear(zakatData);
    await loadActifsForYear(zakatData.id);
    setShowYearModal(true);
  };

  const handleDeleteActif = async (actifId) => {
    confirm(t("confirm_delete"), t("delete_actif_confirm"), async () => {
      setDeletingActifId(actifId);
      try {
        const { data: actif } = await supabase
          .from("zakat_actif").select("zakat_annuel_id, nom_actif").eq("id", actifId).single();
        const { error: deleteError } = await supabase
          .from("zakat_actif").update({ actif: false }).eq("id", actifId);
        if (deleteError) throw deleteError;

        let zakatAnnuelId = actif?.zakat_annuel_id;
        if (!zakatAnnuelId) {
          const { data: r } = await supabase
            .from("zakat_annuel").select("id")
            .eq("utilisateur_id", user.id)
            .order("annee_hijri", { ascending: false }).limit(1);
          if (r?.length > 0) zakatAnnuelId = r[0].id;
        }
        if (zakatAnnuelId) {
          const result = await zakatService.recalculateZakatAnnuel(zakatAnnuelId);
          if (result.success) success(t("success"), `${t('delete')} ✓\n${t('zakat')}: ${formatCurrency(result.data.montantZakatCalcule)}`);
        } else {
          success(t('success'), `${t('delete')} ✓`);
        }

        setActifsHistory(prev => prev.map(a => a.id === actifId ? { ...a, actif: false } : a));
        if (selectedYear) {
          setSelectedYearActifs(prev => prev.map(a => a.id === actifId ? { ...a, actif: false } : a));
          const updatedHistory = await zakatService.getZakatAnnuelHistory(user.id);
          if (updatedHistory.success) {
            setZakatHistory(updatedHistory.data);
            const updatedYear = updatedHistory.data.find(z => z.id === selectedYear.id);
            if (updatedYear) setSelectedYear(updatedYear);
          }
        }
        setTimeout(() => { loadActifs(); loadZakatHistory(); }, 300);
      } catch (error) { showError(t('error'), error.message); }
      finally { setDeletingActifId(null); }
    });
  };

  const handlePayZakat = async (amount, beneficiary, method) => {
    if (!selectedYear || !amount || !beneficiary) {
      showError(t("error"), t('please_fill_all_fields'));
      return;
    }
    const pa = parseFloat(amount);
    if (pa <= 0)                          { showError(t("error"), t("invalid_amount")); return; }
    if (pa > selectedYear.montant_restant){ showError(t("error"), t("amount_exceeds_due")); return; }

    try {
      const { error: pe } = await supabase.from("paiement_zakat").insert({
        zakat_annuel_id: selectedYear.id,
        beneficiaire_id: beneficiary.id,
        montant_paye:    pa,
        date_paiement:   new Date().toISOString(),
        moyen_paiement:  method,
      });
      if (pe) throw pe;

      const newRem    = Math.max(0, selectedYear.montant_restant - pa);
      const newPaid   = (selectedYear.montant_zakat_paye || 0) + pa;
      const newStatus = newRem <= 0 ? "PAYE" : "NON_PAYE";

      const { error: ue } = await supabase.from("zakat_annuel").update({
        montant_zakat_paye: newPaid,
        montant_restant:    newRem,
        statut:             newStatus,
      }).eq("id", selectedYear.id);
      if (ue) throw ue;

      // ✅ Paiement complet → démarrer nouveau hawl (§4.3 cycle complet)
      if (newStatus === 'PAYE') {
        const montantActuel = parseFloat(selectedYear.montant_imposable || 0);
        const nisabActuel   = parseFloat(selectedYear.nisab_applique    || 0);
        const baseChoisie   = zakatService.mapNisabAppliqueTOBase(selectedYear.type_nisab_applique);
        await hawlService.startNewHawlAfterPayment(user.id, montantActuel, nisabActuel, baseChoisie);
      }

      // ✅ Fermer les modals AVANT success() (§10 bugs connus)
      setShowPaymentModal(false);
      setShowYearModal(false);
      setSelectedYear(null);

      setTimeout(() => success(t("success"), t("payment_recorded_successfully")), 300);
      loadZakatHistory();
      loadHawlStatus();
      loadPaiements();

    } catch (error) {
      setShowPaymentModal(false);
      setShowYearModal(false);
      setSelectedYear(null);
      setTimeout(() => showError(t("error"), error.message || t("payment_failed")), 300);
    }
  };

  // ─── Callback reçu du CalculatorScreen après sauvegarde ──────────
  const handleCalculatorSaveSuccess = useCallback((saveData) => {
    loadZakatHistory();
    loadHawlStatus();
    navigate("ZakatAnnuel");
  }, []);

  // ── StatusBadge — gère tous les statuts (EN_COURS_HAWL + REMPLACE) ──
  const StatusBadge = ({ statut }) => {
    const cfg = {
      PAYE:          { bg: isDark ? "#0f2a1a" : COLORS.successBg,  color: isDark ? "#5fd87f" : COLORS.successText, label: t("paid") },
      NON_PAYE:      { bg: isDark ? "#2a0f0f" : COLORS.dangerBg,   color: isDark ? "#f87171" : COLORS.dangerText,  label: t("unpaid") },
      EXEMPTE:       { bg: isDark ? "#1a1a2a" : "#f3f4f6",          color: isDark ? "#9ca3af" : "#6b7280",          label: t("exempt") },
      EN_COURS_HAWL: { bg: isDark ? "#2a1e00" : COLORS.warningBg,  color: isDark ? "#f5c542" : COLORS.warning,     label: t("hawl_in_progress") },
      REMPLACE:      { bg: isDark ? "#1a1a1a" : "#f3f4f6",          color: isDark ? "#6b7280" : "#9ca3af",          label: t("replaced") },
    }[statut] || { bg: isDark ? "#1a1a1a" : "#f3f4f6", color: isDark ? "#9ca3af" : "#6b7280", label: statut };

    return (
      <View style={{ backgroundColor: cfg.bg, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 }}>
        <Text style={{ color: cfg.color, fontSize: 11, fontWeight: "700" }}>{cfg.label}</Text>
      </View>
    );
  };

  const SectionDivider = ({ label, color }) => (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12, marginTop: 4 }}>
      <View style={{ flex: 1, height: 1, backgroundColor: color + "30" }} />
      <Text style={{ color, fontSize: 11, fontWeight: "800", letterSpacing: 0.5 }}>{label}</Text>
      <View style={{ flex: 1, height: 1, backgroundColor: color + "30" }} />
    </View>
  );

  // ════════════════════════════════════════════════════════════════
  // ZAKAT ANNUEL SCREEN
  // ════════════════════════════════════════════════════════════════
  const ZakatAnnuelScreen = () => {
    const currentYear     = getCurrentHijriYear();
    const currentYearData = zakatHistory.find(z => z.annee_hijri === currentYear);

    return (
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>

        {/* ── HAWL BANNER ── */}
        {loadingHawl ? (
          <View style={{ padding: 16, alignItems: "center" }}>
            <ActivityIndicator size="small" color={COLORS.primary} />
          </View>
        ) : (
          <View style={{
            backgroundColor: hawlStatus.completed
              ? (isDark ? "#0f2a1a" : "#eaf6ea")
              : hawlStatus.message === 'not_started'
              ? (isDark ? COLORS.darkCard2 : "#f4f9f4")
              : (isDark ? "#2a1e00" : COLORS.warningBg),
            borderRadius: 14, padding: 14, marginBottom: 16,
            borderLeftWidth: 4,
            borderLeftColor: hawlStatus.completed
              ? (isDark ? "#4daf52" : COLORS.primary)
              : hawlStatus.message === 'not_started'
              ? (isDark ? COLORS.darkBorder : COLORS.lightBorder)
              : COLORS.warning,
          }}>
            <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
              {hawlStatus.completed
                ? <CheckCircle size={22} color={isDark ? "#4daf52" : COLORS.primary} />
                : <Clock size={22} color={hawlStatus.message === 'not_started'
                    ? (isDark ? COLORS.darkTextSec : COLORS.lightTextSec)
                    : COLORS.warning} />}
              <View style={{ flex: 1 }}>
                <Text style={{
                  fontWeight: "700", fontSize: 14,
                  color: hawlStatus.completed
                    ? (isDark ? "#4daf52" : COLORS.primary)
                    : hawlStatus.message === 'not_started'
                    ? (isDark ? COLORS.darkTextSec : COLORS.lightTextSec)
                    : COLORS.warning,
                }}>
                  {hawlStatus.completed
                    ? t("hawl_completed")
                    : hawlStatus.message === 'not_started'
                    ? (t("hawl_not_started"))
                    : t("hawl_not_completed")}
                </Text>
                {hawlStatus.message === 'not_started' && (
                  <Text style={{ color: isDark ? COLORS.darkTextSec : COLORS.lightTextSec, fontSize: 12, marginTop: 3 }}>
                    {t("hawl_starts_when_nisab_reached")}
                  </Text>
                )}
                {hawlStatus.message === 'in_progress' && (
                  <>
                    <Text style={{ color: isDark ? "#e5a83b" : COLORS.warningText, fontSize: 12, marginTop: 2 }}>
                      {hawlStatus.daysRemaining} {t("days_remaining")}
                    </Text>
                    <View style={{ height: 5, borderRadius: 3, backgroundColor: isDark ? "#3a2800" : "#fde68a", marginTop: 8 }}>
                      <View style={{ height: 5, borderRadius: 3, width: `${hawlStatus.progressPercent || 0}%`, backgroundColor: COLORS.warning }} />
                    </View>
                    <Text style={{ color: isDark ? COLORS.darkTextTer : COLORS.lightTextTer, fontSize: 10, marginTop: 3 }}>
                      {hawlStatus.daysElapsed} / 354 {t("days")} · {hawlStatus.progressPercent}%
                      {hawlStatus.nextAnniversary
                        ? ` · ${t("due_date_label")}: ${formatDate(hawlStatus.nextAnniversary, currentLanguage, { day: 'numeric', month: 'short', year: 'numeric' })}`
                        : ''}
                    </Text>
                  </>
                )}
                {hawlStatus.completed && hawlStatus.dateDebut && (
                  <Text style={{ color: isDark ? "#4daf52" : COLORS.primary, fontSize: 12, marginTop: 2 }}>
                    {t("started_on")} {formatDate(hawlStatus.dateDebut, currentLanguage)}
                  </Text>
                )}
              </View>
            </View>
          </View>
        )}

        {/* ── Current Year Card ── */}
        <View style={{ borderRadius: 18, marginBottom: 20, overflow: "hidden", borderWidth: 1, borderColor: isDark ? COLORS.darkBorder : "#b8d4b8" }}>
          <LinearGradient
            colors={isDark ? [COLORS.darkBg2, "#1a3a1a"] : [COLORS.primary, "#2e7d32"]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={{ padding: 20 }}
          >
            <Text style={{ color: "rgba(255,255,255,0.65)", fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 }}>
              {t("current_year")} {currentYear} {t('hijri_year_letter')}
            </Text>
            {currentYearData ? (
              <>
                <Text style={{ color: isDark ? "#e8f0e8" : "#fff", fontSize: 30, fontWeight: "800", marginTop: 6 }}>
                  {formatCurrency(currentYearData.montant_zakat_calcule || 0)}
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                  <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 11 }}>
                    Actifs: {formatCurrency(currentYearData.montant_total_actifs || 0)}
                  </Text>
                  {(currentYearData.montant_total_dettes || 0) > 0 && (
                    <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 11 }}>
                      · Dettes: -{formatCurrency(currentYearData.montant_total_dettes || 0)}
                    </Text>
                  )}
                  <Text style={{ color: "rgba(255,255,255,0.65)", fontSize: 11 }}>
                    · Net: {formatCurrency(currentYearData.montant_imposable || 0)}
                  </Text>
                </View>
                <View style={{ flexDirection: "row", alignItems: "center", marginTop: 10, gap: 10 }}>
                  <StatusBadge statut={currentYearData.statut} />
                  {currentYearData.montant_restant > 0 && (
                    <Text style={{ color: "rgba(255,255,255,0.75)", fontSize: 13 }}>
                      {t('remaining')}: {formatCurrency(currentYearData.montant_restant)}
                    </Text>
                  )}
                </View>
              </>
            ) : (
              <>
                <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 24, fontWeight: "700", marginTop: 8 }}>—</Text>
                <Text style={{ color: "rgba(255,255,255,0.55)", fontSize: 13, marginTop: 8 }}>{t("no_calculation_yet")}</Text>
              </>
            )}
          </LinearGradient>

          <TouchableOpacity
            onPress={handleRecalculateClick}
            disabled={loadingMain}
            style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", padding: 15, gap: 10, backgroundColor: th.card() }}
          >
            {loadingMain
              ? <ActivityIndicator size="small" color={th.primary()} />
              : <Plus size={18} color={th.primary()} />}
            <Text style={{ color: th.primary(), fontWeight: "700", fontSize: 14 }}>
              {currentYearData ? t("recalculate_zakat") : t("calculate_zakat_now")}
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── Historique ── */}
        <Text style={{ color: th.text(), fontWeight: "700", fontSize: 17, marginBottom: 14 }}>{t("annual_history")}</Text>

        {loadingMain ? (
          <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 40 }} />
        ) : zakatHistory.length === 0 ? (
          <View style={{ alignItems: "center", marginTop: 40 }}>
            <History size={48} color={th.textTer()} />
            <Text style={{ color: th.textSec(), marginTop: 12, fontSize: 14 }}>{t("no_history")}</Text>
          </View>
        ) : (
          zakatHistory.map((item, i) => (
            <TouchableOpacity
              key={i} onPress={() => openYearDetails(item)} activeOpacity={0.75}
              style={{ backgroundColor: th.card(), borderRadius: 16, marginBottom: 12, padding: 16, borderWidth: 1, borderColor: th.border() }}
            >
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: th.primary() + "20", alignItems: "center", justifyContent: "center" }}>
                    <Crown size={16} color={th.primary()} />
                  </View>
                  <Text style={{ color: th.primary(), fontWeight: "800", fontSize: 17 }}>{item.annee_hijri} {t("hijri_year_letter")}</Text>
                </View>
                <StatusBadge statut={item.statut} />
              </View>

              <View style={{ backgroundColor: th.card2(), borderRadius: 10, padding: 12, marginBottom: 12 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                  <Text style={{ color: th.textTer(), fontSize: 11 }}>{t("total_assets_label")}</Text>
                  <Text style={{ color: th.text(), fontSize: 12, fontWeight: '600' }}>{formatCurrency(item.montant_total_actifs || 0)}</Text>
                </View>
                {(item.montant_total_dettes || 0) > 0 && (
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                    <Text style={{ color: th.textTer(), fontSize: 11 }}>{t("deductible_debts_label")}</Text>
                    <Text style={{ color: COLORS.danger, fontSize: 12, fontWeight: '600' }}>-{formatCurrency(item.montant_total_dettes || 0)}</Text>
                  </View>
                )}
                <View style={{ height: 1, backgroundColor: th.border(), marginBottom: 6 }} />
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                  <Text style={{ color: th.textSec(), fontSize: 12, fontWeight: '700' }}>{t("net_wealth_label")}</Text>
                  <Text style={{ color: th.text(), fontSize: 13, fontWeight: '700' }}>{formatCurrency(item.montant_imposable || 0)}</Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ color: th.textSec(), fontSize: 12, fontWeight: '700' }}>{t("zakat_rate_label")}</Text>
                  <Text style={{ color: th.primary(), fontWeight: "800", fontSize: 14 }}>{formatCurrency(item.montant_zakat_calcule || 0)}</Text>
                </View>
                {item.montant_zakat_paye > 0 && (
                  <>
                    <View style={{ height: 1, backgroundColor: th.border(), marginTop: 6, marginBottom: 6 }} />
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={{ color: th.textSec(), fontSize: 11 }}>{t("paid_label")}</Text>
                      <Text style={{ color: isDark ? "#5fd87f" : COLORS.success, fontWeight: "700", fontSize: 12 }}>{formatCurrency(item.montant_zakat_paye)}</Text>
                    </View>
                    {item.montant_restant > 0 && (
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 3 }}>
                        <Text style={{ color: th.textSec(), fontSize: 11 }}>{t("remaining_label")}</Text>
                        <Text style={{ color: COLORS.warning, fontWeight: "700", fontSize: 12 }}>{formatCurrency(item.montant_restant)}</Text>
                      </View>
                    )}
                  </>
                )}
              </View>

              <View style={{ flexDirection: "row", gap: 8 }}>
                <TouchableOpacity
                  style={{ flex: 1, backgroundColor: th.primary() + "15", borderRadius: 10, padding: 10, alignItems: "center", borderWidth: 1, borderColor: th.primary() + "40" }}
                  onPress={() => openYearDetails(item)}
                >
                  <Text style={{ color: th.primary(), fontWeight: "600", fontSize: 12 }}>{t("view_assets")}</Text>
                </TouchableOpacity>
                {/* ✅ FIX : bouton paiement uniquement si hawl complété + zakat due */}
                { item.montant_restant > 0 && hawlStatus.completed && (
                  <TouchableOpacity
                    style={{ flex: 1, backgroundColor: th.primary(), borderRadius: 10, padding: 10, alignItems: "center" }}
                    onPress={() => { setSelectedYear(item); setShowPaymentModal(true); }}
                  >
                    <Text style={{ color: "#fff", fontWeight: "700", fontSize: 12 }}>{t("pay_now")}</Text>
                  </TouchableOpacity>
                )}
              </View>
              <Text style={{ color: th.textTer(), fontSize: 10, marginTop: 10, textAlign: isRTL ? "left" : "right" }}>
                {new Date(item.created_at).toLocaleDateString()}
              </Text>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    );
  };

  // ════════════════════════════════════════════════════════════════
  // MES ACTIFS SCREEN — filtres année + statut avec déduplication correcte
  // ════════════════════════════════════════════════════════════════
  const MesActifsScreen = () => {
    const { currentTheme } = useTheme();
    const isDark = currentTheme === 'dark';
    const th2 = {
      bg:      () => isDark ? '#0c1f0c' : '#f0f7f0',
      card:    () => isDark ? '#172317' : '#ffffff',
      card2:   () => isDark ? '#1e2e1e' : '#f7faf7',
      border:  () => isDark ? '#2a3f2a' : '#c8ddc8',
      text:    () => isDark ? '#e8f0e8' : '#1a2a1a',
      textSec: () => isDark ? '#9ebf9e' : '#4a6b4a',
      textTer: () => isDark ? '#6a8f6a' : '#7a9b7a',
      primary: () => isDark ? '#4daf52' : '#1a5d1a',
    };

    const filteredActifs = actifsHistory.filter(a => {
      if (actifFilterYear !== 'all') {
        const anneeActif = a.zakat_annuel?.annee_hijri;
        if (String(anneeActif) !== String(actifFilterYear)) return false;
      }
      if (actifFilterStatus === 'actif')    return a.actif !== false;
      if (actifFilterStatus === 'supprime') return a.actif === false;
      return true;
    });

    const actifsActifs    = filteredActifs.filter(a => a.actif !== false);
    const actifsSupprimés = filteredActifs.filter(a => a.actif === false);
    const totalValue      = actifsActifs.reduce((s, a) => s + (a.valeur_totale || 0), 0);
    const isLoading       = loadingActifs;

    const availableYears = [...new Set(
      actifsHistory.map(a => a.zakat_annuel?.annee_hijri).filter(Boolean)
    )].sort((a, b) => b - a);

    return (
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>

        <LinearGradient
          colors={isDark ? ['#112011', '#1a3a1a'] : ['#1a5d1a', '#2e7d32']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={{ borderRadius: 18, padding: 20, marginBottom: 14 }}
        >
          <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: '600' }}>
            {t("total_assets")}
          </Text>
          <Text style={{ color: isDark ? '#e8f0e8' : '#fff', fontSize: 30, fontWeight: '800', marginTop: 4 }}>
            {formatCurrency(totalValue)}
          </Text>
          <View style={{ flexDirection: 'row', gap: 12, marginTop: 6 }}>
            <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11 }}>
              {t("asset_count", { count: actifsActifs.length })}
            </Text>
            {actifsSupprimés.length > 0 && (
              <Text style={{ color: 'rgba(255,100,100,0.7)', fontSize: 11 }}>
                · {t("deleted_count", { count: actifsSupprimés.length })}
              </Text>
            )}
          </View>
        </LinearGradient>

        {/* ── FILTRES ── */}
        <View style={{ backgroundColor: th2.card(), borderRadius: 14, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: th2.border() }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <Filter size={15} color={th2.primary()} />
            <Text style={{ color: th2.text(), fontWeight: '700', fontSize: 13 }}>{t("filters")}</Text>
          </View>

          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
            {[
              { id: 'all',      label: t("all_filter") },
              { id: 'actif',    label: t("active_filter") },
              { id: 'supprime', label: t("deleted_filter") },
            ].map(f => {
              const sel = actifFilterStatus === f.id;
              return (
                <TouchableOpacity
                  key={f.id}
                  onPress={() => setActifFilterStatus(f.id)}
                  style={{
                    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
                    backgroundColor: sel ? th2.primary() : th2.card2(),
                    borderWidth: 1, borderColor: sel ? th2.primary() : th2.border(),
                  }}
                >
                  <Text style={{ fontSize: 12, fontWeight: sel ? '700' : '500', color: sel ? '#fff' : th2.textSec() }}>
                    {f.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {availableYears.length > 0 && (
            <View>
              <Text style={{ color: th2.textSec(), fontSize: 11, marginBottom: 6 }}>{t("hijri_year")}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TouchableOpacity
                    onPress={() => setActifFilterYear('all')}
                    style={{
                      paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
                      backgroundColor: actifFilterYear === 'all' ? th2.primary() : th2.card2(),
                      borderWidth: 1, borderColor: actifFilterYear === 'all' ? th2.primary() : th2.border(),
                    }}
                  >
                    <Text style={{ fontSize: 12, fontWeight: actifFilterYear === 'all' ? '700' : '500', color: actifFilterYear === 'all' ? '#fff' : th2.textSec() }}>
                      {t("all_years")}
                    </Text>
                  </TouchableOpacity>
                  {availableYears.map(yr => {
                    const sel = String(actifFilterYear) === String(yr);
                    return (
                      <TouchableOpacity
                        key={yr}
                        onPress={() => setActifFilterYear(yr)}
                        style={{
                          paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
                          backgroundColor: sel ? th2.primary() : th2.card2(),
                          borderWidth: 1, borderColor: sel ? th2.primary() : th2.border(),
                        }}
                      >
                        <Text style={{ fontSize: 12, fontWeight: sel ? '700' : '500', color: sel ? '#fff' : th2.textSec() }}>
                          {t("year_format", { year: yr })}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </ScrollView>
            </View>
          )}
        </View>

        {/* Rappel hawl global */}
        <View style={{
          backgroundColor: hawlStatus.completed ? (isDark ? '#0f2a1a' : '#dcfce7') : (isDark ? '#2a1e00' : '#fef3c7'),
          borderRadius: 12, padding: 12, marginBottom: 14,
          flexDirection: 'row', alignItems: 'center', gap: 10,
          borderLeftWidth: 3, borderLeftColor: hawlStatus.completed ? '#16a34a' : '#d97706',
        }}>
          {hawlStatus.completed ? <CheckCircle size={18} color="#16a34a" /> : <Clock size={18} color="#d97706" />}
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: hawlStatus.completed ? '#16a34a' : '#d97706' }}>
              {hawlStatus.completed
                ? (t('hawl_completed'))
                : hawlStatus.message === 'not_started'
                ? (t('hawl_not_started'))
                : `${t('hawl_not_completed')} — ${hawlStatus.daysRemaining}j restants`}
            </Text>
            <Text style={{ fontSize: 11, color: isDark ? '#9ebf9e' : '#4a6b4a', marginTop: 2 }}>
              {t("hawl_global_info")}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          onPress={() => navigate('Calculator')}
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: th2.primary() + '15', borderRadius: 14, padding: 14, marginBottom: 18, borderWidth: 1, borderColor: th2.primary() + '40', gap: 8 }}
        >
          <Plus size={18} color={th2.primary()} />
          <Text style={{ color: th2.primary(), fontWeight: '700', fontSize: 14 }}>
            {t('add_assets')}
          </Text>
        </TouchableOpacity>

        {isLoading ? (
          <ActivityIndicator size="large" color="#1a5d1a" style={{ marginTop: 40 }} />
        ) : filteredActifs.length === 0 ? (
          <View style={{ alignItems: 'center', marginTop: 40 }}>
            <Wallet size={48} color={th2.textTer()} />
            <Text style={{ color: th2.textSec(), marginTop: 12, fontSize: 14 }}>
              {actifFilterStatus !== 'all' || actifFilterYear !== 'all'
                ? t("no_assets_filter")
                : t('no_assets')}
            </Text>
          </View>
        ) : (
          <>
            {(actifFilterStatus === 'all' || actifFilterStatus === 'actif') && actifsActifs.length > 0 && (
              <>
                <SectionDivider
                  label={t("assets_header", { count: actifsActifs.length, value: formatCurrency(totalValue) })}
                  color={isDark ? '#4daf52' : '#1a5d1a'}
                />
                {actifsActifs.map(item => (
                  <ActifCard
                    key={item.id}
                    item={item}
                    isDark={isDark}
                    th={th2}
                    t={t}
                    formatCurrency={formatCurrency}
                    deletingActifId={deletingActifId}
                    showYear={actifFilterYear === 'all' && item.zakat_annuel?.annee_hijri}
                    onEdit={() => { setSelectedActif(item); setShowActifModal(true); }}
                    onDelete={() => handleDeleteActif(item.id)}
                  />
                ))}
              </>
            )}

            {(actifFilterStatus === 'all' || actifFilterStatus === 'supprime') && actifsSupprimés.length > 0 && (
              <>
                <SectionDivider label={t("deleted_header", { count: actifsSupprimés.length })} color="#ef4444" />
                {actifsSupprimés.map(item => {
                  const TypeIcon = getTypeIcon(item.type_zakat?.nom_type);
                  return (
                    <View key={item.id} style={{ backgroundColor: th2.card(), borderRadius: 14, marginBottom: 8, padding: 12, borderWidth: 0.5, borderColor: '#ef444430', opacity: 0.65 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: isDark ? '#2a0f0f' : '#fee2e2', alignItems: 'center', justifyContent: 'center' }}>
                          <TypeIcon size={17} color="#ef4444" />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: th2.text(), fontWeight: '600', fontSize: 13, textDecorationLine: 'line-through' }}>
                            {t(getAssetTranslationKey(item.nom_actif))}
                          </Text>
                          <Text style={{ color: th2.textSec(), fontSize: 11, marginTop: 2 }}>
                            {t(getZakatTypeTranslationKey(item.type_zakat?.nom_type))}
                            {item.zakat_annuel?.annee_hijri ? ` · ${item.zakat_annuel.annee_hijri} H` : ''}
                          </Text>
                        </View>
                        <Text style={{ color: '#ef4444', fontWeight: '700', fontSize: 14, textDecorationLine: 'line-through' }}>
                          {formatCurrency(item.valeur_totale)}
                        </Text>
                      </View>
                      <Text style={{ color: '#ef4444', fontSize: 10, marginTop: 6, textAlign: isRTL ? 'left' : 'right', opacity: 0.8 }}>
                        {t("deleted_on_label")} {formatDate(item.updated_at || item.created_at, currentLanguage)}
                      </Text>
                    </View>
                  );
                })}
              </>
            )}
          </>
        )}
      </ScrollView>
    );
  };

  // ════════════════════════════════════════════════════════════════
  // HISTORIQUE PAIEMENTS
  // ════════════════════════════════════════════════════════════════
const HistoriquePaiementsScreen = () => {
  const { currentTheme } = useTheme();
  const isDark2 = currentTheme === 'dark';
  const th2 = {
    bg:      () => isDark2 ? '#0c1f0c' : '#f0f7f0',
    card:    () => isDark2 ? '#172317' : '#ffffff',
    card2:   () => isDark2 ? '#1e2e1e' : '#f7faf7',
    border:  () => isDark2 ? '#2a3f2a' : '#c8ddc8',
    text:    () => isDark2 ? '#e8f0e8' : '#1a2a1a',
    textSec: () => isDark2 ? '#9ebf9e' : '#4a6b4a',
    textTer: () => isDark2 ? '#6a8f6a' : '#7a9b7a',
    primary: () => isDark2 ? '#4daf52' : '#1a5d1a',
  };
 
  // Années disponibles dans les paiements chargés
  const anneesPaiements = [
    ...new Set(paiementsHistory.map(p => p.zakat_annuel?.annee_hijri).filter(Boolean))
  ].sort((a, b) => b - a);
 
  // Totaux pour l'année sélectionnée
  const totalPaye = paiementsHistory.reduce((s, p) => s + (p.montant_paye || 0), 0);
 
  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
 
      {/* ── En-tête résumé ── */}
      <LinearGradient
        colors={isDark2 ? ['#112011', '#1a3a1a'] : ['#1a5d1a', '#2e7d32']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={{ borderRadius: 18, padding: 20, marginBottom: 14 }}
      >
        <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: '600' }}>
          {paiementFilterYear === 'all'
            ? (t("total_paid"))
            : t("total_paid_label", { year: paiementFilterYear })}
        </Text>
        <Text style={{ color: isDark2 ? '#e8f0e8' : '#fff', fontSize: 30, fontWeight: '800', marginTop: 4 }}>
          {formatCurrency(totalPaye)}
        </Text>
        <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, marginTop: 4 }}>
          {t("payment_count", { count: paiementsHistory.length })}
        </Text>
      </LinearGradient>
 
      {/* ── Filtre par année hijri ── */}
      <View style={{
        backgroundColor: th2.card(), borderRadius: 14, padding: 14,
        marginBottom: 14, borderWidth: 1, borderColor: th2.border(),
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <Filter size={15} color={th2.primary()} />
          <Text style={{ color: th2.text(), fontWeight: '700', fontSize: 13 }}>
            {t("filter_by_year")}
          </Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {/* Bouton "Toutes" */}
            <TouchableOpacity
              onPress={() => setPaiementFilterYear('all')}
              style={{
                paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
                backgroundColor: paiementFilterYear === 'all' ? th2.primary() : th2.card2(),
                borderWidth: 1,
                borderColor: paiementFilterYear === 'all' ? th2.primary() : th2.border(),
              }}
            >
              <Text style={{
                fontSize: 12,
                fontWeight: paiementFilterYear === 'all' ? '700' : '500',
                color: paiementFilterYear === 'all' ? '#fff' : th2.textSec(),
              }}>
                {t("all_button")}
              </Text>
            </TouchableOpacity>

            {/* Années disponibles dans l'historique */}
            {anneesPaiements.length > 0
              ? anneesPaiements.map(yr => {
                  const sel = String(paiementFilterYear) === String(yr);
                  return (
                    <TouchableOpacity
                      key={yr}
                      onPress={() => setPaiementFilterYear(yr)}
                      style={{
                        paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
                        backgroundColor: sel ? th2.primary() : th2.card2(),
                        borderWidth: 1, borderColor: sel ? th2.primary() : th2.border(),
                      }}
                    >
                      <Text style={{
                        fontSize: 12, fontWeight: sel ? '700' : '500',
                        color: sel ? '#fff' : th2.textSec(),
                      }}>
                        {t("year_format", { year: yr })}
                      </Text>
                    </TouchableOpacity>
                  );
                })
              : (
                // Si aucun paiement encore, afficher les années de l'historique zakat
                allHijriYears.map(yr => {
                  const sel = String(paiementFilterYear) === String(yr);
                  return (
                    <TouchableOpacity
                      key={yr}
                      onPress={() => setPaiementFilterYear(yr)}
                      style={{
                        paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
                        backgroundColor: sel ? th2.primary() : th2.card2(),
                        borderWidth: 1, borderColor: sel ? th2.primary() : th2.border(),
                      }}
                    >
                      <Text style={{
                        fontSize: 12, fontWeight: sel ? '700' : '500',
                        color: sel ? '#fff' : th2.textSec(),
                      }}>
                        {t("year_format", { year: yr })}
                      </Text>
                    </TouchableOpacity>
                  );
                })
              )}
          </View>
        </ScrollView>
      </View>
 
      {/* ── Liste des paiements ── */}
      {loadingPaiements ? (
        <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 60 }} />
      ) : paiementsHistory.length === 0 ? (
        <View style={{ alignItems: "center", marginTop: 60 }}>
          <CreditCard size={48} color={th2.textTer()} />
          <Text style={{ color: th2.textSec(), marginTop: 12, fontSize: 14 }}>
            {paiementFilterYear !== 'all'
              ? t("no_payments_year", { year: paiementFilterYear })
              : t("no_payments")}
          </Text>
          {paiementFilterYear !== 'all' && (
            <TouchableOpacity
              onPress={() => setPaiementFilterYear('all')}
              style={{ marginTop: 12, paddingHorizontal: 20, paddingVertical: 8, borderRadius: 20, backgroundColor: th2.primary() + '20', borderWidth: 1, borderColor: th2.primary() + '40' }}
            >
              <Text style={{ color: th2.primary(), fontWeight: '600', fontSize: 13 }}>
                {t("view_all_payments")}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        paiementsHistory.map((item, i) => (
          <View
            key={item.id || i}
            style={{
              backgroundColor: th2.card(), borderRadius: 14, marginBottom: 10,
              padding: 14, borderWidth: 1, borderColor: th2.border(),
              flexDirection: "row", alignItems: "center", gap: 12,
            }}
          >
            <View style={{
              width: 44, height: 44, borderRadius: 22,
              backgroundColor: isDark2 ? "#0f2a1a" : "#dcfce7",
              alignItems: "center", justifyContent: "center",
            }}>
              <CheckCircle size={20} color={isDark2 ? "#5fd87f" : "#166534"} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: th2.text(), fontWeight: "600", fontSize: 14 }}>
                {item.beneficiaire?.nom || t("beneficiary")}
              </Text>
              <Text style={{ color: th2.textSec(), fontSize: 12, marginTop: 2 }}>
                {t("year")} {item.zakat_annuel?.annee_hijri} {t("hijri_year_letter")}
                {item.moyen_paiement ? ` · ${item.moyen_paiement}` : ''}
              </Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={{ color: isDark2 ? "#5fd87f" : "#16a34a", fontWeight: "800", fontSize: 15 }}>
                {formatCurrency(item.montant_paye)}
              </Text>
              <Text style={{ color: th2.textTer(), fontSize: 11, marginTop: 2 }}>
                {formatDate(item.date_paiement, currentLanguage)}
              </Text>
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );
};

  const RappelsScreen = () => (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 32 }}>
      <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: th.primary() + "15", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
        <Bell size={36} color={th.primary()} />
      </View>
      <Text style={{ color: th.text(), fontSize: 18, fontWeight: "700", marginBottom: 8 }}>{t("reminders")}</Text>
      <Text style={{ color: th.textSec(), fontSize: 14, textAlign: "center", lineHeight: 20 }}>{t("reminders_coming_soon")}</Text>
    </View>
  );

  const getScreenTitle = () => {
    const item = DRAWER_ITEMS.find(i => i.screen === activeScreen);
    return item ? t(item.labelKey) : t("zakat");
  };
  const showBackButton = activeScreen !== "ZakatAnnuel" && activeScreen !== "Calculator";

  // ════════════════════════════════════════════════════════════════
  // ACTIF EDIT MODAL
  // ════════════════════════════════════════════════════════════════
  const ActifEditModal = () => {
    const [editValue,   setEditValue]   = useState(selectedActif?.valeur_totale?.toString() || "");
    const [editingLocal, setEditingLocal] = useState(false);

    const handleSave = async () => {
      if (!selectedActif) return;
      const newVal = parseFloat(editValue) || 0;
      setEditingLocal(true);
      try {
        await supabase.from("zakat_actif")
          .update({ valeur_totale: newVal, valeur_unitaire: newVal / (selectedActif.quantite || 1) })
          .eq("id", selectedActif.id);

        let zakatId = selectedActif.zakat_annuel_id;
        if (!zakatId) {
          const { data: r } = await supabase.from("zakat_annuel").select("id")
            .eq("utilisateur_id", user.id).order("annee_hijri", { ascending: false }).limit(1);
          if (r?.length > 0) zakatId = r[0].id;
        }
        let msg = "";
        if (zakatId) {
          const result = await zakatService.recalculateZakatAnnuel(zakatId);
          if (result.success) msg = `\n${t('zakat')}: ${formatCurrency(result.data.montantZakatCalcule)}`;
        }

        const updatedActif = { ...selectedActif, valeur_totale: newVal };
        setActifsHistory(prev => prev.map(a => a.id === selectedActif.id ? updatedActif : a));
        if (selectedYear) {
          setSelectedYearActifs(prev => prev.map(a => a.id === selectedActif.id ? updatedActif : a));
          const updatedHistory = await zakatService.getZakatAnnuelHistory(user.id);
          if (updatedHistory.success) {
            setZakatHistory(updatedHistory.data);
            const updatedYear = updatedHistory.data.find(z => z.id === selectedYear.id);
            if (updatedYear) setSelectedYear(updatedYear);
          }
        }
        success(t("success"), `${t('edit_asset')} ✓${msg}`);
        setShowActifModal(false);
        setSelectedActif(null);
        setTimeout(() => { loadActifs(); loadZakatHistory(); }, 300);
      } catch (error) { showError(t('error'), error.message); }
      finally { setEditingLocal(false); }
    };

    return (
      <Modal visible={showActifModal} transparent animationType="fade" onRequestClose={() => !editingLocal && setShowActifModal(false)}>
        <View style={{ flex: 1, backgroundColor: isDark ? "rgba(0,0,0,0.75)" : "rgba(0,0,0,0.55)", justifyContent: "center", alignItems: "center", padding: 24 }}>
          <View style={{ backgroundColor: th.card(), borderRadius: 22, padding: 24, width: "100%", borderWidth: 1, borderColor: th.border() }}>
            <Text style={{ color: th.text(), fontSize: 19, fontWeight: "800", marginBottom: 4 }}>{t("edit_asset")}</Text>
            <Text style={{ color: th.textSec(), fontSize: 13, marginBottom: 20 }}>{t(getAssetTranslationKey(selectedActif?.nom_actif))}</Text>

            <View style={{ backgroundColor: th.primary() + (isDark ? "20" : "10"), borderRadius: 12, padding: 14, marginBottom: 16, flexDirection: "row", justifyContent: "space-between", borderWidth: 1, borderColor: th.primary() + "30" }}>
              <Text style={{ color: th.textSec(), fontSize: 12 }}>{t('current_value')}</Text>
              <Text style={{ color: th.primary(), fontWeight: "800", fontSize: 15 }}>{formatCurrency(selectedActif?.valeur_totale || 0)}</Text>
            </View>

            <InputField label={t("new_total_value")} value={editValue} onChangeText={setEditValue} keyboardType="numeric" placeholder="0" />

            <View style={{ flexDirection: "row", gap: 12, marginTop: 20 }}>
              <Button title={t("cancel")} onPress={() => { setShowActifModal(false); setSelectedActif(null); }} variant="outline" style={{ flex: 1 }} textColor={th.textSec()} disabled={editingLocal} />
              <Button
                title={editingLocal ? "..." : t("save")} onPress={handleSave} style={{ flex: 1 }}
                backgroundColor={COLORS.primary} textColor="#fff" disabled={editingLocal}
                icon={editingLocal ? undefined : CheckCircle}
              />
            </View>
            {editingLocal && (
              <View style={{ alignItems: "center", marginTop: 12 }}>
                <ActivityIndicator size="small" color={COLORS.primary} />
                <Text style={{ color: th.textSec(), fontSize: 12, marginTop: 4 }}>{t('updating_in_progress')}</Text>
              </View>
            )}
          </View>
        </View>
      </Modal>
    );
  };

  // ── ActifCard ──────────────────────────────────────────────────
  const ActifCard = ({ item, isDark, th, t, formatCurrency, deletingActifId, onEdit, onDelete, showYear }) => {
    const TypeIcon   = getTypeIcon(item.type_zakat?.nom_type);
    const isDeleting = deletingActifId === item.id;

    return (
      <View style={{
        backgroundColor: th.card(),
        borderRadius: 14, marginBottom: 10, padding: 14,
        borderWidth: 1, borderColor: th.border(),
        opacity: isDeleting ? 0.5 : 1,
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: th.primary() + '20', alignItems: 'center', justifyContent: 'center' }}>
            <TypeIcon size={20} color={th.primary()} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: th.text(), fontWeight: '600', fontSize: 14 }}>
              {t(getAssetTranslationKey(item.nom_actif))}
            </Text>
            <Text style={{ color: th.textSec(), fontSize: 12, marginTop: 2 }}>
              {t(getZakatTypeTranslationKey(item.type_zakat?.nom_type))}
              {item.quantite ? ` · ${item.quantite} ${item.type_zakat?.unite_mesure || ''}` : ''}
              {showYear ? ` · ${item.zakat_annuel?.annee_hijri} H` : ''}
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ color: th.primary(), fontWeight: '800', fontSize: 15 }}>
              {formatCurrency(item.valeur_totale)}
            </Text>
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
              <TouchableOpacity onPress={onEdit} disabled={isDeleting} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <View style={{ backgroundColor: th.primary() + '15', borderRadius: 8, padding: 6 }}>
                  <Edit3 size={14} color={th.primary()} />
                </View>
              </TouchableOpacity>
              <TouchableOpacity onPress={onDelete} disabled={isDeleting} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <View style={{ backgroundColor: isDark ? '#2a0f0f' : '#fee2e2', borderRadius: 8, padding: 6 }}>
                  {isDeleting ? <ActivityIndicator size="small" color="#ef4444" /> : <Trash2 size={14} color="#ef4444" />}
                </View>
              </TouchableOpacity>
            </View>
          </View>
        </View>
        <Text style={{ color: th.textTer(), fontSize: 10, marginTop: 8, textAlign: isRTL ? 'left' : 'right' }}>
          {formatDate(item.updated_at || item.created_at, currentLanguage)}
        </Text>
      </View>
    );
  };

  // ════════════════════════════════════════════════════════════════
  // YEAR DETAILS MODAL
  // ════════════════════════════════════════════════════════════════
  const YearDetailsModal = () => {
    if (!selectedYear) return null;
    const actifsActifs    = selectedYearActifs.filter(a => a.actif !== false);
    const actifsSupprimés = selectedYearActifs.filter(a => a.actif === false);
    const totalActifs     = actifsActifs.reduce((s, a)    => s + (a.valeur_totale || 0), 0);
    const totalSupprimés  = actifsSupprimés.reduce((s, a) => s + (a.valeur_totale || 0), 0);

    return (
      <Modal visible={showYearModal} transparent animationType="slide" onRequestClose={() => setShowYearModal(false)}>
        <View style={{ flex: 1, backgroundColor: isDark ? "rgba(0,0,0,0.8)" : "rgba(0,0,0,0.6)" }}>
          <View style={{ flex: 1, marginTop: Platform.OS === "ios" ? 100 : 80, backgroundColor: th.bg(), borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingHorizontal: 16, paddingTop: 20 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
              <View>
                <Text style={{ color: th.text(), fontSize: 22, fontWeight: "800" }}>{t("year")} {selectedYear.annee_hijri} H</Text>
                <Text style={{ color: th.textTer(), fontSize: 12, marginTop: 2 }}>
                  {formatDate(selectedYear.created_at, currentLanguage)}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setShowYearModal(false)} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: th.card2(), alignItems: "center", justifyContent: "center" }}>
                <X size={20} color={th.text()} />
              </TouchableOpacity>
            </View>

            <View style={{ backgroundColor: th.card(), borderRadius: 14, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: th.border() }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                <Text style={{ color: th.textSec(), fontSize: 12 }}>{t("current_assets_total")}</Text>
                <Text style={{ color: th.text(), fontSize: 13, fontWeight: '700' }}>{formatCurrency(totalActifs)}</Text>
              </View>
              {totalSupprimés > 0 && (
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                  <Text style={{ color: th.textTer(), fontSize: 11 }}>{t("deleted_assets_not_counted")}</Text>
                  <Text style={{ color: '#ef4444', fontSize: 11, textDecorationLine: 'line-through' }}>{formatCurrency(totalSupprimés)}</Text>
                </View>
              )}
              {(selectedYear.montant_total_dettes || 0) > 0 && (
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                  <Text style={{ color: th.textSec(), fontSize: 12 }}>{t("debts")}</Text>
                  <Text style={{ color: COLORS.danger, fontSize: 12, fontWeight: '600' }}>-{formatCurrency(selectedYear.montant_total_dettes)}</Text>
                </View>
              )}
              <View style={{ height: 1, backgroundColor: th.border(), marginVertical: 6 }} />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                <Text style={{ color: th.textSec(), fontSize: 13, fontWeight: '700' }}>{t("taxable_net_wealth")}</Text>
                <Text style={{ color: th.text(), fontSize: 14, fontWeight: '800' }}>{formatCurrency(selectedYear.montant_imposable || 0)}</Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                <Text style={{ color: th.primary(), fontSize: 13, fontWeight: '700' }}>{t("zakat_rate_label")}</Text>
                <Text style={{ color: th.primary(), fontSize: 15, fontWeight: '800' }}>{formatCurrency(selectedYear.montant_zakat_calcule || 0)}</Text>
              </View>
              {(selectedYear.montant_zakat_paye || 0) > 0 && (
                <>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                    <Text style={{ color: th.textSec(), fontSize: 12 }}>{t("paid_label")}</Text>
                    <Text style={{ color: COLORS.success, fontSize: 12, fontWeight: '700' }}>{formatCurrency(selectedYear.montant_zakat_paye)}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ color: th.textSec(), fontSize: 12 }}>{t("remaining_label")}</Text>
                    <Text style={{ color: COLORS.warning, fontSize: 12, fontWeight: '700' }}>{formatCurrency(selectedYear.montant_restant || 0)}</Text>
                  </View>
                </>
              )}
              <View style={{ marginTop: 8, alignSelf: 'flex-end' }}>
                <StatusBadge statut={selectedYear.statut} />
              </View>
            </View>

            {loadingYearActifs ? (
              <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
                <ActivityIndicator size="large" color={COLORS.primary} />
              </View>
            ) : (
              <ScrollView style={{ flex: 1, marginBottom: 16 }}>
                {actifsActifs.length > 0 && (
                  <>
                    <SectionDivider label={t("assets_header", { count: actifsActifs.length, value: formatCurrency(totalActifs) })} color={th.primary()} />
                    {actifsActifs.map((item) => {
                      const TypeIcon = getTypeIcon(item.type_zakat?.nom_type);
                      return (
                        <View key={item.id} style={{ backgroundColor: th.card(), borderRadius: 12, marginBottom: 8, padding: 12, borderWidth: 1, borderColor: th.border(), flexDirection: "row", alignItems: "center", gap: 10 }}>
                          <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: th.primary() + "20", alignItems: "center", justifyContent: "center" }}>
                            <TypeIcon size={17} color={th.primary()} />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={{ color: th.text(), fontWeight: "600", fontSize: 13 }}>{t(getAssetTranslationKey(item.nom_actif))}</Text>
                            <Text style={{ color: th.textSec(), fontSize: 11, marginTop: 2 }}>
                              {t(getZakatTypeTranslationKey(item.type_zakat?.nom_type))}
                              {item.quantite ? ` · ${item.quantite} ${item.type_zakat?.unite_mesure || ''}` : ''}
                            </Text>
                          </View>
                          <Text style={{ color: th.primary(), fontWeight: "800", fontSize: 14 }}>{formatCurrency(item.valeur_totale)}</Text>
                        </View>
                      );
                    })}
                  </>
                )}

                {actifsSupprimés.length > 0 && (
                  <>
                    <SectionDivider label={t("deleted_header", { count: actifsSupprimés.length })} color="#ef4444" />
                    {actifsSupprimés.map((item) => {
                      const TypeIcon   = getTypeIcon(item.type_zakat?.nom_type);
                      const deletedDate = item.updated_at || item.created_at;
                      return (
                        <View key={item.id} style={{ backgroundColor: th.card(), borderRadius: 12, marginBottom: 8, padding: 12, borderWidth: 0.5, borderColor: "#ef444430", opacity: 0.6 }}>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                            <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: isDark ? "#2a0f0f" : "#fee2e2", alignItems: "center", justifyContent: "center" }}>
                              <TypeIcon size={16} color="#ef4444" />
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={{ color: th.text(), fontSize: 13, textDecorationLine: "line-through" }}>{t(getAssetTranslationKey(item.nom_actif))}</Text>
                              <Text style={{ color: th.textSec(), fontSize: 11 }}>{t(getZakatTypeTranslationKey(item.type_zakat?.nom_type))}</Text>
                            </View>
                            <View style={{ alignItems: "flex-end" }}>
                              <Text style={{ color: "#ef4444", fontWeight: "600", fontSize: 13, textDecorationLine: "line-through" }}>{formatCurrency(item.valeur_totale)}</Text>
                              <View style={{ backgroundColor: isDark ? "#2a0f0f" : "#fee2e2", paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4, marginTop: 2 }}>
                                <Text style={{ color: "#ef4444", fontSize: 9, fontWeight: "700" }}>{t("deleted_badge_label")}</Text>
                              </View>
                            </View>
                          </View>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6 }}>
                            <Trash2 size={10} color="#ef4444" />
                            <Text style={{ color: "#ef4444", fontSize: 10, opacity: 0.8 }}>
                              {formatDate(deletedDate, currentLanguage)} {t("at_label")} {new Date(deletedDate).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </Text>
                          </View>
                        </View>
                      );
                    })}
                  </>
                )}

                {actifsActifs.length === 0 && actifsSupprimés.length === 0 && (
                  <View style={{ alignItems: "center", marginTop: 32 }}>
                    <Wallet size={38} color={th.textTer()} />
                    <Text style={{ color: th.textSec(), marginTop: 10, fontSize: 13 }}>{t('no_assets_in_year')}</Text>
                  </View>
                )}
              </ScrollView>
            )}

            {/* ✅ Bouton paiement uniquement si hawl complété */}
            {selectedYear.statut === "NON_PAYE" && selectedYear.montant_restant > 0 && hawlStatus.completed && (
              <TouchableOpacity
                style={{ backgroundColor: COLORS.primary, borderRadius: 14, padding: 16, alignItems: "center", marginBottom: 10 }}
                onPress={() => { setShowYearModal(false); setShowPaymentModal(true); }}
              >
                <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16 }}>
                  {t("pay_now")} — {formatCurrency(selectedYear.montant_restant)}
                </Text>
              </TouchableOpacity>
            )}
            <Button title={t("close")} onPress={() => setShowYearModal(false)} variant="outline" textColor={th.textSec()} />
          </View>
        </View>
      </Modal>
    );
  };

  // ════════════════════════════════════════════════════════════════
  // PAYMENT MODAL
  // ════════════════════════════════════════════════════════════════
  const PaymentModal = React.memo(({ visible, selectedYear, beneficiaires, categories, onClose, onPay, formatCurrency, getCategoryColor, t, isDark }) => {
    const [paymentAmount, setPaymentAmount] = useState("");
    const [paymentMethod, setPaymentMethod] = useState("transfer");
    const [selectedBenef, setSelectedBenef] = useState(null);
    const [loadingPay,    setLoadingPay]    = useState(false);

    const bgL   = isDark ? COLORS.darkBg   : COLORS.lightBg;
    const cardL = isDark ? COLORS.darkCard  : COLORS.lightCard;
    const textL = isDark ? COLORS.darkText  : COLORS.lightText;
    const secL  = isDark ? COLORS.darkTextSec : COLORS.lightTextSec;
    const brdL  = isDark ? COLORS.darkBorder  : COLORS.lightBorder;
    const primL = isDark ? "#4daf52" : COLORS.primary;

    useEffect(() => {
      if (visible) { setPaymentAmount(""); setPaymentMethod("transfer"); setSelectedBenef(null); }
    }, [visible]);

    if (!selectedYear) return null;

    const handleConfirm = async () => {
      const amount = parseFloat(paymentAmount);
      if (!amount || amount <= 0 || !selectedBenef) {
        showError(t("error"), t('amount_and_beneficiary_required'));
        return;
      }
      if (amount > selectedYear.montant_restant) {
        showError(t("error"), t("amount_exceeds_due"));
        return;
      }
      setLoadingPay(true);
      await onPay({ amount, beneficiary: selectedBenef, method: paymentMethod });
      setLoadingPay(false);
    };

    return (
      <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
        <View style={{ flex: 1, backgroundColor: isDark ? "rgba(0,0,0,0.8)" : "rgba(0,0,0,0.55)" }}>
          <View style={{ flex: 1, marginTop: Platform.OS === "ios" ? 90 : 70, backgroundColor: bgL, borderTopLeftRadius: 26, borderTopRightRadius: 26, overflow: "hidden" }}>
            <LinearGradient
              colors={isDark ? [COLORS.darkBg2, "#1a3a1a"] : [COLORS.primary, "#2e7d32"]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={{ paddingHorizontal: 18, paddingTop: 20, paddingBottom: 18 }}
            >
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                <View>
                  <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 }}>{t("payment_zakat_header")}</Text>
                  <Text style={{ color: isDark ? "#e8f0e8" : "#fff", fontSize: 20, fontWeight: "800", marginTop: 4 }}>{t('year')} {selectedYear.annee_hijri} {t('hijri_year_letter')}</Text>
                </View>
                <TouchableOpacity onPress={onClose} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center" }}>
                  <X size={18} color="#fff" />
                </TouchableOpacity>
              </View>
            </LinearGradient>

            <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
              <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 20, paddingBottom: 32 }} keyboardShouldPersistTaps="handled">
                <View style={{ flexDirection: "row", gap: 8 }}>
                  {[
                    { lbl: t("zakat_due_label"), val: formatCurrency(selectedYear.montant_zakat_calcule), color: textL },
                    { lbl: t("paid"),            val: formatCurrency(selectedYear.montant_zakat_paye || 0), color: isDark ? "#5fd87f" : "#16a34a" },
                    { lbl: t("remaining"),       val: formatCurrency(selectedYear.montant_restant),        color: primL },
                  ].map((item, i) => (
                    <View key={i} style={{ flex: 1, backgroundColor: cardL, borderRadius: 12, padding: 11, borderWidth: 1, borderColor: brdL }}>
                      <Text style={{ fontSize: 9, color: secL, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.3, marginBottom: 4 }}>{item.lbl}</Text>
                      <Text style={{ fontSize: 13, fontWeight: "800", color: item.color }}>{item.val}</Text>
                    </View>
                  ))}
                </View>

                <View>
                  <Text style={{ fontSize: 13, fontWeight: "700", color: textL, marginBottom: 10 }}>{t("payment_amount")}</Text>
                  <View style={{ flexDirection: "row", gap: 10 }}>
                    <TextInput
                      style={{ flex: 1, backgroundColor: cardL, borderRadius: 12, borderWidth: 1.5, borderColor: primL + "60", padding: 14, fontSize: 24, fontWeight: "800", color: textL }}
                      value={paymentAmount}
                      onChangeText={setPaymentAmount}
                      keyboardType="decimal-pad"
                      placeholder={formatCurrency(selectedYear.montant_restant)}
                      placeholderTextColor={secL}
                    />
                    <View style={{ gap: 8 }}>
                      <TouchableOpacity onPress={() => setPaymentAmount(selectedYear.montant_restant.toString())}
                        style={{ backgroundColor: primL + "18", borderRadius: 10, padding: 10, borderWidth: 1, borderColor: primL + "40", alignItems: "center", minWidth: 60 }}>
                        <Text style={{ color: primL, fontSize: 11, fontWeight: "700" }}>Tout</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => setPaymentAmount((selectedYear.montant_restant / 2).toFixed(2))}
                        style={{ backgroundColor: primL + "18", borderRadius: 10, padding: 10, borderWidth: 1, borderColor: primL + "40", alignItems: "center", minWidth: 60 }}>
                        <Text style={{ color: primL, fontSize: 13, fontWeight: "700" }}>½</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>

                <View>
                  <Text style={{ fontSize: 13, fontWeight: "700", color: textL, marginBottom: 10 }}>{t("beneficiary_required")}</Text>
                  <BeneficiarySelector
                    beneficiaires={beneficiaires} categories={categories}
                    selectedBeneficiary={selectedBenef} onSelect={setSelectedBenef} onClear={() => setSelectedBenef(null)}
                    onAddBeneficiary={async (name, cat, onSuccess) => {
                       try {
                          const { data, error } = await supabase.from("beneficiaire")
                            .insert([{
                              nom: name,
                              categorie_beneficiaire_id: cat.id,
                              utilisateur_id: user.id,   
                              actif: true,
                            }])
                            .select(`id, nom, categorie_beneficiaire_id, categorie_beneficiaire(id, nom_francais, description)`);
                          if (error) throw error;
                          if (data?.length > 0) {
                            setBeneficiaires(prev => [...prev, data[0]]);
                            onSuccess(data[0]);
                          }
                        } catch (e) {
                          showError(t("error"), e.message);
                        }
                    }
                  }
                    getCategoryColor={getCategoryColor} t={t} isDark={isDark}
                  />
                </View>

                <View>
                  <Text style={{ fontSize: 13, fontWeight: "700", color: textL, marginBottom: 10 }}>{t("payment_method")}</Text>
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    {[
                      { id: "transfer", label: t("payment_transfer"), emoji: "🏦" },
                      { id: "card",     label: t("payment_card"),    emoji: "💳" },
                      { id: "cash",     label: t("cash_method"),  emoji: "💵" },
                    ].map(m => {
                      const sel = paymentMethod === m.id;
                      return (
                        <TouchableOpacity key={m.id} onPress={() => setPaymentMethod(m.id)}
                          style={{ flex: 1, padding: 14, borderRadius: 12, borderWidth: sel ? 2 : 1, borderColor: sel ? primL : brdL, backgroundColor: sel ? primL + "18" : cardL, alignItems: "center", gap: 5 }}>
                          <Text style={{ fontSize: 22 }}>{m.emoji}</Text>
                          <Text style={{ fontSize: 11, fontWeight: sel ? "700" : "500", color: sel ? primL : secL }}>{m.label}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              </ScrollView>
            </KeyboardAvoidingView>

            <View style={{ flexDirection: "row", gap: 10, padding: 16, borderTopWidth: 1, borderTopColor: brdL, backgroundColor: bgL }}>
              <TouchableOpacity onPress={onClose} disabled={loadingPay}
                style={{ flex: 1, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: brdL, alignItems: "center" }}>
                <Text style={{ color: secL, fontSize: 15, fontWeight: "500" }}>{t("cancel")}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleConfirm} disabled={loadingPay}
                style={{ flex: 2, padding: 14, borderRadius: 12, backgroundColor: COLORS.primary, alignItems: "center", justifyContent: "center" }}>
                {loadingPay
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={{ color: "#fff", fontSize: 15, fontWeight: "700" }}>{t("confirm_payment")}</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  });

  // ── Calculator wrapper ─────────────────────────────────────────
  const CalculatorScreenWrapper = () => (
    <ZakatCalculatorScreen onSaveSuccess={handleCalculatorSaveSuccess} />
  );

  // ════════════════════════════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════════════════════════════
  return (
    <View style={{ flex: 1, backgroundColor: th.bg(), writingDirection: isRTL ? "rtl" : "ltr" }}>
      <StatusBar backgroundColor={th.bg()} barStyle={isDark ? "light-content" : "dark-content"} />

      {/* Header */}
      <LinearGradient
        colors={isDark ? [COLORS.darkBg, COLORS.darkBg2] : [COLORS.lightBg, COLORS.lightBg2]}
        style={{ paddingTop: Platform.OS === "ios" ? 52 : 40, paddingHorizontal: 16, paddingBottom: 14 }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          {showBackButton ? (
            <TouchableOpacity
              onPress={() => { setActiveScreen("ZakatAnnuel"); setSelectedYear(null); setSelectedYearActifs([]); }}
              style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: th.primary() + "20", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: th.primary() + "30" }}
            >
              <ChevronLeft size={22} color={th.primary()} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={activeScreen === "Calculator" ? () => setActiveScreen("ZakatAnnuel") : openDrawer}
              style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: th.primary() + "20", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: th.primary() + "30" }}
            >
              {activeScreen === "Calculator"
                ? <ChevronLeft size={22} color={th.primary()} />
                : <Menu size={20} color={th.primary()} />}
            </TouchableOpacity>
          )}
          <View style={{ flex: 1 }}>
            <Text style={{ color: th.text(), fontSize: 20, fontWeight: "800" }}>{getScreenTitle()}</Text>
            {activeScreen === "ZakatAnnuel" && (
              <Text style={{ color: th.primary(), fontSize: 11, fontWeight: "600" }}>{t("according_to_maliki_school")}</Text>
            )}
          </View>
          <TouchableOpacity
            style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: th.primary() + "20", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: th.primary() + "30" }}
            onPress={() => navigate("Calculator")}
          >
            <Calculator size={18} color={th.primary()} />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* Screen content */}
      <View style={{ flex: 1 }}>
        {activeScreen === "ZakatAnnuel"         && <ZakatAnnuelScreen />}
        {activeScreen === "Calculator"          && <CalculatorScreenWrapper />}
        {activeScreen === "MesActifs"           && <MesActifsScreen />}
        {activeScreen === "HistoriquePaiements" && <HistoriquePaiementsScreen />}
        {activeScreen === "Rappels"             && <RappelsScreen />}
      </View>

      {/* Drawer overlay */}
      {drawerOpen && (
        <Animated.View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "#000", opacity: overlayAnim, zIndex: 10 }}>
          <TouchableOpacity style={{ flex: 1 }} onPress={closeDrawer} activeOpacity={1} />
        </Animated.View>
      )}

      {/* Drawer */}
      {drawerOpen && (
        <Animated.View style={{
          position: "absolute", top: 0, left: 0, bottom: 0,
          width: SCREEN_WIDTH * 0.78,
          backgroundColor: th.card(),
          transform: [{ translateX: drawerAnim }],
          zIndex: 20,
          shadowColor: "#000", shadowOffset: { width: 6, height: 0 }, shadowOpacity: 0.3, shadowRadius: 20, elevation: 24,
        }}>
          <LinearGradient
            colors={isDark ? [COLORS.darkBg2, "#1e3a1e"] : [COLORS.primary, "#2e7d32"]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={{ paddingTop: Platform.OS === "ios" ? 56 : 44, paddingHorizontal: 20, paddingBottom: 26 }}
          >
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
                <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" }}>
                  <Crown size={24} color="#fff" />
                </View>
                <View>
                  <Text style={{ color: "#fff", fontWeight: "800", fontSize: 17 }}>{t("zakat_annuel")}</Text>
                  <Text style={{ color: "rgba(255,255,255,0.65)", fontSize: 12, marginTop: 2 }}>{t("maliki_school_subtitle")}</Text>
                </View>
              </View>
              <TouchableOpacity onPress={closeDrawer} style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center" }}>
                <X size={18} color="rgba(255,255,255,0.9)" />
              </TouchableOpacity>
            </View>
          </LinearGradient>

          <ScrollView style={{ flex: 1, paddingTop: 14 }}>
            {DRAWER_ITEMS.map(item => {
              const Icon     = item.icon;
              const isActive = activeScreen === item.screen;
              return (
                <TouchableOpacity
                  key={item.id}
                  onPress={() => navigate(item.screen)}
                  style={{
                    flexDirection: "row", alignItems: "center", gap: 14,
                    paddingHorizontal: 16, paddingVertical: 14,
                    marginHorizontal: 10, borderRadius: 14, marginBottom: 4,
                    backgroundColor: isActive ? th.primary() + "18" : "transparent",
                  }}
                  activeOpacity={0.7}
                >
                  <View style={{
                    width: 42, height: 42, borderRadius: 21,
                    backgroundColor: isActive ? th.primary() : th.primary() + "15",
                    alignItems: "center", justifyContent: "center",
                  }}>
                    <Icon size={20} color={isActive ? "#fff" : th.primary()} />
                  </View>
                  <Text style={{ color: isActive ? th.primary() : th.text(), fontWeight: isActive ? "700" : "500", fontSize: 15, flex: 1 }}>
                    {t(item.labelKey)}
                  </Text>
                  {isActive && <ChevronRight size={16} color={th.primary()} />}
                </TouchableOpacity>
              );
            })}

            <View style={{ height: 1, backgroundColor: th.border(), marginHorizontal: 20, marginVertical: 14 }} />
            <View style={{ padding: 20, alignItems: "center" }}>
              <Text style={{ color: th.textTer(), fontSize: 12, lineHeight: 18, textAlign: "center", fontStyle: "italic" }}>
                {t("bismillah")}
              </Text>
            </View>
          </ScrollView>
        </Animated.View>
      )}

      {/* Modals */}
      <ActifEditModal />
      <YearDetailsModal />
      <PaymentModal
        visible={showPaymentModal}
        selectedYear={selectedYear}
        beneficiaires={beneficiaires}
        categories={categories}
        onClose={() => setShowPaymentModal(false)}
        onPay={async ({ amount, beneficiary, method }) => {
          await handlePayZakat(amount, beneficiary, method);
        }}
        formatCurrency={formatCurrency}
        getCategoryColor={getCategoryColor}
        t={t}
        isDark={isDark}
      />
    </View>
  );
};

export default ZakatMainScreen;