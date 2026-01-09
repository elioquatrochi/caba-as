// =========================
// JSONP
// =========================
function jsonp(url, timeoutMs = 12000) {
  return new Promise((resolve, reject) => {
    const cbName = "cb_" + Math.random().toString(36).slice(2);
    const script = document.createElement("script");
    let done = false;

    const cleanup = () => {
      if (done) return;
      done = true;
      try { delete window[cbName]; } catch (e) { window[cbName] = undefined; }
      script.remove();
      clearTimeout(t);
    };

    window[cbName] = (data) => { cleanup(); resolve(data); };
    script.onerror = () => { cleanup(); reject(new Error("JSONP error")); };

    const t = setTimeout(() => {
      cleanup();
      reject(new Error("JSONP timeout (no callback)"));
    }, timeoutMs);

    const sep = url.includes("?") ? "&" : "?";
    script.src = `${url}${sep}callback=${cbName}`;
    document.body.appendChild(script);
  });
}

// =========================
// CONFIG (PRECIOS / POLÍTICAS)
// =========================
const API_BASE = "https://script.google.com/macros/s/AKfycbwIxzLZlq0NIJgDfGUpMddei2MknrBwgsmCCPNtNvwaHXmhnJB-nPETBIW4d5zQzPr_/exec";

// < 3 noches => 85.000 / noche
// >= 3 noches => 75.000 / noche
const RATE_SHORT = 85000;
const RATE_LONG  = 75000;
const LONG_FROM_NIGHTS = 3;

const DEPOSIT_PCT = 0.50;
const REMINDER_TEXT = "Recordatorio: Llevar ropa blanca.";

// =========================
// HELPERS
// =========================
const $ = (id) => document.getElementById(id);

const today = new Date();
today.setHours(0, 0, 0, 0);

