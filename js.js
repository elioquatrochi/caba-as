/* =========================
   HELPERS
   ========================= */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

/* =========================
   HEADER SCROLL EFFECT
   ========================= */
(function headerScroll(){
  const header = $("#header");
  if(!header) return;

  const onScroll = () => {
    if (window.scrollY > 8) header.classList.add("is-scrolled");
    else header.classList.remove("is-scrolled");
  };

  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();
})();

/* =========================
   MOBILE MENU
   ========================= */
(function mobileMenu(){
  const toggle = $("#mobileNavToggle");
  const menu = $("#mobileMenu");
  if(!toggle || !menu) return;

  const setState = (open) => {
    menu.classList.toggle("is-open", open);
    menu.setAttribute("aria-hidden", String(!open));
    toggle.setAttribute("aria-expanded", String(open));
    toggle.innerHTML = open ? '<i class="fas fa-times"></i>' : '<i class="fas fa-bars"></i>';
  };

  toggle.addEventListener("click", () => {
    const open = !menu.classList.contains("is-open");
    setState(open);
  });

  $$(".mobile-link", menu).forEach(a => {
    a.addEventListener("click", () => setState(false));
  });

  document.addEventListener("keydown", (e) => {
    if(e.key === "Escape") setState(false);
  });
})();

/* =========================
   SCROLL TO TOP
   ========================= */
(function scrollTop(){
  const btn = $("#scrollToTop");
  if(!btn) return;

  const onScroll = () => {
    btn.classList.toggle("is-visible", window.scrollY > 500);
  };

  btn.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();
})();

/* =========================
   HERO SWIPER (flechas + autoplay)
   ========================= */
(function heroSwiperInit(){
  const el = $("#heroSwiper");
  if(!el || typeof Swiper === "undefined") return;

  new Swiper("#heroSwiper", {
    loop: true,
    speed: 900,
    effect: "slide",
    autoplay: {
      delay: 3000,
      disableOnInteraction: false,
      pauseOnMouseEnter: true
    },
    pagination: {
      el: ".hero-pagination",
      clickable: true
    },
    navigation: {
      nextEl: ".hero-next",
      prevEl: ".hero-prev"
    },
    keyboard: { enabled: true },
    grabCursor: true
  });
})();

/* =========================
   LIGHTBOX (Swiper)
   ========================= */
(function lightboxInit(){
  const lightbox = $("#lightbox");
  const closeBtn = $("#closeLightboxBtn");
  const wrapper = $("#lightbox-swiper-wrapper");
  if(!lightbox || !closeBtn || !wrapper || typeof Swiper === "undefined") return;

  // Editá estas galerías con tus fotos reales:
  const GALLERIES = {
    c1: ["img/foto1.jpg","img/foto2.jpg","img/foto3.jpg","img/foto4.jpg"],
    c2: ["img/foto5.jpg","img/foto6.jpg","img/foto7.jpg","img/foto8.jpg"],
    c3: ["img/foto9.jpg","img/foto10.jpg","img/foto11.jpg","img/foto12.jpg"],
    c4: ["img/foto13.jpg","img/foto14.jpg","img/foto15.jpg","img/foto16.jpg"]
  };

  let swiper = null;

  const open = (key) => {
    const imgs = GALLERIES[key] || [];
    wrapper.innerHTML = imgs.map(src => `
      <div class="swiper-slide">
        <img src="${src}" alt="Foto de ${key}" loading="lazy" decoding="async">
      </div>
    `).join("");

    lightbox.classList.add("is-open");
    lightbox.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";

    if(swiper){
      swiper.update();
      swiper.slideTo(0, 0);
    } else {
      swiper = new Swiper("#lightboxSwiper", {
        loop: true,
        speed: 650,
        pagination: { el: "#lightboxSwiper .swiper-pagination", clickable: true },
        navigation: {
          nextEl: "#lightboxSwiper .swiper-button-next",
          prevEl: "#lightboxSwiper .swiper-button-prev"
        },
        keyboard: { enabled: true },
        grabCursor: true
      });
    }
  };

  const close = () => {
    lightbox.classList.remove("is-open");
    lightbox.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  };

  // botones "Ver fotos"
  $$("[data-open-lightbox]").forEach(btn => {
    btn.addEventListener("click", () => {
      const key = btn.getAttribute("data-open-lightbox");
      open(key);
    });
  });

  closeBtn.addEventListener("click", close);

  // cerrar tocando el fondo (no el swiper)
  lightbox.addEventListener("click", (e) => {
    if(e.target === lightbox) close();
  });

  document.addEventListener("keydown", (e) => {
    if(e.key === "Escape" && lightbox.classList.contains("is-open")) close();
  });
})();

/* =========================
   REVIEWS: autoplay + flechas (PC) + loop
   ========================= */
(function reviewsCarousel(){
  const track = $("#reviewsTrack");
  const prevBtn = $(".sl-nav-prev");
  const nextBtn = $(".sl-nav-next");
  if(!track || !prevBtn || !nextBtn) return;

  // cantidad a desplazar por click (aprox 1 card)
  const getStep = () => {
    const first = track.querySelector(".sl-review");
    if(!first) return 320;
    const styles = getComputedStyle(track);
    const gap = parseInt(styles.columnGap || styles.gap || "14", 10) || 14;
    return first.getBoundingClientRect().width + gap;
  };

  const scrollByStep = (dir) => {
    const step = getStep() * dir;
    track.scrollBy({ left: step, behavior: "smooth" });
  };

  prevBtn.addEventListener("click", () => scrollByStep(-1));
  nextBtn.addEventListener("click", () => scrollByStep(1));

  // autoplay
  let autoplayId = null;
  const start = () => {
    stop();
    autoplayId = setInterval(() => {
      const max = track.scrollWidth - track.clientWidth;

      // Si está al final, volvemos al inicio (loop)
      if(track.scrollLeft >= max - 8){
        track.scrollTo({ left: 0, behavior: "smooth" });
      } else {
        scrollByStep(1);
      }
    }, 2600);
  };

  const stop = () => {
    if(autoplayId) clearInterval(autoplayId);
    autoplayId = null;
  };

  // pausa al pasar el mouse (PC) y al tocar/arrastrar
  track.addEventListener("mouseenter", stop);
  track.addEventListener("mouseleave", start);

  let isPointerDown = false;
  track.addEventListener("pointerdown", () => { isPointerDown = true; stop(); });
  track.addEventListener("pointerup", () => { isPointerDown = false; start(); });
  track.addEventListener("pointercancel", () => { isPointerDown = false; start(); });

  // arrastre simple (mejor UX en PC)
  let startX = 0;
  let startScroll = 0;

  track.addEventListener("mousedown", (e) => {
    isPointerDown = true;
    startX = e.pageX;
    startScroll = track.scrollLeft;
    track.classList.add("is-dragging");
  });

  window.addEventListener("mouseup", () => {
    if(!isPointerDown) return;
    isPointerDown = false;
    track.classList.remove("is-dragging");
  });

  window.addEventListener("mousemove", (e) => {
    if(!isPointerDown) return;
    const dx = e.pageX - startX;
    track.scrollLeft = startScroll - dx;
  });

  // iniciar autoplay
  start();
})();
