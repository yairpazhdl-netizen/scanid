// OCR en el navegador (Tesseract.js) + lectura tolerante de campos del frente de la INE.
const FIELDS = ["nombre","apellido_paterno","apellido_materno","fecha_nacimiento","sexo","curp","clave_elector","domicilio","colonia","cp","municipio","estado","seccion","vigencia","anio_registro"];
const LABELS = /^(DOMICILIO|CLAVE|CURP|SEXO|FECHA|NACIMIENTO|ESTADO|MUNICIPIO|LOCALIDAD|SECCI|EMISI|VIGENCIA|A[ÑN]O|REGISTRO|INSTITUTO|NACIONAL|ELECTORAL|CREDENCIAL|PARA|VOTAR|MEXICO|M[ÉE]XICO)\b/;
const norm = (s) => s.toUpperCase().replace(/[|¡!_]/g, " ").replace(/\s+/g, " ").trim();

// ---------- Corrección de confusiones típicas del OCR (O/0, I/1, S/5, B/8...) ----------
const TO_L = { "0": "O", "1": "I", "2": "Z", "4": "A", "5": "S", "6": "G", "8": "B" };
const TO_D = { O: "0", Q: "0", D: "0", I: "1", L: "1", Z: "2", A: "4", S: "5", G: "6", T: "7", B: "8" };
function fixAt(ch, kind) {
  if (kind === "L") return /[A-Z]/.test(ch) ? ch : TO_L[ch] || ch;
  if (kind === "D") return /\d/.test(ch) ? ch : TO_D[ch] || ch;
  return ch;
}
function findCode(compact, tpl, valid) {
  for (const fix of [false, true]) {
    for (let i = 0; i + tpl.length <= compact.length; i++) {
      let w = "";
      for (let j = 0; j < tpl.length; j++) w += fix ? fixAt(compact[i + j], tpl[j]) : compact[i + j];
      if (valid(w)) return w;
    }
  }
  return "";
}
const CURP_T = "LLLLDDDDDDSLLLLLAD";
const CLAVE_T = "LLLLLLDDDDDDDDSDDD";
const okCurp = (w) => /^[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]\d$/.test(w) && +w.slice(6, 8) >= 1 && +w.slice(6, 8) <= 12 && +w.slice(8, 10) >= 1 && +w.slice(8, 10) <= 31;
const okClave = (w) => /^[A-Z]{6}\d{8}[HM]\d{3}$/.test(w);

export function parseIne(raw) {
  const lines = raw.split(/\r?\n/).map(norm).filter((l) => l.length > 1);
  const all = lines.join(" ");
  const compact = all.replace(/[^A-Z0-9Ñ]/g, "");
  const out = Object.fromEntries(FIELDS.map((f) => [f, ""]));

  let c = findCode(compact, CURP_T, okCurp);
  if (c) {
    const yy = +c.slice(4, 6), nowY = new Date().getFullYear();
    let century = /[A-Z]/.test(c[16]) ? 2000 : 1900;
    if (century + yy > nowY - 17) century -= 100;            // nadie con INE nació hace menos de 17 años
    if (century < 2000 && !/\d/.test(c[16])) c = c.slice(0, 16) + (TO_D[c[16]] || c[16]) + c[17];
    out.curp = c;
    out.sexo = c[10];
    out.fecha_nacimiento = `${century + yy}-${c.slice(6, 8)}-${c.slice(8, 10)}`;
  }
  out.clave_elector = findCode(compact, CLAVE_T, okClave);

  // Nombre: tras la etiqueta NOMBRE vienen paterno, materno y nombre(s)
  const iN = lines.findIndex((l) => /^N[O0]MBR/.test(l));
  if (iN >= 0) {
    const names = [];
    for (const l of lines.slice(iN + 1)) {
      if (/^D[O0]MIC/.test(l)) break;
      const t = l.replace(/[0-9]/g, (d) => TO_L[d] || d);
      if ((l.match(/\d/g) || []).length <= 2 && /^[A-ZÑ ]{2,}$/.test(t) && !LABELS.test(t)) names.push(t);
      if (names.length === 3) break;
    }
    [out.apellido_paterno = "", out.apellido_materno = "", out.nombre = ""] = names;
  }

  // Domicilio: calle y número / colonia y CP / municipio, estado
  const iD = lines.findIndex((l) => /^D[O0]MIC/.test(l));
  if (iD >= 0) {
    let end = lines.findIndex((l, i) => i > iD && /^(CLAV|CURP)/.test(l));
    if (end < 0) end = iD + 4;
    const [l1 = "", l2 = "", l3 = ""] = lines.slice(iD + 1, end).slice(0, 3);
    out.domicilio = l1;
    const cp = l2.match(/\b\d{5}\b/);
    if (cp) out.cp = cp[0];
    out.colonia = l2.replace(/\b\d{5}\b/, "").replace(/^COL\.?\s+/, "").trim();
    const [mun = "", est = ""] = l3.split(",").map((s) => s.trim());
    out.municipio = mun;
    out.estado = est.replace(/\.$/, "");
  }

  const num = (m) => (m ? m[1].replace(/[OQDISB]/g, (ch) => TO_D[ch] || ch) : "");
  out.seccion = num(all.match(/SEC\w{0,4}\s*([0-9OIS]{4})\b/));
  out.vigencia = num(all.match(/V[I1L]G\w{0,6}\s*([0-9OIS]{4})\b/));
  out.anio_registro = num(all.match(/REGIS\w{0,5}\s*([0-9OIS]{4})\b/));
  return out;
}

