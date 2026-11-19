// Pega aquí la configuración de tu app web (Firebase Console > Configuración del proyecto > Tus apps).
export const firebaseConfig = {
  apiKey: "TU_API_KEY",
  authDomain: "TU_PROYECTO.firebaseapp.com",
  projectId: "TU_PROYECTO",
  storageBucket: "TU_PROYECTO.appspot.com",
  messagingSenderId: "000000000000",
  appId: "1:000000000000:web:0000000000000000"
};

// Configuración de la IA (Firebase AI Logic con la Gemini Developer API).
export const iaConfig = {
  // Los nombres de modelo cambian seguido: si aparece "modelo no disponible", usa el Flash estable
  // que indique https://firebase.google.com/docs/ai-logic/models
  model: "gemini-3.8-flash",
  // Clave de sitio reCAPTCHA v3 que registraste en App Check (ver README).
  recaptchaSiteKey: ""
};
