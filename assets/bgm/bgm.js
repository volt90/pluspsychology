/* 배경음악 — index / about / contact 공용
   ────────────────────────────────────────────────────────────────
   1) 끊김 없는 루프
      <audio loop> 는 끝에서 처음으로 되감을 때 브라우저마다 수십 ms 의
      공백이 생기고, MP3 는 인코더가 파일 앞뒤에 붙이는 무음까지 얹혀서
      루프마다 "툭" 끊깁니다. AudioBufferSourceNode 의 loopStart/loopEnd 는
      디코딩된 샘플 위에서 도는 방식이라 이 두 문제가 모두 없어집니다.

      음원(assets/bgm/landing-loop.mp3)은 원본 WAV 마스터에서 8마디
      (122.000 BPM = 15.73771초)만 잘라내고, 그 뒤에 남는 잔향을 머리 쪽에
      겹쳐 넣어(wrap) 이어붙인 자리가 들리지 않게 만든 것입니다.
      ※ LOOP 값은 이 파일 전용입니다. 음원을 교체하면 반드시 함께 고치세요.

   2) 페이지를 넘어가도 이어지게
      이 사이트는 페이지마다 별개의 HTML 이라, 이동하면 오디오가 그대로
      사라집니다. 그래서 나가기 직전에 '지금 몇 초 지점인지'를
      sessionStorage 에 시각과 함께 적어두고, 다음 페이지에서 그 사이 흐른
      시간만큼 앞으로 감아 이어 재생합니다. 곡이 멈췄다 처음부터 다시
      시작하는 게 아니라, 계속 흐르고 있던 자리에서 다시 들립니다.
      (페이지가 새로 뜨는 짧은 순간의 공백은 이 구조에서는 피할 수 없습니다)

   3) 자동재생
      브라우저는 방문자가 페이지를 한 번이라도 조작하기 전에는 소리를
      막습니다. 코드로 우회할 수 있는 게 아니라서, 정책이 이미 풀렸으면
      로드 즉시 켜고 아니면 첫 클릭·키 입력·터치를 한 번만 기다립니다.
   ──────────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  var SRC       = '/assets/bgm/landing-loop.mp3';
  var LOOP      = 15.73771;   // 초 — 8마디 @ 122.000 BPM
  var GAIN      = 0.28;       // 배경음이라 낮게 (원본 대비 약 -11dB)
  var FADE      = 0.45;       // 켜고 끌 때 페이드 (초)
  var KEY_ON    = 'ksw_bgm';      // 켜짐/꺼짐 선택 (localStorage — 방문 사이 유지)
  var KEY_POS   = 'ksw_bgm_pos';  // 재생 위치 (sessionStorage — 이번 방문 안에서만)
  var POS_TTL   = 5 * 60 * 1000;  // 이보다 오래된 위치는 버리고 처음부터
  var MAX_ADVANCE = 2000;         // 페이지 전환이 이보다 오래 걸리면 앞으로 감지 않음

  var AC = window.AudioContext || window.webkitAudioContext;
  if (!AC || !window.fetch) return;

  var LABEL = { ko: '배경음악', en: 'Background music' };

  var actx = null, gainNode = null, buffer = null, node = null;
  var playing = false, loading = false, failed = false;
  var startedAt = 0, startedFrom = 0;   // 현재 재생 위치 계산용

  // ── 버튼 ───────────────────────────────────────────────
  var btn = document.createElement('button');
  btn.className = 'bgm';
  btn.id = 'bgm';
  btn.type = 'button';
  btn.setAttribute('aria-pressed', 'false');
  btn.innerHTML =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"' +
    ' stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' +
    '<path d="M4 9.3h3.3L11.5 5.7v12.6L7.3 14.7H4z"/>' +
    '<g class="wv"><path class="wv1" d="M14.6 9.6a3.4 3.4 0 0 1 0 4.8"/>' +
    '<path class="wv2" d="M17 7.4a6.7 6.7 0 0 1 0 9.2"/></g>' +
    '<g class="mut"><path d="M15.3 10.1 19.6 13.9"/><path d="M19.6 10.1 15.3 13.9"/></g>' +
    '</svg>';

  // 각 페이지의 언어 전환 코드에 기대지 않고 <html lang> 을 직접 따라갑니다.
  function syncLabel() {
    var en = document.documentElement.lang === 'en';
    btn.setAttribute('aria-label', en ? LABEL.en : LABEL.ko);
  }
  syncLabel();
  new MutationObserver(syncLabel).observe(document.documentElement,
    { attributes: true, attributeFilter: ['lang'] });
  document.body.appendChild(btn);

  function setState(on) {
    playing = on;
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
  }

  // ── 오디오 ─────────────────────────────────────────────
  function ensureCtx() {
    if (!actx) {
      actx = new AC();
      gainNode = actx.createGain();
      gainNode.gain.value = 0;
      gainNode.connect(actx.destination);
    }
    return actx;
  }

  // MP3 디코더가 파일 앞에 덧붙이는 인코더 지연(순수 디지털 무음)을 건너뜁니다.
  // 음원은 첫 샘플부터 소리가 들어있어서(약 -38dBFS) 이 임계값으로 안전하게 갈립니다.
  // 지연을 알아서 잘라내는 브라우저에서도 결과가 같아집니다.
  function headOffset(buf) {
    var ch = buf.getChannelData(0);
    var n = Math.min(ch.length, buf.sampleRate);   // 앞 1초까지만 확인
    for (var i = 0; i < n; i++) {
      if (Math.abs(ch[i]) > 1e-4) return i / buf.sampleRate;
    }
    return 0;
  }

  // 이번 방문에서 곡이 어디까지 흘렀는지 — 없거나 오래됐으면 0
  //
  // 페이지가 금방 뜬 경우에는 그 사이 흐른 시간만큼 앞으로 감아서, 곡이
  // 멈춘 적 없는 것처럼 이어 붙입니다. 반대로 로딩이 오래 걸렸다면 이미
  // 이어지는 느낌은 깨진 뒤라, 굳이 한 바퀴 가까이 건너뛰지 않고 멈췄던
  // 자리에서 다시 시작합니다.
  function resumeOffset() {
    try {
      var raw = sessionStorage.getItem(KEY_POS);
      if (!raw) return 0;
      var p = JSON.parse(raw);
      var gap = Date.now() - p.t;
      if (!(gap >= 0) || gap > POS_TTL) return 0;
      var advance = gap <= MAX_ADVANCE ? gap / 1000 : 0;
      return ((p.o + advance) % LOOP + LOOP) % LOOP;
    } catch (e) { return 0; }
  }

  function currentOffset() {
    if (!actx || !node) return 0;
    return ((startedFrom + (actx.currentTime - startedAt)) % LOOP + LOOP) % LOOP;
  }

  function savePos() {
    if (!playing) return;
    try {
      sessionStorage.setItem(KEY_POS, JSON.stringify({ o: currentOffset(), t: Date.now() }));
    } catch (e) {}
  }

  function startNode(offset) {
    if (node) return;
    var head = headOffset(buffer);
    node = actx.createBufferSource();
    node.buffer = buffer;
    node.loop = true;
    node.loopStart = head;
    node.loopEnd = Math.min(head + LOOP, buffer.duration);
    node.connect(gainNode);
    startedFrom = offset || 0;
    startedAt = actx.currentTime;
    node.start(0, head + startedFrom);
  }

  function fadeTo(v) {
    var t = actx.currentTime;
    gainNode.gain.cancelScheduledValues(t);
    gainNode.gain.setValueAtTime(gainNode.gain.value, t);
    gainNode.gain.linearRampToValueAtTime(v, t + FADE);
  }

  function loadBuffer(ok, fail) {
    if (buffer) { ok(); return; }
    loading = true; btn.classList.add('is-loading');
    function done() { loading = false; btn.classList.remove('is-loading'); }
    fetch(SRC).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.arrayBuffer();
    }).then(function (ab) {
      return new Promise(function (res, rej) {
        // 구형 Safari 는 Promise 를 돌려주지 않아 콜백도 같이 넘깁니다
        var p = actx.decodeAudioData(ab, res, rej);
        if (p && p.then) p.then(res, rej);
      });
    }).then(function (b) {
      buffer = b; done(); ok();
    })['catch'](function () {
      done(); fail();
    });
  }

  function bgmOn(fromOffset) {
    if (playing || loading || failed) return;
    var at = (typeof fromOffset === 'number') ? fromOffset : resumeOffset();
    ensureCtx();
    loadBuffer(function () {
      if (actx.state === 'suspended') actx.resume();
      startNode(at);
      fadeTo(GAIN);
      setState(true);
      try { localStorage.setItem(KEY_ON, '1'); } catch (e) {}
      if (typeof gtag === 'function') gtag('event', 'bgm_toggle', { state: 'on' });
    }, function () {
      // 파일을 못 불러오면 조용히 버튼을 비활성화합니다 (페이지는 그대로 동작)
      failed = true;
      btn.disabled = true;
      setState(false);
    });
  }

  function bgmOff() {
    if (!playing) return;
    savePos();
    fadeTo(0);
    setState(false);
    setTimeout(function () {
      if (!playing && actx && actx.state === 'running') actx.suspend();
    }, (FADE + 0.05) * 1000);
    try { localStorage.setItem(KEY_ON, '0'); } catch (e) {}
    try { sessionStorage.removeItem(KEY_POS); } catch (e) {}
    if (typeof gtag === 'function') gtag('event', 'bgm_toggle', { state: 'off' });
  }

  btn.addEventListener('click', function () {
    if (loading || failed) return;
    if (playing) bgmOff(); else bgmOn();
  });

  // 탭을 벗어나면 소리를 멈춥니다 (버튼은 켜짐 상태를 유지 → 돌아오면 이어서 재생)
  document.addEventListener('visibilitychange', function () {
    if (!actx || failed || !playing) return;
    if (document.hidden) {
      savePos();
      if (actx.state === 'running') { gainNode.gain.value = 0; actx.suspend(); }
    } else if (actx.state === 'suspended') {
      actx.resume(); fadeTo(GAIN);
    }
  });

  // 페이지를 떠나기 직전에 위치를 남깁니다. pagehide 는 bfcache 로 들어갈 때도
  // 불리고 모바일 사파리에서 beforeunload 보다 믿을 만합니다.
  window.addEventListener('pagehide', savePos);
  // 브라우저가 종료 직전 이벤트를 건너뛰는 경우를 대비한 보험
  setInterval(savePos, 5000);

  // ── 시작 ───────────────────────────────────────────────
  // 기본값은 '켜짐'입니다. 직접 끈 적이 있는 사람만 그 선택을 유지합니다.
  var wanted = true;
  try {
    var saved = localStorage.getItem(KEY_ON);
    if (saved !== null) wanted = (saved === '1');
  } catch (e) {}

  if (wanted) {
    ensureCtx();
    if (actx.state === 'running') bgmOn();   // 자동재생이 허용된 상태 → 바로 시작

    var EVTS = ['pointerdown', 'keydown', 'touchstart'];
    var detach = function () {
      EVTS.forEach(function (t) { document.removeEventListener(t, arm, true); });
    };
    var arm = function (e) {
      detach();
      // 버튼 자체를 누른 경우엔 위의 click 핸들러가 처리하도록 비켜줍니다
      if (e && e.target && e.target.closest && e.target.closest('#bgm')) return;
      bgmOn();   // 이미 재생 중이거나 불러오는 중이면 내부에서 무시됩니다
    };
    EVTS.forEach(function (t) { document.addEventListener(t, arm, true); });
  }
})();
