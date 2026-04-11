import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";

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
  FlatList,
  ActivityIndicator
} from "react-native";
import { useAppTranslation } from "../hooks/useTranslation";
import { useTheme } from "../context/ThemeContext";
import { useCurrency } from "../context/CurrencyContext";
import { useAlert } from "../context/AlertContext";
import { zakatService } from '../services/zakatService';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabase';

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
  GitMerge,
  Receipt,
  Settings,
  Sliders,
  MapPin,
} from "lucide-react-native";
import InputField from "../components/InputField";
import Button from "../components/Button";
import { getHawlStatus, checkExistingZakatForYear } from '../utils/zakatUtils';
import { LinearGradient } from "expo-linear-gradient";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const MALIKI_PRIMARY = "#1a5d1a";
const MALIKI_SECONDARY = "#d4af37";
const MALIKI_ACCENT = "#8b4513";
const MALIKI_LIGHT = "#f0f7f0";
const MALIKI_DARK = "#0a2f0a";

const ZakatCalculatorScreen = () => {
  const { t } = useAppTranslation();
  const { currentTheme } = useTheme();
  const { alert, success, error: showError, confirm } = useAlert();
  const {
    userCurrency,
    metalsPrices,
    formatCurrency,
    refreshData,
    userCountry,
    userCity,
  } = useCurrency();
  const { user } = useAuth();

  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [actifsHistory, setActifsHistory] = useState([]);
  const [zakatHistory, setZakatHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyFilterTab, setHistoryFilterTab] = useState("all");

  // ✅ FIX 1: Default hawl to completed=true
  // If user has no date_anniversaire_zakat → first registration → hawl considered complete
  const [hawlStatus, setHawlStatus] = useState({
    completed: true,      // ← TRUE by default (not false)
    daysRemaining: 0,
    nextAnniversary: null,
    message: ""
  });

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

  const [formData, setFormData] = useState({
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
    nisabBase: "gold",
    includeAllReceivables: false,
    includeAllProperties: true,
  });

  const [results, setResults] = useState(null);
  const [calculationSteps, setCalculationSteps] = useState([]);
  const [showResultsModal, setShowResultsModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showMadhabInfo, setShowMadhabInfo] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const calculateTimeoutRef = useRef(null);
  const lastFormDataRef = useRef(formData);
  const scrollViewRef = useRef(null);

  const getBackgroundColor = () => currentTheme === "dark" ? MALIKI_DARK : MALIKI_LIGHT;
  const getCardColor = () => currentTheme === "dark" ? "#1a2a1a" : "#ffffff";
  const getTextColor = () => currentTheme === "dark" ? "#e8edf5ff" : "#1a2a1a";
  const getSecondaryTextColor = () => currentTheme === "dark" ? "#a8c6a8" : "#4a6b4a";
  const getBorderColor = () => currentTheme === "dark" ? "#334155" : "#e2e8f0";
  const getNisabNotReachedBackground = () => currentTheme === "dark" ? "#1e3a1e" : "#f0f7f0";
  const getNisabNotReachedTextColor = () => currentTheme === "dark" ? "#a8c6a8" : "#166534";

  const defaultPrices = useMemo(() => ({
    gold24k: metalsPrices?.gold || 65.42,
    gold18k: metalsPrices?.gold ? metalsPrices.gold * 0.75 : 49.07,
    gold21k: metalsPrices?.gold ? metalsPrices.gold * 0.875 : 57.24,
    silver999: metalsPrices?.silver || 0.82,
    silver925: metalsPrices?.silver ? metalsPrices.silver * 0.925 : 0.76,
  }), [metalsPrices]);

  const MALIKI_NISAB = {
    gold: 85,
    silver: 595,
    crops: 653,
    camels: 5,
    cows: 30,
    sheepGoats: 40,
  };

  const calculateMalikiZakat = (currentFormData = formData) => {
    const parseValue = (val) => Math.max(0, parseFloat(val || 0));

    const cashValue = parseValue(currentFormData.cash);
    const savingsValue = parseValue(currentFormData.savings);
    const currentAccountsValue = parseValue(currentFormData.currentAccounts);
    const fixedDepositsValue = parseValue(currentFormData.fixedDeposits);
    const totalMoney = cashValue + savingsValue + currentAccountsValue + fixedDepositsValue;

    const goldWeight = parseValue(currentFormData.goldWeight);
    const goldValue = goldWeight > 0 ?
      goldWeight * (currentFormData.goldPurity === "24k" ? defaultPrices.gold24k :
                   currentFormData.goldPurity === "21k" ? defaultPrices.gold21k :
                   defaultPrices.gold18k) : 0;

    const silverWeight = parseValue(currentFormData.silverWeight);
    const silverValue = silverWeight > 0 ?
      silverWeight * (currentFormData.silverPurity === "999" ? defaultPrices.silver999 : defaultPrices.silver925) : 0;

    const tradeGoodsValue = parseValue(currentFormData.tradeGoodsValue);
    const businessInventoryValue = parseValue(currentFormData.businessInventory);
    const rentalPropertiesValue = parseValue(currentFormData.rentalProperties);
    const vehiclesValue = parseValue(currentFormData.vehiclesValue);
    const totalTradeGoods = tradeGoodsValue + businessInventoryValue + rentalPropertiesValue + vehiclesValue;

    const cropsWeight = parseValue(currentFormData.cropsWeight);
    const cropsValue = cropsWeight > 0 ?
      (parseValue(currentFormData.cropsMarketValue) || cropsWeight * 0.5) : 0;

    const camelsCount = parseValue(currentFormData.camelsCount);
    const cowsCount = parseValue(currentFormData.cowsCount);
    const goatsCount = parseValue(currentFormData.goatsCount);
    const sheepCount = parseValue(currentFormData.sheepCount);
    const livestockValue =
      (camelsCount * 2500) +
      (cowsCount * 1200) +
      (goatsCount * 150) +
      (sheepCount * 120);

    const receivables = parseValue(currentFormData.receivables);
    const doubtfulReceivables = parseValue(currentFormData.doubtfulReceivables);
    const totalReceivables = currentFormData.includeAllReceivables ?
      receivables + doubtfulReceivables : receivables;

    const debts = parseValue(currentFormData.debts);
    const miningOutput = parseValue(currentFormData.miningOutput);
    const foundTreasure = parseValue(currentFormData.foundTreasure);

    const totalAssets =
      totalMoney + goldValue + silverValue + totalTradeGoods +
      cropsValue + livestockValue + totalReceivables + miningOutput + foundTreasure;

    const totalDeductions = debts;
    const netWorth = totalAssets - totalDeductions;

    const nisabThreshold = currentFormData.nisabBase === "gold" ?
      MALIKI_NISAB.gold * defaultPrices.gold24k :
      MALIKI_NISAB.silver * defaultPrices.silver999;

    const hawlCompleted = hawlStatus.completed;
    const isNisabReached = netWorth >= nisabThreshold;

    let zakatAmount = 0;
    let breakdown = [];

    if (hawlCompleted && isNisabReached) {
      const standardZakat = (totalMoney + goldValue + silverValue + totalTradeGoods + totalReceivables) * 0.025;
      const cropsZakat = cropsValue * (currentFormData.irrigationType === "rain" ? 0.1 : 0.05);
      const livestockZakat = livestockValue * 0.025;
      const miningZakat = miningOutput * 0.025;
      const treasureZakat = foundTreasure * 0.2;

      zakatAmount = standardZakat + cropsZakat + livestockZakat + miningZakat + treasureZakat;

      breakdown = [
        { category: t("money_and_metals"), amount: standardZakat, percentage: "2.5%" },
        { category: t("crops"), amount: cropsZakat, percentage: currentFormData.irrigationType === "rain" ? "10%" : "5%" },
        { category: t("livestock"), amount: livestockZakat, percentage: "2.5%" },
        { category: t("vehicles"), amount: 0, percentage: "Inclus dans biens commerciaux" },
        { category: t("mining"), amount: miningZakat, percentage: "2.5%" },
        { category: t("treasure"), amount: treasureZakat, percentage: "20%" },
      ];
    }

    return {
      totalAssets,
      totalDeductions,
      netWorth,
      nisabThreshold,
      nisabBase: currentFormData.nisabBase,
      isNisabReached,
      hawlCompleted,
      zakatAmount,
      breakdown,
      isZakatDue: hawlCompleted && isNisabReached && zakatAmount > 0,
    };
  };

  useEffect(() => {
    if (calculateTimeoutRef.current) clearTimeout(calculateTimeoutRef.current);

    calculateTimeoutRef.current = setTimeout(() => {
      const newResults = calculateMalikiZakat(formData);
      setResults(newResults);

      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();

      lastFormDataRef.current = formData;
    }, 500);

    return () => {
      if (calculateTimeoutRef.current) clearTimeout(calculateTimeoutRef.current);
    };
  }, [formData, hawlStatus]); // ✅ Also re-calculate when hawlStatus changes

  // ✅ FIX 2: Correct table name (profils_utilisateurs) and column (id_utilisateur)
  // ✅ FIX 3: Default to completed=true if no date set (first registration)
  useEffect(() => {
    const loadHawlStatus = async () => {
      if (!user) return;

      try {
        const { data: profile, error } = await supabase
          .from('profils_utilisateurs')        // ← correct table
          .select('date_anniversaire_zakat')
          .eq('id_utilisateur', user.id)       // ← correct column
          .single();

        if (error || !profile) {
          // Query failed or no profile → keep default (completed=true)
          return;
        }

        if (!profile.date_anniversaire_zakat) {
          // No anniversary date set → first registration → hawl considered complete
          setHawlStatus({
            completed: true,
            daysRemaining: 0,
            nextAnniversary: null,
            message: "Premier enregistrement — Hawl considéré complété"
          });
          return;
        }

        // Has a date → calculate real hawl status
        const status = getHawlStatus(profile.date_anniversaire_zakat);
        setHawlStatus(status);
      } catch (e) {
        console.error('Erreur chargement hawl:', e);
        // On error → keep default completed=true (safe fallback)
      }
    };

    loadHawlStatus();
  }, [user]);

  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    setExpandedSections(prev => ({ ...prev, [tabId]: true }));
  };

  const handleInputChange = useCallback((field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  }, []);

  const handleSaveCalculation = async () => {
  if (!user) {
    showError(t("error"), "Vous devez être connecté pour sauvegarder");
    return;
  }

  if (!results || results.netWorth === 0) {
    showError(t("error"), "Aucun calcul à sauvegarder");
    return;
  }

  try {
    const currentHijriYear = getCurrentHijriYear(); // import depuis zakatUtils

    // Chercher si un enregistrement existe déjà pour cette année
    const { data: existing } = await supabase
      .from("zakat_annuel")
      .select("id, statut, montant_zakat_paye")
      .eq("utilisateur_id", user.id)
      .eq("annee_hijri", currentHijriYear)
      .single();

    if (existing) {
      // ✅ UPDATE au lieu d'INSERT
      confirm(
        t("warning"),
        `Un calcul existe pour l'année ${currentHijriYear}H. Voulez-vous le mettre à jour ?`,
        async () => {
          await updateExistingZakat(existing.id, existing.montant_zakat_paye || 0);
        }
      );
    } else {
      // Nouveau calcul
      const saveResult = await zakatService.saveCompleteCalculation(
  user.id, formData, results, defaultPrices
);
if (!saveResult.success) throw new Error(saveResult.error);

// ✅ Message adapté selon nisab atteint ou non
if (saveResult.data?.alreadyExists) {
  success(
    t("success"),
    results.isNisabReached
      ? `Calcul mis à jour !\nZakat due : ${formatCurrency(results.zakatAmount)}`
      : `Calcul mis à jour.\nNisab non atteint — aucune Zakat due.`
  );
} else {
  success(
    t("success"),
    results.isZakatDue
      ? `Calcul sauvegardé !\nZakat : ${formatCurrency(results.zakatAmount)}`
      : `Calcul sauvegardé.\nPas de Zakat due.`
  );
}
resetCalculator();
    }
  } catch (error) {
    showError(t("error"), error.message || "Erreur lors de la sauvegarde");
  }
};

