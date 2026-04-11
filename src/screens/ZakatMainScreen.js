import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Modal,
  Animated,
  Platform,
  StatusBar,
  Dimensions,
  ActivityIndicator,
  FlatList,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import {
  Calculator,
  History,
  CreditCard,
  ChevronRight,
  ChevronLeft,
  X,
  Plus,
  CheckCircle,
  AlertCircle,
  Clock,
  Coins,
  Gem,
  DollarSign,
  ShoppingCart,
  Leaf,
  Package,
  Building,
  Wallet,
  Banknote,
  TrendingUp,
  Edit3,
  Trash2,
  Menu,
  Crown,
  BookOpen,
  Bell,
  Settings,
} from "lucide-react-native";
import {KeyboardAvoidingView,TextInput } from "react-native";
import { useAppTranslation } from "../hooks/useTranslation";
import { useTheme } from "../context/ThemeContext";
import { useCurrency } from "../context/CurrencyContext";
import { useAuth } from "../context/AuthContext";
import { useAlert } from "../context/AlertContext";
import { zakatService } from "../services/zakatService";
import { supabase } from "../services/supabase";
import { getHawlStatus, getCurrentHijriYear } from "../utils/zakatUtils";
import InputField from "../components/InputField";
import Button from "../components/Button";
import ZakatCalculatorScreen from "./ZakatCalculatorScreen";
import BeneficiarySelector from "./BeneficiarySelector";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

const MALIKI_PRIMARY = "#1a5d1a";
const MALIKI_SECONDARY = "#d4af37";
const MALIKI_ACCENT = "#8b4513";
const MALIKI_LIGHT = "#f0f7f0";
const MALIKI_DARK = "#0a2f0a";

// ─── DRAWER ITEMS ────────────────────────────────────────────────────────────
const DRAWER_ITEMS = [
  { id: "zakat_annuel", labelKey: "zakat_annuel", icon: Crown, screen: "ZakatAnnuel" },
  { id: "calcul_zakat", labelKey: "calcul_zakat", icon: Calculator, screen: "Calculator" },
  { id: "mes_actifs", labelKey: "mes_actifs", icon: Wallet, screen: "MesActifs" },
  { id: "historique_paiements", labelKey: "historique_paiements", icon: CreditCard, screen: "HistoriquePaiements" },
  { id: "rappels", labelKey: "rappels", icon: Bell, screen: "Rappels" },
];

// ─── TYPE ICONS ──────────────────────────────────────────────────────────────
const getTypeIcon = (typeName) => {
  const name = (typeName || "").toLowerCase();
  if (name.includes("or") || name.includes("gold")) return Gem;
  if (name.includes("argent") || name.includes("silver")) return Coins;
  if (name.includes("epargne") || name.includes("cash") || name.includes("compte")) return Banknote;
  if (name.includes("commerce") || name.includes("marchandise")) return ShoppingCart;
  if (name.includes("agriculture") || name.includes("récolte")) return Leaf;
  if (name.includes("bétail") || name.includes("chameau") || name.includes("vache")) return Package;
  if (name.includes("propriété") || name.includes("immo")) return Building;
  return Wallet;
};

