// services/hawlService.js
// ═══════════════════════════════════════════════════════════════════
// Hawl Malékite — UN seul hawl GLOBAL sur le patrimoine
// ─────────────────────────────────────────────────────
// Règles (skill §4.3) :
//   1. Calcul en JOURS HIJRI réels (Intl.DateTimeFormat islamic)
//   2. Zakat = min(montant_debut_hawl, montant_fin) × 2.5%
//   3. Nisab perdu en cours de hawl → hawl INTERROMPU
//   4. Paiement complet → nouveau hawl démarre immédiatement
//   5. Hawl EN_COURS complété → statut COMPLETE
//   6. date_debut du hawl = source de vérité pour date_fin
//
// CORRECTIONS APPLIQUÉES :
//   - loadHawlStatusForUser : retourne not_started si hawl INTERROMPU
//     plus récent que COMPLETE, ou si zakat PAYE ou EXEMPTE
//   - montantDebut TOUJOURS retourné dans loadHawlStatusForUser
// ═══════════════════════════════════════════════════════════════════

import { supabase } from "./supabase";
import nisabService, { HAWL_DAYS_MALIKI } from "./nisabService";
import {
  hijriDaysBetween,
  computeDateEcheanceGreg,
  getCurrentHijriYear,
} from "../utils/zakatUtils";

