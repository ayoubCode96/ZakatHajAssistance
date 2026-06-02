

import React, { useEffect, useState, useCallback } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import {
  Calculator, Map, User, Settings, Bell, TrendingUp,
  Shield, Clock, ChevronRight, Plus, LogOut, CheckCircle,
  AlertCircle,
} from "lucide-react-native";
import { useAppTranslation } from "../hooks/useTranslation";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { useCurrency } from "../context/CurrencyContext";
import { useAlert } from "../context/AlertContext";
import { supabase } from "../services/supabase";
import { currencyService } from "../services/currencyService";
import hawlService from "../services/hawlService";
import { zakatService } from "../services/zakatService";
import nisabService from "../services/nisabService";
import {
  hijriDaysBetween, HAWL_DAYS_MALIKI, getCurrentHijriDate, formatDate
} from "../utils/zakatUtils";

const COLORS = {
  primary:      "#1a5d1a",
  primaryLight: "#2e7d32",
  primaryMid:   "#4caf50",
  gold:         "#c9991a",
  goldLight:    "#d4af37",
  success:      "#16a34a",
  warning:      "#d97706",
  danger:       "#dc2626",
  darkBg:       "#0c1f0c",
  darkCard:     "#172317",
  darkBorder:   "#2a3f2a",
  darkText:     "#e8f0e8",
  darkTextSec:  "#7a9e7a",
  darkTextTer:  "#4a6a4a",
  lightBg:      "#f0f7f0",
  lightCard:    "#ffffff",
  lightBorder:  "#c8ddc8",
  lightText:    "#1a2a1a",
  lightTextSec: "#4b6a4b",
  lightTextTer: "#9ca3af",
};