function toISO(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function isoToDate0(iso) {
  const [y, m, d] = String(iso).split("-").map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}
function onlyDigits(s) {
  return String(s || "").replace(/\D/g, "");
}
function isValidPhoneDigits(digits) {
  return /^\d{10,15}$/.test(digits);
}
function money(n) {
  const v = Math.round(Number(n || 0));
  return v.toLocaleString("es-AR");
}
function diffNights(checkinISO, checkoutISO) {
  const a = isoToDate0(checkinISO);
  const b = isoToDate0(checkoutISO);
  return Math.max(0, Math.round((b - a) / 86400000)); // días = noches
}
function rateForNights(n) {
  return (n >= LONG_FROM_NIGHTS) ? RATE_LONG : RATE_SHORT;
}

// Normaliza cabaña: "Cabana 3" / "Cabaña 3" / 3 -> "3"
function cabanaId(x) {
  const s = String(x ?? "").trim();
  const m = s.match(/\d+/);
  return m ? m[0] : s;
}

// =========================
// STATE
// =========================
let allConfirmed = []; // confirmadas global
let ranges = [];       // confirmadas filtradas por cabaña

let fpCheckin, fpCheckout, fpInline;

// =========================
// DOM
// =========================
const cabanaEl = $("cabana");
const personasEl = $("personas");
const nombreEl = $("nombre");
const telefonoEl = $("telefono");
const msgEl = $("msg");
const btnEnviar = $("btnEnviar");
const listaConfirmadas = $("listaConfirmadas");

// Precio UI
const priceBox = $("priceBox");
const pNoches = $("pNoches");
const pRate = $("pRate");
const pTotal = $("pTotal");
const pDeposit = $("pDeposit");
const pHint = $("pHint");

telefonoEl?.addEventListener("input", () => {
  telefonoEl.value = onlyDigits(telefonoEl.value).slice(0, 15);
});

// =========================
// PINTADO CALENDARIO (por noches)
// =========================
// Ocupado si iso está en [checkin, checkout) => checkout NO ocupa
function isBooked(d) {
  const iso = toISO(d);
  for (const r of ranges) {
    if (iso >= r.checkin && iso < r.checkout) return true;
  }
  return false;
}

function markDayClass(dayElem, date) {
  dayElem.classList.remove("day-past", "day-booked", "day-free");

  if (date < today) return dayElem.classList.add("day-past");
  if (isBooked(date)) return dayElem.classList.add("day-booked");
  dayElem.classList.add("day-free");
}

function disableCheckin(date) {
  if (date < today) return true;
  // checkin no puede caer en una noche ocupada
  if (isBooked(date)) return true;
  return false;
}

// Para checkout: permitir que sea un día “ocupado” por otra reserva (ej checkout = otro checkin),
// siempre que NO cruce noches ocupadas en el medio.
function rangeCrossesBooked(inDate, outDate) {
  if (!inDate || !outDate) return false;

  const d = new Date(inDate); d.setHours(0,0,0,0);
  const end = new Date(outDate); end.setHours(0,0,0,0);

  // noches: [inDate, outDate) => NO incluye el día outDate
  while (d < end) {
    if (isBooked(d)) return true;
    d.setDate(d.getDate() + 1);
  }
  return false;
}

function disableCheckout(date) {
  if (date < today) return true;

  const inDate = fpCheckin?.selectedDates?.[0];
  if (!inDate) return false;

  // checkout debe ser > checkin (mínimo 1 noche)
  if (date <= inDate) return true;

  // bloquea si hay noches ocupadas entre medio
  if (rangeCrossesBooked(inDate, date)) return true;

  return false;
}

// =========================
// LISTA + REFRESCOS
// =========================
function applyCabanaFilter() {
  const cab = cabanaId(cabanaEl.value);
  ranges = allConfirmed
    .filter((b) => cabanaId(b.cabana) === cab)
    .map((b) => ({
      checkin: String(b.checkin).trim(),
      checkout: String(b.checkout).trim(),
      personas: String(b.personas ?? "").trim(),
      cabana: b.cabana
    }));
}

function refreshList() {
  const cab = cabanaId(cabanaEl.value);
  const items = allConfirmed
    .filter((b) => cabanaId(b.cabana) === cab)
    .sort((a, b) => (a.checkin > b.checkin ? 1 : -1));

  listaConfirmadas.innerHTML = "";

  if (!items.length) {
    listaConfirmadas.innerHTML = `<li class="muted">No hay reservas confirmadas.</li>`;
    return;
  }

  for (const b of items) {
    const li = document.createElement("li");
    li.innerHTML = `<b>${b.checkin}</b> → <b>${b.checkout}</b><br><span class="muted">Personas: ${b.personas}</span>`;
    listaConfirmadas.appendChild(li);
  }
}

function refreshCalendars() {
  fpCheckin?.set("disable", [disableCheckin]);
  fpCheckout?.set("disable", [disableCheckout]);
  fpInline?.set("disable", [disableCheckin]);

  fpInline?.redraw();
  fpCheckin?.redraw();
  fpCheckout?.redraw();
}

// =========================
// PRECIO UI
// =========================
function updatePriceBox() {
  const inISO = $("checkin")?.value;
  const outISO = $("checkout")?.value;

  if (!inISO || !outISO) {
    priceBox.hidden = true;
    return;
  }

  const nights = diffNights(inISO, outISO);
  if (nights <= 0) {
    priceBox.hidden = true;
    return;
  }

  const rate = rateForNights(nights);
  const total = nights * rate;
  const deposit = total * DEPOSIT_PCT;

  pNoches.textContent = String(nights);
  pRate.textContent = `$${money(rate)}`;
  pTotal.textContent = `$${money(total)}`;
  pDeposit.textContent = `$${money(deposit)}`;
  pHint.textContent = `${REMINDER_TEXT} Para reservar: seña del 50% del total.`;

  priceBox.hidden = false;
}

// =========================
// LOAD AVAILABILITY
// =========================
async function loadAvailability() {
  try {
    const data = await jsonp(`${API_BASE}?action=availability`);
    allConfirmed = Array.isArray(data) ? data : [];

    applyCabanaFilter();
    refreshList();
    refreshCalendars();
  } catch (err) {
    console.error(err);
    msgEl.textContent = "No se pudo cargar disponibilidad (Apps Script). Revisá URL y Deploy (Anyone).";
  }
}

// =========================
// CALENDARS INIT
// =========================
function initCalendars() {
  fpCheckin = flatpickr("#checkin", {
    dateFormat: "Y-m-d",
    minDate: today,
    disable: [disableCheckin],
    onDayCreate: (_, __, ___, dayElem) => markDayClass(dayElem, dayElem.dateObj),
    onChange: (selectedDates) => {
      const d = selectedDates[0];
      if (!d) return;

      // checkout mínimo = checkin + 1 día (1 noche)
      const minOut = new Date(d);
      minOut.setDate(minOut.getDate() + 1);
      fpCheckout.set("minDate", minOut);

      const currentOut = fpCheckout.selectedDates[0];
      if (currentOut && currentOut <= d) fpCheckout.clear();

      updatePriceBox();
    }
  });

  fpCheckout = flatpickr("#checkout", {
    dateFormat: "Y-m-d",
    minDate: today,
    disable: [disableCheckout],
    onDayCreate: (_, __, ___, dayElem) => markDayClass(dayElem, dayElem.dateObj),
    onChange: () => updatePriceBox()
  });

  fpInline = flatpickr("#calInline", {
    inline: true,
    dateFormat: "Y-m-d",
    minDate: today,
    disable: [disableCheckin],
    onDayCreate: (_, __, ___, dayElem) => markDayClass(dayElem, dayElem.dateObj),
  });
}

// =========================
// SUBMIT RESERVA (cliente)
// =========================
async function submitReserva(ev) {
  ev.preventDefault();
  msgEl.textContent = "";

  const payload = {
    cabana: cabanaEl.value,
    personas: personasEl.value,
    nombre: nombreEl.value.trim(),
    telefono: onlyDigits(telefonoEl.value.trim()),
    checkin: $("checkin").value,
    checkout: $("checkout").value
  };

  if (!payload.checkin || !payload.checkout) return (msgEl.textContent = "Seleccioná check-in y check-out.");
  if (!payload.nombre) return (msgEl.textContent = "Ingresá tu nombre.");
  if (!isValidPhoneDigits(payload.telefono)) return (msgEl.textContent = "Teléfono inválido. Usá 10 a 15 dígitos. Ej: 3515555555");

  // Validación por noches: checkout tiene que ser >= checkin + 1
  const nights = diffNights(payload.checkin, payload.checkout);
  if (nights < 1) return (msgEl.textContent = "La reserva debe ser mínimo de 1 noche.");

  btnEnviar.disabled = true;
  msgEl.textContent = "Enviando solicitud…";

  try {
    const qs = new URLSearchParams({
      action: "create",
      cabana: payload.cabana,
      personas: payload.personas,
      nombre: payload.nombre,
      telefono: payload.telefono,
      checkin: payload.checkin,
      checkout: payload.checkout
    });

    const res = await jsonp(`${API_BASE}?${qs.toString()}`);

    if (!res || !res.ok) {
      msgEl.textContent = (res && res.error) ? res.error : "Error al enviar solicitud.";
      return;
    }

    msgEl.textContent = "ENVIADO. Te vamos a contactar para confirmar disponibilidad y forma de pago.";
    $("formReserva").reset();
    fpCheckin.clear();
    fpCheckout.clear();
    updatePriceBox();

  } catch (err) {
    console.error(err);
    msgEl.textContent = "No se pudo conectar con Apps Script. Verificá URL y Deploy (Anyone).";
  } finally {
    btnEnviar.disabled = false;
    await loadAvailability();
  }
}

// =========================
// BOOT
// =========================
window.addEventListener("DOMContentLoaded", async () => {
  initCalendars();
  await loadAvailability();

  cabanaEl.addEventListener("change", () => {
    applyCabanaFilter();
    refreshList();
    refreshCalendars();
  });

  $("formReserva").addEventListener("submit", submitReserva);
});