// ─── BENEFICIARY CATEGORIES (chargées depuis BD) ──────────────────────────
const getCategoryColor = (categoryId) => {
  const colors = {
    1: "#dc2626", // FUQARA - red
    2: "#f59e0b", // MASAKIN - amber
    3: "#0891b2", // AMILIN - cyan
    4: "#8b5cf6", // MUALLAF - purple
    5: "#06b6d4", // RIQAB - cyan-500
    6: "#ec4899", // GHARIMIN - pink
    7: "#3b82f6", // FISABILILLAH - blue
    8: "#10b981", // IBNSABIL - emerald
  };
  return colors[categoryId] || "#6b7280";
};

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────
const ZakatMainScreen = () => {
  const { t } = useAppTranslation();
  const { currentTheme } = useTheme();
  const { formatCurrency } = useCurrency();
  const { user } = useAuth();
  const { alert, success, error: showError, confirm } = useAlert();

  // Navigation state
  const [activeScreen, setActiveScreen] = useState("ZakatAnnuel");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerAnim = useRef(new Animated.Value(-SCREEN_WIDTH * 0.75)).current;
  const overlayAnim = useRef(new Animated.Value(0)).current;

  // Data states
  const [zakatHistory, setZakatHistory] = useState([]);
  const [actifsHistory, setActifsHistory] = useState([]);
  const [paiementsHistory, setPaiementsHistory] = useState([]);
  // Default hawl completed=true: first-time users have no anniversary date → hawl considered complete
  const [hawlStatus, setHawlStatus] = useState({ completed: true, daysRemaining: 0, nextAnniversary: null, message: "" });
  const [loading, setLoading] = useState(false);
  const [selectedActif, setSelectedActif] = useState(null);
  const [showActifModal, setShowActifModal] = useState(false);
  
  // New states for year selection and assets
  const [selectedYear, setSelectedYear] = useState(null);
  const [selectedYearActifs, setSelectedYearActifs] = useState([]);
  const [showYearModal, setShowYearModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("transfer");
  
  // Beneficiary states
  const [beneficiaires, setBeneficiaires] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedBeneficiary, setSelectedBeneficiary] = useState(null);
  const [showAddBeneficiaryForm, setShowAddBeneficiaryForm] = useState(false);
  const [newBeneficiaryName, setNewBeneficiaryName] = useState("");
  const [selectedNewBeneficiaryCategory, setSelectedNewBeneficiaryCategory] = useState(null);

  // Theme helpers
  const isDark = currentTheme === "dark";
  const bg = () => isDark ? MALIKI_DARK : MALIKI_LIGHT;
  const card = () => isDark ? "#1a2a1a" : "#ffffff";
  const text = () => isDark ? "#e8edf5" : "#1a2a1a";
  const textSec = () => isDark ? "#a8c6a8" : "#4a6b4a";
  const border = () => isDark ? "#334155" : "#e2e8f0";

  // ── Drawer ──
  const openDrawer = () => {
    setDrawerOpen(true);
    Animated.parallel([
      Animated.spring(drawerAnim, { toValue: 0, useNativeDriver: true, friction: 8 }),
      Animated.timing(overlayAnim, { toValue: 0.5, duration: 250, useNativeDriver: true }),
    ]).start();
  };

  const closeDrawer = () => {
    Animated.parallel([
      Animated.spring(drawerAnim, { toValue: -SCREEN_WIDTH * 0.75, useNativeDriver: true, friction: 8 }),
      Animated.timing(overlayAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => setDrawerOpen(false));
  };

  const navigate = (screen) => {
    // Change screen immediately, then close drawer (no double-click needed)
    setActiveScreen(screen);
    Animated.parallel([
      Animated.spring(drawerAnim, { toValue: -SCREEN_WIDTH * 0.75, useNativeDriver: true, friction: 8 }),
      Animated.timing(overlayAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => setDrawerOpen(false));
  };

  // ── Data loading ──
  useEffect(() => {
    if (user) {
      loadHawlStatus();
      loadZakatHistory();
      loadBeneficiaries();
      loadCategories();
    }
  }, [user]);

  // Ajoute dans le useEffect qui surveille activeScreen :
useEffect(() => {
  if (activeScreen === "MesActifs") {
    // Ne recharge les actifs globaux QUE si pas de filtre d'année actif
    if (!selectedYear) loadActifs();
  }
  if (activeScreen === "HistoriquePaiements") loadPaiements();
  if (activeScreen === "ZakatAnnuel") {
    // Reset du filtre quand on revient à l'accueil
    setSelectedYear(null);
    setSelectedYearActifs([]);
    if (user) {
      loadZakatHistory();   // ✅ refresh automatique à chaque retour
      loadHawlStatus();
    }
  }
}, [activeScreen]);


  // Auto-refresh when screen is focused
  useFocusEffect(
    useCallback(() => {
      if (user) {
        loadHawlStatus();
        loadZakatHistory();
        if (activeScreen === "MesActifs") loadActifs();
        if (activeScreen === "HistoriquePaiements") loadPaiements();
      }
    }, [user, activeScreen])
  );

  const loadHawlStatus = async () => {
    try {
      const { data: profile } = await supabase
        .from("profils_utilisateurs")
        .select("date_anniversaire_zakat")
        .eq("id_utilisateur", user.id)
        .single();
      
      // If no anniversary date set → hawl is considered complete (first registration)
      if (!profile?.date_anniversaire_zakat) {
        setHawlStatus({ completed: true, daysRemaining: 0, nextAnniversary: null, message: "" });
        return;
      }
      setHawlStatus(getHawlStatus(profile.date_anniversaire_zakat));
    } catch (e) {
      // Default to completed if query fails (no date = first time user)
      setHawlStatus({ completed: true, daysRemaining: 0, nextAnniversary: null, message: "" });
    }
  };

  const loadZakatHistory = async () => {
    setLoading(true);
    const result = await zakatService.getZakatAnnuelHistory(user.id);
    if (result.success) setZakatHistory(result.data);
    setLoading(false);
  };

  const loadActifs = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("zakat_actif")
        .select(`*, type_zakat(nom_type, taux_zakat, unite_mesure)`)
        .eq("utilisateur_id", user.id)
        .eq("actif", true)  // Filter at DB level: only active assets
        .order("created_at", { ascending: false });
      
      if (!error) setActifsHistory(data || []);
    } catch (e) {
      setActifsHistory([]);
    }
    setLoading(false);
  };

const loadPaiements = async () => {
  setLoading(true);
  try {
    const { data, error } = await supabase
      .from("paiement_zakat")
      .select(`
        *, 
        zakat_annuel!inner(utilisateur_id, annee_hijri),
        beneficiaire(nom)
      `)
      .eq("zakat_annuel.utilisateur_id", user.id)  // Filter via zakat_annuel
      .order("date_paiement", { ascending: false });
    if (!error) setPaiementsHistory(data || []);
  } catch (e) {}
  setLoading(false);
};

  // Load categories from database
  const loadCategories = async () => {
    try {
      const { data, error } = await supabase
        .from("categorie_beneficiaire")
        .select("id, nom_francais, description, ordre_priorite, actif")
        .eq("actif", true)
        .order("ordre_priorite", { ascending: true });
      if (!error) {
        setCategories(data || []);
        console.log("✅ Catégories chargées:", data?.length);
        // Set first category as default
        if (data && data.length > 0 && !selectedNewBeneficiaryCategory) {
          setSelectedNewBeneficiaryCategory(data[0]);
        }
      }
    } catch (e) {
      console.error("❌ Erreur chargement catégories:", e);
    }
  };

  // Load beneficiaries from database with categories
  const loadBeneficiaries = async () => {
    try {
      const { data, error } = await supabase
        .from("beneficiaire")
        .select(`id, nom, categorie_beneficiaire_id, categorie_beneficiaire(id, nom_francais, description)`)
        .eq("actif", true)
        .order("nom", { ascending: true });
      if (!error) {
        setBeneficiaires(data || []);
        console.log("✅ Bénéficiaires chargés:", data?.length);
      }
    } catch (e) {
      console.error("❌ Erreur chargement bénéficiaires:", e);
    }
  };

  // Add new beneficiary
  const handleAddBeneficiary = async () => {
    if (!newBeneficiaryName.trim() || !selectedNewBeneficiaryCategory) {
      showError(t("error"), "Veuillez remplir tous les champs");
      return;
    }

    try {
      setLoading(true);
      console.log("➕ Création bénéficiaire:", newBeneficiaryName, "Catégorie:", selectedNewBeneficiaryCategory.nom_francais);
      const { data, error } = await supabase
        .from("beneficiaire")
        .insert([
          {
            nom: newBeneficiaryName.trim(),
            categorie_beneficiaire_id: selectedNewBeneficiaryCategory.id,
          },
        ])
        .select(`id, nom, categorie_beneficiaire_id, categorie_beneficiaire(id, nom_francais, description)`);

      if (error) throw error;

      // Add to list and select it
      if (data && data.length > 0) {
        setBeneficiaires([...beneficiaires, data[0]]);
        setSelectedBeneficiary(data[0]);
        setNewBeneficiaryName("");
        setShowAddBeneficiaryForm(false);
        success(
          t("success"),
          `Bénéficiaire "${data[0].nom}" ajouté avec succès`
        );
        console.log("✅ Nouveau bénéficiaire créé:", data[0]);
      }
    } catch (error) {
      console.error("❌ Erreur création bénéficiaire:", error);
      showError(t("error"), "Impossible de créer le bénéficiaire: " + error.message);
    } finally {
      setLoading(false);
    }
  }

  // Load actifs for a specific year
  const loadActifsForYear = async (zakatAnnuelId) => {
    console.log("🔄 Chargement des actifs pour zakat_annuel_id:", zakatAnnuelId);
    try {
      const { data, error } = await supabase
        .from("zakat_actif")
        .select(`*, type_zakat(nom_type, taux_zakat, unite_mesure)`)
        .eq("zakat_annuel_id", zakatAnnuelId)
        // .eq("actif", true)
        .order("created_at", { ascending: false });
      
      if (!error) {
        setSelectedYearActifs(data || []);
        console.log("✅ Actifs chargés pour l'année:", data?.length);
      }
    } catch (e) {
      setSelectedYearActifs([]);
    }
  };

  // ✅ Function to handle "Recalculate" - Load actifs then navigate to MesActifs
// Remplace handleRecalculateClick par :
const handleRecalculateClick = async () => {
  try {
    setLoading(true);
    const currentHijriYear = getCurrentHijriYear();
    const currYearData = zakatHistory.find((z) => z.annee_hijri === currentHijriYear);
    
    if (!currYearData) {
      navigate("Calculator");
      return;
    }
    
    // Charge les actifs de l'année courante seulement
    await loadActifsForYear(currYearData.id);
    setSelectedYear(currYearData); // ← important : on garde l'année sélectionnée
    navigate("MesActifs");
    
  } catch (error) {
    showError("Erreur", "Impossible de charger les actifs");
  } finally {
    setLoading(false);
  }
};

  // Handle payment for zakat
  const handlePayZakat = async (amount, beneficiary, method) => {
    if (!selectedYear || !amount || !beneficiary) {
      showError(t("error"), "Veuillez remplir tous les champs (montant + bénéficiaire)");
      return;
    }

    const parsedAmount = parseFloat(amount);
    if (parsedAmount <= 0) {
      showError(t("error"), t("invalid_amount"));
      return;
    }

    if (parsedAmount > selectedYear.montant_restant) {
      showError(t("error"), t("amount_exceeds_due"));
      return;
    }

    try {
      setLoading(true);
      console.log("💳 Création paiement: montant=", parsedAmount, ", bénéficiaire=", beneficiary.nom);
      
      // Insert payment record
      const { error: paymentError } = await supabase
        .from("paiement_zakat")
        .insert({
          // utilisateur_id: user.id,
          zakat_annuel_id: selectedYear.id,
          beneficiaire_id: beneficiary.id,
          montant_paye: parsedAmount,
          date_paiement: new Date().toISOString(),
          moyen_paiement: method,
        });

      if (paymentError) throw paymentError;

      // Update zakat_annuel record
      const newRemaining = selectedYear.montant_restant - parsedAmount;
      const newPaid = (selectedYear.montant_zakat_paye || 0) + parsedAmount;
      const newStatus = newRemaining <= 0 ? "PAYE" : "NON_PAYE";

      const { error: updateError } = await supabase
        .from("zakat_annuel")
        .update({
          montant_zakat_paye: newPaid,
          montant_restant: newRemaining,
          statut: newStatus,
        })
        .eq("id", selectedYear.id);

      if (updateError) throw updateError;

      // Close modals FIRST (before displaying alerts)
      setShowPaymentModal(false);
      setShowYearModal(false);
      setSelectedYear(null);
      
      // Display success alert AFTER modal closes
      setTimeout(() => {
        success(t("success"), t("payment_recorded_successfully"));
      }, 300);
      
      // Refresh data
      loadZakatHistory();
      loadPaiements();
      
      setLoading(false);
    } catch (error) {
      // Close modals FIRST
      setShowPaymentModal(false);
      setShowYearModal(false);
      setSelectedYear(null);
      
      setLoading(false);
      
      // Display error alert AFTER modal closes
      setTimeout(() => {
        showError(t("error"), error.message || t("payment_failed"));
      }, 300);
    }
  };

  // Open year modal to view actifs and payment
  const openYearDetails = async (zakatData) => {
    setSelectedYear(zakatData);
    await loadActifsForYear(zakatData.id);
    setShowYearModal(true);
  };

  const handleDeleteActif = async (actifId) => {
    confirm(
      t("confirm_delete"),
      t("delete_actif_confirm"),
      async () => {
        try {
          setLoading(true);
          
          console.log("🗑️  Deleting asset:", actifId);
          
          // Get the asset to find its zakat_annuel_id
          const { data: actif } = await supabase
            .from("zakat_actif")
            .select("zakat_annuel_id, nom_actif")
            .eq("id", actifId)
            .single();
          
          console.log("   Found asset:", actif?.nom_actif, "zakat_annuel_id:", actif?.zakat_annuel_id);
          
          // Soft delete the asset
          const { error: deleteError } = await supabase
            .from("zakat_actif")
            .update({ actif: false })
            .eq("id", actifId);
          
          if (deleteError) throw deleteError;
          
          // Determine which zakat year to recalculate
          let zakatAnnuelIdToRecalculate = actif?.zakat_annuel_id;
          
          // If no zakat_annuel_id, find the most recent one
          if (!zakatAnnuelIdToRecalculate) {
            console.log("⚠️  No zakat_annuel_id found, searching for recent year...");
            const { data: recentZakat } = await supabase
              .from("zakat_annuel")
              .select("id")
              .eq("utilisateur_id", user.id)
              .order("annee_hijri", { ascending: false })
              .limit(1);
            
            if (recentZakat && recentZakat.length > 0) {
              zakatAnnuelIdToRecalculate = recentZakat[0].id;
            }
          }
          
          // Recalculate zakat
          if (zakatAnnuelIdToRecalculate) {
            const result = await zakatService.recalculateZakatAnnuel(zakatAnnuelIdToRecalculate);
            if (result.success) {
              console.log("✅ Zakat recalculée après suppression:", result.data);
              success(
                t("success"),
                `Actif supprimé.\nZakat recalculé: ${formatCurrency(result.data.montantZakatCalcule)}`
              );
            }
          } else {
            success("Info", "Actif supprimé");
          }
          
          // Reload with small delay
          setTimeout(() => {
            loadActifs();
            loadZakatHistory();
            console.log("🔄 Données rechargées après suppression");
          }, 300);
          
        } catch (error) {
          showError("Erreur", "Impossible de supprimer l'actif: " + error.message);
          console.error("❌ Delete error:", error);
        } finally {
          setLoading(false);
        }
      }
    );
  };

  // ─── STATUS BADGE ────────────────────────────────────────────────────────
  const StatusBadge = ({ statut }) => {
    const cfg = {
      PAYE: { bg: "#dcfce7", color: "#166534", label: t("paid") },
      NON_PAYE: { bg: "#fee2e2", color: "#991b1b", label: t("unpaid") },
      EXEMPTE: { bg: "#f3f4f6", color: "#6b7280", label: t("exempt") },
    }[statut] || { bg: "#f3f4f6", color: "#6b7280", label: statut };
    return (
      <View style={{ backgroundColor: cfg.bg, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20 }}>
        <Text style={{ color: cfg.color, fontSize: 11, fontWeight: "600" }}>{cfg.label}</Text>
      </View>
    );
  };

  // ─── ZAKAT ANNUEL SCREEN ─────────────────────────────────────────────────
  const ZakatAnnuelScreen = () => {
    const currentYear = getCurrentHijriYear();
    const currentYearData = zakatHistory.find((z) => z.annee_hijri === currentYear);

    return (
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        {/* Hawl Banner */}
        <View
          style={{
            backgroundColor: hawlStatus.completed ? MALIKI_PRIMARY + "15" : "#fef3c7",
            borderRadius: 14,
            padding: 14,
            marginBottom: 16,
            flexDirection: "row",
            alignItems: "center",
            borderLeftWidth: 4,
            borderLeftColor: hawlStatus.completed ? MALIKI_PRIMARY : "#f59e0b",
          }}
        >
          {hawlStatus.completed ? (
            <CheckCircle size={22} color={MALIKI_PRIMARY} />
          ) : (
            <Clock size={22} color="#f59e0b" />
          )}
          <View style={{ marginLeft: 12, flex: 1 }}>
            <Text style={{ color: hawlStatus.completed ? MALIKI_PRIMARY : "#92400e", fontWeight: "700", fontSize: 14 }}>
              {hawlStatus.completed ? t("hawl_completed") : t("hawl_not_completed")}
            </Text>
            {!hawlStatus.completed && hawlStatus.daysRemaining > 0 && (
              <Text style={{ color: "#92400e", fontSize: 12, marginTop: 2 }}>
                {hawlStatus.daysRemaining} {t("days_remaining")}
              </Text>
            )}
          </View>
        </View>

        {/* Current Year Card */}
        <View
          style={{
            backgroundColor: card(),
            borderRadius: 16,
            marginBottom: 20,
            overflow: "hidden",
            borderWidth: 1,
            borderColor: border(),
          }}
        >
          <LinearGradient
            colors={isDark ? [MALIKI_DARK, "#1a3a1a"] : [MALIKI_PRIMARY, "#2e7d32"]}
            style={{ padding: 18 }}
          >
            <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 12, fontWeight: "600" }}>
              {t("current_year")} {currentYear}H
            </Text>
            {currentYearData ? (
              <>
                <Text style={{ color: "#fff", fontSize: 28, fontWeight: "800", marginTop: 4 }}>
                  {formatCurrency(currentYearData.montant_zakat_calcule || 0)}
                </Text>
                <View style={{ flexDirection: "row", alignItems: "center", marginTop: 6, gap: 8 }}>
                  <StatusBadge statut={currentYearData.statut} />
                  {currentYearData.montant_restant > 0 && (
                    <Text style={{ color: "rgba(255,255,255,0.8)", fontSize: 12 }}>
                      {t("remaining")}: {formatCurrency(currentYearData.montant_restant)}
                    </Text>
                  )}
                </View>
              </>
            ) : (
              <>
                <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 22, fontWeight: "700", marginTop: 4 }}>
                  —
                </Text>
                <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 12, marginTop: 6 }}>
                  {t("no_calculation_yet")}
                </Text>
              </>
            )}
          </LinearGradient>

          {/* CTA */}
          <TouchableOpacity
            onPress={handleRecalculateClick}
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              padding: 14,
              gap: 8,
              backgroundColor: card(),
            }}
          >
            <Plus size={18} color={MALIKI_PRIMARY} />
            <Text style={{ color: MALIKI_PRIMARY, fontWeight: "700", fontSize: 14 }}>
              {currentYearData ? t("recalculate_zakat") : t("calculate_zakat_now")}
            </Text>
          </TouchableOpacity>
        </View>

        {/* History list */}
        <Text style={{ color: text(), fontWeight: "700", fontSize: 17, marginBottom: 12 }}>
          {t("annual_history")}
        </Text>

        {loading ? (
          <ActivityIndicator size="large" color={MALIKI_PRIMARY} style={{ marginTop: 40 }} />
        ) : zakatHistory.length === 0 ? (
          <View style={{ alignItems: "center", marginTop: 40 }}>
            <History size={48} color={textSec()} style={{ opacity: 0.4 }} />
            <Text style={{ color: textSec(), marginTop: 12, fontSize: 14 }}>{t("no_history")}</Text>
          </View>
        ) : (
          zakatHistory.map((item, i) => (
            <TouchableOpacity
              key={i}
              onPress={() => openYearDetails(item)}
              activeOpacity={0.7}
              style={{
                backgroundColor: card(),
                borderRadius: 14,
                marginBottom: 10,
                padding: 14,
                borderWidth: 1,
                borderColor: border(),
              }}
            >
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <Text style={{ color: MALIKI_PRIMARY, fontWeight: "800", fontSize: 16 }}>
                  {item.annee_hijri}H
                </Text>
                <StatusBadge statut={item.statut} />
              </View>

              <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 12 }}>
                <View>
                  <Text style={{ color: textSec(), fontSize: 11 }}>{t("net_worth")}</Text>
                  <Text style={{ color: text(), fontWeight: "600", fontSize: 13 }}>
                    {formatCurrency(item.montant_imposable || 0)}
                  </Text>
                </View>
                <View style={{ alignItems: "center" }}>
                  <Text style={{ color: textSec(), fontSize: 11 }}>{t("zakat_due_label")}</Text>
                  <Text style={{ color: MALIKI_PRIMARY, fontWeight: "700", fontSize: 13 }}>
                    {formatCurrency(item.montant_zakat_calcule || 0)}
                  </Text>
                </View>
                {item.montant_zakat_paye > 0 && (
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={{ color: textSec(), fontSize: 11 }}>{t("paid")}</Text>
                    <Text style={{ color: "#10b981", fontWeight: "600", fontSize: 13 }}>
                      {formatCurrency(item.montant_zakat_paye)}
                    </Text>
                  </View>
                )}
              </View>

              {/* Action buttons */}
              <View style={{ flexDirection: "row", gap: 8, justifyContent: "space-between" }}>
                <TouchableOpacity
                  style={{
                    flex: 1,
                    backgroundColor: MALIKI_PRIMARY + "15",
                    borderRadius: 8,
                    padding: 10,
                    alignItems: "center",
                    borderWidth: 1,
                    borderColor: MALIKI_PRIMARY,
                  }}
                  onPress={() => openYearDetails(item)}
                >
                  <Text style={{ color: MALIKI_PRIMARY, fontWeight: "600", fontSize: 12 }}>
                    {t("view_assets")}
                  </Text>
                </TouchableOpacity>

                {item.statut === "NON_PAYE" && item.montant_restant > 0 && (
                  <TouchableOpacity
                    style={{
                      flex: 1,
                      backgroundColor: MALIKI_PRIMARY,
                      borderRadius: 8,
                      padding: 10,
                      alignItems: "center",
                    }}
                    onPress={() => {
                      setSelectedYear(item);
                      setShowPaymentModal(true);
                    }}
                  >
                    <Text style={{ color: "#fff", fontWeight: "600", fontSize: 12 }}>
                      {t("pay_now")}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              <Text style={{ color: textSec(), fontSize: 10, marginTop: 8, textAlign: "right" }}>
                {new Date(item.created_at).toLocaleDateString()}
              </Text>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    );
  };

  // ─── MES ACTIFS SCREEN ───────────────────────────────────────────────────
const MesActifsScreen = () => {
  // Si on vient d'une année spécifique, on filtre par cette année
  // Sinon on affiche tous les actifs actifs de l'utilisateur
  const activeActifs = selectedYear ? selectedYearActifs : actifsHistory;
  const totalValue = activeActifs.reduce((sum, a) => sum + (a.valeur_totale || 0), 0);

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      {/* Summary */}
      <View style={{
        backgroundColor: MALIKI_PRIMARY,
        borderRadius: 16,
        padding: 18,
        marginBottom: 16,
      }}>
        {/* Titre avec l'année si disponible */}
        {selectedYear && (
          <Text style={{ color: "rgba(255,255,255,0.65)", fontSize: 11, marginBottom: 2 }}>
            Année {selectedYear.annee_hijri}H
          </Text>
        )}
        <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 12, fontWeight: "600" }}>
          {t("total_assets")}
        </Text>
        <Text style={{ color: "#fff", fontSize: 28, fontWeight: "800", marginTop: 4 }}>
          {formatCurrency(totalValue)}
        </Text>
        <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 12, marginTop: 4 }}>
          {activeActifs.length} {t("assets")}
        </Text>
      </View>

      {/* Bouton ajouter — seulement si pas de filtre par année OU si c'est l'année courante */}
      <TouchableOpacity
        onPress={() => navigate("Calculator")}
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: MALIKI_PRIMARY + "15",
          borderRadius: 12,
          padding: 14,
          marginBottom: 16,
          borderWidth: 1,
          borderColor: MALIKI_PRIMARY + "40",
          gap: 8,
        }}
      >
        <Plus size={18} color={MALIKI_PRIMARY} />
        <Text style={{ color: MALIKI_PRIMARY, fontWeight: "700" }}>{t("add_assets")}</Text>
      </TouchableOpacity>

      {loading ? (
        <ActivityIndicator size="large" color={MALIKI_PRIMARY} />
      ) : activeActifs.length === 0 ? (
        <View style={{ alignItems: "center", marginTop: 40 }}>
          <Wallet size={48} color={textSec()} style={{ opacity: 0.4 }} />
          <Text style={{ color: textSec(), marginTop: 12, fontSize: 14 }}>{t("no_assets")}</Text>
        </View>
      ) : (
        activeActifs.map((item, i) => {
          const TypeIcon = getTypeIcon(item.type_zakat?.nom_type);
          return (
            <View
              key={item.id || i}  // ← utilise item.id au lieu de i pour éviter les bugs de key
              style={{
                backgroundColor: card(),
                borderRadius: 14,
                marginBottom: 10,
                padding: 14,
                borderWidth: 1,
                borderColor: border(),
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <View style={{
                  width: 42, height: 42, borderRadius: 21,
                  backgroundColor: MALIKI_PRIMARY + "20",
                  alignItems: "center", justifyContent: "center",
                }}>
                  <TypeIcon size={20} color={MALIKI_PRIMARY} />
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={{ color: text(), fontWeight: "600", fontSize: 14 }}>{item.nom_actif}</Text>
                  <Text style={{ color: textSec(), fontSize: 12, marginTop: 2 }}>
                    {item.type_zakat?.nom_type} · {item.quantite} {item.type_zakat?.unite_mesure || ""}
                  </Text>
                </View>

                <View style={{ alignItems: "flex-end" }}>
                  <Text style={{ color: MALIKI_PRIMARY, fontWeight: "700", fontSize: 15 }}>
                    {formatCurrency(item.valeur_totale)}
                  </Text>
                  <View style={{ flexDirection: "row", gap: 8, marginTop: 6 }}>
                    <TouchableOpacity onPress={() => { setSelectedActif(item); setShowActifModal(true); }}>
                      <Edit3 size={16} color={textSec()} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleDeleteActif(item.id)}>
                      <Trash2 size={16} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

              <Text style={{ color: textSec(), fontSize: 10, marginTop: 8, textAlign: "right" }}>
                {new Date(item.created_at).toLocaleDateString()} à{" "}
                {new Date(item.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </Text>
            </View>
          );
        })
      )}
    </ScrollView>
  );
};

  // ─── HISTORIQUE PAIEMENTS ────────────────────────────────────────────────
  const HistoriquePaiementsScreen = () => (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      {loading ? (
        <ActivityIndicator size="large" color={MALIKI_PRIMARY} />
      ) : paiementsHistory.length === 0 ? (
        <View style={{ alignItems: "center", marginTop: 60 }}>
          <CreditCard size={48} color={textSec()} style={{ opacity: 0.4 }} />
          <Text style={{ color: textSec(), marginTop: 12, fontSize: 14 }}>{t("no_payments")}</Text>
        </View>
      ) : (
        paiementsHistory.map((item, i) => (
          <View
            key={i}
            style={{
              backgroundColor: card(),
              borderRadius: 14,
              marginBottom: 10,
              padding: 14,
              borderWidth: 1,
              borderColor: border(),
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
            }}
          >
            <View
              style={{
                width: 42,
                height: 42,
                borderRadius: 21,
                backgroundColor: "#dcfce7",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <CheckCircle size={20} color="#166534" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: text(), fontWeight: "600" }}>
                {item.beneficiaire?.nom || t("beneficiary")}
              </Text>
              <Text style={{ color: textSec(), fontSize: 12, marginTop: 2 }}>
                {t("year")} {item.zakat_annuel?.annee_hijri}H · {item.moyen_paiement || "—"}
              </Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={{ color: "#10b981", fontWeight: "700", fontSize: 15 }}>
                {formatCurrency(item.montant_paye)}
              </Text>
              <Text style={{ color: textSec(), fontSize: 11, marginTop: 2 }}>
                {new Date(item.date_paiement).toLocaleDateString()}
              </Text>
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );

  // ─── RAPPELS SCREEN ──────────────────────────────────────────────────────
  const RappelsScreen = () => (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 32 }}>
      <Bell size={56} color={textSec()} style={{ opacity: 0.3 }} />
      <Text style={{ color: text(), fontSize: 18, fontWeight: "700", marginTop: 16 }}>
        {t("reminders")}
      </Text>
      <Text style={{ color: textSec(), fontSize: 14, marginTop: 8, textAlign: "center" }}>
        {t("reminders_coming_soon")}
      </Text>
    </View>
  );

  // ─── HEADER ──────────────────────────────────────────────────────────────
  const getScreenTitle = () => {
    const item = DRAWER_ITEMS.find((i) => i.screen === activeScreen);
    return item ? t(item.labelKey) : t("zakat");
  };

  const showBackButton = activeScreen !== "ZakatAnnuel";

  // ─── ACTIF EDIT MODAL ────────────────────────────────────────────────────
  const ActifEditModal = () => {
    const [editValue, setEditValue] = useState(selectedActif?.valeur_totale?.toString() || "");

    const handleSave = async () => {
      if (!selectedActif) return;
      const newVal = parseFloat(editValue) || 0;
      
      try {
        setLoading(true);
        
        console.log("🔄 Modifying asset:", selectedActif.id, "New value:", newVal);
        console.log("   zakat_annuel_id:", selectedActif.zakat_annuel_id);
        
        // 1. Update the asset value
        await supabase
          .from("zakat_actif")
          .update({ valeur_totale: newVal, valeur_unitaire: newVal / (selectedActif.quantite || 1) })
          .eq("id", selectedActif.id);
        
        // 2. Determine which zakat year to recalculate
        let zakatAnnuelIdToRecalculate = selectedActif.zakat_annuel_id;
        
        // If zakat_annuel_id is not set, find the most recent one for this user
        if (!zakatAnnuelIdToRecalculate) {
          console.log("⚠️  No zakat_annuel_id found, searching for recent year...");
          const { data: recentZakat } = await supabase
            .from("zakat_annuel")
            .select("id")
            .eq("utilisateur_id", user.id)
            .order("annee_hijri", { ascending: false })
            .limit(1);
          
          if (recentZakat && recentZakat.length > 0) {
            zakatAnnuelIdToRecalculate = recentZakat[0].id;
            console.log("✅ Found recent zakat year:", zakatAnnuelIdToRecalculate);
          }
        }
        
        // 3. Recalculate zakat if we have a year
        if (zakatAnnuelIdToRecalculate) {
          const result = await zakatService.recalculateZakatAnnuel(zakatAnnuelIdToRecalculate);
          if (result.success) {
            console.log("✅ Zakat recalculée avec succès:", result.data);
            success(
              t("success"),
              `Zakat recalculé: ${formatCurrency(result.data.montantZakatCalcule)}`
            );
          } else {
            console.error("❌ Erreur recalcul:", result.error);
            alert("⚠️  Attention", "Zakat partiellement mis à jour");
          }
        } else {
          console.warn("⚠️  Aucune année de zakat trouvée pour recalcul");
          alert("ℹ️  Info", "Actif modifié, mais aucune année zakat trouvée");
        }
        
        setShowActifModal(false);
        setSelectedActif(null);
        
        // 4. Reload both lists with small delay to ensure DB update is complete
        setTimeout(() => {
          loadActifs();
          loadZakatHistory();
          console.log("🔄 Données rechargées");
        }, 300);
        
      } catch (error) {
        showError("Erreur", "Impossible de modifier l'actif: " + error.message);
        console.error("❌ handleSave error:", error);
      } finally {
        setLoading(false);
      }
    };

    return (
      <Modal visible={showActifModal} transparent animationType="fade" onRequestClose={() => setShowActifModal(false)}>
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.5)",
            justifyContent: "center",
            alignItems: "center",
            padding: 24,
          }}
        >
          <View style={{ backgroundColor: card(), borderRadius: 20, padding: 24, width: "100%" }}>
            <Text style={{ color: text(), fontSize: 18, fontWeight: "700", marginBottom: 4 }}>
              {t("edit_asset")}
            </Text>
            <Text style={{ color: textSec(), fontSize: 13, marginBottom: 20 }}>
              {selectedActif?.nom_actif}
            </Text>

            <InputField
              label={t("total_value")}
              value={editValue}
              onChangeText={setEditValue}
              keyboardType="numeric"
              placeholder="0"
            />

            <View style={{ flexDirection: "row", gap: 12, marginTop: 20 }}>
              <Button
                title={t("cancel")}
                onPress={() => setShowActifModal(false)}
                variant="outline"
                style={{ flex: 1 }}
                textColor={textSec()}
              />
              <Button
                title={t("save")}
                onPress={handleSave}
                style={{ flex: 1 }}
                backgroundColor={MALIKI_PRIMARY}
                textColor="#fff"
              />
            </View>
          </View>
        </View>
      </Modal>
    );
  };

  // ─── YEAR DETAILS MODAL (View assets for a year) ────────────────────────
  const YearDetailsModal = () => {
    if (!selectedYear) return null;
    
     const actifsActifs = selectedYearActifs.filter(a => a.actif !== false);
  const actifsSupprimés = selectedYearActifs.filter(a => a.actif === false);
  
  const totalActifs = actifsActifs.reduce((sum, a) => sum + (a.valeur_totale || 0), 0);
  const totalSupprimés = actifsSupprimés.reduce((sum, a) => sum + (a.valeur_totale || 0), 0);


    return (
      <Modal visible={showYearModal} transparent animationType="slide" onRequestClose={() => setShowYearModal(false)}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)" }}>
          <View
            style={{
              flex: 1,
              marginTop: Platform.OS === "ios" ? 100 : 80,
              backgroundColor: bg(),
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              paddingHorizontal: 16,
              paddingTop: 20,
            }}
          >
            {/* Header */}
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <Text style={{ color: text(), fontSize: 20, fontWeight: "700" }}>
                {t("year")} {selectedYear.annee_hijri}H - {t("view_assets")}
              </Text>
              <TouchableOpacity onPress={() => setShowYearModal(false)}>
                <X size={24} color={text()} />
              </TouchableOpacity>
            </View>

 {/* Summary  */}
      <View style={{
        backgroundColor: MALIKI_PRIMARY + "12",
        borderRadius: 12,
        padding: 14,
        marginBottom: 16,
        borderLeftWidth: 4,
        borderLeftColor: MALIKI_PRIMARY,
      }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 10 }}>
          <View>
            <Text style={{ color: textSec(), fontSize: 11 }}>{t("total_assets")} (actifs)</Text>
            <Text style={{ color: text(), fontWeight: "700", fontSize: 16 }}>
              {formatCurrency(totalActifs)}
            </Text>
          </View>
          <View style={{ alignItems: "center" }}>
            <Text style={{ color: textSec(), fontSize: 11 }}>{t("zakat_due_label")}</Text>
            <Text style={{ color: MALIKI_PRIMARY, fontWeight: "700", fontSize: 16 }}>
              {formatCurrency(selectedYear.montant_zakat_calcule || 0)}
            </Text>
          </View>
        </View>

        {/* Total supprimés — affiché seulement s'il y en a */}
        {totalSupprimés > 0 && (
          <View style={{
            borderTopWidth: 0.5,
            borderTopColor: border(),
            paddingTop: 8,
            marginTop: 4,
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
          }}>
            <Text style={{ color: textSec(), fontSize: 11 }}>
              Supprimés ({actifsSupprimés.length})
            </Text>
            <Text style={{ color: "#ef4444", fontSize: 13, fontWeight: "600" }}>
              -{formatCurrency(totalSupprimés)}
            </Text>
          </View>
        )}

        <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
          <Text style={{ color: textSec(), fontSize: 12 }}>{t("status")}:</Text>
          <StatusBadge statut={selectedYear.statut} />
        </View>
      </View>

      {/* Liste — actifs d'abord, puis supprimés */}
      <Text style={{ color: text(), fontWeight: "700", fontSize: 14, marginBottom: 12 }}>
        {t("assets")} ({actifsActifs.length} actifs · {actifsSupprimés.length} supprimés)
      </Text>

      <ScrollView style={{ flex: 1, marginBottom: 16 }}>
        {/* Actifs */}
        {actifsActifs.map((item, i) => {
          const TypeIcon = getTypeIcon(item.type_zakat?.nom_type);
          return (
            <View key={item.id || i} style={{
              backgroundColor: card(),
              borderRadius: 12,
              marginBottom: 8,
              padding: 12,
              borderWidth: 1,
              borderColor: border(),
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
            }}>
              <View style={{
                width: 36, height: 36, borderRadius: 18,
                backgroundColor: MALIKI_PRIMARY + "20",
                alignItems: "center", justifyContent: "center",
              }}>
                <TypeIcon size={18} color={MALIKI_PRIMARY} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: text(), fontWeight: "600", fontSize: 13 }}>
                  {item.nom_actif}
                </Text>
                <Text style={{ color: textSec(), fontSize: 11, marginTop: 2 }}>
                  {item.type_zakat?.nom_type} · {item.quantite} {item.type_zakat?.unite_mesure || ""}
                </Text>
              </View>
              <View style={{ alignItems: "flex-end", gap: 4 }}>
                <Text style={{ color: MALIKI_PRIMARY, fontWeight: "700", fontSize: 14 }}>
                  {formatCurrency(item.valeur_totale)}
                </Text>
                <View style={{ backgroundColor: "#dcfce7", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
                  <Text style={{ color: "#166534", fontSize: 9, fontWeight: "600" }}>Actif</Text>
                </View>
              </View>
            </View>
          );
        })}

        {/* Séparateur supprimés */}
        {actifsSupprimés.length > 0 && (
          <View style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            marginVertical: 12,
          }}>
            <View style={{ flex: 1, height: 0.5, backgroundColor: "#ef444460" }} />
            <Text style={{ color: "#ef4444", fontSize: 11, fontWeight: "600" }}>
              Supprimés
            </Text>
            <View style={{ flex: 1, height: 0.5, backgroundColor: "#ef444460" }} />
          </View>
        )}

        {/* Supprimés */}
        {actifsSupprimés.map((item, i) => {
          const TypeIcon = getTypeIcon(item.type_zakat?.nom_type);
          return (
            <View key={item.id || i} style={{
              backgroundColor: card(),
              borderRadius: 12,
              marginBottom: 8,
              padding: 12,
              borderWidth: 0.5,
              borderColor: "#ef444440",
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
              opacity: 0.6,
            }}>
              <View style={{
                width: 36, height: 36, borderRadius: 18,
                backgroundColor: "#fee2e2",
                alignItems: "center", justifyContent: "center",
              }}>
                <TypeIcon size={18} color="#ef4444" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: text(), fontWeight: "600", fontSize: 13 }}>
                  {item.nom_actif}
                </Text>
                <Text style={{ color: textSec(), fontSize: 11, marginTop: 2 }}>
                  {item.type_zakat?.nom_type} · {item.quantite} {item.type_zakat?.unite_mesure || ""}
                </Text>
              </View>
              <View style={{ alignItems: "flex-end", gap: 4 }}>
                <Text style={{ color: "#ef4444", fontWeight: "700", fontSize: 14, textDecorationLine: "line-through" }}>
                  {formatCurrency(item.valeur_totale)}
                </Text>
                <View style={{ backgroundColor: "#fee2e2", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
                  <Text style={{ color: "#991b1b", fontSize: 9, fontWeight: "600" }}>Supprimé</Text>
                </View>
              </View>
            </View>
          );
        })}
      </ScrollView>
            {/* Payment button */}
            {selectedYear.statut === "NON_PAYE" && selectedYear.montant_restant > 0 && (
              <TouchableOpacity
                style={{
                  backgroundColor: MALIKI_PRIMARY,
                  borderRadius: 12,
                  padding: 14,
                  alignItems: "center",
                  marginBottom: 16,
                }}
                onPress={() => {
                  setShowYearModal(false);
                  setShowPaymentModal(true);
                }}
              >
                <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16 }}>
                  {t("pay_now")} ({formatCurrency(selectedYear.montant_restant)})
                </Text>
              </TouchableOpacity>
            )}

            <Button
              title={t("close")}
              onPress={() => setShowYearModal(false)}
              variant="outline"
              textColor={textSec()}
            />
          </View>
        </View>
      </Modal>
    );
  };

  // ─── BENEFICIARY MODAL ───────────────────────────────────────────────────
  const BeneficiaryModal = () => {
    return null; // Fonctionnalité fusionnée dans PaymentModal
  };

  // ─── PAYMENT MODAL ───────────────────────────────────────────────────────

