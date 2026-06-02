// components/HawlActifIndicator.js
// ═══════════════════════════════════════════════════════════════════
// Indicateur hawl pour UN actif individuel
// Affiche : barre de progression, jours restants, date échéance
// Utilisé dans MesActifs pour chaque carte d'actif
// ═══════════════════════════════════════════════════════════════════

import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Clock, CheckCircle, AlertCircle } from "lucide-react-native";
import { useTheme } from "../context/ThemeContext";
import { useAppTranslation } from "../hooks/useTranslation";
import { formatDate } from "../utils/zakatUtils";

const COLORS = {
  primary: "#1a5d1a",
  primaryLight: "#2e7d32",
  gold: "#c9991a",
  success: "#16a34a",
  warning: "#d97706",
  danger: "#dc2626",
  darkCard: "#172317",
  darkBorder: "#2a3f2a",
  darkText: "#e8f0e8",
  darkTextSec: "#9ebf9e",
  darkTextTer: "#6a8f6a",
  lightCard: "#ffffff",
  lightBorder: "#c8ddc8",
  lightText: "#1a2a1a",
  lightTextSec: "#4a6b4a",
  lightTextTer: "#7a9b7a",
};

const HAWL_DAYS = 354;

/**
 * Indicateur hawl compact pour une carte d'actif.
 *
 * Props :
 *   hawlStatus : résultat de hawlService.computeActifHawlStatus()
 *     { complete, joursEcoules, joursRestants, progressPercent, dateEcheance }
 *   compact : boolean — affichage minimal (juste barre + jours)
 *   showDate : boolean — afficher la date d'échéance
 */
