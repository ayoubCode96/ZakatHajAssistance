import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
} from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Dimensions,
  RefreshControl,
  Modal,
  Animated,
  Platform,
  KeyboardAvoidingView,
  ActivityIndicator,
} from "react-native";
import { useAppTranslation } from "../hooks/useTranslation";
import { useTheme } from "../context/ThemeContext";
import { useCurrency } from "../context/CurrencyContext";
import { useAlert } from "../context/AlertContext";
import { zakatService } from "../services/zakatService";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../services/supabase";
import metalPriceService from "../services/metalPriceService";
import nisabService from "../services/nisabService";
import hawlService from "../services/hawlService";
import {
  Calculator,
  Coins,
  Gem,
  DollarSign,
  TrendingUp,
  Scale,
  Clock,
  CheckCircle,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Info,
  BookOpen,
  Banknote,
  Warehouse,
  CreditCard,
  Leaf,
  Gem as Diamond,
  Package,
  Building,
  Wallet,
  ShoppingCart,
  Percent,
  Target,
  Crown,
  Sparkles,
  Bike,
  Receipt,
  Settings,
  Sliders,
  MapPin,
  RefreshCw,
} from "lucide-react-native";
import InputField from "../components/InputField";
import Button from "../components/Button";
import {
  getHawlStatus,
  getCurrentHijriYear,
  getNisabBaseLabel,
} from "../utils/zakatUtils";
import { LinearGradient } from "expo-linear-gradient";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

// ─── DESIGN TOKENS ────────────────────────────────────────────────
const COLORS = {
  primary: "#1a5d1a",
  primaryLight: "#2e7d32",
  primaryDark: "#0d3d0d",
  primaryMuted: "#4a8c4a",
  gold: "#c9991a",
  goldLight: "#d4af37",
  goldPale: "#f5e99a",
  accent: "#8b4513",
  success: "#16a34a",
  successBg: "#dcfce7",
  successText: "#14532d",
  warning: "#d97706",
  warningBg: "#fef3c7",
  warningText: "#92400e",
  danger: "#dc2626",
  dangerBg: "#fee2e2",
  dangerText: "#991b1b",
  lightBg: "#f0f7f0",
  lightBg2: "#e8f2e8",
  lightCard: "#ffffff",
  lightBorder: "#c8ddc8",
  lightText: "#1a2a1a",
  lightTextSec: "#4a6b4a",
  lightTextTer: "#7a9b7a",
  darkBg: "#0c1f0c",
  darkBg2: "#112011",
  darkCard: "#172317",
  darkCard2: "#1e2e1e",
  darkBorder: "#2a3f2a",
  darkText: "#e8f0e8",
  darkTextSec: "#9ebf9e",
  darkTextTer: "#6a8f6a",
};

// Bases nisab disponibles (4 options Malékites)
const NISAB_BASES = [
  {
    id: "or_24k",
    label: "Or 24K",
    sublabel: "85g",
    metal: "OR",
    purete: "24k",
    color: COLORS.goldLight,
  },
  {
    id: "or_20k",
    label: "Or 20K",
    sublabel: "85g",
    metal: "OR",
    purete: "20k",
    color: COLORS.gold,
  },
  {
    id: "or_18k",
    label: "Or 18K",
    sublabel: "85g",
    metal: "OR",
    purete: "18k",
    color: COLORS.accent,
  },
  {
    id: "argent",
    label: "Argent",
    sublabel: "595g",
    metal: "ARGENT",
    purete: null,
    color: "#9e9e9e",
  },
];

