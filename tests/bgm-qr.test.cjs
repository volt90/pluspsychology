const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../assets/bgm/bgm.js'), 'utf8');
const flush = async () => {
  for (let i = 0; i < 4; i++) await new Promise(setImmediate);
};

function deferred() {
  let resolve, reject;
  const promise = new Promise((ok, fail) => { resolve = ok; reject = fail; });
  return { promise, resolve, reject };
}

function harness({ visit = true, custom = true, saved = '0', blocked = false,
  delayedFetch = false, delayedDecode = false, dualLabel = true } = {}) {
  class Target {
    constructor() { this.listeners = new Map(); }
    addEventListener(type, fn) {
      if (!this.listeners.has(type)) this.listeners.set(type, new Set());
      this.listeners.get(type).add(fn);
    }
    removeEventListener(type, fn) { this.listeners.get(type)?.delete(fn); }
    emit(type, target = this) {
      for (const fn of [...(this.listeners.get(type) || [])]) fn({ target });
    }
  }
  class Button extends Target {
    constructor() {
      super();
      this.attrs = new Map();
      this.className = 'sc-music-toggle';
      this.span = { textContent: '♪', parent: this };
      this.musicLabel = { textContent: '음악 켜짐', parent: this };
      this.classList = { add() {}, remove() {} };
      this.innerHTML = 'original children';
    }
    setAttribute(name, value) { this.attrs.set(name, value); }
    getAttribute(name) { return this.attrs.get(name) ?? null; }
    removeAttribute(name) { this.attrs.delete(name); }
    querySelector(selector) {
      if (selector === '[data-music-label]' && dualLabel) return this.musicLabel;
      return selector === 'span' ? this.span : null;
    }
    contains(element) { return element === this || element === this.span || element === this.musicLabel; }
  }
  const existing = new Button();
  existing.id = 'simri-care-music-toggle';
  const appended = [], contexts = [], starts = [], fades = [], timers = [];
  const reads = [], writes = [], stored = new Map(saved === null ? [] : [['ksw_bgm', saved]]);
  const positions = new Map();
  const storage = (map, record = false) => ({
    getItem(key) { if (record) reads.push(key); return map.get(key) ?? null; },
    setItem(key, value) { if (record) writes.push([key, value]); map.set(key, value); },
    removeItem(key) { map.delete(key); }
  });
  const fetchGate = deferred(), decodeGate = deferred();
  const audioBuffer = {
    duration: 16, sampleRate: 44100,
    getChannelData() { return new Float32Array([0, 0.02, 0.01]); }
  };
  let fetchCount = 0, resumeCount = 0, observer;
  class AudioContext {
    constructor() {
      this.state = blocked ? 'suspended' : 'running';
      this.currentTime = 0;
      this.resumes = [];
      contexts.push(this);
    }
    createGain() {
      this.gain = { gain: {
        value: 0,
        cancelScheduledValues() {},
        setValueAtTime() {},
        linearRampToValueAtTime(value, at) { fades.push({ value, at }); }
      }, connect() {} };
      return this.gain;
    }
    createBufferSource() {
      const node = { connect() {}, start(time, offset) { starts.push({ node, time, offset }); } };
      return node;
    }
    decodeAudioData(_bytes, ok, fail) {
      const promise = delayedDecode ? decodeGate.promise : Promise.resolve(audioBuffer);
      promise.then(ok, fail);
      return promise;
    }
    resume() {
      resumeCount++;
      if (blocked) {
        const gate = deferred();
        this.resumes.push(gate);
        return gate.promise;
      }
      this.state = 'running';
      return Promise.resolve();
    }
    suspend() { this.state = 'suspended'; return Promise.resolve(); }
  }
  const fetch = () => {
    fetchCount++;
    return delayedFetch ? fetchGate.promise : Promise.resolve(response());
  };
  function response() {
    return { ok: true, arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)) };
  }
  const document = new Target();
  document.hidden = false;
  document.documentElement = { lang: 'ko' };
  document.currentScript = { getAttribute: name => ({
    'data-preference': visit ? 'visit' : null,
    'data-button-id': custom ? existing.id : null
  })[name] };
  document.getElementById = id => custom && id === existing.id ? existing : null;
  document.createElement = () => new Button();
  document.body = { appendChild: button => appended.push(button) };
  const window = new Target();
  Object.assign(window, { AudioContext, fetch });
  const sandbox = vm.createContext({
    window, document, fetch, Promise,
    localStorage: storage(stored, true), sessionStorage: storage(positions),
    MutationObserver: class { constructor(fn) { observer = fn; } observe() {} },
    setTimeout: fn => timers.push(fn), setInterval() {}
  });
  const run = () => vm.runInContext(source, sandbox);
  run();
  const button = custom ? existing : appended[0];
  return {
    button, existing, appended, contexts, starts, fades, reads, writes, stored,
    get fetchCount() { return fetchCount; }, get resumeCount() { return resumeCount; },
    run,
    clickMusic() { document.emit('pointerdown', button.span); button.emit('click'); },
    gesture() {
      blocked = false;
      for (const context of contexts) {
        if (context.resumes.length) context.state = 'running';
        for (const gate of context.resumes.splice(0)) gate.resolve();
      }
      document.emit('pointerdown');
    },
    hide() { document.hidden = true; document.emit('visibilitychange'); },
    show() { document.hidden = false; document.emit('visibilitychange'); },
    pagehide() { window.emit('pagehide'); },
    pageshow() { window.emit('pageshow'); },
    fetchDone() { fetchGate.resolve(response()); },
    fetchError() { fetchGate.reject(new Error('network unavailable')); },
    decodeDone() { decodeGate.resolve(audioBuffer); },
    timers() { for (const fn of timers.splice(0)) fn(); },
    language(lang) { document.documentElement.lang = lang; observer(); }
  };
}

