# Mise à jour Multi-Devise du Script de Prix des Métaux

## 📋 Résumé des modifications

Le script `scripts/updatePrices.js` a été complètement refactorisé pour supporter **plusieurs devises** au lieu d'une seule (MAD).

## ✅ Modifications apportées

### 1. **Script Principal (`scripts/updatePrices.js`)**

#### Nouvelles fonctions:
- **`getUserCountries()`** - Récupère les pays des utilisateurs depuis `profils_utilisateurs` et les mappe à leurs devises ISO (MAD, SAR, AED, EUR, etc.)
- **`getExchangeRates(devises)`** - Récupère les taux de change USD→devises pour tous les pays utilisés

#### Fonctions modifiées:
- **`updateMetalPrice(type, metalName, pricePerTroyOzUSD, exchangeRates, devises)`**
  - Accepte maintenant les taux de change et les devises en paramètres
  - Stocke les prix en USD comme prix de base
  - Crée/met à jour les enregistrements pour chaque devise
  - Supporte l'insertion et la mise à jour de prix multi-devise

- **`main()`**
  - Récupère dynamiquement les devises des utilisateurs
  - Obtient les taux de change pour toutes les devises
  - Itère sur chaque devise pour mettre à jour les prix
  - Affiche un résumé détaillé du processus

### 2. **Mapping des Pays → Devises**

```javascript
const countryCurrencies = {
  US: "USD", FR: "EUR", DE: "EUR", GB: "GBP", CA: "CAD",
  MA: "MAD", DZ: "DZD", TN: "TND",
  SA: "SAR", AE: "AED", QA: "QAR", KW: "KWD", BH: "BHD", OM: "OMR",
  TR: "TRY", EG: "EGP", JO: "JOD", LB: "LBP", SY: "SYP", IQ: "IQD", IR: "IRR"
};
```

### 3. **Migration Base de Données** (`scripts/migration_multi_currency_prices.sql`)

**Modifications de la table `prix_metaux_precieux`:**
- **Index unique modifié**: `(type_metal, devise, actif) WHERE actif = TRUE`
  - Ancien: `(type_metal, actif)` - Un seul prix par métal
  - Nouveau: `(type_metal, devise, actif)` - Un seul prix par métal **et par devise**

- **Nouveaux index:**
  - `idx_prix_metal_actif`: (type_metal, devise, actif)
  - `idx_prix_devise`: (devise)

- **Données initiales:** Insertion des prix de base pour USD, MAD, EUR

## 🚀 Utilisation

### Option 1: GitHub Actions (Recommandé - Automatisé)

Le workflow `.github/workflows/update-metal-prices.yml` s'exécute:
- ✅ **Manuellement**: Allez à Actions → "Update Metal Prices from GoldAPI" → "Run workflow"
- ✅ **Automatiquement**: Tous les 6 heures (0, 6, 12, 18 UTC)

### Option 2: Exécution locale

```bash
# Définir les variables d'environnement
export GOLD_API_KEY="your_key_here"
export SUPABASE_URL="your_url_here"
export SUPABASE_SERVICE_ROLE_KEY="your_service_role_key_here"

# Exécuter le script
node scripts/updatePrices.js
```

### Option 3: Migration SQL

Si les index n'ont pas été mis à jour automatiquement par Supabase:

1. Allez à Supabase Console → SQL Editor
2. Copier-coller le contenu de `scripts/migration_multi_currency_prices.sql`
3. Cliquer "Run"

## 📊 Flux de Données

