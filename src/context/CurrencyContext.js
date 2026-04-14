// src/context/CurrencyContext.js
import React, { createContext, useState, useContext, useEffect } from "react";
import { currencyService } from "../services/currencyService";
import { locationService } from "../services/locationService";
import AsyncStorage from "@react-native-async-storage/async-storage";

const CurrencyContext = createContext();

export const CurrencyProvider = ({ children }) => {
  const [userCurrency, setUserCurrency] = useState("MAD");
  const [userCountry, setUserCountry] = useState(null);
  const [metalsPrices, setMetalsPrices] = useState(null);
  const [exchangeRates, setExchangeRates] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    initializeCurrency();
  }, []);

  useEffect(() => {
    if (userCurrency) {
      loadMetalsPrices(userCurrency);
    }
  }, [userCurrency]);

  const initializeCurrency = async () => {
    try {
      setLoading(true);

      const savedCurrency = await AsyncStorage.getItem("userCurrency");
      const savedCountry  = await AsyncStorage.getItem("userCountry");

      if (savedCurrency && savedCountry) {
        setUserCurrency(savedCurrency);
        setUserCountry(JSON.parse(savedCountry));
        await loadMetalsPrices(savedCurrency);
        setLoading(false);
        return;
      }

      const locationResult = await locationService.getCurrentLocation();

      if (locationResult.success) {
        const { latitude, longitude } = locationResult.location;
        const countryResult = await locationService.getCountryFromCoords(latitude, longitude);

        if (countryResult.success) {
          const countryCode  = countryResult.countryCode;
          const countryName  = locationService.getCountryName(countryCode);
          const currencyResult = locationService.getCurrencyByCountry(countryCode);
          const currency     = currencyResult.currency;

          const countryInfo = {
            code:   countryCode,
            name:   countryName,
            city:   countryResult.city,
            region: countryResult.region,
          };

          await AsyncStorage.setItem("userCurrency", currency);
          await AsyncStorage.setItem("userCountry",  JSON.stringify(countryInfo));

          setUserCurrency(currency);
          setUserCountry(countryInfo);
          await loadMetalsPrices(currency);
        }
      } else {
        setUserCurrency("MAD");
        await loadMetalsPrices("MAD");
      }
    } catch (error) {
      console.error("Erreur initialisation devise:", error);
      setUserCurrency("MAD");
      await loadMetalsPrices("MAD");
    } finally {
      setLoading(false);
    }
  };

  const loadMetalsPrices = async (currency) => {
    try {
      const result = await currencyService.getMetalsPrices(currency);

      if (result.success) {
        setMetalsPrices({
          gold:        result.gold,
          gold24k:     result.gold24k,
          gold20k:     result.gold20k,
          gold18k:     result.gold18k,
          silver:      result.silver,
          currency:    result.currency,
          lastUpdated: result.lastUpdated,
          isFallback:  result.isFallback || false,
        });
      }

      const ratesResult = await currencyService.getExchangeRates?.("EUR");
      if (ratesResult?.success) {
        setExchangeRates(ratesResult.rates);
      }
    } catch (error) {
      console.error("Erreur chargement prix métaux:", error);
    }
  };

  const refreshData = async () => {
    currencyService.clearCache(userCurrency);
    await loadMetalsPrices(userCurrency);
  };

  const changeCurrency = async (newCurrency) => {
    try {
      await AsyncStorage.setItem("userCurrency", newCurrency);
      setUserCurrency(newCurrency);
    } catch (error) {
      console.error("Erreur changement devise:", error);
    }
  };

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