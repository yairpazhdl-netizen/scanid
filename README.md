# Escáner de INE (PWA + Firebase Spark)

Foto de la INE → OCR en el celular (Tesseract.js) → revisas y corriges → se guarda en Firestore.
Funciona con el plan **Spark** (gratis): no usa Cloud Functions ni APIs de pago.
La foto NO sale del celular ni se guarda; solo se guardan los campos de texto.

## Puesta en marcha
1. Crea un proyecto en https://console.firebase.google.com (plan Spark).
2. Activa **Authentication** (Correo/contraseña) y **Firestore Database**.
3. Configuración del proyecto > Tus apps > Web: copia la config y pégala en `public/firebase-config.js`.
4. En una terminal, dentro de esta carpeta:
   ```
   npm i -g firebase-tools
   firebase login
   firebase use --add
   firebase deploy --only hosting,firestore
   ```
5. Abre la URL en el celular y usa "Agregar a pantalla de inicio".

## Notas
- La primera lectura descarga el motor de OCR y el idioma español (varios MB); después queda en caché.
- Para mejores resultados: credencial plana, buena luz, sin reflejos, encuadrada y de frente.
- Siempre revisa los datos antes de guardar: el OCR puede confundir letras y números.
- La CURP se valida por formato y de ella se derivan fecha de nacimiento y sexo.
- Cada usuario solo ve sus registros (`firestore.rules`).
- La INE es dato personal sensible: pide consentimiento y limita quién tiene cuenta.
