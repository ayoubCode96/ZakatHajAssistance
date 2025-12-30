import React, { createContext, useState, useContext, useEffect } from "react";
import { currencyService } from "../services/currencyService";
import { locationService } from "../services/locationService";
import AsyncStorage from "@react-native-async-storage/async-storage";

const CurrencyContext = createContext();

export const CurrencyProvider = ({ children }) => {
  const [userCurrency, setUserCurrency] = useState("EUR");
  const [userCountry, setUserCountry] = useState(null);
  const [metalsPrices, setMetalsPrices] = useState(null);
  const [exchangeRates, setExchangeRates] = useState(null);
  const [loading, setLoading] = useState(true);

  // Initialiser la localisation et la devise au démarrage
  useEffect(() => {
    initializeCurrency();
  }, []);

  // Recharger les prix des métaux quand la devise change
  useEffect(() => {
    if (userCurrency) {
      loadMetalsPrices(userCurrency);
    }
  }, [userCurrency]);

  const initializeCurrency = async () => {
    try {
      setLoading(true);

      // 1. Essayer de charger la devise sauvegardée
      const savedCurrency = await AsyncStorage.getItem("userCurrency");
      const savedCountry = await AsyncStorage.getItem("userCountry");

      if (savedCurrency && savedCountry) {
        setUserCurrency(savedCurrency);
        setUserCountry(JSON.parse(savedCountry));
        await loadMetalsPrices(savedCurrency);
        setLoading(false);
        return;
      }

      // 2. Sinon, détecter la localisation
      const locationResult = await locationService.getCurrentLocation();

      if (locationResult.success) {
        const { latitude, longitude } = locationResult.location;

        // Obtenir le pays depuis les coordonnées
        const countryResult = await locationService.getCountryFromCoords(
          latitude,
          longitude
        );

        if (countryResult.success) {
          const countryCode = countryResult.countryCode;
          const countryName = locationService.getCountryName(countryCode);

          // Obtenir la devise du pays
          const currencyResult =
            locationService.getCurrencyByCountry(countryCode);
          const currency = currencyResult.currency;

          const countryInfo = {
            code: countryCode,
            name: countryName,
            city: countryResult.city,
            region: countryResult.region,
          };

          // Sauvegarder
          await AsyncStorage.setItem("userCurrency", currency);
          await AsyncStorage.setItem(
            "userCountry",
            JSON.stringify(countryInfo)
          );

          setUserCurrency(currency);
          setUserCountry(countryInfo);

          // Charger les prix des métaux dans cette devise
          await loadMetalsPrices(currency);
        }
      } else {
        // Par défaut si la localisation échoue
        setUserCurrency("EUR");
        await loadMetalsPrices("EUR");
      }
    } catch (error) {
      console.error("Erreur initialisation devise:", error);
      setUserCurrency("EUR");
      await loadMetalsPrices("EUR");
    } finally {
      setLoading(false);
    }
  };

  const loadMetalsPrices = async (currency) => {
    try {
      // Charger les prix des métaux DANS LA DEVISE LOCALE
      const metalsPricesResult = await currencyService.getMetalsPrices(
        currency
      );

      if (metalsPricesResult.success) {
        setMetalsPrices({
          gold: metalsPricesResult.gold,
          silver: metalsPricesResult.silver,
          currency: metalsPricesResult.currency,
          lastUpdated: metalsPricesResult.lastUpdated,
        });
      }

      // Charger les taux de change (pour référence si nécessaire)
      const ratesResult = await currencyService.getExchangeRates("EUR");
      if (ratesResult.success) {
        setExchangeRates(ratesResult.rates);
      }
    } catch (error) {
      console.error("Erreur chargement prix métaux:", error);
    }
  };

  const refreshData = async () => {
    await loadMetalsPrices(userCurrency);
  };

  const changeCurrency = async (newCurrency) => {
    try {
      await AsyncStorage.setItem("userCurrency", newCurrency);
      setUserCurrency(newCurrency);
      // Les prix des métaux seront rechargés automatiquement via useEffect
    } catch (error) {
      console.error("Erreur changement devise:", error);
    }
  };

  // Formater un montant dans la devise actuelle
  const formatCurrency = (amount) => {
    return currencyService.formatCurrency(amount, userCurrency);
  };

  const value = {
    userCurrency,
    userCountry,
    metalsPrices,
    exchangeRates,
    loading,
    refreshData,
    changeCurrency,
    formatCurrency,
  };

  return (
    <CurrencyContext.Provider value={value}>
      {children}
    </CurrencyContext.Provider>
  );
};

export const useCurrency = () => {
  const context = useContext(CurrencyContext);
  if (!context) {
    throw new Error("useCurrency doit être utilisé dans un CurrencyProvider");
  }
  return context;
};
