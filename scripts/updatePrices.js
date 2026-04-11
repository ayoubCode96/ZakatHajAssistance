import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const GOLD_API_KEY = process.env.GOLD_API_KEY;

// Map des pays vers devises
const countryCurrencies = {
  US: "USD", // États-Unis
  FR: "EUR", // France
  DE: "EUR", // Allemagne
  GB: "GBP", // Royaume-Uni
  CA: "CAD", // Canada
  MA: "MAD", // Maroc
  DZ: "DZD", // Algérie
  TN: "TND", // Tunisie
  SA: "SAR", // Arabie Saoudite
  AE: "AED", // Émirats Arabes Unis
  QA: "QAR", // Qatar
  KW: "KWD", // Koweït
  BH: "BHD", // Bahreïn
  OM: "OMR", // Oman
  TR: "TRY", // Turquie
  EG: "EGP", // Égypte
  JO: "JOD", // Jordanie
  LB: "LBP", // Liban
  SY: "SYP", // Syrie
  IQ: "IQD", // Irak
  IR: "IRR", // Iran
};

// Récupérer les pays/devises uniques des utilisateurs
async function getUserCountries() {
  try {
    const { data: users, error } = await supabase
      .from("profils_utilisateurs")
      .select("pays")
      .not("pays", "is", null);

    if (error) {
      console.warn("⚠️ Erreur récupération pays:", error.message);
      return ["MA"]; // Default à Maroc
    }

    // Extraire les devises uniques
    const devisesSet = new Set();
    users.forEach(user => {
      if (user.pays) {
        const devise = countryCurrencies[user.pays] || "MAD";
        devisesSet.add(devise);
      }
    });

    // Ajouter MAD par défaut
    devisesSet.add("MAD");

    console.log(`📍 Devises trouvées: ${Array.from(devisesSet).join(", ")}`);
    return Array.from(devisesSet);
  } catch (error) {
    console.error("❌ Erreur getUserCountries:", error.message);
    return ["MAD"]; // Fallback à MAD
  }
}

