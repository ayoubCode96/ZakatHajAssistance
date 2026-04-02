import { supabase } from "./supabase";

export const resetPasswordService = {
  // Étape 1: Générer et envoyer le code
  async sendResetCode(email) {
    try {
    //   console.log("📧 Envoi du code à:", email.toLowerCase().trim());

    //   // Vérifier que l'email existe en DB en cherchant un profil utilisateur
    //   const { data: userExists, error: checkError } = await supabase
    //     .from("profils_utilisateurs")
    //     .select("id_utilisateur")
    //     .eq("email", email.toLowerCase().trim())
    //     .limit(1);
    //     console.log("data",data);
        
    //   if ( userExists.length === 0) {
    //     console.log("❌ Email non trouvé dans les profils");
    //     return {
    //       success: false,
    //       error: "Cet email n'est pas enregistré dans notre système"
    //     };
    //   }

    //   console.log("✅ Email trouvé dans le système");

      // Nettoyer les anciens codes expirés
      await supabase
        .from("password_reset_codes")
        .delete()
        .lt("expires_at", new Date().toISOString());

      // Générer un code aléatoire 6 chiffres
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      console.log("🔢 Code généré:", code);

      // Insérer le code dans la base de données (array format)
      const { data, error: insertError } = await supabase
        .from("password_reset_codes")
        .insert([
          {
            email: email.toLowerCase().trim(),
            code,
            used: false,
          }
        ])
        .select();

      if (insertError) {
        console.error("❌ Erreur insertion code:", insertError);
        console.error("Détails complets:", JSON.stringify(insertError, null, 2));
        console.error("Code à insérer:", { email: email.toLowerCase().trim(), code });
        return { 
          success: false, 
          error: "Erreur lors de la création du code: " + insertError.message
        };
      }

      console.log("✅ Code stocké en base, ID:", data?.[0]?.id);
      console.log("📊 Données insérées:", JSON.stringify(data, null, 2));

      // Tenter d'envoyer l'email via la fonction Edge
      try {
        const { data: edgeData, error: edgeError } = await supabase.functions.invoke('send-reset-code', {
          body: { 
            email: email.toLowerCase().trim(),
            code: code
          }
        });

        if (edgeError) {
          console.log("⚠️ Fonction Edge non disponible, code seulement:", code);
        } else {
          console.log("✅ Email envoyé via fonction Edge");
        }
      } catch (edgeError) {
        console.log("⚠️ Fonction Edge erreur, continuation avec code:", code);
      }

      return { 
        success: true, 
        message: "Code généré avec succès",
        debug_code: code // À utiliser pour le développement
      };

    } catch (error) {
      console.error("💥 Erreur sendResetCode:", error);
      return { 
        success: false, 
        error: "Erreur lors de la génération du code" 
      };
    }
  },

  // Étape 2: Vérifier le code
  async verifyCode(email, code) {
    try {
      console.log("🔍 Vérification du code pour:", email, code);

      // Nettoyer les codes expirés
      console.log("🧹 Suppression des codes expirés...");
      const { error: deleteError } = await supabase
        .from("password_reset_codes")
        .delete()
        .lt("expires_at", new Date().toISOString());

      if (deleteError) console.warn("⚠️ Erreur suppression codes expirés:", deleteError);

      // Vérifier le code
      console.log("🔎 Recherche du code en base...");
      const { data, error } = await supabase
        .from("password_reset_codes")
        .select("*")
        .eq("email", email.toLowerCase().trim())
        .eq("code", code.toString())
        .eq("used", false)
        .gt("expires_at", new Date().toISOString())
        .limit(1);

      console.log("📊 Résultat DB:", { data, error });

      if (error) {
        console.error("❌ Erreur requête:", error.message);
        return { 
          success: false, 
          error: error.message 
        };
      }

      if (!data || data.length === 0) {
        console.error("❌ Aucun code trouvé");
        return { 
          success: false, 
          error: "Code incorrect ou expiré" 
        };
      }

      const foundCode = data[0];
      console.log("✅ Code vérifié avec succès");
      return { 
        success: true, 
        data: { 
          email: foundCode.email,
          id: foundCode.id 
        } 
      };

    } catch (error) {
      console.error("💥 Erreur verifyCode:", error);
      return { 
        success: false, 
        error: error.message 
      };
    }
  },

  // Étape 3: Réinitialiser le mot de passe
  async resetPassword(email, newPassword, code) {
    try {
      console.log("🔄 Réinitialisation pour:", email);

      // Validation du mot de passe
      if (!newPassword || newPassword.length < 6) {
        return { 
          success: false, 
          error: "Le mot de passe doit contenir au moins 6 caractères" 
        };
      }

      // Appeler la fonction Edge qui va gérer la réinitialisation côté serveur
      console.log("📡 Appel de la fonction Edge reset-password...");
      const { data, error: functionError } = await supabase.functions.invoke(
        "reset-password",
        {
          body: {
            email: email.toLowerCase().trim(),
            newPassword,
            code: code.toString(),
          },
        }
      );

      if (functionError) {
        console.error("❌ Erreur fonction Edge:", functionError);
        throw new Error(functionError.message || "Erreur lors de la réinitialisation");
      }

      console.log("✅ Mot de passe réinitialisé via fonction Edge");
      return {
        success: true,
        message: "Mot de passe réinitialisé avec succès",
      };

    } catch (error) {
      console.error("💥 Erreur resetPassword:", error);
      return { 
        success: false, 
        error: error.message || "Erreur lors de la réinitialisation" 
      };
    }
  },

  // Vérifier si un code valide existe
  async hasValidCode(email) {
    try {
      const { data } = await supabase
        .from("password_reset_codes")
        .select("id")
        .eq("email", email.toLowerCase().trim())
        .eq("used", false)
        .gt("expires_at", new Date().toISOString())
        .limit(1);

      return !!data && data.length > 0;
    } catch (error) {
      return false;
    }
  }
};