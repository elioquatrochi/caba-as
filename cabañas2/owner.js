
function jsonp(url, timeoutMs = 12000) {
  return new Promise((resolve, reject) => {
    const cbName = "cb_" + Math.random().toString(36).slice(2);
    const script = document.createElement("script");
    let done = false;
    let t;

    const cleanup = () => {
      if (done) return;
      done = true;

      try {
        delete window[cbName];
      } catch (e) {
        window[cbName] = undefined;
      }

      script.remove();
      clearTimeout(t);
    };

    window[cbName] = (data) => {
      cleanup();
      resolve(data);
    };

    script.onerror = () => {
      cleanup();
      reject(new Error("No se pudo conectar con el servidor."));
    };

    t = setTimeout(() => {
      cleanup();
      reject(new Error("Tiempo de espera agotado al conectar con el servidor."));
    }, timeoutMs);

    const sep = url.includes("?") ? "&" : "?";
    script.src = `${url}${sep}callback=${cbName}`;

    document.body.appendChild(script);
  });
}

// ==================================================
// CONFIGURACIÓN
// ==================================================
const VERSION = "20261013-1";

const API_BASE =
  "https://script.google.com/macros/s/AKfycbwTJFOUvwU9vEu0Ffi4Iz2fGw1QCysqMy9lKsnT_Bmx6rjsWu2des0tGhbDifTR2hWi/exec";

const CHECKIN_TIME = "12:00";
const CHECKOUT_TIME = "09:00";
const REMINDER_TEXT = "Llevar ropa blanca (sábanas y toallas).";

// ==================================================
// DOM
// ==================================================
const $ = (id) => document.getElementById(id);

const loginBox = $("loginBox");
const panel = $("panel");
const pinEl = $("pin");
const btnLogin = $("btnLogin");
const loginMsg = $("loginMsg");

const btnLogout = $("btnLogout");
const btnReload = $("btnReload");

const fCabana = $("fCabana");
const fEstado = $("fEstado");
const q = $("q");

const statusLine = $("statusLine");
const tbody = $("tbody");

// ==================================================
// ESTADO
// ==================================================
let pin = sessionStorage.getItem("owner_pin") || "";
let all = [];

// ==================================================
// UTILIDADES
// ==================================================
function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (m) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[m]));
}

function chip(estado) {
  const e = String(estado || "").toUpperCase();

  const cls =
    e === "CONFIRMADA" ? "confirmada" :
    e === "RECHAZADA" ? "rechazada" :
    e === "CANCELADA" ? "cancelada" :
    "pendiente";

  return `<span class="chip ${cls}">${esc(e || "PENDIENTE")}</span>`;
}

// Calcula únicamente la cantidad de noches. No calcula precios.
function nightsBetween(checkinISO, checkoutISO) {
  if (!checkinISO || !checkoutISO) return 0;

  const partsA = String(checkinISO).split("-").map(Number);
  const partsB = String(checkoutISO).split("-").map(Number);

  const a = Date.UTC(
    partsA[0],
    partsA[1] - 1,
    partsA[2]
  );

  const b = Date.UTC(
    partsB[0],
    partsB[1] - 1,
    partsB[2]
  );

  return Math.max(
    0,
    Math.round((b - a) / 86400000)
  );
}

function normalizeArPhone(tel) {
  let digits = String(tel || "").replace(/\D/g, "");

  digits = digits.replace(/^0+/, "");

  if (digits.startsWith("549")) return digits;
  if (digits.startsWith("54")) return "549" + digits.slice(2);

  return "549" + digits;
}

function waUrl(tel, msg) {
  const phone = normalizeArPhone(tel);

  return `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
}

// ==================================================
// API
// ==================================================
async function api(action, params = {}, overridePin) {
  const qs = new URLSearchParams({
    action,
    pin: overridePin ?? pin,
    ...params
  });

  // Evita respuestas almacenadas en caché.
  qs.set("_v", VERSION);

  return await jsonp(`${API_BASE}?${qs.toString()}`);
}

// ==================================================
// MENSAJE DE WHATSAPP — SIN PRECIOS NI SEÑA
// ==================================================
function buildMsg(r) {
  const estado = String(r.estado || "").toUpperCase();

  if (estado === "RECHAZADA" || estado === "CANCELADA") {
    return (
      `Hola ${r.nombre}, gracias por tu solicitud.\n` +
      `Por el momento no hay disponibilidad para ` +
      `${r.checkin} a ${r.checkout} (${r.cabana}).\n` +
      `Si querés, decime otras fechas y lo revisamos.`
    );
  }

  const nights = nightsBetween(r.checkin, r.checkout);

  const base =
    `Cabaña: ${r.cabana}\n` +
    `Personas: ${r.personas}\n` +
    `Ingreso: ${r.checkin} (desde ${CHECKIN_TIME})\n` +
    `Salida: ${r.checkout} (hasta ${CHECKOUT_TIME})\n` +
    `Noches: ${nights}\n` +
    `Recordatorio: ${REMINDER_TEXT}\n`;

  if (estado === "CONFIRMADA") {
    return (
      `Hola ${r.nombre}, tu reserva quedó CONFIRMADA.\n\n` +
      base +
      `Cualquier consulta, respondé este mensaje.`
    );
  }

  return (
    `Hola ${r.nombre}, recibimos tu solicitud.\n\n` +
    base +
    `En breve te confirmamos disponibilidad.`
  );
}

// ==================================================
// FILTROS
// ==================================================
function applyFilters(list) {
  const cab = fCabana.value;
  const est = fEstado.value;
  const term = q.value.trim().toLowerCase();

  return list.filter((r) => {
    if (cab && String(r.cabana) !== cab) return false;

    if (
      est &&
      String(r.estado || "").toUpperCase() !== est
    ) {
      return false;
    }

    if (term) {
      const hay = [
        r.nombre,
        r.telefono,
        r.cabana,
        r.checkin,
        r.checkout,
        r.estado,
        r.createdAt
      ].join(" ").toLowerCase();

      if (!hay.includes(term)) return false;
    }

    return true;
  });
}

// ==================================================
// RENDERIZADO DEL PANEL — SIN COLUMNA TOTAL
// ==================================================
function render() {
  const filtered = applyFilters(all);

  statusLine.textContent =
    `Mostrando ${filtered.length} de ${all.length} reservas.`;

  tbody.innerHTML = filtered.map((r) => {
    const nights = nightsBetween(r.checkin, r.checkout);
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
        <td>${nights}</td>
        <td class="muted small">${esc(r.createdAt)}</td>
        <td>
          <div class="actions">
            <a
              class="iconBtn wa"
              href="${wa}"
              target="_blank"
              rel="noopener"
            >📱 WhatsApp</a>

            <button
              class="iconBtn ok"
              data-act="confirm"
              data-id="${esc(r.id)}"
            >✅ Confirmar</button>

            <button
              class="iconBtn no"
              data-act="reject"
              data-id="${esc(r.id)}"
            >❌ Rechazar</button>

            <button
              class="iconBtn del"
              data-act="delete"
              data-id="${esc(r.id)}"
            >🗑 Eliminar</button>
          </div>
        </td>
      </tr>
    `;
  }).join("");
}