const PaymentModal = React.memo(({
  visible,
  selectedYear,
  beneficiaires,
  categories,
  onClose,
  onPay,
  formatCurrency,
  getCategoryColor,
  t,
  isDark,
}) => {
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("transfer");
  const [selectedBeneficiary, setSelectedBeneficiary] = useState(null);
  const [loading, setLoading] = useState(false);

  const bg = isDark ? "#0a2f0a" : "#f0f7f0";
  const card = isDark ? "#1a2a1a" : "#ffffff";
  const textColor = isDark ? "#e8edf5" : "#1a2a1a";
  const textSec = isDark ? "#a8c6a8" : "#4a6b4a";
  const borderColor = isDark ? "#334155" : "#e2e8f0";

  // Reset state when modal opens
  useEffect(() => {
    if (visible) {
      setPaymentAmount("");
      setPaymentMethod("transfer");
      setSelectedBeneficiary(null);
    }
  }, [visible]);

  if (!selectedYear) return null;

  const handleConfirm = async () => {
    const amount = parseFloat(paymentAmount);
    if (!amount || amount <= 0 || !selectedBeneficiary) {
      showError(t("error"), "Veuillez entrer un montant et choisir un bénéficiaire");
      return;
    }
    if (amount > selectedYear.montant_restant) {
      showError(t("error"), t("amount_exceeds_due"));
      return;
    }
    setLoading(true);
    await onPay({ amount, beneficiary: selectedBeneficiary, method: paymentMethod });
    setLoading(false);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.55)" }}>
        <View style={{
          flex: 1,
          marginTop: Platform.OS === "ios" ? 90 : 70,
          backgroundColor: bg,
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          overflow: "hidden",
        }}>
          {/* Colored header */}
          <LinearGradient
            colors={[MALIKI_PRIMARY, "#2e7d32"]}
            style={{ paddingHorizontal: 16, paddingTop: 18, paddingBottom: 16 }}
          >
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
              <View>
                <Text style={{ color: "rgba(255,255,255,0.65)", fontSize: 12 }}>Paiement Zakat</Text>
                <Text style={{ color: "#fff", fontSize: 18, fontWeight: "700", marginTop: 2 }}>
                  Année {selectedYear.annee_hijri}H
                </Text>
              </View>
              <TouchableOpacity onPress={onClose} style={{
                width: 34, height: 34, borderRadius: 17,
                backgroundColor: "rgba(255,255,255,0.18)",
                alignItems: "center", justifyContent: "center",
              }}>
                <X size={18} color="#fff" />
              </TouchableOpacity>
            </View>
          </LinearGradient>

          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={{ flex: 1 }}
          >
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{ padding: 16, gap: 20, paddingBottom: 32 }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {/* Summary row */}
              <View style={{ flexDirection: "row", gap: 8 }}>
                {[
                  { lbl: t("zakat_due_label"), val: formatCurrency(selectedYear.montant_zakat_calcule), color: textColor },
                  { lbl: t("paid"), val: formatCurrency(selectedYear.montant_zakat_paye || 0), color: "#10b981" },
                  { lbl: t("remaining"), val: formatCurrency(selectedYear.montant_restant), color: MALIKI_PRIMARY },
                ].map((item, i) => (
                  <View key={i} style={{
                    flex: 1, backgroundColor: card,
                    borderRadius: 10, padding: 10,
                    borderWidth: 0.5, borderColor: borderColor,
                  }}>
                    <Text style={{ fontSize: 10, color: textSec, marginBottom: 4 }}>{item.lbl}</Text>
                    <Text style={{ fontSize: 13, fontWeight: "700", color: item.color }}>{item.val}</Text>
                  </View>
                ))}
              </View>

              {/* Amount input */}
              <View>
                <Text style={{ fontSize: 13, fontWeight: "600", color: textColor, marginBottom: 8 }}>
                  {t("payment_amount")}
                </Text>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <TextInput
                    style={{
                      flex: 1,
                      backgroundColor: card,
                      borderRadius: 10,
                      borderWidth: 1,
                      borderColor: MALIKI_PRIMARY + "50",
                      padding: 12,
                      fontSize: 22,
                      fontWeight: "700",
                      color: textColor,
                    }}
                    value={paymentAmount}
                    onChangeText={setPaymentAmount}
                    keyboardType="decimal-pad"
                    placeholder={formatCurrency(selectedYear.montant_restant)}
                    placeholderTextColor={textSec}
                  />
                  <View style={{ gap: 6 }}>
                    <TouchableOpacity
                      onPress={() => setPaymentAmount(selectedYear.montant_restant.toString())}
                      style={{
                        backgroundColor: MALIKI_PRIMARY + "18",
                        borderRadius: 8, padding: 8,
                        borderWidth: 0.5, borderColor: MALIKI_PRIMARY,
                        alignItems: "center",
                      }}
                    >
                      <Text style={{ color: MALIKI_PRIMARY, fontSize: 11, fontWeight: "600" }}>{t("pay_full")}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => setPaymentAmount((selectedYear.montant_restant / 2).toFixed(2))}
                      style={{
                        backgroundColor: MALIKI_PRIMARY + "18",
                        borderRadius: 8, padding: 8,
                        borderWidth: 0.5, borderColor: MALIKI_PRIMARY,
                        alignItems: "center",
                      }}
                    >
                      <Text style={{ color: MALIKI_PRIMARY, fontSize: 11, fontWeight: "600" }}>½</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

              {/* Beneficiary */}
              <View>
                <Text style={{ fontSize: 13, fontWeight: "600", color: textColor, marginBottom: 8 }}>
                  Bénéficiaire *
                </Text>
                <BeneficiarySelector
                  beneficiaires={beneficiaires}
                  categories={categories}
                  selectedBeneficiary={selectedBeneficiary}
                  onSelect={setSelectedBeneficiary}
                  onClear={() => setSelectedBeneficiary(null)}
                  onAddBeneficiary={async (name, cat, onSuccess) => {
  try {
    const { data, error } = await supabase
      .from("beneficiaire")
      .insert([{
        nom: name,
        categorie_beneficiaire_id: cat.id,
      }])
      .select(`id, nom, categorie_beneficiaire_id, categorie_beneficiaire(id, nom_francais, description)`);

    if (error) throw error;

    if (data && data.length > 0) {
      setBeneficiaires((prev) => [...prev, data[0]]);
      // Auto-sélectionner le nouveau bénéficiaire est géré dans le selector via onSuccess
      onSuccess(data[0]); // ← passe le nouveau bénéficiaire pour auto-sélection
    }
  } catch (e) {
    showError(t("error"), e.message);
  }
}}
                  getCategoryColor={getCategoryColor}
                  t={t}
                  isDark={isDark}
                />
              </View>

              {/* Payment method */}
              <View>
                <Text style={{ fontSize: 13, fontWeight: "600", color: textColor, marginBottom: 8 }}>
                  {t("payment_method")}
                </Text>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  {[
                    { id: "transfer", label: "Virement", emoji: "🏦" },
                    { id: "card", label: "Carte", emoji: "💳" },
                    { id: "cash", label: "Espèces", emoji: "💵" },
                  ].map((m) => (
                    <TouchableOpacity
                      key={m.id}
                      onPress={() => setPaymentMethod(m.id)}
                      style={{
                        flex: 1,
                        padding: 12,
                        borderRadius: 10,
                        borderWidth: paymentMethod === m.id ? 1.5 : 0.5,
                        borderColor: paymentMethod === m.id ? MALIKI_PRIMARY : borderColor,
                        backgroundColor: paymentMethod === m.id ? MALIKI_PRIMARY + "15" : card,
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      <Text style={{ fontSize: 20 }}>{m.emoji}</Text>
                      <Text style={{ fontSize: 11, fontWeight: paymentMethod === m.id ? "600" : "400",
                        color: paymentMethod === m.id ? MALIKI_PRIMARY : textSec }}>
                        {m.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>

          {/* Footer */}
          <View style={{
            flexDirection: "row", gap: 10,
            padding: 16,
            borderTopWidth: 0.5, borderTopColor: borderColor,
            backgroundColor: bg,
          }}>
            <TouchableOpacity
              onPress={onClose}
              style={{
                flex: 1, padding: 14, borderRadius: 12,
                borderWidth: 0.5, borderColor: borderColor,
                alignItems: "center",
              }}
            >
              <Text style={{ color: textSec, fontSize: 15 }}>{t("cancel")}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleConfirm}
              disabled={loading}
              style={{
                flex: 2, padding: 14, borderRadius: 12,
                backgroundColor: MALIKI_PRIMARY,
                alignItems: "center", justifyContent: "center",
              }}
            >
              {loading
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={{ color: "#fff", fontSize: 15, fontWeight: "600" }}>{t("confirm_payment")}</Text>
              }
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
});

  // ─── RENDER ──────────────────────────────────────────────────────────────
  return (
    <View style={{ flex: 1, backgroundColor: bg() }}>
      <StatusBar
        backgroundColor={bg()}
        barStyle={isDark ? "light-content" : "dark-content"}
      />

      {/* Header */}
      <LinearGradient
        colors={isDark ? [MALIKI_DARK, "#0a3a0a"] : [MALIKI_LIGHT, "#e8f5e8"]}
        style={{
          paddingTop: Platform.OS === "ios" ? 52 : 40,
          paddingHorizontal: 16,
          paddingBottom: 14,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          {showBackButton ? (
            <TouchableOpacity
              // Dans le header, remplace le onPress du bouton back :
              onPress={() => {
                setActiveScreen("ZakatAnnuel");
                setSelectedYear(null);      // ← reset le filtre d'année
                setSelectedYearActifs([]);  // ← reset les actifs filtrés
              }}                
              
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: MALIKI_PRIMARY + "20",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <ChevronLeft size={22} color={MALIKI_PRIMARY} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={openDrawer}
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: MALIKI_PRIMARY + "20",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Menu size={20} color={MALIKI_PRIMARY} />
            </TouchableOpacity>
          )}

          <View style={{ flex: 1 }}>
            <Text style={{ color: text(), fontSize: 20, fontWeight: "800" }}>
              {getScreenTitle()}
            </Text>
            {activeScreen === "ZakatAnnuel" && (
              <Text style={{ color: MALIKI_PRIMARY, fontSize: 11, fontWeight: "600" }}>
                {t("according_to_maliki_school")}
              </Text>
            )}
          </View>

          <TouchableOpacity
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: MALIKI_PRIMARY + "20",
              alignItems: "center",
              justifyContent: "center",
            }}
            onPress={() => navigate("Calculator")}
          >
            <Calculator size={18} color={MALIKI_PRIMARY} />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* Screen Content */}
      <View style={{ flex: 1 }}>
        {activeScreen === "ZakatAnnuel" && <ZakatAnnuelScreen />}
        {activeScreen === "Calculator" && <ZakatCalculatorScreen />}
        {activeScreen === "MesActifs" && <MesActifsScreen />}
        {activeScreen === "HistoriquePaiements" && <HistoriquePaiementsScreen />}
        {activeScreen === "Rappels" && <RappelsScreen />}
      </View>

      {/* Drawer Overlay */}
      {drawerOpen && (
        <Animated.View
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "#000",
            opacity: overlayAnim,
            zIndex: 10,
          }}
        >
          <TouchableOpacity style={{ flex: 1 }} onPress={closeDrawer} activeOpacity={1} />
        </Animated.View>
      )}

      {/* Drawer */}
      {drawerOpen && (
        <Animated.View
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            bottom: 0,
            width: SCREEN_WIDTH * 0.75,
            backgroundColor: card(),
            transform: [{ translateX: drawerAnim }],
            zIndex: 20,
            shadowColor: "#000",
            shadowOffset: { width: 4, height: 0 },
            shadowOpacity: 0.2,
            shadowRadius: 16,
            elevation: 20,
          }}
        >
          {/* Drawer Header */}
          <LinearGradient
            colors={isDark ? [MALIKI_DARK, "#1a3a1a"] : [MALIKI_PRIMARY, "#2e7d32"]}
            style={{ paddingTop: Platform.OS === "ios" ? 56 : 44, paddingHorizontal: 20, paddingBottom: 24 }}
          >
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 22,
                    backgroundColor: "rgba(255,255,255,0.2)",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Crown size={22} color="#fff" />
                </View>
                <View>
                  <Text style={{ color: "#fff", fontWeight: "800", fontSize: 16 }}>
                    {t("zakat_maliki")}
                  </Text>
                  <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 11 }}>
                    المذهب المالكي
                  </Text>
                </View>
              </View>
              <TouchableOpacity onPress={closeDrawer}>
                <X size={22} color="rgba(255,255,255,0.8)" />
              </TouchableOpacity>
            </View>
          </LinearGradient>

          {/* Drawer Items */}
          <ScrollView style={{ flex: 1, paddingTop: 12 }}>
            {DRAWER_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = activeScreen === item.screen;
              return (
                <TouchableOpacity
                  key={item.id}
                  onPress={() => navigate(item.screen)}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 14,
                    paddingHorizontal: 20,
                    paddingVertical: 14,
                    marginHorizontal: 10,
                    borderRadius: 12,
                    marginBottom: 4,
                    backgroundColor: isActive ? MALIKI_PRIMARY + "15" : "transparent",
                  }}
                >
                  <View
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 20,
                      backgroundColor: isActive ? MALIKI_PRIMARY : MALIKI_PRIMARY + "15",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Icon size={19} color={isActive ? "#fff" : MALIKI_PRIMARY} />
                  </View>
                  <Text
                    style={{
                      color: isActive ? MALIKI_PRIMARY : text(),
                      fontWeight: isActive ? "700" : "500",
                      fontSize: 14,
                      flex: 1,
                    }}
                  >
                    {t(item.labelKey)}
                  </Text>
                  {isActive && <ChevronRight size={16} color={MALIKI_PRIMARY} />}
                </TouchableOpacity>
              );
            })}

            <View style={{ height: 1, backgroundColor: border(), marginHorizontal: 20, marginVertical: 12 }} />

            {/* Footer note */}
            <View style={{ padding: 20, opacity: 0.6 }}>
              <Text style={{ color: textSec(), fontSize: 11, lineHeight: 16, textAlign: "center" }}>
                بِسْمِ اللهِ الرَّحْمٰنِ الرَّحِيْمِ
              </Text>
            </View>
          </ScrollView>
        </Animated.View>
      )}

      {/* Actif Edit Modal */}
      <ActifEditModal />

      {/* Year Details Modal */}
      <YearDetailsModal />

      {/* Payment Modal */}
      <PaymentModal
  visible={showPaymentModal}
  selectedYear={selectedYear}
  beneficiaires={beneficiaires}
  categories={categories}
  onClose={() => setShowPaymentModal(false)}
  onPay={async ({ amount, beneficiary, method }) => {
    // ton handlePayZakat logic ici
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