import React from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from "react-native";
import {
  X,
  Calculator,
  Coins,
  TrendingUp,
  DollarSign,
} from "lucide-react-native";
import Button from "./Button";

const ResultModal = ({
  visible,
  onClose,
  results,
  calculations,
  formatCurrency,
  theme,
  t,
}) => {
  const getBackgroundColor = () => (theme === "dark" ? "#1f2937" : "#ffffff");

  const getTextColor = () => (theme === "dark" ? "#ffffff" : "#1f2937");

  const getSecondaryTextColor = () =>
    theme === "dark" ? "#d1d5db" : "#6b7280";

  const getCardColor = () => (theme === "dark" ? "#374151" : "#f8fafc");

  if (!results) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View
          style={[
            styles.modalContent,
            { backgroundColor: getBackgroundColor() },
          ]}
        >
          {/* En-tête du modal */}
          <View style={styles.modalHeader}>
            <View style={styles.modalTitleContainer}>
              <Calculator size={24} color="#3b82f6" />
              <Text style={[styles.modalTitle, { color: getTextColor() }]}>
                {t("calculation_results")}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <X size={24} color={getSecondaryTextColor()} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody}>
            {/* Statut Zakat */}
            <View
              style={[
                styles.zakatStatus,
                { backgroundColor: results.isZakatDue ? "#dcfce7" : "#fef2f2" },
              ]}
            >
              <Text
                style={[
                  styles.zakatStatusText,
                  { color: results.isZakatDue ? "#166534" : "#dc2626" },
                ]}
              >
                {results.isZakatDue
                  ? `✅ ${t("zakat_due")}`
                  : `❌ ${t("zakat_not_due")}`}
              </Text>
            </View>

            {/* Montant de la Zakat */}
            {results.isZakatDue && (
              <View
                style={[
                  styles.zakatAmountCard,
                  { backgroundColor: getCardColor() },
                ]}
              >
                <Text
                  style={[
                    styles.zakatAmountLabel,
                    { color: getSecondaryTextColor() },
                  ]}
                >
                  {t("zakat_amount")}
                </Text>
                <Text style={[styles.zakatAmountValue, { color: "#3b82f6" }]}>
                  {formatCurrency(results.zakatAmount)}
                </Text>
                <Text
                  style={[
                    styles.zakatAmountNote,
                    { color: getSecondaryTextColor() },
                  ]}
                >
                  (2.5% {t("net_worth").toLowerCase()})
                </Text>
              </View>
            )}

            {/* Détails du calcul */}
            <View
              style={[
                styles.calculationDetails,
                { backgroundColor: getCardColor() },
              ]}
            >
              <Text style={[styles.detailsTitle, { color: getTextColor() }]}>
                Détails du Calcul
              </Text>

              {calculations.map((item, index) => (
                <View key={index} style={styles.calculationRow}>
                  <View style={styles.calculationLabelContainer}>
                    <Text
                      style={[
                        styles.calculationLabel,
                        { color: getTextColor() },
                      ]}
                    >
                      {item.label}
                    </Text>
                  </View>
                  <Text
                    style={[styles.calculationValue, { color: getTextColor() }]}
                  >
                    {formatCurrency(item.value)}
                  </Text>
                </View>
              ))}
            </View>

            {/* Explication */}
            <View
              style={[styles.explanation, { backgroundColor: getCardColor() }]}
            >
              <Text
                style={[styles.explanationTitle, { color: getTextColor() }]}
              >
                ��� Explication
              </Text>
              <Text
                style={[
                  styles.explanationText,
                  { color: getSecondaryTextColor() },
                ]}
              >
                {results.isZakatDue
                  ? `Votre patrimoine net (${formatCurrency(
                      results.netWorth
                    )}) dépasse le seuil Nisab (${formatCurrency(
                      results.nisab
                    )}). La Zakat est donc due à hauteur de 2.5% de votre patrimoine net.`
                  : `Votre patrimoine net (${formatCurrency(
                      results.netWorth
                    )}) ne dépasse pas le seuil Nisab (${formatCurrency(
                      results.nisab
                    )}). La Zakat n'est pas due pour le moment.`}
              </Text>
            </View>
          </ScrollView>

          {/* Pied du modal */}
          <View style={styles.modalFooter}>
            <Button
              title="Fermer"
              onPress={onClose}
              variant="outline"
              style={styles.closeModalButton}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "80%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  modalTitleContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginLeft: 8,
  },
  closeButton: {
    padding: 4,
  },
  modalBody: {
    padding: 20,
    maxHeight: "80%",
  },
  zakatStatus: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    alignItems: "center",
  },
  zakatStatusText: {
    fontSize: 16,
    fontWeight: "600",
  },
  zakatAmountCard: {
    padding: 20,
    borderRadius: 12,
    marginBottom: 16,
    alignItems: "center",
  },
  zakatAmountLabel: {
    fontSize: 16,
    marginBottom: 8,
  },
  zakatAmountValue: {
    fontSize: 32,
    fontWeight: "bold",
    marginBottom: 8,
  },
  zakatAmountNote: {
    fontSize: 14,
    fontStyle: "italic",
  },
  calculationDetails: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  detailsTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 16,
  },
  calculationRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  calculationLabelContainer: {
    flex: 1,
  },
  calculationLabel: {
    fontSize: 14,
  },
  calculationValue: {
    fontSize: 14,
    fontWeight: "600",
    marginLeft: 8,
  },
  explanation: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  explanationTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 8,
  },
  explanationText: {
    fontSize: 14,
    lineHeight: 20,
  },
  modalFooter: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
  },
  closeModalButton: {
    width: "100%",
  },
});

export default ResultModal;