const hawlService = {
  HAWL_DAYS: HAWL_DAYS_MALIKI,

  // ══════════════════════════════════════════════════════════════════
  // CALCUL STATUT HAWL — jours HIJRI réels (fonction pure)
  // ══════════════════════════════════════════════════════════════════
  computeHawlStatus(dateDebut) {
    if (!dateDebut) {
      return {
        complete: false,
        joursEcoules: 0,
        joursRestants: HAWL_DAYS_MALIKI,
        progressPercent: 0,
        dateEcheance: null,
      };
    }
    const joursHijriEcoules = hijriDaysBetween(dateDebut, new Date());
    const joursRestants = Math.max(0, HAWL_DAYS_MALIKI - joursHijriEcoules);
    const progressPercent = Math.min(
      100,
      Math.round((joursHijriEcoules / HAWL_DAYS_MALIKI) * 1000) / 10,
    );
    const dateEcheance = computeDateEcheanceGreg(dateDebut);
    return {
      complete: joursHijriEcoules >= HAWL_DAYS_MALIKI,
      joursEcoules: joursHijriEcoules,
      joursRestants,
      progressPercent,
      dateEcheance,
    };
  },

  // ══════════════════════════════════════════════════════════════════
  // CHARGEMENT ACTIFS
  // ══════════════════════════════════════════════════════════════════
  async loadActifs(userId, zakatAnnuelId = null) {
    try {
      let query = supabase
        .from("zakat_actif")
        .select(
          `
          id, nom_actif, quantite, valeur_totale, valeur_unitaire,
          type_zakat_id, actif, zakat_annuel_id,
          created_at, updated_at,
          type_zakat(id, nom_type, taux_zakat, unite_mesure)
        `,
        )
        .eq("utilisateur_id", userId)
        .eq("actif", true)
        .order("created_at", { ascending: false });
      if (zakatAnnuelId) query = query.eq("zakat_annuel_id", zakatAnnuelId);
      const { data, error } = await query;
      if (error) throw error;
      return { success: true, data: data || [] };
    } catch (error) {
      console.error("[hawlService] loadActifs:", error);
      return { success: false, data: [], error: error.message };
    }
  },

  async loadActifsWithHawl(userId, zakatAnnuelId = null) {
    return this.loadActifs(userId, zakatAnnuelId);
  },

  enrichActifsWithHawl(actifs) {
    return actifs || [];
  },

  // ══════════════════════════════════════════════════════════════════
  // RÉCUPÉRER LE HAWL ACTIF (EN_COURS)
  // ══════════════════════════════════════════════════════════════════
  async getActiveHawlGlobal(userId) {
    try {
      const { data, error } = await supabase
        .from("hawl_tracking")
        .select("*")
        .eq("utilisateur_id", userId)
        .eq("statut", "EN_COURS")
        .order("date_debut", { ascending: false })
        .limit(1)
        .single();
      if (error && error.code !== "PGRST116") throw error;
      return { success: true, data: data || null };
    } catch (error) {
      return { success: false, data: null, error: error.message };
    }
  },

  // ══════════════════════════════════════════════════════════════════
  // LOAD HAWL STATUS — pour affichage dans les écrans
  // ══════════════════════════════════════════════════════════════════
  // Logique corrigée (skill §7 + bugs connus §10) :
  //
  //   1. Hawl EN_COURS ?
  //      → Calculer jours hijri écoulés → retourner in_progress ou completed
  //      → Auto-compléter si ≥ 354j
  //
  //   2. Hawl COMPLETE le plus récent ?
  //      a. Y a-t-il un hawl INTERROMPU plus récent ? → not_started
  //      b. Zakat la plus récente (hors REMPLACE) :
  //         - PAYE     → not_started (cycle terminé, nouveau hawl démarrera)
  //         - EXEMPTE  → not_started (nisab non atteint)
  //         - NON_PAYE | EN_COURS_HAWL → completed (zakat réellement due)
  //         - aucune   → not_started
  //
  //   3. Aucun hawl → not_started
  //
  // ⚠️ montantDebut TOUJOURS retourné (utilisé par calculateMalikiZakat)
  // ══════════════════════════════════════════════════════════════════
  async loadHawlStatusForUser(userId) {
    const NOT_STARTED = {
      completed: false,
      daysRemaining: 354,
      daysElapsed: 0,
      progressPercent: 0,
      nextAnniversary: null,
      dateDebut: null,
      montantDebut: 0,
      message: "not_started",
    };

    try {
      // ─── 1. Hawl EN_COURS ? ────────────────────────────────────────
      const { data: hawlEnCours } = await supabase
        .from("hawl_tracking")
        .select("date_debut, date_echeance, statut, nisab_base, montant_debut")
        .eq("utilisateur_id", userId)
        .eq("statut", "EN_COURS")
        .order("date_debut", { ascending: false })
        .limit(1)
        .single();

      if (hawlEnCours?.date_debut) {
        const status = this.computeHawlStatus(hawlEnCours.date_debut);

        // ✅ Auto-compléter si 354j hijri dépassés
        if (status.complete) {
          await supabase
            .from("hawl_tracking")
            .update({
              statut: "COMPLETE",
              date_realisation: new Date().toISOString().split("T")[0],
            })
            .eq("utilisateur_id", userId)
            .eq("statut", "EN_COURS");

          await supabase
            .from("profils_utilisateurs")
            .update({
              hawl_actif: false,
            })
            .eq("id_utilisateur", userId);
        }

        return {
          completed: status.complete,
          daysRemaining: status.joursRestants,
          daysElapsed: status.joursEcoules,
          progressPercent: status.progressPercent,
          nextAnniversary: status.dateEcheance?.toISOString() ?? null,
          dateDebut: hawlEnCours.date_debut,
          montantDebut: parseFloat(hawlEnCours.montant_debut || 0),
          message: status.complete ? "completed" : "in_progress",
        };
      }

      // ─── 2. Hawl COMPLETE récent ? ─────────────────────────────────
      const { data: hawlComplete } = await supabase
        .from("hawl_tracking")
        .select(
          "id, statut, date_realisation, date_debut, montant_debut, montant_fin, created_at",
        )
        .eq("utilisateur_id", userId)
        .eq("statut", "COMPLETE")
        .order("date_realisation", { ascending: false })
        .limit(1)
        .single();

      if (hawlComplete) {
        // ✅ FIX A : Y a-t-il un hawl INTERROMPU plus récent ?
        const dateRef =
          hawlComplete.date_realisation || hawlComplete.date_debut;
        const { data: hawlInterrompuRecent } = await supabase
          .from("hawl_tracking")
          .select("id, statut, date_debut")
          .eq("utilisateur_id", userId)
          .eq("statut", "INTERROMPU")
          .gt("date_debut", dateRef)
          .order("date_debut", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (hawlInterrompuRecent) {
          return NOT_STARTED;
        }

        // ✅ FIX B : Vérifier la zakat la plus récente (toutes années)
        const { data: zakatRecente } = await supabase
          .from("zakat_annuel")
          .select("statut, annee_hijri")
          .eq("utilisateur_id", userId)
          .neq("statut", "REMPLACE")
          .order("annee_hijri", { ascending: false })
          .limit(1)
          .maybeSingle();

        // PAYE → cycle terminé → not_started
        if (zakatRecente?.statut === "PAYE") return NOT_STARTED;

        // EXEMPTE → nisab non atteint actuellement → not_started
        if (zakatRecente?.statut === "EXEMPTE") return NOT_STARTED;

        // NON_PAYE ou EN_COURS_HAWL → hawl complété, zakat réellement due
        if (
          zakatRecente?.statut === "NON_PAYE" ||
          zakatRecente?.statut === "EN_COURS_HAWL"
        ) {
          return {
            completed: true,
            daysRemaining: 0,
            daysElapsed: 354,
            progressPercent: 100,
            nextAnniversary: null,
            dateDebut: null,
            montantDebut: parseFloat(hawlComplete.montant_debut || 0),
            message: "completed",
          };
        }

        // Aucune zakat trouvée → not_started
        return NOT_STARTED;
      }

      // ─── 3. Aucun hawl ─────────────────────────────────────────────
      return NOT_STARTED;
    } catch {
      return NOT_STARTED;
    }
  },

  // ══════════════════════════════════════════════════════════════════
  // CHECK AND UPDATE HAWL GLOBAL
  // ──────────────────────────────────────────────────────────────────
  // Cas A : montantImposable ≤ 0 → skip
  // Cas B : Nisab perdu + hawl actif → INTERROMPU
  // Cas C : Nisab non atteint + pas de hawl → nisab_not_reached
  // Cas D : Nisab atteint + pas de hawl → hawl_started
  // Cas E : Nisab atteint + hawl < 354j hijri → hawl_in_progress
  // Cas F : Nisab atteint + hawl ≥ 354j hijri → hawl_completed
  //         → zakat = min(montant_debut, montant_fin) × 2.5%
  // ══════════════════════════════════════════════════════════════════
  async checkAndUpdateHawlGlobal(
    userId,
    montantImposable,
    baseChoisie = "or_24k",
    devise = "MAD",
  ) {
    try {
      if (!montantImposable || montantImposable <= 0 || !userId) {
        return { action: "skipped_invalid_amount", hawlStatus: null };
      }

      const nisabInfo = await nisabService.computeNisabThreshold(
        baseChoisie,
        devise,
      );
      if (!nisabInfo.success) throw new Error(nisabInfo.error);

      const nisabCheck = nisabService.checkNisab(
        montantImposable,
        nisabInfo.threshold,
      );
      const { data: hawl } = await this.getActiveHawlGlobal(userId);

      // ── CAS B : Nisab perdu + hawl actif → INTERROMPRE ──────────────
      if (!nisabCheck.depasse && hawl) {
        const joursHijri = hijriDaysBetween(hawl.date_debut, new Date());
        if (joursHijri > 0) {
          await supabase
            .from("hawl_tracking")
            .update({
              statut: "INTERROMPU",
              interrompu_le: new Date().toISOString().split("T")[0],
              montant_fin: montantImposable,
            })
            .eq("id", hawl.id);

          await supabase
            .from("profils_utilisateurs")
            .update({
              hawl_actif: false,
              date_anniversaire_zakat: null,
            })
            .eq("id_utilisateur", userId);

          return {
            action: "hawl_interrupted",
            nisabInfo,
            nisabCheck,
            hawlStatus: null,
            data: hawl,
          };
        } else {
          const hawlStatus = this.computeHawlStatus(hawl.date_debut);
          return {
            action: "hawl_in_progress",
            nisabInfo,
            nisabCheck,
            hawlStatus,
            data: hawl,
          };
        }
      }

      // ── CAS C : Nisab non atteint, pas de hawl ──────────────────────
      if (!nisabCheck.depasse && !hawl) {
        return {
          action: "nisab_not_reached",
          nisabInfo,
          nisabCheck,
          hawlStatus: null,
          data: null,
        };
      }

      // ── CAS D : Nisab atteint, pas de hawl → DÉMARRER ───────────────
      if (nisabCheck.depasse && !hawl) {
        // Éviter doublon si hawl COMPLETE le même jour
        const todayStr = new Date().toISOString().split("T")[0];
        const { data: hawlCompleteAujourdhui } = await supabase
          .from("hawl_tracking")
          .select("id, date_realisation, montant_debut, montant_fin")
          .eq("utilisateur_id", userId)
          .eq("statut", "COMPLETE")
          .eq("date_realisation", todayStr)
          .limit(1)
          .single();

        if (hawlCompleteAujourdhui) {
          const montantDebut = parseFloat(
            hawlCompleteAujourdhui.montant_debut || 0,
          );
          const montantFin = parseFloat(
            hawlCompleteAujourdhui.montant_fin || montantImposable,
          );
          const montantPourZakat =
            montantDebut > 0 ? Math.min(montantDebut, montantFin) : montantFin;
          const hawlStatus = {
            complete: true,
            joursEcoules: 354,
            joursRestants: 0,
            progressPercent: 100,
            dateEcheance: null,
          };
          return {
            action: "hawl_completed_zakat_due",
            nisabInfo,
            nisabCheck,
            hawlStatus,
            data: hawlCompleteAujourdhui,
            montantPourZakat,
            montantDebut,
            montantFin,
          };
        }

        const newHawl = await this._startHawlGlobal(
          userId,
          montantImposable,
          nisabInfo.threshold,
          baseChoisie,
        );
        const hawlStatus = this.computeHawlStatus(newHawl.date_debut);
        return {
          action: "hawl_started",
          nisabInfo,
          nisabCheck,
          hawlStatus,
          data: newHawl,
        };
      }

      // ── CAS E & F : Nisab atteint + hawl actif ──────────────────────
      const hawlStatus = this.computeHawlStatus(hawl.date_debut);

      if (hawlStatus.complete) {
        // ✅ RÈGLE MALÉKITE : zakat = min(debut, fin) × 2.5%
        const montantDebut = parseFloat(hawl.montant_debut || 0);
        const montantFin = montantImposable;
        const montantPourZakat =
          montantDebut > 0 ? Math.min(montantDebut, montantFin) : montantFin;

        await supabase
          .from("hawl_tracking")
          .update({
            statut: "COMPLETE",
            date_realisation: new Date().toISOString().split("T")[0],
            montant_fin: montantFin,
          })
          .eq("id", hawl.id);

        await supabase
          .from("profils_utilisateurs")
          .update({
            hawl_actif: false,
          })
          .eq("id_utilisateur", userId);

        return {
          action: "hawl_completed_zakat_due",
          nisabInfo,
          nisabCheck,
          hawlStatus,
          data: hawl,
          montantPourZakat,
          montantDebut,
          montantFin,
        };
      }

      return {
        action: "hawl_in_progress",
        nisabInfo,
        nisabCheck,
        hawlStatus,
        data: hawl,
      };
    } catch (error) {
      console.error("[hawlService] checkAndUpdateHawlGlobal:", error);
      return { action: "error", error: error.message };
    }
  },

  // ══════════════════════════════════════════════════════════════════
  // DÉMARRER UN NOUVEAU HAWL GLOBAL
  // montant_debut = patrimoine net → stocké pour min(debut, fin)
  // ══════════════════════════════════════════════════════════════════
  async _startHawlGlobal(
    userId,
    montantActifsNets,
    nisabThreshold,
    baseChoisie,
  ) {
    const today = new Date();
    const dateDebut = today.toISOString().split("T")[0];
    const dateEcheance = computeDateEcheanceGreg(today)
      .toISOString()
      .split("T")[0];

    const { data, error } = await supabase
      .from("hawl_tracking")
      .insert({
        utilisateur_id: userId,
        date_debut: dateDebut,
        date_echeance: dateEcheance,
        montant_debut: montantActifsNets,
        nisab_base: baseChoisie,
        nisab_valeur: nisabThreshold,
        statut: "EN_COURS",
      })
      .select()
      .single();

    if (error) throw error;

    await supabase
      .from("profils_utilisateurs")
      .update({
        date_anniversaire_zakat: dateDebut,
        hawl_actif: true,
        nisab_base: baseChoisie,
      })
      .eq("id_utilisateur", userId);

    return data;
  },

  // ══════════════════════════════════════════════════════════════════
  // INTERROMPRE LE HAWL — appelé quand nisab perdu
  // ══════════════════════════════════════════════════════════════════
  async interruptHawlIfActive(userId, montantActuel = 0) {
    try {
      const { data: hawl, error } = await supabase
        .from("hawl_tracking")
        .select("id, date_debut")
        .eq("utilisateur_id", userId)
        .eq("statut", "EN_COURS")
        .order("date_debut", { ascending: false })
        .limit(1)
        .single();

      if (error || !hawl) return { interrupted: false };

      const joursHijri = hijriDaysBetween(hawl.date_debut, new Date());

      await supabase
        .from("hawl_tracking")
        .update({
          statut: "INTERROMPU",
          interrompu_le: new Date().toISOString().split("T")[0],
          montant_fin: montantActuel,
        })
        .eq("id", hawl.id);

      await supabase
        .from("profils_utilisateurs")
        .update({
          hawl_actif: false,
          date_anniversaire_zakat: null,
        })
        .eq("id_utilisateur", userId);

      console.log(
        `[hawlService] Hawl interrompu après ${joursHijri}j hijri (nisab perdu)`,
      );
      return { interrupted: true, joursHijri };
    } catch (err) {
      console.error("[hawlService] interruptHawlIfActive:", err);
      return { interrupted: false, error: err.message };
    }
  },

  // ══════════════════════════════════════════════════════════════════
  // DÉMARRER UN NOUVEAU HAWL APRÈS PAIEMENT COMPLET
  // Appelé depuis ZakatMainScreen.handlePayZakat quand statut → PAYE
  // ══════════════════════════════════════════════════════════════════
  async startNewHawlAfterPayment(
    userId,
    montantActuel,
    nisabThreshold,
    baseChoisie,
  ) {
    try {
      if (!montantActuel || montantActuel <= 0) {
        console.log(
          "[hawlService] Patrimoine nul après paiement → pas de nouveau hawl",
        );
        return { started: false, reason: "zero_patrimoine" };
      }
      if (montantActuel < nisabThreshold) {
        console.log(
          "[hawlService] Nisab non atteint après paiement → hawl en attente",
        );
        return { started: false, reason: "nisab_not_reached" };
      }

      // Clôturer tout hawl EN_COURS résiduel
      await supabase
        .from("hawl_tracking")
        .update({
          statut: "COMPLETE",
          date_realisation: new Date().toISOString().split("T")[0],
        })
        .eq("utilisateur_id", userId)
        .eq("statut", "EN_COURS");

      const newHawl = await this._startHawlGlobal(
        userId,
        montantActuel,
        nisabThreshold,
        baseChoisie,
      );
      console.log(
        `[hawlService] Nouveau hawl démarré après paiement. montant_debut=${montantActuel}`,
      );
      return { started: true, data: newHawl };
    } catch (err) {
      console.error("[hawlService] startNewHawlAfterPayment:", err);
      return { started: false, error: err.message };
    }
  },

  // ══════════════════════════════════════════════════════════════════
  // HISTORIQUE HAWL
  // ══════════════════════════════════════════════════════════════════
  async getHawlHistory(userId) {
    try {
      const { data, error } = await supabase
        .from("hawl_tracking")
        .select("*")
        .eq("utilisateur_id", userId)
        .order("date_debut", { ascending: false });
      if (error) throw error;
      return { success: true, data: data || [] };
    } catch (error) {
      return { success: false, data: [], error: error.message };
    }
  },

  computeHawlStats(actifs) {
    return {
      total: (actifs || []).length,
      complets: 0,
      enCours: 0,
      valeurAvecHawl: (actifs || []).reduce(
        (s, a) => s + (a.valeur_totale || 0),
        0,
      ),
      valeurSansHawl: 0,
      prochainHawl: null,
    };
  },
};

export default hawlService;
