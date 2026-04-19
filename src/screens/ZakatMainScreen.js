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
  RefreshCw,
} from "lucide-react-native";
import { useAppTranslation } from "../hooks/useTranslation";
import { useTheme } from "../context/ThemeContext";
import { useCurrency } from "../context/CurrencyContext";
import { useAuth } from "../context/AuthContext";
import { useAlert } from "../context/AlertContext";
import { zakatService, getZakatTypeTranslationKey, getAssetTranslationKey } from "../services/zakatService";
import { supabase } from "../services/supabase";
import { getHawlStatus, getCurrentHijriYear } from "../utils/zakatUtils";
import InputField from "../components/InputField";
import Button from "../components/Button";
import ZakatCalculatorScreen from "./ZakatCalculatorScreen";
import BeneficiarySelector from "./BeneficiarySelector";

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
  if (n.includes("or") || n.includes("gold"))              return Gem;
  if (n.includes("argent") || n.includes("silver"))        return Coins;
  if (n.includes("epargne") || n.includes("cash") || n.includes("compte")) return Banknote;
  if (n.includes("commerce") || n.includes("marchandise")) return ShoppingCart;
  if (n.includes("agriculture") || n.includes("récolte"))  return Leaf;
  if (n.includes("bétail") || n.includes("chameau") || n.includes("vache")) return Package;
  if (n.includes("immo") || n.includes("locatif"))          return Building;
  return Wallet;
};

const getCategoryColor = (categoryId) => {
  const colors = { 1: "#dc2626", 2: "#f59e0b", 3: "#0891b2", 4: "#8b5cf6", 5: "#06b6d4", 6: "#ec4899", 7: "#3b82f6", 8: "#10b981" };
  return colors[categoryId] || "#6b7280";
};

