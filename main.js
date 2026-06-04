(function () {
    const WA_NUMBER = '244941679799';
    const DISPLAY_NUMBER = '+244 941 679 799';
    const RAW_NUMBER = '+244941679799';
    const modal = document.getElementById('waModal');
    const textarea = document.getElementById('waMessage');
    const copyBtn = document.getElementById('copyWaBtn');
    const sendBtn = document.getElementById('sendWaBtn');

    let lastFocus = null;
    function openModal() {
        lastFocus = document.activeElement;
        document.body.style.overflow = 'hidden';
        modal.classList.add('open');
        modal.setAttribute('aria-hidden', 'false');
        setTimeout(() => textarea.focus(), 200);
    }
    function closeModal() {
        modal.classList.remove('open');
        modal.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
        if (lastFocus) lastFocus.focus();
    }

    modal.addEventListener('keydown', (e) => {
        if (e.key === 'Tab') {
            const focusableElements = modal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
            const firstElement = focusableElements[0];
            const lastElement = focusableElements[focusableElements.length - 1];

            if (e.shiftKey) {
                if (document.activeElement === firstElement) {
                    lastElement.focus();
                    e.preventDefault();
                }
            } else {
                if (document.activeElement === lastElement) {
                    firstElement.focus();
                    e.preventDefault();
                }
            }
        }
    });

    document.querySelectorAll('[data-open-wa]').forEach(el => {
        el.addEventListener('click', openModal);
    });
    document.querySelectorAll('[data-close-wa]').forEach(el => {
        el.addEventListener('click', closeModal);
    });
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.classList.contains('open')) closeModal();
    });

    copyBtn.addEventListener('click', async () => {
        const label = copyBtn.querySelector('.copy-label');
        const original = label.textContent;
        try {
            await navigator.clipboard.writeText(RAW_NUMBER);
        } catch (err) {
            const ta = document.createElement('textarea');
            ta.value = RAW_NUMBER;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
        }
        copyBtn.classList.add('copied');
        label.textContent = 'Copiado!';
        setTimeout(() => {
            copyBtn.classList.remove('copied');
            label.textContent = original;
        }, 1800);
    });

    sendBtn.addEventListener('click', () => {
        const text = textarea.value.trim() || 'Olá!';
        const url = `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(text)}`;
        window.open(url, '_blank', 'noopener,noreferrer');
        closeModal();
    });
})();

(function () {
    const SUPABASE_URL = 'https://vwswnychvovlhgccscqh.supabase.co';
    const SUPABASE_KEY = 'sb_publishable_sxtV6bCa6RN_VyB-53dqPg_8kDz6qLV';
    const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    const block = document.getElementById('notifyBlock');
    const form = document.getElementById('notifyForm');
    const input = document.getElementById('notifyEmail');
    const btn = document.getElementById('notifyBtn');
    const feedback = document.getElementById('notifyFeedback');

    function setLoading(isLoading) {
        if (isLoading) {
            btn.classList.add('loading');
            btn.disabled = true;
            btn.textContent = 'A ENVIAR…';
            input.disabled = true;
        } else {
            btn.classList.remove('loading');
            btn.disabled = false;
            btn.textContent = 'AVISAR-ME';
            input.disabled = false;
        }
    }
    function showError(msg) {
        feedback.textContent = msg;
        feedback.className = 'notify-feedback error';
        input.classList.add('has-error');
        input.classList.remove('has-info');
        input.setAttribute('aria-invalid', 'true');
        input.setAttribute('aria-describedby', 'notifyFeedback');
    }
    function showInfo(msg) {
        feedback.textContent = msg;
        feedback.className = 'notify-feedback info';
        input.classList.add('has-info');
        input.classList.remove('has-error');
        input.setAttribute('aria-invalid', 'false');
        input.setAttribute('aria-describedby', 'notifyFeedback');
    }
    function clearFeedback() {
        feedback.textContent = '';
        feedback.className = 'notify-feedback';
        input.classList.remove('has-error', 'has-info');
        input.removeAttribute('aria-invalid');
        input.removeAttribute('aria-describedby');
    }
    function showSuccess() {
        block.innerHTML =
            '<div class="notify-success" role="status">' +
                '<div class="notify-success-icon">' +
                    '<svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>' +
                '</div>' +
                '<div class="notify-success-text">' +
                    '<strong>Está na lista!</strong>' +
                    '<span>Avisamos quando lançarmos.</span>' +
                '</div>' +
            '</div>';
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        clearFeedback();
        const email = input.value.trim();

        if (!email) {
            showError('Por favor, insere o teu email.');
            input.focus();
            return;
        }
        if (!EMAIL_RE.test(email)) {
            showError('Email inválido. Verifica o formato.');
            input.focus();
            return;
        }

        setLoading(true);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        try {
            const res = await fetch(SUPABASE_URL + '/rest/v1/notify_subscribers', {
                method: 'POST',
                signal: controller.signal,
                headers: {
                    'apikey': SUPABASE_KEY,
                    'Authorization': 'Bearer ' + SUPABASE_KEY,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=minimal'
                },
                body: JSON.stringify([{ email: email }])
            });
            clearTimeout(timeoutId);

            if (res.ok) {
                showSuccess();
            } else if (res.status === 409) {
                showInfo('Este email já está na lista. Avisamos-te quando lançarmos.');
                setLoading(false);
                input.focus();
                input.select();
            } else {
                throw new Error('HTTP ' + res.status);
            }
        } catch (err) {
            console.error('Notify error:', err);
            setLoading(false);
            btn.classList.add('shake');
            setTimeout(function () { btn.classList.remove('shake'); }, 400);
            showError('Não foi possível subscrever. Verifica a ligação e tenta novamente.');
        }
    });
})();