```
┌─────────────────────────────────────────┐
│ getUserCountries()                      │
│ Query: SELECT DISTINCT pays             │
│ FROM profils_utilisateurs               │
└────────────────┬────────────────────────┘
                 │
                 ├─→ [MA, SA, AE, FR, ...]
                 │
                 ├─→ MAD, SAR, AED, EUR (+ MAD default)
                 │
┌────────────────▼────────────────────────┐
│ getExchangeRates(devises)               │
│ API: exchangerate-api.com               │
│ Response: {USD:1, MAD:10.25, EUR:0.92} │
│ Fallback: MAD if missing                │
└────────────────┬────────────────────────┘
                 │
                 ├─→ rates = {...}
                 │
┌────────────────▼────────────────────────┐
│ fetchMetalPrices()                      │
│ GoldAPI: XAU & XAG prices               │
│ Returns: {gold, silver} (USD/troy oz)   │
└────────────────┬────────────────────────┘
                 │
                 ├─→ Au: $2050.XX/troy oz
                 └─→ Ag: $24.XX/troy oz
                 │
┌────────────────▼────────────────────────┐
│ updateMetalPrice() x2                   │
│ For each devise:                        │
│  - Convert troy oz → grams              │
│  - Calculate price in devise            │
│  - Insert/Update prix_metaux_precieux   │
│                                         │
│ Results: OR/MAD, OR/EUR, OR/SAR, ...   │
│          AG/MAD, AG/EUR, AG/SAR, ...   │
└─────────────────────────────────────────┘
```

## 🔍 Vérification

### Vérifier les prix en base de données

```sql
SELECT type_metal, devise, prix_gramme, actif, updated_at
FROM prix_metaux_precieux
WHERE actif = TRUE
ORDER BY type_metal, devise;
```

### Exemple de résultat attendu:
```
| type_metal | devise | prix_gramme | actif | updated_at           |
|------------|--------|-------------|-------|----------------------|
| ARGENT     | AED    | 0.88        | true  | 2024-01-15 10:30:45  |
| ARGENT     | EUR    | 0.24        | true  | 2024-01-15 10:30:45  |
| ARGENT     | MAD    | 2.67        | true  | 2024-01-15 10:30:45  |
| ARGENT     | SAR    | 0.97        | true  | 2024-01-15 10:30:45  |
| ARGENT     | USD    | 0.26        | true  | 2024-01-15 10:30:45  |
| OR         | AED    | 75.65       | true  | 2024-01-15 10:30:45  |
| OR         | EUR    | 19.22       | true  | 2024-01-15 10:30:45  |
| OR         | MAD    | 214.25      | true  | 2024-01-15 10:30:45  |
| OR         | SAR    | 78.65       | true  | 2024-01-15 10:30:45  |
| OR         | USD    | 20.90       | true  | 2024-01-15 10:30:45  |
```

## 🔐 Variables d'Environnement Requises

### GitHub Actions Secrets (`.github/workflows/update-metal-prices.yml`):
```
GOLD_API_KEY              - Clé de l'API GoldAPI
SUPABASE_URL              - URL de votre projet Supabase
SUPABASE_SERVICE_ROLE_KEY - Clé de service Supabase (admin)
```

### Configuration locale:
```bash
export GOLD_API_KEY="your_goldapi_key"
export SUPABASE_URL="https://xxxxx.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="eyJhbGc..."
```

## 🐛 Dépannage

### Erreur: "Cannot read property 'MAD' of undefined"
- **Cause**: Les utilisateurs ont des pays non mappés
- **Solution**: Ajouter le pays au `countryCurrencies` object

### Erreur: "UNIQUE constraint failed"
- **Cause**: Multiplex enregistrements actifs pour même métal/devise
- **Solution**: Exécuter la migration SQL pour corriger les index

### Script n'exécute pas sur GitHub Actions
- [ ] Vérifier les secrets GitHub sont définis
- [ ] Vérifier la clé API GoldAPI est valide
- [ ] Vérifier les logs: Actions → Workflow → Logs

## 📈 Améliorations Futures

- [ ] Archiver les anciens prix dans `historique_prix_metaux`
- [ ] Dashboard d'analytics pour les prix par devise
- [ ] Notifications utilisateurs lors de changements importants
- [ ] Support de multi-devise dans l'UI React
- [ ] Cache des taux de change pour réduire appels API

## 📞 Support

Pour des questions ou problèmes:
1. Vérifier les logs du script
2. Vérifier les variablesvironementales
3. Vérifier la structure de la base de données
4. Consulter la documentation GoldAPI et ExchangeRate-API