const ZakatCalculatorScreen = ({ onSaveSuccess }) => {
  const { t, currentLanguage, isRTL } = useAppTranslation();
  const { currentTheme } = useTheme();
  const { alert, success, error: showError, confirm } = useAlert();
  const { userCurrency, formatCurrency, refreshData, userCountry } =
    useCurrency();
  const { user } = useAuth();

  const isDark = currentTheme === "dark";

  const th = {
    bg: () => (isDark ? COLORS.darkBg : COLORS.lightBg),
    bg2: () => (isDark ? COLORS.darkBg2 : COLORS.lightBg2),
    card: () => (isDark ? COLORS.darkCard : COLORS.lightCard),
    card2: () => (isDark ? COLORS.darkCard2 : "#f7faf7"),
    border: () => (isDark ? COLORS.darkBorder : COLORS.lightBorder),
    text: () => (isDark ? COLORS.darkText : COLORS.lightText),
    textSec: () => (isDark ? COLORS.darkTextSec : COLORS.lightTextSec),
    textTer: () => (isDark ? COLORS.darkTextTer : COLORS.lightTextTer),
    primaryColor: () => (isDark ? "#4daf52" : COLORS.primary),
    nisabBg: () => (isDark ? "#1a2e1a" : "#eef7ee"),
    nisabText: () => (isDark ? "#7fba7f" : "#1a5d1a"),
    hawlBg: () => (isDark ? "#2a1e00" : COLORS.warningBg),
    hawlText: () => (isDark ? "#f5c542" : COLORS.warning),
    gradientDue: () =>
      isDark ? [COLORS.darkBg2, "#1a3a1a"] : ["#eaf6ea", "#d4ecce"],
    gradientHawl: () =>
      isDark ? ["#2a1e00", "#3a2800"] : [COLORS.warningBg, "#fde68a"],
    gradientNisab: () =>
      isDark ? [COLORS.darkBg2, "#1a2e1a"] : ["#eef7ee", "#d8edd8"],
    gradientNone: () =>
      isDark ? [COLORS.darkCard, COLORS.darkCard2] : ["#f4f9f4", "#e8f2e8"],
    gradientNisabHawl: () =>
      isDark ? ["#1a1a00", "#2a2800"] : ["#fffbeb", "#fef3c7"],
  };

  // ── State ──────────────────────────────────────────────────────
  const [saving, setSaving] = useState(false);
  const [prefillLoading, setPrefillLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingPrices, setLoadingPrices] = useState(false);
  const [loadingNisab, setLoadingNisab] = useState(false);

  const [showResultsModal, setShowResultsModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showConfirmUpdateModal, setShowConfirmUpdateModal] = useState(false);
  const [existingZakatInfo, setExistingZakatInfo] = useState(null);
  const [existingZakatId, setExistingZakatId] = useState(null);

  const [dbPrices, setDbPrices] = useState(null);
  const [pricesLoaded, setPricesLoaded] = useState(false);
  const [pricesSource, setPricesSource] = useState(null);
  const [pricesDate, setPricesDate] = useState(null);

  const [nisabInfo, setNisabInfo] = useState(null);
  const [nisabCheck, setNisabCheck] = useState(null);
  const [hawlResult, setHawlResult] = useState(null);
  const [nisabsDB, setNisabsDB] = useState(null);
  const [prixBetail, setPrixBetail] = useState(null);
  const [hawlStatus, setHawlStatus] = useState({
    completed: false,
    daysRemaining: 354,
    nextAnniversary: null,
    message: "not_started",
    daysElapsed: 0,
    progressPercent: 0,
    dateDebut: null,
    montantDebut: 0,
  });

const [showHawlInterruptConfirm, setShowHawlInterruptConfirm] = useState(false);
const [pendingHawlInterruptData, setPendingHawlInterruptData] = useState(null);
  const [persistedDebts, setPersistedDebts] = useState(0);

  const [activeTab, setActiveTab] = useState("money");
  const [expandedSections, setExpandedSections] = useState({
    money: true,
    metals: false,
    trade: false,
    agriculture: false,
    livestock: false,
    debts: false,
    other: false,
  });

  const defaultFormData = {
    cash: "",
    savings: "",
    currentAccounts: "",
    fixedDeposits: "",
    goldWeight: "",
    goldPurity: "24k",
    silverWeight: "",
    silverPurity: "925",
    tradeGoodsValue: "",
    businessInventory: "",
    rentalProperties: "",
    vehiclesValue: "",
    cropsWeight: "",
    irrigationType: "rain",
    cropsMarketValue: "",
    camelsCount: "",
    cowsCount: "",
    goatsCount: "",
    sheepCount: "",
    receivables: "",
    doubtfulReceivables: "",
    debts: "",
    miningOutput: "",
    foundTreasure: "",
    nisabBase: "or_24k",
    includeAllReceivables: false,
    includeAllProperties: true,
  };

  const [formData, setFormData] = useState(defaultFormData);
  const [results, setResults] = useState(null);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const calculateTimeoutRef = useRef(null);
  const scrollViewRef = useRef(null);
  // ✅ FIX : flag pour éviter la boucle de recalcul
  const recalculRunning = useRef(false);

  // ── Chargement prix depuis BDD ──────────────────────────────────
  useEffect(() => {
    loadPricesFromDB();
    loadNisabsAndBetail();
  }, [userCurrency]);
  const loadNisabsAndBetail = async () => {
    try {
      const devise = userCurrency || "MAD";

      // Charger tous les nisabs
      const nisabResult = await nisabService.getAllNisabs();
      if (nisabResult.success) {
        setNisabsDB(nisabResult.nisabs);
      }

      // Charger les prix bétail depuis BDD
      const betailResult = await nisabService.getPrixBetail(devise);
      if (betailResult.success) {
        setPrixBetail(betailResult.prixBetail);
      }
    } catch (e) {
      console.error("[ZakatCalculator] loadNisabsAndBetail:", e);
    }
  };

  const loadPricesFromDB = async () => {
    setLoadingPrices(true);
    try {
      const devise = userCurrency || "MAD";
      const result = await metalPriceService.getPricesForZakatCalc(devise);
      if (result.success) {
        setDbPrices(result.prices);
        setPricesSource(result.source);
        setPricesDate(result.lastUpdated);
      } else {
        setDbPrices(result.prices);
      }
      setPricesLoaded(true);
    } catch (e) {
      console.error("[ZakatCalculator] loadPricesFromDB:", e);
      setPricesLoaded(true);
    } finally {
      setLoadingPrices(false);
    }
  };

  const currentPrices = useMemo(() => {
    if (dbPrices) return dbPrices;
    return {
      gold: 650,
      gold24k: 650,
      gold20k: parseFloat((650 * (20 / 24)).toFixed(4)),
      gold18k: parseFloat((650 * 0.75).toFixed(4)),
      gold21k: parseFloat((650 * 0.875).toFixed(4)),
      silver: 8.5,
      silver999: 8.5,
      silver925: parseFloat((8.5 * 0.925).toFixed(4)),
    };
  }, [dbPrices]);

  // ══════════════════════════════════════════════════════════════
  // ✅ FIX CRITIQUE : calculateMalikiZakat
  //    - Applique la règle min(montantDebut, netWorth) {t("close_button_char")} 2.5%
  //    - Retourne montantPourZakat (requis par saveZakatAnnuel)
  //    - persistedDebts fallback si formData.debts vide
  // ══════════════════════════════════════════════════════════════
  const calculateMalikiZakat = useCallback(
    (currentFormData = formData) => {
      const p = (val) => Math.max(0, parseFloat(val || 0));

      // ── 1. ARGENT LIQUIDE & ÉPARGNE ────────────────────────────
      const totalMoney =
        p(currentFormData.cash) +
        p(currentFormData.savings) +
        p(currentFormData.currentAccounts) +
        p(currentFormData.fixedDeposits);

      // ── 2. MÉTAUX PRÉCIEUX ─────────────────────────────────────
      const goldWeight = p(currentFormData.goldWeight);
      const goldPrice =
        currentFormData.goldPurity === "24k"
          ? currentPrices.gold24k
          : currentFormData.goldPurity === "21k"
            ? currentPrices.gold21k
            : currentFormData.goldPurity === "20k"
              ? currentPrices.gold20k
              : currentPrices.gold18k;
      const goldValue = goldWeight > 0 ? goldWeight * goldPrice : 0;

      const silverPrice =
        currentFormData.silverPurity === "999"
          ? currentPrices.silver999
          : currentPrices.silver925;
      const silverValue =
        p(currentFormData.silverWeight) > 0
          ? p(currentFormData.silverWeight) * silverPrice
          : 0;

      // ── 3. COMMERCE & IMMOBILIER ───────────────────────────────
      const totalTradeGoods =
        p(currentFormData.tradeGoodsValue) +
        p(currentFormData.businessInventory) +
        p(currentFormData.rentalProperties) +
        p(currentFormData.vehiclesValue);

      // ── 4. AGRICULTURE ─────────────────────────────────────────
      const cropsWeight = p(currentFormData.cropsWeight);
      const cropsValue =
        cropsWeight > 0
          ? p(currentFormData.cropsMarketValue) || cropsWeight * 0.5
          : 0;

      // ── 5. BÉTAIL ──────────────────────────────────────────────
      // Seuils Nisab depuis nisab_zakat BDD
      const seuilChameaux = nisabsDB?.BETAIL?.montant_nisab ?? 5;
      const seuilBovins = nisabsDB?.CREANCES?.montant_nisab ?? 30;
      const seuilOvins = 40; // consensus Malékite

      // Nombre de têtes saisi par l'utilisateur
      const camels = p(currentFormData.camelsCount);
      const cows = p(currentFormData.cowsCount);
      const goats = p(currentFormData.goatsCount);
      const sheep = p(currentFormData.sheepCount);
      const ovins = goats + sheep;

      // Vérification Nisab PAR ESPÈCE depuis BDD
      const chameauxNisabOk = camels >= seuilChameaux;
      const bovinsNisabOk = cows >= seuilBovins;
      const ovinsNisabOk = ovins >= seuilOvins;
      const nisabBetailOk = chameauxNisabOk || bovinsNisabOk || ovinsNisabOk;

      // Prix unitaires depuis BDD (table prix_betail) — zéro hardcodé
const prixChameau = prixBetail?.CHAMEAU?.prix_unitaire ?? 2500;
const prixVache   = prixBetail?.VACHE?.prix_unitaire   ?? 1200;
const prixChevre  = prixBetail?.CHEVRE?.prix_unitaire  ?? 150;
const prixMouton  = prixBetail?.MOUTON?.prix_unitaire  ?? 120;

      // Valeur bétail = nombre {t("close_button_char")} prix BDD
      // Incluse SEULEMENT si l'espèce dépasse son nisab
      const livestockValue =
        (chameauxNisabOk ? camels * prixChameau : 0) +
        (bovinsNisabOk ? cows * prixVache : 0) +
        (ovinsNisabOk ? goats * prixChevre + sheep * prixMouton : 0);

      // ── 6. CRÉANCES ────────────────────────────────────────────
      const totalReceivables = currentFormData.includeAllReceivables
        ? p(currentFormData.receivables) +
          p(currentFormData.doubtfulReceivables)
        : p(currentFormData.receivables);

      // ── 7. MINES & RIKAZ ───────────────────────────────────────
      const miningOutput = p(currentFormData.miningOutput);
      const foundTreasure = p(currentFormData.foundTreasure);

      // ── 8. TOTAL ACTIFS & PATRIMOINE NET ──────────────────────
      const totalAssets =
        totalMoney +
        goldValue +
        silverValue +
        totalTradeGoods +
        cropsValue +
        livestockValue +
        totalReceivables +
        miningOutput +
        foundTreasure;

      const formDebts = p(currentFormData.debts);
      const totalDeductions = formDebts > 0 ? formDebts : persistedDebts;
      const netWorth = Math.max(0, totalAssets - totalDeductions);

      // ── 9. SEUIL NISAB MONÉTAIRE ───────────────────────────────
      let nisabThreshold;
      if (nisabInfo?.success && nisabInfo.threshold > 0) {
        nisabThreshold = nisabInfo.threshold;
      } else {
        const base = currentFormData.nisabBase;
        switch (base) {
          case "or_24k":
            nisabThreshold = 85 * currentPrices.gold24k;
            break;
          case "or_20k":
            nisabThreshold = 85 * currentPrices.gold20k;
            break;
          case "or_18k":
            nisabThreshold = 85 * currentPrices.gold18k;
            break;
          case "argent":
            nisabThreshold = 595 * currentPrices.silver999;
            break;
          default:
            nisabThreshold = 85 * currentPrices.gold24k;
        }
      }

      // ── 10. NISAB & HAWL ───────────────────────────────────────
      const isNisabReached = netWorth >= nisabThreshold;
      const hawlCompleted = hawlStatus.completed;
      const montantDebutHawl = hawlStatus.montantDebut || 0;

      // ── 11. RÈGLE MALÉKITE : min(début, fin) {t("close_button_char")} 2.5% ───────────
      let montantPourZakat = netWorth;
      if (isNisabReached && montantDebutHawl > 0) {
        montantPourZakat = Math.min(montantDebutHawl, netWorth);
      }

      const zakatAmount = isNisabReached ? montantPourZakat * 0.025 : 0;

      return {
        totalAssets,
        totalDeductions,
        netWorth,
        nisabThreshold,
        isNisabReached,
        hawlCompleted,
        montantPourZakat,
        zakatAmount,
        zakatAmountDue: hawlCompleted && isNisabReached ? zakatAmount : 0,
        isZakatDue: hawlCompleted && isNisabReached && zakatAmount > 0,
        // ── Détail bétail
        nisabBetailOk,
        livestockValue,
        betailDetails: {
          chameaux: {
            count: camels,
            nisabOk: chameauxNisabOk,
            seuil: seuilChameaux,
            prixUnit: prixChameau,
          },
          bovins: {
            count: cows,
            nisabOk: bovinsNisabOk,
            seuil: seuilBovins,
            prixUnit: prixVache,
          },
          ovins: {
            count: ovins,
            nisabOk: ovinsNisabOk,
            seuil: seuilOvins,
            prixUnit: null,
          },
          chevre: { count: goats, prixUnit: prixChevre },
          mouton: { count: sheep, prixUnit: prixMouton },
        },
      };
    },
    [
      formData,
      currentPrices,
      hawlStatus,
      nisabInfo,
      persistedDebts,
      nisabsDB,
      prixBetail,
    ],
  );

  // ── Recalcul automatique ───────────────────────────────────────
  useEffect(() => {
    if (calculateTimeoutRef.current) clearTimeout(calculateTimeoutRef.current);
    calculateTimeoutRef.current = setTimeout(() => {
      setResults(calculateMalikiZakat(formData));
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }, 400);
    return () => {
      if (calculateTimeoutRef.current)
        clearTimeout(calculateTimeoutRef.current);
    };
  }, [formData, hawlStatus, nisabInfo, currentPrices, persistedDebts]);

  // ── Chargement hawl ─────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      if (!user) return;
      try {
        const status = await hawlService.loadHawlStatusForUser(user.id);
        setHawlStatus({
          completed: status.completed,
          daysRemaining: status.daysRemaining,
          nextAnniversary: status.nextAnniversary,
          message: status.message,
          daysElapsed: status.daysElapsed,
          progressPercent: status.progressPercent,
          dateDebut: status.dateDebut,
          montantDebut: status.montantDebut || 0,
        });
      } catch {
        setHawlStatus({
          completed: false,
          daysRemaining: 354,
          nextAnniversary: null,
          message: "not_started",
          daysElapsed: 0,
          progressPercent: 0,
          dateDebut: null,
          montantDebut: 0,
        });
      }
    };
    load();
  }, [user]);

  // ── Recalcul nisab + hawl ──────────────────────────────────────
  // ✅ FIX : guard recalculRunning pour éviter la boucle de dépendance
  useEffect(() => {
    if (!pricesLoaded || results === null || !user?.id || prefillLoading)
      return;

    const netWorth = results?.netWorth ?? 0;
    const timer = setTimeout(() => {
      recalculNisabHawl(netWorth);
    }, 1000);
    return () => clearTimeout(timer);
  }, [formData.nisabBase, results?.netWorth, pricesLoaded, prefillLoading]);

const recalculNisabHawl = async (montantImposable) => {
  if (!user?.id || !pricesLoaded) return;
  if (recalculRunning.current) return;
  recalculRunning.current = true;

  const devise = userCurrency || "MAD";
  setLoadingNisab(true);
  try {
    const nisab = await nisabService.computeNisabThreshold(
      formData.nisabBase,
      devise,
    );
    setNisabInfo(nisab);

    const check = nisabService.checkNisab(
      montantImposable,
      nisab.success ? nisab.threshold : 0,
    );
    setNisabCheck(check);

    if (nisab.success && montantImposable > 0) {
      // ✅ Si nisab perdu + hawl actif → NE PAS interrompre ici
      // L'interruption sera proposée uniquement à la sauvegarde
      if (!check.depasse && hawlStatus.message !== "not_started") {
        setHawlResult(null);
      } else {
        const hawl = await hawlService.checkAndUpdateHawlGlobal(
          user.id,
          montantImposable,
          formData.nisabBase,
          devise,
        );
        setHawlResult(hawl);

        if (hawl.action === "hawl_completed_zakat_due") {
          success(
            t("hawl_completed"),
            t("zakat_now_obligatory"),
          );
        }
      }
    } else {
      setHawlResult(null);
    }

    const updatedStatus = await hawlService.loadHawlStatusForUser(user.id);
    setHawlStatus({
      completed: updatedStatus.completed,
      daysRemaining: updatedStatus.daysRemaining,
      nextAnniversary: updatedStatus.nextAnniversary,
      message: updatedStatus.message,
      daysElapsed: updatedStatus.daysElapsed,
      progressPercent: updatedStatus.progressPercent,
      dateDebut: updatedStatus.dateDebut,
      montantDebut: updatedStatus.montantDebut || 0,
    });
  } catch (e) {
    console.error("[ZakatCalculator] recalculNisabHawl:", e);
  } finally {
    setLoadingNisab(false);
    recalculRunning.current = false;
  }
};
  // ── Préfill actifs existants ───────────────────────────────────
  useEffect(() => {
    const prefill = async () => {
      if (!user) return;
      setPrefillLoading(true);
      try {
        const result = await zakatService.loadExistingActifsForYear(user.id);
        if (result.success && result.data?.length > 0) {
          setExistingZakatId(result.zakatAnnuelId || null);

          const montantDettes = result.montantDettes || 0;
          setPersistedDebts(montantDettes);

          // ✅ FIX : actifsToFormData reçoit montantDettes → formData.debts initialisé
          const fd = zakatService.actifsToFormData(result.data, montantDettes);

          if (result.nisabBase) {
            fd.nisabBase = result.nisabBase;
          } else {
            if (fd.nisabBase === "gold") fd.nisabBase = "or_24k";
            if (fd.nisabBase === "silver") fd.nisabBase = "argent";
          }
          setFormData((prev) => ({ ...prev, ...fd }));
        }
      } catch (e) {
        console.error("[ZakatCalculator] prefill:", e);
      } finally {
        setPrefillLoading(false);
      }
    };
    prefill();
  }, [user]);

  // ── Sauvegarde ────────────────────────────────────────────────
  const handleSaveCalculation = async () => {
    if (!user) {
      showError(t("error"), t("login_to_save"));
      return;
    }
    if (!results || results.netWorth === 0) {
      showError(t("error"), t("no_calculation_to_save"));
      return;
    }
    setSaving(true);
    try {
      const checkResult = await zakatService.checkExistingZakatForCurrentYear(
        user.id,
      );
      if (checkResult.exists && checkResult.data) {
        setExistingZakatInfo(checkResult.data);
        setShowConfirmUpdateModal(true);
        setSaving(false);
        return;
      }
      await _doSave();
    } catch (err) {
      showError(t("error"), err.message);
      setSaving(false);
    }
  };