// ---------- Preparación de imagen ----------
async function grayData(file, long = 2400) {
  const bmp = await createImageBitmap(file);
  const k = long / Math.max(bmp.width, bmp.height);
  const w = Math.round(bmp.width * k), h = Math.round(bmp.height * k);
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  const x = c.getContext("2d", { willReadFrequently: true });
  x.imageSmoothingQuality = "high";
  x.drawImage(bmp, 0, 0, w, h);
  const p = x.getImageData(0, 0, w, h).data;
  const g = new Uint8ClampedArray(w * h), hist = new Uint32Array(256);
  for (let i = 0, j = 0; i < p.length; i += 4, j++) { const v = (0.299 * p[i] + 0.587 * p[i + 1] + 0.114 * p[i + 2]) | 0; g[j] = v; hist[v]++; }
  const n = g.length; let lo = 0, hi = 255, acc = 0;
  for (let v = 0; v < 256; v++) { acc += hist[v]; if (acc >= n * 0.02) { lo = v; break; } }
  acc = 0;
  for (let v = 255; v >= 0; v--) { acc += hist[v]; if (acc >= n * 0.02) { hi = v; break; } }
  const span = Math.max(1, hi - lo);
  for (let j = 0; j < n; j++) g[j] = ((g[j] - lo) * 255) / span;   // estira contraste
  return { g, w, h };
}

function bradley({ g, w, h }) {   // umbral adaptativo: aguanta reflejos y fondos con diseño
  const hs = Math.max(8, w >> 5), t = 0.12, W = w + 1;
  const I = new Uint32Array(W * (h + 1));
  for (let y = 0; y < h; y++) { let row = 0; for (let x = 0; x < w; x++) { row += g[y * w + x]; I[(y + 1) * W + x + 1] = I[y * W + x + 1] + row; } }
  const out = new Uint8ClampedArray(w * h);
  for (let y = 0; y < h; y++) {
    const y1 = Math.max(0, y - hs), y2 = Math.min(h - 1, y + hs);
    for (let x = 0; x < w; x++) {
      const x1 = Math.max(0, x - hs), x2 = Math.min(w - 1, x + hs);
      const cnt = (x2 - x1 + 1) * (y2 - y1 + 1);
      const sum = I[(y2 + 1) * W + x2 + 1] - I[y1 * W + x2 + 1] - I[(y2 + 1) * W + x1] + I[y1 * W + x1];
      out[y * w + x] = g[y * w + x] * cnt < sum * (1 - t) ? 0 : 255;
    }
  }
  return { g: out, w, h };
}

function toCanvas({ g, w, h }) {
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  const x = c.getContext("2d"), im = x.createImageData(w, h);
  for (let i = 0, j = 0; i < g.length; i++, j += 4) { im.data[j] = im.data[j + 1] = im.data[j + 2] = g[i]; im.data[j + 3] = 255; }
  x.putImageData(im, 0, 0);
  return c;
}

// ---------- OCR ----------
let worker, progressCb;
const merge = (a, b) => { const o = { ...(a || b) }; for (const f of FIELDS) if (!o[f] && b[f]) o[f] = b[f]; return o; };
const count = (d) => FIELDS.filter((f) => d[f]).length;

export async function scan(file, onProgress) {
  if (!window.Tesseract) throw new Error("No se pudo cargar el lector de texto. Revisa tu conexión e intenta de nuevo.");
  const gray = await grayData(file);
  const passes = [
    { make: () => toCanvas(bradley(gray)), psm: "11" },   // texto disperso sobre imagen binarizada
    { make: () => toCanvas(gray), psm: "6" },              // bloque uniforme sobre escala de grises
  ];
  if (!worker) {
    worker = await Tesseract.createWorker("spa", 1, {
      logger: (m) => { if (m.status === "recognizing text" && progressCb) progressCb(Math.round(m.progress * 100)); },
    });
  }
  let merged = null; const raws = [];
  for (let i = 0; i < passes.length; i++) {
    progressCb = (p) => onProgress && onProgress(i + 1, passes.length, p);
    await worker.setParameters({ tessedit_pageseg_mode: passes[i].psm });
    const { data } = await worker.recognize(passes[i].make());
    raws.push(data.text);
    merged = merge(merged, parseIne(data.text));
    if (count(merged) >= 10) break;
  }
  return { data: merged, raw: raws.join("\n------\n") };
}
