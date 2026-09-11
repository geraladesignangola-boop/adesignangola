import { supabase } from './supabase.js';

(() => {
  const ENDPOINT = 'analytics_events';
  const FIRST_VISIT_KEY = 'aacademy_first_visit';
  const SID_KEY = 'aacademy_sid';
  const PAGE_START_KEY = 'aacademy_page_start';
  const MAX_SCROLL_KEY = 'aacademy_max_scroll';
  const CONSENT_KEY = 'aacademy_cookie_consent';
  const QUEUE_KEY = 'aacademy_analytics_queue';
  const MAX_RETRIES = 3;
  const DEBUG = location.hostname === 'localhost' || location.hostname === '127.0.0.1';

  let hasConsent = false;

  function log(...args) {
    if (DEBUG) console.log('%c[Analytics]', 'color:#ff4a12;font-weight:bold', ...args);
  }

  function checkConsent() {
    try {
      const raw = localStorage.getItem(CONSENT_KEY);
      if (!raw) return false;
      const c = JSON.parse(raw);
      return c.analytics === true;
    } catch { return false; }
  }

  function onConsentChange(e) {
    const consent = e.detail || e;
    const prev = hasConsent;
    hasConsent = consent.analytics === true;
    log('Consent changed:', hasConsent ? 'GRANTED' : 'DENIED');
    if (!prev && hasConsent) flushQueue();
  }

  let sessionId = sessionStorage.getItem(SID_KEY);
  if (!sessionId) {
    sessionId = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36);
    sessionStorage.setItem(SID_KEY, sessionId);
  }

  const isNewVisitor = !localStorage.getItem(FIRST_VISIT_KEY);
  if (isNewVisitor) localStorage.setItem(FIRST_VISIT_KEY, Date.now().toString());

  function parseUA(ua) {
    const browser = { name: 'Unknown', version: '' };
    const os = { name: 'Unknown', version: '' };

    if (ua.includes('Firefox/')) { browser.name = 'Firefox'; browser.version = ua.match(/Firefox\/([\d.]+)/)?.[1] || ''; }
    else if (ua.includes('Edg/')) { browser.name = 'Edge'; browser.version = ua.match(/Edg\/([\d.]+)/)?.[1] || ''; }
    else if (ua.includes('OPR/')) { browser.name = 'Opera'; browser.version = ua.match(/OPR\/([\d.]+)/)?.[1] || ''; }
    else if (ua.includes('Chrome/') && !ua.includes('Edg/')) { browser.name = 'Chrome'; browser.version = ua.match(/Chrome\/([\d.]+)/)?.[1] || ''; }
    else if (ua.includes('Safari/') && !ua.includes('Chrome')) { browser.name = 'Safari'; browser.version = ua.match(/Version\/([\d.]+)/)?.[1] || ''; }

    if (ua.includes('Windows')) { os.name = 'Windows'; os.version = ua.match(/Windows NT ([\d.]+)/)?.[1] || ''; }
    else if (ua.includes('Mac OS X')) { os.name = 'macOS'; os.version = ua.match(/Mac OS X ([\d._]+)/)?.[1]?.replace(/_/g, '.') || ''; }
    else if (ua.includes('Linux')) { os.name = 'Linux'; }
    else if (ua.includes('Android')) { os.name = 'Android'; os.version = ua.match(/Android ([\d.]+)/)?.[1] || ''; }
    else if (ua.includes('iPhone') || ua.includes('iPad')) { os.name = 'iOS'; os.version = ua.match(/OS ([\d._]+)/)?.[1]?.replace(/_/g, '.') || ''; }

    return { browser, os };
  }

  function getDeviceType(ua) {
    if (/Mobile|Android|iPhone/i.test(ua)) return 'mobile';
    if (/iPad|Tablet/i.test(ua)) return 'tablet';
    return 'desktop';
  }

  function getConnectionType() {
    const c = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    return c?.type || c?.effectiveType || null;
  }

  function getUTMParams() {
    const p = new URLSearchParams(location.search);
    return {
      utm_source: p.get('utm_source'),
      utm_medium: p.get('utm_medium'),
      utm_campaign: p.get('utm_campaign'),
      utm_content: p.get('utm_content'),
      utm_term: p.get('utm_term')
    };
  }

  function buildEventRow(eventName, extraData = {}) {
    const ua = navigator.userAgent;
    const { browser, os } = parseUA(ua);
    const utm = getUTMParams();
    const pageStart = parseInt(sessionStorage.getItem(PAGE_START_KEY) || Date.now());
    const duration = Date.now() - pageStart;
    const maxScroll = parseInt(localStorage.getItem(MAX_SCROLL_KEY) || '0');

    return {
      event_name: eventName,
      event_data: extraData,
      page: location.pathname + location.search,
      page_title: document.title,
      referrer: document.referrer || null,
      ...utm,
      user_agent: ua,
      browser: browser.name,
      browser_version: browser.version,
      os: os.name,
      os_version: os.version,
      device_type: getDeviceType(ua),
      viewport_width: window.innerWidth,
      viewport_height: window.innerHeight,
      screen_width: screen.width,
      screen_height: screen.height,
      connection_type: getConnectionType(),
      language: navigator.language || 'pt',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      session_id: sessionId,
      session_duration_ms: duration,
      scroll_depth: maxScroll,
      is_new_visitor: isNewVisitor
    };
  }

  let queue = [];
  let flushTimer = null;

  function loadQueue() {
    try {
      const raw = localStorage.getItem(QUEUE_KEY);
      if (raw) queue = JSON.parse(raw);
    } catch { queue = []; }
  }

  function saveQueue() {
    try {
      localStorage.setItem(QUEUE_KEY, JSON.stringify(queue.slice(0, 50)));
    } catch {}
  }

  async function sendEvent(eventName, extraData = {}) {
    if (!hasConsent) {
      log('Event blocked (no consent):', eventName);
      return;
    }

    const row = buildEventRow(eventName, extraData);

    if (supabase) {
      try {
        const { error } = await supabase.from(ENDPOINT).insert(row);
        if (!error) {
          log('Event sent:', eventName);
          return;
        }
        log('Insert error:', error.message);
      } catch (e) {
        log('Send failed:', e.message);
      }
    }

    row._retries = 0;
    queue.push(row);
    saveQueue();
    if (!flushTimer) flushTimer = setTimeout(flushQueue, 5000);
  }

  async function flushQueue() {
    if (!queue.length) { flushTimer = null; return; }
    if (!hasConsent) { flushTimer = null; return; }
    if (!supabase) { flushTimer = setTimeout(flushQueue, 10000); return; }

    const batch = queue.splice(0, 10);
    const toInsert = batch.map(({_retries, ...rest}) => rest);

    try {
      const { error } = await supabase.from(ENDPOINT).insert(toInsert);
      if (!error) {
        saveQueue();
        log('Flushed', toInsert.length, 'events');
      } else {
        log('Flush error:', error.message);
        batch.forEach(e => { e._retries = (e._retries || 0) + 1; });
        const retryable = batch.filter(e => e._retries < MAX_RETRIES);
        queue = retryable.concat(queue);
        saveQueue();
      }
    } catch (e) {
      log('Flush failed:', e.message);
      batch.forEach(e => { e._retries = (e._retries || 0) + 1; });
      const retryable = batch.filter(e => e._retries < MAX_RETRIES);
      queue = retryable.concat(queue);
      saveQueue();
    }

    flushTimer = queue.length > 0 ? setTimeout(flushQueue, 10000) : null;
  }

  function trackPageView() {
    sessionStorage.setItem(PAGE_START_KEY, Date.now().toString());
    localStorage.setItem(MAX_SCROLL_KEY, '0');
    sendEvent('page_view');
  }

  document.addEventListener('click', (e) => {
    const el = e.target.closest('a, button, [onclick]');
    if (!el) return;
    const href = el.href || '';
    const text = (el.textContent || '').trim().slice(0, 80);
    const tag = el.tagName;

    if (href.includes('whatsapp') || href.includes('tel:') || href.includes('mailto:')) {
      sendEvent('contact_click', { tag, text, href: href.slice(0, 200) });
    } else if (el.closest('.pchip, [data-profile]')) {
      sendEvent('form_interaction', { type: 'profile_select', text });
    } else if (el.closest('.pay-opt')) {
      sendEvent('form_interaction', { type: 'payment_select', text });
    } else if (el.closest('#btnSubmit')) {
      sendEvent('cta_click', { text: 'submit_form' });
    } else if (el.closest('#checkBtn')) {
      sendEvent('cta_click', { text: 'check_status' });
    } else if (el.closest('#btnAplicarCodigo')) {
      sendEvent('form_interaction', { type: 'code_apply' });
    } else if (tag === 'A' && href) {
      sendEvent('click', { tag, text, href: href.slice(0, 200) });
    }
  }, true);

  let scrollTimer = null;
  const thresholds = [25, 50, 75, 90, 100];
  window.addEventListener('scroll', () => {
    if (scrollTimer) return;
    scrollTimer = setTimeout(() => {
      scrollTimer = null;
      const pct = Math.round((window.scrollY / (document.body.scrollHeight - window.innerHeight)) * 100);
      const current = parseInt(localStorage.getItem(MAX_SCROLL_KEY) || '0');
      if (pct > current) {
        localStorage.setItem(MAX_SCROLL_KEY, pct.toString());
        const next = thresholds.find(t => t > current && t <= pct);
        if (next) sendEvent('scroll_depth', { depth: next });
      }
    }, 200);
  }, { passive: true });

  document.addEventListener('submit', (e) => {
    const form = e.target;
    sendEvent('form_submit', { form: form.id || form.name || 'unknown' });
  }, true);

  window.addEventListener('error', (e) => {
    sendEvent('error', { message: e.message?.slice(0, 200), source: e.filename, line: e.lineno });
  });
  window.addEventListener('unhandledrejection', (e) => {
    sendEvent('error', { message: String(e.reason || '').slice(0, 200), source: 'promise' });
  });

  function observeWebVitals() {
    if (!('PerformanceObserver' in window)) return;
    try {
      new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const last = entries[entries.length - 1];
        if (last) sendEvent('lcp', { value: Math.round(last.startTime + last.duration) });
      }).observe({ type: 'largest-contentful-paint', buffered: true });
    } catch {}
    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) sendEvent('cls', { value: entry.value.toFixed(3) });
      }).observe({ type: 'layout-shift', buffered: true });
    } catch {}
    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.name === 'first-contentful-paint') sendEvent('fcp', { value: Math.round(entry.startTime) });
        }
      }).observe({ type: 'paint', buffered: true });
    } catch {}
    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.navigationStart !== undefined) sendEvent('ttfb', { value: Math.round(entry.responseStart - entry.navigationStart) });
        }
      }).observe({ type: 'navigation', buffered: true });
    } catch {}
  }

  window.Analytics = {
    track: sendEvent,
    pageView: trackPageView,
    getSessionId: () => sessionId,
    hasConsent: () => hasConsent,
    flushNow: flushQueue
  };

  function init() {
    hasConsent = checkConsent();
    log('Init — consent:', hasConsent ? 'GRANTED' : 'DENIED');

    window.addEventListener('cookieconsent', onConsentChange);

    if (window.CookieConsent) {
      const existing = window.CookieConsent.getConsent();
      if (existing) {
        hasConsent = existing.analytics === true;
        log('Existing consent loaded:', hasConsent);
      }
    }

    loadQueue();

    trackPageView();
    observeWebVitals();

    if (hasConsent && queue.length > 0) flushQueue();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
