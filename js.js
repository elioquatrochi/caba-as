/* =========================
   Helpers
   ========================= */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

/* =========================
   Mobile menu
   ========================= */
(() => {
  const toggle = $("#mobileNavToggle");
  const menu = $("#mobileMenu");
  if (!toggle || !menu) return;

  const openMenu = () => {
    menu.classList.add("active");
    menu.setAttribute("aria-hidden", "false");
    toggle.setAttribute("aria-expanded", "true");
    document.body.style.overflow = "hidden";
  };

  const closeMenu = () => {
    menu.classList.remove("active");
    menu.setAttribute("aria-hidden", "true");
    toggle.setAttribute("aria-expanded", "false");
    document.body.style.overflow = "";
  };

  toggle.addEventListener("click", () => {
    const expanded = toggle.getAttribute("aria-expanded") === "true";
    expanded ? closeMenu() : openMenu();
  });

  $$(".mobile-link", menu).forEach((a) => a.addEventListener("click", closeMenu));

  // Cerrar con ESC
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeMenu();
  });
})();

/* =========================
   Header hide on scroll
   ========================= */
(() => {
  const header = $("#header");
  if (!header) return;

  let lastY = window.scrollY;
  window.addEventListener("scroll", () => {
    const y = window.scrollY;
    const goingDown = y > lastY;

    if (y > 140 && goingDown) header.classList.add("hidden");
    else header.classList.remove("hidden");

    lastY = y;
  });
})();

/* =========================
   Scroll to top
   ========================= */
(() => {
  const btn = $("#scrollToTop");
  if (!btn) return;

  const onScroll = () => {
    if (window.scrollY > 600) btn.classList.add("visible");
    else btn.classList.remove("visible");
  };

  window.addEventListener("scroll", onScroll);
  onScroll();

  btn.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
})();

/* =========================
   WhatsApp: enviar consulta desde el formulario
   ========================= */
