/*
 * Cookie consent banner + Google Analytics 4 loader (no dependencies).
 *
 * What it does
 *   - Shows a bottom banner on the first visit with "Rechazar", "Configurar" and "Aceptar".
 *     "Aceptar" and "Rechazar" share the same style, as the AEPD guide requires.
 *   - Loads Google Analytics ONLY after the visitor accepts analytics. Before that,
 *     window.gtag does not exist, so calls like `if (window.gtag) gtag('event', ...)` do nothing.
 *   - Saves the choice in localStorage (CONFIG.storageKey) with a version and a timestamp,
 *     and asks again after CONFIG.maxAgeDays or when CONFIG.version changes.
 *   - Exposes window.mblConsent.open() to reopen the settings. Any element with the
 *     attribute data-consent-open (e.g. a "Configurar cookies" footer link) opens them too.
 *
 * How to reuse it on another website (Intrans, Los Candiles, Dysa...)
 *   1. Copy this file to the site (for example /assets/consent.js).
 *   2. Edit only the CONFIG block below: GA id, policy URL, colours and texts.
 *      Change `storageKey` if two sites could share a domain. Bump `version` when the
 *      cookies in use change, so every visitor is asked again.
 *   3. Remove the site's hard-coded gtag.js <script> tags and add, in every page:
 *        <script src="/assets/consent.js" defer></script>
 *   4. Add a footer link: <a href="#" data-consent-open>Configurar cookies</a>
 *   5. Publish a cookie policy page at CONFIG.policyUrl that lists the cookies.
 *   If the site has no Google Analytics, set gaId to '' and the banner will not be shown.
 */