test('QR starts ON without reading or changing the main site preference', async () => {
  const h = harness();
  assert.equal(h.button.getAttribute('aria-checked'), 'true');
  assert.equal(h.button.span.textContent, '♪');
  assert.equal(h.button.musicLabel.textContent, '음악 켜짐');
  assert.equal(h.button.getAttribute('role'), 'switch');
  assert.equal(h.button.className, 'sc-music-toggle');
  assert.equal(h.button.innerHTML, 'original children');
  assert.equal(h.appended.length, 0);
  await flush();
  assert.equal(h.button.getAttribute('data-playback'), 'playing');
  h.clickMusic();
  assert.equal(h.button.span.textContent, '♪');
  assert.equal(h.button.musicLabel.textContent, '음악 꺼짐');
  assert.deepEqual(h.reads, []);
  assert.deepEqual(h.writes, []);
  assert.equal(h.stored.get('ksw_bgm'), '0');
  const reloaded = harness();
  assert.equal(reloaded.button.getAttribute('aria-checked'), 'true');
});

test('a custom button with one span receives the full label as a fallback', () => {
  const h = harness({ dualLabel: false });
  assert.equal(h.button.span.textContent, '♪ 음악 켜짐');
  h.clickMusic();
  assert.equal(h.button.span.textContent, '♪ 음악 꺼짐');
});

test('the default page keeps its floating button, saved OFF and language labels', async () => {
  const h = harness({ visit: false, custom: false });
  assert.equal(h.appended.length, 1);
  assert.equal(h.button.id, 'bgm');
  assert.equal(h.button.className, 'bgm');
  assert.equal(h.button.getAttribute('aria-label'), '배경음악');
  assert.equal(h.button.getAttribute('aria-pressed'), 'false');
  assert.equal(h.contexts.length, 0);
  h.language('en');
  assert.equal(h.button.getAttribute('aria-label'), 'Background music');
  h.clickMusic();
  await flush();
  assert.equal(h.button.getAttribute('aria-pressed'), 'true');
  assert.equal(h.stored.get('ksw_bgm'), '1');
  h.clickMusic();
  assert.equal(h.stored.get('ksw_bgm'), '0');
});

