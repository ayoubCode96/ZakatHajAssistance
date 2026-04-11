-- Migration pour supporter plusieurs devises dans prix_metaux_precieux
-- Modification de l'index unique pour incluyre la devise

BEGIN;

-- Supprimer l'ancien index unique
DROP INDEX IF EXISTS idx_prix_actif_unique;

-- Créer un nouvel index unique qui inclut la devise
CREATE UNIQUE INDEX idx_prix_actif_unique ON prix_metaux_precieux(type_metal, devise, actif) WHERE actif = TRUE;

-- Améliorer l'index sur type_metal et actif pour inclure devise
DROP INDEX IF EXISTS idx_prix_metal_actif;
CREATE INDEX idx_prix_metal_actif ON prix_metaux_precieux(type_metal, devise, actif);

-- Créer un index pour rechercher par devise
CREATE INDEX IF NOT EXISTS idx_prix_devise ON prix_metaux_precieux(devise);

-- Insérer les prix de base en USD si non existants
INSERT INTO prix_metaux_precieux (type_metal, prix_gramme, devise, date_application, source, actif)
SELECT 'OR', 20.90, 'USD', CURRENT_DATE, 'GoldAPI', TRUE
WHERE NOT EXISTS (
    SELECT 1 FROM prix_metaux_precieux 
    WHERE type_metal = 'OR' AND devise = 'USD'
);

INSERT INTO prix_metaux_precieux (type_metal, prix_gramme, devise, date_application, source, actif)
SELECT 'ARGENT', 0.26, 'USD', CURRENT_DATE, 'GoldAPI', TRUE
WHERE NOT EXISTS (
    SELECT 1 FROM prix_metaux_precieux 
    WHERE type_metal = 'ARGENT' AND devise = 'USD'
);

-- Ajouter les prix pour MAD s'ils n'existent pas (basé sur taux USD/MAD ~10.25)
INSERT INTO prix_metaux_precieux (type_metal, prix_gramme, devise, date_application, source, actif)
SELECT 'OR', 214.25, 'MAD', CURRENT_DATE, 'GoldAPI', TRUE
WHERE NOT EXISTS (
    SELECT 1 FROM prix_metaux_precieux 
    WHERE type_metal = 'OR' AND devise = 'MAD'
);

INSERT INTO prix_metaux_precieux (type_metal, prix_gramme, devise, date_application, source, actif)
SELECT 'ARGENT', 2.67, 'MAD', CURRENT_DATE, 'GoldAPI', TRUE
WHERE NOT EXISTS (
    SELECT 1 FROM prix_metaux_precieux 
    WHERE type_metal = 'ARGENT' AND devise = 'MAD'
);

-- Ajouter des prix pour d'autres devises communes
INSERT INTO prix_metaux_precieux (type_metal, prix_gramme, devise, date_application, source, actif)
SELECT 'OR', 19.22, 'EUR', CURRENT_DATE, 'GoldAPI', TRUE
WHERE NOT EXISTS (
    SELECT 1 FROM prix_metaux_precieux 
    WHERE type_metal = 'OR' AND devise = 'EUR'
);

INSERT INTO prix_metaux_precieux (type_metal, prix_gramme, devise, date_application, source, actif)
SELECT 'ARGENT', 0.24, 'EUR', CURRENT_DATE, 'GoldAPI', TRUE
WHERE NOT EXISTS (
    SELECT 1 FROM prix_metaux_precieux 
    WHERE type_metal = 'ARGENT' AND devise = 'EUR'
);

COMMIT;

-- Vérifier les résultats
SELECT type_metal, devise, prix_gramme, actif, created_at 
FROM prix_metaux_precieux 
ORDER BY type_metal, devise;