// Récupérer les prix depuis GoldAPI
async function fetchMetalPrices() {
  try {
    const response = await fetch(
      "https://www.goldapi.io/api/XAU/usd",
      {
        headers: {
          "x-access-token": GOLD_API_KEY,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`GoldAPI responded with status ${response.status}`);
    }

    const goldData = await response.json();

    // Récupérer aussi l'argent (Silver)
    const silverResponse = await fetch(
      "https://www.goldapi.io/api/XAG/usd",
      {
        headers: {
          "x-access-token": GOLD_API_KEY,
        },
      }
    );

    if (!silverResponse.ok) {
      throw new Error(`GoldAPI Silver responded with status ${silverResponse.status}`);
    }

    const silverData = await silverResponse.json();

    return {
      gold: goldData.price, // Prix en USD par troy oz
      silver: silverData.price, // Prix en USD par troy oz
    };
  } catch (error) {
    console.error("❌ Erreur récupération GoldAPI:", error.message);
    throw error;
  }
}

// Récupérer les taux de change USD -> devises
async function getExchangeRates(devises) {
  try {
    const baseDevise = "USD";
    const response = await fetch(
      `https://api.exchangerate-api.com/v4/latest/${baseDevise}`
    );

    if (!response.ok) {
      throw new Error(`Exchange rate API responded with status ${response.status}`);
    }

    const data = await response.json();
    const rates = {};

    // Récupérer les taux pour chaque devise
    devises.forEach(devise => {
      rates[devise] = data.rates[devise] || data.rates.MAD; // Fallback à MAD
    });

    console.log(`\n💱 Taux de change USD vers:`);
    devises.forEach(devise => {
      console.log(`   ${devise}: ${rates[devise].toFixed(4)}`);
    });

    return rates;
  } catch (error) {
    console.error("❌ Erreur récupération taux change:", error.message);
    // Retourner au moins MAD
    return { MAD: 10.25, USD: 1 };
  }
}

// 1 troy ounce = 31.1035 grammes
const TROY_OZ_TO_GRAMS = 31.1035;

async function updateMetalPrice(type, metalName, pricePerTroyOzUSD, exchangeRates, devises) {
  try {
    const pricePerGramUSD = pricePerTroyOzUSD / TROY_OZ_TO_GRAMS;

    console.log(`\n📊 ${type}:`);
    console.log(`   Prix USD/g: $${pricePerGramUSD.toFixed(6)}`);

    // Obtenir l'enregistrement actif pour ce métal
    const { data: current, error: selectError } = await supabase
      .from("prix_metaux_precieux")
      .select("id, prix_gramme")
      .eq("type_metal", type)
      .eq("actif", true)
      .eq("devise", "USD") // Stocker le prix de base en USD
      .single();

    if (selectError && selectError.code !== 'PGRST116') {
      console.warn(`⚠️  Métal ${type} USD non trouvé (OK pour première fois)`);
    }

    const oldPrice = current?.prix_gramme || 0;

    // Mise à jour du prix en USD (prix de base)
    if (current) {
      const { error: updateError } = await supabase
        .from("prix_metaux_precieux")
        .update({
          prix_gramme: parseFloat(pricePerGramUSD.toFixed(6)),
          updated_at: new Date().toISOString(),
        })
        .eq("id", current.id);

      if (updateError) {
        console.error(`❌ Erreur mise à jour ${type} USD:`, updateError.message);
        return false;
      }

      const change = oldPrice > 0 
        ? ((pricePerGramUSD - oldPrice) / oldPrice * 100).toFixed(2)
        : "0.00";
      console.log(`✅ ${type} USD mis à jour (${change > 0 ? '+' : ''}${change}%)`);
    }

    // Mettre à jour pour chaque devise
    for (const devise of devises) {
      if (devise === "USD") continue; // Déjà traité

      const exchangeRate = exchangeRates[devise] || exchangeRates.MAD;
      const priceInDevise = pricePerGramUSD * exchangeRate;

      const { data: existingRecord, error: findError } = await supabase
        .from("prix_metaux_precieux")
        .select("id")
        .eq("type_metal", type)
        .eq("devise", devise)
        .eq("actif", true)
        .single();

      if (!findError && existingRecord) {
        // Mise à jour
        const { error: updateError } = await supabase
          .from("prix_metaux_precieux")
          .update({
            prix_gramme: parseFloat(priceInDevise.toFixed(2)),
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingRecord.id);

        if (updateError) {
          console.error(`❌ Erreur mise à jour ${type} ${devise}:`, updateError.message);
          continue;
        }

        console.log(`✅ ${type} ${devise}/g: ${priceInDevise.toFixed(2)}`);
      } else {
        // Insertion
        const { error: insertError } = await supabase
          .from("prix_metaux_precieux")
          .insert([
            {
              type_metal: type,
              devise: devise,
              prix_gramme: parseFloat(priceInDevise.toFixed(2)),
              actif: true,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
          ]);

        if (insertError) {
          console.error(`❌ Erreur insertion ${type} ${devise}:`, insertError.message);
          continue;
        }

        console.log(`✅ ${type} ${devise}/g: ${priceInDevise.toFixed(2)} (nouveau)`);
      }
    }

    return true;
  } catch (error) {
    console.error(`❌ Erreur traitement ${type}:`, error.message);
    return false;
  }
}

async function main() {
  try {
    console.log("🚀 Démarrage de mise à jour des prix des métaux précieux...");
    console.log(`⏰ Heure: ${new Date().toISOString()}`);

    // 1. Récupérer les devises des utilisateurs
    const devises = await getUserCountries();
    console.log(`\n💱 Devises à mettre à jour: ${devises.join(", ")}`);

    // 2. Récupérer les prix des métaux depuis GoldAPI
    const { gold, silver } = await fetchMetalPrices();
    console.log(`\n💰 Prix actuels (USD/Troy oz):`);
    console.log(`   Or: $${gold.toFixed(2)}`);
    console.log(`   Argent: $${silver.toFixed(2)}`);

    // 3. Récupérer les taux de change pour toutes les devises
    const exchangeRates = await getExchangeRates(devises);
    console.log(`\n📊 Taux de change (USD = 1):`);
    Object.entries(exchangeRates).forEach(([devise, rate]) => {
      console.log(`   1 USD = ${rate.toFixed(4)} ${devise}`);
    });

    // 4. Mettre à jour les prix pour chaque devise
    const results = [];
    results.push(await updateMetalPrice("OR", "Gold", gold, exchangeRates, devises));
    results.push(await updateMetalPrice("ARGENT", "Silver", silver, exchangeRates, devises));

    // 5. Résumé
    const successCount = results.filter(r => r).length;
    console.log(`\n✅ Résumé: ${successCount}/${results.length} mises à jour réussies`);
    console.log("🎉 Processus terminé avec succès!\n");

    if (successCount === results.length) {
      process.exit(0);
    } else {
      process.exit(1);
    }
  } catch (error) {
    console.error("❌ Erreur fatale:", error);
    process.exit(1);
  }
}

main();