(() => {
  const errors = [];
  const MAX_ERRORS = 50;

  function sendToGA4(errorData) {
    if (typeof gtag !== 'function') return;
    try {
      gtag('event', 'exception', {
        description: errorData.message,
        fatal: errorData.fatal,
        error_source: errorData.source,
        error_col: errorData.col,
        page: errorData.page
      });
    } catch {}
  }

  function handleError(message, source, col, error) {
    const errorData = {
      message: typeof message === 'string' ? message : (error?.message || 'Unknown error'),
      source: source || 'window',
      col: col || null,
      page: location.pathname,
      fatal: false,
      stack: error?.stack || null,
      timestamp: Date.now()
    };

    errors.push(errorData);
    if (errors.length > MAX_ERRORS) errors.shift();

    if (window.dataLayer) sendToGA4(errorData);

    if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
      console.groupCollapsed(`%c[ErrorTracker] ${errorData.message}`, 'color:#ff4a12;font-weight:bold');
      console.log('Source:', errorData.source);
      console.log('Page:', errorData.page);
      if (errorData.col) console.log('Column:', errorData.col);
      if (errorData.stack) console.log('Stack:', errorData.stack);
      console.groupEnd();
    }
  }

  window.addEventListener('error', (e) => {
    handleError(e.message, e.filename, e.lineno, e.error);
  });

  window.addEventListener('unhandledrejection', (e) => {
    const msg = e.reason?.message || String(e.reason || 'Unhandled rejection');
    handleError(msg, 'promise', null, e.reason);
  });

  window.ErrorTracker = {
    getErrors: () => [...errors],
    report: (msg, extra) => handleError(msg, 'manual', null, new Error(msg)),
    clear: () => { errors.length = 0; }
  };
})();
