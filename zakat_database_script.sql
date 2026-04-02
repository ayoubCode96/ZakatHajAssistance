-- ============================================
-- Application Zakat - Script PostgreSQL Complet
-- Base de données pour Supabase
-- ============================================

-- ==========================================
-- SUPPRESSION DES TABLES (si existantes)
-- ==========================================
DROP TABLE IF EXISTS journal_activite CASCADE;
DROP TABLE IF EXISTS rappels CASCADE;
DROP TABLE IF EXISTS preferences_notification CASCADE;
DROP TABLE IF EXISTS paiement_zakat CASCADE;
DROP TABLE IF EXISTS beneficiaire CASCADE;
DROP TABLE IF EXISTS categorie_beneficiaire CASCADE;
DROP TABLE IF EXISTS zakat_annuel CASCADE;
DROP TABLE IF EXISTS dettes CASCADE;
DROP TABLE IF EXISTS zakat_actif CASCADE;
DROP TABLE IF EXISTS historique_parametrage CASCADE;
DROP TABLE IF EXISTS parametrage CASCADE;
DROP TABLE IF EXISTS historique_prix_metaux CASCADE;
DROP TABLE IF EXISTS prix_metaux_precieux CASCADE;
DROP TABLE IF EXISTS nisab_zakat CASCADE;
DROP TABLE IF EXISTS type_zakat CASCADE;
DROP TABLE IF EXISTS profil_utilisateur CASCADE;

