import * as Location from "expo-location";

export const locationService = {
  // Obtenir la position actuelle de l'utilisateur
  async getCurrentLocation() {
    try {
      // Demander les permissions
      let { status } = await Location.requestForegroundPermissionsAsync();

      if (status !== "granted") {
        throw new Error("Permission de localisation refusée");
      }

      // Obtenir la position
      let location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      return {
        success: true,
        location: {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  },

  // Obtenir le pays à partir des coordonnées (géocodage inverse)
  async getCountryFromCoords(latitude, longitude) {
    try {
      let geocode = await Location.reverseGeocodeAsync({
        latitude,
        longitude,
      });

      if (geocode.length > 0) {
        const locationInfo = geocode[0];
        return {
          success: true,
          country: locationInfo.country,
          countryCode: locationInfo.isoCountryCode,
          city: locationInfo.city,
          region: locationInfo.region,
          postalCode: locationInfo.postalCode,
          fullAddress: `${locationInfo.city}, ${locationInfo.region}, ${locationInfo.country}`,
        };
      } else {
        throw new Error("Impossible de déterminer le pays");
      }
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  },

  // Obtenir la devise par défaut d'un pays
  getCurrencyByCountry(countryCode) {
    const countryCurrencies = {
      US: "USD", // États-Unis
      FR: "EUR", // France
      DE: "EUR", // Allemagne
      GB: "GBP", // Royaume-Uni
      CA: "CAD", // Canada
      MA: "MAD", // Maroc
      DZ: "DZD", // Algérie
      TN: "TND", // Tunisie
      SA: "SAR", // Arabie Saoudite
      AE: "AED", // Émirats Arabes Unis
      QA: "QAR", // Qatar
      KW: "KWD", // Koweït
      BH: "BHD", // Bahreïn
      OM: "OMR", // Oman
      TR: "TRY", // Turquie
      EG: "EGP", // Égypte
      JO: "JOD", // Jordanie
      LB: "LBP", // Liban
      SY: "SYP", // Syrie
      IQ: "IQD", // Irak
      IR: "IRR", // Iran
    };

    const currency = countryCurrencies[countryCode] || "EUR";

    return {
      success: true,
      currency,
      countryCode,
    };
  },

  // Obtenir le nom du pays en français
  getCountryName(countryCode) {
    const countryNames = {
      US: "États-Unis",
      FR: "France",
      DE: "Allemagne",
      GB: "Royaume-Uni",
      CA: "Canada",
      MA: "Maroc",
      DZ: "Algérie",
      TN: "Tunisie",
      SA: "Arabie Saoudite",
      AE: "Émirats Arabes Unis",
      QA: "Qatar",
      KW: "Koweït",
      BH: "Bahreïn",
      OM: "Oman",
      TR: "Turquie",
      EG: "Égypte",
      JO: "Jordanie",
      LB: "Liban",
      SY: "Syrie",
      IQ: "Irak",
      IR: "Iran",
    };

    return countryNames[countryCode] || countryCode;
  },
};