const _doSave = async () => {
  setSaving(true);
  try {
    const currentResults = calculateMalikiZakat(formData);

    // ✅ Si nisab perdu + hawl actif → confirmation unique ici
    if (!currentResults.isNisabReached && hawlStatus.message !== "not_started") {
      const { data: hawlActif } = await hawlService.getActiveHawlGlobal(user.id);
      if (hawlActif) {
        setSaving(false);
        confirm(
          t("hawl_interrupt_confirm_title"),
          t("hawl_interrupt_confirm_message"),
          async () => {
            // Confirmé → sauvegarder normalement (saveCompleteCalculation gère l'interruption)
            setSaving(true);
            try {
              const saveResult = await zakatService.saveCompleteCalculation(
                user.id,
                formData,
                currentResults,
                currentPrices,
                prixBetail  
              );
              if (!saveResult.success) throw new Error(saveResult.error);
              const reloaded = await zakatService.loadExistingActifsForYear(user.id);
              if (reloaded.success && reloaded.zakatAnnuelId) {
                setExistingZakatId(reloaded.zakatAnnuelId);
              }
              success(t("success"), t("calculation_saved_zakat"));
              if (typeof onSaveSuccess === "function") {
                setTimeout(() => onSaveSuccess({ isZakatDue: false, zakatAmount: 0 }), 800);
              }
            } catch (err) {
              showError(t("error"), err.message);
            } finally {
              setSaving(false);
            }
          },
          () => setSaving(false), // Annulé → rien ne se passe
        );
        return;
      }
    }

    // Cas normal
    const saveResult = await zakatService.saveCompleteCalculation(
      user.id,
      formData,
      currentResults,
      currentPrices,
      prixBetail
    );
    if (!saveResult.success) throw new Error(saveResult.error);

    const reloaded = await zakatService.loadExistingActifsForYear(user.id);
    if (reloaded.success && reloaded.zakatAnnuelId) {
      setExistingZakatId(reloaded.zakatAnnuelId);
    }

    const msg = currentResults.isZakatDue
      ? `${t("zakat_due_label")} : ${formatCurrency(currentResults.zakatAmountDue || currentResults.zakatAmount)}`
      : t("calculation_saved_zakat");
    success(t("success"), msg);

    setTimeout(() => {
      if (typeof onSaveSuccess === "function") {
        onSaveSuccess({
          isZakatDue: currentResults.isZakatDue,
          zakatAmount: currentResults.zakatAmountDue || currentResults.zakatAmount,
          zakatAnnuelId: reloaded.zakatAnnuelId,
        });
      }
    }, 800);
  } catch (err) {
    showError(t("error"), err.message);
  } finally {
    setSaving(false);
  }
};

  const handleInputChange = useCallback((field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }, []);

  const resetCalculator = () => {
    setFormData(defaultFormData);
    setExistingZakatId(null);
    setPersistedDebts(0);
    setNisabInfo(null);
    setNisabCheck(null);
    setHawlResult(null);
    fadeAnim.setValue(0);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    metalPriceService.clearCache();
    nisabService.clearNisabCache();
    await loadPricesFromDB();
    await loadNisabsAndBetail();
    await refreshData();
    setRefreshing(false);
  };

  // ── Status bar config ─────────────────────────────────────────
  const getStatusConfig = () => {
    if (!results)
      return {
        gradient: th.gradientNone(),
        borderColor: th.border(),
        icon: Info,
        iconColor: th.textTer(),
        label: t("enter_data"),
        labelColor: th.textTer(),
      };

    if (!results.isNisabReached)
      return {
        gradient: th.gradientNisab(),
        borderColor: th.nisabText(),
        icon: AlertCircle,
        iconColor: th.nisabText(),
        label: t("nisab_not_reached"),
        labelColor: th.nisabText(),
      };

    if (results.isZakatDue)
      return {
        gradient: th.gradientDue(),
        borderColor: th.primaryColor(),
        icon: CheckCircle,
        iconColor: th.primaryColor(),
        label: t("zakat_due"),
        labelColor: th.primaryColor(),
      };

    if (results.isNisabReached && !results.hawlCompleted)
      return {
        gradient: th.gradientNisabHawl(),
        borderColor: COLORS.gold,
        icon: Clock,
        iconColor: COLORS.gold,
        label:
          t("nisab_reached_hawl_pending"),
        labelColor: COLORS.gold,
      };

    return {
      gradient: th.gradientNone(),
      borderColor: th.border(),
      icon: Info,
      iconColor: th.textTer(),
      label: t("no_zakat_due"),
      labelColor: th.textTer(),
    };
  };

  if (prefillLoading || loadingPrices) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: th.bg(),
          justifyContent: "center",
          alignItems: "center",
          writingDirection: isRTL ? "rtl" : "ltr",
        }}
      >
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={{ color: th.textSec(), marginTop: 14, fontSize: 14 }}>
          {loadingPrices
            ? t("loading_prices")
            : t("loading_data")}
        </Text>
      </View>
    );
  }

  const statusCfg = getStatusConfig();
  const StatusIcon = statusCfg.icon;

  const displayPrice24k = currentPrices.gold24k;
  const displayPrice20k = currentPrices.gold20k;
  const displayPrice18k = currentPrices.gold18k;
  const displaySilver = currentPrices.silver999;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: th.bg(), writingDirection: isRTL ? "rtl" : "ltr" }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <StatusBar
        backgroundColor={th.bg()}
        barStyle={isDark ? "light-content" : "dark-content"}
      />

      {saving && (
        <View
          style={[
            styles.savingOverlay,
            {
              backgroundColor: isDark ? "rgba(0,0,0,0.7)" : "rgba(0,0,0,0.4)",
            },
          ]}
        >
          <View
            style={[
              styles.savingBox,
              {
                backgroundColor: th.card(),
                borderColor: th.border(),
                borderWidth: 1,
              },
            ]}
          >
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text
              style={{
                color: th.text(),
                marginTop: 14,
                fontWeight: "600",
                fontSize: 15,
              }}
            >
              {t("saving_in_progress")}
            </Text>
          </View>
        </View>
      )}

      {/* ── Barre de résultats fixe ── */}
      <Animated.View style={[styles.fixedResultsBar, { opacity: fadeAnim }]}>
        <LinearGradient
          colors={statusCfg.gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            styles.fixedResultsContent,
            {
              borderColor: statusCfg.borderColor,
              shadowColor: isDark ? "#000" : statusCfg.borderColor,
            },
          ]}
        >
          <View style={styles.fixedResultsHeader}>
            <View style={styles.fixedResultsStatus}>
              <View
                style={[
                  styles.statusIconBubble,
                  {
                    backgroundColor:
                      statusCfg.iconColor + (isDark ? "25" : "18"),
                  },
                ]}
              >
                <StatusIcon size={15} color={statusCfg.iconColor} />
              </View>
              <Text
                style={[
                  styles.fixedStatusText,
                  { color: statusCfg.labelColor },
                ]}
              >
                {statusCfg.label}
              </Text>
              {existingZakatId && (
                <View
                  style={[
                    styles.existingBadge,
                    {
                      backgroundColor: isDark
                        ? COLORS.gold + "30"
                        : COLORS.goldPale,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.existingBadgeText,
                      {
                        color: isDark ? COLORS.goldLight : COLORS.gold,
                      },
                    ]}
                  >
                    {t("update_badge")}
                  </Text>
                </View>
              )}
              {nisabInfo?.success && (
                <View
                  style={[
                    styles.existingBadge,
                    {
                      backgroundColor: COLORS.primary + "20",
                      marginLeft: 4,
                    },
                  ]}
                >
                  <Text
                    style={{
                      fontSize: 9,
                      fontWeight: "700",
                      color: th.primaryColor(),
                    }}
                  >
                    {getNisabBaseLabel(formData.nisabBase, currentLanguage)}
                  </Text>
                </View>
              )}
            </View>
            <TouchableOpacity
              style={[
                styles.settingsButton,
                {
                  backgroundColor: th.primaryColor() + "20",
                  borderColor: th.primaryColor() + "40",
                  borderWidth: 1,
                },
              ]}
              onPress={() => setShowSettingsModal(true)}
            >
              <Sliders size={15} color={th.primaryColor()} />
            </TouchableOpacity>
          </View>

          <View
            style={[
              styles.fixedResultsDetails,
              {
                borderTopColor: statusCfg.borderColor + "40",
                borderTopWidth: 1,
                paddingTop: 10,
                marginTop: 4,
              },
            ]}
          >
            <View style={styles.fixedDetailItem}>
              <Text style={[styles.fixedDetailLabel, { color: th.textSec() }]}>
                {t("net_worth")}
              </Text>
              <Text style={[styles.fixedDetailValue, { color: th.text() }]}>
                {results ? formatCurrency(results.netWorth) : "—"}
              </Text>
            </View>
            <View
              style={[
                styles.fixedDetailDivider,
                { backgroundColor: statusCfg.borderColor + "50" },
              ]}
            />
            <View style={styles.fixedDetailItem}>
              <Text style={[styles.fixedDetailLabel, { color: th.textSec() }]}>
                {results?.isNisabReached && !results?.hawlCompleted
                  ? t("zakat_estimated")
                  : t("zakat")}
              </Text>
              <Text
                style={[
                  styles.fixedZakatValue,
                  {
                    color: results?.isZakatDue
                      ? th.primaryColor()
                      : results?.isNisabReached && !results?.hawlCompleted
                        ? COLORS.gold
                        : th.textSec(),
                  },
                ]}
              >
                {results
                  ? results.isNisabReached
                    ? formatCurrency(results.zakatAmount)
                    : "—"
                  : "—"}
              </Text>
            </View>
            <TouchableOpacity
              style={[
                styles.fixedViewDetails,
                {
                  backgroundColor: statusCfg.iconColor + "15",
                  borderRadius: 8,
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                },
              ]}
              onPress={() => setShowResultsModal(true)}
              disabled={!results}
            >
              <Text
                style={[
                  styles.fixedViewDetailsText,
                  {
                    color: results ? statusCfg.iconColor : th.textTer(),
                  },
                ]}
              >
                {t("details")}
              </Text>
              <ChevronDown
                size={13}
                color={results ? statusCfg.iconColor : th.textTer()}
              />
            </TouchableOpacity>
          </View>

          {results?.isNisabReached && !results?.hawlCompleted && (
            <View
              style={{
                marginTop: 8,
                padding: 8,
                borderRadius: 8,
                backgroundColor: COLORS.gold + "15",
                borderWidth: 1,
                borderColor: COLORS.gold + "40",
              }}
            >
              <Text
                style={{
                  fontSize: 11,
                  color: COLORS.gold,
                  fontWeight: "600",
                  textAlign: "center",
                }}
              >
                🕌{" "}
                {hawlStatus.message === "not_started"
                  ? t("hawl_starting")
                  : hawlStatus.daysRemaining > 0
                    ? `${t("hawl_in_progress")} · ${hawlStatus.daysRemaining} ${t("days")} ${t("remaining_suffix")}`
                    : t("nisab_reached_hawl_pending")}
              </Text>
            </View>
          )}
        </LinearGradient>
      </Animated.View>

      <ScrollView
        ref={scrollViewRef}
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[COLORS.primary]}
            tintColor={COLORS.primary}
          />
        }
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingTop: 8 }}
      >
        {/* ── Tabs ── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ paddingHorizontal: 16, marginTop: 10, marginBottom: 14 }}
        >
          {[
            { id: "money", title: t("money"), icon: DollarSign },
            { id: "metals", title: t("metals"), icon: Gem },
            { id: "trade", title: t("trade"), icon: ShoppingCart },
            { id: "agriculture", title: t("agriculture"), icon: Leaf },
            { id: "livestock", title: t("livestock"), icon: Package },
            { id: "debts", title: t("debts"), icon: CreditCard },
            { id: "other", title: t("other"), icon: Package },
          ].map((tab) => {
            const active = activeTab === tab.id;
            return (
              <TouchableOpacity
                key={tab.id}
                style={[
                  styles.tabButton,
                  {
                    backgroundColor: active ? COLORS.primary : th.card(),
                    borderColor: active ? COLORS.primary : th.border(),
                    shadowColor: active ? COLORS.primary : "transparent",
                    shadowOpacity: active ? 0.3 : 0,
                    shadowOffset: { width: 0, height: 3 },
                    shadowRadius: 6,
                    elevation: active ? 4 : 0,
                  },
                ]}
                onPress={() => {
                  setActiveTab(tab.id);
                  setExpandedSections((p) => ({ ...p, [tab.id]: true }));
                }}
              >
                <tab.icon size={16} color={active ? "#fff" : th.textSec()} />
                <Text
                  style={[
                    styles.tabText,
                    {
                      color: active ? "#fff" : th.textSec(),
                      fontWeight: active ? "700" : "500",
                    },
                  ]}
                >
                  {tab.title}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* ── Sections ── */}
        <View style={{ paddingHorizontal: 16, paddingBottom: 20 }}>
          {/* MONEY */}
          {activeTab === "money" &&
            renderSection(
              "money",
              t("money_and_accounts"),
              DollarSign,
              th,
              expandedSections,
              () => setExpandedSections((p) => ({ ...p, money: !p.money })),
              <View style={{ paddingHorizontal: 14, paddingBottom: 14 }}>
                <InputField
                  label={t("cash_in_hand")}
                  value={formData.cash}
                  onChangeText={(v) => handleInputChange("cash", v)}
                  placeholder="0"
                  keyboardType="numeric"
                  currency={userCurrency}
                  icon={Wallet}
                />
                <InputField
                  label={t("savings_accounts")}
                  value={formData.savings}
                  onChangeText={(v) => handleInputChange("savings", v)}
                  placeholder="0"
                  keyboardType="numeric"
                  currency={userCurrency}
                  icon={Banknote}
                />
                <InputField
                  label={t("current_accounts")}
                  value={formData.currentAccounts}
                  onChangeText={(v) => handleInputChange("currentAccounts", v)}
                  placeholder="0"
                  keyboardType="numeric"
                  currency={userCurrency}
                  icon={CreditCard}
                />
                <InputField
                  label={t("fixed_deposits")}
                  value={formData.fixedDeposits}
                  onChangeText={(v) => handleInputChange("fixedDeposits", v)}
                  placeholder="0"
                  keyboardType="numeric"
                  currency={userCurrency}
                  icon={Clock}
                />
              </View>,
            )}

          {/* METALS */}
          {activeTab === "metals" &&
            renderSection(
              "metals",
              t("precious_metals"),
              Gem,
              th,
              expandedSections,
              () => setExpandedSections((p) => ({ ...p, metals: !p.metals })),
              <View style={{ paddingHorizontal: 14, paddingBottom: 14 }}>
                <View
                  style={[
                    styles.pricesBanner,
                    {
                      backgroundColor: isDark ? "#1a2e1a" : "#f0f7ec",
                      borderColor: isDark ? "#2a4a2a" : "#c8ddc0",
                    },
                  ]}
                >
                  <View style={styles.priceItem}>
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 5,
                        marginBottom: 3,
                      }}
                    >
                      <Gem size={13} color={COLORS.goldLight} />
                      <Text
                        style={[styles.priceLabel, { color: th.textSec() }]}
                      >
                        {t("gold")}
                      </Text>
                    </View>
                    <Text
                      style={[styles.priceValue, { color: COLORS.goldLight }]}
                    >
                      {formatCurrency(displayPrice24k)}/g
                    </Text>
                    <Text style={[styles.priceSub, { color: th.textTer() }]}>
                      24k · 20k: {formatCurrency(displayPrice20k)} · 18k:{" "}
                      {formatCurrency(displayPrice18k)}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.priceDivider,
                      { backgroundColor: th.border() },
                    ]}
                  />
                  <View style={styles.priceItem}>
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 5,
                        marginBottom: 3,
                      }}
                    >
                      <Coins size={13} color={th.textSec()} />
                      <Text
                        style={[styles.priceLabel, { color: th.textSec() }]}
                      >
                        {t("silver")}
                      </Text>
                    </View>
                    <Text style={[styles.priceValue, { color: th.text() }]}>
                      {formatCurrency(displaySilver)}/g
                    </Text>
                    <Text style={[styles.priceSub, { color: th.textTer() }]}>
                      {pricesDate ? `MàJ: ${pricesDate}` : t("spot_price")}
                    </Text>
                  </View>
                </View>

                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    marginBottom: 12,
                  }}
                >
                  <View style={{ width: "48%" }}>
                    <InputField
                      label={t("gold_weight")}
                      value={formData.goldWeight}
                      onChangeText={(v) => handleInputChange("goldWeight", v)}
                      placeholder="0"
                      keyboardType="numeric"
                      unit="g"
                      icon={Gem}
                    />
                  </View>
                  <View style={{ width: "48%" }}>
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: "600",
                        color: th.textSec(),
                        marginBottom: 6,
                      }}
                    >
                      {t("purity")}
                    </Text>
                    <View style={{ gap: 6 }}>
                      {[
                        { key: "18k", price: displayPrice18k },
                        { key: "20k", price: displayPrice20k },
                        { key: "24k", price: displayPrice24k },
                      ].map(({ key, price }) => {
                        const sel = formData.goldPurity === key;
                        return (
                          <TouchableOpacity
                            key={key}
                            onPress={() => handleInputChange("goldPurity", key)}
                            style={{
                              flexDirection: "row",
                              justifyContent: "space-between",
                              alignItems: "center",
                              paddingHorizontal: 10,
                              paddingVertical: 8,
                              borderRadius: 10,
                              borderWidth: sel ? 1.5 : 1,
                              borderColor: sel ? COLORS.primary : th.border(),
                              backgroundColor: sel
                                ? COLORS.primary
                                : th.card2(),
                            }}
                          >
                            <Text
                              style={{
                                fontSize: 13,
                                fontWeight: "700",
                                color: sel ? "#fff" : th.text(),
                              }}
                            >
                              {key}
                            </Text>
                            <Text
                              style={{
                                fontSize: 11,
                                color: sel
                                  ? "rgba(255,255,255,0.8)"
                                  : th.textSec(),
                              }}
                            >
                              {formatCurrency(price)}/g
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                </View>

                {parseFloat(formData.goldWeight) > 0 && (
                  <View
                    style={[
                      styles.computedRow,
                      {
                        backgroundColor: isDark ? "#2a2200" : "#fffbea",
                        borderColor: COLORS.gold + "50",
                      },
                    ]}
                  >
                    <Text style={{ fontSize: 12, color: th.textSec() }}>
                      {parseFloat(formData.goldWeight).toFixed(2)}g {t("close_button_char")}{" "}
                      {formatCurrency(
                        formData.goldPurity === "24k"
                          ? displayPrice24k
                          : formData.goldPurity === "20k"
                            ? displayPrice20k
                            : displayPrice18k,
                      )}
                    </Text>
                    <Text
                      style={{
                        fontSize: 14,
                        fontWeight: "700",
                        color: COLORS.goldLight,
                      }}
                    >
                      ={" "}
                      {formatCurrency(
                        parseFloat(formData.goldWeight) *
                          (formData.goldPurity === "24k"
                            ? displayPrice24k
                            : formData.goldPurity === "20k"
                              ? displayPrice20k
                              : displayPrice18k),
                      )}
                    </Text>
                  </View>
                )}

                <InputField
                  label={t("silver_weight")}
                  value={formData.silverWeight}
                  onChangeText={(v) => handleInputChange("silverWeight", v)}
                  placeholder="0"
                  keyboardType="numeric"
                  unit="g"
                  icon={Coins}
                />
                {parseFloat(formData.silverWeight) > 0 && (
                  <View
                    style={[
                      styles.computedRow,
                      {
                        backgroundColor: th.card2(),
                        borderColor: th.border(),
                      },
                    ]}
                  >
                    <Text style={{ fontSize: 12, color: th.textSec() }}>
                      {parseFloat(formData.silverWeight).toFixed(2)}g {t("close_button_char")}{" "}
                      {formatCurrency(displaySilver)}
                    </Text>
                    <Text
                      style={{
                        fontSize: 14,
                        fontWeight: "700",
                        color: th.text(),
                      }}
                    >
                      ={" "}
                      {formatCurrency(
                        parseFloat(formData.silverWeight) * displaySilver,
                      )}
                    </Text>
                  </View>
                )}
              </View>,
            )}

          {/* TRADE */}
          {activeTab === "trade" &&
            renderSection(
              "trade",
              t("trade_goods_and_properties"),
              ShoppingCart,
              th,
              expandedSections,
              () => setExpandedSections((p) => ({ ...p, trade: !p.trade })),
              <View style={{ paddingHorizontal: 14, paddingBottom: 14 }}>
                <InputField
                  label={t("trade_goods_value")}
                  value={formData.tradeGoodsValue}
                  onChangeText={(v) => handleInputChange("tradeGoodsValue", v)}
                  placeholder="0"
                  keyboardType="numeric"
                  currency={userCurrency}
                  icon={ShoppingCart}
                />
                <InputField
                  label={t("business_inventory")}
                  value={formData.businessInventory}
                  onChangeText={(v) =>
                    handleInputChange("businessInventory", v)
                  }
                  placeholder="0"
                  keyboardType="numeric"
                  currency={userCurrency}
                  icon={Warehouse}
                />
                <InputField
                  label={t("rental_properties")}
                  value={formData.rentalProperties}
                  onChangeText={(v) => handleInputChange("rentalProperties", v)}
                  placeholder="0"
                  keyboardType="numeric"
                  currency={userCurrency}
                  icon={Building}
                />
                <InputField
                  label={t("vehicles_value")}
                  value={formData.vehiclesValue}
                  onChangeText={(v) => handleInputChange("vehiclesValue", v)}
                  placeholder="0"
                  keyboardType="numeric"
                  currency={userCurrency}
                  icon={Bike}
                  note={t("vehicles_note")}
                />
              </View>,
            )}

          {/* AGRICULTURE */}
          {activeTab === "agriculture" &&
            renderSection(
              "agriculture",
              t("agriculture"),
              Leaf,
              th,
              expandedSections,
              () =>
                setExpandedSections((p) => ({
                  ...p,
                  agriculture: !p.agriculture,
                })),
              <View style={{ paddingHorizontal: 14, paddingBottom: 14 }}>
                <InputField
                  label={t("crops_weight")}
                  value={formData.cropsWeight}
                  onChangeText={(v) => handleInputChange("cropsWeight", v)}
                  placeholder="0"
                  keyboardType="numeric"
                  unit="kg"
                  icon={Package}
                />
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: "600",
                    color: th.textSec(),
                    marginBottom: 8,
                    marginTop: 4,
                  }}
                >
                  {t("irrigation_type")}
                </Text>
                <View
                  style={{ flexDirection: "row", gap: 10, marginBottom: 14 }}
                >
                  {[
                    {
                      id: "rain",
                      label: `${t("rain_irrigation")} (10%)`,
                      icon: Leaf,
                    },
                    {
                      id: "cost",
                      label: `${t("cost_irrigation")} (5%)`,
                      icon: DollarSign,
                    },
                  ].map(({ id, label, icon: Icon }) => {
                    const sel = formData.irrigationType === id;
                    return (
                      <TouchableOpacity
                        key={id}
                        onPress={() => handleInputChange("irrigationType", id)}
                        style={{
                          flex: 1,
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "center",
                          padding: 11,
                          borderRadius: 11,
                          borderWidth: sel ? 1.5 : 1,
                          borderColor: sel ? COLORS.primary : th.border(),
                          backgroundColor: sel ? COLORS.primary : th.card2(),
                          gap: 6,
                        }}
                      >
                        <Icon size={15} color={sel ? "#fff" : th.textSec()} />
                        <Text
                          style={{
                            fontSize: 12,
                            fontWeight: sel ? "700" : "500",
                            color: sel ? "#fff" : th.textSec(),
                          }}
                        >
                          {label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <InputField
                  label={t("market_value")}
                  value={formData.cropsMarketValue}
                  onChangeText={(v) => handleInputChange("cropsMarketValue", v)}
                  placeholder={t("estimated_automatically")}
                  keyboardType="numeric"
                  currency={userCurrency}
                  icon={TrendingUp}
                />
              </View>,
            )}

          {/* LIVESTOCK */}
          {activeTab === "livestock" &&
            renderSection(
              "livestock",
              t("livestock"),
              Package,
              th,
              expandedSections,
              () =>
                setExpandedSections((p) => ({ ...p, livestock: !p.livestock })),
              <View style={{ paddingHorizontal: 14, paddingBottom: 14 }}>
                {[
                  [
                    {
                      label: t("camels"),
                      field: "camelsCount",
                      nisab: 5,
                      bg: isDark ? "#2a1e00" : "#fef3c7",
                      color: "#92400e",
                    },
                    {
                      label: t("cows"),
                      field: "cowsCount",
                      nisab: 30,
                      bg: isDark ? "#0f2a1a" : "#dcfce7",
                      color: "#166534",
                    },
                  ],
                  [
                    {
                      label: t("goats"),
                      field: "goatsCount",
                      nisab: 40,
                      bg: isDark ? "#2a1e00" : "#fef3c7",
                      color: "#92400e",
                    },
                    {
                      label: t("sheep"),
                      field: "sheepCount",
                      nisab: 40,
                      bg: isDark ? "#0f2a1a" : "#dcfce7",
                      color: "#166534",
                    },
                  ],
                ].map((row, ri) => (
                  <View
                    key={ri}
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      marginBottom: 12,
                    }}
                  >
                    {row.map(({ label, field, nisab, bg, color }) => (
                      <View
                        key={field}
                        style={{ width: "48%" }}
                      >
                        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 6 }}>
                          <View
                            style={{
                              width: 24,
                              height: 24,
                              borderRadius: 12,
                              backgroundColor: bg,
                              alignItems: "center",
                              justifyContent: "center",
                              marginRight: 6,
                            }}
                          >
                            <Package size={12} color={color} />
                          </View>
                          <Text style={{ fontSize: 13, fontWeight: "600", color: th.text() }}>
                            {label}
                          </Text>
                        </View>
                        <InputField
                          value={formData[field]}
                          onChangeText={(v) => handleInputChange(field, v)}
                          placeholder="0"
                          keyboardType="numeric"
                          unit={t("heads")}
                        />
                        <Text
                          style={{
                            fontSize: 10,
                            color: th.textTer(),
                            marginTop: -4,
                          }}
                        >
                          Nisab: {nisab}
                        </Text>
                      </View>
                    ))}
                  </View>
                ))}
              </View>,
            )}

          {/* DEBTS */}
          {activeTab === "debts" &&
            renderSection(
              "debts",
              t("receivables_and_debts"),
              CreditCard,
              th,
              expandedSections,
              () => setExpandedSections((p) => ({ ...p, debts: !p.debts })),
              <View style={{ paddingHorizontal: 14, paddingBottom: 14 }}>
                <InputField
                  label={t("certain_receivables")}
                  value={formData.receivables}
                  onChangeText={(v) => handleInputChange("receivables", v)}
                  placeholder="0"
                  keyboardType="numeric"
                  currency={userCurrency}
                  icon={CheckCircle}
                />
                <InputField
                  label={t("doubtful_receivables")}
                  value={formData.doubtfulReceivables}
                  onChangeText={(v) =>
                    handleInputChange("doubtfulReceivables", v)
                  }
                  placeholder="0"
                  keyboardType="numeric"
                  currency={userCurrency}
                  icon={AlertCircle}
                />
                <TouchableOpacity
                  onPress={() =>
                    handleInputChange(
                      "includeAllReceivables",
                      !formData.includeAllReceivables,
                    )
                  }
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginVertical: 14,
                    padding: 14,
                    borderRadius: 12,
                    backgroundColor: th.card2(),
                    borderWidth: 1,
                    borderColor: th.border(),
                  }}
                >
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: "500",
                      color: th.text(),
                      flex: 1,
                    }}
                  >
                    {t("include_doubtful_receivables")}
                  </Text>
                  <View
                    style={[
                      styles.toggleTrack,
                      {
                        backgroundColor: formData.includeAllReceivables
                          ? COLORS.primary
                          : th.border(),
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.toggleThumb,
                        {
                          transform: [
                            {
                              translateX: formData.includeAllReceivables
                                ? 20
                                : 2,
                            },
                          ],
                        },
                      ]}
                    />
                  </View>
                </TouchableOpacity>
                {/* ✅ FIX : afficher persistedDebts comme placeholder si formData.debts vide */}
                <InputField
                  label={t("debts_to_pay")}
                  value={formData.debts}
                  onChangeText={(v) => handleInputChange("debts", v)}
                  placeholder={
                    persistedDebts > 0 ? persistedDebts.toString() : "0"
                  }
                  keyboardType="numeric"
                  currency={userCurrency}
                  icon={CreditCard}
                />
                {persistedDebts > 0 && !formData.debts && (
                  <Text
                    style={{
                      fontSize: 11,
                      color: th.textTer(),
                      marginTop: -8,
                      marginBottom: 8,
                      marginLeft: 4,
                    }}
                  >
                    {t("registered_debts_info", { amount: formatCurrency(persistedDebts) })}
                  </Text>
                )}
              </View>,
            )}

          {/* OTHER */}
          {activeTab === "other" &&
            renderSection(
              "other",
              t("other_assets"),
              Diamond,
              th,
              expandedSections,
              () => setExpandedSections((p) => ({ ...p, other: !p.other })),
              <View style={{ paddingHorizontal: 14, paddingBottom: 14 }}>
                <InputField
                  label={t("mining_output")}
                  value={formData.miningOutput}
                  onChangeText={(v) => handleInputChange("miningOutput", v)}
                  placeholder="0"
                  keyboardType="numeric"
                  currency={userCurrency}
                  icon={Diamond}
                  note={t("mining_note")}
                />
                <InputField
                  label={t("found_treasure")}
                  value={formData.foundTreasure}
                  onChangeText={(v) => handleInputChange("foundTreasure", v)}
                  placeholder="0"
                  keyboardType="numeric"
                  currency={userCurrency}
                  icon={Gem}
                  note={t("treasure_note")}
                />
              </View>,
            )}
        </View>

        {/* ── Actions ── */}
        <View
          style={{
            borderTopWidth: 1,
            borderTopColor: th.border(),
            paddingHorizontal: 16,
            paddingVertical: 10,
            paddingBottom: Platform.OS === "ios" ? 26 : 16,
            backgroundColor: th.bg(),
          }}
        >
          <View style={{ flexDirection: "row", gap: 12 }}>
            <Button
              title={existingZakatId ? t("update") : t("save")}
              onPress={handleSaveCalculation}
              size="medium"
              style={{ flex: 1, minHeight: 50 }}
              backgroundColor={COLORS.goldLight}
              textColor="#fff"
              icon={CheckCircle}
              disabled={saving || !results || results.netWorth === 0}
            />
            <Button
              title={t("reset")}
              onPress={resetCalculator}
              variant="outline"
              size="medium"
              style={{ flex: 1, minHeight: 50 }}
              textColor={COLORS.primary}
              borderColor={COLORS.primary}
              icon={Calculator}
              disabled={saving}
            />
          </View>
        </View>

        {/* ── Principes Malékites ── */}
        <View style={{ marginHorizontal: 16, marginBottom: 24 }}>
          <Text
            style={{
              fontSize: 17,
              fontWeight: "700",
              color: th.text(),
              textAlign: "center",
              marginBottom: 16,
            }}
          >
            {t("maliki_principles")}
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 4, paddingVertical: 4 }}
          >
            {[
              {
                title: t("maliki_nisab"),
                desc: t("maliki_nisab_desc"),
                icon: Scale,
                color: COLORS.primary,
              },
              {
                title: t("maliki_receivables"),
                desc: t("maliki_receivables_desc"),
                icon: CreditCard,
                color: COLORS.goldLight,
              },
              {
                title: t("maliki_trade_goods"),
                desc: t("maliki_trade_goods_desc"),
                icon: ShoppingCart,
                color: COLORS.accent,
              },
              {
                title: t("maliki_agriculture"),
                desc: t("maliki_agriculture_desc"),
                icon: Leaf,
                color: "#2e7d32",
              },
              {
                title: t("maliki_livestock"),
                desc: t("maliki_livestock_desc"),
                icon: Package,
                color: "#795548",
              },
            ].map((pr, i) => (
              <View
                key={i}
                style={[
                  styles.principleCard,
                  {
                    backgroundColor: th.card(),
                    borderColor: th.border(),
                    shadowColor: isDark ? "#000" : pr.color,
                  },
                ]}
              >
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    backgroundColor: pr.color + "20",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: 10,
                  }}
                >
                  <pr.icon size={22} color={pr.color} />
                </View>
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: "700",
                    color: th.text(),
                    marginBottom: 6,
                  }}
                >
                  {pr.title}
                </Text>
                <Text
                  style={{ fontSize: 11, lineHeight: 16, color: th.textSec() }}
                >
                  {pr.desc}
                </Text>
              </View>
            ))}
          </ScrollView>
        </View>
        <View style={{ height: 80 }} />
      </ScrollView>

      {/* ══ CONFIRM UPDATE MODAL ══ */}
      <Modal
        visible={showConfirmUpdateModal}
        animationType="fade"
        transparent
        onRequestClose={() => setShowConfirmUpdateModal(false)}
      >
        <View
          style={[
            styles.modalOverlay,
            {
              backgroundColor: isDark ? "rgba(0,0,0,0.75)" : "rgba(0,0,0,0.55)",
            },
          ]}
        >
          <View
            style={[
              styles.confirmBox,
              {
                backgroundColor: th.card(),
                borderColor: th.border(),
                borderWidth: 1,
              },
            ]}
          >
            <View
              style={[
                styles.confirmIconBubble,
                { backgroundColor: COLORS.goldLight + "25" },
              ]}
            >
              <AlertCircle size={30} color={COLORS.goldLight} />
            </View>
            <Text style={[styles.confirmTitle, { color: th.text() }]}>
              {t("existing_calculation")}
            </Text>
            <Text
              style={{
                fontSize: 14,
                color: th.textSec(),
                textAlign: "center",
                lineHeight: 20,
                marginBottom: 16,
              }}
            >
              {t("existing_calculation_year")}
              {existingZakatInfo?.annee_hijri
                ? ` ${existingZakatInfo.annee_hijri} ${t("hijri_year_letter")}`
                : ""}
              .
            </Text>
            {existingZakatInfo && (
              <View
                style={[
                  styles.confirmInfoCard,
                  { backgroundColor: th.bg(), borderColor: th.border() },
                ]}
              >
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: "700",
                    color: th.textTer(),
                    marginBottom: 8,
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                  }}
                >
                  {t("current_calculation")}
                </Text>
                {[
                  {
                    label: t("zakat_calculated"),
                    value: formatCurrency(
                      existingZakatInfo.montant_zakat_calcule || 0,
                    ),
                    color: th.primaryColor(),
                  },
                  {
                    label: t("status"),
                    value:
                      existingZakatInfo.statut === "PAYE"
                        ? `${t("paid")} ✓`
                        : t("unpaid"),
                    color: th.text(),
                  },
                  {
                    label: t("new_calculation"),
                    value: formatCurrency(
                      results?.zakatAmountDue || results?.zakatAmount || 0,
                    ),
                    color: results?.isZakatDue
                      ? th.primaryColor()
                      : th.textSec(),
                  },
                ].map((row, i) => (
                  <View
                    key={i}
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      paddingVertical: 5,
                      borderBottomWidth: i < 2 ? 1 : 0,
                      borderBottomColor: th.border(),
                    }}
                  >
                    <Text style={{ fontSize: 13, color: th.textSec() }}>
                      {row.label}
                    </Text>
                    <Text
                      style={{
                        fontSize: 14,
                        fontWeight: "700",
                        color: row.color,
                      }}
                    >
                      {row.value}
                    </Text>
                  </View>
                ))}
              </View>
            )}
            <Text
              style={{
                fontSize: 12,
                color: th.textTer(),
                textAlign: "center",
                lineHeight: 17,
                marginBottom: 20,
                fontStyle: "italic",
              }}
            >
              {t("payments_preserved")}
            </Text>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <TouchableOpacity
                onPress={() => {
                  setShowConfirmUpdateModal(false);
                  setExistingZakatInfo(null);
                }}
                style={[styles.confirmBtnCancel, { borderColor: th.border() }]}
              >
                <Text
                  style={{
                    color: th.textSec(),
                    fontWeight: "600",
                    fontSize: 14,
                  }}
                >
                  {t("cancel")}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={async () => {
                  setShowConfirmUpdateModal(false);
                  setExistingZakatInfo(null);
                  await _doSave();
                }}
                style={[
                  styles.confirmBtnUpdate,
                  { backgroundColor: COLORS.primary },
                ]}
              >
                <CheckCircle size={15} color="#fff" />
                <Text
                  style={{ color: "#fff", fontWeight: "700", fontSize: 14 }}
                >
                  {t("do_update")}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ══ RESULTS MODAL ══ */}
      <Modal
        visible={showResultsModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowResultsModal(false)}
      >
        <View
          style={[
            styles.sheetOverlay,
            {
              backgroundColor: isDark ? "rgba(0,0,0,0.75)" : "rgba(0,0,0,0.5)",
            },
          ]}
        >
          <View style={[styles.sheet, { backgroundColor: th.card() }]}>
            <View
              style={[styles.sheetHeader, { borderBottomColor: th.border() }]}
            >
              <Text style={[styles.sheetTitle, { color: th.text() }]}>
                {t("zakat_calculation_details")}
              </Text>
              <TouchableOpacity
                onPress={() => setShowResultsModal(false)}
                style={[styles.closeBtn, { backgroundColor: th.bg2() }]}
              >
                <Text
                  style={{ color: th.textSec(), fontSize: 18, lineHeight: 20 }}
                >
                  {t("close_button_char")}
                </Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={{ paddingHorizontal: 20, paddingTop: 18 }}>
              {results && (
                <>
                  <View
                    style={[styles.resultsGrid, { borderColor: th.border() }]}
                  >
                    {[
                      {
                        label: t("total_assets"),
                        value: results.totalAssets,
                        color: th.text(),
                      },
                      {
                        label: t("total_deductions"),
                        value: results.totalDeductions,
                        color: COLORS.danger,
                      },
                      {
                        label: t("net_worth"),
                        value: results.netWorth,
                        color: th.text(),
                        bold: true,
                      },
                      {
                        label: t("nisab_threshold"),
                        value: results.nisabThreshold,
                        color: th.textSec(),
                      },
                    ].map((row, i) => (
                      <View
                        key={i}
                        style={[
                          styles.resultsRow,
                          { borderBottomColor: th.border() },
                        ]}
                      >
                        <Text style={{ fontSize: 14, color: th.textSec() }}>
                          {row.label}
                        </Text>
                        <Text
                          style={{
                            fontSize: 15,
                            fontWeight: row.bold ? "800" : "600",
                            color: row.color,
                          }}
                        >
                          {formatCurrency(row.value)}
                        </Text>
                      </View>
                    ))}
                    {/* ✅ Afficher montantPourZakat (règle min debut/fin) */}
                    {results.isNisabReached &&
                      results.montantPourZakat !== results.netWorth && (
                        <View
                          style={[
                            styles.resultsRow,
                            {
                              borderBottomColor: th.border(),
                              backgroundColor: th.primaryColor() + "08",
                            },
                          ]}
                        >
                          <Text
                            style={{
                              fontSize: 14,
                              color: th.primaryColor(),
                              fontWeight: "600",
                            }}
                          >
                            {t("zakat_base_maliki")}
                          </Text>
                          <Text
                            style={{
                              fontSize: 15,
                              fontWeight: "700",
                              color: th.primaryColor(),
                            }}
                          >
                            {formatCurrency(results.montantPourZakat)}
                          </Text>
                        </View>
                      )}
                  </View>

                  {/* Détail nisab BDD */}
                  {nisabInfo?.success && (
                    <View
                      style={[
                        styles.nisabDetailBox,
                        {
                          backgroundColor: isDark ? "#1a2e1a" : "#f0f7ec",
                          borderColor: COLORS.primary + "40",
                        },
                      ]}
                    >
                      <Text
                        style={{
                          fontSize: 11,
                          fontWeight: "700",
                          color: th.textTer(),
                          marginBottom: 8,
                          textTransform: "uppercase",
                          letterSpacing: 0.4,
                        }}
                      >
                        {t("nisab_details")}
                      </Text>
                      <View
                        style={{
                          flexDirection: "row",
                          justifyContent: "space-between",
                          marginBottom: 4,
                        }}
                      >
                        <Text style={{ fontSize: 12, color: th.textSec() }}>
                          {getNisabBaseLabel(formData.nisabBase, currentLanguage)}
                        </Text>
                        <Text
                          style={{
                            fontSize: 13,
                            fontWeight: "700",
                            color: th.primaryColor(),
                          }}
                        >
                          {formatCurrency(nisabInfo.threshold)}
                        </Text>
                      </View>
                      <View
                        style={{
                          flexDirection: "row",
                          justifyContent: "space-between",
                          marginBottom: 4,
                        }}
                      >
                        <Text style={{ fontSize: 11, color: th.textTer() }}>
                          {nisabInfo.montantNisab}g {t("close_button_char")}{" "}
                          {formatCurrency(nisabInfo.prixGramme)}/g
                        </Text>
                        <Text
                          style={{
                            fontSize: 11,
                            color: nisabCheck?.depasse
                              ? COLORS.success
                              : COLORS.danger,
                            fontWeight: "600",
                          }}
                        >
                          {nisabCheck?.depasse
                            ? `+${formatCurrency(nisabCheck.surplus)}`
                            : `-${formatCurrency(nisabCheck?.manque || 0)}`}
                        </Text>
                      </View>
                      {nisabInfo.sourceReligieuse ? (
                        <Text
                          style={{
                            fontSize: 10,
                            color: isDark ? "#7cb87c" : "#2e7d32",
                            fontStyle: "italic",
                            marginTop: 4,
                          }}
                        >
                          ﴾ {nisabInfo.sourceReligieuse} ﴿
                        </Text>
                      ) : null}
                    </View>
                  )}

                  {/* Statut hawl */}
                  {hawlResult && (
                    <View
                      style={[
                        styles.hawlBox,
                        {
                          backgroundColor:
                            hawlResult.action === "hawl_completed_zakat_due"
                              ? COLORS.success + "15"
                              : hawlResult.action === "hawl_in_progress" ||
                                  hawlResult.action === "hawl_started"
                                ? th.hawlBg()
                                : th.bg2(),
                          borderLeftColor:
                            hawlResult.action === "hawl_completed_zakat_due"
                              ? COLORS.success
                              : hawlResult.action === "hawl_in_progress"
                                ? COLORS.warning
                                : th.border(),
                        },
                      ]}
                    >
                      {hawlResult.hawlStatus && (
                        <>
                          <View
                            style={{
                              flexDirection: "row",
                              justifyContent: "space-between",
                              marginBottom: 6,
                            }}
                          >
                            <Text
                              style={{
                                fontSize: 13,
                                fontWeight: "700",
                                color: th.text(),
                              }}
                            >
                              {t("hawl_period")}
                            </Text>
                            <Text
                              style={{
                                fontSize: 12,
                                fontWeight: "700",
                                color:
                                  hawlResult.action ===
                                  "hawl_completed_zakat_due"
                                    ? COLORS.success
                                    : COLORS.warning,
                              }}
                            >
                              {hawlResult.hawlStatus.progressPercent}%
                            </Text>
                          </View>
                          <View
                            style={{
                              height: 6,
                              borderRadius: 3,
                              backgroundColor: th.border(),
                              marginBottom: 6,
                            }}
                          >
                            <View
                              style={{
                                height: 6,
                                borderRadius: 3,
                                width: `${hawlResult.hawlStatus.progressPercent}%`,
                                backgroundColor:
                                  hawlResult.action ===
                                  "hawl_completed_zakat_due"
                                    ? COLORS.success
                                    : COLORS.warning,
                              }}
                            />
                          </View>
                          <Text style={{ fontSize: 11, color: th.textSec() }}>
                            {hawlResult.hawlStatus.daysElapsed} / 354{" "}
                            {t("days")}
                            {" · "}
                            {t("hawl_deadline")}:{" "}
                            {hawlResult.hawlStatus.dateEcheance
                              ? new Date(
                                  hawlResult.hawlStatus.dateEcheance,
                                ).toLocaleDateString()
                              : "—"}
                          </Text>
                        </>
                      )}
                      {/* ✅ Afficher montantPourZakat si hawl complété */}
                      {hawlResult.action === "hawl_completed_zakat_due" && (
                        <>
                          <Text
                            style={{
                              fontSize: 13,
                              fontWeight: "700",
                              color: COLORS.success,
                              marginTop: 6,
                            }}
                          >
                            ✅{" "}
                            {t("zakat_now_obligatory")}
                          </Text>
                          {hawlResult.montantDebut > 0 && (
                            <Text
                              style={{
                                fontSize: 11,
                                color: th.textSec(),
                                marginTop: 4,
                              }}
                            >
                              min({formatCurrency(hawlResult.montantDebut)},{" "}
                              {formatCurrency(hawlResult.montantFin)}) {t("close_button_char")} 2.5%
                            </Text>
                          )}
                        </>
                      )}
                    </View>
                  )}

                  <View
                    style={[
                      styles.statusBanner,
                      {
                        backgroundColor: results.isZakatDue
                          ? th.primaryColor() + "15"
                          : results.isNisabReached && !results.hawlCompleted
                            ? COLORS.gold + "15"
                            : results.hawlCompleted
                              ? th.nisabBg()
                              : th.hawlBg(),
                        borderLeftColor: results.isZakatDue
                          ? th.primaryColor()
                          : results.isNisabReached && !results.hawlCompleted
                            ? COLORS.gold
                            : !results.hawlCompleted
                              ? th.hawlText()
                              : th.nisabText(),
                      },
                    ]}
                  >
                    {results.isZakatDue && (
                      <>
                        <Text
                          style={{
                            fontSize: 13,
                            color: th.textSec(),
                            marginBottom: 4,
                          }}
                        >
                          {t("zakat_amount")}
                        </Text>
                        <Text
                          style={{
                            fontSize: 28,
                            fontWeight: "800",
                            color: th.primaryColor(),
                          }}
                        >
                          {formatCurrency(
                            results.zakatAmountDue || results.zakatAmount,
                          )}
                        </Text>
                      </>
                    )}
                    {results.isNisabReached && !results.hawlCompleted && (
                      <>
                        <Text
                          style={{
                            fontSize: 12,
                            color: COLORS.gold,
                            fontWeight: "700",
                            marginBottom: 4,
                          }}
                        >
                          🕌{" "}
                          {t("zakat_estimated_when_hawl")}
                        </Text>
                        <Text
                          style={{
                            fontSize: 24,
                            fontWeight: "800",
                            color: COLORS.gold,
                          }}
                        >
                          {formatCurrency(results.zakatAmount)}
                        </Text>
                        <Text
                          style={{
                            fontSize: 11,
                            color: th.textSec(),
                            marginTop: 4,
                          }}
                        >
                          {t("hawl_not_completed_yet")}
                        </Text>
                      </>
                    )}
                    {!results.isNisabReached && (
                      <Text
                        style={{
                          fontSize: 14,
                          fontWeight: "600",
                          color: !results.hawlCompleted
                            ? th.hawlText()
                            : th.nisabText(),
                        }}
                      >
                        {t("nisab_not_reached")}
                      </Text>
                    )}
                  </View>
                </>
              )}
              <View style={{ height: 30 }} />
            </ScrollView>
            <View style={[styles.sheetFooter, { borderTopColor: th.border() }]}>
              <Button
                title={t("close")}
                onPress={() => setShowResultsModal(false)}
                variant="outline"
                textColor={COLORS.primary}
                borderColor={COLORS.primary}
                style={{ flex: 1 }}
              />
              <Button
                title={saving ? "..." : t("save_calculation")}
                onPress={() => {
                  setShowResultsModal(false);
                  handleSaveCalculation();
                }}
                backgroundColor={COLORS.primary}
                textColor="#fff"
                disabled={saving}
                style={{ flex: 2 }}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* ══ SETTINGS MODAL ══ */}
      <Modal
        visible={showSettingsModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowSettingsModal(false)}
      >
        <View
          style={[
            styles.sheetOverlay,
            {
              backgroundColor: isDark ? "rgba(0,0,0,0.75)" : "rgba(0,0,0,0.5)",
            },
          ]}
        >
          <View style={[styles.sheet, { backgroundColor: th.card() }]}>
            <View
              style={[styles.sheetHeader, { borderBottomColor: th.border() }]}
            >
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 12 }}
              >
                <View
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 21,
                    backgroundColor: COLORS.primary + "20",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Settings size={22} color={COLORS.primary} />
                </View>
                <View>
                  <Text style={[styles.sheetTitle, { color: th.text() }]}>
                    {t("maliki_settings")}
                  </Text>
                  <Text
                    style={{
                      fontSize: 12,
                      color: COLORS.primary,
                      marginTop: 1,
                    }}
                  >
                    {t("maliki_subtitle")}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => setShowSettingsModal(false)}
                style={[styles.closeBtn, { backgroundColor: th.bg2() }]}
              >
                <Text
                  style={{ color: th.textSec(), fontSize: 18, lineHeight: 20 }}
                >
                  {t("close_button_char")}
                </Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={{ paddingHorizontal: 20, paddingTop: 20 }}>
              {/* Localisation */}
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: "700",
                  color: th.text(),
                  marginBottom: 12,
                }}
              >
                {t("location")} & {t("currency")}
              </Text>
              <View
                style={[
                  styles.settingCard,
                  {
                    backgroundColor: COLORS.primary + (isDark ? "18" : "0e"),
                    borderColor: COLORS.primary + "40",
                  },
                ]}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 10,
                    marginBottom: 12,
                  }}
                >
                  <MapPin size={18} color={COLORS.primary} />
                  <Text
                    style={{
                      fontSize: 15,
                      fontWeight: "700",
                      color: th.text(),
                    }}
                  >
                    {t("your_location")}
                  </Text>
                </View>
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    paddingVertical: 8,
                    borderBottomWidth: 1,
                    borderBottomColor: th.border(),
                  }}
                >
                  <Text style={{ fontSize: 13, color: th.textSec() }}>
                    {t("country")}
                  </Text>
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: "600",
                      color: th.text(),
                    }}
                  >
                    {userCountry?.name || t("detecting")}
                  </Text>
                </View>
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    paddingVertical: 8,
                  }}
                >
                  <Text style={{ fontSize: 13, color: th.textSec() }}>
                    {t("currency")}
                  </Text>
                  <View
                    style={{
                      backgroundColor: COLORS.primary + "20",
                      paddingHorizontal: 12,
                      paddingVertical: 4,
                      borderRadius: 8,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 14,
                        fontWeight: "700",
                        color: th.primaryColor(),
                      }}
                    >
                      {userCurrency}
                    </Text>
                  </View>
                </View>
              </View>

              <View
                style={{
                  height: 1,
                  backgroundColor: th.border(),
                  marginVertical: 20,
                }}
              />

              {/* ── BASE NISAB ── */}
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 12,
                }}
              >
                <Text
                  style={{ fontSize: 16, fontWeight: "700", color: th.text() }}
                >
                  {t("nisab_base")}
                </Text>
                {loadingNisab && (
                  <ActivityIndicator size="small" color={COLORS.primary} />
                )}
              </View>

              <View
                style={{
                  flexDirection: "row",
                  flexWrap: "wrap",
                  gap: 10,
                  marginBottom: 8,
                }}
              >
                {NISAB_BASES.map(({ id, label, sublabel, color }) => {
                  const sel = formData.nisabBase === id;
                  const priceDisplay = (() => {
                    switch (id) {
                      case "or_24k":
                        return formatCurrency(85 * currentPrices.gold24k);
                      case "or_20k":
                        return formatCurrency(85 * currentPrices.gold20k);
                      case "or_18k":
                        return formatCurrency(85 * currentPrices.gold18k);
                      case "argent":
                        return formatCurrency(595 * currentPrices.silver999);
                      default:
                        return "—";
                    }
                  })();
                  return (
                    <TouchableOpacity
                      key={id}
                      onPress={() => handleInputChange("nisabBase", id)}
                      style={[
                        styles.nisabBtn,
                        {
                          backgroundColor: sel ? COLORS.primary : th.card2(),
                          borderColor: sel ? COLORS.primary : th.border(),
                          width: "47%",
                        },
                      ]}
                    >
                      <View
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: 16,
                          backgroundColor: sel
                            ? "rgba(255,255,255,0.2)"
                            : color + "20",
                          alignItems: "center",
                          justifyContent: "center",
                          marginBottom: 6,
                        }}
                      >
                        {id === "argent" ? (
                          <Coins size={17} color={sel ? "#fff" : color} />
                        ) : (
                          <Gem size={17} color={sel ? "#fff" : color} />
                        )}
                      </View>
                      <Text
                        style={{
                          fontSize: 13,
                          fontWeight: "700",
                          color: sel ? "#fff" : th.text(),
                        }}
                      >
                        {label}
                      </Text>
                      <Text
                        style={{
                          fontSize: 10,
                          color: sel ? "rgba(255,255,255,0.7)" : th.textTer(),
                          marginTop: 2,
                        }}
                      >
                        {sublabel}
                      </Text>
                      <Text
                        style={{
                          fontSize: 12,
                          marginTop: 5,
                          fontWeight: "600",
                          color: sel ? "rgba(255,255,255,0.85)" : th.textSec(),
                        }}
                      >
                        {priceDisplay}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {nisabInfo?.success && (
                <View
                  style={[
                    styles.settingCard,
                    {
                      backgroundColor: isDark ? "#1a2e1a" : "#f0f7ec",
                      borderColor: COLORS.primary + "30",
                      marginBottom: 4,
                    },
                  ]}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      marginBottom: 4,
                    }}
                  >
                    <Text style={{ fontSize: 12, color: th.textSec() }}>
                      {nisabInfo.montantNisab}g {t("close_button_char")}{" "}
                      {formatCurrency(nisabInfo.prixGramme)}/g
                    </Text>
                    <Text
                      style={{
                        fontSize: 14,
                        fontWeight: "800",
                        color: th.primaryColor(),
                      }}
                    >
                      = {formatCurrency(nisabInfo.threshold)}
                    </Text>
                  </View>
                  {nisabInfo.sourceReligieuse ? (
                    <Text
                      style={{
                        fontSize: 10,
                        color: isDark ? "#7cb87c" : "#2e7d32",
                        fontStyle: "italic",
                        marginTop: 4,
                      }}
                    >
                      ﴾ {nisabInfo.sourceReligieuse} ﴿
                    </Text>
                  ) : null}
                </View>
              )}

              <View
                style={{
                  height: 1,
                  backgroundColor: th.border(),
                  marginVertical: 20,
                }}
              />

              {/* ── HAWL ── */}
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: "700",
                  color: th.text(),
                  marginBottom: 12,
                }}
              >
                {t("hawl_period")}
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: "400",
                    color: th.textTer(),
                  }}
                >
                  {" "}
                  (354 {t("days")})
                </Text>
              </Text>

              {results && !results.isNisabReached ? (
                <View
                  style={[
                    styles.settingCard,
                    {
                      backgroundColor: th.nisabBg(),
                      borderColor: th.nisabText() + "50",
                    },
                  ]}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 10,
                    }}
                  >
                    <AlertCircle size={20} color={th.nisabText()} />
                    <Text
                      style={{
                        fontSize: 14,
                        fontWeight: "600",
                        color: th.nisabText(),
                        flex: 1,
                      }}
                    >
                      {t("hawl_starts_when_nisab_reached")}
                    </Text>
                  </View>
                </View>
              ) : (
                <View
                  style={[
                    styles.settingCard,
                    {
                      backgroundColor: hawlStatus.completed
                        ? isDark
                          ? "#0f2a1a"
                          : "#f0faf4"
                        : th.hawlBg(),
                      borderColor: hawlStatus.completed
                        ? COLORS.primary + "30"
                        : th.hawlText() + "50",
                    },
                  ]}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "flex-start",
                      gap: 12,
                    }}
                  >
                    <Clock
                      size={22}
                      color={
                        hawlStatus.completed ? COLORS.success : th.hawlText()
                      }
                    />
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          fontSize: 15,
                          fontWeight: "700",
                          color: hawlStatus.completed
                            ? COLORS.success
                            : th.hawlText(),
                          marginBottom: 4,
                        }}
                      >
                        {hawlStatus.completed
                          ? t("hawl_completed")
                          : t("hawl_not_completed")}
                      </Text>
                      {!hawlStatus.completed &&
                        hawlStatus.daysRemaining > 0 && (
                          <Text style={{ fontSize: 13, color: th.textSec() }}>
                            {t("days_remaining")}: {hawlStatus.daysRemaining}{" "}
                            {t("days")}
                          </Text>
                        )}
                      {hawlStatus.dateDebut && (
                        <Text
                          style={{
                            fontSize: 12,
                            color: th.textTer(),
                            marginTop: 2,
                          }}
                        >
                          {t("hawl_start_date")}:{" "}
                          {new Date(hawlStatus.dateDebut).toLocaleDateString()}
                        </Text>
                      )}
                      {/* ✅ Afficher montantDebut (base pour règle min) */}
                      {hawlStatus.montantDebut > 0 && (
                        <Text
                          style={{
                            fontSize: 12,
                            color: th.textTer(),
                            marginTop: 2,
                          }}
                        >
                          {t("initial_wealth_label")}
                          {formatCurrency(hawlStatus.montantDebut)}
                        </Text>
                      )}
                      {hawlStatus.nextAnniversary && (
                        <Text
                          style={{
                            fontSize: 12,
                            color: th.textTer(),
                            marginTop: 2,
                          }}
                        >
                          {t("next_anniversary")}:{" "}
                          {new Date(
                            hawlStatus.nextAnniversary,
                          ).toLocaleDateString()}
                        </Text>
                      )}
                    </View>
                  </View>

                  {hawlStatus.progressPercent > 0 && (
                    <View style={{ marginTop: 12 }}>
                      <View
                        style={{
                          height: 6,
                          borderRadius: 3,
                          backgroundColor: th.border(),
                        }}
                      >
                        <View
                          style={{
                            height: 6,
                            borderRadius: 3,
                            width: `${Math.min(100, hawlStatus.progressPercent)}%`,
                            backgroundColor: hawlStatus.completed
                              ? COLORS.success
                              : COLORS.warning,
                          }}
                        />
                      </View>
                      <Text
                        style={{
                          fontSize: 11,
                          color: th.textSec(),
                          marginTop: 4,
                        }}
                      >
                        {hawlStatus.daysElapsed || 0} / 354{" "}
                        {t("days")} · {hawlStatus.progressPercent}%
                      </Text>
                    </View>
                  )}
                </View>
              )}

              <View style={{ height: 30 }} />
            </ScrollView>

            <View style={[styles.sheetFooter, { borderTopColor: th.border() }]}>
              <Button
                title={t("apply")}
                onPress={() => setShowSettingsModal(false)}
                backgroundColor={COLORS.primary}
                textColor="#fff"
                style={{ flex: 1, minHeight: 50 }}
              />
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
};