// Nouvelle fonction : met à jour un zakat_annuel existant
const updateExistingZakat = async (zakatAnnuelId, montantDejaPaye) => {
  try {
    const montantRestant = Math.max(0, (results.zakatAmount || 0) - montantDejaPaye);
    const newStatut = montantRestant <= 0 ? "PAYE" : "NON_PAYE";

    const { error } = await supabase
      .from("zakat_annuel")
      .update({
        montant_total_actifs:   results.totalAssets,
        montant_total_dettes:   results.totalDeductions,
        montant_imposable:      results.netWorth,
        nisab_applique:         results.nisabThreshold,
        type_nisab_applique:    results.nisabBase?.toUpperCase() || "GOLD",
        depasse_nisab:          results.isNisabReached,       // ✅ mis à jour
        montant_zakat_calcule:  results.zakatAmount,          // ✅ mis à jour
        montant_restant:        montantRestant,
        statut:                 newStatut,
        recalcule_auto:         false,
        updated_at:             new Date().toISOString(),
      })
      .eq("id", zakatAnnuelId);

    if (error) throw error;

    // Sauvegarder les nouveaux actifs (soft-delete les anciens, insert les nouveaux)
    await refreshActifsForYear(zakatAnnuelId);

    success(
      t("success"),
      results.isNisabReached
        ? `Zakat mise à jour : ${formatCurrency(results.zakatAmount)}`
        : "Calcul mis à jour — Nisab non atteint, pas de Zakat due."
    );
    resetCalculator();

  } catch (error) {
    showError(t("error"), "Erreur mise à jour : " + error.message);
  }
};

