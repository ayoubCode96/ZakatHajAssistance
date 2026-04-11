# 🤖 Automatisation Mise à Jour des Prix - GitHub Actions

## 📋 Vue d'ensemble

Ce système automatise la mise à jour des prix des métaux précieux (Or et Argent) toutes les 6 heures depuis l'API **GoldAPI** vers ta base de données **Supabase**.

## 📁 Fichiers créés/modifiés

### 1. **`.github/workflows/update-metal-prices.yml`**
Le workflow GitHub Actions qui déclenche la mise à jour automatique.

**Déclenchement :**
- ✅ Manuellement : Via bouton "Run workflow" sur GitHub
- ✅ Automatique : Toutes les 6 heures (0h, 6h, 12h, 18h UTC)

### 2. **`scripts/updatePrices.js`**
Le script Node.js qui :
- 📊 Récupère les prix depuis GoldAPI
- 🔄 Convertit USD → MAD (taux de change automatique)
- 💾 Met à jour la base Supabase
- 📈 Affiche les changements de prix

## 🔐 Secrets GitHub configurés

Tu as déjà défini ces secrets → Parfait ! ✅

```
GOLD_API_KEY           → Clé API GoldAPI
SUPABASE_URL           → URL de ta Supabase
SUPABASE_SERVICE_ROLE_KEY → Clé de service Supabase (permissions complètes)
```

## 🚀 Comment ça marche

### Flux de fonctionnement

```
GitHub Actions (Cron: toutes les 6h)
    ↓
📥 Clone le repo
    ↓
🔧 Setup Node.js 18
    ↓
📦 npm install
    ↓
🌍 node scripts/updatePrices.js
    ├─ 🌐 Appel GoldAPI (Or + Argent)
    ├─ 💱 Récupère taux USD → MAD
    ├─ 📐 Conversion troy oz → grammes (÷31.1035)
    └─ 💾 Mise à jour Supabase
    ↓
✅/❌ Résultat
```

## 📊 Exemple de sortie

```
🚀 Démarrage mise à jour prix métaux...
⏰ 2026-04-11T06:00:00.000Z

📈 Prix GoldAPI (par troy oz):
   Or: $2,450.75
   Argent: $31.25
   Taux USD/MAD: 10.2500

📊 OR:
   Prix USD/g: $78.8765
   Prix MAD/g: 808.09 MAD
✅ OR mis à jour (+2.50%)

📊 ARGENT:
   Prix USD/g: $1.0047
   Prix MAD/g: 10.30 MAD
✅ ARGENT mis à jour (+1.15%)

✅✅ ✅ Tous les prix ont été mis à jour avec succès!
```

## 🛠️ Configuration supplémentaire (Optionnel)

### Modifier la fréquence de mise à jour

Édite `.github/workflows/update-metal-prices.yml` :

```yaml
schedule:
  - cron: '0 */6 * * *'  # Chaque 6 heures (ACTUEL)
  # - cron: '0 * * * *'    # Chaque heure
  # - cron: '0 0 * * *'    # Une fois par jour (minuit UTC)
  # - cron: '0 */2 * * *'  # Toutes les 2 heures
```

### Format Cron :
```
      ┬   ┬       ┬     ┬    ┬
      │   │       │     │    │
      │   │       │     │    └─── Jour semaine (0-6, 0=dimanche)
      │   │       │     └─────── Mois (1-12)
      │   │       └───────────── Jour (1-31)
      │   └─────────────────── Heure (0-23)
      └───────────────────── Minute (0-59)
```

## ✅ Checklist de configuration

- [x] GOLD_API_KEY définie dans les secrets GitHub
- [x] SUPABASE_URL définie dans les secrets GitHub
- [x] SUPABASE_SERVICE_ROLE_KEY définie dans les secrets GitHub
- [ ] Vérifier que la table `prix_metaux_precieux` a les colonnes :
  - `type_metal` (OR, ARGENT)
  - `prix_gramme` (DECIMAL)
  - `prix_usd_gramme` (DECIMAL) - Optionnel
  - `actif` (BOOLEAN)

## 🔍 Vérification et monitoring

### Voir les logs du workflow

1. Accès : `GitHub.com → Ton repo → Actions`
2. Clique sur `Update Metal Prices from GoldAPI`
3. Vois les exécutions complètes avec logs détaillés

### Déclencher manuellement

```
GitHub → Actions → Update Metal Prices from GoldAPI → Run workflow
```

## 🐛 Troubleshooting

### "API Key invalid"
- Vérifie que `GOLD_API_KEY` est correctement définie
- Teste la clé sur https://www.goldapi.io/dashboard

### "Table not found"
- Vérifie que `prix_metaux_precieux` existe dans Supabase
- Vérifie que `SUPABASE_SERVICE_ROLE_KEY` a les permissions

### "Connection timeout"
- Peut être temporaire, GitHub réessayera automatiquement
- Vérifie la disponibilité de GoldAPI

## 📚 Documentation référence

- **GoldAPI** : https://www.goldapi.io/api
- **GitHub Actions** : https://docs.github.com/en/actions
- **Supabase** : https://supabase.com/docs

## 💡 Tips

✨ **Pro Tip 1** : Ajoute une étape Slack/Discord pour les notifications
✨ **Pro Tip 2** : Archive les anciens prix pour une historique
✨ **Pro Tip 3** : Cache les prix en cas d'erreur de l'API