// ==================================================
// CARGAR RESERVAS
// ==================================================
async function loadOrThrow() {
  statusLine.textContent = "Cargando…";

  const res = await api("owner_list");

  if (!Array.isArray(res)) {
    throw new Error(res?.error || "Respuesta inválida del servidor.");
  }

  all = res;
  render();
}

// ==================================================
// SESIÓN
// ==================================================
function showPanel() {
  loginBox.classList.add("hidden");
  panel.classList.remove("hidden");
}

function showLogin() {
  panel.classList.add("hidden");
  loginBox.classList.remove("hidden");
}

function clearAuth() {
  sessionStorage.removeItem("owner_pin");
  pin = "";
  all = [];
}

async function loginWithPin(candidatePin) {
  loginMsg.textContent = "";
  statusLine.textContent = "";

  const candidate = String(candidatePin || "").trim();

  if (!candidate) {
    loginMsg.textContent = "Ingresá el PIN.";
    return;
  }

  try {
    const test = await api("owner_list", {}, candidate);

    if (!Array.isArray(test)) {
      throw new Error(test?.error || "No se pudo validar el PIN.");
    }

    pin = candidate;
    sessionStorage.setItem("owner_pin", pin);

    all = test;

    showPanel();
    render();

  } catch (err) {
    console.error("Error de inicio de sesión:", err);

    clearAuth();
    showLogin();

    loginMsg.textContent =
      err.message || "No se pudo validar el PIN.";
  }
}

// ==================================================
// EVENTOS
// ==================================================
btnLogin.addEventListener("click", async () => {
  await loginWithPin(pinEl.value);
});

pinEl.addEventListener("keydown", async (ev) => {
  if (ev.key === "Enter") {
    await loginWithPin(pinEl.value);
  }
});

btnLogout.addEventListener("click", () => {
  clearAuth();
  pinEl.value = "";
  loginMsg.textContent = "";
  showLogin();
});

btnReload.addEventListener("click", async () => {
  try {
    await loadOrThrow();
  } catch (err) {
    console.error(err);

    clearAuth();
    showLogin();

    loginMsg.textContent =
      "No se pudieron cargar las reservas. Revisá la conexión y el PIN.";
  }
});

[fCabana, fEstado, q].forEach((el) => {
  el.addEventListener("input", render);
});

tbody.addEventListener("click", async (ev) => {
  const btn = ev.target.closest("button[data-act]");

  if (!btn) return;

  const act = btn.dataset.act;
  const id = btn.dataset.id;

  try {
    if (act === "delete") {
      if (!confirm("¿Eliminar esta reserva?")) return;

      const res = await api("owner_delete", { id });

      if (!res.ok) {
        alert(res.error || "No se pudo eliminar.");
        return;
      }

      await loadOrThrow();
      return;
    }

    if (act === "confirm" || act === "reject") {
      const label =
        act === "confirm" ? "CONFIRMAR" : "RECHAZAR";

      if (!confirm(`¿${label} esta reserva?`)) return;

      const res = await api("owner_decide", {
        id,
        decision: act
      });

      if (!res.ok) {
        alert(res.error || "No se pudo actualizar la reserva.");
      }

      await loadOrThrow();
    }

  } catch (err) {
    console.error("Error en la operación:", err);

    alert(
      "No se pudo completar la operación. " +
      "Revisá la conexión e intentá nuevamente."
    );
  }
});

// ==================================================
// INICIO AUTOMÁTICO
// ==================================================
window.addEventListener("DOMContentLoaded", async () => {
  if (!pin) {
    showLogin();
    return;
  }

  try {
    const test = await api("owner_list", {}, pin);

    if (!Array.isArray(test)) {
      throw new Error(test?.error || "Sesión inválida.");
    }

    all = test;

    showPanel();
    render();

  } catch (err) {
    console.error("Error al restaurar la sesión:", err);

    clearAuth();
    showLogin();

    loginMsg.textContent =
      "La sesión venció o no se pudo conectar. Ingresá nuevamente el PIN.";
  }
});