const ZakatMainScreen = () => {
  const { t }                     = useAppTranslation();
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
  const [hawlStatus,         setHawlStatus]         = useState({ completed: true, daysRemaining: 0, nextAnniversary: null, message: "" });
  const [selectedActif,      setSelectedActif]      = useState(null);
  const [showActifModal,     setShowActifModal]      = useState(false);
  const [selectedYear,       setSelectedYear]       = useState(null);
  const [selectedYearActifs, setSelectedYearActifs] = useState([]);
  const [showYearModal,      setShowYearModal]      = useState(false);
  const [showPaymentModal,   setShowPaymentModal]   = useState(false);
  const [beneficiaires,      setBeneficiaires]      = useState([]);
  const [categories,         setCategories]         = useState([]);

  const [loadingMain,      setLoadingMain]      = useState(false);
  const [loadingActifs,    setLoadingActifs]    = useState(false);
  const [loadingPaiements, setLoadingPaiements] = useState(false);
  const [loadingYearActifs,setLoadingYearActifs]= useState(false);
  const [loadingHawl,      setLoadingHawl]      = useState(false);
  const [deletingActifId,  setDeletingActifId]  = useState(null);
  const [editingActif,     setEditingActif]     = useState(false);

  const openDrawer = () => {
    setDrawerOpen(true);
    Animated.parallel([
      Animated.spring(drawerAnim,  { toValue: 0,    useNativeDriver: true, friction: 8 }),
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
    if (activeScreen === "HistoriquePaiements") loadPaiements();
    if (activeScreen === "ZakatAnnuel")        { setSelectedYear(null); setSelectedYearActifs([]); if (user) { loadZakatHistory(); loadHawlStatus(); } }
  }, [activeScreen]);

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
      const { data: p } = await supabase.from("profils_utilisateurs").select("date_anniversaire_zakat").eq("id_utilisateur", user.id).single();
      setHawlStatus(p?.date_anniversaire_zakat ? getHawlStatus(p.date_anniversaire_zakat) : { completed: true, daysRemaining: 0, nextAnniversary: null, message: "" });
    } catch { setHawlStatus({ completed: true, daysRemaining: 0, nextAnniversary: null, message: "" }); }
    finally  { setLoadingHawl(false); }
  };

  const loadZakatHistory = async () => {
    setLoadingMain(true);
    const result = await zakatService.getZakatAnnuelHistory(user.id);
    if (result.success) setZakatHistory(result.data);
    setLoadingMain(false);
  };

  const loadActifs = async () => {
    setLoadingActifs(true);
    try {
      const { data, error } = await supabase.from("zakat_actif").select(`*, type_zakat(nom_type, taux_zakat, unite_mesure)`).eq("utilisateur_id", user.id).eq("actif", true).order("created_at", { ascending: false });
      if (!error) setActifsHistory(data || []);
    } catch { setActifsHistory([]); } finally { setLoadingActifs(false); }
  };

  const loadPaiements = async () => {
    setLoadingPaiements(true);
    try {
      const { data, error } = await supabase.from("paiement_zakat").select(`*, zakat_annuel!inner(utilisateur_id, annee_hijri), beneficiaire(nom)`).eq("zakat_annuel.utilisateur_id", user.id).order("date_paiement", { ascending: false });
      if (!error) setPaiementsHistory(data || []);
    } catch { setPaiementsHistory([]); } finally { setLoadingPaiements(false); }
  };

  const loadCategories = async () => {
    try {
      const { data } = await supabase.from("categorie_beneficiaire").select("id, nom_francais, description, ordre_priorite, actif").eq("actif", true).order("ordre_priorite", { ascending: true });
      if (data) setCategories(data);
    } catch {}
  };

  const loadBeneficiaries = async () => {
    try {
      const { data } = await supabase.from("beneficiaire").select(`id, nom, categorie_beneficiaire_id, categorie_beneficiaire(id, nom_francais, description)`).eq("actif", true).order("nom", { ascending: true });
      if (data) setBeneficiaires(data);
    } catch {}
  };

  const loadActifsForYear = async (zakatAnnuelId) => {
    setLoadingYearActifs(true);
    try {
      const { data, error } = await supabase.from("zakat_actif").select(`*, type_zakat(nom_type, taux_zakat, unite_mesure)`).eq("zakat_annuel_id", zakatAnnuelId).order("created_at", { ascending: false });
      if (!error) setSelectedYearActifs(data || []);
    } catch { setSelectedYearActifs([]); } finally { setLoadingYearActifs(false); }
  };

  const handleRecalculateClick = async () => {
    setLoadingMain(true);
    try {
      const currentHijriYear = getCurrentHijriYear();
      const currYearData = zakatHistory.find(z => z.annee_hijri === currentHijriYear);
      if (!currYearData) { navigate("Calculator"); return; }
      setLoadingActifs(true);
      const { data, error } = await supabase.from("zakat_actif").select(`*, type_zakat(nom_type, taux_zakat, unite_mesure)`).eq("zakat_annuel_id", currYearData.id).order("created_at", { ascending: false });
      if (!error) setSelectedYearActifs(data || []);
      setSelectedYear(currYearData);
      navigate("MesActifs");
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
        const { data: actif } = await supabase.from("zakat_actif").select("zakat_annuel_id, nom_actif").eq("id", actifId).single();
        const { error: deleteError } = await supabase.from("zakat_actif").update({ actif: false }).eq("id", actifId);
        if (deleteError) throw deleteError;
        let zakatAnnuelId = actif?.zakat_annuel_id;
        if (!zakatAnnuelId) {
          const { data: r } = await supabase.from("zakat_annuel").select("id").eq("utilisateur_id", user.id).order("annee_hijri", { ascending: false }).limit(1);
          if (r?.length > 0) zakatAnnuelId = r[0].id;
        }
        if (zakatAnnuelId) {
          const result = await zakatService.recalculateZakatAnnuel(zakatAnnuelId);
          if (result.success) success(t("success"), `${t('delete')} ✓\n${t('zakat')}: ${formatCurrency(result.data.montantZakatCalcule)}`);
        } else { success(t('success'), `${t('delete')} ✓`); }
        if (selectedYear) {
          setSelectedYearActifs(prev => prev.map(a => a.id === actifId ? { ...a, actif: false, deleted_at: new Date().toISOString() } : a));
          const updatedHistory = await zakatService.getZakatAnnuelHistory(user.id);
          if (updatedHistory.success) {
            setZakatHistory(updatedHistory.data);
            const updatedYear = updatedHistory.data.find(z => z.id === selectedYear.id);
            if (updatedYear) setSelectedYear(updatedYear);
          }
        } else {
          setActifsHistory(prev => prev.map(a => a.id === actifId ? { ...a, actif: false, deleted_at: new Date().toISOString() } : a));
        }
        setTimeout(() => { loadActifs(); loadZakatHistory(); }, 300);
      } catch (error) { showError(t('error'), error.message); }
      finally { setDeletingActifId(null); }
    });
  };

  const handlePayZakat = async (amount, beneficiary, method) => {
    if (!selectedYear || !amount || !beneficiary) { showError(t("error"), t('please_fill_all_fields')); return; }
    const pa = parseFloat(amount);
    if (pa <= 0) { showError(t("error"), t("invalid_amount")); return; }
    if (pa > selectedYear.montant_restant) { showError(t("error"), t("amount_exceeds_due")); return; }
    try {
      const { error: pe } = await supabase.from("paiement_zakat").insert({ zakat_annuel_id: selectedYear.id, beneficiaire_id: beneficiary.id, montant_paye: pa, date_paiement: new Date().toISOString(), moyen_paiement: method });
      if (pe) throw pe;
      const newRem    = selectedYear.montant_restant - pa;
      const newPaid   = (selectedYear.montant_zakat_paye || 0) + pa;
      const newStatus = newRem <= 0 ? "PAYE" : "NON_PAYE";
      const { error: ue } = await supabase.from("zakat_annuel").update({ montant_zakat_paye: newPaid, montant_restant: newRem, statut: newStatus }).eq("id", selectedYear.id);
      if (ue) throw ue;
      setShowPaymentModal(false); setShowYearModal(false); setSelectedYear(null);
      setTimeout(() => success(t("success"), t("payment_recorded_successfully")), 300);
      loadZakatHistory(); loadPaiements();
    } catch (error) {
      setShowPaymentModal(false); setShowYearModal(false); setSelectedYear(null);
      setTimeout(() => showError(t("error"), error.message || t("payment_failed")), 300);
    }
  };

  // ── Status Badge ──
  const StatusBadge = ({ statut }) => {
    const cfg = {
      PAYE:     { bg: isDark ? "#0f2a1a" : COLORS.successBg,  color: isDark ? "#5fd87f" : COLORS.successText, label: t("paid") },
      NON_PAYE: { bg: isDark ? "#2a0f0f" : COLORS.dangerBg,   color: isDark ? "#f87171" : COLORS.dangerText,  label: t("unpaid") },
      EXEMPTE:  { bg: isDark ? "#1a1a2a" : "#f3f4f6",          color: isDark ? "#9ca3af" : "#6b7280",          label: t("exempt") },
    }[statut] || { bg: isDark ? "#1a1a1a" : "#f3f4f6", color: isDark ? "#9ca3af" : "#6b7280", label: statut };
    return (
      <View style={{ backgroundColor: cfg.bg, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 }}>
        <Text style={{ color: cfg.color, fontSize: 11, fontWeight: "700" }}>{cfg.label}</Text>
      </View>
    );
  };

  // ── Section divider component ──
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
        {/* Hawl Banner */}
        {loadingHawl ? (
          <View style={{ padding: 16, alignItems: "center" }}>
            <ActivityIndicator size="small" color={COLORS.primary} />
          </View>
        ) : (
          <View style={{
            backgroundColor: hawlStatus.completed
              ? (isDark ? "#0f2a1a" : "#eaf6ea")
              : (isDark ? "#2a1e00" : COLORS.warningBg),
            borderRadius: 14, padding: 14, marginBottom: 16,
            flexDirection: "row", alignItems: "center",
            borderLeftWidth: 4,
            borderLeftColor: hawlStatus.completed ? (isDark ? "#4daf52" : COLORS.primary) : COLORS.warning,
          }}>
            {hawlStatus.completed
              ? <CheckCircle size={22} color={isDark ? "#4daf52" : COLORS.primary} />
              : <Clock size={22} color={COLORS.warning} />}
            <View style={{ marginLeft: 12, flex: 1 }}>
              <Text style={{ color: hawlStatus.completed ? (isDark ? "#4daf52" : COLORS.primary) : COLORS.warning, fontWeight: "700", fontSize: 14 }}>
                {hawlStatus.completed ? t("hawl_completed") : t("hawl_not_completed")}
              </Text>
              {!hawlStatus.completed && hawlStatus.daysRemaining > 0 && (
                <Text style={{ color: isDark ? "#e5a83b" : COLORS.warningText, fontSize: 12, marginTop: 2 }}>
                  {hawlStatus.daysRemaining} {t("days_remaining")}
                </Text>
              )}
            </View>
          </View>
        )}

        {/* Current Year Card */}
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

        {/* History */}
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

              <View style={{ flexDirection: "row", justifyContent: "space-between", backgroundColor: th.card2(), borderRadius: 10, padding: 12, marginBottom: 12 }}>
                <View style={{ alignItems: "center" }}>
                  <Text style={{ color: th.textTer(), fontSize: 10, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.3, marginBottom: 3 }}>{t("net_worth")}</Text>
                  <Text style={{ color: th.text(), fontWeight: "600", fontSize: 13 }}>{formatCurrency(item.montant_imposable || 0)}</Text>
                </View>
                <View style={{ width: 1, backgroundColor: th.border() }} />
                <View style={{ alignItems: "center" }}>
                  <Text style={{ color: th.textTer(), fontSize: 10, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.3, marginBottom: 3 }}>{t("zakat_due_label")}</Text>
                  <Text style={{ color: th.primary(), fontWeight: "800", fontSize: 14 }}>{formatCurrency(item.montant_zakat_calcule || 0)}</Text>
                </View>
                {item.montant_zakat_paye > 0 && (
                  <>
                    <View style={{ width: 1, backgroundColor: th.border() }} />
                    <View style={{ alignItems: "center" }}>
                      <Text style={{ color: th.textTer(), fontSize: 10, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.3, marginBottom: 3 }}>{t("paid")}</Text>
                      <Text style={{ color: isDark ? "#5fd87f" : COLORS.success, fontWeight: "700", fontSize: 13 }}>{formatCurrency(item.montant_zakat_paye)}</Text>
                    </View>
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
                {item.statut === "NON_PAYE" && item.montant_restant > 0 && (
                  <TouchableOpacity
                    style={{ flex: 1, backgroundColor: th.primary(), borderRadius: 10, padding: 10, alignItems: "center" }}
                    onPress={() => { setSelectedYear(item); setShowPaymentModal(true); }}
                  >
                    <Text style={{ color: "#fff", fontWeight: "700", fontSize: 12 }}>{t("pay_now")}</Text>
                  </TouchableOpacity>
                )}
              </View>

              <Text style={{ color: th.textTer(), fontSize: 10, marginTop: 10, textAlign: "right" }}>
                {new Date(item.created_at).toLocaleDateString()}
              </Text>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    );
  };

  // ════════════════════════════════════════════════════════════════
  // MES ACTIFS SCREEN
  // ════════════════════════════════════════════════════════════════
  const MesActifsScreen = () => {
    const sourceActifs    = selectedYear ? selectedYearActifs : actifsHistory;
    const actifsCourants  = sourceActifs.filter(a => a.actif !== false);
    const actifsSupprimés = sourceActifs.filter(a => a.actif === false);
    const totalValue      = actifsCourants.reduce((s, a) => s + (a.valeur_totale || 0), 0);
    const isLoading       = selectedYear ? loadingYearActifs : loadingActifs;

    return (
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        {/* Summary */}
        <LinearGradient
          colors={isDark ? [COLORS.darkBg2, "#1a3a1a"] : [COLORS.primary, "#2e7d32"]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={{ borderRadius: 18, padding: 20, marginBottom: 16 }}
        >
          {selectedYear && (
            <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>
              {t('year')} {selectedYear.annee_hijri} {t('hijri_year_letter')}
            </Text>
          )}
          <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 12, fontWeight: "600" }}>{t("total_assets")}</Text>
          <Text style={{ color: isDark ? "#e8f0e8" : "#fff", fontSize: 30, fontWeight: "800", marginTop: 4 }}>
            {formatCurrency(totalValue)}
          </Text>
          <View style={{ flexDirection: "row", gap: 14, marginTop: 8 }}>
            <View style={{ backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 }}>
              <Text style={{ color: "rgba(255,255,255,0.9)", fontSize: 12, fontWeight: "600" }}>
                {actifsCourants.length} {t('assets_count')}
              </Text>
            </View>
            {actifsSupprimés.length > 0 && (
              <View style={{ backgroundColor: "rgba(255,80,80,0.2)", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 }}>
                <Text style={{ color: "rgba(255,160,160,0.95)", fontSize: 12, fontWeight: "600" }}>
                  {actifsSupprimés.length} {t('deleted_count')}
                </Text>
              </View>
            )}
          </View>
        </LinearGradient>

        {/* Add button */}
        <TouchableOpacity
          onPress={() => navigate("Calculator")}
          style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: th.primary() + "15", borderRadius: 14, padding: 14, marginBottom: 18, borderWidth: 1, borderColor: th.primary() + "40", gap: 8 }}
        >
          <Plus size={18} color={th.primary()} />
          <Text style={{ color: th.primary(), fontWeight: "700", fontSize: 14 }}>
            {selectedYear ? t('recalculate_modify') : t("add_assets")}
          </Text>
        </TouchableOpacity>

        {isLoading ? (
          <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 40 }} />
        ) : actifsCourants.length === 0 && actifsSupprimés.length === 0 ? (
          <View style={{ alignItems: "center", marginTop: 40 }}>
            <Wallet size={48} color={th.textTer()} />
            <Text style={{ color: th.textSec(), marginTop: 12, fontSize: 14 }}>{t("no_assets")}</Text>
          </View>
        ) : (
          <>
            {actifsCourants.length > 0 && (
              <>
                <SectionDivider label={`${t('active_assets').toUpperCase()} (${actifsCourants.length})`} color={th.primary()} />
                {actifsCourants.map((item) => {
                  const TypeIcon  = getTypeIcon(item.type_zakat?.nom_type);
                  const isDeleting = deletingActifId === item.id;
                  return (
                    <View key={item.id} style={{ backgroundColor: th.card(), borderRadius: 14, marginBottom: 10, padding: 14, borderWidth: 1, borderColor: th.border(), opacity: isDeleting ? 0.5 : 1 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                        <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: th.primary() + "20", alignItems: "center", justifyContent: "center" }}>
                          <TypeIcon size={20} color={th.primary()} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: th.text(), fontWeight: "600", fontSize: 14 }}>{t(getAssetTranslationKey(item.nom_actif))}</Text>
                          <Text style={{ color: th.textSec(), fontSize: 12, marginTop: 2 }}>
                            {t(getZakatTypeTranslationKey(item.type_zakat?.nom_type))} · {item.quantite} {item.type_zakat?.unite_mesure || ""}
                          </Text>
                        </View>
                        <View style={{ alignItems: "flex-end" }}>
                          <Text style={{ color: th.primary(), fontWeight: "800", fontSize: 15 }}>{formatCurrency(item.valeur_totale)}</Text>
                          <View style={{ flexDirection: "row", gap: 12, marginTop: 8 }}>
                            <TouchableOpacity onPress={() => { setSelectedActif(item); setShowActifModal(true); }} disabled={isDeleting} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                              <View style={{ backgroundColor: th.primary() + "15", borderRadius: 8, padding: 6 }}>
                                <Edit3 size={14} color={th.primary()} />
                              </View>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => handleDeleteActif(item.id)} disabled={isDeleting} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                              <View style={{ backgroundColor: isDark ? "#2a0f0f" : "#fee2e2", borderRadius: 8, padding: 6 }}>
                                {isDeleting ? <ActivityIndicator size="small" color="#ef4444" /> : <Trash2 size={14} color="#ef4444" />}
                              </View>
                            </TouchableOpacity>
                          </View>
                        </View>
                      </View>
                      <Text style={{ color: th.textTer(), fontSize: 10, marginTop: 8, textAlign: "right" }}>
                        {new Date(item.created_at).toLocaleDateString()} {t('or')} {new Date(item.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </Text>
                    </View>
                  );
                })}
              </>
            )}

            {actifsSupprimés.length > 0 && (
              <>
                <SectionDivider label={`${t('old_deleted_assets').toUpperCase()} (${actifsSupprimés.length})`} color="#ef4444" />
                {actifsSupprimés.map((item) => {
                  const TypeIcon = getTypeIcon(item.type_zakat?.nom_type);
                  // Use deleted_at if available, else fall back to updated_at or created_at
                  const deletedDate = item.deleted_at || item.updated_at || item.created_at;
                  return (
                    <View key={item.id} style={{ backgroundColor: th.card(), borderRadius: 14, marginBottom: 8, padding: 12, borderWidth: 0.5, borderColor: "#ef444430", opacity: 0.65 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                        <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: isDark ? "#2a0f0f" : "#fee2e2", alignItems: "center", justifyContent: "center" }}>
                          <TypeIcon size={17} color="#ef4444" />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: th.text(), fontWeight: "600", fontSize: 13, textDecorationLine: "line-through" }}>{t(getAssetTranslationKey(item.nom_actif))}</Text>
                          <Text style={{ color: th.textSec(), fontSize: 11, marginTop: 2 }}>
                            {t(getZakatTypeTranslationKey(item.type_zakat?.nom_type))} · {item.quantite} {item.type_zakat?.unite_mesure || ""}
                          </Text>
                        </View>
                        <View style={{ alignItems: "flex-end" }}>
                          <Text style={{ color: "#ef4444", fontWeight: "700", fontSize: 14, textDecorationLine: "line-through" }}>{formatCurrency(item.valeur_totale)}</Text>
                          <View style={{ backgroundColor: isDark ? "#2a0f0f" : "#fee2e2", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, marginTop: 4 }}>
                            <Text style={{ color: "#ef4444", fontSize: 9, fontWeight: "700" }}>{t('deleted_badge')}</Text>
                          </View>
                        </View>
                      </View>
                      {/* Deleted date */}
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 8 }}>
                        <Trash2 size={10} color="#ef4444" />
                        <Text style={{ color: "#ef4444", fontSize: 10, opacity: 0.8 }}>
                          {t('deleted_on')} {new Date(deletedDate).toLocaleDateString()} {t('at') || 'à'} {new Date(deletedDate).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </Text>
                      </View>
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
  const HistoriquePaiementsScreen = () => (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      {loadingPaiements ? (
        <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 60 }} />
      ) : paiementsHistory.length === 0 ? (
        <View style={{ alignItems: "center", marginTop: 60 }}>
          <CreditCard size={48} color={th.textTer()} />
          <Text style={{ color: th.textSec(), marginTop: 12, fontSize: 14 }}>{t("no_payments")}</Text>
        </View>
      ) : (
        paiementsHistory.map((item, i) => (
          <View key={i} style={{ backgroundColor: th.card(), borderRadius: 14, marginBottom: 10, padding: 14, borderWidth: 1, borderColor: th.border(), flexDirection: "row", alignItems: "center", gap: 12 }}>
            <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: isDark ? "#0f2a1a" : "#dcfce7", alignItems: "center", justifyContent: "center" }}>
              <CheckCircle size={20} color={isDark ? "#5fd87f" : "#166534"} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: th.text(), fontWeight: "600", fontSize: 14 }}>{item.beneficiaire?.nom || t("beneficiary")}</Text>
              <Text style={{ color: th.textSec(), fontSize: 12, marginTop: 2 }}>
                {t("year")} {item.zakat_annuel?.annee_hijri} {t("hijri_year_letter")} · {item.moyen_paiement || "—"}
              </Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={{ color: isDark ? "#5fd87f" : "#16a34a", fontWeight: "800", fontSize: 15 }}>{formatCurrency(item.montant_paye)}</Text>
              <Text style={{ color: th.textTer(), fontSize: 11, marginTop: 2 }}>{new Date(item.date_paiement).toLocaleDateString()}</Text>
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );

  // ════════════════════════════════════════════════════════════════
  // RAPPELS
  // ════════════════════════════════════════════════════════════════
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
  const showBackButton = activeScreen !== "ZakatAnnuel";

  // ════════════════════════════════════════════════════════════════
  // ACTIF EDIT MODAL
  // ════════════════════════════════════════════════════════════════
  const ActifEditModal = () => {
    const [editValue, setEditValue] = useState(selectedActif?.valeur_totale?.toString() || "");

    const handleSave = async () => {
      if (!selectedActif) return;
      const newVal = parseFloat(editValue) || 0;
      setEditingActif(true);
      try {
        await supabase.from("zakat_actif").update({ valeur_totale: newVal, valeur_unitaire: newVal / (selectedActif.quantite || 1) }).eq("id", selectedActif.id);
        let zakatId = selectedActif.zakat_annuel_id;
        if (!zakatId) {
          const { data: r } = await supabase.from("zakat_annuel").select("id").eq("utilisateur_id", user.id).order("annee_hijri", { ascending: false }).limit(1);
          if (r?.length > 0) zakatId = r[0].id;
        }
        let msg = "";
        if (zakatId) {
          const result = await zakatService.recalculateZakatAnnuel(zakatId);
          if (result.success) msg = `\n${t('zakat')}: ${formatCurrency(result.data.montantZakatCalcule)}`;
        }
        const updatedActif = { ...selectedActif, valeur_totale: newVal };
        if (selectedYear) {
          setSelectedYearActifs(prev => prev.map(a => a.id === selectedActif.id ? updatedActif : a));
          const updatedHistory = await zakatService.getZakatAnnuelHistory(user.id);
          if (updatedHistory.success) {
            setZakatHistory(updatedHistory.data);
            const updatedYear = updatedHistory.data.find(z => z.id === selectedYear.id);
            if (updatedYear) setSelectedYear(updatedYear);
          }
        } else {
          setActifsHistory(prev => prev.map(a => a.id === selectedActif.id ? updatedActif : a));
        }
        success(t("success"), `${t('edit_asset')} ✓${msg}`);
        setShowActifModal(false); setSelectedActif(null);
        setTimeout(() => { loadActifs(); loadZakatHistory(); }, 300);
      } catch (error) { showError(t('error'), error.message); }
      finally { setEditingActif(false); }
    };

    return (
      <Modal visible={showActifModal} transparent animationType="fade" onRequestClose={() => !editingActif && setShowActifModal(false)}>
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
              <Button title={t("cancel")} onPress={() => { setShowActifModal(false); setSelectedActif(null); }} variant="outline" style={{ flex: 1 }} textColor={th.textSec()} disabled={editingActif} />
              <Button
                title={editingActif ? "..." : t("save")} onPress={handleSave} style={{ flex: 1 }}
                backgroundColor={COLORS.primary} textColor="#fff" disabled={editingActif}
                icon={editingActif ? undefined : CheckCircle}
              />
            </View>
            {editingActif && (
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

  // ════════════════════════════════════════════════════════════════
  // YEAR DETAILS MODAL
  // ════════════════════════════════════════════════════════════════
  const YearDetailsModal = () => {
    if (!selectedYear) return null;
    const actifsActifs    = selectedYearActifs.filter(a => a.actif !== false);
    const actifsSupprimés = selectedYearActifs.filter(a => a.actif === false);
    const totalActifs     = actifsActifs.reduce((s, a) => s + (a.valeur_totale || 0), 0);

    return (
      <Modal visible={showYearModal} transparent animationType="slide" onRequestClose={() => setShowYearModal(false)}>
        <View style={{ flex: 1, backgroundColor: isDark ? "rgba(0,0,0,0.8)" : "rgba(0,0,0,0.6)" }}>
          <View style={{ flex: 1, marginTop: Platform.OS === "ios" ? 100 : 80, backgroundColor: th.bg(), borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingHorizontal: 16, paddingTop: 20 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
              <Text style={{ color: th.text(), fontSize: 22, fontWeight: "800" }}>{t("year")} {selectedYear.annee_hijri}</Text>
              <TouchableOpacity onPress={() => setShowYearModal(false)} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: th.card2(), alignItems: "center", justifyContent: "center" }}>
                <X size={20} color={th.text()} />
              </TouchableOpacity>
            </View>

            <View style={{ flexDirection: "row", gap: 10, marginBottom: 18 }}>
              {[
                { label: t("total_assets"),    value: formatCurrency(totalActifs),                              color: th.text() },
                { label: t("zakat_due_label"), value: formatCurrency(selectedYear.montant_zakat_calcule || 0), color: th.primary() },
              ].map((card, i) => (
                <View key={i} style={{ flex: 1, backgroundColor: th.card(), borderRadius: 14, padding: 14, borderWidth: 1, borderColor: th.border() }}>
                  <Text style={{ color: th.textTer(), fontSize: 10, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 5 }}>{card.label}</Text>
                  <Text style={{ color: card.color, fontWeight: "800", fontSize: 16 }}>{card.value}</Text>
                </View>
              ))}
              <View style={{ backgroundColor: th.card(), borderRadius: 14, padding: 14, borderWidth: 1, borderColor: th.border(), alignItems: "center", justifyContent: "center" }}>
                <StatusBadge statut={selectedYear.statut} />
              </View>
            </View>

            {loadingYearActifs ? (
              <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
                <ActivityIndicator size="large" color={COLORS.primary} />
                <Text style={{ color: th.textSec(), marginTop: 12, fontSize: 13 }}>{t('loading_short')}</Text>
              </View>
            ) : (
              <ScrollView style={{ flex: 1, marginBottom: 16 }}>
                {actifsActifs.length > 0 && (
                  <>
                    <SectionDivider label={`${t('assets').toUpperCase()} (${actifsActifs.length})`} color={th.primary()} />
                    {actifsActifs.map((item) => {
                      const TypeIcon = getTypeIcon(item.type_zakat?.nom_type);
                      return (
                        <View key={item.id} style={{ backgroundColor: th.card(), borderRadius: 12, marginBottom: 8, padding: 12, borderWidth: 1, borderColor: th.border(), flexDirection: "row", alignItems: "center", gap: 10 }}>
                          <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: th.primary() + "20", alignItems: "center", justifyContent: "center" }}>
                            <TypeIcon size={17} color={th.primary()} />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={{ color: th.text(), fontWeight: "600", fontSize: 13 }}>{t(getAssetTranslationKey(item.nom_actif))}</Text>
                            <Text style={{ color: th.textSec(), fontSize: 11, marginTop: 2 }}>{t(getZakatTypeTranslationKey(item.type_zakat?.nom_type))} · {item.quantite} {item.type_zakat?.unite_mesure || ""}</Text>
                          </View>
                          <Text style={{ color: th.primary(), fontWeight: "800", fontSize: 14 }}>{formatCurrency(item.valeur_totale)}</Text>
                        </View>
                      );
                    })}
                  </>
                )}
                {actifsSupprimés.length > 0 && (
                  <>
                    <SectionDivider label={`${t('old_deleted_assets').toUpperCase()} (${actifsSupprimés.length})`} color="#ef4444" />
                    {actifsSupprimés.map((item) => {
                      const TypeIcon = getTypeIcon(item.type_zakat?.nom_type);
                      const deletedDate = item.deleted_at || item.updated_at || item.created_at;
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
                                <Text style={{ color: "#ef4444", fontSize: 9, fontWeight: "700" }}>{t('deleted_badge')}</Text>
                              </View>
                            </View>
                          </View>
                          {/* Deleted date */}
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6 }}>
                            <Trash2 size={10} color="#ef4444" />
                            <Text style={{ color: "#ef4444", fontSize: 10, opacity: 0.8 }}>
                              {t('deleted_on')} {new Date(deletedDate).toLocaleDateString()} {t('at') || 'à'} {new Date(deletedDate).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
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

            {selectedYear.statut === "NON_PAYE" && selectedYear.montant_restant > 0 && (
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
      if (!amount || amount <= 0 || !selectedBenef) { showError(t("error"), t('amount_and_beneficiary_required')); return; }
      if (amount > selectedYear.montant_restant)     { showError(t("error"), t("amount_exceeds_due")); return; }
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
                  <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 }}>{t('payment_zakat_title')}</Text>
                  <Text style={{ color: isDark ? "#e8f0e8" : "#fff", fontSize: 20, fontWeight: "800", marginTop: 4 }}>{t('year')} {selectedYear.annee_hijri} {t('hijri_year_letter')}</Text>
                </View>
                <TouchableOpacity onPress={onClose} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center" }}>
                  <X size={18} color="#fff" />
                </TouchableOpacity>
              </View>
            </LinearGradient>

            <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
              <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 20, paddingBottom: 32 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                {/* Summary */}
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

                {/* Amount */}
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
                        <Text style={{ color: primL, fontSize: 11, fontWeight: "700" }}>{t('pay_all')}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => setPaymentAmount((selectedYear.montant_restant / 2).toFixed(2))}
                        style={{ backgroundColor: primL + "18", borderRadius: 10, padding: 10, borderWidth: 1, borderColor: primL + "40", alignItems: "center", minWidth: 60 }}>
                        <Text style={{ color: primL, fontSize: 13, fontWeight: "700" }}>½</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>

                {/* Beneficiary */}
                <View>
                  <Text style={{ fontSize: 13, fontWeight: "700", color: textL, marginBottom: 10 }}>{t('beneficiary_required')}</Text>
                  <BeneficiarySelector
                    beneficiaires={beneficiaires} categories={categories}
                    selectedBeneficiary={selectedBenef} onSelect={setSelectedBenef} onClear={() => setSelectedBenef(null)}
                    onAddBeneficiary={async (name, cat, onSuccess) => {
                      try {
                        const { data, error } = await supabase.from("beneficiaire").insert([{ nom: name, categorie_beneficiaire_id: cat.id }]).select(`id, nom, categorie_beneficiaire_id, categorie_beneficiaire(id, nom_francais, description)`);
                        if (error) throw error;
                        if (data?.length > 0) { setBeneficiaires(prev => [...prev, data[0]]); onSuccess(data[0]); }
                      } catch (e) { showError(t("error"), e.message); }
                    }}
                    getCategoryColor={getCategoryColor} t={t} isDark={isDark}
                  />
                </View>

                {/* Method */}
                <View>
                  <Text style={{ fontSize: 13, fontWeight: "700", color: textL, marginBottom: 10 }}>{t("payment_method")}</Text>
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    {[
                      { id: "transfer", label: t('payment_transfer'), emoji: "🏦" },
                      { id: "card",     label: t('payment_card'),     emoji: "💳" },
                      { id: "cash",     label: t('payment_cash'),     emoji: "💵" },
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

            {/* Footer */}
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

  // ════════════════════════════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════════════════════════════
  return (
    <View style={{ flex: 1, backgroundColor: th.bg() }}>
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
              onPress={openDrawer}
              style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: th.primary() + "20", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: th.primary() + "30" }}
            >
              <Menu size={20} color={th.primary()} />
            </TouchableOpacity>
          )}
          <View style={{ flex: 1 }}>
            <Text style={{ color: th.text(), fontSize: 20, fontWeight: "800" }}>{getScreenTitle()}</Text>
            {activeScreen === "ZakatAnnuel" && (
              <Text style={{ color: th.primary(), fontSize: 11, fontWeight: "600" }}>{t("according_to_maliki_school")}</Text>
            )}
            {activeScreen === "MesActifs" && selectedYear && (
              <Text style={{ color: isDark ? COLORS.goldLight : COLORS.gold, fontSize: 11, fontWeight: "600" }}>
                {t('filtered_year')} {selectedYear.annee_hijri} {t('hijri_year_letter')}
              </Text>
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
        {activeScreen === "Calculator"          && <ZakatCalculatorScreen />}
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
                  <Text style={{ color: "rgba(255,255,255,0.65)", fontSize: 12, marginTop: 2 }}>{t('maliki_subtitle')}</Text>
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
                بِسْمِ اللهِ الرَّحْمٰنِ الرَّحِيْمِ
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
        onPay={async ({ amount, beneficiary, method }) => { await handlePayZakat(amount, beneficiary, method); }}
        formatCurrency={formatCurrency}
        getCategoryColor={getCategoryColor}
        t={t}
        isDark={isDark}
      />
    </View>
  );
};

export default ZakatMainScreen;