(function () {
  const form = document.getElementById('launch-form');
  if (!form || !window.fetch) return;

  const email = form.elements.email;
  const consent = form.elements.consent;
  const button = form.querySelector('button[type="submit"]');
  const status = form.querySelector('[role="status"]');
  const fallback = document.getElementById('launch-fallback');
  const source = 'landing_' + document.body.dataset.target;

  form.addEventListener('submit', async function (event) {
    event.preventDefault();
    if (button.disabled || !form.reportValidity()) return;

    button.disabled = true;
    status.textContent = '알림을 신청하고 있어요…';
    try {
      const response = await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.value.trim(),
          lang: 'ko',
          source: source,
          consent: consent.checked
        })
      });
      const data = await response.json();
      if (response.ok && data.ok === true) {
        form.reset();
        status.textContent = '신청이 완료됐어요. 워크북이 출시되면 이메일로 알려드릴게요.';
      } else if (response.status === 409 && data.error === 'Already subscribed') {
        status.textContent = '이미 알림을 신청한 이메일이에요.';
      } else if (response.status === 400 && data.error === 'Invalid email') {
        status.textContent = '이메일 주소를 다시 확인해 주세요.';
        email.focus();
      } else {
        throw new Error('Subscription was not confirmed');
      }
    } catch {
      status.textContent = '신청 결과를 확인할 수 없어요. 잠시 후 다시 시도해 주세요.';
    } finally {
      button.disabled = false;
    }
  });

  form.hidden = false;
  fallback.hidden = true;
})();
