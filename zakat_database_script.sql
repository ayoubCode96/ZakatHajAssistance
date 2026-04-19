create table public.zakat_annuel (
  id serial not null,
  utilisateur_id uuid not null,
  annee_hijri integer not null,
  date_debut date not null,
  date_fin date not null,
  montant_total_actifs numeric(15, 2) null,
  montant_total_dettes numeric(15, 2) null,
  montant_imposable numeric(15, 2) null,
  nisab_applique numeric(15, 2) null,
  type_nisab_applique character varying(20) null,
  depasse_nisab boolean null,
  montant_zakat_calcule numeric(15, 2) null,
  montant_zakat_paye numeric(15, 2) null default 0,
  montant_restant numeric(15, 2) null,
  statut character varying(30) null default 'NON_PAYE'::character varying,
  date_calcul timestamp without time zone null default CURRENT_TIMESTAMP,
  recalcule_auto boolean null default false,
  notes text null,
  created_at timestamp without time zone null default CURRENT_TIMESTAMP,
  updated_at timestamp without time zone null default CURRENT_TIMESTAMP,
  visible boolean null default true,
  raison_masquage text null,
  constraint zakat_annuel_pkey primary key (id),
  constraint zakat_annuel_utilisateur_id_fkey foreign KEY (utilisateur_id) references profils_utilisateurs (id_utilisateur) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_zakat_visible on public.zakat_annuel using btree (utilisateur_id, visible) TABLESPACE pg_default;

create index IF not exists idx_zakat_user_annee on public.zakat_annuel using btree (utilisateur_id, annee_hijri) TABLESPACE pg_default;

create index IF not exists idx_zakat_statut on public.zakat_annuel using btree (statut) TABLESPACE pg_default;

create unique INDEX IF not exists idx_zakat_user_annee_unique on public.zakat_annuel using btree (utilisateur_id, annee_hijri) TABLESPACE pg_default;

create trigger trigger_zakat_updated BEFORE
update on zakat_annuel for EACH row
execute FUNCTION update_updated_at_column ();

create table public.zakat_actif (
  id serial not null,
  utilisateur_id uuid not null,
  type_zakat_id integer not null,
  nom_actif character varying(100) null,
  quantite numeric(15, 4) null,
  valeur_unitaire numeric(15, 2) null,
  valeur_totale numeric(15, 2) null,
  date_acquisition date null,
  date_ajout timestamp without time zone null default CURRENT_TIMESTAMP,
  actif boolean null default true,
  notes text null,
  created_at timestamp without time zone null default CURRENT_TIMESTAMP,
  updated_at timestamp without time zone null default CURRENT_TIMESTAMP,
  zakat_annuel_id integer null,
  constraint zakat_actif_pkey primary key (id),
  constraint zakat_actif_type_zakat_id_fkey foreign KEY (type_zakat_id) references type_zakat (id) on delete RESTRICT,
  constraint zakat_actif_utilisateur_id_fkey foreign KEY (utilisateur_id) references profils_utilisateurs (id_utilisateur) on delete CASCADE,
  constraint zakat_actif_zakat_annuel_id_fkey foreign KEY (zakat_annuel_id) references zakat_annuel (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_actif_user on public.zakat_actif using btree (utilisateur_id, actif) TABLESPACE pg_default;

create index IF not exists idx_actif_type on public.zakat_actif using btree (type_zakat_id) TABLESPACE pg_default;

create index IF not exists idx_actif_year on public.zakat_actif using btree (zakat_annuel_id) TABLESPACE pg_default;

create trigger trigger_actif_updated BEFORE
update on zakat_actif for EACH row
execute FUNCTION update_updated_at_column ();

create table public.type_zakat (
  id serial not null,
  nom_type character varying(50) not null,
  description text null,
  taux_zakat numeric(5, 2) null default 2.50,
  unite_mesure character varying(20) null,
  actif boolean null default true,
  ordre_affichage integer null,
  created_at timestamp without time zone null default CURRENT_TIMESTAMP,
  updated_at timestamp without time zone null default CURRENT_TIMESTAMP,
  constraint type_zakat_pkey primary key (id),
  constraint type_zakat_nom_type_key unique (nom_type)
) TABLESPACE pg_default;

create trigger trigger_type_zakat_updated BEFORE
update on type_zakat for EACH row
execute FUNCTION update_updated_at_column ();

create table public.rituels_hajj (
  id_rituel uuid not null default gen_random_uuid (),
  id_utilisateur uuid not null,
  nom_rituel text not null,
  ordre_rituel integer not null,
  termine boolean null default false,
  date_realisation timestamp with time zone null,
  lieu text null,
  notes text null,
  photos jsonb null,
  date_creation timestamp with time zone null default now(),
  date_mise_a_jour timestamp with time zone null default now(),
  constraint rituels_hajj_pkey primary key (id_rituel),
  constraint rituels_hajj_id_utilisateur_fkey foreign KEY (id_utilisateur) references profils_utilisateurs (id_utilisateur)
) TABLESPACE pg_default;

create index IF not exists idx_rituels_hajj_utilisateur_termine on public.rituels_hajj using btree (id_utilisateur, termine) TABLESPACE pg_default;

create trigger trigger_mise_a_jour_rituels_hajj BEFORE
update on rituels_hajj for EACH row
execute FUNCTION mettre_a_jour_date_modification ();

create table public.profils_utilisateurs (
  id_utilisateur uuid not null,
  nom_complet text null,
  email text null,
  telephone text null,
  langue text null default 'fr'::text,
  theme text null default 'system'::text,
  pays text null,
  ville text null,
  date_creation timestamp with time zone null default now(),
  date_mise_a_jour timestamp with time zone null default now(),
  constraint profils_utilisateurs_pkey primary key (id_utilisateur),
  constraint profils_utilisateurs_email_key unique (email),
  constraint profils_utilisateurs_email_unique unique (email),
  constraint profils_utilisateurs_id_utilisateur_fkey foreign KEY (id_utilisateur) references auth.users (id)
) TABLESPACE pg_default;

create unique INDEX IF not exists profils_utilisateurs_email_idx on public.profils_utilisateurs using btree (email) TABLESPACE pg_default;

create trigger trigger_mise_a_jour_profils BEFORE
update on profils_utilisateurs for EACH row
execute FUNCTION mettre_a_jour_date_modification ();

create trigger trigger_profil_updated BEFORE
update on profils_utilisateurs for EACH row
execute FUNCTION update_updated_at_column ();

create table public.prix_metaux_precieux (
  id serial not null,
  type_metal character varying(20) not null,
  prix_gramme numeric(15, 4) not null,
  devise character varying(10) null default 'MAD'::character varying,
  date_application date not null,
  date_expiration date null,
  source character varying(255) null,
  type_prix character varying(30) null default 'ACHAT'::character varying,
  actif boolean null default true,
  created_at timestamp without time zone null default CURRENT_TIMESTAMP,
  updated_at timestamp without time zone null default CURRENT_TIMESTAMP,
  prix_gramme_24k numeric(15, 4) null,
  prix_gramme_20k numeric(15, 4) null,
  prix_gramme_18k numeric(15, 4) null,
  constraint prix_metaux_precieux_pkey primary key (id)
) TABLESPACE pg_default;

create index IF not exists idx_prix_date on public.prix_metaux_precieux using btree (date_application desc) TABLESPACE pg_default;

create unique INDEX IF not exists idx_prix_actif_unique on public.prix_metaux_precieux using btree (type_metal, devise, actif) TABLESPACE pg_default
where
  (actif = true);

create index IF not exists idx_prix_metal_actif on public.prix_metaux_precieux using btree (type_metal, devise, actif) TABLESPACE pg_default;

create index IF not exists idx_prix_devise on public.prix_metaux_precieux using btree (devise) TABLESPACE pg_default;

create trigger trigger_archiver_prix
after INSERT
or
update on prix_metaux_precieux for EACH row
execute FUNCTION archiver_prix ();

create trigger trigger_prix_updated BEFORE
update on prix_metaux_precieux for EACH row
execute FUNCTION update_updated_at_column ();

create table public.preferences_notification (
  id serial not null,
  utilisateur_id uuid not null,
  rappel_calcul_annuel boolean null default true,
  jours_avant_calcul integer null default 30,
  rappel_paiement boolean null default true,
  frequence_rappel_paiement character varying(20) null default 'MENSUEL'::character varying,
  rappel_maj_actifs boolean null default true,
  frequence_maj_actifs character varying(20) null default 'TRIMESTRIEL'::character varying,
  rappel_prix_or boolean null default false,
  seuil_changement_prix numeric(5, 2) null default 5.00,
  canal_prefere character varying(20) null default 'EMAIL'::character varying,
  actif boolean null default true,
  created_at timestamp without time zone null default CURRENT_TIMESTAMP,
  updated_at timestamp without time zone null default CURRENT_TIMESTAMP,
  constraint preferences_notification_pkey primary key (id),
  constraint preferences_notification_utilisateur_id_key unique (utilisateur_id),
  constraint preferences_notification_utilisateur_id_fkey foreign KEY (utilisateur_id) references profils_utilisateurs (id_utilisateur) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_notif_user on public.preferences_notification using btree (utilisateur_id) TABLESPACE pg_default;

create trigger trigger_notif_updated BEFORE
update on preferences_notification for EACH row
execute FUNCTION update_updated_at_column ();

create table public.password_reset_codes (
  id uuid not null default gen_random_uuid (),
  email text not null,
  code text not null,
  created_at timestamp with time zone null default now(),
  expires_at timestamp with time zone null default (now() + '00:15:00'::interval),
  used boolean null default false,
  constraint password_reset_codes_pkey primary key (id)
) TABLESPACE pg_default;

create index IF not exists idx_reset_email on public.password_reset_codes using btree (email) TABLESPACE pg_default;

create index IF not exists idx_reset_code on public.password_reset_codes using btree (code) TABLESPACE pg_default;

create index IF not exists idx_reset_expires on public.password_reset_codes using btree (expires_at) TABLESPACE pg_default;

create table public.parametrage (
  id serial not null,
  nom_parametre character varying(50) not null,
  valeur character varying(255) not null,
  type_valeur character varying(20) null default 'STRING'::character varying,
  description text null,
  categorie character varying(50) null,
  modifiable_par_user boolean null default false,
  actif boolean null default true,
  created_at timestamp without time zone null default CURRENT_TIMESTAMP,
  updated_at timestamp without time zone null default CURRENT_TIMESTAMP,
  constraint parametrage_pkey primary key (id),
  constraint parametrage_nom_parametre_key unique (nom_parametre)
) TABLESPACE pg_default;

create index IF not exists idx_parametrage_categorie on public.parametrage using btree (categorie) TABLESPACE pg_default;

create trigger trigger_param_updated BEFORE
update on parametrage for EACH row
execute FUNCTION update_updated_at_column ();

create table public.paiement_zakat (
  id serial not null,
  zakat_annuel_id integer not null,
  beneficiaire_id integer not null,
  montant_paye numeric(15, 2) not null,
  date_paiement date not null,
  moyen_paiement character varying(30) null,
  reference_paiement character varying(100) null,
  justificatif character varying(255) null,
  lieu_paiement character varying(150) null,
  temoin_present character varying(150) null,
  notes text null,
  valide boolean null default true,
  date_enregistrement timestamp without time zone null default CURRENT_TIMESTAMP,
  created_at timestamp without time zone null default CURRENT_TIMESTAMP,
  updated_at timestamp without time zone null default CURRENT_TIMESTAMP,
  constraint paiement_zakat_pkey primary key (id),
  constraint paiement_zakat_beneficiaire_id_fkey foreign KEY (beneficiaire_id) references beneficiaire (id) on delete RESTRICT,
  constraint paiement_zakat_zakat_annuel_id_fkey foreign KEY (zakat_annuel_id) references zakat_annuel (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_paiement_zakat on public.paiement_zakat using btree (zakat_annuel_id) TABLESPACE pg_default;

create index IF not exists idx_paiement_beneficiaire on public.paiement_zakat using btree (beneficiaire_id) TABLESPACE pg_default;

create index IF not exists idx_paiement_date on public.paiement_zakat using btree (date_paiement desc) TABLESPACE pg_default;

create trigger trigger_paie_updated BEFORE
update on paiement_zakat for EACH row
execute FUNCTION update_updated_at_column ();

create table public.objectifs_spirituels (
  id_objectif uuid not null default gen_random_uuid (),
  id_utilisateur uuid not null,
  type_objectif text not null,
  valeur_cible integer not null,
  valeur_actuelle integer null default 0,
  periode text not null,
  date_debut timestamp with time zone null default now(),
  date_fin timestamp with time zone null,
  est_termine boolean null default false,
  rappel_active boolean null default true,
  date_creation timestamp with time zone null default now(),
  date_mise_a_jour timestamp with time zone null default now(),
  constraint objectifs_spirituels_pkey primary key (id_objectif),
  constraint objectifs_spirituels_id_utilisateur_fkey foreign KEY (id_utilisateur) references profils_utilisateurs (id_utilisateur)
) TABLESPACE pg_default;

create index IF not exists idx_objectifs_spirituels_utilisateur_type on public.objectifs_spirituels using btree (id_utilisateur, type_objectif) TABLESPACE pg_default;

create trigger trigger_mise_a_jour_objectifs_spirituels BEFORE
update on objectifs_spirituels for EACH row
execute FUNCTION mettre_a_jour_date_modification ();

create table public.notifications (
  id_notification uuid not null default gen_random_uuid (),
  id_utilisateur uuid not null,
  titre text not null,
  message text not null,
  type_notification text not null,
  date_planification timestamp with time zone not null,
  est_envoye boolean null default false,
  est_lu boolean null default false,
  url_action text null,
  metadonnees jsonb null,
  date_creation timestamp with time zone null default now(),
  constraint notifications_pkey primary key (id_notification),
  constraint notifications_id_utilisateur_fkey foreign KEY (id_utilisateur) references profils_utilisateurs (id_utilisateur)
) TABLESPACE pg_default;

create index IF not exists idx_notifications_utilisateur_planifie on public.notifications using btree (id_utilisateur, date_planification) TABLESPACE pg_default;

create table public.nisab_zakat (
  id serial not null,
  type_zakat_id integer not null,
  montant_nisab numeric(15, 4) not null,
  unite character varying(20) not null,
  devise_reference character varying(10) null default 'MAD'::character varying,
  date_debut date not null,
  date_fin date null,
  source_religieuse text null,
  notes text null,
  actif boolean null default true,
  created_at timestamp without time zone null default CURRENT_TIMESTAMP,
  updated_at timestamp without time zone null default CURRENT_TIMESTAMP,
  constraint nisab_zakat_pkey primary key (id),
  constraint nisab_zakat_type_zakat_id_fkey foreign KEY (type_zakat_id) references type_zakat (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_nisab_type on public.nisab_zakat using btree (type_zakat_id) TABLESPACE pg_default;

create index IF not exists idx_nisab_actif on public.nisab_zakat using btree (actif) TABLESPACE pg_default;

create trigger trigger_nisab_updated BEFORE
update on nisab_zakat for EACH row
execute FUNCTION update_updated_at_column ();

create table public.horaires_priere (
  id_horaire uuid not null default gen_random_uuid (),
  id_utilisateur uuid not null,
  date date not null,
  fajr timestamp with time zone null,
  lever_soleil timestamp with time zone null,
  dhuhr timestamp with time zone null,
  asr timestamp with time zone null,
  maghrib timestamp with time zone null,
  isha timestamp with time zone null,
  ville text null,
  pays text null,
  methode_calcul text null,
  date_creation timestamp with time zone null default now(),
  constraint horaires_priere_pkey primary key (id_horaire),
  constraint horaires_priere_id_utilisateur_fkey foreign KEY (id_utilisateur) references profils_utilisateurs (id_utilisateur)
) TABLESPACE pg_default;

create index IF not exists idx_horaires_priere_utilisateur_date on public.horaires_priere using btree (id_utilisateur, date) TABLESPACE pg_default;

create table public.historique_zakat (
  id_paiement uuid not null default gen_random_uuid (),
  id_utilisateur uuid not null,
  montant numeric(15, 2) not null,
  devise text null default 'EUR'::text,
  type_paiement text not null,
  date_paiement timestamp with time zone null default now(),
  type_beneficiaire text null,
  nom_beneficiaire text null,
  details_beneficiaire jsonb null,
  notes text null,
  paiement_recurrent boolean null default false,
  date_prochain_paiement timestamp with time zone null,
  date_creation timestamp with time zone null default now(),
  constraint historique_zakat_pkey primary key (id_paiement),
  constraint historique_zakat_id_utilisateur_fkey foreign KEY (id_utilisateur) references profils_utilisateurs (id_utilisateur)
) TABLESPACE pg_default;

create index IF not exists idx_historique_zakat_utilisateur_date on public.historique_zakat using btree (id_utilisateur, date_paiement) TABLESPACE pg_default;

create table public.historique_prix_metaux (
  id serial not null,
  prix_metaux_id integer null,
  type_metal character varying(20) not null,
  ancien_prix numeric(15, 4) null,
  nouveau_prix numeric(15, 4) not null,
  pourcentage_variation numeric(8, 4) null,
  devise character varying(10) null default 'MAD'::character varying,
  date_changement timestamp without time zone null default CURRENT_TIMESTAMP,
  modifie_par uuid null,
  source_changement character varying(50) null,
  raison text null,
  ancien_prix_24k numeric(15, 4) null,
  nouveau_prix_24k numeric(15, 4) null,
  ancien_prix_20k numeric(15, 4) null,
  nouveau_prix_20k numeric(15, 4) null,
  ancien_prix_18k numeric(15, 4) null,
  nouveau_prix_18k numeric(15, 4) null,
  constraint historique_prix_metaux_pkey primary key (id),
  constraint historique_prix_metaux_modifie_par_fkey foreign KEY (modifie_par) references profils_utilisateurs (id_utilisateur) on delete set null,
  constraint historique_prix_metaux_prix_metaux_id_fkey foreign KEY (prix_metaux_id) references prix_metaux_precieux (id) on delete set null
) TABLESPACE pg_default;

create index IF not exists idx_historique_metal_date on public.historique_prix_metaux using btree (type_metal, date_changement desc) TABLESPACE pg_default;

create trigger trigger_calculer_variation BEFORE INSERT on historique_prix_metaux for EACH row
execute FUNCTION calculer_variation_prix ();

create table public.directions_qibla (
  id_direction uuid not null default gen_random_uuid (),
  id_utilisateur uuid not null,
  latitude numeric(10, 6) not null,
  longitude numeric(10, 6) not null,
  direction_qibla numeric(5, 2) not null,
  ville text null,
  pays text null,
  est_actuelle boolean null default false,
  date_creation timestamp with time zone null default now(),
  constraint directions_qibla_pkey primary key (id_direction),
  constraint directions_qibla_id_utilisateur_fkey foreign KEY (id_utilisateur) references profils_utilisateurs (id_utilisateur)
) TABLESPACE pg_default;

create table public.dettes (
  id serial not null,
  utilisateur_id uuid not null,
  montant_dette numeric(15, 2) not null,
  type_dette character varying(50) null,
  creancier character varying(150) null,
  date_contraction date null,
  date_echeance date null,
  deductible boolean null default true,
  rembourse boolean null default false,
  montant_rembourse numeric(15, 2) null default 0,
  notes text null,
  created_at timestamp without time zone null default CURRENT_TIMESTAMP,
  updated_at timestamp without time zone null default CURRENT_TIMESTAMP,
  constraint dettes_pkey primary key (id),
  constraint dettes_utilisateur_id_fkey foreign KEY (utilisateur_id) references profils_utilisateurs (id_utilisateur) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_dettes_user on public.dettes using btree (utilisateur_id, deductible, rembourse) TABLESPACE pg_default;

create trigger trigger_dettes_updated BEFORE
update on dettes for EACH row
execute FUNCTION update_updated_at_column ();

create table public.checklist_hajj (
  id_element uuid not null default gen_random_uuid (),
  id_utilisateur uuid not null,
  id_item integer not null,
  categorie text not null,
  nom_element text not null,
  description text null,
  termine boolean null default false,
  date_limite timestamp with time zone null,
  est_important boolean null default false,
  ordre_tri integer null default 0,
  date_creation timestamp with time zone null default now(),
  date_mise_a_jour timestamp with time zone null default now(),
  constraint checklist_hajj_pkey primary key (id_element),
  constraint checklist_hajj_id_utilisateur_fkey foreign KEY (id_utilisateur) references profils_utilisateurs (id_utilisateur)
) TABLESPACE pg_default;

create index IF not exists idx_checklist_hajj_utilisateur_categorie on public.checklist_hajj using btree (id_utilisateur, categorie) TABLESPACE pg_default;

create trigger trigger_mise_a_jour_checklist_hajj BEFORE
update on checklist_hajj for EACH row
execute FUNCTION mettre_a_jour_date_modification ();

create table public.categorie_beneficiaire (
  id serial not null,
  nom_categorie character varying(50) not null,
  nom_arabe character varying(100) null,
  nom_francais character varying(100) null,
  description text null,
  verset_reference character varying(100) null,
  ordre_priorite integer null,
  actif boolean null default true,
  created_at timestamp without time zone null default CURRENT_TIMESTAMP,
  constraint categorie_beneficiaire_pkey primary key (id),
  constraint categorie_beneficiaire_nom_categorie_key unique (nom_categorie)
) TABLESPACE pg_default;

create table public.beneficiaire (
  id serial not null,
  categorie_beneficiaire_id integer not null,
  nom character varying(150) not null,
  type_beneficiaire character varying(30) null,
  telephone character varying(20) null,
  email character varying(150) null,
  adresse text null,
  ville character varying(100) null,
  pays character varying(50) null default 'Maroc'::character varying,
  identifiant_fiscal character varying(50) null,
  notes text null,
  verifie boolean null default false,
  actif boolean null default true,
  created_at timestamp without time zone null default CURRENT_TIMESTAMP,
  updated_at timestamp without time zone null default CURRENT_TIMESTAMP,
  constraint beneficiaire_pkey primary key (id),
  constraint beneficiaire_categorie_beneficiaire_id_fkey foreign KEY (categorie_beneficiaire_id) references categorie_beneficiaire (id) on delete RESTRICT
) TABLESPACE pg_default;

create index IF not exists idx_beneficiaire_categorie on public.beneficiaire using btree (categorie_beneficiaire_id, actif) TABLESPACE pg_default;

create index IF not exists idx_beneficiaire_ville on public.beneficiaire using btree (ville) TABLESPACE pg_default;

create trigger trigger_benef_updated BEFORE
update on beneficiaire for EACH row
execute FUNCTION update_updated_at_column ();