// Soft-delete anciens actifs et insère les nouveaux pour cette année
const refreshActifsForYear = async (zakatAnnuelId) => {
  // 1. Soft-delete tous les actifs de cette année
  await supabase
    .from("zakat_actif")
    .update({ actif: false })
    .eq("zakat_annuel_id", zakatAnnuelId);

  // 2. Insérer les nouveaux actifs depuis formData
  const actifs = buildActifsFromFormData(zakatAnnuelId);
  if (actifs.length > 0) {
    await supabase.from("zakat_actif").insert(actifs);
  }
};

  const handleLoadHistory = async () => {
    if (!user) {
      showError(t("error"), "Vous devez être connecté");
      return;
    }

    try {
      setLoadingHistory(true);
      setShowHistoryModal(true);

      const actifsResult = await zakatService.getZakatActifsHistory(user.id);
      if (actifsResult.success) setActifsHistory(actifsResult.data);

      const zakatResult = await zakatService.getZakatAnnuelHistory(user.id);
      if (zakatResult.success) setZakatHistory(zakatResult.data);
    } catch (error) {
      showError(t("error"), "Erreur lors du chargement de l'historique");
    } finally {
      setLoadingHistory(false);
    }
  };

  const toggleSection = (section) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const resetCalculator = () => {
    setFormData({
      cash: "", savings: "", currentAccounts: "", fixedDeposits: "",
      goldWeight: "", goldPurity: "24k", silverWeight: "", silverPurity: "925",
      tradeGoodsValue: "", businessInventory: "", rentalProperties: "", vehiclesValue: "",
      cropsWeight: "", irrigationType: "rain", cropsMarketValue: "",
      camelsCount: "", cowsCount: "", goatsCount: "", sheepCount: "",
      receivables: "", doubtfulReceivables: "", debts: "",
      miningOutput: "", foundTreasure: "",
      nisabBase: "silver", includeAllReceivables: false, includeAllProperties: true,
    });
    fadeAnim.setValue(0);
    if (calculateTimeoutRef.current) clearTimeout(calculateTimeoutRef.current);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshData();
    setRefreshing(false);
  };

  useEffect(() => {
    return () => {
      if (calculateTimeoutRef.current) clearTimeout(calculateTimeoutRef.current);
    };
  }, []);

  const getStatusColor = () => {
    if (!results) return "#94a3b8";
    if (results.isZakatDue) return MALIKI_PRIMARY;
    if (!results.hawlCompleted) return "#f59e0b";
    if (!results.isNisabReached) return getNisabNotReachedTextColor();
    return "#94a3b8";
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: getBackgroundColor() }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <StatusBar
        backgroundColor={getBackgroundColor()}
        barStyle={currentTheme === "dark" ? "light-content" : "dark-content"}
      />

      {/* En-tête compact */}
      <LinearGradient
        colors={currentTheme === "dark" ? [MALIKI_DARK, "#0a3a0a"] : [MALIKI_LIGHT, "#e8f5e8"]}
        style={styles.headerGradient}
      >
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View style={styles.titleContainer}>
              <View style={[styles.titleIcon, { backgroundColor: MALIKI_PRIMARY + "20" }]}>
                <Crown size={20} color={MALIKI_PRIMARY} />
              </View>
              <View>
                <Text style={[styles.title, { color: getTextColor() }]}>
                  {t("maliki_zakat_calculator")}
                </Text>
                <Text style={[styles.subtitle, { color: MALIKI_PRIMARY }]}>
                  {t("according_to_maliki_school")}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={[styles.madhabButton, { backgroundColor: MALIKI_PRIMARY + "20" }]}
              onPress={() => setShowMadhabInfo(true)}
            >
              <BookOpen size={18} color={MALIKI_PRIMARY} />
            </TouchableOpacity>
          </View>
        </View>
      </LinearGradient>

      {/* Barre de résultats FIXE */}
      <Animated.View style={[styles.fixedResultsBar, { opacity: fadeAnim }]}>
        <LinearGradient
          colors={
            results && results.isZakatDue ?
              [MALIKI_PRIMARY, "#dfe6e0ff"] :
            results && !results.hawlCompleted ?
              ["#fef3c7", "#fde68a"] :
            results && !results.isNisabReached ?
              [getNisabNotReachedBackground(), "#e8f5e8"] :
              ["#e5e7eb", "#d1d5db"]
          }
          style={[styles.fixedResultsContent, { borderColor: results ? getStatusColor() : "#94a3b8" }]}
        >
          <View style={styles.fixedResultsHeader}>
            <View style={styles.fixedResultsStatus}>
              {results ? (
                <>
                  {results.isZakatDue ? (
                    <>
                      <CheckCircle size={18} color={MALIKI_PRIMARY} />
                      <Text style={[styles.fixedStatusText, { color: MALIKI_PRIMARY }]}>
                        {t("zakat_due")}
                      </Text>
                    </>
                  ) : !results.hawlCompleted ? (
                    <>
                      <Clock size={18} color="#f59e0b" />
                      <Text style={[styles.fixedStatusText, { color: "#f59e0b" }]}>
                        {t("hawl_not_completed")}
                      </Text>
                    </>
                  ) : !results.isNisabReached ? (
                    <>
                      <AlertCircle size={18} color={getNisabNotReachedTextColor()} />
                      <Text style={[styles.fixedStatusText, { color: getNisabNotReachedTextColor() }]}>
                        {t("nisab_not_reached")}
                      </Text>
                    </>
                  ) : (
                    <>
                      <Info size={18} color="#94a3b8" />
                      <Text style={[styles.fixedStatusText, { color: "#94a3b8" }]}>
                        {t("no_zakat_due")}
                      </Text>
                    </>
                  )}
                </>
              ) : (
                <>
                  <Info size={18} color="#94a3b8" />
                  <Text style={[styles.fixedStatusText, { color: "#94a3b8" }]}>
                    {t("enter_data")}
                  </Text>
                </>
              )}
            </View>

            <TouchableOpacity
              style={[styles.settingsButton, { backgroundColor: MALIKI_PRIMARY + "20" }]}
              onPress={() => setShowSettingsModal(true)}
            >
              <Sliders size={16} color={MALIKI_PRIMARY} />
            </TouchableOpacity>
          </View>

          <View style={styles.fixedResultsDetails}>
            <View style={styles.fixedDetailItem}>
              <Text style={[styles.fixedDetailLabel, { color: getSecondaryTextColor() }]}>
                {t("net_worth")}
              </Text>
              <Text style={[styles.fixedDetailValue, { color: getTextColor() }]}>
                {results ? formatCurrency(results.netWorth) : "-"}
              </Text>
            </View>

            <View style={styles.fixedDetailItem}>
              <Text style={[styles.fixedDetailLabel, { color: getSecondaryTextColor() }]}>
                {t("zakat")}
              </Text>
              <Text style={[styles.fixedZakatValue, { color: results && results.isZakatDue ? MALIKI_PRIMARY : getSecondaryTextColor() }]}>
                {results ? formatCurrency(results.zakatAmount) : "-"}
              </Text>
            </View>

            <TouchableOpacity
              style={styles.fixedViewDetails}
              onPress={() => setShowResultsModal(true)}
              disabled={!results}
            >
              <Text style={[styles.fixedViewDetailsText, {
                color: results ? getSecondaryTextColor() : getSecondaryTextColor() + "80"
              }]}>
                {t("details")}
              </Text>
              <ChevronDown size={14} color={results ? getSecondaryTextColor() : getSecondaryTextColor() + "80"} />
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </Animated.View>

      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[MALIKI_PRIMARY]}
            tintColor={MALIKI_PRIMARY}
          />
        }
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingTop: 110 }}
      >
        {/* Onglets de navigation */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.tabsContainer}
        >
          {[
            { id: "money", title: t("money"), icon: DollarSign },
            { id: "metals", title: t("metals"), icon: Gem },
            { id: "trade", title: t("trade"), icon: ShoppingCart },
            { id: "agriculture", title: t("agriculture"), icon: Leaf },
            { id: "livestock", title: t("livestock"), icon: Package },
            { id: "debts", title: t("debts"), icon: CreditCard },
            { id: "other", title: t("other"), icon: Package },
          ].map(tab => (
            <TouchableOpacity
              key={tab.id}
              style={[
                styles.tabButton,
                activeTab === tab.id && { backgroundColor: MALIKI_PRIMARY + "20" },
              ]}
              onPress={() => handleTabChange(tab.id)}
            >
              <tab.icon
                size={18}
                color={activeTab === tab.id ? MALIKI_PRIMARY : getSecondaryTextColor()}
              />
              <Text style={[
                styles.tabText,
                { color: activeTab === tab.id ? MALIKI_PRIMARY : getSecondaryTextColor() },
              ]}>
                {tab.title}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Sections de saisie */}
        <View style={styles.sectionsContainer}>

          {/* Argent liquide et comptes */}
          {activeTab === "money" && (
            <View style={[styles.section, { backgroundColor: getCardColor(), borderColor: getBorderColor() }]}>
              <TouchableOpacity style={styles.sectionHeader} onPress={() => toggleSection("money")}>
                <View style={styles.sectionHeaderLeft}>
                  <View style={[styles.iconContainer, { backgroundColor: MALIKI_PRIMARY + "20" }]}>
                    <DollarSign size={18} color={MALIKI_PRIMARY} />
                  </View>
                  <Text style={[styles.sectionTitle, { color: getTextColor() }]}>
                    {t("money_and_accounts")}
                  </Text>
                </View>
                {expandedSections.money ? <ChevronUp size={18} color={getSecondaryTextColor()} /> : <ChevronDown size={18} color={getSecondaryTextColor()} />}
              </TouchableOpacity>
              {expandedSections.money && (
                <View style={styles.sectionContent}>
                  <InputField label={t("cash_in_hand")} value={formData.cash} onChangeText={(v) => handleInputChange("cash", v)} placeholder="0" keyboardType="numeric" currency={userCurrency} icon={Wallet} />
                  <InputField label={t("savings_accounts")} value={formData.savings} onChangeText={(v) => handleInputChange("savings", v)} placeholder="0" keyboardType="numeric" currency={userCurrency} icon={Banknote} />
                  <InputField label={t("current_accounts")} value={formData.currentAccounts} onChangeText={(v) => handleInputChange("currentAccounts", v)} placeholder="0" keyboardType="numeric" currency={userCurrency} icon={CreditCard} />
                  <InputField label={t("fixed_deposits")} value={formData.fixedDeposits} onChangeText={(v) => handleInputChange("fixedDeposits", v)} placeholder="0" keyboardType="numeric" currency={userCurrency} icon={Clock} />
                </View>
              )}
            </View>
          )}

          {/* Métaux précieux */}
          {activeTab === "metals" && (
            <View style={[styles.section, { backgroundColor: getCardColor(), borderColor: getBorderColor() }]}>
              <TouchableOpacity style={styles.sectionHeader} onPress={() => toggleSection("metals")}>
                <View style={styles.sectionHeaderLeft}>
                  <View style={[styles.iconContainer, { backgroundColor: MALIKI_PRIMARY + "20" }]}>
                    <Gem size={18} color={MALIKI_PRIMARY} />
                  </View>
                  <Text style={[styles.sectionTitle, { color: getTextColor() }]}>{t("precious_metals")}</Text>
                </View>
                {expandedSections.metals ? <ChevronUp size={18} color={getSecondaryTextColor()} /> : <ChevronDown size={18} color={getSecondaryTextColor()} />}
              </TouchableOpacity>
              {expandedSections.metals && (
                <View style={styles.sectionContent}>
                  <View style={styles.row}>
                    <View style={styles.halfInput}>
                      <InputField label={t("gold_weight")} value={formData.goldWeight} onChangeText={(v) => handleInputChange("goldWeight", v)} placeholder="0" keyboardType="numeric" unit="g" icon={Gem} />
                    </View>
                    <View style={styles.halfInput}>
                      <Text style={[styles.pickerLabel, { color: getSecondaryTextColor() }]}>{t("purity")}</Text>
                      <View style={styles.pickerButtons}>
                        {["24k", "21k", "18k"].map(purity => (
                          <TouchableOpacity key={purity} style={[styles.purityButton, formData.goldPurity === purity && { backgroundColor: MALIKI_PRIMARY }]} onPress={() => handleInputChange("goldPurity", purity)}>
                            <Text style={[styles.purityText, formData.goldPurity === purity && { color: "#ffffff" }, { color: getSecondaryTextColor() }]}>{purity}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  </View>
                  <View style={styles.row}>
                    <View style={styles.halfInput}>
                      <InputField label={t("silver_weight")} value={formData.silverWeight} onChangeText={(v) => handleInputChange("silverWeight", v)} placeholder="0" keyboardType="numeric" unit="g" icon={Coins} />
                    </View>
                    <View style={styles.halfInput}>
                      <Text style={[styles.pickerLabel, { color: getSecondaryTextColor() }]}>{t("purity")}</Text>
                      <View style={styles.pickerButtons}>
                        {["999", "925"].map(purity => (
                          <TouchableOpacity key={purity} style={[styles.purityButton, formData.silverPurity === purity && { backgroundColor: MALIKI_PRIMARY }]} onPress={() => handleInputChange("silverPurity", purity)}>
                            <Text style={[styles.purityText, formData.silverPurity === purity && { color: "#ffffff" }, { color: getSecondaryTextColor() }]}>{purity}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  </View>
                </View>
              )}
            </View>
          )}

          {/* Biens commerciaux */}
          {activeTab === "trade" && (
            <View style={[styles.section, { backgroundColor: getCardColor(), borderColor: getBorderColor() }]}>
              <TouchableOpacity style={styles.sectionHeader} onPress={() => toggleSection("trade")}>
                <View style={styles.sectionHeaderLeft}>
                  <View style={[styles.iconContainer, { backgroundColor: MALIKI_PRIMARY + "20" }]}>
                    <ShoppingCart size={18} color={MALIKI_PRIMARY} />
                  </View>
                  <Text style={[styles.sectionTitle, { color: getTextColor() }]}>{t("trade_goods_and_properties")}</Text>
                </View>
                {expandedSections.trade ? <ChevronUp size={18} color={getSecondaryTextColor()} /> : <ChevronDown size={18} color={getSecondaryTextColor()} />}
              </TouchableOpacity>
              {expandedSections.trade && (
                <View style={styles.sectionContent}>
                  <InputField label={t("trade_goods_value")} value={formData.tradeGoodsValue} onChangeText={(v) => handleInputChange("tradeGoodsValue", v)} placeholder="0" keyboardType="numeric" currency={userCurrency} icon={ShoppingCart} />
                  <InputField label={t("business_inventory")} value={formData.businessInventory} onChangeText={(v) => handleInputChange("businessInventory", v)} placeholder="0" keyboardType="numeric" currency={userCurrency} icon={Warehouse} />
                  <InputField label={t("rental_properties")} value={formData.rentalProperties} onChangeText={(v) => handleInputChange("rentalProperties", v)} placeholder="0" keyboardType="numeric" currency={userCurrency} icon={Building} />
                  <InputField label={t("vehicles_value")} value={formData.vehiclesValue} onChangeText={(v) => handleInputChange("vehiclesValue", v)} placeholder="0" keyboardType="numeric" currency={userCurrency} icon={Bike} note={t("vehicles_note")} />
                  <View style={styles.toggleContainer}>
                    <Text style={[styles.toggleLabel, { color: getTextColor() }]}>{t("include_all_properties")}</Text>
                    <TouchableOpacity style={[styles.toggleButton, formData.includeAllProperties && { backgroundColor: MALIKI_PRIMARY }]} onPress={() => handleInputChange("includeAllProperties", !formData.includeAllProperties)}>
                      <View style={[styles.toggleCircle, formData.includeAllProperties && { transform: [{ translateX: 20 }] }]} />
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          )}

          {/* Agriculture */}
          {activeTab === "agriculture" && (
            <View style={[styles.section, { backgroundColor: getCardColor(), borderColor: getBorderColor() }]}>
              <TouchableOpacity style={styles.sectionHeader} onPress={() => toggleSection("agriculture")}>
                <View style={styles.sectionHeaderLeft}>
                  <View style={[styles.iconContainer, { backgroundColor: MALIKI_PRIMARY + "20" }]}>
                    <Leaf size={18} color={MALIKI_PRIMARY} />
                  </View>
                  <Text style={[styles.sectionTitle, { color: getTextColor() }]}>{t("agriculture")}</Text>
                </View>
                {expandedSections.agriculture ? <ChevronUp size={18} color={getSecondaryTextColor()} /> : <ChevronDown size={18} color={getSecondaryTextColor()} />}
              </TouchableOpacity>
              {expandedSections.agriculture && (
                <View style={styles.sectionContent}>
                  <InputField label={t("crops_weight")} value={formData.cropsWeight} onChangeText={(v) => handleInputChange("cropsWeight", v)} placeholder="0" keyboardType="numeric" unit="kg" icon={Package} />
                  <View style={styles.pickerContainer}>
                    <Text style={[styles.pickerLabel, { color: getSecondaryTextColor() }]}>{t("irrigation_type")}</Text>
                    <View style={styles.pickerButtons}>
                      <TouchableOpacity style={[styles.irrigationButton, formData.irrigationType === "rain" && { backgroundColor: MALIKI_PRIMARY }]} onPress={() => handleInputChange("irrigationType", "rain")}>
                        <Leaf size={16} color={formData.irrigationType === "rain" ? "#ffffff" : getSecondaryTextColor()} />
                        <Text style={[styles.irrigationText, formData.irrigationType === "rain" && { color: "#ffffff" }, { color: getSecondaryTextColor() }]}>{t("rain_irrigation")} (10%)</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.irrigationButton, formData.irrigationType === "cost" && { backgroundColor: MALIKI_PRIMARY }]} onPress={() => handleInputChange("irrigationType", "cost")}>
                        <DollarSign size={16} color={formData.irrigationType === "cost" ? "#ffffff" : getSecondaryTextColor()} />
                        <Text style={[styles.irrigationText, formData.irrigationType === "cost" && { color: "#ffffff" }, { color: getSecondaryTextColor() }]}>{t("cost_irrigation")} (5%)</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                  <InputField label={t("market_value")} value={formData.cropsMarketValue} onChangeText={(v) => handleInputChange("cropsMarketValue", v)} placeholder={t("estimated_automatically")} keyboardType="numeric" currency={userCurrency} icon={TrendingUp} />
                </View>
              )}
            </View>
          )}

          {/* Bétail */}
          {activeTab === "livestock" && (
            <View style={[styles.section, { backgroundColor: getCardColor(), borderColor: getBorderColor() }]}>
              <TouchableOpacity style={styles.sectionHeader} onPress={() => toggleSection("livestock")}>
                <View style={styles.sectionHeaderLeft}>
                  <View style={[styles.iconContainer, { backgroundColor: MALIKI_PRIMARY + "20" }]}>
                    <Package size={18} color={MALIKI_PRIMARY} />
                  </View>
                  <Text style={[styles.sectionTitle, { color: getTextColor() }]}>{t("livestock")}</Text>
                </View>
                {expandedSections.livestock ? <ChevronUp size={18} color={getSecondaryTextColor()} /> : <ChevronDown size={18} color={getSecondaryTextColor()} />}
              </TouchableOpacity>
              {expandedSections.livestock && (
                <View style={styles.sectionContent}>
                  <View style={styles.livestockGrid}>
                    <View style={styles.livestockItem}>
                      <View style={[styles.livestockIcon, { backgroundColor: "#fef3c7" }]}><Package size={20} color="#92400e" /></View>
                      <InputField label={t("camels")} value={formData.camelsCount} onChangeText={(v) => handleInputChange("camelsCount", v)} placeholder="0" keyboardType="numeric" unit={t("heads")} compact />
                      <Text style={[styles.livestockNote, { color: getSecondaryTextColor() }]}>{t("nisab")}: 5</Text>
                    </View>
                    <View style={styles.livestockItem}>
                      <View style={[styles.livestockIcon, { backgroundColor: "#dcfce7" }]}><Package size={20} color="#166534" /></View>
                      <InputField label={t("cows")} value={formData.cowsCount} onChangeText={(v) => handleInputChange("cowsCount", v)} placeholder="0" keyboardType="numeric" unit={t("heads")} compact />
                      <Text style={[styles.livestockNote, { color: getSecondaryTextColor() }]}>{t("nisab")}: 30</Text>
                    </View>
                  </View>
                  <View style={styles.livestockGrid}>
                    <View style={styles.livestockItem}>
                      <View style={[styles.livestockIcon, { backgroundColor: "#fef3c7" }]}><Package size={20} color="#92400e" /></View>
                      <InputField label={t("goats")} value={formData.goatsCount} onChangeText={(v) => handleInputChange("goatsCount", v)} placeholder="0" keyboardType="numeric" unit={t("heads")} compact />
                      <Text style={[styles.livestockNote, { color: getSecondaryTextColor() }]}>{t("nisab")}: 40</Text>
                    </View>
                    <View style={styles.livestockItem}>
                      <View style={[styles.livestockIcon, { backgroundColor: "#dcfce7" }]}><Package size={20} color="#166534" /></View>
                      <InputField label={t("sheep")} value={formData.sheepCount} onChangeText={(v) => handleInputChange("sheepCount", v)} placeholder="0" keyboardType="numeric" unit={t("heads")} compact />
                      <Text style={[styles.livestockNote, { color: getSecondaryTextColor() }]}>{t("nisab")}: 40</Text>
                    </View>
                  </View>
                  <View style={styles.livestockInfo}>
                    <Info size={16} color={getSecondaryTextColor()} />
                    <Text style={[styles.livestockInfoText, { color: getSecondaryTextColor() }]}>{t("livestock_calculation_note")}</Text>
                  </View>
                </View>
              )}
            </View>
          )}

          {/* Créances et dettes */}
          {activeTab === "debts" && (
            <View style={[styles.section, { backgroundColor: getCardColor(), borderColor: getBorderColor() }]}>
              <TouchableOpacity style={styles.sectionHeader} onPress={() => toggleSection("debts")}>
                <View style={styles.sectionHeaderLeft}>
                  <View style={[styles.iconContainer, { backgroundColor: MALIKI_PRIMARY + "20" }]}>
                    <CreditCard size={18} color={MALIKI_PRIMARY} />
                  </View>
                  <Text style={[styles.sectionTitle, { color: getTextColor() }]}>{t("receivables_and_debts")}</Text>
                </View>
                {expandedSections.debts ? <ChevronUp size={18} color={getSecondaryTextColor()} /> : <ChevronDown size={18} color={getSecondaryTextColor()} />}
              </TouchableOpacity>
              {expandedSections.debts && (
                <View style={styles.sectionContent}>
                  <InputField label={t("certain_receivables")} value={formData.receivables} onChangeText={(v) => handleInputChange("receivables", v)} placeholder="0" keyboardType="numeric" currency={userCurrency} icon={CheckCircle} />
                  <InputField label={t("doubtful_receivables")} value={formData.doubtfulReceivables} onChangeText={(v) => handleInputChange("doubtfulReceivables", v)} placeholder="0" keyboardType="numeric" currency={userCurrency} icon={AlertCircle} />
                  <View style={styles.toggleContainer}>
                    <Text style={[styles.toggleLabel, { color: getTextColor() }]}>{t("include_doubtful_receivables")}</Text>
                    <TouchableOpacity style={[styles.toggleButton, formData.includeAllReceivables && { backgroundColor: MALIKI_PRIMARY }]} onPress={() => handleInputChange("includeAllReceivables", !formData.includeAllReceivables)}>
                      <View style={[styles.toggleCircle, formData.includeAllReceivables && { transform: [{ translateX: 20 }] }]} />
                    </TouchableOpacity>
                  </View>
                  <InputField label={t("debts_to_pay")} value={formData.debts} onChangeText={(v) => handleInputChange("debts", v)} placeholder="0" keyboardType="numeric" currency={userCurrency} icon={CreditCard} />
                </View>
              )}
            </View>
          )}

          {/* Autres actifs */}
          {activeTab === "other" && (
            <View style={[styles.section, { backgroundColor: getCardColor(), borderColor: getBorderColor() }]}>
              <TouchableOpacity style={styles.sectionHeader} onPress={() => toggleSection("other")}>
                <View style={styles.sectionHeaderLeft}>
                  <View style={[styles.iconContainer, { backgroundColor: MALIKI_PRIMARY + "20" }]}>
                    <Package size={18} color={MALIKI_PRIMARY} />
                  </View>
                  <Text style={[styles.sectionTitle, { color: getTextColor() }]}>{t("other_assets")}</Text>
                </View>
                {expandedSections.other ? <ChevronUp size={18} color={getSecondaryTextColor()} /> : <ChevronDown size={18} color={getSecondaryTextColor()} />}
              </TouchableOpacity>
              {expandedSections.other && (
                <View style={styles.sectionContent}>
                  <InputField label={t("mining_output")} value={formData.miningOutput} onChangeText={(v) => handleInputChange("miningOutput", v)} placeholder="0" keyboardType="numeric" currency={userCurrency} icon={Diamond} note={t("mining_note")} />
                  <InputField label={t("found_treasure")} value={formData.foundTreasure} onChangeText={(v) => handleInputChange("foundTreasure", v)} placeholder="0" keyboardType="numeric" currency={userCurrency} icon={Gem} note={t("treasure_note")} />
                </View>
              )}
            </View>
          )}
        </View>

        {/* Actions */}
        <View style={[styles.actionsContainer, { backgroundColor: getBackgroundColor(), borderTopColor: getBorderColor() }]}>
          <View style={styles.actions}>
            <Button title={t("history")} onPress={handleLoadHistory} variant="outline" size="medium" style={styles.historyButton} textColor={MALIKI_ACCENT} borderColor={MALIKI_ACCENT} icon={Clock} />
            <Button title={t("save")} onPress={handleSaveCalculation} size="medium" style={styles.saveButton} backgroundColor={MALIKI_SECONDARY} textColor="#ffffff" icon={CheckCircle} disabled={!results || results.netWorth === 0} />
            <Button title={t("reset")} onPress={resetCalculator} variant="outline" size="medium" style={styles.resetButton} textColor={MALIKI_PRIMARY} borderColor={MALIKI_PRIMARY} icon={Calculator} />
          </View>
        </View>

        {/* Principes Maliki */}
        <View style={styles.principlesSection}>
          <Text style={[styles.principlesTitle, { color: getTextColor(), textAlign: 'center', marginBottom: 16 }]}>
            {t("maliki_principles")}
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.principlesScrollContainer}>
            {[
              { title: t("maliki_nisab"), description: t("maliki_nisab_desc"), icon: Scale, color: MALIKI_PRIMARY },
              { title: t("maliki_receivables"), description: t("maliki_receivables_desc"), icon: CreditCard, color: MALIKI_SECONDARY },
              { title: t("maliki_trade_goods"), description: t("maliki_trade_goods_desc"), icon: ShoppingCart, color: MALIKI_ACCENT },
              { title: t("maliki_agriculture"), description: t("maliki_agriculture_desc"), icon: Leaf, color: "#2e7d32" },
              { title: t("maliki_livestock"), description: t("maliki_livestock_desc"), icon: Package, color: "#795548" },
            ].map((principle, index) => (
              <View key={index} style={[styles.principleCard, { backgroundColor: getCardColor() }]}>
                <View style={[styles.principleIcon, { backgroundColor: principle.color + "20" }]}>
                  <principle.icon size={24} color={principle.color} />
                </View>
                <Text style={[styles.principleTitle, { color: getTextColor() }]}>{principle.title}</Text>
                <Text style={[styles.principleDesc, { color: getSecondaryTextColor() }]}>{principle.description}</Text>
              </View>
            ))}
          </ScrollView>
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Modal Historique */}
      <Modal visible={showHistoryModal} animationType="slide" transparent={true} onRequestClose={() => setShowHistoryModal(false)}>
        <View style={styles.modalContainer}>
          <View style={[styles.modalContent, { backgroundColor: getCardColor() }]}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderLeft}>
                <View style={[styles.modalIcon, { backgroundColor: MALIKI_ACCENT + "20" }]}>
                  <Clock size={24} color={MALIKI_ACCENT} />
                </View>
                <View>
                  <Text style={[styles.modalTitle, { color: getTextColor() }]}>{t("history")}</Text>
                  <Text style={[styles.modalSubtitle, { color: MALIKI_ACCENT }]}>{t("your_zakat_history")}</Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => setShowHistoryModal(false)} style={styles.closeButton}>
                <Text style={{ color: getSecondaryTextColor(), fontSize: 20 }}>×</Text>
              </TouchableOpacity>
            </View>

            {loadingHistory ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={MALIKI_PRIMARY} />
                <Text style={[styles.loadingText, { color: getSecondaryTextColor() }]}>{t("loading")}...</Text>
              </View>
            ) : (
              <ScrollView style={styles.modalScroll}>
                <View style={styles.historySection}>
                  <Text style={[styles.historySectionTitle, { color: getTextColor() }]}>{t("annual_calculations")}</Text>
                  {zakatHistory.length === 0 ? (
                    <Text style={[styles.emptyText, { color: getSecondaryTextColor() }]}>{t("no_annual_calculations")}</Text>
                  ) : (
                    zakatHistory.map((item, index) => (
                      <View key={index} style={[styles.historyCard, { backgroundColor: getBackgroundColor() }]}>
                        <View style={styles.historyCardHeader}>
                          <Text style={[styles.historyYear, { color: MALIKI_PRIMARY }]}>{t("year")} {item.annee_hijri}H</Text>
                          <View style={[styles.statusBadge, item.statut === 'PAYE' ? styles.statusPaid : item.statut === 'NON_PAYE' ? styles.statusUnpaid : styles.statusExempt]}>
                            <Text style={styles.statusText}>{item.statut}</Text>
                          </View>
                        </View>
                        <View style={styles.historyCardDetails}>
                          <View style={styles.historyDetailRow}>
                            <Text style={[styles.historyLabel, { color: getSecondaryTextColor() }]}>{t("net_worth")}:</Text>
                            <Text style={[styles.historyValue, { color: getTextColor() }]}>{formatCurrency(item.montant_imposable)}</Text>
                          </View>
                          <View style={styles.historyDetailRow}>
                            <Text style={[styles.historyLabel, { color: getSecondaryTextColor() }]}>{t("zakat_calculated")}:</Text>
                            <Text style={[styles.historyValue, { color: MALIKI_PRIMARY }]}>{formatCurrency(item.montant_zakat_calcule)}</Text>
                          </View>
                          {item.montant_zakat_paye > 0 && (
                            <View style={styles.historyDetailRow}>
                              <Text style={[styles.historyLabel, { color: getSecondaryTextColor() }]}>{t("paid")}:</Text>
                              <Text style={[styles.historyValue, { color: "#10b981" }]}>{formatCurrency(item.montant_zakat_paye)}</Text>
                            </View>
                          )}
                          {item.montant_restant > 0 && (
                            <View style={styles.historyDetailRow}>
                              <Text style={[styles.historyLabel, { color: getSecondaryTextColor() }]}>{t("remaining")}:</Text>
                              <Text style={[styles.historyValue, { color: "#ef4444" }]}>{formatCurrency(item.montant_restant)}</Text>
                            </View>
                          )}
                        </View>
                        <Text style={[styles.historyDate, { color: getSecondaryTextColor() }]}>{new Date(item.created_at).toLocaleDateString()}</Text>
                      </View>
                    ))
                  )}
                </View>

                <View style={styles.historySection}>
                  <Text style={[styles.historySectionTitle, { color: getTextColor() }]}>{t("assets_history")}</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.historyFilterTabs}>
                    {["all", "money", "metals", "trade", "agriculture", "livestock", "debts", "other"].map(tab => (
                      <TouchableOpacity key={tab} style={[styles.historyTabButton, historyFilterTab === tab && { backgroundColor: MALIKI_PRIMARY + "20" }]} onPress={() => setHistoryFilterTab(tab)}>
                        <Text style={[styles.historyTabText, { color: historyFilterTab === tab ? MALIKI_PRIMARY : getSecondaryTextColor() }]}>{t(tab) || tab}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                  {actifsHistory.length === 0 ? (
                    <Text style={[styles.emptyText, { color: getSecondaryTextColor() }]}>{t("no_assets_recorded")}</Text>
                  ) : (
                    actifsHistory.filter(item => {
                      if (historyFilterTab === "all") return true;
                      const typeName = (item.type_zakat?.nom_type || "").toLowerCase();
                      switch(historyFilterTab) {
                        case "money": return typeName.includes("argent") || typeName.includes("cash") || typeName.includes("epargne");
                        case "metals": return typeName.includes("or") || typeName.includes("argent_metal");
                        case "trade": return typeName.includes("commerce");
                        case "agriculture": return typeName.includes("agriculture");
                        case "livestock": return typeName.includes("betail");
                        case "debts": return typeName.includes("creance");
                        default: return true;
                      }
                    }).slice(0, 20).map((item, index) => (
                      <View key={index} style={[styles.assetCard, { backgroundColor: getBackgroundColor() }]}>
                        <View style={styles.assetHeader}>
                          <Text style={[styles.assetName, { color: getTextColor() }]}>{item.nom_actif}</Text>
                          <View style={[styles.assetTypeBadge, { backgroundColor: MALIKI_PRIMARY + "20" }]}>
                            <Text style={[styles.assetType, { color: MALIKI_PRIMARY }]}>{item.type_zakat?.nom_type}</Text>
                          </View>
                        </View>
                        <View style={styles.assetDetails}>
                          <Text style={[styles.assetQuantity, { color: getSecondaryTextColor() }]}>{item.quantite} {item.type_zakat?.unite_mesure || ''}</Text>
                          <Text style={[styles.assetValue, { color: getTextColor() }]}>{formatCurrency(item.valeur_totale)}</Text>
                        </View>
                        <Text style={[styles.assetDate, { color: getSecondaryTextColor() }]}>
                          {new Date(item.created_at).toLocaleDateString()} à {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                      </View>
                    ))
                  )}
                </View>
              </ScrollView>
            )}

            <View style={styles.modalActions}>
              <Button title={t("close")} onPress={() => setShowHistoryModal(false)} backgroundColor={MALIKI_PRIMARY} textColor="#ffffff" style={styles.applyButton} />
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal Paramètres */}
      <Modal visible={showSettingsModal} animationType="slide" transparent={true} onRequestClose={() => setShowSettingsModal(false)}>
        <View style={styles.modalContainer}>
          <View style={[styles.modalContent, { backgroundColor: getCardColor() }]}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderLeft}>
                <View style={[styles.modalIcon, { backgroundColor: MALIKI_PRIMARY + "20" }]}>
                  <Settings size={24} color={MALIKI_PRIMARY} />
                </View>
                <View>
                  <Text style={[styles.modalTitle, { color: getTextColor() }]}>{t("maliki_settings")}</Text>
                  <Text style={[styles.modalSubtitle, { color: MALIKI_PRIMARY }]}>{t("settings")}</Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => setShowSettingsModal(false)} style={styles.closeButton}>
                <Text style={{ color: getSecondaryTextColor(), fontSize: 20 }}>×</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScroll}>
              {/* Localisation */}
              <View style={styles.settingSection}>
                <Text style={[styles.settingSectionTitle, { color: getTextColor() }]}>{t("location")} & {t("currency")}</Text>
                <View style={[styles.locationCard, { backgroundColor: MALIKI_PRIMARY + "10", borderColor: MALIKI_PRIMARY, borderWidth: 1.5 }]}>
                  <View style={styles.locationHeader}>
                    <MapPin size={20} color={MALIKI_PRIMARY} />
                    <Text style={[styles.locationTitle, { color: getTextColor() }]}>{t("your_location")}</Text>
                  </View>
                  <View style={styles.locationDetails}>
                    <View style={styles.locationItem}>
                      <Text style={[styles.locationLabel, { color: getSecondaryTextColor() }]}>{t("country")}:</Text>
                      <Text style={[styles.locationValue, { color: getTextColor() }]}>{userCountry?.name || t("detecting")}</Text>
                    </View>
                    <View style={styles.locationItem}>
                      <Text style={[styles.locationLabel, { color: getSecondaryTextColor() }]}>{t("city")}:</Text>
                      <Text style={[styles.locationValue, { color: getTextColor() }]}>{userCountry?.city || t("detecting")}</Text>
                    </View>
                    <View style={styles.locationItem}>
                      <Text style={[styles.locationLabel, { color: getSecondaryTextColor() }]}>{t("currency")}:</Text>
                      <Text style={[styles.currencyValue, { color: MALIKI_PRIMARY }]}>{userCurrency}</Text>
                    </View>
                  </View>
                </View>
              </View>

              <View style={[styles.divider, { backgroundColor: getBorderColor() }]} />

              {/* Nisab */}
              <View style={styles.settingSection}>
                <Text style={[styles.settingSectionTitle, { color: getTextColor() }]}>{t("nisab_base")}</Text>
                <View style={styles.settingButtons}>
                  <TouchableOpacity style={[styles.settingButton, formData.nisabBase === "silver" && { backgroundColor: MALIKI_PRIMARY }]} onPress={() => handleInputChange("nisabBase", "silver")}>
                    <Coins size={20} color={formData.nisabBase === "silver" ? "#ffffff" : MALIKI_PRIMARY} />
                    <Text style={[styles.settingButtonText, formData.nisabBase === "silver" && { color: "#ffffff" }, { color: getTextColor() }]}>{t("silver")}</Text>
                    <Text style={[styles.settingButtonSubtext, formData.nisabBase === "silver" && { color: "#ffffffCC" }, { color: getSecondaryTextColor() }]}>{formatCurrency(MALIKI_NISAB.silver * defaultPrices.silver999)}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.settingButton, formData.nisabBase === "gold" && { backgroundColor: MALIKI_PRIMARY }]} onPress={() => handleInputChange("nisabBase", "gold")}>
                    <Gem size={20} color={formData.nisabBase === "gold" ? "#ffffff" : MALIKI_PRIMARY} />
                    <Text style={[styles.settingButtonText, formData.nisabBase === "gold" && { color: "#ffffff" }, { color: getTextColor() }]}>{t("gold")}</Text>
                    <Text style={[styles.settingButtonSubtext, formData.nisabBase === "gold" && { color: "#ffffffCC" }, { color: getSecondaryTextColor() }]}>{formatCurrency(MALIKI_NISAB.gold * defaultPrices.gold24k)}</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Hawl */}
              <View style={styles.settingSection}>
                <Text style={[styles.settingSectionTitle, { color: getTextColor() }]}>{t("hawl_period")}</Text>
                <View style={styles.hawlInfoCard}>
                  <Clock size={24} color={MALIKI_PRIMARY} />
                  <View style={styles.hawlInfoTexts}>
                    <Text style={[styles.hawlStatus, { color: hawlStatus.completed ? '#10b981' : '#f59e0b' }]}>
                      {hawlStatus.completed ? t("hawl_completed") : t("hawl_not_completed")}
                    </Text>
                    {!hawlStatus.completed && hawlStatus.daysRemaining > 0 && (
                      <Text style={[styles.hawlDays, { color: getSecondaryTextColor() }]}>
                        {t("days_remaining")}: {hawlStatus.daysRemaining} {t("days")}
                      </Text>
                    )}
                    {hawlStatus.nextAnniversary && (
                      <Text style={[styles.hawlDate, { color: getSecondaryTextColor() }]}>
                        {t("next_anniversary")}: {new Date(hawlStatus.nextAnniversary).toLocaleDateString()}
                      </Text>
                    )}
                    {hawlStatus.message && !hawlStatus.completed && (
                      <Text style={[styles.hawlMessage, { color: MALIKI_PRIMARY }]}>{hawlStatus.message}</Text>
                    )}
                  </View>
                </View>
                <Text style={[styles.hawlNote, { color: getSecondaryTextColor(), marginTop: 12 }]}>
                  ℹ️ {t("hawl_note")}
                </Text>
              </View>
            </ScrollView>

            <View style={styles.modalActions}>
              <Button title={t("apply")} onPress={() => setShowSettingsModal(false)} backgroundColor={MALIKI_PRIMARY} textColor="#ffffff" style={styles.applyButton} />
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal Résultats */}
      <Modal visible={showResultsModal} animationType="slide" transparent={true} onRequestClose={() => setShowResultsModal(false)}>
        <View style={styles.modalContainer}>
          <View style={[styles.modalContent, { backgroundColor: getCardColor() }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: getTextColor() }]}>{t("zakat_calculation_details")}</Text>
              <TouchableOpacity onPress={() => setShowResultsModal(false)} style={styles.closeButton}>
                <Text style={{ color: getSecondaryTextColor() }}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalScroll}>
              {results && (
                <>
                  <View style={styles.modalSummary}>
                    {[
                      { label: t("total_assets"), value: results.totalAssets },
                      { label: t("total_deductions"), value: results.totalDeductions },
                      { label: t("net_worth"), value: results.netWorth },
                      { label: t("nisab_threshold"), value: results.nisabThreshold },
                    ].map((item, i) => (
                      <View key={i} style={styles.summaryItem}>
                        <Text style={[styles.summaryLabel, { color: getSecondaryTextColor() }]}>{item.label}</Text>
                        <Text style={[styles.summaryValue, { color: getTextColor() }]}>{formatCurrency(item.value)}</Text>
                      </View>
                    ))}
                  </View>

                  <View style={[
                    styles.statusCard,
                    results.isZakatDue ? styles.statusDue :
                    !results.hawlCompleted ? styles.statusHawl :
                    !results.isNisabReached ? [styles.statusNisab, { backgroundColor: getNisabNotReachedBackground(), borderLeftColor: getNisabNotReachedTextColor() }] :
                    styles.statusNoZakat
                  ]}>
                    <View style={styles.statusHeader}>
                      {results.isZakatDue ? <CheckCircle size={24} color={MALIKI_PRIMARY} /> :
                       !results.hawlCompleted ? <Clock size={24} color="#f59e0b" /> :
                       !results.isNisabReached ? <AlertCircle size={24} color={getNisabNotReachedTextColor()} /> :
                       <Info size={24} color="#94a3b8" />}
                      <Text style={[styles.statusTitle, {
                        color: results.isZakatDue ? MALIKI_PRIMARY :
                               !results.hawlCompleted ? "#f59e0b" :
                               !results.isNisabReached ? getNisabNotReachedTextColor() : "#94a3b8"
                      }]}>
                        {results.isZakatDue ? t("zakat_due_maliki") :
                         !results.hawlCompleted ? t("hawl_not_completed") :
                         !results.isNisabReached ? t("nisab_not_reached") :
                         t("no_zakat_due")}
                      </Text>
                    </View>
                    {results.isZakatDue && (
                      <View style={styles.zakatAmountCard}>
                        <Text style={[styles.zakatAmountLabel, { color: getSecondaryTextColor() }]}>{t("zakat_amount")}</Text>
                        <Text style={[styles.zakatAmountValue, { color: MALIKI_PRIMARY }]}>{formatCurrency(results.zakatAmount)}</Text>
                      </View>
                    )}
                  </View>

                  {results.isZakatDue && results.zakatAmount > 0 && (
                    <View style={styles.finalCalculation}>
                      <Text style={[styles.finalCalculationTitle, { color: getTextColor() }]}>{t("final_calculation")}</Text>
                      <View style={styles.finalAmount}>
                        <Text style={[styles.finalAmountLabel, { color: getSecondaryTextColor() }]}>{t("total_zakat_due")}</Text>
                        <Text style={[styles.finalAmountValue, { color: MALIKI_PRIMARY }]}>{formatCurrency(results.zakatAmount)}</Text>
                      </View>
                    </View>
                  )}
                </>
              )}
            </ScrollView>
            <View style={styles.modalActions}>
              <Button title={t("close")} onPress={() => setShowResultsModal(false)} variant="outline" textColor={MALIKI_PRIMARY} borderColor={MALIKI_PRIMARY} />
              <Button title={t("save_calculation")} onPress={handleSaveCalculation} backgroundColor={MALIKI_PRIMARY} textColor="#ffffff" />
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal Madhab Info */}
      <Modal visible={showMadhabInfo} animationType="fade" transparent={true} onRequestClose={() => setShowMadhabInfo(false)}>
        <View style={styles.infoModalContainer}>
          <View style={[styles.infoModalContent, { backgroundColor: getCardColor() }]}>
            <View style={styles.infoModalHeader}>
              <View style={[styles.madhabIcon, { backgroundColor: MALIKI_PRIMARY + "20" }]}>
                <Crown size={32} color={MALIKI_PRIMARY} />
              </View>
              <Text style={[styles.infoModalTitle, { color: getTextColor() }]}>{t("maliki_school")}</Text>
              <Text style={[styles.infoModalSubtitle, { color: MALIKI_PRIMARY }]}>الإمام مالك بن أنس</Text>
            </View>
            <View style={styles.infoModalScrollContainer}>
              <ScrollView style={styles.infoModalScroll} showsVerticalScrollIndicator={true} contentContainerStyle={styles.infoModalScrollContent}>
                <Text style={[styles.infoModalText, { color: getTextColor() }]}>{t("maliki_school_description")}</Text>
                <View style={styles.infoSection}>
                  <Text style={[styles.infoSectionTitle, { color: getTextColor() }]}>{t("key_features")}</Text>
                  {[t("maliki_feature_1"), t("maliki_feature_2"), t("maliki_feature_3"), t("maliki_feature_4"), t("maliki_feature_5")].map((feature, index) => (
                    <View key={index} style={styles.featureItem}>
                      <Sparkles size={16} color={MALIKI_PRIMARY} />
                      <Text style={[styles.featureText, { color: getSecondaryTextColor() }]}>{feature}</Text>
                    </View>
                  ))}
                </View>
              </ScrollView>
            </View>
            <Button title={t("understand")} onPress={() => setShowMadhabInfo(false)} backgroundColor={MALIKI_PRIMARY} textColor="#ffffff" style={styles.infoModalButton} />
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerGradient: { paddingTop: Platform.OS === "ios" ? 45 : 35, paddingHorizontal: 16, paddingBottom: 12, borderBottomLeftRadius: 20, borderBottomRightRadius: 20 },
  header: { marginTop: 8 },
  headerTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  titleContainer: { flexDirection: "row", alignItems: "center", flex: 1 },
  titleIcon: { width: 40, height: 40, borderRadius: 20, justifyContent: "center", alignItems: "center", marginRight: 10 },
  title: { fontSize: 20, fontWeight: "bold" },
  subtitle: { fontSize: 11, fontWeight: "600", marginTop: 2 },
  madhabButton: { width: 40, height: 40, borderRadius: 20, justifyContent: "center", alignItems: "center" },
  fixedResultsBar: { position: 'absolute', top: Platform.OS === "ios" ? 105 : 95, left: 16, right: 16, zIndex: 100, elevation: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8 },
  fixedResultsContent: { borderRadius: 12, padding: 12, borderWidth: 2, borderBottomWidth: 4 },
  fixedResultsHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  fixedResultsStatus: { flexDirection: "row", alignItems: "center", flex: 1 },
  fixedStatusText: { fontSize: 14, fontWeight: "bold", marginLeft: 6 },
  settingsButton: { width: 32, height: 32, borderRadius: 16, justifyContent: "center", alignItems: "center", marginLeft: 8 },
  fixedResultsDetails: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  fixedDetailItem: { flex: 1, marginRight: 8 },
  fixedDetailLabel: { fontSize: 10, marginBottom: 2 },
  fixedDetailValue: { fontSize: 14, fontWeight: "bold" },
  fixedZakatValue: { fontSize: 16, fontWeight: "bold" },
  fixedViewDetails: { flexDirection: "row", alignItems: "center", paddingHorizontal: 8, paddingVertical: 4 },
  fixedViewDetailsText: { fontSize: 11, fontWeight: "500", marginRight: 4 },
  scrollView: { flex: 1 },
  tabsContainer: { paddingHorizontal: 16, marginTop: 8, marginBottom: 12 },
  tabButton: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, marginRight: 8, borderWidth: 1, borderColor: "rgba(0,0,0,0.1)" },
  tabText: { fontSize: 12, fontWeight: "600", marginLeft: 5 },
  sectionsContainer: { paddingHorizontal: 16, paddingBottom: 20 },
  section: { borderRadius: 12, marginBottom: 12, borderWidth: 1, overflow: "hidden" },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 14 },
  sectionHeaderLeft: { flexDirection: "row", alignItems: "center", flex: 1 },
  iconContainer: { width: 36, height: 36, borderRadius: 18, justifyContent: "center", alignItems: "center", marginRight: 10 },
  sectionTitle: { fontSize: 15, fontWeight: "bold", flex: 1 },
  sectionContent: { paddingHorizontal: 14, paddingBottom: 14 },
  row: { flexDirection: "row", justifyContent: "space-between", marginBottom: 12 },
  halfInput: { width: "48%" },
  pickerLabel: { fontSize: 12, fontWeight: "500", marginBottom: 6 },
  pickerButtons: { flexDirection: "row" },
  purityButton: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, marginRight: 6, borderWidth: 1, borderColor: "rgba(0,0,0,0.1)" },
  purityText: { fontSize: 11, fontWeight: "500" },
  toggleContainer: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 16, padding: 12, borderRadius: 12, backgroundColor: "rgba(0,0,0,0.03)" },
  toggleLabel: { fontSize: 14, fontWeight: "500", flex: 1 },
  toggleButton: { width: 44, height: 24, borderRadius: 12, backgroundColor: "rgba(0,0,0,0.1)", justifyContent: "center", padding: 2 },
  toggleCircle: { width: 20, height: 20, borderRadius: 10, backgroundColor: "#ffffff" },
  livestockGrid: { flexDirection: "row", justifyContent: "space-between", marginBottom: 16 },
  livestockItem: { width: "48%", alignItems: "center" },
  livestockIcon: { width: 40, height: 40, borderRadius: 20, justifyContent: "center", alignItems: "center", marginBottom: 8 },
  livestockNote: { fontSize: 10, marginTop: 4, textAlign: "center" },
  livestockInfo: { flexDirection: "row", alignItems: "flex-start", backgroundColor: "rgba(0,0,0,0.05)", padding: 12, borderRadius: 8, marginTop: 16 },
  livestockInfoText: { fontSize: 12, lineHeight: 16, flex: 1, marginLeft: 8 },
  pickerContainer: { marginBottom: 12 },
  irrigationButton: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10, marginRight: 8, borderWidth: 1, borderColor: "rgba(0,0,0,0.1)", flex: 1, justifyContent: "center" },
  irrigationText: { fontSize: 12, fontWeight: "500", marginLeft: 8 },
  bottomSpacer: { height: 100 },
  actionsContainer: { position: "relative", bottom: 0, left: 0, right: 0, borderTopWidth: 1, paddingHorizontal: 16, paddingVertical: 8, paddingBottom: Platform.OS === "ios" ? 25 : 16 },
  actions: { flexDirection: "row", justifyContent: "space-between" },
  historyButton: { flex: 1, marginRight: 6, minHeight: 48 },
  saveButton: { flex: 1, marginHorizontal: 6, minHeight: 48 },
  resetButton: { flex: 1, marginLeft: 6, minHeight: 48 },
  principlesSection: { marginHorizontal: 16, marginBottom: 20, alignItems: "center" },
  principlesTitle: { fontSize: 18, fontWeight: "bold" },
  principlesScrollContainer: { paddingHorizontal: 10, paddingVertical: 5 },
  principleCard: { width: 200, padding: 16, borderRadius: 16, marginHorizontal: 6, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  principleIcon: { width: 40, height: 40, borderRadius: 20, justifyContent: "center", alignItems: "center", marginBottom: 12 },
  principleTitle: { fontSize: 14, fontWeight: "bold", marginBottom: 8 },
  principleDesc: { fontSize: 12, lineHeight: 16 },
  modalContainer: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalContent: { borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: SCREEN_HEIGHT * 0.85 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, borderBottomWidth: 1, borderBottomColor: "rgba(0,0,0,0.1)" },
  modalHeaderLeft: { flexDirection: "row", alignItems: "center", flex: 1 },
  modalIcon: { width: 48, height: 48, borderRadius: 24, justifyContent: "center", alignItems: "center", marginRight: 12 },
  modalTitle: { fontSize: 20, fontWeight: "bold" },
  modalSubtitle: { fontSize: 12, marginTop: 2 },
  closeButton: { width: 32, height: 32, borderRadius: 16, justifyContent: "center", alignItems: "center" },
  modalScroll: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 20 },
  modalActions: { padding: 20, borderTopWidth: 1, borderTopColor: "rgba(0,0,0,0.1)" },
  applyButton: { minHeight: 50 },
  settingSection: { marginBottom: 24 },
  settingSectionTitle: { fontSize: 18, fontWeight: "bold", marginBottom: 4 },
  settingButtons: { flexDirection: "row", justifyContent: "space-between" },
  settingButton: { flex: 1, padding: 16, borderRadius: 12, borderWidth: 1, borderColor: "rgba(0,0,0,0.1)", alignItems: "center", marginHorizontal: 6 },
  settingButtonText: { fontSize: 14, fontWeight: "600", marginTop: 8, marginBottom: 4 },
  settingButtonSubtext: { fontSize: 11 },
  locationCard: { padding: 16, borderRadius: 12, marginBottom: 16 },
  locationHeader: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  locationTitle: { fontSize: 16, fontWeight: "bold", marginLeft: 8 },
  locationDetails: { gap: 8 },
  locationItem: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 8 },
  locationLabel: { fontSize: 13, fontWeight: "500" },
  locationValue: { fontSize: 14, fontWeight: "600" },
  currencyValue: { fontSize: 16, fontWeight: "bold", paddingHorizontal: 12, paddingVertical: 4, borderRadius: 6, backgroundColor: MALIKI_PRIMARY + "20" },
  divider: { height: 1, marginVertical: 16 },
  hawlInfoCard: { flexDirection: 'row', padding: 16, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.03)', alignItems: 'flex-start', gap: 12, borderWidth: 1, borderColor: 'rgba(0,0,0,0.05)' },
  hawlInfoTexts: { flex: 1 },
  hawlStatus: { fontSize: 16, fontWeight: 'bold', marginBottom: 4 },
  hawlDays: { fontSize: 13, marginBottom: 2 },
  hawlDate: { fontSize: 12, marginBottom: 2 },
  hawlMessage: { fontSize: 13, fontStyle: 'italic', marginTop: 4 },
  hawlNote: { fontSize: 11, lineHeight: 16, fontStyle: 'italic', paddingHorizontal: 4 },
  modalSummary: { marginVertical: 20 },
  summaryItem: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "rgba(0,0,0,0.05)" },
  summaryLabel: { fontSize: 14 },
  summaryValue: { fontSize: 16, fontWeight: "600" },
  statusCard: { padding: 16, borderRadius: 12, marginBottom: 20 },
  statusDue: { backgroundColor: MALIKI_PRIMARY + "10", borderLeftWidth: 4, borderLeftColor: MALIKI_PRIMARY },
  statusHawl: { backgroundColor: "#fef3c7", borderLeftWidth: 4, borderLeftColor: "#f59e0b" },
  statusNisab: { borderLeftWidth: 4 },
  statusNoZakat: { backgroundColor: "#f3f4f6", borderLeftWidth: 4, borderLeftColor: "#94a3b8" },
  statusHeader: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  statusTitle: { fontSize: 16, fontWeight: "bold", marginLeft: 8 },
  zakatAmountCard: { backgroundColor: "rgba(255,255,255,0.8)", padding: 12, borderRadius: 8, marginTop: 8 },
  zakatAmountLabel: { fontSize: 12, marginBottom: 4 },
  zakatAmountValue: { fontSize: 24, fontWeight: "bold" },
  finalCalculation: { marginVertical: 20, padding: 16, backgroundColor: "rgba(26, 93, 26, 0.05)", borderRadius: 12 },
  finalCalculationTitle: { fontSize: 18, fontWeight: "bold", marginBottom: 12, textAlign: "center" },
  finalAmount: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingTop: 12, borderTopWidth: 2, borderTopColor: "rgba(26, 93, 26, 0.2)" },
  finalAmountLabel: { fontSize: 16, fontWeight: "600" },
  finalAmountValue: { fontSize: 24, fontWeight: "bold" },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  loadingText: { marginTop: 12, fontSize: 14 },
  historySection: { marginBottom: 24 },
  historySectionTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 16 },
  emptyText: { textAlign: 'center', fontSize: 14, padding: 20 },
  historyCard: { padding: 16, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(0,0,0,0.1)' },
  historyCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  historyYear: { fontSize: 16, fontWeight: 'bold' },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
  statusPaid: { backgroundColor: '#10b981' },
  statusUnpaid: { backgroundColor: '#ef4444' },
  statusExempt: { backgroundColor: '#94a3b8' },
  statusText: { color: '#ffffff', fontSize: 11, fontWeight: '600' },
  historyCardDetails: { marginBottom: 12 },
  historyDetailRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  historyLabel: { fontSize: 13 },
  historyValue: { fontSize: 14, fontWeight: '600' },
  historyDate: { fontSize: 11, textAlign: 'right' },
  historyFilterTabs: { marginBottom: 16 },
  historyTabButton: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, marginRight: 8, borderWidth: 1, borderColor: "rgba(0,0,0,0.1)", gap: 4 },
  historyTabText: { fontSize: 12, fontWeight: "600", marginLeft: 4 },
  assetCard: { padding: 12, borderRadius: 8, marginBottom: 8, borderWidth: 1, borderColor: 'rgba(0,0,0,0.05)' },
  assetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  assetName: { fontSize: 14, fontWeight: '600', flex: 1 },
  assetTypeBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  assetType: { fontSize: 11, fontWeight: "600" },
  assetDetails: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  assetQuantity: { fontSize: 12 },
  assetValue: { fontSize: 14, fontWeight: '600' },
  assetDate: { fontSize: 10, textAlign: 'right' },
  infoModalContainer: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center", padding: 20 },
  infoModalContent: { width: "100%", height: "70%", maxHeight: SCREEN_HEIGHT * 0.85, borderRadius: 24, padding: 24, flexDirection: "column" },
  infoModalHeader: { alignItems: "center", marginBottom: 16 },
  infoModalScrollContainer: { flex: 1, marginVertical: 16, minHeight: 200 },
  infoModalScroll: { flex: 1 },
  infoModalScrollContent: { flexGrow: 1, paddingBottom: 10 },
  madhabIcon: { width: 64, height: 64, borderRadius: 32, justifyContent: "center", alignItems: "center", marginBottom: 16 },
  infoModalTitle: { fontSize: 24, fontWeight: "bold", textAlign: "center" },
  infoModalSubtitle: { fontSize: 16, fontWeight: "500", marginTop: 8, textAlign: "center" },
  infoModalText: { fontSize: 14, lineHeight: 22, marginBottom: 24, textAlign: "center" },
  infoSection: { marginTop: 16 },
  infoSectionTitle: { fontSize: 18, fontWeight: "bold", marginBottom: 16 },
  featureItem: { flexDirection: "row", alignItems: "flex-start", marginBottom: 12 },
  featureText: { fontSize: 14, lineHeight: 20, flex: 1, marginLeft: 12 },
  infoModalButton: { marginTop: 24 },
  detailedBreakdown: { marginVertical: 20 },
  breakdownTitle: { fontSize: 18, fontWeight: "bold", marginBottom: 16 },
});

export default ZakatCalculatorScreen;