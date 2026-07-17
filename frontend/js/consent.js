/**
 * Cookie Consent + Google Consent Mode v2
 *
 * Load this file synchronously in <head> BEFORE the GTM snippet
 * so that gtag('consent', 'default') fires before GTM initialises.
 *
 * Storage  : first-party cookie  `cookie_consent`
 * Lifetime : 180 days | SameSite=Lax | Secure on HTTPS
 */
(function () {
  'use strict';

  var COOKIE_NAME     = 'cookie_consent';
  var COOKIE_DAYS     = 180;
  var CONSENT_VERSION = 1;

  // ─── dataLayer / gtag ────────────────────────────────────────────────────
  // Must use `var` + arguments trick — no arrow functions allowed here
  // because this script runs before any transpilation/polyfills.
  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }

  // ─── STEP 1: Default denied state ────────────────────────────────────────
  // Runs synchronously before GTM — required by Consent Mode v2.
  gtag('consent', 'default', {
    analytics_storage:       'denied',
    ad_storage:              'denied',
    ad_user_data:            'denied',
    ad_personalization:      'denied',
    functionality_storage:   'granted',
    personalization_storage: 'granted',
    security_storage:        'granted',
    wait_for_update:         500,
  });

  // ─── STEP 2: Restore saved consent immediately ───────────────────────────
  var saved = readCookie();
  if (saved) applyConsent(saved);

  // ─── DOM ready ────────────────────────────────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', onReady);
  } else {
    onReady();
  }

  function onReady() {
    bindSettingsLinks();
    if (!saved) showBanner(null);
  }

  // ─── Cookie helpers ───────────────────────────────────────────────────────

  // Apex domain so the cookie is shared across all *.stapesite.com
  // subdomains (matches the scope used for visitor_id). Left unset on
  // localhost/preview hosts (e.g. *.vercel.app), where Domain=.stapesite.com
  // would not match and the browser would reject the cookie entirely.
  function getCookieDomain() {
    return /(^|\.)stapesite\.com$/.test(location.hostname)
      ? '.stapesite.com'
      : '';
  }

  function writeCookie(prefs) {
    var value  = encodeURIComponent(JSON.stringify(
      Object.assign({}, prefs, { v: CONSENT_VERSION })
    ));
    var maxAge = COOKIE_DAYS * 24 * 60 * 60;
    var secure = location.protocol === 'https:' ? '; Secure' : '';
    var domain = getCookieDomain();
    document.cookie =
      COOKIE_NAME + '=' + value +
      '; Max-Age=' + maxAge +
      '; Path=/' +
      '; SameSite=Lax' +
      (domain ? '; Domain=' + domain : '') +
      secure;
  }

  function readCookie() {
    var pairs = document.cookie.split('; ');
    for (var i = 0; i < pairs.length; i++) {
      if (pairs[i].indexOf(COOKIE_NAME + '=') === 0) {
        try {
          var raw  = pairs[i].slice(COOKIE_NAME.length + 1);
          var data = JSON.parse(decodeURIComponent(raw));
          if (data.v !== CONSENT_VERSION) return null;
          return data;
        } catch (_) {
          return null;
        }
      }
    }
    return null;
  }

  // ─── Google Consent Mode v2 update ───────────────────────────────────────

  function applyConsent(prefs) {
    gtag('consent', 'update', {
      analytics_storage:       prefs.analytics ? 'granted' : 'denied',
      ad_storage:              prefs.marketing ? 'granted' : 'denied',
      ad_user_data:            prefs.marketing ? 'granted' : 'denied',
      ad_personalization:      prefs.marketing ? 'granted' : 'denied',
      functionality_storage:   'granted',
      personalization_storage: 'granted',
    });
    // Custom GTM trigger: fire GA4 / other tags after consent update
    window.dataLayer.push({
      event:              'cookie_consent_update',
      consent_analytics:  !!prefs.analytics,
      consent_marketing:  !!prefs.marketing,
      consent_functional: true,
    });
  }

  // ─── Build banner HTML ────────────────────────────────────────────────────

  function buildBanner(prefill) {
    var a = prefill && prefill.analytics ? 'checked' : '';
    var m = prefill && prefill.marketing ? 'checked' : '';

    var el = document.createElement('div');
    el.id = 'cb';
    el.setAttribute('role',            'dialog');
    el.setAttribute('aria-modal',      'true');
    el.setAttribute('aria-labelledby', 'cb-title');

    el.innerHTML =
      '<div class="cb-card">' +
        '<div class="cb-header">' +
          '<span class="cb-icon" aria-hidden="true">&#x1F36A;</span>' +
          '<h2 class="cb-title" id="cb-title">Cookie Preferences</h2>' +
        '</div>' +
        '<p class="cb-desc">' +
          'We use cookies to improve your experience and to measure website performance.' +
        '</p>' +

        // ── Customize panel (hidden by default) ──
        '<div class="cb-customize" id="cb-customize" hidden>' +

          '<div class="cb-toggle-row">' +
            '<div class="cb-toggle-info">' +
              '<strong>Functional</strong>' +
              '<span>Essential for the website to work properly. Always on.</span>' +
            '</div>' +
            '<label class="cb-switch cb-switch--locked" aria-label="Functional — always enabled">' +
              '<input type="checkbox" checked disabled />' +
              '<span class="cb-slider"></span>' +
            '</label>' +
          '</div>' +

          '<div class="cb-toggle-row">' +
            '<div class="cb-toggle-info">' +
              '<strong>Analytics</strong>' +
              '<span>Help us understand how visitors use the site (GA4).</span>' +
            '</div>' +
            '<label class="cb-switch" aria-label="Analytics cookies">' +
              '<input type="checkbox" id="cb-analytics" ' + a + ' />' +
              '<span class="cb-slider"></span>' +
            '</label>' +
          '</div>' +

          '<div class="cb-toggle-row">' +
            '<div class="cb-toggle-info">' +
              '<strong>Marketing</strong>' +
              '<span>Used for personalised ads and campaign tracking.</span>' +
            '</div>' +
            '<label class="cb-switch" aria-label="Marketing cookies">' +
              '<input type="checkbox" id="cb-marketing" ' + m + ' />' +
              '<span class="cb-slider"></span>' +
            '</label>' +
          '</div>' +

        '</div>' +
        // ── /Customize panel ──

        '<div class="cb-actions">' +
          '<button class="cb-btn cb-btn--accept"    id="cb-accept">Accept All</button>' +
          '<button class="cb-btn cb-btn--reject"    id="cb-reject">Reject All</button>' +
          '<button class="cb-btn cb-btn--customize" id="cb-customize-btn" aria-expanded="false">Customize</button>' +
        '</div>' +

        '<div class="cb-save-row" id="cb-save-row" hidden>' +
          '<button class="cb-btn cb-btn--save" id="cb-save">Save Preferences</button>' +
        '</div>' +

        '<div class="cb-footer">' +
          '<a href="#" class="cb-settings-link" data-cookie-settings>Cookie Settings</a>' +
        '</div>' +
      '</div>';

    return el;
  }

  // ─── Focus trap ───────────────────────────────────────────────────────────

  var _trap      = null;
  var _prevFocus = null;

  function getFocusable(root) {
    return Array.prototype.slice.call(
      root.querySelectorAll(
        'button:not([disabled]),[href],input:not([disabled]),[tabindex]:not([tabindex="-1"])'
      )
    );
  }

  function trapFocus(e, root) {
    if (e.key !== 'Tab') return;
    var els   = getFocusable(root);
    if (!els.length) return;
    var first = els[0];
    var last  = els[els.length - 1];
    if (e.shiftKey) {
      if (document.activeElement === first) { e.preventDefault(); last.focus(); }
    } else {
      if (document.activeElement === last)  { e.preventDefault(); first.focus(); }
    }
  }

  // ─── Banner lifecycle ─────────────────────────────────────────────────────

  function showBanner(prefill) {
    var existing = document.getElementById('cb');
    if (existing) {
      existing.classList.remove('cb--out');
      requestAnimationFrame(function () {
        requestAnimationFrame(function () { existing.classList.add('cb--in'); });
      });
      var els = getFocusable(existing);
      if (els[0]) setTimeout(function () { els[0].focus(); }, 50);
      return;
    }

    var banner = buildBanner(prefill);
    document.body.appendChild(banner);
    _prevFocus = document.activeElement;

    // Animate in on next paint
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { banner.classList.add('cb--in'); });
    });

    // Focus first element after animation
    setTimeout(function () {
      var f = getFocusable(banner);
      if (f[0]) f[0].focus();
    }, 320);

    // Focus trap
    _trap = function (e) { trapFocus(e, banner); };
    document.addEventListener('keydown', _trap);

    // ── Accept All ──
    document.getElementById('cb-accept').addEventListener('click', function () {
      handleChoice({ analytics: true, marketing: true });
    });

    // ── Reject All ──
    document.getElementById('cb-reject').addEventListener('click', function () {
      handleChoice({ analytics: false, marketing: false });
    });

    // ── Customize toggle ──
    var customizeBtn   = document.getElementById('cb-customize-btn');
    var customizePanel = document.getElementById('cb-customize');
    var saveRow        = document.getElementById('cb-save-row');

    customizeBtn.addEventListener('click', function () {
      var isOpen = !customizePanel.hidden;
      customizePanel.hidden = isOpen;
      saveRow.hidden        = isOpen;
      customizeBtn.setAttribute('aria-expanded', String(!isOpen));
      customizeBtn.textContent = isOpen ? 'Customize' : 'Customize \u25B2';
      if (!isOpen) {
        var first = getFocusable(customizePanel)[0];
        if (first) first.focus();
      }
    });

    // ── Save Preferences ──
    document.getElementById('cb-save').addEventListener('click', function () {
      handleChoice({
        analytics: document.getElementById('cb-analytics').checked,
        marketing: document.getElementById('cb-marketing').checked,
      });
    });
  }

  function hideBanner() {
    var banner = document.getElementById('cb');
    if (!banner) return;

    banner.classList.remove('cb--in');
    banner.classList.add('cb--out');

    if (_trap) {
      document.removeEventListener('keydown', _trap);
      _trap = null;
    }

    banner.addEventListener('transitionend', function () {
      if (banner.parentNode) banner.parentNode.removeChild(banner);
    }, { once: true });

    if (_prevFocus && typeof _prevFocus.focus === 'function') {
      _prevFocus.focus();
    }
  }

  function handleChoice(prefs) {
    writeCookie(prefs);
    applyConsent(prefs);
    hideBanner();
  }

  // ─── Bind [data-cookie-settings] links ────────────────────────────────────

  function bindSettingsLinks() {
    var links = document.querySelectorAll('[data-cookie-settings]');
    for (var i = 0; i < links.length; i++) {
      (function (el) {
        if (el.dataset.csbound) return;
        el.dataset.csbound = '1';
        el.addEventListener('click', function (e) {
          e.preventDefault();
          showBanner(readCookie());
        });
      })(links[i]);
    }
  }

  // ─── Public API ───────────────────────────────────────────────────────────
  window.__cookieConsent = {
    open: function () { showBanner(readCookie()); },
  };

})();
