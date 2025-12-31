function jsonp(url, timeoutMs = 12000) {
  return new Promise((resolve, reject) => {
    const cbName = "cb_" + Math.random().toString(36).slice(2);
    const script = document.createElement("script");
    let done = false;

    const cleanup = () => {
      if (done) return;
      done = true;
      try { delete window[cbName]; } catch(e) { window[cbName] = undefined; }
      script.remove();
      clearTimeout(t);
    };

    window[cbName] = (data) => { cleanup(); resolve(data); };
    script.onerror = () => { cleanup(); reject(new Error("JSONP error")); };

    const t = setTimeout(() => { cleanup(); reject(new Error("JSONP timeout")); }, timeoutMs);

    const sep = url.includes("?") ? "&" : "?";
    script.src = `${url}${sep}callback=${cbName}`;
    document.body.appendChild(script);
  });
}

// =========================
// CONFIG
// =========================
const API_BASE = "https://script.google.com/macros/s/AKfycbwIxzLZlq0NIJgDfGUpMddei2MknrBwgsmCCPNtNvwaHXmhnJB-nPETBIW4d5zQzPr_/exec";

// PRECIOS
const PRICE_PER_NIGHT = 90000;
const PRICE_PER_NIGHT_LONG = 80000;
const LONG_STAY_MIN_NIGHTS = 5;

// =========================
// DOM
// =========================
const $ = (id) => document.getElementById(id);

const loginBox = $("loginBox");
const panel = $("panel");
const pinEl = $("pin");
const btnLogin = $("btnLogin");
const loginMsg = $("loginMsg");

const btnLogout = $("btnLogout");
const btnReset = $("btnReset");
const btnReload = $("btnReload");

const fCabana = $("fCabana");
const fEstado = $("fEstado");
const q = $("q");

const statusLine = $("statusLine");
const tbody = $("tbody");

// =========================
// STATE
// =========================
let pin = sessionStorage.getItem("owner_pin") || "";
let all = [];

// =========================
// HELPERS
// =========================
function esc(s){ return String(s||"").replace(/[&<>"']/g, m => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;" }[m])); }

function parseISOToDate0(iso){
  const [y,m,d] = String(iso||"").split("-").map(Number);
  return new Date(y, (m||1)-1, d||1, 0,0,0,0);
}

function nightsBetween(checkinISO, checkoutISO){
  if (!checkinISO || !checkoutISO) return 0;
  const a = parseISOToDate0(checkinISO);
  const b = parseISOToDate0(checkoutISO);
  const ms = b.getTime() - a.getTime();
  const n = Math.round(ms / (24*60*60*1000));
  return Math.max(0, n);
}

function getRateByNights(n){
  return (n >= LONG_STAY_MIN_NIGHTS) ? PRICE_PER_NIGHT_LONG : PRICE_PER_NIGHT;
}

function formatARS(n){
  const v = Number(n || 0);
  return "$ " + v.toLocaleString("es-AR");
}

function chip(estado){
  const e = String(estado||"").toUpperCase();
  const cls =
    e === "CONFIRMADA" ? "confirmada" :
    e === "RECHAZADA" ? "rechazada" :
    e === "CANCELADA" ? "cancelada" : "pendiente";
  return `<span class="chip ${cls}">${esc(e || "PENDIENTE")}</span>`;
}

