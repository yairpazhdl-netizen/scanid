// OCR en el navegador (Tesseract.js) + lectura de campos del frente de la INE.
const FIELDS = ["nombre","apellido_paterno","apellido_materno","fecha_nacimiento","sexo","curp","clave_elector","domicilio","colonia","cp","municipio","estado","seccion","vigencia","anio_registro"];
const LABELS = /^(DOMICILIO|CLAVE|CURP|SEXO|FECHA|NACIMIENTO|ESTADO|MUNICIPIO|LOCALIDAD|SECCI|EMISI|VIGENCIA|A[ÑN]O|REGISTRO|INSTITUTO|NACIONAL|ELECTORAL|CREDENCIAL|PARA|VOTAR|MEXICO|M[ÉE]XICO)\b/;

const norm = (s) => s.toUpperCase().replace(/[|¡!_]/g, " ").replace(/\s+/g, " ").trim();

export function parseIne(raw) {
  const lines = raw.split(/\r?\n/).map(norm).filter((l) => l.length > 1);
  const all = lines.join(" ");
  const compact = all.replace(/[^A-Z0-9Ñ]/g, "");
  const out = Object.fromEntries(FIELDS.map((f) => [f, ""]));

  // CURP y datos que se derivan de ella
  const curp = compact.match(/[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]\d/);
  if (curp) {
    const c = curp[0];
    out.curp = c;
    out.sexo = c[10];
    const century = /[A-Z]/.test(c[16]) ? "20" : "19";
    out.fecha_nacimiento = `${century}${c.slice(4, 6)}-${c.slice(6, 8)}-${c.slice(8, 10)}`;
  }

  const clave = compact.match(/[A-Z]{6}\d{8}[HM]\d{3}/);
  if (clave) out.clave_elector = clave[0];

  // Nombre: tras la etiqueta NOMBRE vienen paterno, materno y nombre(s)
  const iN = lines.findIndex((l) => /^NOMBRE\b/.test(l));
  if (iN >= 0) {
    const names = [];
    for (const l of lines.slice(iN + 1)) {
      if (/^DOMICILIO/.test(l)) break;
      if (/^[A-ZÑ ]{2,}$/.test(l) && !LABELS.test(l)) names.push(l);
      if (names.length === 3) break;
    }
    [out.apellido_paterno = "", out.apellido_materno = "", out.nombre = ""] = names;
  }

  // Domicilio: calle y número / colonia y CP / municipio, estado
  const iD = lines.findIndex((l) => /^DOMICILIO/.test(l));
  if (iD >= 0) {
    let end = lines.findIndex((l, i) => i > iD && /^(CLAVE|CURP)/.test(l));
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

  const sec = all.match(/SECCI[OÓ0]N\s*(\d{4})/); if (sec) out.seccion = sec[1];
  const vig = all.match(/VIGENCIA\s*(\d{4})/); if (vig) out.vigencia = vig[1];
  const reg = all.match(/REGISTRO\s*(\d{4})/); if (reg) out.anio_registro = reg[1];
  return out;
}

let worker, progressCb;
export async function readIne(canvas, onProgress) {
  if (!window.Tesseract) throw new Error("No se pudo cargar el lector de texto. Revisa tu conexión e intenta de nuevo.");
  progressCb = onProgress;
  if (!worker) {
    worker = await Tesseract.createWorker("spa", 1, {
      logger: (m) => { if (m.status === "recognizing text" && progressCb) progressCb(Math.round(m.progress * 100)); },
    });
  }
  const { data } = await worker.recognize(canvas);
  return parseIne(data.text);
}
