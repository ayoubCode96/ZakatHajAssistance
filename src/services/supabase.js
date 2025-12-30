import { createClient } from "@supabase/supabase-js";
import "react-native-url-polyfill/auto";
import * as WebBrowser from "expo-web-browser";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { locationService } from "./locationService";

const supabaseUrl = "https://nfddhkvvwslmzzuqkaqg.supabase.co";
const supabaseAnonKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5mZGRoa3Z2d3NsbXp6dXFrYXFnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIyOTE1MjksImV4cCI6MjA3Nzg2NzUyOX0.e64LdMEVHzlKPTORZdSdn4zta7MUctJ0ja7A5UTU9qs";
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: Platform.OS === "web", 
  },});

// Fonction simple pour obtenir la bonne URL
const getRedirectUrl = () => {
  if (Platform.OS === 'web') {
    // Toujours utiliser localhost pour web, même en mode LAN
    return window.location.origin ;
  }
  return "exp://hjvahgg-ayoubel-8081.exp.direct/";
};

console.log("aa",getRedirectUrl());

export const authService = {
  // Connexion email/mot de passe
  async signIn(email, password) {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;
      return { success: true, user: data.user, session: data.session };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // Inscription email/mot de passe
  async signUp(email, password, fullName) {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          },
          emailRedirectTo: getRedirectUrl(), // IMPORTANT: pour les liens de confirmation email
        },
      });

      if (error) throw error;
      return { success: true, user: data.user };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // Connexion OAuth (Google/Gmail) - CORRIGÉ
   async signInWithGoogle() {
    try {
      const redirectUrl = getRedirectUrl();
      
      // Configuration différente selon la plateforme
      const options = {
        provider: "google",
        options: {
          redirectTo: redirectUrl,
          queryParams: {
            access_type: "offline",
            prompt: "select_account",
          },
        },
      };

      // Pour le web, laisser Supabase gérer la redirection automatiquement
      if (Platform.OS === 'web') {
        options.options.skipBrowserRedirect = false;
      } else {
        // Pour mobile, utiliser WebBrowser
        options.options.skipBrowserRedirect = true;
      }

      const { data, error } = await supabase.auth.signInWithOAuth(options);

      if (error) throw error;
      
      // Pour mobile seulement: gérer l'ouverture du navigateur
      if (Platform.OS !== 'web' && data?.url) {
        const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);
        
        console.log("OAuth result:", result);
        
        if (result.type === "success") {
          // Extraire les tokens de l'URL
          const url = new URL(result.url);
          const params = new URLSearchParams(url.hash.substring(1));
          const access_token = params.get('access_token');
          const refresh_token = params.get('refresh_token');
          
          if (access_token) {
            const { data: sessionData, error: sessionError } = 
              await supabase.auth.setSession({
                access_token,
                refresh_token,
              });
            
            if (sessionError) throw sessionError;
            
            return { success: true, session: sessionData.session };
          }
        } else if (result.type === "dismiss") {
          return { success: false, error: "Authentification annulée" };
        }
      }
      
      // Pour le web, la redirection est automatique
      return { success: true };
    } catch (error) {
      console.error("Google OAuth error:", error);
      return { success: false, error: error.message };
    }
  },
  // Connexion OAuth (Facebook)
  async signInWithFacebook() {
    try {
      const redirectUrl = getRedirectUrl();
      
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "facebook",
        options: {
          redirectTo: redirectUrl,
        },
      });

      if (error) throw error;
      
      // Ouvre le navigateur seulement pour OAuth, pas pour email
      if (data?.url && Platform.OS !== 'web') {
        await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);
      }
      
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // Déconnexion
  async signOut() {
    console.log("Starting signOut...");
    
    try {
      // 1. Appeler signOut de Supabase
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        console.error("Supabase signOut error:", error);
        throw error;
      }
      
      console.log("Supabase signOut successful");
      
      // 2. Nettoyer AsyncStorage manuellement
      try {
        const keys = await AsyncStorage.getAllKeys();
        const authKeys = keys.filter(key => 
          key.includes('supabase') || 
          key.includes('sb-') || 
          key.includes('auth') ||
          key.includes('token')
        );
        
        console.log("Found auth keys to remove:", authKeys);
        
        if (authKeys.length > 0) {
          await AsyncStorage.multiRemove(authKeys);
          console.log("AsyncStorage cleaned");
        }
      } catch (storageError) {
        console.warn("Could not clean AsyncStorage:", storageError);
      }
      
      // 3. Forcer une réinitialisation
      // Cette ligne est importante pour vider le cache interne de Supabase
      await supabase.auth.getSession();
      
      console.log("Sign out completed");
      return { success: true };
    } catch (error) {
      console.error("Sign out process error:", error);
      
      // Même en cas d'erreur, tenter de nettoyer
      try {
        await AsyncStorage.multiRemove([
          'supabase.auth.token',
          'sb-access-token',
          'sb-refresh-token'
        ]);
      } catch {}
      
      return { success: false, error: error.message };
    }
  },

  // Récupérer la session actuelle
  async getSession() {
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;
      return { success: true, session: data.session };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // Récupérer l'utilisateur actuel
  async getCurrentUser() {
    try {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();
      if (error) throw error;
      return { success: true, user };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // Réinitialiser le mot de passe
  async resetPassword(email) {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: getRedirectUrl(),
      });

      if (error) throw error;
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },
};

