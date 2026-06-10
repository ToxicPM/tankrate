/**
 * TankRate — main.js
 * Core: consent, geo, data fetch, render, country switcher, dark mode, unit toggle
 */

(function () {
  "use strict";

  /* ============================================================
     CONFIG — replace these with your real Supabase project values
     ============================================================ */
  const SUPABASE_URL = "https://lmfnrqmxocnpebmkbahb.supabase.co";
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxtZm5ycW14b2NucGVibWtiYWhiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEwOTIyMzEsImV4cCI6MjA5NjY2ODIzMX0.H-QjCTBAZv_e7-bSfpLKJLcJLACvPWH5f7sOg1C0pNk";
  const ADSENSE_CLIENT = "ca-pub-XXXXXXXXXXXXXXXX";

  /* ============================================================
     STEP 0 — Apply stored preferences IMMEDIATELY (in <head> script)
     The inline script in index.html handles this on first load.
     This module uses the same values.
     ============================================================ */
  const __dark = localStorage.getItem("darkMode") === "true";
  if (__dark) document.documentElement.classList.add("dark");

  const __unit = localStorage.getItem("fuelUnit") || "litre";
  const __consent = (() => {
    try {
      const raw = localStorage.getItem("cookieConsent");
      if (!raw) return null;
      const c = JSON.parse(raw);
      if (Date.now() > c.expiry) {
        localStorage.removeItem("cookieConsent");
        return null;
      }
      return c.status;
    } catch {
      return null;
    }
  })();

  /* ============================================================
     DOM HELPERS
     ============================================================ */
  const qs  = (sel, ctx = document) => ctx.querySelector(sel);
  const qsa = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

  function setText(id, text) {
    const el = qs(`#${id}`);
    if (el) el.textContent = text;
  }
  function setHtml(id, html) {
    const el = qs(`#${id}`);
    if (el) el.innerHTML = html;
  }
  function show(id)  { const el = qs(`#${id}`);  if (el) el.style.display = ""; }
  function hide(id)  { const el = qs(`#${id}`);  if (el) el.style.display = "none"; }

  /* ============================================================
     SKELETON / ERROR HELPERS
     ============================================================ */
  function showSkeleton(id, height) {
    const el = qs(`#${id}`);
    if (!el) return;
    el.innerHTML = `<div class="skeleton" style="height:${height}px"></div>`;
  }
  function showError(id, msg, retryFn) {
    const el = qs(`#${id}`);
    if (!el) return;
    el.innerHTML = `
      <div class="error-state">
        <span>⚠ ${msg}</span>
        <button onclick="(${retryFn.toString()})()">Retry</button>
      </div>`;
  }

  /* ============================================================
     TOAST
     ============================================================ */
  let toastTimer = null;
  function showToast(msg) {
    let t = qs(".toast");
    if (!t) {
      t = document.createElement("div");
      t.className = "toast";
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.classList.add("visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove("visible"), 3000);
  }

  /* ============================================================
     COOKIE CONSENT
     ============================================================ */
  function checkConsent() { return __consent; }

  function showBanner() {
    const banner = qs(".cookie-banner");
    if (!banner) return;
    const expired = localStorage.getItem("cookieConsent") !== null &&
                    checkConsent() === null;
    const p = banner.querySelector("p");
    if (expired && p) {
      p.innerHTML = 'Your previous cookie preferences have expired. Please choose again. <a href="/privacy-policy/">Learn more</a>';
    }
    banner.classList.add("visible");
  }

  function hideBanner() {
    qsa(".cookie-banner").forEach(b => b.classList.remove("visible"));
  }

  function initConsent() {
    const banner = qs(".cookie-banner");
    if (!banner) return;
    if (checkConsent() !== null) {
      hideBanner();
      if (checkConsent() === "accepted") loadAdSense();
      return;
    }
    showBanner();
    const acceptBtn = banner.querySelector(".btn-accept");
    const rejectBtn = banner.querySelector(".btn-reject");
    if (acceptBtn) {
      acceptBtn.addEventListener("click", () => {
        localStorage.setItem("cookieConsent", JSON.stringify({
          status: "accepted", timestamp: Date.now(),
          expiry: Date.now() + 30 * 24 * 60 * 60 * 1000
        }));
        hideBanner();
        loadAdSense();
      });
    }
    if (rejectBtn) {
      rejectBtn.addEventListener("click", () => {
        localStorage.setItem("cookieConsent", JSON.stringify({
          status: "rejected", timestamp: Date.now(),
          expiry: Date.now() + 30 * 24 * 60 * 60 * 1000
        }));
        hideBanner();
      });
    }
  }

  /* ============================================================
     COOKIE SETTINGS (footer link)
     ============================================================ */
  document.addEventListener("click", (e) => {
    const link = e.target.closest("[data-cookie-settings]");
    if (!link) return;
    e.preventDefault();
    localStorage.removeItem("cookieConsent");
    showBanner();
  });

  /* ============================================================
     DARK MODE
     ============================================================ */
  function initDarkMode() {
    qsa(".dark-toggle").forEach((btn) => {
      btn.addEventListener("click", () => {
        const on = document.documentElement.classList.toggle("dark");
        localStorage.setItem("darkMode", String(on));
        btn.setAttribute("aria-label", on ? "Light mode" : "Dark mode");
        btn.textContent = on ? "☀️" : "🌙";
      });
    });
  }

  /* ============================================================
     MOBILE MENU
     ============================================================ */
  function initMobileMenu() {
    const btn = qs("#hamburger-btn");
    const close = qs("#mobile-nav-close");
    const nav = qs("#mobile-nav");
    if (!btn || !nav) return;
    btn.addEventListener("click", () => {
      nav.classList.add("open");
      btn.setAttribute("aria-expanded", "true");
    });
    if (close) {
      close.addEventListener("click", () => {
        nav.classList.remove("open");
        btn.setAttribute("aria-expanded", "false");
      });
    }
    qsa(".mobile-nav a").forEach(a => {
      a.addEventListener("click", () => {
        nav.classList.remove("open");
        btn.setAttribute("aria-expanded", "false");
      });
    });
  }

  /* ============================================================
     COUNTRY DROPDOWN (header button)
     ============================================================ */
  function initCountryDropdown() {
    const btn = qs("#header-country-btn");
    const menu = qs("#country-menu");
    if (!btn || !menu) return;
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const open = menu.classList.toggle("open");
      btn.setAttribute("aria-expanded", String(open));
    });
    document.addEventListener("click", () => {
      menu.classList.remove("open");
      btn.setAttribute("aria-expanded", "false");
    });
  }

  /* ============================================================
     ADSENSE
     ============================================================ */
  function loadAdSense() {
    if (checkConsent() !== "accepted") return;
    if (document.querySelector('script[data-ad-client]')) {
      qsa(".adsbygoogle").forEach(() => {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
      });
      return;
    }
    const s = document.createElement("script");
    s.src = "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js";
    s.setAttribute("data-ad-client", ADSENSE_CLIENT);
    s.async = true;
    document.head.appendChild(s);
  }

  /* ============================================================
     GEOLOCATION
     ============================================================ */
  function getSavedCountry() {
    return localStorage.getItem("userCountry");
  }
  function getSavedGeo() {
    try { return JSON.parse(localStorage.getItem("userGeo")); } catch { return null; }
  }

  async function detectCountry() {
    const saved = getSavedCountry();
    if (saved) {
      window.__country = saved;
      window.__geo = getSavedGeo();
      return saved;
    }
    if (checkConsent() !== "accepted") return "GB";
    try {
      const res = await fetch("https://ipapi.co/json/");
      if (!res.ok) throw new Error();
      const geo = await res.json();
      window.__country = geo.country_code;
      window.__geo = geo;
      localStorage.setItem("userCountry", geo.country_code);
      localStorage.setItem("userGeo", JSON.stringify(geo));
      return geo.country_code;
    } catch {
      window.__country = "GB";
      window.__geo = null;
      return "GB";
    }
  }

  /* ============================================================
     API FETCH HELPERS
     ============================================================ */
  async function apiFetch(path) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const res = await fetch(`${SUPABASE_URL}${path}`, {
        headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (!res.ok) throw new Error(`API ${res.status}`);
      return res.json();
    } catch (err) {
      clearTimeout(timeout);
      if (err.name === 'AbortError') throw new Error('Request timed out');
      throw err;
    }
  }

  /* ============================================================
     RENDER HELPERS
     ============================================================ */
  async function populateCountryDropdown(selectedCode) {
    const sel = qs("#country-select");
    if (!sel) return;
    try {
      const data = await fetch("https://openvan.camp/api/fuel/prices").then(r => r.json());
      if (!data.success || !data.data) return;
      const countries = Object.entries(data.data)
        .map(([code, info]) => ({ code: code.toUpperCase(), name: info.country_name || code }))
        .sort((a, b) => a.name.localeCompare(b.name));
      sel.innerHTML = '<option value="">Change country</option>' +
        countries.map(c => `<option value="${c.code}" ${c.code === selectedCode ? 'selected' : ''}>${c.code} — ${c.name}</option>`).join("");
    } catch { /* silent */ }
  }

  function renderCountryBanner(cc, countryName) {
    const flag = getFlagEmoji(cc);
    const banner = qs(".geo-banner");
    if (!banner) return;
    banner.innerHTML = `
      <span class="flag">${flag}</span>
      <span class="geo-text">Showing prices for ${countryName}</span>
      <select id="country-select" aria-label="Select country">
        <option value="">Change country</option>
      </select>`;
    const sel = qs("#country-select");
    if (sel) {
      sel.addEventListener("change", () => {
        if (sel.value) switchCountry(sel.value);
      });
    }
    populateCountryDropdown(cc);
  }

  function getFlagEmoji(cc) {
    const flags = {
      GB:"🇬🇧",US:"🇺🇸",DE:"🇩🇪",FR:"🇫🇷",IT:"🇮🇹",ES:"🇪🇸",NL:"🇳🇱",
      BE:"🇧🇪",AT:"🇦🇹",CH:"🇨🇭",PT:"🇵🇹",IE:"🇮🇪",SE:"🇸🇪",NO:"🇳🇴",
      DK:"🇩🇰",FI:"🇫🇮",PL:"🇵🇱",AU:"🇦🇺",NZ:"🇳🇿",CA:"🇨🇦",ZA:"🇿🇦",
      IN:"🇮🇳",JP:"🇯🇵",BR:"🇧🇷",MX:"🇲🇽"
    };
    return flags[cc] || cc.toUpperCase();
  }

  function getSymbolForCurrency(code) {
    const map = {
      GBP:"£",USD:"$",EUR:"€",CHF:"Fr",SEK:"kr",NOK:"kr",DKK:"kr",
      PLN:"zł",CZK:"Kč",HUF:"Ft",RON:"lei",AUD:"A$",NZD:"NZ$",
      CAD:"C$",MXN:"Mex$",BRL:"R$",ZAR:"R",INR:"₹",JPY:"¥",KRW:"₩",SGD:"S$",TRY:"₺"
    };
    return map[code] || code;
  }

  function convertPrice(priceLitre, unit) {
    if (unit === "gallon") {
      const g = window.__geo;
      if (g && g.country_code === "US") return priceLitre * 3.78541;
      return priceLitre * 4.54609;
    }
    return priceLitre;
  }

  function renderStatCards(prices, currency, symbol, unit) {
    const fuels = [
      { key: "petrol", label: "PETROL", cls: "petrol" },
      { key: "diesel", label: "DIESEL", cls: "diesel" },
      { key: "lpg",    label: "LPG",    cls: "lpg" }
    ];
    const container = qs("#stat-cards");
    if (!container) return;
    container.innerHTML = fuels.map(f => {
      const p = prices[f.key];
      if (!p) return `<div class="stat-card"><div class="fuel-label ${f.cls}">${f.label}</div><div class="price">—</div></div>`;
      const display = convertPrice(p.price, unit);
      const change = window.__weekChange?.[f.key] ?? 0;
      const arrow = change > 0 ? "▲" : change < 0 ? "▼" : "—";
      const cls = change > 0 ? "up" : change < 0 ? "down" : "neutral";
      return `
        <div class="stat-card">
          <div class="fuel-label ${f.cls}">${f.label}</div>
          <div class="price">${symbol}${display.toFixed(2)}</div>
          <div class="unit">per ${unit}</div>
          <div class="change ${cls}">${arrow} ${Math.abs(change).toFixed(1)}p</div>
        </div>`;
    }).join("");
  }

  function renderTable(data, fuelKey) {
    const container = qs("#region-table-body");
    if (!container) return;
    if (!data || !data.regions || data.regions.length === 0) {
      container.innerHTML = `<tr><td colspan="5" class="no-data">Regional breakdown not available for this country yet.</td></tr>`;
      return;
    }
    const unit = window.__unit || "litre";
    const symbol = data.symbol || "";
    let rows = data.regions.map(r => {
      const p = convertPrice(r.petrol ?? 0, unit);
      const d = convertPrice(r.diesel ?? 0, unit);
      const l = convertPrice(r.lpg ?? 0, unit);
      const prices = [p, d, l].filter(v => v > 0);
      const min = prices.length ? Math.min(...prices) : Infinity;
      return { name: r.name, petrol: p, diesel: d, lpg: l, min };
    });
    container.innerHTML = rows.map(r => `
      <tr class="${r.min !== Infinity ? 'cheapest' : ''}">
        <td>${r.name}</td>
        <td>${r.petrol ? symbol + r.petrol.toFixed(2) : '—'}</td>
        <td>${r.diesel ? symbol + r.diesel.toFixed(2) : '—'}</td>
        <td>${r.lpg ? symbol + r.lpg.toFixed(2) : '—'}</td>
        <td>${r.min !== Infinity ? 'Cheapest ' + ['petrol','diesel','lpg'][[r.petrol,r.diesel,r.lpg].indexOf(r.min)] : '—'}</td>
      </tr>
    `).join("");
  }

  let sortDir = {};
  function makeSortable(tableId) {
    const table = qs(`#${tableId}`);
    if (!table) return;
    qsa("th[data-sort]", table).forEach(th => {
      th.addEventListener("click", () => {
        const key = th.dataset.sort;
        sortDir[key] = !sortDir[key];
        const tbody = qs(`#${tableId} tbody`);
        if (!tbody) return;
        const rows = [...tbody.querySelectorAll("tr")];
        rows.sort((a, b) => {
          const av = parseFloat(a.querySelector(`[data-val="${key}"]`)?.textContent || "0");
          const bv = parseFloat(b.querySelector(`[data-val="${key}"]`)?.textContent || "0");
          return sortDir[key] ? av - bv : bv - av;
        });
        rows.forEach(r => tbody.appendChild(r));
      });
    });
  }

  function renderNews(articles) {
    const container = qs("#news-grid");
    if (!container) return;
    if (!articles || articles.length === 0) {
      container.innerHTML = `<p class="text-muted">No news available right now.</p>`;
      return;
    }
    container.innerHTML = articles.slice(0, 6).map(a => `
      <article class="news-card">
        ${a.image_url
          ? `<img src="${a.image_url}" alt="" loading="lazy" width="400" height="180">`
          : `<div class="news-placeholder-img">⛽</div>`}
        <div class="news-body">
          <div class="news-source">${a.source}</div>
          <h3 class="news-title"><a href="${a.url}" target="_blank" rel="noopener">${a.title}</a></h3>
          <p class="news-desc">${a.description || ''}</p>
          <a href="${a.url}" target="_blank" rel="noopener" class="news-link">Read more →</a>
        </div>
      </article>
    `).join("");
  }

  function renderWeather(data) {
    const container = qs("#weather-widget");
    if (!container) return;
    if (!data || data.description === "unavailable") {
      container.innerHTML = `<p class="text-muted">Weather data unavailable.</p>`;
      return;
    }
    container.innerHTML = `
      <h3>Driving conditions</h3>
      <div class="weather-main">
        <span class="weather-icon">${getWeatherEmoji(data.icon)}</span>
        <span class="weather-temp">${data.temperature ?? '—'}°C</span>
      </div>
      <p class="mb-1" style="text-transform:capitalize">${data.description}</p>
      <div class="weather-details">
        <span>💧 Humidity: ${data.humidity ?? '—'}%</span>
        <span>🌬 Wind: ${data.wind_speed ?? '—'} m/s</span>
      </div>`;
  }

  function getWeatherEmoji(icon) {
    const map = { "01d":"☀️","01n":"🌙","02d":"⛅","02n":"☁️","03d":"☁️","03n":"☁️",
      "04d":"☁️","04n":"☁️","09d":"🌧","09n":"🌧","10d":"🌦","10n":"🌧",
      "11d":"⛈","11n":"⛈","13d":"❄️","13n":"❄️","50d":"🌫","50n":"🌫" };
    return map[icon] || "🌡";
  }

  /* ============================================================
     DATA FETCH ORCHESTRATOR
     ============================================================ */
  async function loadPageData(country) {
    try {
      const [prices, history, news, currency] = await Promise.all([
        apiFetch(`/functions/v1/prices?country=${country}`),
        apiFetch(`/functions/v1/history?country=${country}&days=30`),
        apiFetch(`/functions/v1/news?country=${country}`),
        apiFetch(`/functions/v1/currency`)
      ]);
      console.log("TankRate data loaded for", country);

      window.__pricesData = prices;
      window.__historyData = history;
      window.__newsData = news;
      window.__currencyData = currency;
      window.__unit = localStorage.getItem("fuelUnit") || (prices.unit_default || "litre");
      window.__weekChange = prices.week_change || {};

      renderAll(prices, history, news, currency);
    } catch (err) {
      console.error("loadPageData:", err);
      const overlay = qs("#skeleton-overlay");
      if (overlay) {
        overlay.innerHTML = `<div class="error-state" style="padding:2rem"><span>⚠ Could not load data: ${err.message}</span><br><button onclick="location.reload()" class="btn btn-primary" style="margin-top:1rem">Retry</button></div>`;
      }
      hide("main-content");
    }
  }

  function renderAll(prices, history, news, currency) {
    const cc = prices.country_code;
    const name = prices.country_name;
    const symbol = prices.symbol;
    const unit = window.__unit || prices.unit_default || "litre";

    document.title = `${name} Fuel Prices — Petrol, Diesel & LPG | TankRate`;
    const metaDesc = qs('meta[name="description"]');
    if (metaDesc) metaDesc.content = `Live ${name} petrol, diesel and LPG prices updated every 6 hours. Track price trends and find the cheapest fuel near you.`;

    renderCountryBanner(cc, name);
    renderStatCards(prices.prices, prices.currency, symbol, unit);
    renderTable(prices, "petrol");
    renderNews(news);

    if (typeof renderChart === "function" && history) renderChart(history);
    if (typeof renderFAQ === "function") renderFAQ(name);
    if (typeof renderBlog === "function") renderBlog();

    const weatherWidget = qs("#weather-widget");
    if (checkConsent() === "accepted" && window.__geo?.latitude && window.__geo?.longitude) {
      loadWeather(window.__geo.latitude, window.__geo.longitude);
    } else if (weatherWidget) {
      weatherWidget.innerHTML = `<p class="text-muted" style="font-size:var(--text-sm)">🌍 Enable location in cookie settings to see local driving conditions.</p>`;
    }

    if (typeof initCalculator === "function" && prices.prices) {
      initCalculator(prices);
    }

    if (typeof renderSignup === "function") renderSignup(name);

    hide("skeleton-overlay");
    show("main-content");
  }

  async function loadWeather(lat, lon) {
    try {
      const data = await apiFetch(`/functions/v1/weather?lat=${lat}&lon=${lon}`);
      renderWeather(data);
    } catch { /* silent */ }
  }

  /* ============================================================
     COUNTRY SWITCHER
     ============================================================ */
  async function switchCountry(code) {
    window.__country = code;
    localStorage.setItem("userCountry", code);
    show("skeleton-overlay");
    hide("main-content");
    await loadPageData(code);
    showToast(`Now showing prices for ${getFlagEmoji(code)} ${code}`);
  }

  /* ============================================================
     FAQ
     ============================================================ */
  function renderFAQ(country) {
    const container = qs("#faq-list");
    if (!container) return;
    const questions = [
      { q: `Why are fuel prices rising in ${country}?`, a: "Fuel prices in " + country + " are influenced by global crude oil prices, exchange rates, government taxation, refining costs, and seasonal demand. Geopolitical events and supply chain disruptions also play a significant role in price movements." },
      { q: `Where is the cheapest petrol near me in ${country}?`, a: "Use the regional price table above to find the cheapest stations in your area. Supermarket forecourts and independent retailers typically offer the lowest prices. Prices can vary by up to 10p per litre within the same city." },
      { q: "What is the difference between E5 and E10 petrol?", a: "E5 contains up to 5% bioethanol and is compatible with all petrol vehicles. E10 contains up to 10% bioethanol and is the standard grade in most countries. E10 has slightly lower energy content (around 3-4% less) which may reduce fuel economy. Check your vehicle manual for compatibility." },
      { q: "Will diesel prices fall in 2026?", a: "Diesel prices are harder to predict due to higher production costs and lower demand in some markets. However, as refineries adjust output and global diesel demand stabilises, modest price relief is possible. Monitor weekly trends using our price history chart." },
      { q: "Is LPG cheaper than petrol to run?", a: "Yes, LPG is typically 40-50% cheaper per litre than petrol. However, you need to consider the upfront conversion cost (£1,500-£3,000), fuel economy (LPG uses ~20% more litres per mile), and your annual mileage to determine payback period, usually 3-6 years." }
    ];
    container.innerHTML = questions.map((item, i) => `
      <div class="faq-item">
        <button class="faq-question" aria-expanded="false">${item.q}</button>
        <div class="faq-answer">${item.a}</div>
      </div>
    `).join("");
    qsa(".faq-question").forEach(btn => {
      btn.addEventListener("click", () => {
        const item = btn.parentElement;
        const open = item.classList.toggle("open");
        btn.setAttribute("aria-expanded", String(open));
      });
    });
  }

  /* ============================================================
     EMAIL SIGNUP
     ============================================================ */
  function renderSignup(country) {
    const form = qs("#signup-form");
    if (!form) return;
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = qs("#signup-email")?.value?.trim();
      const fuels = qsa(".fuel-checkbox:checked").map(cb => cb.value);
      if (!email || fuels.length === 0) return;
      try {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/subscribe`, {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
          body: JSON.stringify({ email, country_code: window.__country, fuel_types: fuels })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Subscription failed");
        hide("signup-form-wrap");
        show("signup-success");
      } catch (err) {
        showToast(err.message || "Subscription failed. Please try again.");
      }
    });
  }

  /* ============================================================
     BLOG RENDER
     ============================================================ */
  function renderBlog() {
    const container = qs("#blog-grid");
    if (!container) return;
    const posts = window.__blogPosts || [];
    if (posts.length === 0) {
      container.innerHTML = `<p class="text-muted">No blog posts available.</p>`;
      return;
    }
    container.innerHTML = posts.map((post) => `
      <article class="blog-card">
        <div class="news-placeholder-img" style="height:200px">📝</div>
        <div class="blog-card-body">
          <h3><a href="${post.url}">${post.title}</a></h3>
          <p>${post.desc}</p>
          <span class="text-muted" style="font-size:var(--text-xs)">${post.date}</span>
        </div>
      </article>
    `).join("");
  }

  /* ============================================================
     EXPORT FOR OTHER MODULES
     ============================================================ */
  window.FW = {
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    ADSENSE_CLIENT,
    qs,
    qsa,
    setText,
    setHtml,
    show,
    hide,
    checkConsent,
    loadAdSense,
    detectCountry,
    loadPageData,
    switchCountry,
    renderAll,
    convertPrice,
    getSymbolForCurrency,
    getFlagEmoji,
    showToast,
    __unit: () => window.__unit,
  };

  /* ============================================================
     INIT ON DOM READY
     ============================================================ */
  function boot() {
    initConsent();
    initDarkMode();
    initUnitToggle();
    initMobileMenu();
    initCountryDropdown();

    const country = getSavedCountry() || "GB";
    const geo = getSavedGeo();
    if (geo?.country_code) {
      window.__country = geo.country_code;
    }

    show("skeleton-overlay");
    hide("main-content");
    loadPageData(country);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
