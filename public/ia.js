// Lectura de la INE con Gemini mediante Firebase AI Logic (funciona en el plan Spark).
import { getApp } from "https://www.gstatic.com/firebasejs/13.4.0/firebase-app.js";
import { initializeAppCheck, ReCaptchaV3Provider } from "https://www.gstatic.com/firebasejs/13.4.0/firebase-app-check.js";
import { getAI, getGenerativeModel, GoogleAIBackend } from "https://www.gstatic.com/firebasejs/13.4.0/firebase-ai.js";
import { iaConfig } from "./firebase-config.js";

const FIELDS = ["nombre","apellido_paterno","apellido_materno","fecha_nacimiento","sexo","curp","clave_elector","domicilio","colonia","cp","municipio","estado","seccion","vigencia","anio_registro"];

const PROMPT = `Lee esta credencial para votar del INE/IFE (México) y responde SOLO con un objeto JSON, sin texto adicional ni markdown, con estas llaves exactas:
nombre, apellido_paterno, apellido_materno, fecha_nacimiento (AAAA-MM-DD), sexo (H o M), curp, clave_elector, domicilio (calle y número), colonia, cp, municipio, estado, seccion, vigencia, anio_registro.
Si un dato no se ve o no existe, usa una cadena vacía. No inventes datos. Si la imagen no es una credencial del INE, responde {"error":"no_es_ine"}.`;

let model;
function ensure() {
  if (model) return model;
  const app = getApp();
  if (iaConfig.recaptchaSiteKey) {
    initializeAppCheck(app, { provider: new ReCaptchaV3Provider(iaConfig.recaptchaSiteKey), isTokenAutoRefreshEnabled: true });
  }
  const ai = getAI(app, { backend: new GoogleAIBackend() });
  model = getGenerativeModel(ai, { model: iaConfig.model, generationConfig: { responseMimeType: "application/json", temperature: 0 } });
  return model;
}

async function toJpegBase64(file, max = 1600) {
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.85).split(",")[1];
}

function friendly(e) {
  const m = (e && e.message) || "";
  if (/429|quota|RESOURCE_EXHAUSTED|rate/i.test(m)) return "Se alcanzó el límite gratuito de la IA. Espera un minuto e intenta de nuevo.";
  if (/app.?check|403|PERMISSION|API.?key|not enabled|disabled/i.test(m)) return "Firebase bloqueó la solicitud. Revisa en el README la activación de AI Logic y App Check.";
  if (/404|not found|model/i.test(m)) return "El modelo configurado no está disponible. Cambia \"model\" en firebase-config.js.";
  return m || "No se pudo leer la credencial.";
}

// Limpia y valida lo que devuelve la IA; la CURP, si es válida, manda sobre fecha y sexo.
function normalize(d) {
  const o = {};
  for (const f of FIELDS) o[f] = String(d[f] ?? "").trim();
  o.curp = o.curp.toUpperCase().replace(/\s/g, "");
  o.clave_elector = o.clave_elector.toUpperCase().replace(/\s/g, "");
  if (/^[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]\d$/.test(o.curp)) {
    const yy = +o.curp.slice(4, 6), nowY = new Date().getFullYear();
    let century = /[A-Z]/.test(o.curp[16]) ? 2000 : 1900;
    if (century + yy > nowY - 17) century -= 100;
    o.sexo = o.curp[10];
    o.fecha_nacimiento = `${century + yy}-${o.curp.slice(6, 8)}-${o.curp.slice(8, 10)}`;
  }
  return o;
}

export async function scan(file) {
  const m = ensure();
  const data64 = await toJpegBase64(file);
  let text;
  try {
    const r = await m.generateContent([PROMPT, { inlineData: { mimeType: "image/jpeg", data: data64 } }]);
    text = r.response.text();
  } catch (e) { throw new Error(friendly(e)); }
  const j = text.match(/\{[\s\S]*\}/);
  if (!j) throw new Error("La IA no devolvió datos legibles. Intenta con otra foto.");
  let d;
  try { d = JSON.parse(j[0]); } catch { throw new Error("La IA no devolvió datos legibles. Intenta con otra foto."); }
  if (d.error) throw new Error("La foto no parece una INE. Toma otra con buena luz.");
  return { data: normalize(d), raw: text };
}
