# Escáner de INE (PWA + Firebase Spark + Gemini)

Foto de la INE → Gemini (Firebase AI Logic) lee los datos → revisas y corriges → se guarda en Firestore.
Funciona con el plan **Spark** (gratis, con los límites del nivel gratuito). La foto no se guarda; solo los campos de texto.

## Configuración en Firebase (una vez)
1. Crea el proyecto (plan Spark). Registra una app Web y pega su config en `public/firebase-config.js`.
2. **Authentication**: activa Correo/contraseña. **Firestore**: crea la base en modo producción y publica `firestore.rules` en la pestaña Reglas.
3. **AI Logic**: consola > AI Services > AI Logic > Comenzar > elige **Gemini Developer API** y completa el asistente.
4. **App Check**: el asistente de AI Logic lo exige. Consola > App Check > Apps > registra tu app web con **reCAPTCHA v3**:
   - Crea una clave en https://www.google.com/recaptcha/admin (tipo v3) con tu dominio (`TU_USUARIO.github.io`).
   - Pega la clave secreta en App Check y la **clave de sitio** en `iaConfig.recaptchaSiteKey` de `public/firebase-config.js`.
5. **Authentication > Configuración > Dominios autorizados**: agrega `TU_USUARIO.github.io`.

## Publicar con GitHub Pages
Sube el proyecto a GitHub y activa Pages desde la carpeta `/public`. Las reglas de Firestore no se suben con Git (pégalas en la consola o usa `firebase deploy --only firestore`).

## Notas
- Modelo: `iaConfig.model` (por defecto `gemini-3.8-flash`). Los modelos se renuevan seguido; si da error de modelo no disponible, usa el Flash estable que indique la página de modelos de Firebase AI Logic.
- Si aparece "límite gratuito", espera un minuto: el nivel gratuito tiene tope de solicitudes.
- Revisa siempre los datos antes de guardar. La CURP se valida por formato y de ella salen fecha de nacimiento y sexo.
- La INE es dato personal sensible: pide consentimiento, limita quién tiene cuenta y revisa los términos de datos del nivel gratuito de Gemini.
- Cada usuario solo ve sus registros (`firestore.rules`).
