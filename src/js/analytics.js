(() => {
  const GA_MEASUREMENT_ID = 'G-MWZR7FMSV5';
  const isAdmin = location.pathname.includes('admin.html');
  const DEBUG = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  const CONSENT_KEY = 'aacademy_cookie_consent';

  function log(...args) {
    if (DEBUG) console.log('%c[GA4]', 'color:#4285f4;font-weight:bold', ...args);
  }

  window.dataLayer = window.dataLayer || [];
  function gtag() { dataLayer.push(arguments); }

  // Default consent: denied
  gtag('consent', 'default', {
    ad_storage: 'denied',
    analytics_storage: 'denied',
    functionality_storage: 'denied',
    personalization_storage: 'denied',
    security_storage: 'granted',
    wait_for_update: 500
  });

  gtag('set', 'url_passthrough', true);
  gtag('set', 'ads_data_redaction', true);

  let ga4Loaded = false;

  function loadGA4() {
    if (ga4Loaded) return;
    if (document.getElementById('ga4-script')) {
      ga4Loaded = true;
      return;
    }

    log('Loading GA4...');

    const s = document.createElement('script');
    s.id = 'ga4-script';
    s.async = true;
    s.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
    s.onerror = () => log('Failed to load GA4 script');
    document.head.appendChild(s);

    s.onload = () => {
      ga4Loaded = true;
      gtag('js', new Date());
      gtag('config', GA_MEASUREMENT_ID, {
        send_page_view: isAdmin,
        cookie_flags: 'SameSite=None;Secure',
        debug_mode: DEBUG,
        custom_map: isAdmin ? { dimension1: 'admin_user' } : undefined
      });
      log('GA4 configured, ID:', GA_MEASUREMENT_ID);

      if (isAdmin) {
        gtag('event', 'admin_login', {
          event_category: 'admin',
          event_label: location.pathname
        });
      }
    };
  }

  function handleConsent(e) {
    const consent = e.detail || e;
    log('Consent update:', consent);

    if (consent.analytics) {
      gtag('consent', 'update', { analytics_storage: 'granted' });
      loadGA4();
    } else {
      gtag('consent', 'update', { analytics_storage: 'denied' });
    }

    if (consent.marketing) {
      gtag('consent', 'update', { ad_storage: 'granted' });
    } else {
      gtag('consent', 'update', { ad_storage: 'denied' });
    }
  }

  if (isAdmin) {
    gtag('consent', 'update', {
      analytics_storage: 'granted',
      ad_storage: 'granted'
    });
    loadGA4();
  } else {
    window.addEventListener('cookieconsent', handleConsent);

    // Check existing consent immediately
    if (window.CookieConsent) {
      const existing = window.CookieConsent.getConsent();
      if (existing) {
        handleConsent({ detail: existing });
      }
    } else {
      // Fallback: check localStorage directly
      try {
        const raw = localStorage.getItem(CONSENT_KEY);
        if (raw) {
          const c = JSON.parse(raw);
          if (c.analytics) loadGA4();
        }
      } catch {}
    }
  }
})();
