import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { resources } from "./resources";

const LANGUAGE_STORAGE_KEY = "beadloom.language";

/** Sync server and client first paint: detection runs only after hydrate in `I18nProvider`. */
export const i18nInitialization = i18n.use(initReactI18next).init({
  resources,
  fallbackLng: "en",
  lng: "en",
  supportedLngs: ["en", "zh"],
  load: "languageOnly",
  nonExplicitSupportedLngs: true,
  interpolation: {
    escapeValue: false
  },
  react: {
    useSuspense: false
  }
});

export { LANGUAGE_STORAGE_KEY };
export default i18n;
