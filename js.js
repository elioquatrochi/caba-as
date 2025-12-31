document.addEventListener("DOMContentLoaded", () => {
  /* =========================
     CONFIG WHATSAPP + FECHAS
     ========================= */
  const WHATSAPP_NUMBER = "5493512692064";

  function toISODate(d) {
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  const checkin = document.getElementById("checkin");
  const checkout = document.getElementById("checkout");

  const today = new Date();
  const todayISO = toISODate(today);

  if (checkin) checkin.min = todayISO;
  if (checkout) checkout.min = todayISO;

  if (checkin && checkout) {
    checkin.addEventListener("change", () => {
      if (!checkin.value) return;
      const inDate = new Date(checkin.value + "T00:00:00");
      const minOut = new Date(inDate);
      minOut.setDate(minOut.getDate() + 1);
      const minOutISO = toISODate(minOut);
      checkout.min = minOutISO;

      if (!checkout.value || checkout.value < minOutISO) {
        checkout.value = minOutISO;
      }
    });
  }

  /* =========================
     FORM -> WhatsApp
     ========================= */
  const searchForm = document.getElementById("searchForm");
  if (searchForm) {
    searchForm.addEventListener("submit", (e) => {
      e.preventDefault();

      const guests = document.getElementById("guests")?.value || "";
      const inVal = checkin?.value || "";
      const outVal = checkout?.value || "";

      const msg =
        `Hola! Quisiera consultar disponibilidad en Cabañas Sol y Luna.\n` +
        `Ingreso: ${inVal}\n` +
        `Salida: ${outVal}\n` +
        `Personas: ${guests}\n`;

      const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`;
      window.open(url, "_blank", "noopener");
    });
  }

  /* =========================
     NAV MOBILE
     ========================= */
  const mobileNavToggle = document.getElementById("mobileNavToggle");
  const mobileMenu = document.getElementById("mobileMenu");

  function setMobileMenu(open) {
    if (!mobileMenu || !mobileNavToggle) return;
    mobileMenu.classList.toggle("active", open);
    mobileMenu.setAttribute("aria-hidden", String(!open));
    mobileNavToggle.setAttribute("aria-expanded", String(open));
    document.body.classList.toggle("no-scroll", open);
  }

  if (mobileNavToggle) {
    mobileNavToggle.addEventListener("click", () => {
      const open = !mobileMenu?.classList.contains("active");
      setMobileMenu(open);
    });
  }

  document.querySelectorAll(".mobile-link").forEach((a) => {
    a.addEventListener("click", () => setMobileMenu(false));
  });

  window.addEventListener("resize", () => {
    if (window.innerWidth >= 901) setMobileMenu(false);
  });

  /* =========================
     SCROLL TOP
     ========================= */
  const scrollBtn = document.getElementById("scrollToTop");
  window.addEventListener("scroll", () => {
    if (!scrollBtn) return;
    scrollBtn.classList.toggle("visible", window.scrollY > 600);
  });
  if (scrollBtn) {
    scrollBtn.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
  }

  /* =========================
     COUNTERS (Calificaciones)
     ========================= */
  const counters = document.querySelectorAll(".counter");
  const counterObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        const target = parseFloat(el.dataset.target || "0");
        const decimals = parseInt(el.dataset.decimals || "0", 10);
        const duration = 900;
        const start = performance.now();

        function tick(t) {
          const p = Math.min(1, (t - start) / duration);
          const val = target * p;
          el.textContent = val.toFixed(decimals);
          if (p < 1) requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
        counterObserver.unobserve(el);
      });
    },
    { threshold: 0.35 }
  );

  counters.forEach((c) => counterObserver.observe(c));

  /* =========================
     LIGHTBOX (Swiper) - FIX bug mobile + X izquierda
     ========================= */
  const cabinImages = {
    c1: ["img/foto1.jpg", "img/foto2.jpg", "img/foto3.jpg", "img/foto4.jpg"],
    c2: ["img/foto5.jpg", "img/foto6.jpg", "img/foto7.jpg", "img/foto8.jpg"],
    c3: ["img/foto9.jpg", "img/foto10.jpg", "img/foto11.jpg", "img/foto12.jpg"],
    c4: ["img/foto13.jpg", "img/foto12.jpg", "img/foto11.jpg", "img/foto10.jpg"]
  };

  let lightboxSwiper = null;

  const lb = document.getElementById("lightbox");
  const wrapper = document.getElementById("lightbox-swiper-wrapper");
  const closeBtn = document.getElementById("closeLightboxBtn");
  const swiperEl = document.getElementById("lightboxSwiper");

  function openLightbox(cabinKey) {
    const key = cabinKey && cabinImages[cabinKey] ? cabinKey : "c1";
    if (!lb || !wrapper || !swiperEl) return;

    wrapper.innerHTML = "";

    cabinImages[key].forEach((src, idx) => {
      const slide = document.createElement("div");
      slide.className = "swiper-slide";
      slide.innerHTML = `<img src="${src}" alt="Foto ${idx + 1}" loading="eager" decoding="async" />`;
      wrapper.appendChild(slide);
    });

    lb.classList.remove("closing");
    lb.classList.add("active");
    lb.setAttribute("aria-hidden", "false");
    document.body.classList.add("no-scroll");

    if (lightboxSwiper) {
      lightboxSwiper.destroy(true, true);
      lightboxSwiper = null;
    }

    // Inicializa Swiper luego de mostrar (evita bugs de layout)
    requestAnimationFrame(() => {
      lightboxSwiper = new Swiper(swiperEl, {
        loop: false,
        rewind: true,
        slidesPerView: 1,
        spaceBetween: 0,
        watchOverflow: true,
        observer: true,
        observeParents: true,
        pagination: { el: lb.querySelector(".swiper-pagination"), clickable: true },
        navigation: {
          nextEl: lb.querySelector(".swiper-button-next"),
          prevEl: lb.querySelector(".swiper-button-prev")
        },
        keyboard: { enabled: true },
        touchStartPreventDefault: false
      });
      lightboxSwiper.update();
    });

    closeBtn?.focus({ preventScroll: true });
  }

  // Cierre con transición para evitar “click-through” en móvil
  function closeLightboxSafe() {
    if (!lb) return;

    // Mantener overlay un instante para que el tap no caiga en el menú
    lb.classList.add("closing");
    lb.classList.remove("active");
    lb.setAttribute("aria-hidden", "true");

    setTimeout(() => {
      document.body.classList.remove("no-scroll");

      if (lightboxSwiper) {
        lightboxSwiper.destroy(true, true);
        lightboxSwiper = null;
      }
      if (wrapper) wrapper.innerHTML = "";

      lb.classList.remove("closing");
      // display none lo maneja CSS al no estar active/closing
    }, 170);
  }

  // Abrir lightbox
  document.querySelectorAll("[data-open-lightbox]").forEach((btn) => {
    btn.addEventListener("click", () => openLightbox(btn.getAttribute("data-open-lightbox")));
  });

  // Close btn: evitar que el tap genere click en el menú debajo (mobile)
  if (closeBtn) {
    closeBtn.addEventListener("touchstart", (e) => {
      e.preventDefault();
      e.stopPropagation();
    }, { passive: false });

    closeBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      closeLightboxSafe();
    });
  }

  // clic afuera: cierra
  document.addEventListener(
    "click",
    (e) => {
      if (e.target === lb) closeLightboxSafe();
    },
    true
  );

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeLightboxSafe();
  });
});
