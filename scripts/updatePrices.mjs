import { createClient } from "@supabase/supabase-js";
// Vérifier les variables d'environnement
console.log("\n🔐 Vérification des variables d'environnement:");
console.log(`   SUPABASE_URL: ${process.env.SUPABASE_URL ? "✅ SET" : "❌ MISSING"}`);
console.log(`   SUPABASE_SERVICE_ROLE_KEY: ${process.env.SUPABASE_SERVICE_ROLE_KEY ? "✅ SET" : "❌ MISSING"}`);
console.log(`   GOLD_API_KEY: ${process.env.GOLD_API_KEY ? "✅ SET" : "❌ MISSING"}`);

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error("❌ ERREUR: Variables d'environnement manquantes!");
  process.exit(1);
}

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const GOLD_API_KEY = process.env.GOLD_API_KEY;

// Map des pays vers devises
const countryCurrencies = {
  US: "USD", FR: "EUR", DE: "EUR", GB: "GBP", CA: "CAD",
  MA: "MAD", DZ: "DZD", TN: "TND",
  SA: "SAR", AE: "AED", QA: "QAR", KW: "KWD", BH: "BHD", OM: "OMR",
  TR: "TRY", EG: "EGP", JO: "JOD", LB: "LBP", SY: "SYP", IQ: "IQD", IR: "IRR",
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
      return ["MAD"];
    }

    const devisesSet = new Set();
    users.forEach(user => {
      if (user.pays) {
        const devise = countryCurrencies[user.pays] || "MAD";
        devisesSet.add(devise);
      }
    });

    devisesSet.add("MAD");
    console.log(`📍 Devises trouvées: ${Array.from(devisesSet).join(", ")}`);
    return Array.from(devisesSet);
  } catch (error) {
    console.error("❌ Erreur getUserCountries:", error.message);
    return ["MAD"];
  }
}

// Récupérer les prix depuis GoldAPI
async function fetchMetalPrices() {
  try {
    if (!GOLD_API_KEY) {
      throw new Error("GOLD_API_KEY environment variable is not set");
    }

    const response = await fetch(
      "https://www.goldapi.io/api/XAU/USD",

      {
        headers: {
          "x-access-token": GOLD_API_KEY,
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`GoldAPI responded with status ${response.status}: ${errorText}`);
    }

    const goldData = await response.json();
console.log("🔍 GoldAPI response:", JSON.stringify(goldData));

if (goldData.error) {
  throw new Error(`GoldAPI error: ${goldData.error}`);
}
    // Récupérer aussi l'argent (Silver)
    const silverResponse = await fetch(
"https://www.goldapi.io/api/XAG/USD",      {
        headers: {
          "x-access-token": GOLD_API_KEY,
        },
      }
    );

    if (!silverResponse.ok) {
      const errorText = await silverResponse.text();
      throw new Error(`GoldAPI Silver responded with status ${silverResponse.status}: ${errorText}`);
    }

    const silverData = await silverResponse.json();

    return {
      gold: goldData.price, // Prix en USD par troy oz
      silver: silverData.price, // Prix en USD par troy oz
       gold_puretes: {
    prix_gramme_24k: goldData.price_gram_24k,
    prix_gramme_20k: goldData.price_gram_20k,
    prix_gramme_18k: goldData.price_gram_18k,
  },
  silver_puretes: null,
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

// Modifier updateMetalPrice pour accepter et sauvegarder les puretés
async function updateMetalPrice(type, metalName, pricePerTroyOzUSD, exchangeRates, devises, puretes) {
  try {
    const pricePerGramUSD = pricePerTroyOzUSD / TROY_OZ_TO_GRAMS;
    console.log(`\n📊 ${type}: $${pricePerGramUSD.toFixed(6)}/g USD`);

    for (const devise of devises) {
      const exchangeRate = exchangeRates[devise] || 1;
      const rate = devise === "USD" ? 1 : exchangeRate;

      const priceInDevise = pricePerGramUSD * rate;

      // Convertir les puretés dans la devise cible
      const puretes_devise = {};
      for (const [key, valUSD] of Object.entries(puretes)) {
        puretes_devise[key] = parseFloat((valUSD * rate).toFixed(4));
      }

      const { data: existingRecord, error: findError } = await supabase
        .from("prix_metaux_precieux")
        .select("id")
        .eq("type_metal", type)
        .eq("devise", devise)
        .eq("actif", true)
        .maybeSingle();

      const payload = {
  prix_gramme: parseFloat(priceInDevise.toFixed(4)),
  updated_at: new Date().toISOString(),
};

if (puretes) {
  const puretes_devise = {};
  for (const [key, valUSD] of Object.entries(puretes)) {
    puretes_devise[key] = parseFloat((valUSD * rate).toFixed(4));
  }
  payload.prix_gramme_24k = puretes_devise.prix_gramme_24k;
  payload.prix_gramme_20k = puretes_devise.prix_gramme_20k;
  payload.prix_gramme_18k = puretes_devise.prix_gramme_18k;
}

      if (existingRecord) {
        const { error: updateError } = await supabase
          .from("prix_metaux_precieux")
          .update(payload)
          .eq("id", existingRecord.id);

        if (updateError) {
          console.error(`❌ Update ${type} ${devise}:`, updateError.message);
        } else {
          console.log(`✅ ${type} ${devise} — 24k:${payload.prix_gramme_24k} 20k:${payload.prix_gramme_20k} 18k:${payload.prix_gramme_18k}`);
        }
      } else {
        const { error: insertError } = await supabase
          .from("prix_metaux_precieux")
          .insert([{
            type_metal: type,
            devise: devise,
            prix_gramme: parseFloat(priceInDevise.toFixed(4)),
            prix_gramme_24k: puretes_devise.prix_gramme_24k,
            prix_gramme_20k: puretes_devise.prix_gramme_20k,
            prix_gramme_18k: puretes_devise.prix_gramme_18k,
            date_application: new Date().toISOString().split('T')[0],
            actif: true,
            source: "GoldAPI",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }]);

        if (insertError) {
          console.error(`❌ Insert ${type} ${devise}:`, insertError.message);
        } else {
          console.log(`✅ ${type} ${devise} — 24k:${puretes_devise.prix_gramme_24k} (nouveau)`);
        }
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
    results.push(await updateMetalPrice("OR",     "Gold",   gold,   exchangeRates, devises, gold_puretes));
    results.push(await updateMetalPrice("ARGENT", "Silver", silver, exchangeRates, devises, null)); // ← null

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