export const userService = {
  // Créer un profil utilisateur
  async createProfile(userId, userData) {
    try {
      const locationResult = await locationService.getCurrentLocation();
  
  let pays = "";
  let ville = "";

  if (locationResult.success) {
    const { latitude, longitude } = locationResult.location;
    
    // Obtenir les informations de géocodage
    const geocodeResult = await locationService.getCountryFromCoords(
      latitude, 
      longitude
    );
    
    if (geocodeResult.success) {
      pays = geocodeResult.country || "";
      ville = geocodeResult.city || "";
    }
  }
      const { data, error } = await supabase
        .from("profils_utilisateurs")
        .insert([
          {
            id_utilisateur: userId,
            nom_complet:
              userData.user_metadata?.full_name ||
              userData.email?.split("@")[0],
            email: userData.email,
            langue: "fr",
            theme: "system",
            date_creation: new Date(),
            date_mise_a_jour: new Date(),
            pays: pays ? pays : null,
            ville: ville ? ville : null,
          },
        ])
        .select()
        .single();

      if (error) throw error;
      return { success: true, profile: data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // Récupérer le profil utilisateur
  async getProfile(userId) {
    try {
      const { data, error } = await supabase
        .from("profils_utilisateurs")
        .select("*")
        .eq("id_utilisateur", userId)
        .single();

      if (error) throw error;
      return { success: true, profile: data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // Mettre à jour le profil utilisateur
  async updateProfile(userId, updates) {
    try {
      const { data, error } = await supabase
        .from("profils_utilisateurs")
        .update({
          ...updates,
          date_mise_a_jour: new Date(),
        })
        .eq("id_utilisateur", userId)
        .select()
        .single();

      if (error) throw error;
      return { success: true, profile: data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },
  updateUserLocation: async (userId) => {
  try {
    // Récupérer la localisation
    const locationResult = await locationService.getCurrentLocation();
    
    if (!locationResult.success) return;

    const { latitude, longitude } = locationResult.location;
    const geocodeResult = await locationService.getCountryFromCoords(latitude, longitude);
    
    if (!geocodeResult.success) return;

    // Mettre à jour ONLY le pays et la ville
    const { error } = await supabase
      .from('profils_utilisateurs')
      .update({
        pays: geocodeResult.country || '',
        ville: geocodeResult.city || '',
        date_mise_a_jour: new Date()
      })
      .eq('id_utilisateur', userId);

    if (error) {
      console.warn('Erreur mise à jour localisation:', error);
    }

  } catch (error) {
    console.warn('Localisation échouée:', error.message);
  }
},
};