test('autoplay pending stays enabled and the first non-music gesture starts audio', async () => {
  const h = harness({ blocked: true });
  await flush();
  assert.equal(h.button.getAttribute('aria-checked'), 'true');
  assert.equal(h.button.getAttribute('data-playback'), 'pending');
  assert.equal(h.starts.length, 0);
  h.gesture();
  await flush();
  assert.equal(h.button.getAttribute('data-playback'), 'playing');
  assert.equal(h.starts.length, 1);
});

test('pressing OFF as the first gesture cannot be undone by the autoplay fallback', async () => {
  const h = harness({ blocked: true, delayedFetch: true });
  h.clickMusic();
  h.fetchDone();
  h.gesture();
  await flush();
  assert.equal(h.button.getAttribute('aria-checked'), 'false');
  assert.equal(h.button.getAttribute('data-playback'), 'paused');
  assert.equal(h.starts.length, 0);
});

for (const phase of ['fetch', 'decode']) {
  test(`OFF while ${phase} is pending prevents a late audio start`, async () => {
    const h = harness({ delayedFetch: phase === 'fetch', delayedDecode: phase === 'decode' });
    await flush();
    h.clickMusic();
    if (phase === 'fetch') h.fetchDone(); else h.decodeDone();
    await flush();
    assert.equal(h.starts.length, 0);
    assert.equal(h.button.getAttribute('data-playback'), 'paused');
    h.clickMusic();
    await flush();
    assert.equal(h.starts.length, 1);
    assert.equal(h.fetchCount, 1);
  });
}

test('rapid OFF then ON during one download starts one source for the latest choice', async () => {
  const h = harness({ delayedFetch: true });
  h.clickMusic();
  h.clickMusic();
  h.fetchDone();
  await flush();
  h.timers();
  assert.equal(h.starts.length, 1);
  assert.equal(h.fetchCount, 1);
  assert.equal(h.contexts[0].state, 'running');
  assert.equal(h.button.getAttribute('data-playback'), 'playing');
});

test('visibility and bfcache suspend audio and resume the same loop without resetting ON', async () => {
  const h = harness();
  await flush();
  h.hide();
  assert.equal(h.contexts[0].state, 'suspended');
  assert.equal(h.button.getAttribute('aria-checked'), 'true');
  assert.equal(h.button.getAttribute('data-playback'), 'paused');
  h.show();
  await flush();
  h.pagehide();
  assert.equal(h.contexts[0].state, 'suspended');
  h.pageshow();
  await flush();
  assert.equal(h.contexts[0].state, 'running');
  assert.equal(h.starts.length, 1);
});

test('OFF is retained after visibility, bfcache and later gestures', async () => {
  const h = harness();
  await flush();
  h.clickMusic();
  h.hide(); h.show(); h.pagehide(); h.pageshow(); h.gesture();
  await flush();
  h.timers();
  assert.equal(h.button.getAttribute('aria-checked'), 'false');
  assert.equal(h.button.getAttribute('data-playback'), 'paused');
  assert.equal(h.contexts[0].state, 'suspended');
});

test('leaving during loading cannot start background audio; return resumes the cached buffer', async () => {
  const h = harness({ delayedFetch: true });
  h.hide();
  h.fetchDone();
  await flush();
  assert.equal(h.starts.length, 0);
  h.show();
  await flush();
  assert.equal(h.starts.length, 1);
  assert.equal(h.fetchCount, 1);
});

test('an unavailable track reports an error without changing the desired preference', async () => {
  const h = harness({ delayedFetch: true });
  h.fetchError();
  await flush();
  assert.equal(h.button.getAttribute('data-playback'), 'error');
  assert.equal(h.button.getAttribute('aria-checked'), 'true');
  assert.equal(h.button.disabled, true);
  assert.equal(h.starts.length, 0);
});

test('the common track retains its loop timing and volume and initializes only once', async () => {
  const h = harness();
  h.run();
  await flush();
  assert.equal(h.contexts.length, 1);
  assert.equal(h.fetchCount, 1);
  assert.equal(h.starts.length, 1);
  const { node } = h.starts[0];
  assert.equal(node.loop, true);
  assert.ok(Math.abs(node.loopEnd - node.loopStart - 15.73771) < 1e-10);
  assert.equal(h.fades[0].value, 0.28);
  assert.equal(h.fades[0].at, 0.45);
});
