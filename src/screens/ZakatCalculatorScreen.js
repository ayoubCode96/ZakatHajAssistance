import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";

import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  StyleSheet,
  StatusBar,
  Dimensions,
  RefreshControl,
  Modal,
  Animated,
  Platform,
  KeyboardAvoidingView,
  FlatList
} from "react-native";
import { useAppTranslation } from "../hooks/useTranslation";
import { useTheme } from "../context/ThemeContext";
import { useCurrency } from "../context/CurrencyContext";
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
  const {
    userCurrency,
    metalsPrices,
    formatCurrency,
    refreshData,
      userCountry,  // 👈 AJOUTER SI DISPONIBLE
  userCity,
  } = useCurrency();

  // État principal
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
    nisabBase: "silver",
    includeAllReceivables: false,
    includeAllProperties: true,
    hawlCompleted: true,
  });

  // État pour les résultats
  const [results, setResults] = useState(null);
  const [calculationSteps, setCalculationSteps] = useState([]);
  const [showResultsModal, setShowResultsModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showMadhabInfo, setShowMadhabInfo] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const calculateTimeoutRef = useRef(null);
  const lastFormDataRef = useRef(formData);
  
  // Références pour le défilement
  const scrollViewRef = useRef(null);

  // Couleurs thématiques Maliki

  
  const getBackgroundColor = () =>
    currentTheme === "dark" ? MALIKI_DARK : MALIKI_LIGHT;
  
  const getCardColor = () => 
    currentTheme === "dark" ? "#1a2a1a" : "#ffffff";
  
  const getTextColor = () => 
    currentTheme === "dark" ? "#e8edf5ff" : "#1a2a1a";
  
  const getSecondaryTextColor = () =>
    currentTheme === "dark" ? "#a8c6a8" : "#4a6b4a";
  
  const getBorderColor = () =>
    currentTheme === "dark" ? "#334155" : "#e2e8f0";

  const getNisabNotReachedBackground = () => {
    return currentTheme === "dark" ? "#1e3a1e" : "#f0f7f0";
  };

  const getNisabNotReachedTextColor = () => {
    return currentTheme === "dark" ? "#a8c6a8" : "#166534";
  };

  // Prix par défaut des métaux
  const defaultPrices = useMemo(() => ({
    gold24k: metalsPrices?.gold || 65.42,
    gold18k: metalsPrices?.gold ? metalsPrices.gold * 0.75 : 49.07,
    gold21k: metalsPrices?.gold ? metalsPrices.gold * 0.875 : 57.24,
    silver999: metalsPrices?.silver || 0.82,
    silver925: metalsPrices?.silver ? metalsPrices.silver * 0.925 : 0.76,
  }), [metalsPrices]);

  // Nisab selon Maliki
  const MALIKI_NISAB = {
    gold: 85,
    silver: 595,
    crops: 653,
    camels: 5,
    cows: 30,
    sheepGoats: 40,
  };

  // Fonction de calcul
  const calculateMalikiZakat = (currentFormData = formData) => {
    const parseValue = (val) => Math.max(0, parseFloat(val || 0));
    
    // Calculer les valeurs
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

    // Calcul du total
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
    
    const totalDeductions = debts;
    const netWorth = totalAssets - totalDeductions;

    // Calcul du Nisab
    const nisabThreshold = currentFormData.nisabBase === "gold" ? 
      MALIKI_NISAB.gold * defaultPrices.gold24k : 
      MALIKI_NISAB.silver * defaultPrices.silver999;

    const hawlCompleted = currentFormData.hawlCompleted;
    const isNisabReached = netWorth >= nisabThreshold;
    
    // Calcul de la Zakat
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
      hawlCompleted: currentFormData.hawlCompleted,
      zakatAmount,
      breakdown,
      isZakatDue: currentFormData.hawlCompleted && isNisabReached && zakatAmount > 0,
    };
  };
  
  // Calculer les résultats avec debouncing
  useEffect(() => {
    if (calculateTimeoutRef.current) {
      clearTimeout(calculateTimeoutRef.current);
    }
    
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
      if (calculateTimeoutRef.current) {
        clearTimeout(calculateTimeoutRef.current);
      }
    };
  }, [formData]);

  // Fonction pour changer d'onglet
  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    setExpandedSections(prev => ({
      ...prev,
      [tabId]: true,
    }));
  };

  // Fonction optimisée pour changer les inputs
  const handleInputChange = useCallback((field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  }, []);

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const resetCalculator = () => {
    setFormData({
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
      nisabBase: "silver",
      includeAllReceivables: false,
      includeAllProperties: true,
      hawlCompleted: true,
    });
    
    fadeAnim.setValue(0);
    
    if (calculateTimeoutRef.current) {
      clearTimeout(calculateTimeoutRef.current);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshData();
    setRefreshing(false);
  };

  // Nettoyer les timeouts
  useEffect(() => {
    return () => {
      if (calculateTimeoutRef.current) {
        clearTimeout(calculateTimeoutRef.current);
      }
    };
  }, []);

  // Fonction pour obtenir la couleur de statut
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
        colors={currentTheme === "dark" ? 
          [MALIKI_DARK, "#0a3a0a"] : 
          [MALIKI_LIGHT, "#e8f5e8"]}
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

{/* Barre de résultats FIXE - Toujours visible */}
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
    style={[
      styles.fixedResultsContent,
      { borderColor: results ? getStatusColor() : "#94a3b8" }
    ]}
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
      
      {/* Bouton de paramétrage */}
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
              <Text
                style={[
                  styles.tabText,
                  { color: activeTab === tab.id ? MALIKI_PRIMARY : getSecondaryTextColor() },
                ]}
              >
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
              <TouchableOpacity
                style={styles.sectionHeader}
                onPress={() => toggleSection("money")}
              >
                <View style={styles.sectionHeaderLeft}>
                  <View style={[styles.iconContainer, { backgroundColor: MALIKI_PRIMARY + "20" }]}>
                    <DollarSign size={18} color={MALIKI_PRIMARY} />
                  </View>
                  <Text style={[styles.sectionTitle, { color: getTextColor() }]}>
                    {t("money_and_accounts")}
                  </Text>
                </View>
                {expandedSections.money ? (
                  <ChevronUp size={18} color={getSecondaryTextColor()} />
                ) : (
                  <ChevronDown size={18} color={getSecondaryTextColor()} />
                )}
              </TouchableOpacity>
              
              {expandedSections.money && (
                <View style={styles.sectionContent}>
                  <InputField
                    label={t("cash_in_hand")}
                    value={formData.cash}
                    onChangeText={(value) => handleInputChange("cash", value)}
                    placeholder="0"
                    keyboardType="numeric"
                    currency={userCurrency}
                    icon={Wallet}
                  />
                  <InputField
                    label={t("savings_accounts")}
                    value={formData.savings}
                    onChangeText={(value) => handleInputChange("savings", value)}
                    placeholder="0"
                    keyboardType="numeric"
                    currency={userCurrency}
                    icon={Banknote}
                  />
                  <InputField
                    label={t("current_accounts")}
                    value={formData.currentAccounts}
                    onChangeText={(value) => handleInputChange("currentAccounts", value)}
                    placeholder="0"
                    keyboardType="numeric"
                    currency={userCurrency}
                    icon={CreditCard}
                  />
                  <InputField
                    label={t("fixed_deposits")}
                    value={formData.fixedDeposits}
                    onChangeText={(value) => handleInputChange("fixedDeposits", value)}
                    placeholder="0"
                    keyboardType="numeric"
                    currency={userCurrency}
                    icon={Clock}
                  />
                </View>
              )}
            </View>
          )}

          {/* Métaux précieux */}
          {activeTab === "metals" && (
            <View style={[styles.section, { backgroundColor: getCardColor(), borderColor: getBorderColor() }]}>
              <TouchableOpacity
                style={styles.sectionHeader}
                onPress={() => toggleSection("metals")}
              >
                <View style={styles.sectionHeaderLeft}>
                  <View style={[styles.iconContainer, { backgroundColor: MALIKI_PRIMARY + "20" }]}>
                    <Gem size={18} color={MALIKI_PRIMARY} />
                  </View>
                  <Text style={[styles.sectionTitle, { color: getTextColor() }]}>
                    {t("precious_metals")}
                  </Text>
                </View>
                {expandedSections.metals ? (
                  <ChevronUp size={18} color={getSecondaryTextColor()} />
                ) : (
                  <ChevronDown size={18} color={getSecondaryTextColor()} />
                )}
              </TouchableOpacity>
              
              {expandedSections.metals && (
                <View style={styles.sectionContent}>
                  <View style={styles.row}>
                    <View style={styles.halfInput}>
                      <InputField
                        label={t("gold_weight")}
                        value={formData.goldWeight}
                        onChangeText={(value) => handleInputChange("goldWeight", value)}
                        placeholder="0"
                        keyboardType="numeric"
                        unit="g"
                        icon={Gem}
                      />
                    </View>
                    <View style={styles.halfInput}>
                      <Text style={[styles.pickerLabel, { color: getSecondaryTextColor() }]}>
                        {t("purity")}
                      </Text>
                      <View style={styles.pickerButtons}>
                        {["24k", "21k", "18k"].map(purity => (
                          <TouchableOpacity
                            key={purity}
                            style={[
                              styles.purityButton,
                              formData.goldPurity === purity && { backgroundColor: MALIKI_PRIMARY },
                            ]}
                            onPress={() => handleInputChange("goldPurity", purity)}
                          >
                            <Text style={[
                              styles.purityText,
                              formData.goldPurity === purity && { color: "#ffffff" },
                              { color: getSecondaryTextColor() },
                            ]}>
                              {purity}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  </View>

                  <View style={styles.row}>
                    <View style={styles.halfInput}>
                      <InputField
                        label={t("silver_weight")}
                        value={formData.silverWeight}
                        onChangeText={(value) => handleInputChange("silverWeight", value)}
                        placeholder="0"
                        keyboardType="numeric"
                        unit="g"
                        icon={Coins}
                      />
                    </View>
                    <View style={styles.halfInput}>
                      <Text style={[styles.pickerLabel, { color: getSecondaryTextColor() }]}>
                        {t("purity")}
                      </Text>
                      <View style={styles.pickerButtons}>
                        {["999", "925"].map(purity => (
                          <TouchableOpacity
                            key={purity}
                            style={[
                              styles.purityButton,
                              formData.silverPurity === purity && { backgroundColor: MALIKI_PRIMARY },
                            ]}
                            onPress={() => handleInputChange("silverPurity", purity)}
                          >
                            <Text style={[
                              styles.purityText,
                              formData.silverPurity === purity && { color: "#ffffff" },
                              { color: getSecondaryTextColor() },
                            ]}>
                              {purity}
                            </Text>
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
              <TouchableOpacity
                style={styles.sectionHeader}
                onPress={() => toggleSection("trade")}
              >
                <View style={styles.sectionHeaderLeft}>
                  <View style={[styles.iconContainer, { backgroundColor: MALIKI_PRIMARY + "20" }]}>
                    <ShoppingCart size={18} color={MALIKI_PRIMARY} />
                  </View>
                  <Text style={[styles.sectionTitle, { color: getTextColor() }]}>
                    {t("trade_goods_and_properties")}
                  </Text>
                </View>
                {expandedSections.trade ? (
                  <ChevronUp size={18} color={getSecondaryTextColor()} />
                ) : (
                  <ChevronDown size={18} color={getSecondaryTextColor()} />
                )}
              </TouchableOpacity>
              
              {expandedSections.trade && (
                <View style={styles.sectionContent}>
                  <InputField
                    label={t("trade_goods_value")}
                    value={formData.tradeGoodsValue}
                    onChangeText={(value) => handleInputChange("tradeGoodsValue", value)}
                    placeholder="0"
                    keyboardType="numeric"
                    currency={userCurrency}
                    icon={ShoppingCart}
                  />
                  <InputField
                    label={t("business_inventory")}
                    value={formData.businessInventory}
                    onChangeText={(value) => handleInputChange("businessInventory", value)}
                    placeholder="0"
                    keyboardType="numeric"
                    currency={userCurrency}
                    icon={Warehouse}
                  />
                  <InputField
                    label={t("rental_properties")}
                    value={formData.rentalProperties}
                    onChangeText={(value) => handleInputChange("rentalProperties", value)}
                    placeholder="0"
                    keyboardType="numeric"
                    currency={userCurrency}
                    icon={Building}
                  />
                  
                  <InputField
                    label={t("vehicles_value")}
                    value={formData.vehiclesValue}
                    onChangeText={(value) => handleInputChange("vehiclesValue", value)}
                    placeholder="0"
                    keyboardType="numeric"
                    currency={userCurrency}
                    icon={Bike}
                    note={t("vehicles_note")}
                  />
                  
                  <View style={styles.toggleContainer}>
                    <Text style={[styles.toggleLabel, { color: getTextColor() }]}>
                      {t("include_all_properties")}
                    </Text>
                    <TouchableOpacity
                      style={[
                        styles.toggleButton,
                        formData.includeAllProperties && { backgroundColor: MALIKI_PRIMARY },
                      ]}
                      onPress={() => handleInputChange("includeAllProperties", !formData.includeAllProperties)}
                    >
                      <View style={[
                        styles.toggleCircle,
                        formData.includeAllProperties && { transform: [{ translateX: 20 }] },
                      ]} />
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          )}

          {/* Agriculture */}
          {activeTab === "agriculture" && (
            <View style={[styles.section, { backgroundColor: getCardColor(), borderColor: getBorderColor() }]}>
              <TouchableOpacity
                style={styles.sectionHeader}
                onPress={() => toggleSection("agriculture")}
              >
                <View style={styles.sectionHeaderLeft}>
                  <View style={[styles.iconContainer, { backgroundColor: MALIKI_PRIMARY + "20" }]}>
                    <Leaf size={18} color={MALIKI_PRIMARY} />
                  </View>
                  <Text style={[styles.sectionTitle, { color: getTextColor() }]}>
                    {t("agriculture")}
                  </Text>
                </View>
                {expandedSections.agriculture ? (
                  <ChevronUp size={18} color={getSecondaryTextColor()} />
                ) : (
                  <ChevronDown size={18} color={getSecondaryTextColor()} />
                )}
              </TouchableOpacity>
              
              {expandedSections.agriculture && (
                <View style={styles.sectionContent}>
                  <InputField
                    label={t("crops_weight")}
                    value={formData.cropsWeight}
                    onChangeText={(value) => handleInputChange("cropsWeight", value)}
                    placeholder="0"
                    keyboardType="numeric"
                    unit="kg"
                    icon={Package}
                  />
                  
                  <View style={styles.pickerContainer}>
                    <Text style={[styles.pickerLabel, { color: getSecondaryTextColor() }]}>
                      {t("irrigation_type")}
                    </Text>
                    <View style={styles.pickerButtons}>
                      <TouchableOpacity
                        style={[
                          styles.irrigationButton,
                          formData.irrigationType === "rain" && {
                            backgroundColor: MALIKI_PRIMARY,
                          },
                        ]}
                        onPress={() => handleInputChange("irrigationType", "rain")}
                      >
                        <Leaf size={16} color={formData.irrigationType === "rain" ? "#ffffff" : getSecondaryTextColor()} />
                        <Text
                          style={[
                            styles.irrigationText,
                            formData.irrigationType === "rain" && { color: "#ffffff" },
                            { color: getSecondaryTextColor() },
                          ]}
                        >
                          {t("rain_irrigation")} (10%)
                        </Text>
                      </TouchableOpacity>
                      
                      <TouchableOpacity
                        style={[
                          styles.irrigationButton,
                          formData.irrigationType === "cost" && {
                            backgroundColor: MALIKI_PRIMARY,
                          },
                        ]}
                        onPress={() => handleInputChange("irrigationType", "cost")}
                      >
                        <DollarSign size={16} color={formData.irrigationType === "cost" ? "#ffffff" : getSecondaryTextColor()} />
                        <Text
                          style={[
                            styles.irrigationText,
                            formData.irrigationType === "cost" && { color: "#ffffff" },
                            { color: getSecondaryTextColor() },
                          ]}
                        >
                          {t("cost_irrigation")} (5%)
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                  
                  <InputField
                    label={t("market_value")}
                    value={formData.cropsMarketValue}
                    onChangeText={(value) => handleInputChange("cropsMarketValue", value)}
                    placeholder={t("estimated_automatically")}
                    keyboardType="numeric"
                    currency={userCurrency}
                    icon={TrendingUp}
                  />
                </View>
              )}
            </View>
          )}

          {/* Bétail */}
          {activeTab === "livestock" && (
            <View style={[styles.section, { backgroundColor: getCardColor(), borderColor: getBorderColor() }]}>
              <TouchableOpacity
                style={styles.sectionHeader}
                onPress={() => toggleSection("livestock")}
              >
                <View style={styles.sectionHeaderLeft}>
                  <View style={[styles.iconContainer, { backgroundColor: MALIKI_PRIMARY + "20" }]}>
                    <Package size={18} color={MALIKI_PRIMARY} />
                  </View>
                  <Text style={[styles.sectionTitle, { color: getTextColor() }]}>
                    {t("livestock")}
                  </Text>
                </View>
                {expandedSections.livestock ? (
                  <ChevronUp size={18} color={getSecondaryTextColor()} />
                ) : (
                  <ChevronDown size={18} color={getSecondaryTextColor()} />
                )}
              </TouchableOpacity>
              
              {expandedSections.livestock && (
                <View style={styles.sectionContent}>
                  <View style={styles.livestockGrid}>
                    <View style={styles.livestockItem}>
                      <View style={[styles.livestockIcon, { backgroundColor: "#fef3c7" }]}>
                        <Package size={20} color="#92400e" />
                      </View>
                      <InputField
                        label={t("camels")}
                        value={formData.camelsCount}
                        onChangeText={(value) => handleInputChange("camelsCount", value)}
                        placeholder="0"
                        keyboardType="numeric"
                        unit={t("heads")}
                        compact
                      />
                      <Text style={[styles.livestockNote, { color: getSecondaryTextColor() }]}>
                        {t("nisab")}: 5
                      </Text>
                    </View>
                    
                    <View style={styles.livestockItem}>
                      <View style={[styles.livestockIcon, { backgroundColor: "#dcfce7" }]}>
                        <Package size={20} color="#166534" />
                      </View>
                      <InputField
                        label={t("cows")}
                        value={formData.cowsCount}
                        onChangeText={(value) => handleInputChange("cowsCount", value)}
                        placeholder="0"
                        keyboardType="numeric"
                        unit={t("heads")}
                        compact
                      />
                      <Text style={[styles.livestockNote, { color: getSecondaryTextColor() }]}>
                        {t("nisab")}: 30
                      </Text>
                    </View>
                  </View>
                  
                  <View style={styles.livestockGrid}>
                    <View style={styles.livestockItem}>
                      <View style={[styles.livestockIcon, { backgroundColor: "#fef3c7" }]}>
                        <Package size={20} color="#92400e" />
                      </View>
                      <InputField
                        label={t("goats")}
                        value={formData.goatsCount}
                        onChangeText={(value) => handleInputChange("goatsCount", value)}
                        placeholder="0"
                        keyboardType="numeric"
                        unit={t("heads")}
                        compact
                      />
                      <Text style={[styles.livestockNote, { color: getSecondaryTextColor() }]}>
                        {t("nisab")}: 40
                      </Text>
                    </View>
                    
                    <View style={styles.livestockItem}>
                      <View style={[styles.livestockIcon, { backgroundColor: "#dcfce7" }]}>
                        <Package size={20} color="#166534" />
                      </View>
                      <InputField
                        label={t("sheep")}
                        value={formData.sheepCount}
                        onChangeText={(value) => handleInputChange("sheepCount", value)}
                        placeholder="0"
                        keyboardType="numeric"
                        unit={t("heads")}
                        compact
                      />
                      <Text style={[styles.livestockNote, { color: getSecondaryTextColor() }]}>
                        {t("nisab")}: 40
                      </Text>
                    </View>
                  </View>
                  
                  <View style={styles.livestockInfo}>
                    <Info size={16} color={getSecondaryTextColor()} />
                    <Text style={[styles.livestockInfoText, { color: getSecondaryTextColor() }]}>
                      {t("livestock_calculation_note")}
                    </Text>
                  </View>
                </View>
              )}
            </View>
          )}

          {/* Créances et dettes */}
          {activeTab === "debts" && (
            <View style={[styles.section, { backgroundColor: getCardColor(), borderColor: getBorderColor() }]}>
              <TouchableOpacity
                style={styles.sectionHeader}
                onPress={() => toggleSection("debts")}
              >
                <View style={styles.sectionHeaderLeft}>
                  <View style={[styles.iconContainer, { backgroundColor: MALIKI_PRIMARY + "20" }]}>
                    <CreditCard size={18} color={MALIKI_PRIMARY} />
                  </View>
                  <Text style={[styles.sectionTitle, { color: getTextColor() }]}>
                    {t("receivables_and_debts")}
                  </Text>
                </View>
                {expandedSections.debts ? (
                  <ChevronUp size={18} color={getSecondaryTextColor()} />
                ) : (
                  <ChevronDown size={18} color={getSecondaryTextColor()} />
                )}
              </TouchableOpacity>
              
              {expandedSections.debts && (
                <View style={styles.sectionContent}>
                  <InputField
                    label={t("certain_receivables")}
                    value={formData.receivables}
                    onChangeText={(value) => handleInputChange("receivables", value)}
                    placeholder="0"
                    keyboardType="numeric"
                    currency={userCurrency}
                    icon={CheckCircle}
                  />
                  
                  <InputField
                    label={t("doubtful_receivables")}
                    value={formData.doubtfulReceivables}
                    onChangeText={(value) => handleInputChange("doubtfulReceivables", value)}
                    placeholder="0"
                    keyboardType="numeric"
                    currency={userCurrency}
                    icon={AlertCircle}
                  />
                  
                  <View style={styles.toggleContainer}>
                    <Text style={[styles.toggleLabel, { color: getTextColor() }]}>
                      {t("include_doubtful_receivables")}
                    </Text>
                    <TouchableOpacity
                      style={[
                        styles.toggleButton,
                        formData.includeAllReceivables && { backgroundColor: MALIKI_PRIMARY },
                      ]}
                      onPress={() => handleInputChange("includeAllReceivables", !formData.includeAllReceivables)}
                    >
                      <View style={[
                        styles.toggleCircle,
                        formData.includeAllReceivables && { transform: [{ translateX: 20 }] },
                      ]} />
                    </TouchableOpacity>
                  </View>
                  
                  <InputField
                    label={t("debts_to_pay")}
                    value={formData.debts}
                    onChangeText={(value) => handleInputChange("debts", value)}
                    placeholder="0"
                    keyboardType="numeric"
                    currency={userCurrency}
                    icon={CreditCard}
                  />
                </View>
              )}
            </View>
          )}

          {/* Autres actifs */}
          {activeTab === "other" && (
            <View style={[styles.section, { backgroundColor: getCardColor(), borderColor: getBorderColor() }]}>
              <TouchableOpacity
                style={styles.sectionHeader}
                onPress={() => toggleSection("other")}
              >
                <View style={styles.sectionHeaderLeft}>
                  <View style={[styles.iconContainer, { backgroundColor: MALIKI_PRIMARY + "20" }]}>
                    <Package size={18} color={MALIKI_PRIMARY} />
                  </View>
                  <Text style={[styles.sectionTitle, { color: getTextColor() }]}>
                    {t("other_assets")}
                  </Text>
                </View>
                {expandedSections.other ? (
                  <ChevronUp size={18} color={getSecondaryTextColor()} />
                ) : (
                  <ChevronDown size={18} color={getSecondaryTextColor()} />
                )}
              </TouchableOpacity>
              
              {expandedSections.other && (
                <View style={styles.sectionContent}>
                  <InputField
                    label={t("mining_output")}
                    value={formData.miningOutput}
                    onChangeText={(value) => handleInputChange("miningOutput", value)}
                    placeholder="0"
                    keyboardType="numeric"
                    currency={userCurrency}
                    icon={Diamond}
                    note={t("mining_note")}
                  />
                  
                  <InputField
                    label={t("found_treasure")}
                    value={formData.foundTreasure}
                    onChangeText={(value) => handleInputChange("foundTreasure", value)}
                    placeholder="0"
                    keyboardType="numeric"
                    currency={userCurrency}
                    icon={Gem}
                    note={t("treasure_note")}
                  />
                </View>
              )}
            </View>
          )}
        </View>
        
        
      <View style={[styles.actionsContainer, { backgroundColor: getBackgroundColor(), borderTopColor: getBorderColor() }]}>
        <View style={styles.actions}>
          <Button
            title={t("reset_all")}
            onPress={resetCalculator}
            variant="outline"
            size="medium"
            style={styles.resetButton}
            textColor={MALIKI_PRIMARY}
            borderColor={MALIKI_PRIMARY}
            icon={Calculator}
          />
          <Button
            title={t("view_details")}
            onPress={() => setShowResultsModal(true)}
            size="medium"
            style={styles.detailsButton}
            backgroundColor={MALIKI_PRIMARY}
            textColor="#ffffff"
            icon={Percent}
            disabled={!results || results.netWorth === 0}
          />
        </View>
      </View>
                {/* Principes de l'école Maliki - CENTRÉ (AJOUTÉ) */}
        <View style={styles.principlesSection}>
          <Text style={[styles.principlesTitle, { 
            color: getTextColor(), 
            textAlign: 'center',
            marginBottom: 16 
          }]}>
            {t("maliki_principles")}
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.principlesScrollContainer}
          >
            {[
              {
                title: t("maliki_nisab"),
                description: t("maliki_nisab_desc"),
                icon: Scale,
                color: MALIKI_PRIMARY,
              },
              {
                title: t("maliki_receivables"),
                description: t("maliki_receivables_desc"),
                icon: CreditCard,
                color: MALIKI_SECONDARY,
              },
              {
                title: t("maliki_trade_goods"),
                description: t("maliki_trade_goods_desc"),
                icon: ShoppingCart,
                color: MALIKI_ACCENT,
              },
              {
                title: t("maliki_agriculture"),
                description: t("maliki_agriculture_desc"),
                icon: Leaf,
                color: "#2e7d32",
              },
              {
                title: t("maliki_livestock"),
                description: t("maliki_livestock_desc"),
                icon: Package,
                color: "#795548",
              },
            ].map((principle, index) => (
              <View key={index} style={[styles.principleCard, { backgroundColor: getCardColor() }]}>
                <View style={[styles.principleIcon, { backgroundColor: principle.color + "20" }]}>
                  <principle.icon size={24} color={principle.color} />
                </View>
                <Text style={[styles.principleTitle, { color: getTextColor() }]}>
                  {principle.title}
                </Text>
                <Text style={[styles.principleDesc, { color: getSecondaryTextColor() }]}>
                  {principle.description}
                </Text>
              </View>
            ))}
          </ScrollView>
        </View>

        {/* Espace pour les boutons fixes en bas */}
        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Boutons d'action fixes en bas */}


      {/* Modal des paramètres Maliki */}
      <Modal
        visible={showSettingsModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowSettingsModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={[styles.modalContent, { backgroundColor: getCardColor() }]}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderLeft}>
                <View style={[styles.modalIcon, { backgroundColor: MALIKI_PRIMARY + "20" }]}>
                  <Settings size={24} color={MALIKI_PRIMARY} />
                </View>
                <View>
                  <Text style={[styles.modalTitle, { color: getTextColor() }]}>
                    {t("maliki_settings")}
                  </Text>
                  <Text style={[styles.modalSubtitle, { color: MALIKI_PRIMARY }]}>
                    {t("settings")}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => setShowSettingsModal(false)}
                style={styles.closeButton}
              >
                <Text style={{ color: getSecondaryTextColor(), fontSize: 20 }}>×</Text>
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.modalScroll}>
              {/* Section Localisation et Devise */}
              <View style={styles.settingSection}>
                <Text style={[styles.settingSectionTitle, { color: getTextColor() }]}>
                  {t("location")} & {t("currency")}
                </Text>

                {/* Carte de localisation */}
                <View style={[styles.locationCard, { 
                  backgroundColor: MALIKI_PRIMARY + "10",
                  borderColor: MALIKI_PRIMARY,
                  borderWidth: 1.5,
                }]}>
                  <View style={styles.locationHeader}>
                    <MapPin size={20} color={MALIKI_PRIMARY} />
                    <Text style={[styles.locationTitle, { color: getTextColor() }]}>
                      {t("your_location")}
                    </Text>
                  </View>
                  
                  <View style={styles.locationDetails}>
                    <View style={styles.locationItem}>
                      <Text style={[styles.locationLabel, { color: getSecondaryTextColor() }]}>
                        {t("country")}:
                      </Text>
                      <Text style={[styles.locationValue, { color: getTextColor() }]}>
                        {userCountry?.name || t("detecting")}
                      </Text>
                    </View>
                    
                    <View style={styles.locationItem}>
                      <Text style={[styles.locationLabel, { color: getSecondaryTextColor() }]}>
                        {t("city")}:
                      </Text>
                      <Text style={[styles.locationValue, { color: getTextColor() }]}>
                        {userCountry?.city || t("detecting")}
                      </Text>
                    </View>

                    <View style={styles.locationItem}>
                      <Text style={[styles.locationLabel, { color: getSecondaryTextColor() }]}>
                        {t("currency")}:
                      </Text>
                      <Text style={[styles.currencyValue, { color: MALIKI_PRIMARY }]}>
                        {userCurrency}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>

              {/* Barre de séparation */}
              <View style={[styles.divider, { backgroundColor: getBorderColor() }]} />

              {/* Section Nisab */}
              <View style={styles.settingSection}>
                <Text style={[styles.settingSectionTitle, { color: getTextColor() }]}>
                  {t("nisab_base")}
                </Text>

                
                <View style={styles.settingButtons}>
                  <TouchableOpacity
                    style={[
                      styles.settingButton,
                      formData.nisabBase === "silver" && { backgroundColor: MALIKI_PRIMARY },
                    ]}
                    onPress={() => handleInputChange("nisabBase", "silver")}
                  >
                    <Coins size={20} color={formData.nisabBase === "silver" ? "#ffffff" : MALIKI_PRIMARY} />
                    <Text style={[
                      styles.settingButtonText,
                      formData.nisabBase === "silver" && { color: "#ffffff" },
                      { color: getTextColor() },
                    ]}>
                      {t("silver")}
                    </Text>
                    <Text style={[
                      styles.settingButtonSubtext,
                      formData.nisabBase === "silver" && { color: "#ffffff" + "CC" },
                      { color: getSecondaryTextColor() },
                    ]}>
                      {formatCurrency(MALIKI_NISAB.silver * defaultPrices.silver999)}
                    </Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[
                      styles.settingButton,
                      formData.nisabBase === "gold" && { backgroundColor: MALIKI_PRIMARY },
                    ]}
                    onPress={() => handleInputChange("nisabBase", "gold")}
                  >
                    <Gem size={20} color={formData.nisabBase === "gold" ? "#ffffff" : MALIKI_PRIMARY} />
                    <Text style={[
                      styles.settingButtonText,
                      formData.nisabBase === "gold" && { color: "#ffffff" },
                      { color: getTextColor() },
                    ]}>
                      {t("gold")}
                    </Text>
                    <Text style={[
                      styles.settingButtonSubtext,
                      formData.nisabBase === "gold" && { color: "#ffffff" + "CC" },
                      { color: getSecondaryTextColor() },
                    ]}>
                      {formatCurrency(MALIKI_NISAB.gold * defaultPrices.gold24k)}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Section Hawl */}
              <View style={styles.settingSection}>
                <Text style={[styles.settingSectionTitle, { color: getTextColor() }]}>
                  {t("hawl_period")}
                </Text>

                <View style={styles.hawlSetting}>
                  <TouchableOpacity
                    style={[
                      styles.hawlSettingButton,
                      formData.hawlCompleted && { backgroundColor: MALIKI_PRIMARY },
                    ]}
                    onPress={() => handleInputChange("hawlCompleted", true)}
                  >
                    <Clock size={18} color={formData.hawlCompleted ? "#ffffff" : MALIKI_PRIMARY} />
                    <Text style={[
                      styles.hawlSettingText,
                      formData.hawlCompleted && { color: "#ffffff" },
                      { color: getTextColor() },
                    ]}>
                      {t("hawl_completed")}
                    </Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[
                      styles.hawlSettingButton,
                      !formData.hawlCompleted && { backgroundColor: "#f59e0b" },
                    ]}
                    onPress={() => handleInputChange("hawlCompleted", false)}
                  >
                    <Clock size={18} color={!formData.hawlCompleted ? "#ffffff" : "#f59e0b"} />
                    <Text style={[
                      styles.hawlSettingText,
                      !formData.hawlCompleted && { color: "#ffffff" },
                      { color: getTextColor() },
                    ]}>
                      {t("hawl_not_completed")}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

            </ScrollView>
            
            <View style={styles.modalActions}>
              <Button
                title={t("apply")}
                onPress={() => setShowSettingsModal(false)}
                backgroundColor={MALIKI_PRIMARY}
                textColor="#ffffff"
                style={styles.applyButton}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal des résultats détaillés (AVEC ÉTAPES STRUCTURÉES) */}
      <Modal
        visible={showResultsModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowResultsModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={[styles.modalContent, { backgroundColor: getCardColor() }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: getTextColor() }]}>
                {t("zakat_calculation_details")}
              </Text>
              <TouchableOpacity
                onPress={() => setShowResultsModal(false)}
                style={styles.closeButton}
              >
                <Text style={{ color: getSecondaryTextColor() }}>✕</Text>
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.modalScroll}>
              {results && (
                <>
                  {/* Résumé général */}
                  <View style={styles.modalSummary}>
                    <View style={styles.summaryItem}>
                      <Text style={[styles.summaryLabel, { color: getSecondaryTextColor() }]}>
                        {t("total_assets")}
                      </Text>
                      <Text style={[styles.summaryValue, { color: getTextColor() }]}>
                        {formatCurrency(results.totalAssets)}
                      </Text>
                    </View>
                    <View style={styles.summaryItem}>
                      <Text style={[styles.summaryLabel, { color: getSecondaryTextColor() }]}>
                        {t("total_deductions")}
                      </Text>
                      <Text style={[styles.summaryValue, { color: getTextColor() }]}>
                        {formatCurrency(results.totalDeductions)}
                      </Text>
                    </View>
                    <View style={styles.summaryItem}>
                      <Text style={[styles.summaryLabel, { color: getSecondaryTextColor() }]}>
                        {t("net_worth")}
                      </Text>
                      <Text style={[styles.summaryValue, { color: getTextColor() }]}>
                        {formatCurrency(results.netWorth)}
                      </Text>
                    </View>
                    <View style={styles.summaryItem}>
                      <Text style={[styles.summaryLabel, { color: getSecondaryTextColor() }]}>
                        {t("nisab_threshold")}
                      </Text>
                      <Text style={[styles.summaryValue, { color: getTextColor() }]}>
                        {formatCurrency(results.nisabThreshold)}
                      </Text>
                    </View>
                  </View>
                  
                  {/* Statut de la Zakat */}
                  <View style={[
                    styles.statusCard, 
                    results.isZakatDue ? styles.statusDue : 
                    !results.hawlCompleted ? styles.statusHawl : 
                    !results.isNisabReached ? [styles.statusNisab, {
                      backgroundColor: getNisabNotReachedBackground(),
                      borderLeftColor: getNisabNotReachedTextColor(),
                    }] : 
                    styles.statusNoZakat
                  ]}>
                    <View style={styles.statusHeader}>
                      {results.isZakatDue ? (
                        <CheckCircle size={24} color={MALIKI_PRIMARY} />
                      ) : !results.hawlCompleted ? (
                        <Clock size={24} color="#f59e0b" />
                      ) : !results.isNisabReached ? (
                        <AlertCircle size={24} color={getNisabNotReachedTextColor()} />
                      ) : (
                        <Info size={24} color="#94a3b8" />
                      )}
                      <Text style={[
                        styles.statusTitle,
                        results.isZakatDue ? { color: MALIKI_PRIMARY } : 
                        !results.hawlCompleted ? { color: "#f59e0b" } : 
                        !results.isNisabReached ? { color: getNisabNotReachedTextColor() } : 
                        { color: "#94a3b8" }
                      ]}>
                        {results.isZakatDue ? t("zakat_due_maliki") : 
                         !results.hawlCompleted ? t("hawl_not_completed") : 
                         !results.isNisabReached ? t("nisab_not_reached") : 
                         t("no_zakat_due")}
                      </Text>
                    </View>
                    
                    {results.isZakatDue && (
                      <View style={styles.zakatAmountCard}>
                        <Text style={[styles.zakatAmountLabel, { color: getSecondaryTextColor() }]}>
                          {t("zakat_amount")}
                        </Text>
                        <Text style={[styles.zakatAmountValue, { color: MALIKI_PRIMARY }]}>
                          {formatCurrency(results.zakatAmount)}
                        </Text>
                      </View>
                    )}
                  </View>
                  
                  {/* Détail par catégorie (comme avant) */}
                  <View style={styles.detailedBreakdown}>
                    <Text style={[styles.breakdownTitle, { color: getTextColor() }]}>
                      {t("detailed_breakdown")}
                    </Text>
                    
                    {/* 1. Argent liquide et comptes */}
                    {(parseFloat(formData.cash) > 0 || parseFloat(formData.savings) > 0 || 
                      parseFloat(formData.currentAccounts) > 0 || parseFloat(formData.fixedDeposits) > 0) && (
                      <View style={styles.categorySection}>
                        <View style={styles.categoryHeader}>
                          <View style={[styles.categoryIcon, { backgroundColor: MALIKI_PRIMARY + "20" }]}>
                            <DollarSign size={20} color={MALIKI_PRIMARY} />
                          </View>
                          <Text style={[styles.categoryTitle, { color: getTextColor() }]}>
                            {t("money_and_accounts")}
                          </Text>
                        </View>
                        
                        <View style={styles.categoryDetails}>
                          {parseFloat(formData.cash) > 0 && (
                            <View style={styles.categoryDetailItem}>
                              <Text style={[styles.categoryDetailLabel, { color: getSecondaryTextColor() }]}>
                                {t("cash_in_hand")}
                              </Text>
                              <Text style={[styles.categoryDetailValue, { color: getTextColor() }]}>
                                {formatCurrency(parseFloat(formData.cash))}
                              </Text>
                            </View>
                          )}
                          
                          {parseFloat(formData.savings) > 0 && (
                            <View style={styles.categoryDetailItem}>
                              <Text style={[styles.categoryDetailLabel, { color: getSecondaryTextColor() }]}>
                                {t("savings_accounts")}
                              </Text>
                              <Text style={[styles.categoryDetailValue, { color: getTextColor() }]}>
                                {formatCurrency(parseFloat(formData.savings))}
                              </Text>
                            </View>
                          )}
                          
                          {parseFloat(formData.currentAccounts) > 0 && (
                            <View style={styles.categoryDetailItem}>
                              <Text style={[styles.categoryDetailLabel, { color: getSecondaryTextColor() }]}>
                                {t("current_accounts")}
                              </Text>
                              <Text style={[styles.categoryDetailValue, { color: getTextColor() }]}>
                                {formatCurrency(parseFloat(formData.currentAccounts))}
                              </Text>
                            </View>
                          )}
                          
                          {parseFloat(formData.fixedDeposits) > 0 && (
                            <View style={styles.categoryDetailItem}>
                              <Text style={[styles.categoryDetailLabel, { color: getSecondaryTextColor() }]}>
                                {t("fixed_deposits")}
                              </Text>
                              <Text style={[styles.categoryDetailValue, { color: getTextColor() }]}>
                                {formatCurrency(parseFloat(formData.fixedDeposits))}
                              </Text>
                            </View>
                          )}
                          
                          <View style={styles.categoryTotal}>
                            <Text style={[styles.categoryTotalLabel, { color: getSecondaryTextColor() }]}>
                              {t("total")}
                            </Text>
                            <Text style={[styles.categoryTotalValue, { color: MALIKI_PRIMARY }]}>
                              {formatCurrency(
                                (parseFloat(formData.cash) || 0) + 
                                (parseFloat(formData.savings) || 0) + 
                                (parseFloat(formData.currentAccounts) || 0) + 
                                (parseFloat(formData.fixedDeposits) || 0)
                              )}
                            </Text>
                          </View>
                        </View>
                      </View>
                    )}
                    
                    {/* 2. Métaux précieux */}
                    {(parseFloat(formData.goldWeight) > 0 || parseFloat(formData.silverWeight) > 0) && (
                      <View style={styles.categorySection}>
                        <View style={styles.categoryHeader}>
                          <View style={[styles.categoryIcon, { backgroundColor: MALIKI_SECONDARY + "20" }]}>
                            <Gem size={20} color={MALIKI_SECONDARY} />
                          </View>
                          <Text style={[styles.categoryTitle, { color: getTextColor() }]}>
                            {t("precious_metals")}
                          </Text>
                        </View>
                        
                        <View style={styles.categoryDetails}>
                          {parseFloat(formData.goldWeight) > 0 && (
                            <View style={styles.categoryDetailItem}>
                              <Text style={[styles.categoryDetailLabel, { color: getSecondaryTextColor() }]}>
                                {t("gold")} ({formData.goldWeight}g, {formData.goldPurity})
                              </Text>
                              <Text style={[styles.categoryDetailValue, { color: getTextColor() }]}>
                                {formatCurrency(
                                  parseFloat(formData.goldWeight) * 
                                  (formData.goldPurity === "24k" ? defaultPrices.gold24k :
                                   formData.goldPurity === "21k" ? defaultPrices.gold21k :
                                   defaultPrices.gold18k)
                                )}
                              </Text>
                            </View>
                          )}
                          
                          {parseFloat(formData.silverWeight) > 0 && (
                            <View style={styles.categoryDetailItem}>
                              <Text style={[styles.categoryDetailLabel, { color: getSecondaryTextColor() }]}>
                                {t("silver")} ({formData.silverWeight}g, {formData.silverPurity})
                              </Text>
                              <Text style={[styles.categoryDetailValue, { color: getTextColor() }]}>
                                {formatCurrency(
                                  parseFloat(formData.silverWeight) * 
                                  (formData.silverPurity === "999" ? defaultPrices.silver999 :
                                   defaultPrices.silver925)
                                )}
                              </Text>
                            </View>
                          )}
                          
                          <View style={styles.categoryTotal}>
                            <Text style={[styles.categoryTotalLabel, { color: getSecondaryTextColor() }]}>
                              {t("total")}
                            </Text>
                            <Text style={[styles.categoryTotalValue, { color: MALIKI_SECONDARY }]}>
                              {formatCurrency(
                                (parseFloat(formData.goldWeight) || 0) * 
                                (formData.goldPurity === "24k" ? defaultPrices.gold24k :
                                 formData.goldPurity === "21k" ? defaultPrices.gold21k :
                                 defaultPrices.gold18k) +
                                (parseFloat(formData.silverWeight) || 0) * 
                                (formData.silverPurity === "999" ? defaultPrices.silver999 :
                                 defaultPrices.silver925)
                              )}
                            </Text>
                          </View>
                        </View>
                      </View>
                    )}
                    
                    {/* 3. Biens commerciaux */}
                    {(parseFloat(formData.tradeGoodsValue) > 0 || parseFloat(formData.businessInventory) > 0 || 
                      parseFloat(formData.rentalProperties) > 0 || parseFloat(formData.vehiclesValue) > 0) && (
                      <View style={styles.categorySection}>
                        <View style={styles.categoryHeader}>
                          <View style={[styles.categoryIcon, { backgroundColor: MALIKI_ACCENT + "20" }]}>
                            <ShoppingCart size={20} color={MALIKI_ACCENT} />
                          </View>
                          <Text style={[styles.categoryTitle, { color: getTextColor() }]}>
                            {t("trade_goods_and_properties")}
                          </Text>
                        </View>
                        
                        <View style={styles.categoryDetails}>
                          {parseFloat(formData.tradeGoodsValue) > 0 && (
                            <View style={styles.categoryDetailItem}>
                              <Text style={[styles.categoryDetailLabel, { color: getSecondaryTextColor() }]}>
                                {t("trade_goods")}
                              </Text>
                              <Text style={[styles.categoryDetailValue, { color: getTextColor() }]}>
                                {formatCurrency(parseFloat(formData.tradeGoodsValue))}
                              </Text>
                            </View>
                          )}
                          
                          {parseFloat(formData.businessInventory) > 0 && (
                            <View style={styles.categoryDetailItem}>
                              <Text style={[styles.categoryDetailLabel, { color: getSecondaryTextColor() }]}>
                                {t("business_inventory")}
                              </Text>
                              <Text style={[styles.categoryDetailValue, { color: getTextColor() }]}>
                                {formatCurrency(parseFloat(formData.businessInventory))}
                              </Text>
                            </View>
                          )}
                          
                          {parseFloat(formData.rentalProperties) > 0 && (
                            <View style={styles.categoryDetailItem}>
                              <Text style={[styles.categoryDetailLabel, { color: getSecondaryTextColor() }]}>
                                {t("rental_properties")}
                              </Text>
                              <Text style={[styles.categoryDetailValue, { color: getTextColor() }]}>
                                {formatCurrency(parseFloat(formData.rentalProperties))}
                              </Text>
                            </View>
                          )}
                          
                          {parseFloat(formData.vehiclesValue) > 0 && (
                            <View style={styles.categoryDetailItem}>
                              <Text style={[styles.categoryDetailLabel, { color: getSecondaryTextColor() }]}>
                                {t("vehicles")}
                              </Text>
                              <Text style={[styles.categoryDetailValue, { color: getTextColor() }]}>
                                {formatCurrency(parseFloat(formData.vehiclesValue))}
                              </Text>
                            </View>
                          )}
                          
                          <View style={styles.categoryTotal}>
                            <Text style={[styles.categoryTotalLabel, { color: getSecondaryTextColor() }]}>
                              {t("total")}
                            </Text>
                            <Text style={[styles.categoryTotalValue, { color: MALIKI_ACCENT }]}>
                              {formatCurrency(
                                (parseFloat(formData.tradeGoodsValue) || 0) + 
                                (parseFloat(formData.businessInventory) || 0) + 
                                (parseFloat(formData.rentalProperties) || 0) + 
                                (parseFloat(formData.vehiclesValue) || 0)
                              )}
                            </Text>
                          </View>
                        </View>
                      </View>
                    )}
                    
                    {/* 4. Agriculture */}
                    {parseFloat(formData.cropsWeight) > 0 && (
                      <View style={styles.categorySection}>
                        <View style={styles.categoryHeader}>
                          <View style={[styles.categoryIcon, { backgroundColor: "#2e7d32" + "20" }]}>
                            <Leaf size={20} color="#2e7d32" />
                          </View>
                          <Text style={[styles.categoryTitle, { color: getTextColor() }]}>
                            {t("agriculture")}
                          </Text>
                        </View>
                        
                        <View style={styles.categoryDetails}>
                          <View style={styles.categoryDetailItem}>
                            <Text style={[styles.categoryDetailLabel, { color: getSecondaryTextColor() }]}>
                              {t("crops_weight")}
                            </Text>
                            <Text style={[styles.categoryDetailValue, { color: getTextColor() }]}>
                              {formData.cropsWeight} kg
                            </Text>
                          </View>
                          
                          <View style={styles.categoryDetailItem}>
                            <Text style={[styles.categoryDetailLabel, { color: getSecondaryTextColor() }]}>
                              {t("irrigation_type")}
                            </Text>
                            <Text style={[styles.categoryDetailValue, { color: getTextColor() }]}>
                              {formData.irrigationType === "rain" ? t("rain_irrigation") : t("cost_irrigation")}
                            </Text>
                          </View>
                          
                          <View style={styles.categoryDetailItem}>
                            <Text style={[styles.categoryDetailLabel, { color: getSecondaryTextColor() }]}>
                              {t("market_value")}
                            </Text>
                            <Text style={[styles.categoryDetailValue, { color: getTextColor() }]}>
                              {formatCurrency(
                                parseFloat(formData.cropsMarketValue) || 
                                parseFloat(formData.cropsWeight) * 0.5
                              )}
                            </Text>
                          </View>
                          
                          <View style={styles.categoryTotal}>
                            <Text style={[styles.categoryTotalLabel, { color: getSecondaryTextColor() }]}>
                              {t("total")}
                            </Text>
                            <Text style={[styles.categoryTotalValue, { color: "#2e7d32" }]}>
                              {formatCurrency(
                                parseFloat(formData.cropsMarketValue) || 
                                parseFloat(formData.cropsWeight) * 0.5
                              )}
                            </Text>
                          </View>
                        </View>
                      </View>
                    )}
                    
                    {/* 5. Bétail */}
                    {(parseFloat(formData.camelsCount) > 0 || parseFloat(formData.cowsCount) > 0 || 
                      parseFloat(formData.goatsCount) > 0 || parseFloat(formData.sheepCount) > 0) && (
                      <View style={styles.categorySection}>
                        <View style={styles.categoryHeader}>
                          <View style={[styles.categoryIcon, { backgroundColor: "#795548" + "20" }]}>
                            <Package size={20} color="#795548" />
                          </View>
                          <Text style={[styles.categoryTitle, { color: getTextColor() }]}>
                            {t("livestock")}
                          </Text>
                        </View>
                        
                        <View style={styles.categoryDetails}>
                          {parseFloat(formData.camelsCount) > 0 && (
                            <View style={styles.categoryDetailItem}>
                              <Text style={[styles.categoryDetailLabel, { color: getSecondaryTextColor() }]}>
                                {t("camels")}
                              </Text>
                              <Text style={[styles.categoryDetailValue, { color: getTextColor() }]}>
                                {formData.camelsCount} × {formatCurrency(2500)} = {formatCurrency(parseFloat(formData.camelsCount) * 2500)}
                              </Text>
                            </View>
                          )}
                          
                          {parseFloat(formData.cowsCount) > 0 && (
                            <View style={styles.categoryDetailItem}>
                              <Text style={[styles.categoryDetailLabel, { color: getSecondaryTextColor() }]}>
                                {t("cows")}
                              </Text>
                              <Text style={[styles.categoryDetailValue, { color: getTextColor() }]}>
                                {formData.cowsCount} × {formatCurrency(1200)} = {formatCurrency(parseFloat(formData.cowsCount) * 1200)}
                              </Text>
                            </View>
                          )}
                          
                          {parseFloat(formData.goatsCount) > 0 && (
                            <View style={styles.categoryDetailItem}>
                              <Text style={[styles.categoryDetailLabel, { color: getSecondaryTextColor() }]}>
                                {t("goats")}
                              </Text>
                              <Text style={[styles.categoryDetailValue, { color: getTextColor() }]}>
                                {formData.goatsCount} × {formatCurrency(150)} = {formatCurrency(parseFloat(formData.goatsCount) * 150)}
                              </Text>
                            </View>
                          )}
                          
                          {parseFloat(formData.sheepCount) > 0 && (
                            <View style={styles.categoryDetailItem}>
                              <Text style={[styles.categoryDetailLabel, { color: getSecondaryTextColor() }]}>
                                {t("sheep")}
                              </Text>
                              <Text style={[styles.categoryDetailValue, { color: getTextColor() }]}>
                                {formData.sheepCount} × {formatCurrency(120)} = {formatCurrency(parseFloat(formData.sheepCount) * 120)}
                              </Text>
                            </View>
                          )}
                          
                          <View style={styles.categoryTotal}>
                            <Text style={[styles.categoryTotalLabel, { color: getSecondaryTextColor() }]}>
                              {t("total")}
                            </Text>
                            <Text style={[styles.categoryTotalValue, { color: "#795548" }]}>
                              {formatCurrency(
                                (parseFloat(formData.camelsCount) || 0) * 2500 + 
                                (parseFloat(formData.cowsCount) || 0) * 1200 + 
                                (parseFloat(formData.goatsCount) || 0) * 150 + 
                                (parseFloat(formData.sheepCount) || 0) * 120
                              )}
                            </Text>
                          </View>
                        </View>
                      </View>
                    )}
                    
                    {/* 6. Créances et dettes */}
                    {(parseFloat(formData.receivables) > 0 || parseFloat(formData.doubtfulReceivables) > 0 || parseFloat(formData.debts) > 0) && (
                      <View style={styles.categorySection}>
                        <View style={styles.categoryHeader}>
                          <View style={[styles.categoryIcon, { backgroundColor: "#1976d2" + "20" }]}>
                            <CreditCard size={20} color="#1976d2" />
                          </View>
                          <Text style={[styles.categoryTitle, { color: getTextColor() }]}>
                            {t("receivables_and_debts")}
                          </Text>
                        </View>
                        
                        <View style={styles.categoryDetails}>
                          {parseFloat(formData.receivables) > 0 && (
                            <View style={styles.categoryDetailItem}>
                              <Text style={[styles.categoryDetailLabel, { color: getSecondaryTextColor() }]}>
                                {t("certain_receivables")}
                              </Text>
                              <Text style={[styles.categoryDetailValue, { color: getTextColor() }]}>
                                {formatCurrency(parseFloat(formData.receivables))}
                              </Text>
                            </View>
                          )}
                          
                          {parseFloat(formData.doubtfulReceivables) > 0 && (
                            <View style={styles.categoryDetailItem}>
                              <Text style={[styles.categoryDetailLabel, { color: getSecondaryTextColor() }]}>
                                {t("doubtful_receivables")}
                              </Text>
                              <Text style={[styles.categoryDetailValue, { color: getTextColor() }]}>
                                {formatCurrency(parseFloat(formData.doubtfulReceivables))}
                              </Text>
                            </View>
                          )}
                          
                          {parseFloat(formData.debts) > 0 && (
                            <View style={styles.categoryDetailItem}>
                              <Text style={[styles.categoryDetailLabel, { color: getSecondaryTextColor() }]}>
                                {t("debts_to_pay")} (-)
                              </Text>
                              <Text style={[styles.categoryDetailValue, { color: "#ef4444" }]}>
                                -{formatCurrency(parseFloat(formData.debts))}
                              </Text>
                            </View>
                          )}
                          
                          <View style={styles.categoryTotal}>
                            <Text style={[styles.categoryTotalLabel, { color: getSecondaryTextColor() }]}>
                              {t("net_total")}
                            </Text>
                            <Text style={[styles.categoryTotalValue, { color: "#1976d2" }]}>
                              {formatCurrency(
                                (formData.includeAllReceivables ? 
                                  (parseFloat(formData.receivables) || 0) + (parseFloat(formData.doubtfulReceivables) || 0) :
                                  (parseFloat(formData.receivables) || 0)) - 
                                (parseFloat(formData.debts) || 0)
                              )}
                            </Text>
                          </View>
                        </View>
                      </View>
                    )}
                    
                    {/* 7. Autres actifs */}
                    {(parseFloat(formData.miningOutput) > 0 || parseFloat(formData.foundTreasure) > 0) && (
                      <View style={styles.categorySection}>
                        <View style={styles.categoryHeader}>
                          <View style={[styles.categoryIcon, { backgroundColor: "#7b1fa2" + "20" }]}>
                            <Package size={20} color="#7b1fa2" />
                          </View>
                          <Text style={[styles.categoryTitle, { color: getTextColor() }]}>
                            {t("other_assets")}
                          </Text>
                        </View>
                        
                        <View style={styles.categoryDetails}>
                          {parseFloat(formData.miningOutput) > 0 && (
                            <View style={styles.categoryDetailItem}>
                              <Text style={[styles.categoryDetailLabel, { color: getSecondaryTextColor() }]}>
                                {t("mining_output")}
                              </Text>
                              <Text style={[styles.categoryDetailValue, { color: getTextColor() }]}>
                                {formatCurrency(parseFloat(formData.miningOutput))}
                              </Text>
                            </View>
                          )}
                          
                          {parseFloat(formData.foundTreasure) > 0 && (
                            <View style={styles.categoryDetailItem}>
                              <Text style={[styles.categoryDetailLabel, { color: getSecondaryTextColor() }]}>
                                {t("found_treasure")}
                              </Text>
                              <Text style={[styles.categoryDetailValue, { color: getTextColor() }]}>
                                {formatCurrency(parseFloat(formData.foundTreasure))}
                              </Text>
                            </View>
                          )}
                          
                          <View style={styles.categoryTotal}>
                            <Text style={[styles.categoryTotalLabel, { color: getSecondaryTextColor() }]}>
                              {t("total")}
                            </Text>
                            <Text style={[styles.categoryTotalValue, { color: "#7b1fa2" }]}>
                              {formatCurrency(
                                (parseFloat(formData.miningOutput) || 0) + 
                                (parseFloat(formData.foundTreasure) || 0)
                              )}
                            </Text>
                          </View>
                        </View>
                      </View>
                    )}
                  </View>
                  
                  {/* Calcul final */}
                  {results.isZakatDue && results.zakatAmount > 0 && (
                    <View style={styles.finalCalculation}>
                      <Text style={[styles.finalCalculationTitle, { color: getTextColor() }]}>
                        {t("final_calculation")}
                      </Text>
                      
                      <View style={styles.calculationFormula}>
                        <Text style={[styles.formulaText, { color: getSecondaryTextColor() }]}>
                          ({t("money_and_metals")} + {t("trade_goods")} + {t("receivables")}) × 2.5% = 
                        </Text>
                        <Text style={[styles.formulaValue, { color: MALIKI_PRIMARY }]}>
                          {formatCurrency(
                            ((parseFloat(formData.cash) || 0) + 
                             (parseFloat(formData.savings) || 0) + 
                             (parseFloat(formData.currentAccounts) || 0) + 
                             (parseFloat(formData.fixedDeposits) || 0) +
                             (parseFloat(formData.goldWeight) || 0) * 
                             (formData.goldPurity === "24k" ? defaultPrices.gold24k :
                              formData.goldPurity === "21k" ? defaultPrices.gold21k :
                              defaultPrices.gold18k) +
                             (parseFloat(formData.silverWeight) || 0) * 
                             (formData.silverPurity === "999" ? defaultPrices.silver999 :
                              defaultPrices.silver925) +
                             (parseFloat(formData.tradeGoodsValue) || 0) + 
                             (parseFloat(formData.businessInventory) || 0) + 
                             (parseFloat(formData.rentalProperties) || 0) + 
                             (parseFloat(formData.vehiclesValue) || 0) +
                             (formData.includeAllReceivables ? 
                               (parseFloat(formData.receivables) || 0) + (parseFloat(formData.doubtfulReceivables) || 0) :
                               (parseFloat(formData.receivables) || 0))) * 0.025
                          )}
                        </Text>
                      </View>
                      
                      <View style={styles.finalAmount}>
                        <Text style={[styles.finalAmountLabel, { color: getSecondaryTextColor() }]}>
                          {t("total_zakat_due")}
                        </Text>
                        <Text style={[styles.finalAmountValue, { color: MALIKI_PRIMARY }]}>
                          {formatCurrency(results.zakatAmount)}
                        </Text>
                      </View>
                    </View>
                  )}
                </>
              )}
            </ScrollView>
            
            <View style={styles.modalActions}>
              <Button
                title={t("close")}
                onPress={() => setShowResultsModal(false)}
                variant="outline"
                textColor={MALIKI_PRIMARY}
                borderColor={MALIKI_PRIMARY}
              />
              <Button
                title={t("save_calculation")}
                onPress={() => {
                  Alert.alert(t("success"), t("calculation_saved"));
                }}
                backgroundColor={MALIKI_PRIMARY}
                textColor="#ffffff"
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal d'information sur le madhab Maliki (existante) */}
{/* Modal d'information sur le madhab Maliki */}
<Modal
  visible={showMadhabInfo}
  animationType="fade"
  transparent={true}
  onRequestClose={() => setShowMadhabInfo(false)}
>
  <View style={styles.infoModalContainer}>
    <View style={[styles.infoModalContent, { backgroundColor: getCardColor() }]}>
      <View style={styles.infoModalHeader}>
        <View style={[styles.madhabIcon, { backgroundColor: MALIKI_PRIMARY + "20" }]}>
          <Crown size={32} color={MALIKI_PRIMARY} />
        </View>
        <Text style={[styles.infoModalTitle, { color: getTextColor() }]}>
          {t("maliki_school")}
        </Text>
        <Text style={[styles.infoModalSubtitle, { color: MALIKI_PRIMARY }]}>
          الإمام مالك بن أنس
        </Text>
      </View>
      
      <View style={styles.infoModalScrollContainer}>
        <ScrollView 
          style={styles.infoModalScroll}
          showsVerticalScrollIndicator={true}
          contentContainerStyle={styles.infoModalScrollContent}
        >
          <Text style={[styles.infoModalText, { color: getTextColor() }]}>
            {t("maliki_school_description")}
          </Text>
          
          <View style={styles.infoSection}>
            <Text style={[styles.infoSectionTitle, { color: getTextColor() }]}>
              {t("key_features")}
            </Text>
            {[
              t("maliki_feature_1"),
              t("maliki_feature_2"),
              t("maliki_feature_3"),
              t("maliki_feature_4"),
              t("maliki_feature_5"),
            ].map((feature, index) => (
              <View key={index} style={styles.featureItem}>
                <Sparkles size={16} color={MALIKI_PRIMARY} />
                <Text style={[styles.featureText, { color: getSecondaryTextColor() }]}>
                  {feature}
                </Text>
              </View>
            ))}
          </View>
        </ScrollView>
      </View>
      
      <Button
        title={t("understand")}
        onPress={() => setShowMadhabInfo(false)}
        backgroundColor={MALIKI_PRIMARY}
        textColor="#ffffff"
        style={styles.infoModalButton}
      />
    </View>
  </View>
</Modal>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerGradient: {
    paddingTop: Platform.OS === "ios" ? 45 : 35,
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  header: {
    marginTop: 8,
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  titleContainer: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  titleIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
  },
  subtitle: {
    fontSize: 11,
    fontWeight: "600",
    marginTop: 2,
  },
  madhabButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  // Barre de résultats FIXE
  fixedResultsBar: {
    position: 'absolute',
    top: Platform.OS === "ios" ? 105 : 95,
    left: 16,
    right: 16,
    zIndex: 100,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  fixedResultsContent: {
    borderRadius: 12,
    padding: 12,
    borderWidth: 2,
    borderBottomWidth: 4,
  },
  fixedResultsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  fixedResultsStatus: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  fixedStatusText: {
    fontSize: 14,
    fontWeight: "bold",
    marginLeft: 6,
  },
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
  fixedDetailItem: {
    flex: 1,
    marginRight: 8,
  },
  fixedDetailLabel: {
    fontSize: 10,
    marginBottom: 2,
  },
  fixedDetailValue: {
    fontSize: 14,
    fontWeight: "bold",
  },
  fixedZakatValue: {
    fontSize: 16,
    fontWeight: "bold",
  },
  fixedViewDetails: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  fixedViewDetailsText: {
    fontSize: 11,
    fontWeight: "500",
    marginRight: 4,
  },
  scrollView: {
    flex: 1,
  },
  tabsContainer: {
    paddingHorizontal: 16,
    marginTop: 8,
    marginBottom: 12,
  },
  tabButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.1)",
  },
  tabText: {
    fontSize: 12,
    fontWeight: "600",
    marginLeft: 5,
  },
  sectionsContainer: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  section: {
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    overflow: "hidden",
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 14,
  },
  sectionHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "bold",
    flex: 1,
  },
  sectionContent: {
    paddingHorizontal: 14,
    paddingBottom: 14,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  halfInput: {
    width: "48%",
  },
  pickerLabel: {
    fontSize: 12,
    fontWeight: "500",
    marginBottom: 6,
  },
  pickerButtons: {
    flexDirection: "row",
  },
  purityButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    marginRight: 6,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.1)",
  },
  purityText: {
    fontSize: 11,
    fontWeight: "500",
  },
  toggleContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 16,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.03)",
  },
  toggleLabel: {
    fontSize: 14,
    fontWeight: "500",
    flex: 1,
  },
  toggleButton: {
    width: 44,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.1)",
    justifyContent: "center",
    padding: 2,
  },
  toggleCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#ffffff",
  },
  livestockGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  livestockItem: {
    width: "48%",
    alignItems: "center",
  },
  livestockIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  livestockNote: {
    fontSize: 10,
    marginTop: 4,
    textAlign: "center",
  },
  livestockInfo: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "rgba(0,0,0,0.05)",
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  livestockInfoText: {
    fontSize: 12,
    lineHeight: 16,
    flex: 1,
    marginLeft: 8,
  },
  pickerContainer: {
    marginBottom: 12,
  },
  irrigationButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    marginRight: 8,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.1)",
    flex: 1,
    justifyContent: "center",
  },
  irrigationText: {
    fontSize: 12,
    fontWeight: "500",
    marginLeft: 8,
  },
  bottomSpacer: {
    height: 100,
  },
  actionsContainer: {
    position: "relative",
    bottom: 0,
    left: 0,
    right: 0,
    borderTopWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 8,
    paddingBottom: Platform.OS === "ios" ? 25 : 16,
  },
  actions: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  resetButton: {
    flex: 1,
    marginRight: 8,
    minHeight: 48,
  },
  detailsButton: {
    flex: 2,
    marginLeft: 8,
    minHeight: 48,
  },
  //styles pour la modal des resultats
   statusCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  statusDue: {
    backgroundColor: MALIKI_PRIMARY + "10",
    borderLeftWidth: 4,
    borderLeftColor: MALIKI_PRIMARY,
  },
  statusHawl: {
    backgroundColor: "#fef3c7",
    borderLeftWidth: 4,
    borderLeftColor: "#f59e0b",
  },
  statusNisab: {
    borderLeftWidth: 4,
  },
  statusNoZakat: {
    backgroundColor: "#f3f4f6",
    borderLeftWidth: 4,
    borderLeftColor: "#94a3b8",
  },
  statusHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  statusTitle: {
    fontSize: 16,
    fontWeight: "bold",
    marginLeft: 8,
  },
  zakatAmountCard: {
    backgroundColor: "rgba(255,255,255,0.8)",
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  zakatAmountLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  zakatAmountValue: {
    fontSize: 24,
    fontWeight: "bold",
  },
  
  // Détail par catégorie
  detailedBreakdown: {
    marginVertical: 20,
  },
  breakdownTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 16,
  },
  categorySection: {
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.1)",
    borderRadius: 12,
    overflow: "hidden",
  },
  categoryHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    backgroundColor: "rgba(0,0,0,0.03)",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.05)",
  },
  categoryIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  categoryTitle: {
    fontSize: 16,
    fontWeight: "bold",
  },
  categoryDetails: {
    padding: 14,
  },
  categoryDetailItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.03)",
  },
  categoryDetailLabel: {
    fontSize: 14,
    flex: 1,
  },
  categoryDetailValue: {
    fontSize: 14,
    fontWeight: "500",
  },
  categoryTotal: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 12,
    marginTop: 8,
    borderTopWidth: 2,
    borderTopColor: "rgba(0,0,0,0.1)",
  },
  categoryTotalLabel: {
    fontSize: 15,
    fontWeight: "600",
  },
  categoryTotalValue: {
    fontSize: 18,
    fontWeight: "bold",
  },
  
  // Calcul final
  finalCalculation: {
    marginVertical: 20,
    padding: 16,
    backgroundColor: "rgba(26, 93, 26, 0.05)",
    borderRadius: 12,
  },
  finalCalculationTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 12,
    textAlign: "center",
  },
  calculationFormula: {
    backgroundColor: "rgba(255,255,255,0.8)",
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  formulaText: {
    fontSize: 14,
    textAlign: "center",
  },
  formulaValue: {
    fontSize: 16,
    fontWeight: "bold",
    textAlign: "center",
    marginTop: 4,
  },
  finalAmount: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 12,
    borderTopWidth: 2,
    borderTopColor: "rgba(26, 93, 26, 0.2)",
  },
  finalAmountLabel: {
    fontSize: 16,
    fontWeight: "600",
  },
  finalAmountValue: {
    fontSize: 24,
    fontWeight: "bold",
  },
  // Styles pour la modal des paramètres
  modalContainer: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: SCREEN_HEIGHT * 0.85,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.1)",
  },
  modalHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  modalIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
  },
  modalSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  modalScroll: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
  },
  settingSection: {
    marginBottom: 24,
  },
  settingSectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 4,
  },
  settingSectionDesc: {
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 16,
  },
  settingButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  settingButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.1)",
    alignItems: "center",
    marginHorizontal: 6,
  },
  settingButtonText: {
    fontSize: 14,
    fontWeight: "600",
    marginTop: 8,
    marginBottom: 4,
  },
  settingButtonSubtext: {
    fontSize: 11,
  },
  hawlSetting: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  hawlSettingButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.1)",
    marginHorizontal: 6,
  },
  hawlSettingText: {
    fontSize: 14,
    fontWeight: "500",
    marginLeft: 8,
  },
  toggleSetting: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.05)",
  },
  toggleSettingLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  toggleSettingTexts: {
    flex: 1,
    marginLeft: 12,
  },
  toggleSettingTitle: {
    fontSize: 15,
    fontWeight: "500",
    marginBottom: 4,
  },
  toggleSettingDesc: {
    fontSize: 12,
    lineHeight: 16,
  },
  toggle: {
    width: 44,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.1)",
    justifyContent: "center",
    padding: 2,
    marginLeft: 12,
  },
  modalActions: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.1)",
  },
  applyButton: {
    minHeight: 50,
  },

  //location pour la modal des résultats
    locationCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  locationHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  locationTitle: {
    fontSize: 16,
    fontWeight: "bold",
    marginLeft: 8,
  },
  locationDetails: {
    gap: 8,
  },
  locationItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
  },
  locationLabel: {
    fontSize: 13,
    fontWeight: "500",
  },
  locationValue: {
    fontSize: 14,
    fontWeight: "600",
  },
  currencyValue: {
    fontSize: 16,
    fontWeight: "bold",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: MALIKI_PRIMARY + "20",
  },
  divider: {
    height: 1,
    marginVertical: 16,
  },
  // Styles pour la modal des résultats détaillés
  modalSummary: {
    marginVertical: 20,
  },
  summaryItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.05)",
  },
  summaryLabel: {
    fontSize: 14,
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: "600",
  },
  zakatBreakdown: {
    marginVertical: 20,
    padding: 16,
    borderRadius: 16,
    backgroundColor: "rgba(26, 93, 26, 0.05)",
  },
  breakdownTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 16,
  },
  breakdownItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.05)",
  },
  breakdownLeft: {
    flex: 1,
  },
  breakdownCategory: {
    fontSize: 14,
    fontWeight: "500",
  },
  breakdownPercentage: {
    fontSize: 12,
    marginTop: 2,
  },
  breakdownAmount: {
    fontSize: 16,
    fontWeight: "bold",
  },
  totalZakat: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 16,
    marginTop: 8,
    borderTopWidth: 2,
    borderTopColor: "rgba(0,0,0,0.1)",
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: "bold",
  },
  totalValue: {
    fontSize: 24,
    fontWeight: "bold",
  },
  // Styles pour la modal d'information
  infoModalContainer: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  infoModalContent: {
    width: "100%",
    height: "70%",
    maxHeight: SCREEN_HEIGHT * 0.85,
    borderRadius: 24,
    padding: 24,
    flexDirection: "column",
  },
  infoModalHeader: {
    alignItems: "center",
    marginBottom: 16,
  },
    infoModalScrollContainer: {
    flex: 1, // Prend tout l'espace disponible
    marginVertical: 16,
    minHeight: 200, // Hauteur minimale
  },
  infoModalScroll: {
    flex: 1,
  },
  infoModalScrollContent: {
    flexGrow: 1,
    paddingBottom: 10,
  },
  madhabIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  infoModalTitle: {
    fontSize: 24,
    fontWeight: "bold",
    textAlign: "center",
  },
  infoModalSubtitle: {
    fontSize: 16,
    fontWeight: "500",
    marginTop: 8,
    textAlign: "center",
  },
  infoModalScroll: {
    flex: 1,
  },
  infoModalText: {
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 24,
    textAlign: "center",
  },
  infoSection: {
    marginTop: 16,
  },
  infoSectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 16,
  },
  featureItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  featureText: {
    fontSize: 14,
    lineHeight: 20,
    flex: 1,
    marginLeft: 12,
  },
  infoModalButton: {
    marginTop: 24,
  },
    principlesSection: {
    marginHorizontal: 16,
    marginBottom: 20,
    alignItems: "center",
  },
  principlesTitle: {
    fontSize: 18,
    fontWeight: "bold",
  },
  principlesScrollContainer: {
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  principleCard: {
    width: 200,
    padding: 16,
    borderRadius: 16,
    marginHorizontal: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  principleIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  principleTitle: {
    fontSize: 14,
    fontWeight: "bold",
    marginBottom: 8,
  },
  principleDesc: {
    fontSize: 12,
    lineHeight: 16,
  },
});

export default ZakatCalculatorScreen;