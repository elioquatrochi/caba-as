// =========================
// JSONP
// =========================
function jsonp(url, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const cbName = "cb_" + Math.random().toString(36).slice(2);
    const script = document.createElement("script");
    let done = false;

    const cleanup = () => {
      if (done) return;
      done = true;
      delete window[cbName];
      script.remove();
      clearTimeout(t);
    };

    window[cbName] = (data) => {
      cleanup();
      resolve(data);
    };

    script.onerror = () => {
      cleanup();
      reject(new Error("JSONP error"));
    };

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
// CONFIG
// =========================
const API_BASE = "https://script.google.com/macros/s/AKfycbwIxzLZlq0NIJgDfGUpMddei2MknrBwgsmCCPNtNvwaHXmhnJB-nPETBIW4d5zQzPr_/exec";

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

// =========================
// STATE
// =========================
let allConfirmed = [];
let ranges = [];
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

// =========================
// UI helpers (colores calendario)
// =========================
function markDayClass(dayElem, date) {
  dayElem.classList.remove("day-past", "day-booked", "day-free");

  if (date < today) {
    dayElem.classList.add("day-past");
    return;
  }
  if (isBooked(date)) {
    dayElem.classList.add("day-booked");
    return;
  }
  dayElem.classList.add("day-free");
}

// =========================
// AVAILABILITY LOGIC
// =========================
// Ocupado si d está dentro de [checkin, checkout] (INCLUYE checkout)
function isBooked(d) {
  const iso = toISO(d);
  for (const r of ranges) {
    if (iso >= r.checkin && iso <= r.checkout) return true;
  }
  return false;
}

function disableFn(date) {
  if (date < today) return true;
  if (isBooked(date)) return true;
  return false;
}

// checkout extra: no puede ser <= checkin
function checkoutDisableFn(date) {
  if (disableFn(date)) return true;

  const inDate = fpCheckin?.selectedDates?.[0];
  if (inDate && date <= inDate) return true;

  return false;
}

function applyCabanaFilter() {
  const cab = cabanaEl.value;
  ranges = allConfirmed.filter((b) => String(b.cabana) === String(cab));
}

function refreshList() {
  const cab = cabanaEl.value;
  const items = allConfirmed
    .filter((b) => String(b.cabana) === String(cab))
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
  if (fpCheckin) fpCheckin.set("disable", [disableFn]);
  if (fpCheckout) fpCheckout.set("disable", [checkoutDisableFn]);
  if (fpInline) fpInline.set("disable", [disableFn]);

  fpInline && fpInline.redraw();
  fpCheckin && fpCheckin.redraw();
  fpCheckout && fpCheckout.redraw();
}

async function loadAvailability() {
  try {
    const data = await jsonp(`${API_BASE}?action=availability`);
    allConfirmed = Array.isArray(data) ? data : [];
    applyCabanaFilter();
    refreshList();
    refreshCalendars();
  } catch (err) {
    console.error(err);
    msgEl.textContent = "No se pudo cargar disponibilidad (Apps Script).";
  }
}

// =========================
// CALENDARS INIT
// =========================
function initCalendars() {
  fpCheckin = flatpickr("#checkin", {
    dateFormat: "Y-m-d",
    minDate: today,
    disable: [disableFn],
    onDayCreate: (dObj, dStr, fp, dayElem) => markDayClass(dayElem, dayElem.dateObj),
    onChange: (selectedDates) => {
      const d = selectedDates[0];
      if (!d) return;

      const minOut = new Date(d);
      minOut.setDate(minOut.getDate() + 1);
      fpCheckout.set("minDate", minOut);

      const currentOut = fpCheckout.selectedDates[0];
      if (currentOut && currentOut <= d) fpCheckout.clear();
    }
  });

  fpCheckout = flatpickr("#checkout", {
    dateFormat: "Y-m-d",
    minDate: today,
    disable: [checkoutDisableFn],
    onDayCreate: (dObj, dStr, fp, dayElem) => markDayClass(dayElem, dayElem.dateObj),
  });

  fpInline = flatpickr("#calInline", {
    inline: true,
    dateFormat: "Y-m-d",
    minDate: today,
    disable: [disableFn],
    onDayCreate: (dObj, dStr, fp, dayElem) => markDayClass(dayElem, dayElem.dateObj),
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
    telefono: telefonoEl.value.trim(),
    checkin: $("checkin").value,
    checkout: $("checkout").value
  };

  if (!payload.checkin || !payload.checkout) {
    msgEl.textContent = "Seleccioná check-in y check-out.";
    return;
  }

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

    msgEl.textContent = "ENVIADO. Esperá a ser contactado para confirmar disponibilidad.";
    $("formReserva").reset();
    fpCheckin.clear();
    fpCheckout.clear();

  } catch (err) {
    console.error(err);
    msgEl.textContent = "No se pudo conectar con Apps Script.";
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