function waUrl(tel, msg){
  const digits = String(tel||"").replace(/\D/g,"");
  const phone = digits.startsWith("549") ? digits : (digits.startsWith("54") ? ("549"+digits.slice(2)) : ("549"+digits));
  return `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
}

function buildMsg(r){
  const noches = nightsBetween(r.checkin, r.checkout);
  const rate = getRateByNights(noches);
  const total = noches * rate;

  const priceBlock =
    `Noches: ${noches}\n` +
    `Precio por noche: ${formatARS(rate)}\n` +
    `Total: ${formatARS(total)}\n`;

  const e = String(r.estado||"").toUpperCase();

  if (e === "CONFIRMADA"){
    return (
      `Hola ${r.nombre}, tu reserva quedó CONFIRMADA.\n` +
      `Cabaña: ${r.cabana}\n` +
      `Personas: ${r.personas}\n` +
      `Ingreso: ${r.checkin}\n` +
      `Salida: ${r.checkout}\n\n` +
      priceBlock +
      `Cualquier consulta, respondé este mensaje.`
    );
  }

  if (e === "RECHAZADA" || e === "CANCELADA"){
    return (
      `Hola ${r.nombre}, gracias por tu solicitud.\n` +
      `Por el momento no hay disponibilidad para ${r.checkin} a ${r.checkout} (${r.cabana}).\n` +
      `Si querés, decime otras fechas y lo revisamos.`
    );
  }

  // PENDIENTE
  return (
    `Hola ${r.nombre}, recibimos tu solicitud.\n` +
    `Cabaña: ${r.cabana}\n` +
    `Personas: ${r.personas}\n` +
    `Fechas: ${r.checkin} a ${r.checkout}\n\n` +
    priceBlock +
    `En breve te confirmamos disponibilidad.`
  );
}

async function api(action, params = {}) {
  const qs = new URLSearchParams({ action, pin, ...params });
  return await jsonp(`${API_BASE}?${qs.toString()}`);
}

function applyFilters(list){
  const cab = fCabana.value;
  const est = fEstado.value;
  const term = q.value.trim().toLowerCase();

  return list.filter(r => {
    if (cab && String(r.cabana) !== cab) return false;
    if (est && String(r.estado||"").toUpperCase() !== est) return false;

    if (term){
      const hay = [
        r.nombre, r.telefono, r.cabana, r.checkin, r.checkout, r.estado, r.createdAt
      ].join(" ").toLowerCase();
      if (!hay.includes(term)) return false;
    }
    return true;
  });
}

function render(){
  const filtered = applyFilters(all);
  statusLine.textContent = `Mostrando ${filtered.length} de ${all.length} reservas.`;

  tbody.innerHTML = filtered.map(r => {
    const noches = nightsBetween(r.checkin, r.checkout);
    const rate = getRateByNights(noches);
    const total = noches * rate;

    const msg = buildMsg(r);
    const wa = waUrl(r.telefono, msg);

    return `
      <tr>
        <td>${chip(r.estado)}</td>
        <td>${esc(r.cabana)}</td>
        <td>${esc(r.nombre)}</td>
        <td>${esc(r.telefono)}</td>
        <td>${esc(r.personas)}</td>
        <td>${esc(r.checkin)}</td>
        <td>${esc(r.checkout)}</td>
        <td>${esc(noches)}</td>
        <td><b>${esc(formatARS(total))}</b></td>
        <td class="muted small">${esc(r.createdAt)}</td>
        <td>
          <div class="actions">
            <a class="iconBtn wa" href="${wa}" target="_blank" rel="noopener">📱 WhatsApp</a>
            <button class="iconBtn ok" data-act="confirm" data-id="${esc(r.id)}">✅ Confirmar</button>
            <button class="iconBtn no" data-act="reject" data-id="${esc(r.id)}">❌ Rechazar</button>
            <button class="iconBtn del" data-act="delete" data-id="${esc(r.id)}">🗑 Eliminar</button>
          </div>
        </td>
      </tr>
    `;
  }).join("");
}

async function load(){
  statusLine.textContent = "Cargando…";
  const res = await api("owner_list");
  if (!Array.isArray(res)) throw new Error(res?.error || "Respuesta inválida");
  all = res;
  render();
}

function showPanel(){
  loginBox.classList.add("hidden");
  panel.classList.remove("hidden");
}

function showLogin(){
  panel.classList.add("hidden");
  loginBox.classList.remove("hidden");
}

// =========================
// EVENTS
// =========================
btnLogin.addEventListener("click", async () => {
  loginMsg.textContent = "";
  const p = String(pinEl.value||"").trim();
  if (!p) { loginMsg.textContent = "Ingresá PIN."; return; }

  pin = p;
  try{
    await api("owner_list"); // test
    sessionStorage.setItem("owner_pin", pin);
    showPanel();
    await load();
  }catch(err){
    console.error(err);
    loginMsg.textContent = "PIN inválido o WebApp no accesible. Verificá deploy (Anyone).";
    pin = "";
  }
});

btnLogout.addEventListener("click", () => {
  sessionStorage.removeItem("owner_pin");
  pin = "";
  pinEl.value = "";
  all = [];
  showLogin();
});

btnReload.addEventListener("click", async () => {
  try{ await load(); } catch(e){ statusLine.textContent = "Error al cargar."; }
});

[fCabana, fEstado, q].forEach(el => el.addEventListener("input", render));

tbody.addEventListener("click", async (ev) => {
  const btn = ev.target.closest("button[data-act]");
  if (!btn) return;

  const act = btn.dataset.act;
  const id = btn.dataset.id;

  if (act === "delete") {
    if (!confirm("¿Eliminar esta reserva?")) return;
    const r = await api("owner_delete", { id });
    if (!r.ok) { alert(r.error || "No se pudo eliminar"); return; }
    await load();
    return;
  }

  if (act === "confirm" || act === "reject") {
    const label = act === "confirm" ? "CONFIRMAR" : "RECHAZAR";
    if (!confirm(`¿${label} esta reserva?`)) return;

    const r = await api("owner_decide", { id, decision: act });
    if (!r.ok) { alert(r.error || "No se pudo actualizar"); }
    await load();
  }
});

btnReset.addEventListener("click", async () => {
  if (!confirm("Esto BORRA TODO y deja la hoja en cero. ¿Confirmás?")) return;
  const r = await api("owner_reset");
  if (!r.ok) { alert(r.error || "No se pudo resetear"); return; }
  await load();
});

// Auto-login si ya hay PIN guardado
window.addEventListener("DOMContentLoaded", async () => {
  if (pin) {
    try{
      showPanel();
      await load();
    }catch(e){
      console.error(e);
      showLogin();
    }
  } else {
    showLogin();
  }
});