(() => {
  const form = $("#searchForm");
  if (!form) return;

  const PHONE = "5493512692064"; // cambiá si querés
  form.addEventListener("submit", (e) => {
    e.preventDefault();

    const checkin = $("#checkin")?.value || "";
    const checkout = $("#checkout")?.value || "";
    const guests = $("#guests")?.value || "";
    const cabana = $("#cabana")?.value || "Cualquiera";

    const msg =
      `Hola! Quisiera consultar disponibilidad.\n` +
      `Ingreso: ${checkin}\n` +
      `Salida: ${checkout}\n` +
      `Personas: ${guests}\n` +
      `Cabaña: ${cabana}\n\n` +
      `Gracias!`;

    const url = `https://wa.me/${PHONE}?text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  });
})();

/* =========================
   Counters (calificaciones) al entrar en pantalla
   ========================= */
(() => {
  const counters = $$(".counter");
  if (!counters.length) return;

  const animate = (el) => {
    const target = Number(el.dataset.target || "0");
    const decimals = Number(el.dataset.decimals || "0");
    const duration = 1100; // ms
    const start = performance.now();
    const from = 0;

    const step = (t) => {
      const p = Math.min((t - start) / duration, 1);
      // easing suave
      const eased = 1 - Math.pow(1 - p, 3);

      const val = from + (target - from) * eased;
      el.textContent = val.toFixed(decimals);

      if (p < 1) requestAnimationFrame(step);
    };

    requestAnimationFrame(step);
  };

  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        if (el.dataset.done === "1") return;
        el.dataset.done = "1";
        animate(el);
      });
    },
    { threshold: 0.35 }
  );

  counters.forEach((c) => io.observe(c));
})();

/* =========================
   Carrusel Galería (flechas + dots + teclado + drag)
   ========================= */
(() => {
  const carousel = $("#galleryCarousel");
  const track = $("#galleryTrack");
  const dotsWrap = $("#galleryDots");
  if (!carousel || !track || !dotsWrap) return;

  const slides = $$(".carousel-slide", track);
  if (!slides.length) return;

  // Crear dots
  dotsWrap.innerHTML = "";
  const dots = slides.map((_, i) => {
    const b = document.createElement("button");
    b.className = "carousel-dot" + (i === 0 ? " active" : "");
    b.type = "button";
    b.setAttribute("aria-label", `Ir a foto ${i + 1}`);
    b.addEventListener("click", () => scrollToIndex(i));
    dotsWrap.appendChild(b);
    return b;
  });

  const getSlideScroll = () => {
    // Scroll por “1 slide”: ancho real de slide + gap
    const first = slides[0].getBoundingClientRect();
    const second = slides[1]?.getBoundingClientRect();
    if (!second) return first.width;
    return Math.round(second.left - first.left);
  };

  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

  const getIndexFromScroll = () => {
    const step = getSlideScroll();
    if (!step) return 0;
    return clamp(Math.round(track.scrollLeft / step), 0, slides.length - 1);
  };

  const setActiveDot = (idx) => {
    dots.forEach((d, i) => d.classList.toggle("active", i === idx));
  };

  const scrollToIndex = (idx) => {
    const step = getSlideScroll();
    track.scrollTo({ left: idx * step, behavior: "smooth" });
    setActiveDot(idx);
  };

  const prevBtn = document.querySelector("[data-carousel-prev]");
  const nextBtn = document.querySelector("[data-carousel-next]");

  prevBtn?.addEventListener("click", () => {
    const idx = getIndexFromScroll();
    scrollToIndex(idx - 1);
  });

  nextBtn?.addEventListener("click", () => {
    const idx = getIndexFromScroll();
    scrollToIndex(idx + 1);
  });

  // Teclado
  carousel.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      const idx = getIndexFromScroll();
      scrollToIndex(idx - 1);
    }
    if (e.key === "ArrowRight") {
      e.preventDefault();
      const idx = getIndexFromScroll();
      scrollToIndex(idx + 1);
    }
  });

  // Actualizar dot al scrollear (debounce leve)
  let raf = null;
  track.addEventListener("scroll", () => {
    if (raf) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => setActiveDot(getIndexFromScroll()));
  });

  // Drag (mouse/touch)
  let isDown = false;
  let startX = 0;
  let startScroll = 0;

  const onDown = (clientX) => {
    isDown = true;
    startX = clientX;
    startScroll = track.scrollLeft;
    track.style.scrollBehavior = "auto";
  };

  const onMove = (clientX) => {
    if (!isDown) return;
    const dx = (clientX - startX);
    track.scrollLeft = startScroll - dx;
  };

  const onUp = () => {
    if (!isDown) return;
    isDown = false;
    track.style.scrollBehavior = "smooth";
    // Snap al más cercano
    const idx = getIndexFromScroll();
    scrollToIndex(idx);
  };

  track.addEventListener("mousedown", (e) => onDown(e.clientX));
  window.addEventListener("mousemove", (e) => onMove(e.clientX));
  window.addEventListener("mouseup", onUp);

  track.addEventListener("touchstart", (e) => onDown(e.touches[0].clientX), { passive: true });
  track.addEventListener("touchmove", (e) => onMove(e.touches[0].clientX), { passive: true });
  track.addEventListener("touchend", onUp);
})();
(() => {
  const photosByCabin = {
    c1: [
      "/img/foto1",
      "foto2",
      "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1200&h=800&fit=crop"
    ],
    c2: [
      "https://images.unsplash.com/photo-1510798831971-661eb04b3739?w=1200&h=800&fit=crop",
      "https://images.unsplash.com/photo-1602343168117-bb8ffe3e2e9f?w=1200&h=800&fit=crop",
      "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=1200&h=800&fit=crop"
    ],
    c3: [
      "https://images.unsplash.com/photo-1542718610-a1d656d1884c?w=1200&h=800&fit=crop",
      "https://images.unsplash.com/photo-1564501049412-61c2a3083791?w=1200&h=800&fit=crop",
      "https://images.unsplash.com/photo-1540541338287-41700207dee6?w=1200&h=800&fit=crop"
    ]
  };

  const createLightbox = () => {
    const lightbox = document.createElement("div");
    lightbox.className = "gallery-lightbox";
    lightbox.innerHTML = `
      <span class="lightbox-close">&times;</span>
      <img src="" alt="Foto de cabaña" />
      <div class="lightbox-controls">
        <button class="lightbox-btn" id="prevPhoto">Anterior</button>
        <button class="lightbox-btn" id="nextPhoto">Siguiente</button>
      </div>
    `;
    document.body.appendChild(lightbox);
    return lightbox;
  };

  const lightbox = createLightbox();
  const lightboxImg = lightbox.querySelector("img");
  const closeBtn = lightbox.querySelector(".lightbox-close");
  const prevBtn = lightbox.querySelector("#prevPhoto");
  const nextBtn = lightbox.querySelector("#nextPhoto");

  let currentPhotos = [];
  let currentIndex = 0;

  const showPhoto = (index) => {
    currentIndex = index;
    lightboxImg.src = currentPhotos[currentIndex];
  };

  $$(".js-view-photos").forEach((btn) => {
    btn.addEventListener("click", () => {
      const cabinId = btn.dataset.cabin;
      currentPhotos = photosByCabin[cabinId] || [];
      if (currentPhotos.length) {
        showPhoto(0);
        lightbox.classList.add("active");
      }
    });
  });

  closeBtn.addEventListener("click", () => lightbox.classList.remove("active"));
  lightbox.addEventListener("click", (e) => {
    if (e.target === lightbox) lightbox.classList.remove("active");
  });

  prevBtn.addEventListener("click", () => {
    currentIndex = (currentIndex - 1 + currentPhotos.length) % currentPhotos.length;
    showPhoto(currentIndex);
  });

  nextBtn.addEventListener("click", () => {
    currentIndex = (currentIndex + 1) % currentPhotos.length;
    showPhoto(currentIndex);
  });

  document.addEventListener("keydown", (e) => {
    if (!lightbox.classList.contains("active")) return;
    if (e.key === "ArrowRight") nextBtn.click();
    if (e.key === "ArrowLeft") prevBtn.click();
    if (e.key === "Escape") lightbox.classList.remove("active");
  });
})();
