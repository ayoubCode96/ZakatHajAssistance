// BeneficiarySelector.js
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
} from "react-native";
import { X, Plus } from "lucide-react-native";
import InputField from "../components/InputField";

const MALIKI_PRIMARY = "#1a5d1a";

const BeneficiarySelector = React.memo(({
  beneficiaires,
  categories,
  selectedBeneficiary,
  onSelect,
  onClear,
  onAddBeneficiary,
  getCategoryColor,
  t,
  isDark,
}) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [selectedCat, setSelectedCat] = useState(categories[0] || null);

  useEffect(() => {
    if (categories.length > 0 && !selectedCat) setSelectedCat(categories[0]);
  }, [categories]);

 const handleAdd = () => {
  if (!newName.trim() || !selectedCat) return;
  onAddBeneficiary(newName.trim(), selectedCat, (newBenef) => {
    setNewName("");
    setShowAddForm(false);
    if (newBenef) onSelect(newBenef); // ← auto-sélection après création
  });
};

  const getInitials = (name) =>
    name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();

  const textColor = isDark ? "#e8edf5" : "#1a2a1a";
  const textSec = isDark ? "#a8c6a8" : "#4a6b4a";
  const borderColor = isDark ? "#334155" : "#e2e8f0";
  const cardBg = isDark ? "#1a2a1a" : "#ffffff";

  if (selectedBeneficiary) {
    const cat = selectedBeneficiary.categorie_beneficiaire;
    const color = getCategoryColor(cat?.id);
    return (
      <View style={{
        backgroundColor: color + "18",
        borderRadius: 12,
        borderWidth: 1.5,
        borderColor: color,
        padding: 12,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
      }}>
        <View style={{
          width: 38, height: 38, borderRadius: 19,
          backgroundColor: color,
          alignItems: "center", justifyContent: "center",
        }}>
          <Text style={{ color: "#fff", fontSize: 12, fontWeight: "600" }}>
            {getInitials(selectedBeneficiary.nom)}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontWeight: "600", fontSize: 14, color: textColor }}>
            {selectedBeneficiary.nom}
          </Text>
          <Text style={{ fontSize: 11, color: color, marginTop: 2 }}>
            {cat?.nom_francais || "—"}
          </Text>
        </View>
        <TouchableOpacity
          onPress={onClear}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={{
            width: 28, height: 28, borderRadius: 14,
            backgroundColor: color + "22",
            alignItems: "center", justifyContent: "center",
          }}
        >
          <X size={14} color={color} />
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={{ gap: 8 }}>
      {/* Beneficiary list */}
      <ScrollView style={{ maxHeight: 180 }} nestedScrollEnabled>
        {beneficiaires.length === 0 ? (
          <Text style={{ color: textSec, fontSize: 13, textAlign: "center", paddingVertical: 12 }}>
            Aucun bénéficiaire encore
          </Text>
        ) : (
          beneficiaires.map((b) => {
            const cat = b.categorie_beneficiaire;
            const color = getCategoryColor(cat?.id);
            return (
              <TouchableOpacity
                key={b.id}
                onPress={() => onSelect(b)}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 10,
                  padding: 10,
                  borderRadius: 10,
                  borderWidth: 0.5,
                  borderColor: borderColor,
                  backgroundColor: cardBg,
                  marginBottom: 6,
                }}
              >
                <View style={{
                  width: 34, height: 34, borderRadius: 17,
                  backgroundColor: color + "22",
                  alignItems: "center", justifyContent: "center",
                }}>
                  <Text style={{ color, fontSize: 11, fontWeight: "600" }}>
                    {getInitials(b.nom)}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontWeight: "500", color: textColor }}>
                    {b.nom}
                  </Text>
                  <Text style={{ fontSize: 11, color: textSec, marginTop: 1 }}>
                    {cat?.nom_francais || "—"}
                  </Text>
                </View>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      {/* Add form toggle */}
      <TouchableOpacity
        onPress={() => setShowAddForm(!showAddForm)}
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          padding: 10,
          borderRadius: 10,
          borderWidth: 0.5,
          borderStyle: "dashed",
          borderColor: MALIKI_PRIMARY,
        }}
      >
        <Plus size={16} color={MALIKI_PRIMARY} />
        <Text style={{ color: MALIKI_PRIMARY, fontSize: 13, fontWeight: "500" }}>
          {showAddForm ? "Annuler" : "Ajouter un bénéficiaire"}
        </Text>
      </TouchableOpacity>

      {/* Inline add form */}
      {showAddForm && (
        <View style={{
          padding: 14,
          borderRadius: 12,
          borderWidth: 0.5,
          borderColor: borderColor,
          backgroundColor: isDark ? "#0f1f0f" : "#f7faf7",
          gap: 10,
        }}>
          <Text style={{ fontSize: 13, fontWeight: "500", color: textColor }}>
            Nouveau bénéficiaire
          </Text>

          <TextInput
            style={{
              borderWidth: 0.5,
              borderColor: borderColor,
              borderRadius: 10,
              padding: 10,
              fontSize: 14,
              color: textColor,
              backgroundColor: cardBg,
            }}
            value={newName}
            onChangeText={setNewName}
            placeholder="Ex: Association Al-Baraka..."
            placeholderTextColor={textSec}
          />

          <View>
            <Text style={{ fontSize: 12, color: textSec, marginBottom: 8 }}>
              Catégorie (8 bénéficiaires légitimes en Islam)
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={{ flexDirection: "row", gap: 6 }}>
                {categories.map((cat) => {
                  const color = getCategoryColor(cat.id);
                  const active = selectedCat?.id === cat.id;
                  return (
                    <TouchableOpacity
                      key={cat.id}
                      onPress={() => setSelectedCat(cat)}
                      style={{
                        paddingHorizontal: 10,
                        paddingVertical: 6,
                        borderRadius: 20,
                        borderWidth: active ? 1.5 : 0.5,
                        borderColor: active ? color : borderColor,
                        backgroundColor: active ? color + "22" : "transparent",
                      }}
                    >
                      <Text style={{
                        fontSize: 11,
                        fontWeight: active ? "600" : "400",
                        color: active ? color : textSec,
                      }}>
                        {cat.nom_francais}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
          </View>

          <View style={{ flexDirection: "row", gap: 8 }}>
            <TouchableOpacity
              onPress={() => setShowAddForm(false)}
              style={{
                flex: 1, padding: 10, borderRadius: 10,
                borderWidth: 0.5, borderColor: borderColor,
                alignItems: "center",
              }}
            >
              <Text style={{ fontSize: 13, color: textSec }}>Annuler</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleAdd}
              style={{
                flex: 1, padding: 10, borderRadius: 10,
                backgroundColor: MALIKI_PRIMARY,
                alignItems: "center",
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: "500", color: "#fff" }}>Ajouter</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
});

export default BeneficiarySelector;