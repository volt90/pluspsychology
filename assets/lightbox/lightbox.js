/* 사진 크게 보기 — 두 가지 방식
   ────────────────────────────────────────────────────────────────
   ① 전시 상세  (.grid.ex)
      목록에는 대표 사진 한 장만 크게 보이고, 그 사진을 누르면 그 전시의
      사진이 위에서 아래로 쭉 이어진 상세 화면이 열립니다. 맨 아래
      '목록으로' 버튼으로 닫습니다.

        <ul class="grid ex" data-ex-title="부산 일러스트레이션 페어(2025)"
                            data-ex-title-en="Busan Illustration Fair (2025)">
          <li class="gcard lead"> … 대표 사진 … </li>
          <li class="gcard">      … 나머지 사진 … </li>
        </ul>

      목록에서 나머지 사진을 감추는 건 CSS 가 합니다. 마크업에는 그대로
      남아 있어서, 자바스크립트가 없어도 사진은 다 보입니다.

   ② 사진 한 장 확대  (data-lb)
      figure 에 data-lb 를 붙이면 그 사진만 화면 가득 띄웁니다.
      값이 같은 사진끼리 묶여 ← → 로 넘겨볼 수 있습니다.
      data-lb-cap 이 있으면 그것을 제목으로 씁니다.

   두 방식 모두 Esc·배경 클릭으로 닫히고, 열려 있는 동안 뒤 페이지는
   스크롤되지 않으며, 닫으면 눌렀던 사진으로 초점이 돌아갑니다.

   자리표시 이미지(placeholder.svg)만 있는 칸은 열리지 않습니다.
   ──────────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  // 페이지에 이 파일이 두 번 실려도 한 번만 돕니다.
  if (window.__kswLightbox) return;
  window.__kswLightbox = true;

  var PLACEHOLDER = 'placeholder.svg';
  var LBL = {
    close: { ko: '닫기', en: 'Close' },
    back:  { ko: '목록으로', en: 'Back to list' },
    prev:  { ko: '이전 사진', en: 'Previous photo' },
    next:  { ko: '다음 사진', en: 'Next photo' }
  };
  function t(k) { return LBL[k][document.documentElement.lang === 'en' ? 'en' : 'ko']; }
  function isReal(img) { return (img.getAttribute('src') || '').indexOf(PLACEHOLDER) === -1; }

  var openBox = null, lastFocus = null;

  // ── 공통: 열기 / 닫기 ──────────────────────────────────
  function show(el, focusEl) {
    lastFocus = document.activeElement;
    el.hidden = false;
    var pad = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = 'hidden';
    if (pad > 0) document.body.style.paddingRight = pad + 'px';
    requestAnimationFrame(function () { el.classList.add('in'); });
    openBox = el;
    if (focusEl) focusEl.focus();
  }

  function hide() {
    if (!openBox) return;
    openBox.classList.remove('in');
    openBox.hidden = true;
    openBox = null;
    document.body.style.overflow = '';
    document.body.style.paddingRight = '';
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  document.addEventListener('keydown', function (e) {
    if (!openBox) return;
    if (e.key === 'Escape') { e.preventDefault(); hide(); return; }
    if (e.key === 'Tab') {
      var f = Array.prototype.slice.call(openBox.querySelectorAll('button'))
                .filter(function (b) { return b.offsetParent !== null; });
      if (!f.length) return;
      var i = f.indexOf(document.activeElement);
      e.preventDefault();
      f[(i + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus();
    }
    if (openBox.classList.contains('lb')) {
      if (e.key === 'ArrowLeft')  { e.preventDefault(); step(-1); }
      if (e.key === 'ArrowRight') { e.preventDefault(); step(1); }
    }
  });

  function svgIcon(d) {
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="' + d + '"/></svg>';
  }

  // ── ① 전시 상세 ────────────────────────────────────────
  var sheet = null, sheetTitle = null, sheetBody = null, sheetX = null, sheetBack = null;

  function buildSheet() {
    sheet = document.createElement('div');
    sheet.className = 'lbd';
    sheet.hidden = true;
    sheet.setAttribute('role', 'dialog');
    sheet.setAttribute('aria-modal', 'true');
    sheet.innerHTML =
      '<div class="lbd-sheet">' +
        '<header class="lbd-head"><h2></h2>' +
          '<button type="button" class="lbd-x">' + svgIcon('M6 6l12 12M18 6L6 18') + '</button>' +
        '</header>' +
        '<div class="lbd-body"></div>' +
        '<footer class="lbd-foot"><button type="button" class="lbd-back"></button></footer>' +
      '</div>';
    document.body.appendChild(sheet);
    sheetTitle = sheet.querySelector('h2');
    sheetBody  = sheet.querySelector('.lbd-body');
    sheetX     = sheet.querySelector('.lbd-x');
    sheetBack  = sheet.querySelector('.lbd-back');
    sheetX.addEventListener('click', hide);
    sheetBack.addEventListener('click', hide);
    // 시트 바깥(어두운 여백)을 누르면 닫습니다
    sheet.addEventListener('click', function (e) { if (e.target === sheet) hide(); });
  }

  function openDetail(list) {
    if (!sheet) buildSheet();
    var en = document.documentElement.lang === 'en';
    var title = (en && list.getAttribute('data-ex-title-en')) || list.getAttribute('data-ex-title') || '';
    sheetTitle.textContent = title;
    sheet.setAttribute('aria-label', title);
    sheetX.setAttribute('aria-label', t('close'));
    sheetBack.textContent = t('back');

    sheetBody.innerHTML = '';
    // 초대장처럼 짝을 이루는 사진은 한 줄에 나란히 놓습니다.
    // 카드에 class="invite" 가 붙어 있으면 같은 묶음으로 들어갑니다.
    var pair = null;
    Array.prototype.slice.call(list.querySelectorAll('.gcard figure')).forEach(function (fig) {
      var img = fig.querySelector('img');
      if (!img || !isReal(img)) return;
      var card = fig.parentNode;
      var box = sheetBody;
      if (card.classList.contains('invite')) {
        if (!pair) {
          pair = document.createElement('div');
          pair.className = 'lbd-pair';
          sheetBody.appendChild(pair);
        }
        box = pair;
      } else {
        pair = null;
      }
      var cap = fig.querySelector('figcaption');
      var f = document.createElement('figure');
      var i = document.createElement('img');
      i.src = img.getAttribute('src');
      i.alt = img.alt || '';
      f.appendChild(i);
      // 대표 사진의 목록 캡션은 '사진 3장 보기' 같은 안내라 상세에 그대로 쓸 수
      // 없습니다. data-cap 에 적어둔 진짜 이름을 대신 씁니다.
      var label = (en && fig.getAttribute('data-cap-en')) || fig.getAttribute('data-cap') ||
                  (cap ? cap.textContent : '');
      label = (label || '').trim();
      if (label) {
        var c = document.createElement('figcaption');
        c.textContent = label;
        f.appendChild(c);
      }
      box.appendChild(f);
    });
    sheetBody.scrollTop = 0;
    show(sheet, sheetX);
    if (typeof gtag === 'function') gtag('event', 'exhibition_open', { exhibition: title });
  }

  function wireDetails() {
    Array.prototype.slice.call(document.querySelectorAll('.grid.ex')).forEach(function (list) {
      var leadImg = list.querySelector('.lead img');
      if (!leadImg) return;
      function settle() {
        var ok = isReal(leadImg);
        leadImg.classList.toggle('lb-open', ok);
        if (ok) { leadImg.setAttribute('tabindex', '0'); leadImg.setAttribute('role', 'button'); }
        else { leadImg.removeAttribute('tabindex'); leadImg.removeAttribute('role'); }
      }
      leadImg.addEventListener('load', settle);
      leadImg.addEventListener('error', function () { setTimeout(settle, 0); });
      if (leadImg.complete) settle();

      function go() { if (isReal(leadImg)) openDetail(list); }
      leadImg.addEventListener('click', go);
      leadImg.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); }
      });
    });
  }

  // ── ② 사진 한 장 확대 ──────────────────────────────────
  var box, imgEl, capEl, capTxt, cntEl, btnPrev, btnNext, btnX;
  var groups = {}, cur = null, curIdx = 0;

  function buildBox() {
    box = document.createElement('div');
    box.className = 'lb';
    box.hidden = true;
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    box.innerHTML =
      '<figure><img alt=""><figcaption></figcaption></figure>' +
      '<button type="button" class="lb-x">' + svgIcon('M6 6l12 12M18 6L6 18') + '</button>' +
      '<button type="button" class="lb-prev">' + svgIcon('M15 5l-7 7 7 7') + '</button>' +
      '<button type="button" class="lb-next">' + svgIcon('M9 5l7 7-7 7') + '</button>';
    document.body.appendChild(box);
    imgEl = box.querySelector('img');
    capEl = box.querySelector('figcaption');
    btnX = box.querySelector('.lb-x');
    btnPrev = box.querySelector('.lb-prev');
    btnNext = box.querySelector('.lb-next');
    capTxt = document.createTextNode('');
    capEl.appendChild(capTxt);
    cntEl = document.createElement('span');
    cntEl.className = 'lb-count';
    capEl.appendChild(cntEl);
    btnX.addEventListener('click', hide);
    btnPrev.addEventListener('click', function () { step(-1); });
    btnNext.addEventListener('click', function () { step(1); });
    box.addEventListener('click', function (e) { if (e.target === box) hide(); });
  }

  function renderBox() {
    var it = cur[curIdx];
    imgEl.src = it.src;
    imgEl.alt = it.cap;
    capTxt.nodeValue = it.cap;
    cntEl.textContent = cur.length > 1 ? (curIdx + 1) + ' / ' + cur.length : '';
    box.setAttribute('data-single', cur.length > 1 ? '0' : '1');
    btnX.setAttribute('aria-label', t('close'));
    btnPrev.setAttribute('aria-label', t('prev'));
    btnNext.setAttribute('aria-label', t('next'));
  }

  function step(d) {
    if (!cur || cur.length < 2) return;
    curIdx = (curIdx + d + cur.length) % cur.length;
    renderBox();
  }

  function openBoxAt(it) {
    if (!box) buildBox();
    cur = groups[it.group];
    curIdx = cur.indexOf(it);
    renderBox();
    show(box, btnX);
    if (typeof gtag === 'function') gtag('event', 'photo_zoom', { photo: it.cap });
  }

  function wireSingles() {
    Array.prototype.slice.call(document.querySelectorAll('[data-lb]')).forEach(function (fig, ord) {
      var img = fig.querySelector('img');
      if (!img) return;
      var cap = fig.querySelector('figcaption');
      var it = {
        src: img.getAttribute('src') || '',
        cap: (fig.getAttribute('data-lb-cap') || (cap ? cap.textContent : img.alt) || '').trim(),
        group: fig.getAttribute('data-lb') || ('_' + ord),
        ord: ord
      };
      var enrolled = false;
      function settle() {
        it.src = img.getAttribute('src') || '';
        var real = isReal(img);
        if (real === enrolled) return;
        enrolled = real;
        var g = (groups[it.group] = groups[it.group] || []);
        if (real) {
          g.push(it);
          // 로딩이 끝나는 순서가 제각각이라 페이지 순서로 다시 세웁니다
          g.sort(function (a, b) { return a.ord - b.ord; });
        } else {
          var i = g.indexOf(it); if (i > -1) g.splice(i, 1);
        }
        img.classList.toggle('lb-open', real);
        if (real) { img.setAttribute('tabindex', '0'); img.setAttribute('role', 'button'); }
        else { img.removeAttribute('tabindex'); img.removeAttribute('role'); }
      }
      img.addEventListener('load', settle);
      img.addEventListener('error', function () { setTimeout(settle, 0); });
      if (img.complete) settle();

      img.addEventListener('click', function () { if (enrolled) openBoxAt(it); });
      img.addEventListener('keydown', function (e) {
        if (!enrolled) return;
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openBoxAt(it); }
      });
    });
  }

  function init() { wireDetails(); wireSingles(); }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
