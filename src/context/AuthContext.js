import React, { createContext, useContext, useState, useEffect, useRef } from "react";
import { authService, userService, supabase } from "../services/supabase";
import AsyncStorage from "@react-native-async-storage/async-storage";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(false);
  const isSigningOut = useRef(false);
  const authListener = useRef(null);

  useEffect(() => {
    const setupAuth = async () => {
      console.log("Setting up auth...");
      
      // Configuration initiale
      const { data } = supabase.auth.onAuthStateChange(async (event, session) => {
        console.log("Auth event:", event);
        
        // Ignorer les événements pendant la déconnexion
        if (isSigningOut.current && event !== "SIGNED_OUT") {
          console.log("Ignoring event during sign out:", event);
          return;
        }
        
        handleAuthEvent(event, session);
      });
      
      authListener.current = data.subscription;
      
      // Initialisation après un délai pour éviter les conflits
      setTimeout(async () => {
        await initializeAuth();
      }, 100);
    };

    setupAuth();

    return () => {
      console.log("Cleaning up auth listener...");
      if (authListener.current) {
        authListener.current.unsubscribe();
      }
    };
  }, []);

  const handleAuthEvent = async (event, session) => {
    console.log("Handling auth event:", event);
    
    switch (event) {
      case "SIGNED_IN":
        console.log("User signed in:", session.user.email);
        await fetchUserProfile(session.user);
        break;
        
      case "SIGNED_OUT":
        console.log("User signed out - clearing state");
        setUser(null);
        setProfile(null);
        isSigningOut.current = false;
        break;
        
      case "INITIAL_SESSION":
      case "TOKEN_REFRESHED":
        console.log(event, "- session present:", !!session?.user);
        if (session?.user && !isSigningOut.current) {
          await fetchUserProfile(session.user);
        } else if (!session && !isSigningOut.current) {
          setUser(null);
          setProfile(null);
        }
        break;
        
      default:
        console.log("Unhandled auth event:", event);
    }
  };

  const initializeAuth = async () => {
    if (isSigningOut.current) {
      console.log("Skipping init during sign out");
      return;
    }
    
    try {
      setLoading(true);
      console.log("Initializing auth...");

      // Essayer d'abord de récupérer l'utilisateur actuel
      const userResult = await authService.getCurrentUser();
      
      if (userResult.success && userResult.user) {
        console.log("Current user found:", userResult.user.email);
        await fetchUserProfile(userResult.user);
      } else {
        console.log("No user found, clearing state");
        setUser(null);
        setProfile(null);
      }
    } catch (error) {
      console.error("Auth init error:", error);
      setUser(null);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  };

  const fetchUserProfile = async (userData) => {
    if (isSigningOut.current) {
      console.log("Skipping profile fetch during sign out");
      return;
    }
    
    try {
      const userInfo = {
        id: userData.id,
        email: userData.email,
        name: userData.user_metadata?.full_name || userData.email?.split("@")[0] || "Utilisateur",
      };

      setUser(userInfo);

      const profileResult = await userService.getProfile(userData.id);
      if (profileResult.success && profileResult.profile) {
 

        setProfile(profileResult.profile);
        setUser(prev => ({
          ...prev,
          name: profileResult.profile.nom_complet || prev.name,
        }));
      } else {
        const createResult = await userService.createProfile(userData.id, userData);
        if (createResult.success) {
          setProfile(createResult.profile);
        }
      }

      await userService.updateUserLocation(userData.id);
    } catch (error) {
      console.error("Erreur lors du chargement du profil:", error);
    }
  };

  const signOut = async () => {
    try {
      console.log("Starting sign out process...");
      isSigningOut.current = true; // Désactiver les mises à jour automatiques
      setLoading(true);
      
      // 1. Nettoyer l'état local IMMÉDIATEMENT
      setUser(null);
      setProfile(null);
      
      // 2. Se déconnecter de Supabase
      console.log("Calling supabase.auth.signOut()");
      const result = await authService.signOut();
      console.log("Supabase sign out result:", result);
      
      // 3. Forcer la suppression du stockage local
      await cleanupLocalStorage();
      
      console.log("Sign out completed successfully");
      return { success: true };
    } catch (error) {
      console.error("Sign out error:", error);
      // Même en cas d'erreur, nettoyer l'état local
      setUser(null);
      setProfile(null);
      await cleanupLocalStorage();
      return { success: true }; // Toujours retourner success pour l'UI
    } finally {
      setLoading(false);
      // Réinitialiser le flag après un délai
      setTimeout(() => {
        isSigningOut.current = false;
      }, 1000);
    }
  };

  // Fonction de nettoyage agressive
  const cleanupLocalStorage = async () => {
    try {
      console.log("Cleaning up local storage...");
      
      // Supprimer toutes les clés liées à l'auth
      const keys = await AsyncStorage.getAllKeys();
      const authKeys = keys.filter(key => 
        key.includes('supabase') || 
        key.includes('auth') || 
        key.includes('token')
      );
      
      if (authKeys.length > 0) {
        await AsyncStorage.multiRemove(authKeys);
        console.log("Removed auth keys:", authKeys);
      }
      
      // Forcer une nouvelle session vide
      await supabase.auth.getSession();
      
    } catch (error) {
      console.error("Error cleaning localStorage:", error);
    }
  };

  // ... (le reste de votre code reste inchangé)
  const signIn = async (email, password) => {
    try {
      setLoading(true);
      const result = await authService.signIn(email, password);

      if (result.success) {
        await userService.createProfile(result.user.id, result.user);
        await fetchUserProfile(result.user);
        return { success: true };
      } else {
        return { success: false, error: result.error };
      }
    } catch (error) {
      return { success: false, error: "Erreur de connexion" };
    } finally {
      setLoading(false);
    }
  };

  const signUp = async (email, password, fullName) => {
    try {
      setLoading(true);
        
         const data = await supabase
        .from('profils_utilisateurs')
        .select('id, user_id, nom_complet')
        .eq('email', email)
        .maybeSingle();
        console.log("data",data);
        
        if (data.data) {
          console.warn("Conflit de profil détecté pour l'email:", email);
          await signOut();
          return { success: false, error: "ce compte email est déjà associé à un autre profil. Veuillez contacter le support." };
        }
      const result = await authService.signUp(email, password, fullName);

      if (result.success && result.user) {
        await userService.createProfile(result.user.id, result.user);
        await fetchUserProfile(result.user);
        return { success: true };
      } else {
        return { success: false, error: result.error };
      }
    
    } catch (error) {
      return { success: false, error: "Erreur lors de l'inscription" };
    } finally {
      setLoading(false);
    }
  };

  const signInWithGoogle = async () => {
    try {
      setLoading(true);
      const { success, session } = await authService.signInWithGoogle();

      if (success && session?.user) {
        await fetchUserProfile(session.user);
        return { success: true };
      }
      return { success: false, error: "Erreur Google" };
    } catch (error) {
      console.error("Google sign in error:", error);
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  };

  const signInWithFacebook = async () => {
    try {
      setLoading(true);
      const { success, session } = await authService.signInWithFacebook();

      if (success && session?.user) {
        await fetchUserProfile(session.user);
        return { success: true };
      }
      return { success: false, error: "Erreur Facebook" };
    } catch (error) {
      console.error("Facebook sign in error:", error);
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  };

  const value = {
    user,
    profile,
    loading,
    signIn,
    signUp,
    signInWithGoogle,
    signInWithFacebook,
    signOut,
    refreshUser: () => initializeAuth(),
    isAuthenticated: !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};