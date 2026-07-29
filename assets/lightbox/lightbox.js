/* 사진 확대 보기 (lightbox)
   ────────────────────────────────────────────────────────────────
   쓰는 법 — 확대하고 싶은 <img> 를 감싼 요소에 data-lb 를 붙이면 끝입니다.

     <figure data-lb="seongsu"><img src="..." alt="성수동 팝업"><figcaption>…</figcaption></figure>

   data-lb 의 값이 같은 사진끼리 한 묶음이 되어, 확대 화면에서 ← → 로
   넘겨볼 수 있습니다. 값이 비어 있으면 그 사진 혼자 한 묶음입니다.
   캡션은 figcaption 을, 없으면 img 의 alt 를 씁니다.

   자리표시 이미지(placeholder.svg)는 확대할 게 없으므로 건너뜁니다.
   실제 사진이 올라오면 자동으로 확대 대상이 됩니다.
   ──────────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  // 페이지에 이 파일이 두 번 실려도 한 번만 돕니다.
  if (window.__kswLightbox) return;
  window.__kswLightbox = true;

  var PLACEHOLDER = 'placeholder.svg';

  var items = [];          // {src, cap, group, el}
  var groups = {};         // group -> items 배열
  var cur = null, curIdx = 0, lastFocus = null;

  function collect() {
    var nodes = Array.prototype.slice.call(document.querySelectorAll('[data-lb]'));
    nodes.forEach(function (fig, ord) {
      var img = fig.querySelector('img');
      if (!img) return;
      var capEl = fig.querySelector('figcaption');
      var it = {
        src: img.getAttribute('src') || '',
        cap: (capEl ? capEl.textContent : img.alt || '').trim(),
        group: fig.getAttribute('data-lb') || ('_' + ord),
        el: img,
        ord: ord            // 페이지에 놓인 순서. 아래 정렬에 씁니다.
      };

      // 사진이 아직 안 올라온 칸은 onerror 가 자리표시로 바꿔치기하는데,
      // 그 시점이 이 코드보다 늦을 수 있습니다. 그래서 지금 src 로 판단하지 않고
      // 로드가 끝난 뒤 최종 src 를 보고 확대 대상에 넣을지 정합니다.
      function settle() {
        var now = img.getAttribute('src') || '';
        var real = now.indexOf(PLACEHOLDER) === -1;
        it.src = now;
        if (real === enrolled) return;
        if (real) enroll(); else drop();
      }
      var enrolled = false;
      function enroll() {
        enrolled = true;
        items.push(it);
        var g = (groups[it.group] = groups[it.group] || []);
        g.push(it);
        // 사진마다 로딩이 끝나는 순서가 제각각이라, 그 순서대로 담으면
        // 확대 화면에서 3번째 사진이 1번으로 나오는 일이 생깁니다.
        // 페이지에 놓인 순서로 다시 세웁니다.
        g.sort(function (a, b) { return a.ord - b.ord; });
        img.classList.add('lb-open');
        img.setAttribute('tabindex', '0');
        img.setAttribute('role', 'button');
      }
      function drop() {
        enrolled = false;
        var g = groups[it.group] || [];
        var i = g.indexOf(it); if (i > -1) g.splice(i, 1);
        i = items.indexOf(it); if (i > -1) items.splice(i, 1);
        img.classList.remove('lb-open');
        img.removeAttribute('tabindex');
        img.removeAttribute('role');
      }

      img.addEventListener('click', function () { if (enrolled) open(it); });
      img.addEventListener('keydown', function (e) {
        if (!enrolled) return;
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(it); }
      });
      img.addEventListener('load', settle);
      img.addEventListener('error', function () { setTimeout(settle, 0); });
      if (img.complete) settle();
    });
    return items.length;
  }

  // ── 확대 화면 만들기 ────────────────────────────────────
  var box, imgEl, capEl, capTxt, cntEl, btnPrev, btnNext, btnX;

  function build() {
    box = document.createElement('div');
    box.className = 'lb';
    box.hidden = true;
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    box.innerHTML =
      '<figure><img alt=""><figcaption></figcaption></figure>' +
      '<button type="button" class="lb-x" aria-label="닫기">' +
        '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button>' +
      '<button type="button" class="lb-prev" aria-label="이전 사진">' +
        '<svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg></button>' +
      '<button type="button" class="lb-next" aria-label="다음 사진">' +
        '<svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg></button>';
    document.body.appendChild(box);

    imgEl   = box.querySelector('img');
    capEl   = box.querySelector('figcaption');
    btnX    = box.querySelector('.lb-x');
    btnPrev = box.querySelector('.lb-prev');
    btnNext = box.querySelector('.lb-next');

    // 캡션은 [텍스트 노드][카운터] 두 조각으로 한 번만 만들어 두고,
    // 열 때마다 그 노드의 내용만 갈아 끼웁니다.
    capTxt = document.createTextNode('');
    capEl.appendChild(capTxt);
    cntEl = document.createElement('span');
    cntEl.className = 'lb-count';
    capEl.appendChild(cntEl);

    btnX.addEventListener('click', close);
    btnPrev.addEventListener('click', function () { step(-1); });
    btnNext.addEventListener('click', function () { step(1); });
    // 사진이나 버튼이 아닌 빈 공간을 누르면 닫습니다
    box.addEventListener('click', function (e) { if (e.target === box) close(); });
    document.addEventListener('keydown', onKey);
  }

  function render() {
    var it = cur[curIdx];
    imgEl.src = it.src;
    imgEl.alt = it.cap;
    capTxt.nodeValue = it.cap;
    cntEl.textContent = cur.length > 1 ? (curIdx + 1) + ' / ' + cur.length : '';
    box.setAttribute('data-single', cur.length > 1 ? '0' : '1');
  }

  function open(it) {
    if (!box) build();
    cur = groups[it.group];
    curIdx = cur.indexOf(it);
    lastFocus = document.activeElement;
    render();
    box.hidden = false;
    // 배경이 스크롤되지 않게. 스크롤바가 사라지며 생기는 밀림도 막습니다.
    var pad = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = 'hidden';
    if (pad > 0) document.body.style.paddingRight = pad + 'px';
    requestAnimationFrame(function () { box.classList.add('in'); });
    btnX.focus();
    if (typeof gtag === 'function') gtag('event', 'photo_zoom', { photo: cur[curIdx].cap });
  }

  function close() {
    if (!box || box.hidden) return;
    box.classList.remove('in');
    box.hidden = true;
    imgEl.removeAttribute('src');
    document.body.style.overflow = '';
    document.body.style.paddingRight = '';
    if (lastFocus && lastFocus.focus) lastFocus.focus();
    cur = null;
  }

  function step(d) {
    if (!cur || cur.length < 2) return;
    curIdx = (curIdx + d + cur.length) % cur.length;
    render();
  }

  function onKey(e) {
    if (!box || box.hidden) return;
    if (e.key === 'Escape') { e.preventDefault(); close(); }
    else if (e.key === 'ArrowLeft')  { e.preventDefault(); step(-1); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); step(1); }
    else if (e.key === 'Tab') {
      // 확대 화면 안에서만 초점이 돌게 가둡니다
      var f = Array.prototype.slice.call(box.querySelectorAll('button'))
                .filter(function (b) { return b.offsetParent !== null; });
      if (!f.length) return;
      var i = f.indexOf(document.activeElement);
      e.preventDefault();
      f[(i + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', collect);
  } else {
    collect();
  }
})();