const HawlActifIndicator = ({
  hawlStatus,
  compact = false,
  showDate = false,
}) => {
  const { currentTheme } = useTheme();
  const { t, currentLanguage, isRTL } = useAppTranslation();
  const isDark = currentTheme === "dark";

  const th = {
    card: () => (isDark ? COLORS.darkCard : COLORS.lightCard),
    border: () => (isDark ? COLORS.darkBorder : COLORS.lightBorder),
    text: () => (isDark ? COLORS.darkText : COLORS.lightText),
    textSec: () => (isDark ? COLORS.darkTextSec : COLORS.lightTextSec),
    textTer: () => (isDark ? COLORS.darkTextTer : COLORS.lightTextTer),
  };

  if (!hawlStatus) return null;

  const {
    complete,
    joursEcoules,
    joursRestants,
    progressPercent,
    dateEcheance,
  } = hawlStatus;

  // Couleurs selon état
  const color = complete
    ? COLORS.success
    : joursRestants <= 30
      ? COLORS.warning
      : COLORS.primary;

  const bgColor = complete
    ? isDark
      ? "#0f2a1a"
      : "#dcfce7"
    : joursRestants <= 30
      ? isDark
        ? "#2a1e00"
        : "#fef3c7"
      : isDark
        ? "#172317"
        : "#f0f7f0";

  // ── Mode compact (dans la carte actif) ────────────────────────
  if (compact) {
    return (
      <View
        style={[
          styles.compactContainer,
          { backgroundColor: bgColor, borderColor: color + "40", writingDirection: isRTL ? "rtl" : "ltr" },
        ]}
      >
        {/* Icône + label */}
        <View style={styles.compactRow}>
          {complete ? (
            <CheckCircle size={12} color={color} />
          ) : (
            <Clock size={12} color={color} />
          )}
          <Text style={[styles.compactLabel, { color }]}>
            {complete
              ? t("hawl_complete")
              : `${joursRestants}j ${t("remaining")}`}
          </Text>
          <Text style={[styles.compactPercent, { color: color + "cc" }]}>
            {progressPercent}%
          </Text>
        </View>

        {/* Barre de progression */}
        <View
          style={[
            styles.progressBg,
            { backgroundColor: isDark ? "#2a3f2a" : "#e8f0e8" },
          ]}
        >
          <View
            style={[
              styles.progressFill,
              {
                width: `${progressPercent}%`,
                backgroundColor: color,
              },
            ]}
          />
        </View>

        {/* Jours écoulés / total */}
        <Text style={[styles.compactSub, { color: th.textTer() }]}>
          {joursEcoules} / {HAWL_DAYS} {t("days")}
          {showDate &&
            dateEcheance &&
            !complete &&
            ` · ${t("hawl_deadline")}: ${formatDate(dateEcheance, currentLanguage, { day: "numeric", month: "short", year: "numeric" })}`}
        </Text>
      </View>
    );
  }

  // ── Mode complet (dans le modal détail actif) ──────────────────
  return (
    <View
      style={[
        styles.fullContainer,
        { backgroundColor: bgColor, borderColor: color, writingDirection: isRTL ? "rtl" : "ltr" },
      ]}
    >
      {/* En-tête */}
      <View style={styles.fullHeader}>
        {complete ? (
          <CheckCircle size={18} color={color} />
        ) : joursRestants <= 30 ? (
          <AlertCircle size={18} color={color} />
        ) : (
          <Clock size={18} color={color} />
        )}
        <Text style={[styles.fullTitle, { color }]}>
          {complete
            ? t("hawl_complete")
            : t("hawl_in_progress")}
        </Text>
        <View style={[styles.badge, { backgroundColor: color + "20" }]}>
          <Text style={[styles.badgeText, { color }]}>{progressPercent}%</Text>
        </View>
      </View>

      {/* Barre de progression */}
      <View
        style={[
          styles.progressBgFull,
          { backgroundColor: isDark ? "#2a3f2a" : "#d4edd4" },
        ]}
      >
        <View
          style={[
            styles.progressFillFull,
            {
              width: `${progressPercent}%`,
              backgroundColor: color,
            },
          ]}
        />
      </View>

      {/* Détails */}
      <View style={styles.detailsRow}>
        <View style={styles.detailBlock}>
          <Text style={[styles.detailLabel, { color: th.textSec() }]}>
            {t("days_elapsed")}
          </Text>
          <Text style={[styles.detailValue, { color }]}>
            {joursEcoules} / {HAWL_DAYS}
          </Text>
        </View>

        {!complete && (
          <View style={[styles.detailBlock, { alignItems: "center" }]}>
            <Text style={[styles.detailLabel, { color: th.textSec() }]}>
              {t("days_remaining")}
            </Text>
            <Text
              style={[
                styles.detailValue,
                { color, fontWeight: "800", fontSize: 18 },
              ]}
            >
              {joursRestants}
            </Text>
          </View>
        )}

        {dateEcheance && (
          <View style={[styles.detailBlock, { alignItems: "flex-end" }]}>
            <Text style={[styles.detailLabel, { color: th.textSec() }]}>
              {complete
                ? t("hawl_completed_on")
                : t("hawl_deadline")}
            </Text>
            <Text style={[styles.detailValue, { color, fontSize: 12 }]}>
              {formatDate(dateEcheance, currentLanguage, { day: "numeric", month: "short", year: "numeric" })}
            </Text>
          </View>
        )}
      </View>

      {/* Message si proche de l'échéance */}
      {!complete && joursRestants <= 30 && joursRestants > 0 && (
        <View
          style={[styles.alertRow, { backgroundColor: COLORS.warning + "15" }]}
        >
          <AlertCircle size={12} color={COLORS.warning} />
          <Text style={[styles.alertText, { color: COLORS.warning }]}>
            {t("hawl_ending_soon", { count: joursRestants })}
          </Text>
        </View>
      )}

      {/* Message si complété */}
      {complete && (
        <View
          style={[styles.alertRow, { backgroundColor: COLORS.success + "15" }]}
        >
          <CheckCircle size={12} color={COLORS.success} />
          <Text style={[styles.alertText, { color: COLORS.success }]}>
            {t("zakat_due_on_asset")}
          </Text>
        </View>
      )}
    </View>
  );
};

// ── Composant résumé global (pour le dashboard ZakatAnnuel) ──────────
/**
 * Résumé de tous les hawls d'actifs.
 * Props : stats — résultat de hawlService.computeHawlStats()
 */