(function () {
  'use strict';

  var CONFIG = {
    gaId: 'G-HW3J0Y50KV',
    storageKey: 'mbl-consent',
    version: 1,
    maxAgeDays: 365, // 12 months
    policyUrl: 'https://mblcorporacion.es/cookies/',
    colors: {
      brand: '#2BB3A3',       // buttons
      brandText: '#03201C',   // text on the buttons
      background: '#0C121A',
      text: '#F2F6F7',
      muted: '#AEBBC6',
      line: 'rgba(255, 255, 255, .14)'
    },
    texts: {
      title: 'Cookies',
      message: 'Usamos almacenamiento técnico para recordar tu elección y, solo si nos das permiso, cookies de Google Analytics para saber cuántas personas visitan la web y qué páginas les interesan.',
      policyLink: 'Política de cookies',
      accept: 'Aceptar',
      reject: 'Rechazar',
      configure: 'Configurar',
      save: 'Guardar selección',
      technicalTitle: 'Técnicas (siempre activas)',
      technicalDesc: 'Guardan tu elección sobre las cookies. Sin ellas la web no puede recordarla.',
      analyticsTitle: 'Analítica (Google Analytics)',
      analyticsDesc: 'Nos dicen, de forma agregada, cuántas visitas recibimos, de dónde llegan y qué páginas se ven. Solo se activan si las aceptas.',
      dialogLabel: 'Preferencias de cookies'
    }
  };

  var state = null; // { v, ts, analytics }
  var gaLoaded = false;
  var root = null;

  function readChoice() {
    try {
      var raw = window.localStorage.getItem(CONFIG.storageKey);
      if (!raw) return null;
      var data = JSON.parse(raw);
      if (!data || data.v !== CONFIG.version || typeof data.ts !== 'number') return null;
      if (Date.now() - data.ts > CONFIG.maxAgeDays * 864e5) return null;
      return { v: data.v, ts: data.ts, analytics: data.analytics === true };
    } catch (e) {
      return null;
    }
  }

  function saveChoice(analytics) {
    state = { v: CONFIG.version, ts: Date.now(), analytics: analytics === true };
    try {
      window.localStorage.setItem(CONFIG.storageKey, JSON.stringify(state));
    } catch (e) { /* storage blocked: the choice applies to this page view only */ }
  }

  function loadAnalytics() {
    if (!CONFIG.gaId) return;
    window['ga-disable-' + CONFIG.gaId] = false;
    if (gaLoaded) return;
    gaLoaded = true;
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag('js', new Date());
    window.gtag('config', CONFIG.gaId);
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(CONFIG.gaId);
    document.head.appendChild(s);
  }

  // Consent withdrawn after accepting: stop sending hits and remove the _ga cookies.
  function stopAnalytics() {
    if (!CONFIG.gaId) return;
    window['ga-disable-' + CONFIG.gaId] = true;
    var names = document.cookie.split(';').map(function (c) { return c.split('=')[0].trim(); })
      .filter(function (n) { return n === '_ga' || n.indexOf('_ga_') === 0 || n === '_gid' || n === '_gat'; });
    var parts = location.hostname.split('.');
    var domains = [''];
    for (var i = 0; i < parts.length - 1; i++) domains.push('; domain=.' + parts.slice(i).join('.'));
    names.forEach(function (n) {
      domains.forEach(function (d) {
        document.cookie = n + '=; Max-Age=0; path=/' + d;
      });
    });
  }

  function apply() {
    if (state && state.analytics) loadAnalytics();
    else if (gaLoaded) stopAnalytics();
  }

  function css() {
    var c = CONFIG.colors;
    return '' +
      '.mblc{position:fixed;left:12px;right:12px;bottom:12px;z-index:2147483000;display:flex;justify-content:center;pointer-events:none;font-family:inherit}' +
      '.mblc[hidden]{display:none}' +
      '.mblc-box{pointer-events:auto;width:100%;max-width:720px;background:' + c.background + ';color:' + c.text + ';border:1px solid ' + c.line + ';border-radius:16px;box-shadow:0 20px 60px -20px rgba(0,0,0,.6);padding:18px 20px;font-size:14px;line-height:1.55;max-height:calc(100vh - 24px);overflow:auto}' +
      '.mblc-title{font-weight:700;font-size:15px;margin:0 0 6px}' +
      '.mblc-msg{margin:0;color:' + c.muted + '}' +
      '.mblc-msg a{color:' + c.text + ';text-decoration:underline;text-underline-offset:2px}' +
      '.mblc-panel{margin:14px 0 0;display:grid;gap:10px}' +
      '.mblc-panel[hidden]{display:none}' +
      '.mblc-opt{display:flex;gap:12px;align-items:flex-start;padding:12px;border:1px solid ' + c.line + ';border-radius:12px}' +
      '.mblc-opt input{flex:none;width:18px;height:18px;margin-top:3px;accent-color:' + c.brand + '}' +
      '.mblc-opt b{display:block;font-weight:600;color:' + c.text + '}' +
      '.mblc-opt span{display:block;color:' + c.muted + ';font-size:13px}' +
      '.mblc-actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:14px;align-items:center}' +
      '.mblc-btn{font:inherit;font-weight:600;font-size:14px;cursor:pointer;border-radius:999px;padding:10px 20px;min-width:120px;border:1px solid ' + c.brand + ';background:' + c.brand + ';color:' + c.brandText + '}' +
      '.mblc-btn:focus-visible,.mblc-link:focus-visible{outline:2px solid ' + c.text + ';outline-offset:2px}' +
      '.mblc-link{font:inherit;font-size:14px;cursor:pointer;background:none;border:0;color:' + c.text + ';text-decoration:underline;text-underline-offset:2px;padding:10px 4px}' +
      '.mblc-save[hidden]{display:none}' +
      '@media (max-width:560px){.mblc{left:8px;right:8px;bottom:8px}.mblc-box{padding:16px}.mblc-btn{flex:1 1 40%}.mblc-link{flex:1 1 100%;text-align:center;padding:6px}}';
  }

  function build() {
    var t = CONFIG.texts;
    var style = document.createElement('style');
    style.id = 'mblc-style';
    style.textContent = css();
    document.head.appendChild(style);

    root = document.createElement('div');
    root.className = 'mblc';
    root.hidden = true;
    root.innerHTML =
      '<div class="mblc-box" role="dialog" aria-modal="false" aria-labelledby="mblc-title" aria-describedby="mblc-msg">' +
        '<p class="mblc-title" id="mblc-title">' + t.title + '</p>' +
        '<p class="mblc-msg" id="mblc-msg">' + t.message + ' <a href="' + CONFIG.policyUrl + '">' + t.policyLink + '</a>.</p>' +
        '<div class="mblc-panel" hidden>' +
          '<label class="mblc-opt"><input type="checkbox" checked disabled><span><b>' + t.technicalTitle + '</b><span>' + t.technicalDesc + '</span></span></label>' +
          '<label class="mblc-opt"><input type="checkbox" data-mblc="analytics"><span><b>' + t.analyticsTitle + '</b><span>' + t.analyticsDesc + '</span></span></label>' +
        '</div>' +
        '<div class="mblc-actions">' +
          '<button type="button" class="mblc-btn" data-mblc="reject">' + t.reject + '</button>' +
          '<button type="button" class="mblc-btn" data-mblc="accept">' + t.accept + '</button>' +
          '<button type="button" class="mblc-link" data-mblc="configure">' + t.configure + '</button>' +
          '<button type="button" class="mblc-link mblc-save" data-mblc="save" hidden>' + t.save + '</button>' +
        '</div>' +
      '</div>';
    root.setAttribute('aria-label', t.dialogLabel);
    document.body.appendChild(root);

    root.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-mblc]');
      if (!btn) return;
      var action = btn.getAttribute('data-mblc');
      if (action === 'accept') choose(true);
      else if (action === 'reject') choose(false);
      else if (action === 'configure') showPanel(true);
      else if (action === 'save') choose(root.querySelector('[data-mblc="analytics"]').checked);
    });
  }

  function showPanel(open) {
    root.querySelector('.mblc-panel').hidden = !open;
    root.querySelector('[data-mblc="configure"]').hidden = open;
    root.querySelector('[data-mblc="save"]').hidden = !open;
    root.querySelector('[data-mblc="analytics"]').checked = !!(state && state.analytics);
  }

  function show(withPanel) {
    if (!root) build();
    showPanel(!!withPanel);
    root.hidden = false;
  }

  function hide() {
    if (root) root.hidden = true;
  }

  function choose(analytics) {
    saveChoice(analytics);
    apply();
    hide();
  }

  function open() {
    show(true);
    var first = root.querySelector('[data-mblc="analytics"]');
    if (first) first.focus();
  }

  window.mblConsent = {
    open: open,
    get: function () { return state ? { analytics: state.analytics, date: new Date(state.ts) } : null; }
  };

  document.addEventListener('click', function (e) {
    var trigger = e.target.closest && e.target.closest('[data-consent-open]');
    if (!trigger) return;
    e.preventDefault();
    window.mblConsent.open();
  });

  function init() {
    if (!CONFIG.gaId) return; // nothing that needs consent
    state = readChoice();
    if (state) apply();
    else show(false);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