const DashboardScreen = ({ navigation }) => {
  const { t, currentLanguage, changeLanguage, isRTL } = useAppTranslation();
  const { currentTheme } = useTheme();
  const { user, signOut } = useAuth();
  const { formatCurrency } = useCurrency();
  const { alert, confirm } = useAlert();

  const [loading, setLoading]                 = useState(true);
  const [refreshing, setRefreshing]           = useState(false);
  const [metalPrices, setMetalPrices]         = useState(null);
  const [metalVariations, setMetalVariations] = useState({ or: null, argent: null });
  const [hawlStatus, setHawlStatus]           = useState(null);
  const [zakatCourante, setZakatCourante]     = useState(null);
  const [hijriDate, setHijriDate]             = useState("");
  const [nisabData, setNisabData]             = useState(null);
  // ✅ FIX : patrimoine actuel depuis actifs BDD (pas montantDebut du hawl)
  const [patrimoineActuel, setPatrimoineActuel] = useState(0);

  const isDark = currentTheme === "dark";
  const th = {
    bg:      () => isDark ? COLORS.darkBg      : COLORS.lightBg,
    card:    () => isDark ? COLORS.darkCard     : COLORS.lightCard,
    border:  () => isDark ? COLORS.darkBorder   : COLORS.lightBorder,
    text:    () => isDark ? COLORS.darkText     : COLORS.lightText,
    textSec: () => isDark ? COLORS.darkTextSec  : COLORS.lightTextSec,
    textTer: () => isDark ? COLORS.darkTextTer  : COLORS.lightTextTer,
    primary: () => isDark ? "#4daf52"           : COLORS.primary,
  };

  const buildHijriDate = useCallback((lang) => {
    try {
      const locale = lang === "ar" ? "ar-SA-u-ca-islamic-umalqura" : "fr-FR-u-ca-islamic-umalqura";
      return new Intl.DateTimeFormat(locale, {
        day: "numeric", month: "long", year: "numeric",
      }).format(new Date());
    } catch { return ""; }
  }, []);

  const loadData = useCallback(async () => {
    if (!user?.id) return;
    try {
      setHijriDate(buildHijriDate(currentLanguage));

      const [pricesRes, hawlRes] = await Promise.all([
        currencyService.getMetalsPrices("MAD"),
        hawlService.loadHawlStatusForUser(user.id),
      ]);

      if (pricesRes) setMetalPrices(pricesRes);

      // Variations prix métaux
      const [orHistRes, argentHistRes] = await Promise.all([
        supabase.from("historique_prix_metaux")
          .select("pourcentage_variation, date_changement")
          .eq("type_metal", "OR").eq("devise", "MAD")
          .not("pourcentage_variation", "is", null)
          .order("date_changement", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("historique_prix_metaux")
          .select("pourcentage_variation, date_changement")
          .eq("type_metal", "ARGENT").eq("devise", "MAD")
          .not("pourcentage_variation", "is", null)
          .order("date_changement", { ascending: false }).limit(1).maybeSingle(),
      ]);
      setMetalVariations({
        or:     orHistRes?.data?.pourcentage_variation ?? null,
        argent: argentHistRes?.data?.pourcentage_variation ?? null,
      });

      // ✅ FIX : nisab_base depuis profil utilisateur
      const { data: profil } = await supabase
        .from("profils_utilisateurs")
        .select("nisab_base")
        .eq("id_utilisateur", user.id)
        .single();

      if (hawlRes) {
        const nisabBase = profil?.nisab_base || "or_24k";
        setHawlStatus({
          completed:       hawlRes.completed,
          daysRemaining:   hawlRes.daysRemaining,
          daysElapsed:     hawlRes.daysElapsed,
          progressPercent: hawlRes.progressPercent,
          nextAnniversary: hawlRes.nextAnniversary,
          dateDebut:       hawlRes.dateDebut,
          dateEcheance:    hawlRes.nextAnniversary,
          montantDebut:    hawlRes.montantDebut || 0,
          nisabBase,
          message:         hawlRes.message,
          // ✅ FIX : statut clair basé sur les vraies données
          statut: hawlRes.completed
            ? "COMPLETE"
            : hawlRes.message === "not_started"
              ? "NOT_STARTED"
              : "EN_COURS",
        });

        const nisabRes = await nisabService.computeNisabThreshold(nisabBase, "MAD");
        if (nisabRes?.success) setNisabData(nisabRes);
      }

      // ✅ FIX : charger la zakat annuelle la plus récente (hors REMPLACE/EXEMPTE)
      const zakatRes = await zakatService.getZakatAnnuelHistory(user.id);
      if (zakatRes?.success && zakatRes.data?.length > 0) {
        // Prendre la première NON_PAYE ou EN_COURS_HAWL, sinon la plus récente
        const zakatDue = zakatRes.data.find(z =>
          z.statut === 'NON_PAYE' || z.statut === 'EN_COURS_HAWL'
        );
        setZakatCourante(zakatDue || zakatRes.data[0]);

        // ✅ FIX : patrimoine actuel = montant_imposable de la zakat courante
        const montantImposable = zakatDue?.montant_imposable || zakatRes.data[0]?.montant_imposable || 0;
        setPatrimoineActuel(montantImposable);
      } else {
        // Aucune zakat → patrimoine = total actifs actifs
        const { data: actifs } = await supabase
          .from('zakat_actif')
          .select('valeur_totale')
          .eq('utilisateur_id', user.id)
          .eq('actif', true);
        const total = (actifs || []).reduce((s, a) => s + (a.valeur_totale || 0), 0);
        setPatrimoineActuel(total);
      }

    } catch (e) {
      console.error("DashboardScreen loadData:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id, currentLanguage, buildHijriDate]);

  // ✅ FIX : useFocusEffect pour recharger à chaque retour sur l'écran
  useFocusEffect(useCallback(() => {
    setLoading(true);
    loadData();
  }, [loadData]));

  useEffect(() => {
    setHijriDate(buildHijriDate(currentLanguage));
  }, [currentLanguage, buildHijriDate]);

  const onRefresh = () => { setRefreshing(true); loadData(); };

  

    const handleLogout = () => {
    confirm(
      t('logout'),
      t('logout_confirm_message'),
      async () => {
        await signOut();
      }
    );
  };

  const toggleLanguage = () => {
    const next = currentLanguage === "fr" ? "ar" : currentLanguage === "ar" ? "en" : "fr";
    changeLanguage(next);
  };

  const hawlPct = useCallback(() => {
    if (!hawlStatus?.dateDebut) return 0;
    const jours = hijriDaysBetween(new Date(hawlStatus.dateDebut), new Date());
    return Math.min(Math.round((jours / HAWL_DAYS_MALIKI) * 100), 100);
  }, [hawlStatus]);

  const joursRestants = useCallback(() => {
    if (!hawlStatus?.dateEcheance) return null;
    const echeance = new Date(hawlStatus.dateEcheance);
    const today = new Date();
    const diff = Math.ceil((echeance - today) / (1000 * 60 * 60 * 24));
    return diff > 0 ? diff : 0;
  }, [hawlStatus]);

  const orPrice24k = metalPrices?.gold24k ? `${Number(metalPrices.gold24k).toFixed(2)} MAD` : "—";
  const argPrice   = metalPrices?.silver  ? `${Number(metalPrices.silver).toFixed(2)} MAD`  : "—";

  // ✅ FIX : afficher la zakat seulement si réellement due (NON_PAYE)
  const zakatDue = zakatCourante?.statut === 'NON_PAYE'
    ? formatCurrency(zakatCourante.montant_restant || zakatCourante.montant_zakat_calcule)
    : null;

  // ✅ FIX : patrimoine = montant_imposable actuel (pas montantDebut hawl)
  const patrimoineDisplay = formatCurrency(patrimoineActuel || hawlStatus?.montantDebut || 0);

  const MetalChip = ({ label, value, change }) => {
    const hasChange = change !== null && change !== undefined;
    const pctText   = hasChange ? `${change >= 0 ? "+" : ""}${Number(change).toFixed(2)}%` : null;
    return (
      <View style={[styles.metalChip, { backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.25)" }]}>
        <Text style={styles.metalChipLabel} numberOfLines={1}>{label}</Text>
        <Text style={styles.metalChipVal} numberOfLines={1} ellipsizeMode="tail">{value}</Text>
        {pctText
          ? <Text style={[styles.metalChipChg, { color: change >= 0 ? "#86efac" : "#fca5a5" }]} numberOfLines={1}>{pctText}</Text>
          : <Text style={[styles.metalChipChg, { color: "rgba(255,255,255,0.3)" }]} numberOfLines={1}>—</Text>}
      </View>
    );
  };

  const StatBox = ({ icon: Icon, iconBg, iconColor, value, label, sub }) => (
    <View style={[styles.statBox, { backgroundColor: th.card(), borderColor: th.border() }]}>
      <View style={[styles.statIconWrap, { backgroundColor: iconBg }]}>
        <Icon size={16} color={iconColor} strokeWidth={1.8} />
      </View>
      <Text style={[styles.statN, { color: th.text() }]}>{value}</Text>
      <Text style={[styles.statL, { color: th.textSec() }]}>{label}</Text>
      {sub ? <Text style={[styles.statS, { color: th.textTer() }]}>{sub}</Text> : null}
    </View>
  );

  const QuickAction = ({ icon: Icon, iconBg, iconColor, label, desc, onPress }) => (
    <TouchableOpacity
      style={[styles.qaBtn, { backgroundColor: th.card(), borderColor: th.border() }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.qaIcon, { backgroundColor: iconBg }]}>
        <Icon size={16} color={iconColor} strokeWidth={1.8} />
      </View>
      <Text style={[styles.qaLabel, { color: th.text() }]}>{label}</Text>
      <Text style={[styles.qaDesc, { color: th.textTer() }]}>{desc}</Text>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={[styles.loadWrap, { backgroundColor: th.bg() }]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  const pct      = hawlPct();
  const restants = joursRestants();

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: th.bg(), writingDirection: isRTL ? "rtl" : "ltr" }]}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
    >
      {/* ── Topbar ─────────────────────────────────────────────── */}
      <View style={[styles.topbar, { backgroundColor: COLORS.primary }]}>
        <View style={styles.topbarRow}>
          <View style={styles.userBlock}>
            <View style={styles.avatarRing}>
              <Text style={styles.avatarTxt}>
                {(user?.name || user?.email || "U").charAt(0).toUpperCase()}
              </Text>
            </View>
            <View>
              <Text style={styles.userName}>{user?.name || t("user")}</Text>
              <Text style={styles.userSub}>{user?.ville || user?.pays || t("morocco")}</Text>
            </View>
          </View>
          <View style={styles.topbarActions}>
            <TouchableOpacity style={styles.iconBtn} onPress={toggleLanguage}>
              <Text style={styles.langTxt}>{currentLanguage.toUpperCase()}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconBtn} onPress={handleLogout}>
              <LogOut size={18} color="#fff" strokeWidth={1.8} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={[styles.hijriStrip, { flexDirection: "row" }]}>
          <View style={{ flex: 1, marginRight: 10 }}>
            <Text style={styles.hijriLbl}>{t("today")}</Text>
            <Text style={[styles.hijriVal, isRTL ? { textAlign: "right", writingDirection: "rtl" } : {}]}>
              {hijriDate || "—"}
            </Text>
          </View>
          <View style={styles.metalRow}>
            <MetalChip label={t("gold_24k_label")} value={orPrice24k} change={metalVariations.or} />
            <MetalChip label={t("silver_label")} value={argPrice}   change={metalVariations.argent} />
          </View>
        </View>
      </View>

      {/* ── Carte Hawl ─────────────────────────────────────────── */}
      <View style={[styles.hawlCard, { backgroundColor: th.card(), borderColor: th.border() }]}>
        <View style={styles.hawlTop}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.hawlTitle, { color: th.textSec() }]}>
              {t("net_wealth_hawl")}
            </Text>
            {/* ✅ FIX : afficher patrimoineActuel, pas montantDebut */}
            <Text style={[styles.hawlAmount, { color: th.text() }]}>{patrimoineDisplay}</Text>
            <Text style={[styles.hawlCur, { color: th.textTer() }]}>
              {t("imposable")}
            </Text>
          </View>
          {/* ✅ FIX : badge statut hawl correct */}
          <View style={[
            styles.statusPill,
            hawlStatus?.statut === "COMPLETE"
              ? { backgroundColor: isDark ? "#0d2e0d" : "#ecfdf5", borderColor: isDark ? "#2e5a2e" : "#6ee7b7" }
              : hawlStatus?.statut === "EN_COURS"
              ? { backgroundColor: isDark ? "#1a1400" : "#fef9ec", borderColor: isDark ? "#c9991a40" : "#fcd34d" }
              : { backgroundColor: isDark ? "#1a1a1a" : "#f3f4f6", borderColor: isDark ? "#2a2a2a" : "#d1d5db" },
          ]}>
            <Text style={[
              styles.statusPillTxt,
              { color: hawlStatus?.statut === "COMPLETE"
                ? (isDark ? "#86efac" : "#065f46")
                : hawlStatus?.statut === "EN_COURS"
                ? (isDark ? "#f5c542" : "#92400e")
                : (isDark ? "#9ca3af" : "#6b7280") }
            ]}>
              {hawlStatus?.statut === "COMPLETE"
                ? (t("hawl_completed"))
                : hawlStatus?.statut === "EN_COURS"
                ? (t("hawl_in_progress"))
                : (t("hawl_not_started"))}
            </Text>
          </View>
        </View>

        {/* Barre de progression */}
        {hawlStatus?.dateDebut ? (
          <View style={styles.hawlProgress}>
            <View style={styles.hawlProgressMeta}>
              <View style={styles.progressDot}>
                <View style={[styles.dot, { backgroundColor: COLORS.primaryMid }]} />
                <Text style={[styles.progressMetaTxt, { color: th.textSec() }]}>
                  {hawlStatus.dateDebut ? formatDate(hawlStatus.dateDebut, currentLanguage, { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                </Text>
              </View>
              <Text style={[styles.progressPctTxt, { color: th.primary() }]}>{pct}%</Text>
              <View style={styles.progressDot}>
                <Text style={[styles.progressMetaTxt, { color: th.textSec() }]}>
                  {hawlStatus.dateEcheance ? formatDate(hawlStatus.dateEcheance, currentLanguage, { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                </Text>
                <View style={[styles.dot, { backgroundColor: COLORS.gold }]} />
              </View>
            </View>
            <View style={[styles.progressBg, { backgroundColor: isDark ? "#0d2e0d" : "#f0faf0" }]}>
              <View style={[styles.progressFill, { width: `${pct}%`, backgroundColor: COLORS.primaryLight }]} />
            </View>
            {restants != null && (
              <Text style={[styles.progressRemaining, { color: th.primary(), textAlign: isRTL ? "left" : "right" }]}>
                {restants} {t("days_remaining")}
              </Text>
            )}
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.startHawlBtn, { borderColor: th.primary() }]}
            onPress={() => navigation.navigate("Zakat")}
          >
            <Plus size={14} color={th.primary()} strokeWidth={2} />
            <Text style={[styles.startHawlTxt, { color: th.primary() }]}>
              {t("start_hawl")}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ✅ FIX : Bannière Zakat due uniquement si NON_PAYE */}
      {zakatDue && (
        <View style={[styles.zakatBanner, { backgroundColor: COLORS.primary }]}>
          <View>
            <Text style={styles.zakatBannerLbl}>
              {t("zakat_due_label")}
            </Text>
            <Text style={styles.zakatBannerAmt}>{zakatDue}</Text>
            <Text style={styles.zakatBannerSub}>
              {t("year_format", { year: zakatCourante?.annee_hijri })} · {t("maliki_rule")}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.payBtn}
            onPress={() => navigation.navigate("Zakat")}
            activeOpacity={0.85}
          >
            <Text style={styles.payBtnTxt}>{t("pay")} ↗</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ✅ Bannière hawl en cours (si pas de zakat due) */}
      {!zakatDue && hawlStatus?.statut === "EN_COURS" && (
        <View style={[styles.hawlBanner, {
          backgroundColor: isDark ? "#2a1e00" : "#fef3c7",
          borderColor: isDark ? "#f5c54230" : "#fcd34d",
        }]}>
          <Clock size={16} color={COLORS.warning} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.hawlBannerTxt, { color: COLORS.warning }]}>
              {t("hawl_in_progress")}
              {hawlStatus.daysRemaining > 0 ? ` · ${t("remaining_days", { count: hawlStatus.daysRemaining })}` : ''}
            </Text>
            <Text style={[styles.hawlBannerSub, { color: isDark ? "#9ca3af" : "#92400e" }]}>
              {t("nisab_reached_hawl_due")}
            </Text>
          </View>
        </View>
      )}

      {/* ── Stats ──────────────────────────────────────────────── */}
      <View style={styles.sectionHead}>
        <Text style={[styles.sectionH, { color: th.text() }]}>
          {t("summary")}
        </Text>
      </View>
      <View style={styles.statsGrid}>
        <StatBox
          icon={TrendingUp}
          iconBg={isDark ? "#0d2e0d" : "#ecfdf5"}
          iconColor="#059669"
          value={zakatCourante?.montant_total_actifs
            ? formatCurrency(zakatCourante.montant_total_actifs)
            : "—"}
          label={t("total_assets")}
          sub={t("before_debts")}
        />
        <StatBox
          icon={Shield}
          iconBg={isDark ? "#2a1e00" : "#fffbeb"}
          iconColor="#d97706"
          value={nisabData?.threshold
            ? formatCurrency(nisabData.threshold)
            : "—"}
          label={t("nisab_threshold")}
          sub={nisabData?.label || hawlStatus?.nisabBase || "or_24k"}
        />
        <StatBox
          icon={Clock}
          iconBg={isDark ? "#1a1a2a" : "#eff6ff"}
          iconColor="#2563eb"
          value={zakatCourante?.annee_hijri || getCurrentHijriDate()?.split(" ").pop() || "—"}
          label={t("hijri_year")}
          // ✅ FIX : afficher statut lisible
          sub={
            zakatCourante?.statut === 'NON_PAYE'      ? t("zakat_not_paid_status") :
            zakatCourante?.statut === 'PAYE'           ? t("zakat_paid_status") :
            zakatCourante?.statut === 'EN_COURS_HAWL'  ? t("hawl_in_progress_status") :
            zakatCourante?.statut === 'EXEMPTE'        ? t("exempt_status") :
            '—'
          }
        />
        <StatBox
          icon={Calculator}
          iconBg={isDark ? "#2a0d0d" : "#fff1f2"}
          iconColor="#e11d48"
          value={zakatCourante?.montant_total_dettes
            ? formatCurrency(zakatCourante.montant_total_dettes)
            : "0"}
          label={t("deductible_debts")}
          sub={t("declared")}
        />
      </View>

      {/* ── Actions rapides ──────────────────────────────────────── */}
      <View style={styles.sectionHead}>
        <Text style={[styles.sectionH, { color: th.text() }]}>
          {t("quick_actions")}
        </Text>
      </View>
      <View style={styles.quickGrid}>
        <QuickAction
          icon={Calculator}
          iconBg={isDark ? "#0d2e0d" : "#ecfdf5"}
          iconColor="#059669"
          label={t("zakat_calculator")}
          desc={t("maliki_rules")}
          onPress={() => navigation.navigate("Zakat")}
        />
        <QuickAction
          icon={Map}
          iconBg={isDark ? "#0d2a2a" : "#f0fdfa"}
          iconColor="#0d9488"
          label={t("hajj_assistant")}
          desc={t("hajj_guide")}
          onPress={() => navigation.navigate("Hajj")}
        />
        <QuickAction
          icon={User}
          iconBg={isDark ? "#1a0d2a" : "#faf5ff"}
          iconColor="#7c3aed"
          label={t("profile")}
          desc={t("nisab_hawl_currency")}
          onPress={() => navigation.navigate("Profil")}
        />
        <QuickAction
          icon={Settings}
          iconBg={isDark ? "#2a1500" : "#fffbeb"}
          iconColor="#d97706"
          label={t("settings")}
          desc={t("app_settings")}
          onPress={() => navigation.navigate("Paramètres")}
        />
      </View>

      <View style={styles.bottomPad} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container:        { flex: 1 },
  loadWrap:         { flex: 1, justifyContent: "center", alignItems: "center" },
  bottomPad:        { height: 32 },
  topbar:           { paddingTop: 52, paddingHorizontal: 20, paddingBottom: 16 },
  topbarRow:        { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  userBlock:        { flexDirection: "row", alignItems: "center", gap: 10 },
  avatarRing:       { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.15)", borderWidth: 1.5, borderColor: "rgba(255,255,255,0.35)", justifyContent: "center", alignItems: "center" },
  avatarTxt:        { fontSize: 15, fontWeight: "500", color: "#fff" },
  userName:         { fontSize: 15, fontWeight: "500", color: "#fff" },
  userSub:          { fontSize: 11, color: "rgba(255,255,255,0.6)", marginTop: 1 },
  topbarActions:    { flexDirection: "row", gap: 8, alignItems: "center" },
  iconBtn:          { width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.12)", justifyContent: "center", alignItems: "center" },
  langTxt:          { fontSize: 11, fontWeight: "500", color: "#fff" },
  hijriStrip:       { backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 10, padding: 12, alignItems: "center" },
  hijriLbl:         { fontSize: 11, color: "rgba(255,255,255,0.6)", marginBottom: 2 },
  hijriVal:         { fontSize: 14, fontWeight: "500", color: "#fff" },
  metalRow:         { flexDirection: "row", gap: 8 },
  metalChip:        { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, alignItems: "center", overflow: "hidden", maxWidth: 140 },
  metalChipLabel:   { fontSize: 9, color: "rgba(255,255,255,0.55)", marginBottom: 1 },
  metalChipVal:     { fontSize: 11, fontWeight: "500", color: "#fff" },
  metalChipChg:     { fontSize: 9, marginTop: 1 },
  hawlCard:         { margin: 16, borderRadius: 16, borderWidth: 0.5, padding: 18 },
  hawlTop:          { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 },
  hawlTitle:        { fontSize: 11, fontWeight: "500", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 4 },
  hawlAmount:       { fontSize: 26, fontWeight: "500", lineHeight: 30 },
  hawlCur:          { fontSize: 12, marginTop: 3 },
  statusPill:       { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 0.5, flexShrink: 1 },
  statusPillTxt:    { fontSize: 10, fontWeight: "500" },
  hawlProgress:     { gap: 6 },
  hawlProgressMeta: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  progressDot:      { flexDirection: "row", alignItems: "center", gap: 5 },
  dot:              { width: 6, height: 6, borderRadius: 3 },
  progressMetaTxt:  { fontSize: 10 },
  progressPctTxt:   { fontSize: 12, fontWeight: "500" },
  progressBg:       { height: 6, borderRadius: 3 },
  progressFill:     { height: 6, borderRadius: 3 },
    progressRemaining:{ fontSize: 11, marginTop: 2 },
  startHawlBtn:     { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderWidth: 1, borderRadius: 10, paddingVertical: 10, marginTop: 4 },
  startHawlTxt:     { fontSize: 13, fontWeight: "500" },
  zakatBanner:      { marginHorizontal: 16, borderRadius: 14, padding: 16, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  zakatBannerLbl:   { fontSize: 11, color: "rgba(255,255,255,0.6)", marginBottom: 3 },
  zakatBannerAmt:   { fontSize: 22, fontWeight: "500", color: "#fff" },
  zakatBannerSub:   { fontSize: 10, color: "rgba(255,255,255,0.5)", marginTop: 3 },
  payBtn:           { backgroundColor: "#fff", borderRadius: 10, paddingHorizontal: 18, paddingVertical: 10 },
  payBtnTxt:        { fontSize: 13, fontWeight: "500", color: COLORS.primary },
  hawlBanner:       { marginHorizontal: 16, marginTop: 12, borderRadius: 14, padding: 14, flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1 },
  hawlBannerTxt:    { fontSize: 13, fontWeight: "600" },
  hawlBannerSub:    { fontSize: 11, marginTop: 2 },
  sectionHead:      { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginHorizontal: 16, marginTop: 20, marginBottom: 10 },
  sectionH:         { fontSize: 13, fontWeight: "500" },
  statsGrid:        { flexDirection: "row", flexWrap: "wrap", gap: 10, marginHorizontal: 16 },
  statBox:          { width: "47.5%", borderRadius: 12, borderWidth: 0.5, padding: 14 },
  statIconWrap:     { width: 32, height: 32, borderRadius: 8, justifyContent: "center", alignItems: "center", marginBottom: 10 },
  statN:            { fontSize: 15, fontWeight: "500", marginBottom: 2 },
  statL:            { fontSize: 11 },
  statS:            { fontSize: 10, marginTop: 2 },
  quickGrid:        { flexDirection: "row", flexWrap: "wrap", gap: 10, marginHorizontal: 16 },
  qaBtn:            { width: "47.5%", borderRadius: 12, borderWidth: 0.5, padding: 14, gap: 8 },
  qaIcon:           { width: 34, height: 34, borderRadius: 9, justifyContent: "center", alignItems: "center" },
  qaLabel:          { fontSize: 12, fontWeight: "500" },
  qaDesc:           { fontSize: 10, marginTop: -4 },
});

export default DashboardScreen;