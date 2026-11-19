import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, collection, addDoc, query, where, onSnapshot, deleteDoc, doc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { scan } from "./ocr.js";
import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const $ = (id) => document.getElementById(id);
const FIELDS = ["nombre","apellido_paterno","apellido_materno","fecha_nacimiento","sexo","curp","clave_elector","domicilio","colonia","cp","municipio","estado","seccion","vigencia","anio_registro"];
let records = [], unsub = null;

function show(name) { for (const s of ["auth","home","review"]) $(s).classList.toggle("hidden", s !== name); say(""); }
function say(text, type = "") { const m = $("msg"); m.textContent = text; m.className = type; }
function busy(btn, on, label) { btn.disabled = on; if (label) btn.dataset.l = btn.dataset.l || btn.textContent, btn.textContent = on ? label : btn.dataset.l; }
const errText = (e) => ({ "auth/invalid-credential": "Correo o contraseña incorrectos.", "auth/email-already-in-use": "Ese correo ya tiene cuenta.", "auth/weak-password": "La contraseña debe tener al menos 6 caracteres.", "auth/invalid-email": "Escribe un correo válido." }[e.code] || e.message || "Ocurrió un error.");

// --- Sesión ---
onAuthStateChanged(auth, (user) => {
  if (unsub) { unsub(); unsub = null; }
  if (!user) { records = []; show("auth"); return; }
  show("home");
  unsub = onSnapshot(query(collection(db, "credenciales"), where("uid", "==", user.uid)), (snap) => {
    records = snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
    renderList();
  }, (e) => say(errText(e), "err"));
});

async function authAction(fn, btn) {
  const email = $("email").value.trim(), pass = $("pass").value;
  if (!email || !pass) return say("Escribe tu correo y contraseña.", "err");
  btn.disabled = true;
  try { await fn(auth, email, pass); } catch (e) { say(errText(e), "err"); }
  btn.disabled = false;
}
$("btnLogin").onclick = (e) => authAction(signInWithEmailAndPassword, e.target);
$("btnSignup").onclick = (e) => authAction(createUserWithEmailAndPassword, e.target);
$("btnOut").onclick = () => signOut(auth);

// --- Escaneo ---
$("btnScan").onclick = () => $("file").click();
$("btnBack").onclick = () => show("home");

$("file").onchange = async (e) => {
  const file = e.target.files[0]; e.target.value = "";
  if (!file) return;
  busy($("btnScan"), true, "Leyendo credencial…"); say("");
  try {
    const { data, raw } = await scan(file, (i, n, p) => { $("btnScan").textContent = `Leyendo credencial (${i}/${n})… ${p}%`; });
    fillForm(data);
    $("raw").textContent = raw.trim() || "(el OCR no devolvió texto)";
    $("preview").src = URL.createObjectURL(file);
    show("review");
    const found = FIELDS.filter((f) => data[f]).length;
    if (found < 6) say("Se leyeron pocos datos. Completa a mano o toma otra foto con mejor luz.", "err");
    else say("Revisa que los datos coincidan con la credencial.");
  } catch (err) { say(err.message || "No se pudo leer la credencial.", "err"); }
  busy($("btnScan"), false);
};

function fillForm(d) { for (const f of FIELDS) $("f_" + f).value = (d[f] ?? "").toString().trim(); }

$("btnSave").onclick = async () => {
  const data = {};
  for (const f of FIELDS) data[f] = $("f_" + f).value.trim();
  if (!data.nombre || !data.curp) return say("Falta el nombre o la CURP.", "err");
  data.curp = data.curp.toUpperCase(); data.clave_elector = data.clave_elector.toUpperCase();
  if (records.some((r) => r.curp === data.curp) && !confirm("Ya existe un registro con esa CURP. ¿Guardar de todos modos?")) return;
  busy($("btnSave"), true, "Guardando…");
  try {
    await addDoc(collection(db, "credenciales"), { ...data, uid: auth.currentUser.uid, createdAt: serverTimestamp() });
    show("home"); say("Registro guardado.", "ok");
  } catch (err) { say(errText(err), "err"); }
  busy($("btnSave"), false);
};

// --- Lista ---
$("search").oninput = renderList;
function renderList() {
  const q = $("search").value.trim().toLowerCase();
  const rows = records.filter((r) => !q || [r.nombre, r.apellido_paterno, r.apellido_materno, r.curp, r.municipio].join(" ").toLowerCase().includes(q));
  const box = $("list"); box.replaceChildren();
  if (!rows.length) { const d = document.createElement("div"); d.className = "empty"; d.textContent = records.length ? "Sin resultados." : "Aún no hay registros. Escanea la primera INE."; box.append(d); return; }
  for (const r of rows) {
    const it = document.createElement("div"); it.className = "item";
    const info = document.createElement("div");
    const b = document.createElement("b"); b.textContent = [r.nombre, r.apellido_paterno, r.apellido_materno].filter(Boolean).join(" ");
    const s = document.createElement("small"); s.textContent = [r.curp, [r.municipio, r.estado].filter(Boolean).join(", ")].filter(Boolean).join(" · ");
    info.append(b, s);
    const del = document.createElement("button"); del.className = "link"; del.textContent = "Eliminar";
    del.onclick = async () => { if (confirm("¿Eliminar este registro?")) { try { await deleteDoc(doc(db, "credenciales", r.id)); } catch (e) { say(errText(e), "err"); } } };
    it.append(info, del); box.append(it);
  }
}