// ── Reusable section renderer ──────────────────────────────────────
const renderSection = (
  id,
  title,
  IconComp,
  th,
  expandedSections,
  onToggle,
  children,
) => {
  const expanded = expandedSections[id];
  return (
    <View
      style={[
        sectionStyles.section,
        { backgroundColor: th.card(), borderColor: th.border() },
      ]}
    >
      <TouchableOpacity
        onPress={onToggle}
        style={sectionStyles.header}
        activeOpacity={0.7}
      >
        <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
          <View
            style={[
              sectionStyles.iconWrap,
              { backgroundColor: COLORS.primary + "20" },
            ]}
          >
            <IconComp size={17} color={COLORS.primary} />
          </View>
          <Text style={[sectionStyles.title, { color: th.text() }]}>
            {title}
          </Text>
        </View>
        {expanded ? (
          <ChevronUp size={17} color={th.textSec()} />
        ) : (
          <ChevronDown size={17} color={th.textSec()} />
        )}
      </TouchableOpacity>
      {expanded && children}
    </View>
  );
};

const sectionStyles = StyleSheet.create({
  section: {
    borderRadius: 14,
    marginBottom: 12,
    borderWidth: 1,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 14,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  title: { fontSize: 15, fontWeight: "700", flex: 1 },
});

const styles = StyleSheet.create({
  savingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 999,
    justifyContent: "center",
    alignItems: "center",
  },
  savingBox: {
    borderRadius: 18,
    padding: 30,
    alignItems: "center",
    minWidth: 190,
  },
  fixedResultsBar: {
    position: "relative",
    top: Platform.OS === "ios" ? 5 : 5,
    marginHorizontal: 16,
    zIndex: 100,
    elevation: 10,
  },
  fixedResultsContent: {
    borderRadius: 14,
    padding: 14,
    borderWidth: 1.5,
    borderBottomWidth: 3,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  fixedResultsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 2,
  },
  fixedResultsStatus: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    flexWrap: "wrap",
    gap: 4,
  },
  statusIconBubble: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 4,
  },
  fixedStatusText: { fontSize: 14, fontWeight: "700" },
  existingBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  existingBadgeText: { fontSize: 10, fontWeight: "700" },
  settingsButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 8,
  },
  fixedResultsDetails: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  fixedDetailItem: { flex: 1 },
  fixedDetailDivider: { width: 1, height: 36, marginHorizontal: 12 },
  fixedDetailLabel: {
    fontSize: 10,
    fontWeight: "600",
    marginBottom: 3,
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  fixedDetailValue: { fontSize: 15, fontWeight: "700" },
  fixedZakatValue: { fontSize: 17, fontWeight: "800" },
  fixedViewDetails: { flexDirection: "row", alignItems: "center", gap: 3 },
  fixedViewDetailsText: { fontSize: 11, fontWeight: "600" },
  tabButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
  },
  tabText: { fontSize: 12, marginLeft: 5 },
  pricesBanner: {
    flexDirection: "row",
    borderRadius: 12,
    borderWidth: 1,
    padding: 13,
    marginBottom: 16,
    alignItems: "center",
  },
  priceItem: { flex: 1, alignItems: "center" },
  priceLabel: { fontSize: 11, fontWeight: "600" },
  priceValue: { fontSize: 15, fontWeight: "800" },
  priceSub: { fontSize: 9, marginTop: 3, textAlign: "center" },
  priceDivider: { width: 1, height: 36, marginHorizontal: 10 },
  computedRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderRadius: 10,
    borderWidth: 1,
    padding: 11,
    marginBottom: 12,
  },
  toggleTrack: {
    width: 44,
    height: 24,
    borderRadius: 12,
    justifyContent: "center",
    padding: 2,
  },
  toggleThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  principleCard: {
    width: 188,
    padding: 16,
    borderRadius: 16,
    marginHorizontal: 6,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  confirmBox: { width: "100%", borderRadius: 22, padding: 24 },
  confirmIconBubble: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: 14,
  },
  confirmTitle: {
    fontSize: 20,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 8,
  },
  confirmInfoCard: {
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
  },
  confirmBtnCancel: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
  },
  confirmBtnUpdate: {
    flex: 2,
    padding: 14,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  sheetOverlay: { flex: 1, justifyContent: "flex-end" },
  sheet: {
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    maxHeight: SCREEN_HEIGHT * 0.92,
  },
  sheetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
  },
  sheetTitle: { fontSize: 20, fontWeight: "800" },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  sheetFooter: {
    flexDirection: "row",
    gap: 10,
    padding: 16,
    borderTopWidth: 1,
  },
  settingCard: {
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    marginBottom: 4,
  },
  nisabBtn: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: "center",
  },
  resultsGrid: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
    marginBottom: 12,
  },
  resultsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderBottomWidth: 1,
  },
  statusBanner: {
    borderLeftWidth: 4,
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    marginTop: 10,
  },
  nisabDetailBox: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
  },
  hawlBox: {
    borderLeftWidth: 4,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
});

export default ZakatCalculatorScreen;