export const HawlStatsCard = ({ stats, formatCurrency, isDark }) => {
  const { t, currentLanguage, isRTL } = useAppTranslation();
  if (!stats || stats.total === 0) return null;

  const th = {
    card: () => (isDark ? COLORS.darkCard : COLORS.lightCard),
    border: () => (isDark ? COLORS.darkBorder : COLORS.lightBorder),
    text: () => (isDark ? COLORS.darkText : COLORS.lightText),
    textSec: () => (isDark ? COLORS.darkTextSec : COLORS.lightTextSec),
  };

  return (
    <View
      style={[
        styles.statsCard,
        { backgroundColor: th.card(), borderColor: th.border(), writingDirection: isRTL ? "rtl" : "ltr" },
      ]}
    >
      {/* Titre */}
      <View style={styles.statsHeader}>
        <Clock size={16} color={COLORS.primary} />
        <Text style={[styles.statsTitle, { color: th.text() }]}>
          {t("hawl_per_asset")}
        </Text>
      </View>

      {/* Compteurs */}
      <View style={styles.statsRow}>
        <View
          style={[
            styles.statsBubble,
            { backgroundColor: COLORS.success + "15" },
          ]}
        >
          <Text style={[styles.statsBubbleNum, { color: COLORS.success }]}>
            {stats.complets}
          </Text>
          <Text style={[styles.statsBubbleLabel, { color: COLORS.success }]}>
            {t("hawl_complete")}
          </Text>
        </View>
        <View
          style={[
            styles.statsBubble,
            { backgroundColor: COLORS.warning + "15" },
          ]}
        >
          <Text style={[styles.statsBubbleNum, { color: COLORS.warning }]}>
            {stats.enCours}
          </Text>
          <Text style={[styles.statsBubbleLabel, { color: COLORS.warning }]}>
            {t("hawl_in_progress")}
          </Text>
        </View>
      </View>

      {/* Valeurs */}
      {formatCurrency && (
        <View style={[styles.statsValues, { borderTopColor: th.border() }]}>
          <View style={styles.statsValueItem}>
            <Text style={[styles.statsValueLabel, { color: th.textSec() }]}>
              {t("value_hawl_complete")}
            </Text>
            <Text style={[styles.statsValueAmt, { color: COLORS.success }]}>
              {formatCurrency(stats.valeurAvecHawl)}
            </Text>
          </View>
          <View style={[styles.statsValueItem, { alignItems: "flex-end" }]}>
            <Text style={[styles.statsValueLabel, { color: th.textSec() }]}>
              {t("value_hawl_pending")}
            </Text>
            <Text style={[styles.statsValueAmt, { color: COLORS.warning }]}>
              {formatCurrency(stats.valeurSansHawl)}
            </Text>
          </View>
        </View>
      )}

      {/* Prochain hawl */}
      {stats.prochainHawl && (
        <View
          style={[
            styles.nextHawl,
            {
              backgroundColor: COLORS.primary + "10",
              borderColor: COLORS.primary + "30",
            },
          ]}
        >
          <Clock size={12} color={COLORS.primary} />
          <Text style={[styles.nextHawlText, { color: COLORS.primary }]}>
            {t("next_hawl")} :
            <Text style={{ fontWeight: "700" }}>
              {" "}
              {stats.prochainHawl.joursRestants}j{" "}
            </Text>
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  // ── Compact ──────────────────────────────────────────────────────
  compactContainer: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginTop: 8,
    gap: 4,
  },
  compactRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  compactLabel: {
    fontSize: 11,
    fontWeight: "600",
    flex: 1,
  },
  compactPercent: {
    fontSize: 11,
    fontWeight: "700",
  },
  compactSub: {
    fontSize: 10,
    marginTop: 2,
  },

  // ── Progress bar ─────────────────────────────────────────────────
  progressBg: {
    height: 4,
    borderRadius: 2,
    overflow: "hidden",
    marginTop: 2,
  },
  progressFill: {
    height: 4,
    borderRadius: 2,
  },
  progressBgFull: {
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
    marginVertical: 10,
  },
  progressFillFull: {
    height: 8,
    borderRadius: 4,
  },

  // ── Full ─────────────────────────────────────────────────────────
  fullContainer: {
    borderRadius: 12,
    borderWidth: 1.5,
    padding: 14,
    marginTop: 10,
  },
  fullHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  fullTitle: {
    fontSize: 14,
    fontWeight: "700",
    flex: 1,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  detailsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 4,
  },
  detailBlock: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 10,
    opacity: 0.7,
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: "700",
  },
  alertRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 6,
    padding: 8,
    marginTop: 10,
  },
  alertText: {
    fontSize: 11,
    fontWeight: "500",
    flex: 1,
  },

  // ── Stats Card ───────────────────────────────────────────────────
  statsCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginVertical: 8,
  },
  statsHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  statsTitle: {
    fontSize: 14,
    fontWeight: "700",
  },
  statsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 12,
  },
  statsBubble: {
    flex: 1,
    borderRadius: 10,
    padding: 10,
    alignItems: "center",
  },
  statsBubbleNum: {
    fontSize: 22,
    fontWeight: "800",
  },
  statsBubbleLabel: {
    fontSize: 11,
    fontWeight: "600",
    marginTop: 2,
  },
  statsValues: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 10,
    borderTopWidth: 1,
    marginBottom: 10,
  },
  statsValueItem: {},
  statsValueLabel: {
    fontSize: 10,
    marginBottom: 2,
  },
  statsValueAmt: {
    fontSize: 13,
    fontWeight: "700",
  },
  nextHawl: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
  },
  nextHawlText: {
    fontSize: 12,
    flex: 1,
  },
});

export default HawlActifIndicator;
