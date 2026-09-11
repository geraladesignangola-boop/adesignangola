(() => {
  const STORAGE_KEY = 'aacademy_cookie_consent';

  function getConsent() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY));
    } catch { return null; }
  }

  function setConsent(consent) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(consent));
    window.dispatchEvent(new CustomEvent('cookieconsent', { detail: consent }));
  }

  function createBanner() {
    if (document.getElementById('cc-banner')) return;

    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = '/src/styles/cookie-consent.css';
    document.head.appendChild(css);

    const banner = document.createElement('div');
    banner.id = 'cc-banner';
    banner.className = 'cc-banner cc-hidden';
    banner.innerHTML = `
      <div class="cc-inner">
        <div class="cc-text">
          Utilizamos cookies para melhorar a tua experiência e analisar o tráfego do site.
          Ao aceitares, contribuis para melhorarmos o nosso serviço.
          <a href="/privacidade.html">Política de Privacidade</a> ·
          <a href="/cookies.html">Política de Cookies</a>
        </div>
        <div class="cc-actions">
          <button class="cc-btn cc-btn-settings" id="cc-settings" type="button">Personalizar</button>
          <button class="cc-btn cc-btn-reject" id="cc-reject" type="button">Rejeitar</button>
          <button class="cc-btn cc-btn-accept" id="cc-accept" type="button">Aceitar todos</button>
        </div>
      </div>
    `;
    document.body.appendChild(banner);

    const modal = document.createElement('div');
    modal.id = 'cc-modal-overlay';
    modal.className = 'cc-modal-overlay cc-hidden';
    modal.innerHTML = `
      <div class="cc-modal">
        <h3>Preferências de Cookies</h3>
        <p>Escolhe quais categorias de cookies queres ativar. Os cookies necessários são sempre ativos para o site funcionar.</p>

        <div class="cc-category">
          <div class="cc-category-header">
            <span>Necessários</span>
            <label class="cc-switch"><input type="checkbox" checked disabled><span class="cc-slider"></span></label>
          </div>
          <p class="cc-category-desc">Essenciais para o funcionamento do site. Não podem ser desativados.</p>
        </div>

        <div class="cc-category">
          <div class="cc-category-header">
            <span>Analíticos</span>
            <label class="cc-switch"><input type="checkbox" id="cc-analytics"><span class="cc-slider"></span></label>
          </div>
          <p class="cc-category-desc">Ajudam-nos a perceber como utilizas o site, permitindo melhorar a experiência.</p>
        </div>

        <div class="cc-category">
          <div class="cc-category-header">
            <span>Marketing</span>
            <label class="cc-switch"><input type="checkbox" id="cc-marketing"><span class="cc-slider"></span></label>
          </div>
          <p class="cc-category-desc">Utilizados para mostrar anúncios relevantes e medir a eficácia de campanhas.</p>
        </div>

        <div class="cc-modal-actions">
          <button class="cc-btn cc-btn-reject" id="cc-modal-reject" type="button">Rejeitar todos</button>
          <button class="cc-btn cc-btn-accept" id="cc-modal-save" type="button">Guardar preferências</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    document.getElementById('cc-accept').addEventListener('click', () => {
      setConsent({ necessary: true, analytics: true, marketing: true, timestamp: Date.now() });
      hideBanner();
    });

    document.getElementById('cc-reject').addEventListener('click', () => {
      setConsent({ necessary: true, analytics: false, marketing: false, timestamp: Date.now() });
      hideBanner();
    });

    document.getElementById('cc-settings').addEventListener('click', () => {
      modal.classList.remove('cc-hidden');
    });

    document.getElementById('cc-modal-reject').addEventListener('click', () => {
      document.getElementById('cc-analytics').checked = false;
      document.getElementById('cc-marketing').checked = false;
      setConsent({ necessary: true, analytics: false, marketing: false, timestamp: Date.now() });
      hideBanner();
      modal.classList.add('cc-hidden');
    });

    document.getElementById('cc-modal-save').addEventListener('click', () => {
      const analytics = document.getElementById('cc-analytics').checked;
      const marketing = document.getElementById('cc-marketing').checked;
      setConsent({ necessary: true, analytics, marketing, timestamp: Date.now() });
      hideBanner();
      modal.classList.add('cc-hidden');
    });

    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.classList.add('cc-hidden');
    });

    requestAnimationFrame(() => {
      requestAnimationFrame(() => banner.classList.remove('cc-hidden'));
    });
  }

  function hideBanner() {
    const banner = document.getElementById('cc-banner');
    if (banner) banner.classList.add('cc-hidden');
  }

  function init() {
    const consent = getConsent();
    if (!consent) {
      createBanner();
    } else {
      window.dispatchEvent(new CustomEvent('cookieconsent', { detail: consent }));
    }
  }

  window.CookieConsent = {
    init,
    getConsent,
    setConsent,
    show: createBanner,
    revoke: () => {
      localStorage.removeItem(STORAGE_KEY);
      createBanner();
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
