import type { Language } from "@/lib/LanguageContext";

export const translations: Record<Language, Record<string, string>> = {
  es: {
    liga: "Liga",
    miRendimiento: "Mi Rendimiento",
    predecir: "Predecir",
    supervivencia: "Supervivencia",
    pase: "Pase",
    reglamento: "Reglamento",
    salir: "Salir",
    login: "Log in",
    registrarse: "Registrarse",
  },
  en: {
    liga: "League",
    miRendimiento: "My Performance",
    predecir: "Predict",
    supervivencia: "Survival",
    pase: "Pass",
    reglamento: "Rules",
    salir: "Log out",
    login: "Log in",
    registrarse: "Sign up",
  },
};