-- ==========================================
-- TABLE 1: profil_utilisateur
-- ==========================================
CREATE TABLE profil_utilisateur (
    id SERIAL PRIMARY KEY,
    nom VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    telephone VARCHAR(20),
    mot_de_passe VARCHAR(255) NOT NULL,
    date_inscription TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    date_anniversaire_zakat DATE,
    devise VARCHAR(10) DEFAULT 'MAD',
    statut VARCHAR(20) DEFAULT 'ACTIF',
    derniere_connexion TIMESTAMP,
    photo VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE profil_utilisateur IS 'Gestion des comptes utilisateurs de l''application Zakat';
COMMENT ON COLUMN profil_utilisateur.id IS 'Identifiant unique auto-incrémenté';
COMMENT ON COLUMN profil_utilisateur.nom IS 'Nom complet de l''utilisateur';
COMMENT ON COLUMN profil_utilisateur.email IS 'Email unique pour connexion';
COMMENT ON COLUMN profil_utilisateur.telephone IS 'Numéro de téléphone pour contact/SMS';
COMMENT ON COLUMN profil_utilisateur.mot_de_passe IS 'Mot de passe crypté (bcrypt/argon2)';
COMMENT ON COLUMN profil_utilisateur.date_anniversaire_zakat IS 'Date hijri de début de son année Zakat (crucial!)';
COMMENT ON COLUMN profil_utilisateur.devise IS 'Devise préférée (MAD, EUR, USD)';
COMMENT ON COLUMN profil_utilisateur.statut IS 'ACTIF, INACTIF, SUSPENDU';

CREATE INDEX idx_profil_email ON profil_utilisateur(email);
CREATE INDEX idx_profil_statut ON profil_utilisateur(statut);

-- ==========================================
-- TABLE 2: type_zakat
-- ==========================================
CREATE TABLE type_zakat (
    id SERIAL PRIMARY KEY,
    nom_type VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,
    taux_zakat DECIMAL(5,2) DEFAULT 2.50,
    unite_mesure VARCHAR(20),
    actif BOOLEAN DEFAULT TRUE,
    ordre_affichage INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE type_zakat IS 'Types de Zakat selon la jurisprudence islamique';
COMMENT ON COLUMN type_zakat.nom_type IS 'OR, ARGENT, COMMERCE, BETAIL, AGRICULTURE, EPARGNE, CREANCES';
COMMENT ON COLUMN type_zakat.taux_zakat IS 'Pourcentage (2.5% standard, 5-10% agriculture)';
COMMENT ON COLUMN type_zakat.unite_mesure IS 'grammes, dirhams, têtes (bétail), kg (agriculture)';

INSERT INTO type_zakat (nom_type, description, taux_zakat, unite_mesure, ordre_affichage) VALUES
('OR', 'Zakat sur l''or possédé (bijoux, lingots)', 2.50, 'grammes', 1),
('ARGENT', 'Zakat sur l''argent possédé', 2.50, 'grammes', 2),
('EPARGNE', 'Zakat sur l''épargne et liquidités', 2.50, 'MAD', 3),
('COMMERCE', 'Zakat sur les biens commerciaux', 2.50, 'MAD', 4),
('AGRICULTURE', 'Zakat sur les récoltes agricoles', 5.00, 'kg', 5),
('BETAIL', 'Zakat sur le bétail (vaches, moutons, chameaux)', 2.50, 'têtes', 6),
('CREANCES', 'Zakat sur les créances récupérables', 2.50, 'MAD', 7);

-- ==========================================
-- TABLE 3: nisab_zakat
-- ==========================================
CREATE TABLE nisab_zakat (
    id SERIAL PRIMARY KEY,
    type_zakat_id INT NOT NULL,
    montant_nisab DECIMAL(15,4) NOT NULL,
    unite VARCHAR(20) NOT NULL,
    devise_reference VARCHAR(10) DEFAULT 'MAD',
    date_debut DATE NOT NULL,
    date_fin DATE,
    source_religieuse TEXT,
    notes TEXT,
    actif BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (type_zakat_id) REFERENCES type_zakat(id) ON DELETE CASCADE
);

COMMENT ON TABLE nisab_zakat IS 'Seuils minimums (Nisab) pour chaque type de Zakat selon la Sunna';
COMMENT ON COLUMN nisab_zakat.montant_nisab IS 'Quantité minimum à posséder (ex: 85g or, 595g argent)';
COMMENT ON COLUMN nisab_zakat.source_religieuse IS 'Référence religieuse (Hadith, Ijma, Fatwa)';

CREATE INDEX idx_nisab_type ON nisab_zakat(type_zakat_id);
CREATE INDEX idx_nisab_actif ON nisab_zakat(actif);

INSERT INTO nisab_zakat (type_zakat_id, montant_nisab, unite, date_debut, source_religieuse) VALUES
(1, 85, 'grammes', '2024-01-01', 'Nisab de l''or: 85 grammes (20 dinars islamiques)'),
(2, 595, 'grammes', '2024-01-01', 'Nisab de l''argent: 595 grammes (200 dirhams islamiques)'),
(3, 50750, 'MAD', '2024-01-01', 'Équivalent de 85g d''or en dirhams'),
(4, 50750, 'MAD', '2024-01-01', 'Même nisab que l''épargne'),
(5, 653, 'kg', '2024-01-01', '5 wasqs = 653 kg de grains'),
(6, 30, 'têtes', '2024-01-01', 'Nisab pour vaches: 30 têtes'),
(7, 50750, 'MAD', '2024-01-01', 'Créances récupérables si > nisab');

-- ==========================================
-- TABLE 4: prix_metaux_precieux
-- ==========================================
CREATE TABLE prix_metaux_precieux (
    id SERIAL PRIMARY KEY,
    type_metal VARCHAR(20) NOT NULL,
    prix_gramme DECIMAL(15,4) NOT NULL,
    devise VARCHAR(10) DEFAULT 'MAD',
    date_application DATE NOT NULL,
    date_expiration DATE,
    source VARCHAR(255),
    type_prix VARCHAR(30) DEFAULT 'ACHAT',
    actif BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE prix_metaux_precieux IS 'Prix actuels de l''or et argent pour calculs Zakat';
COMMENT ON COLUMN prix_metaux_precieux.type_metal IS 'OR ou ARGENT';
COMMENT ON COLUMN prix_metaux_precieux.prix_gramme IS 'Prix par gramme en devise locale';
COMMENT ON COLUMN prix_metaux_precieux.actif IS 'Un seul prix actif par métal à la fois';

CREATE INDEX idx_prix_metal_actif ON prix_metaux_precieux(type_metal, actif);
CREATE INDEX idx_prix_date ON prix_metaux_precieux(date_application DESC);
CREATE UNIQUE INDEX idx_prix_actif_unique ON prix_metaux_precieux(type_metal, actif) WHERE actif = TRUE;

INSERT INTO prix_metaux_precieux (type_metal, prix_gramme, devise, date_application, source) VALUES
('OR', 650.50, 'MAD', CURRENT_DATE, 'Banque Al-Maghrib'),
('ARGENT', 8.20, 'MAD', CURRENT_DATE, 'Marché international');

-- ==========================================
-- TABLE 5: historique_prix_metaux
-- ==========================================
CREATE TABLE historique_prix_metaux (
    id SERIAL PRIMARY KEY,
    prix_metaux_id INT,
    type_metal VARCHAR(20) NOT NULL,
    ancien_prix DECIMAL(15,4),
    nouveau_prix DECIMAL(15,4) NOT NULL,
    pourcentage_variation DECIMAL(8,4),
    devise VARCHAR(10) DEFAULT 'MAD',
    date_changement TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    modifie_par INT,
    source_changement VARCHAR(50),
    raison TEXT,
    FOREIGN KEY (prix_metaux_id) REFERENCES prix_metaux_precieux(id) ON DELETE SET NULL,
    FOREIGN KEY (modifie_par) REFERENCES profil_utilisateur(id) ON DELETE SET NULL
);

COMMENT ON TABLE historique_prix_metaux IS 'Historique complet des changements de prix or/argent';
COMMENT ON COLUMN historique_prix_metaux.pourcentage_variation IS 'Variation % par rapport prix précédent';

CREATE INDEX idx_historique_metal_date ON historique_prix_metaux(type_metal, date_changement DESC);

-- ==========================================
-- TABLE 6: parametrage
-- ==========================================
CREATE TABLE parametrage (
    id SERIAL PRIMARY KEY,
    nom_parametre VARCHAR(50) NOT NULL UNIQUE,
    valeur VARCHAR(255) NOT NULL,
    type_valeur VARCHAR(20) DEFAULT 'STRING',
    description TEXT,
    categorie VARCHAR(50),
    modifiable_par_user BOOLEAN DEFAULT FALSE,
    actif BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE parametrage IS 'Paramètres généraux de configuration';

CREATE INDEX idx_parametrage_categorie ON parametrage(categorie);

INSERT INTO parametrage (nom_parametre, valeur, type_valeur, description, categorie) VALUES
('TAUX_CHANGE_EUR_MAD', '10.65', 'NUMBER', 'Taux de change EUR vers MAD', 'CONVERSION'),
('TAUX_CHANGE_USD_MAD', '9.85', 'NUMBER', 'Taux de change USD vers MAD', 'CONVERSION'),
('ANNEE_HIJRI_EN_COURS', '1446', 'NUMBER', 'Année hijri en cours', 'CALENDRIER'),
('POURCENTAGE_ALERTE_PRIX', '5.0', 'NUMBER', 'Seuil variation prix pour notifier', 'NOTIFICATION');

-- ==========================================
-- TABLE 7: historique_parametrage
-- ==========================================
CREATE TABLE historique_parametrage (
    id SERIAL PRIMARY KEY,
    parametrage_id INT NOT NULL,
    ancienne_valeur VARCHAR(255),
    nouvelle_valeur VARCHAR(255) NOT NULL,
    date_changement TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    modifie_par INT,
    raison TEXT,
    adresse_ip VARCHAR(45),
    FOREIGN KEY (parametrage_id) REFERENCES parametrage(id) ON DELETE CASCADE,
    FOREIGN KEY (modifie_par) REFERENCES profil_utilisateur(id) ON DELETE SET NULL
);

COMMENT ON TABLE historique_parametrage IS 'Historique modifications paramètres système';

CREATE INDEX idx_historique_param ON historique_parametrage(parametrage_id, date_changement DESC);

-- ==========================================
-- TABLE 8: zakat_actif
-- ==========================================
CREATE TABLE zakat_actif (
    id SERIAL PRIMARY KEY,
    utilisateur_id INT NOT NULL,
    type_zakat_id INT NOT NULL,
    nom_actif VARCHAR(100),
    quantite DECIMAL(15,4),
    valeur_unitaire DECIMAL(15,2),
    valeur_totale DECIMAL(15,2),
    date_acquisition DATE,
    date_ajout TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    actif BOOLEAN DEFAULT TRUE,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (utilisateur_id) REFERENCES profil_utilisateur(id) ON DELETE CASCADE,
    FOREIGN KEY (type_zakat_id) REFERENCES type_zakat(id) ON DELETE RESTRICT
);

COMMENT ON TABLE zakat_actif IS 'Biens possédés par utilisateurs soumis à Zakat';

CREATE INDEX idx_actif_user ON zakat_actif(utilisateur_id, actif);
CREATE INDEX idx_actif_type ON zakat_actif(type_zakat_id);

-- ==========================================
-- TABLE 9: dettes
-- ==========================================
CREATE TABLE dettes (
    id SERIAL PRIMARY KEY,
    utilisateur_id INT NOT NULL,
    montant_dette DECIMAL(15,2) NOT NULL,
    type_dette VARCHAR(50),
    creancier VARCHAR(150),
    date_contraction DATE,
    date_echeance DATE,
    deductible BOOLEAN DEFAULT TRUE,
    rembourse BOOLEAN DEFAULT FALSE,
    montant_rembourse DECIMAL(15,2) DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (utilisateur_id) REFERENCES profil_utilisateur(id) ON DELETE CASCADE
);

COMMENT ON TABLE dettes IS 'Dettes déductibles avant calcul Zakat';
COMMENT ON COLUMN dettes.deductible IS 'Selon Fiqh: court terme déductible, long terme débat';

CREATE INDEX idx_dettes_user ON dettes(utilisateur_id, deductible, rembourse);

-- ==========================================
-- TABLE 10: zakat_annuel
-- ==========================================
CREATE TABLE zakat_annuel (
    id SERIAL PRIMARY KEY,
    utilisateur_id INT NOT NULL,
    annee_hijri INT NOT NULL,
    date_debut DATE NOT NULL,
    date_fin DATE NOT NULL,
    montant_total_actifs DECIMAL(15,2),
    montant_total_dettes DECIMAL(15,2),
    montant_imposable DECIMAL(15,2),
    nisab_applique DECIMAL(15,2),
    type_nisab_applique VARCHAR(20),
    depasse_nisab BOOLEAN,
    montant_zakat_calcule DECIMAL(15,2),
    montant_zakat_paye DECIMAL(15,2) DEFAULT 0,
    montant_restant DECIMAL(15,2),
    statut VARCHAR(30) DEFAULT 'NON_PAYE',
    date_calcul TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    recalcule_auto BOOLEAN DEFAULT FALSE,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (utilisateur_id) REFERENCES profil_utilisateur(id) ON DELETE CASCADE
);

COMMENT ON TABLE zakat_annuel IS 'Calculs annuels Zakat par utilisateur/année hijri';
COMMENT ON COLUMN zakat_annuel.montant_imposable IS 'Richesse nette = Actifs - Dettes';
COMMENT ON COLUMN zakat_annuel.depasse_nisab IS 'TRUE si doit payer Zakat (richesse >= nisab)';

CREATE INDEX idx_zakat_user_annee ON zakat_annuel(utilisateur_id, annee_hijri);
CREATE INDEX idx_zakat_statut ON zakat_annuel(statut);
CREATE UNIQUE INDEX idx_zakat_user_annee_unique ON zakat_annuel(utilisateur_id, annee_hijri);

-- ==========================================
-- TABLE 11: categorie_beneficiaire
-- ==========================================
CREATE TABLE categorie_beneficiaire (
    id SERIAL PRIMARY KEY,
    nom_categorie VARCHAR(50) NOT NULL UNIQUE,
    nom_arabe VARCHAR(100),
    nom_francais VARCHAR(100),
    description TEXT,
    verset_reference VARCHAR(100),
    ordre_priorite INT,
    actif BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE categorie_beneficiaire IS '8 catégories bénéficiaires Zakat (Coran 9:60)';

INSERT INTO categorie_beneficiaire (nom_categorie, nom_arabe, nom_francais, description, verset_reference, ordre_priorite) VALUES
('FUQARA', 'الفقراء', 'Les pauvres', 'Ceux sans ressources suffisantes', 'Sourate 9:60', 1),
('MASAKIN', 'المساكين', 'Les nécessiteux', 'Ceux dans besoin extrême', 'Sourate 9:60', 2),
('AMILIN', 'العاملون عليها', 'Collecteurs', 'Collecteurs et distributeurs Zakat', 'Sourate 9:60', 3),
('MUALLAF', 'المؤلفة قلوبهم', 'Nouveaux musulmans', 'Renforcer leur foi', 'Sourate 9:60', 4),
('RIQAB', 'في الرقاب', 'Affranchissement', 'Libération captifs', 'Sourate 9:60', 5),
('GHARIMIN', 'الغارمين', 'Endettés', 'Accablés par dettes', 'Sourate 9:60', 6),
('FISABILILLAH', 'في سبيل الله', 'Voie d''Allah', 'Efforts cause Allah', 'Sourate 9:60', 7),
('IBNSABIL', 'ابن السبيل', 'Voyageurs', 'Voyageurs démunis', 'Sourate 9:60', 8);

-- ==========================================
-- TABLE 12: beneficiaire
-- ==========================================
CREATE TABLE beneficiaire (
    id SERIAL PRIMARY KEY,
    categorie_beneficiaire_id INT NOT NULL,
    nom VARCHAR(150) NOT NULL,
    type_beneficiaire VARCHAR(30),
    telephone VARCHAR(20),
    email VARCHAR(150),
    adresse TEXT,
    ville VARCHAR(100),
    pays VARCHAR(50) DEFAULT 'Maroc',
    identifiant_fiscal VARCHAR(50),
    notes TEXT,
    verifie BOOLEAN DEFAULT FALSE,
    actif BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (categorie_beneficiaire_id) REFERENCES categorie_beneficiaire(id) ON DELETE RESTRICT
);

COMMENT ON TABLE beneficiaire IS 'Personnes/organisations bénéficiaires Zakat';
COMMENT ON COLUMN beneficiaire.verifie IS 'Si vérifié comme éligible à recevoir Zakat';

CREATE INDEX idx_beneficiaire_categorie ON beneficiaire(categorie_beneficiaire_id, actif);
CREATE INDEX idx_beneficiaire_ville ON beneficiaire(ville);

-- ==========================================
-- TABLE 13: paiement_zakat
-- ==========================================
CREATE TABLE paiement_zakat (
    id SERIAL PRIMARY KEY,
    zakat_annuel_id INT NOT NULL,
    beneficiaire_id INT NOT NULL,
    montant_paye DECIMAL(15,2) NOT NULL,
    date_paiement DATE NOT NULL,
    moyen_paiement VARCHAR(30),
    reference_paiement VARCHAR(100),
    justificatif VARCHAR(255),
    lieu_paiement VARCHAR(150),
    temoin_present VARCHAR(150),
    notes TEXT,
    valide BOOLEAN DEFAULT TRUE,
    date_enregistrement TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (zakat_annuel_id) REFERENCES zakat_annuel(id) ON DELETE CASCADE,
    FOREIGN KEY (beneficiaire_id) REFERENCES beneficiaire(id) ON DELETE RESTRICT
);

COMMENT ON TABLE paiement_zakat IS 'Historique complet paiements Zakat';
COMMENT ON COLUMN paiement_zakat.temoin_present IS 'Nom témoin lors paiement (recommandé Islam)';

CREATE INDEX idx_paiement_zakat ON paiement_zakat(zakat_annuel_id);
CREATE INDEX idx_paiement_beneficiaire ON paiement_zakat(beneficiaire_id);
CREATE INDEX idx_paiement_date ON paiement_zakat(date_paiement DESC);

-- ==========================================
-- TABLE 14: preferences_notification
-- ==========================================
CREATE TABLE preferences_notification (
    id SERIAL PRIMARY KEY,
    utilisateur_id INT NOT NULL UNIQUE,
    rappel_calcul_annuel BOOLEAN DEFAULT TRUE,
    jours_avant_calcul INT DEFAULT 30,
    rappel_paiement BOOLEAN DEFAULT TRUE,
    frequence_rappel_paiement VARCHAR(20) DEFAULT 'MENSUEL',
    rappel_maj_actifs BOOLEAN DEFAULT TRUE,
    frequence_maj_actifs VARCHAR(20) DEFAULT 'TRIMESTRIEL',
    rappel_prix_or BOOLEAN DEFAULT FALSE,
    seuil_changement_prix DECIMAL(5,2) DEFAULT 5.00,
    canal_prefere VARCHAR(20) DEFAULT 'EMAIL',
    actif BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (utilisateur_id) REFERENCES profil_utilisateur(id) ON DELETE CASCADE
);

COMMENT ON TABLE preferences_notification IS 'Préférences notifications par utilisateur';

CREATE INDEX idx_notif_user ON preferences_notification(utilisateur_id);

-- ==========================================
-- TABLE 15: rappels
-- ==========================================
CREATE TABLE rappels (
    id SERIAL PRIMARY KEY,
    utilisateur_id INT NOT NULL,
    zakat_annuel_id INT,
    type_rappel VARCHAR(50) NOT NULL,
    titre VARCHAR(150) NOT NULL,
    message TEXT NOT NULL,
    date_prevu TIMESTAMP NOT NULL,
    date_envoi TIMESTAMP,
    date_lu TIMESTAMP,
    statut VARCHAR(20) DEFAULT 'EN_ATTENTE',
    canal VARCHAR(20),
    priorite VARCHAR(20) DEFAULT 'NORMALE',
    lien_action VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (utilisateur_id) REFERENCES profil_utilisateur(id) ON DELETE CASCADE,
    FOREIGN KEY (zakat_annuel_id) REFERENCES zakat_annuel(id) ON DELETE SET NULL
);

COMMENT ON TABLE rappels IS 'Notifications envoyées aux utilisateurs';

CREATE INDEX idx_rappel_user ON rappels(utilisateur_id, statut);
CREATE INDEX idx_rappel_prevu ON rappels(date_prevu);

-- ==========================================
-- TABLE 16: journal_activite
-- ==========================================
CREATE TABLE journal_activite (
    id SERIAL PRIMARY KEY,
    utilisateur_id INT NOT NULL,
    type_action VARCHAR(50) NOT NULL,
    table_affectee VARCHAR(50),
    id_enregistrement INT,
    details_action JSONB,
    adresse_ip INET,
    user_agent TEXT,
    localisation VARCHAR(100),
    succes BOOLEAN DEFAULT TRUE,
    message_erreur TEXT,
    date_action TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (utilisateur_id) REFERENCES profil_utilisateur(id) ON DELETE CASCADE
);

COMMENT ON TABLE journal_activite IS 'Audit complet actions utilisateurs';

CREATE INDEX idx_journal_user ON journal_activite(utilisateur_id, date_action DESC);
CREATE INDEX idx_journal_type ON journal_activite(type_action);
CREATE INDEX idx_journal_date ON journal_activite(date_action DESC);

-- ==========================================
-- TRIGGERS AUTOMATIQUES
-- ==========================================

-- Trigger: Mise à jour updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_profil_updated BEFORE UPDATE ON profil_utilisateur FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trigger_type_zakat_updated BEFORE UPDATE ON type_zakat FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trigger_nisab_updated BEFORE UPDATE ON nisab_zakat FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trigger_prix_updated BEFORE UPDATE ON prix_metaux_precieux FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trigger_param_updated BEFORE UPDATE ON parametrage FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trigger_actif_updated BEFORE UPDATE ON zakat_actif FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trigger_dettes_updated BEFORE UPDATE ON dettes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trigger_zakat_updated BEFORE UPDATE ON zakat_annuel FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trigger_benef_updated BEFORE UPDATE ON beneficiaire FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trigger_paie_updated BEFORE UPDATE ON paiement_zakat FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trigger_notif_updated BEFORE UPDATE ON preferences_notification FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger: Archiver changements prix
CREATE OR REPLACE FUNCTION archiver_changement_prix()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.prix_gramme IS DISTINCT FROM NEW.prix_gramme THEN
        INSERT INTO historique_prix_metaux (
            prix_metaux_id, type_metal, ancien_prix, nouveau_prix, 
            devise, source_changement
        ) VALUES (
            NEW.id, NEW.type_metal, OLD.prix_gramme, NEW.prix_gramme,
            NEW.devise, 'AUTO'
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_archiver_prix
AFTER UPDATE ON prix_metaux_precieux
FOR EACH ROW
WHEN (OLD.prix_gramme IS DISTINCT FROM NEW.prix_gramme)
EXECUTE FUNCTION archiver_changement_prix();

-- Trigger: Calculer variation prix
CREATE OR REPLACE FUNCTION calculer_variation_prix()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.ancien_prix IS NOT NULL AND NEW.ancien_prix > 0 THEN
        NEW.pourcentage_variation := ((NEW.nouveau_prix - NEW.ancien_prix) / NEW.ancien_prix) * 100;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_calculer_variation
BEFORE INSERT ON historique_prix_metaux
FOR EACH ROW
EXECUTE FUNCTION calculer_variation_prix();

-- Trigger: MAJ montant_restant zakat
CREATE OR REPLACE FUNCTION calculer_montant_restant()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE zakat_annuel 
    SET montant_zakat_paye = (
        SELECT COALESCE(SUM(montant_paye), 0) 
        FROM paiement_zakat 
        WHERE zakat_annuel_id = NEW.zakat_annuel_id 
        AND valide = TRUE
    ),
    montant_restant = montant_zakat_calcule - (
        SELECT COALESCE(SUM(montant_paye), 0) 
        FROM paiement_zakat 
        WHERE zakat_annuel_id = NEW.zakat_annuel_id 
        AND valide = TRUE
    )
    WHERE id = NEW.zakat_annuel_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_calculer_restant
AFTER INSERT OR UPDATE ON paiement_zakat
FOR EACH ROW
EXECUTE FUNCTION calculer_montant_restant();

-- ==========================================
-- FIN DU SCRIPT
-- ==========================================
