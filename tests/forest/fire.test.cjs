const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const html = fs.readFileSync(process.env.FOREST_QA_SOURCE || path.join(__dirname, '../../experience/mind-forest.html'), 'utf8');
const fireSource = html.slice(html.indexOf('  function beginFire() {'), html.indexOf('  function makePhotoDecoration() {'));
const stateSource = html.slice(html.indexOf('  let fireTracksHand ='), html.indexOf('  function flashScreen() {'));
const stageSource = html.slice(html.indexOf('  function showFinale(name) {'), html.indexOf('  async function beginFinale() {'));
assert.ok(fireSource.includes('function moveCameraEmber'));

function handTracker() {
  const source=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]).find(s=>s.includes('/* Local webcam hand tracking.'));
  const context=vm.createContext({});context.window=context;vm.runInContext(source,context);
  return context.ForestHandTracking.createHandTracker();
}

function setup(width = 1000, height = 800) {
  let now = 0, serial = 0;
  const timers = new Map(), captures = new Set(), videos = [];
  function element(rect = {}) {
    const classes = new Set(), properties = new Map();
    return {hidden: false, disabled: false, dataset: {}, textContent: '', childElementCount: 1,
      style: {transform: '', setProperty: (key, value) => properties.set(key, value), getPropertyValue: key => properties.get(key)},
      classList: {add: name => classes.add(name), remove: name => classes.delete(name), contains: name => classes.has(name), toggle: (name,on) => on ? classes.add(name) : classes.delete(name)},
      setAttribute(key, value) { this[key] = value; }, getBoundingClientRect: () => rect,
      contains: () => false, querySelectorAll: () => [], focus() {},
      animate: () => ({cancel() {}}), setPointerCapture: id => captures.add(id),
      hasPointerCapture: id => captures.has(id), releasePointerCapture: id => captures.delete(id)};
  }
  const field = element({left: 0, top: 0, width, height, right: width, bottom: height});
  const pad = element({left: width / 2 - 100, top: height / 2 - 120, width: 200, height: 240});
  const light = element();
  const context = vm.createContext({console, Math, stage: 'forest', fireTimer: 0, idleTimer: 0,
    cameraActive: false, hand: {}, reducedMotion: {matches: true}, finaleIdleMs: 180000,
    emberPlayfield: field, emberLight: light, firePad: pad, fireFlare: element(), fireHandCursors: Array.from({length:4}, () => element()),
    fireGuide: element(), fireProgress: element(), fireCamera: element(), fireHome: element(),
    experience: element(), finale: element(), finaleSections: {fire: field, video: element(), photo: element()},
    photoTake: {disabled: false}, photoCaptured: false, photoResult: {hidden: true},
    document: {hidden: false, getElementById: () => element()}, audio: {isMuted: () => true, setPaused() {}},
    help: {hidden: true}, helpToggle: element(),
    syncGuideMusic() {}, syncCampfireAudio() {}, syncCameraPause() {}, returnToOpening() {},
    playFinaleVideo: part => { videos.push(part); context.showFinale('video'); },
    clamp: (value, min, max) => Math.max(min, Math.min(max, value)),
    setTimeout: (callback, delay) => { timers.set(++serial, {callback, at: now + delay}); return serial; },
    clearTimeout: id => timers.delete(id)});
  vm.runInContext(stateSource + stageSource + fireSource + `
    globalThis.state = () => ({delivered:fireDelivered,pickup:firePickup,stepTimer:fireStepTimer,pinchTimer:firePinchTimer,fireTimer,stage});
  `, context);
  context.beginFire();
  return {api: context, field, light, pad, videos, captures, timers,
    center: {x: width / 2, y: height / 2},
    get state() { return context.state(); },
    pointer(type, x, y, id = 1, pointerType = 'mouse') {
      context.moveEmber({type, clientX: x, clientY: y, pointerId: id, pointerType,
        isPrimary: true, button: 0, buttons: type === 'pointerup' ? 0 : 1, preventDefault() {}});
    },
    feed(hands) { context.moveCameraEmber(hands.map(point => ({...point, x: point.x / width, y: point.y / height}))); },
    advance(ms) {
      const end = now + ms;
      for (;;) {
        const next = [...timers.entries()].filter(([, timer]) => timer.at <= end).sort((a,b) => a[1].at - b[1].at)[0];
        if (!next) break;
        now = next[1].at; timers.delete(next[0]); next[1].callback();
      }
      now = end;
    }};
}

function dragToFire(qa, pointerType = 'mouse') {
  const origin = qa.api.fireOrigin(), {x, y} = qa.center;
  qa.pointer('pointerdown', origin.x, origin.y, 1, pointerType);
  qa.pointer('pointermove', x, y, 1, pointerType);
  qa.pointer('pointerup', x, y, 1, pointerType);
}

test('four corners appear in order and each completed drag grows the fire once', () => {
  const qa = setup(), corners = [], sizes = [Number(qa.field.style.getPropertyValue('--fire-growth'))];
  for (let delivery = 0; delivery < 4; delivery++) {
    const origin = qa.api.fireOrigin();
    corners.push([origin.x > qa.center.x, origin.y > qa.center.y]);
    assert.equal(qa.light.dataset.corner, String(delivery + 1));
    assert.equal(qa.field.classList.contains('is-kindled'), false);
    dragToFire(qa, delivery % 2 ? 'touch' : 'mouse');
    assert.equal(qa.state.delivered, delivery + 1);
    sizes.push(Number(qa.field.style.getPropertyValue('--fire-growth')));
    assert.equal(qa.field.classList.contains('is-kindled'), true);
    assert.equal(qa.captures.size, 0);
    if (delivery < 3) qa.advance(700);
  }
  assert.deepEqual(corners, [[false,false],[true,false],[true,true],[false,true]]);
  assert.ok(sizes.every((size, index) => index === 0 || size > sizes[index - 1]));
  assert.equal(qa.videos.length, 0, 'the largest fire remains visible before continuing');
  qa.advance(899); assert.equal(qa.videos.length, 0);
  qa.advance(1); assert.deepEqual(qa.videos, [2], 'only the fourth delivery continues the existing second video');
});

test('hovering or clicking the fire cannot teleport a light from its corner', () => {
  const qa = setup(), {x,y} = qa.center;
  qa.pointer('pointermove', x, y);
  qa.pointer('pointerdown', x, y);
  qa.pointer('pointerup', x, y);
  qa.api.liftEmbers();
  assert.equal(qa.state.delivered, 0);
  assert.equal(qa.state.pickup, null);
  const origin = qa.api.fireOrigin();
  qa.pointer('pointerdown', origin.x, origin.y);
  qa.pointer('pointermove', x, y);
  assert.equal(qa.state.delivered, 0, 'a pointer drag must be released over the fire');
  qa.pointer('pointerup', x, y);
  assert.equal(qa.state.delivered, 1);
});

test('a different pointer cannot steal a drag and an outside drop returns the light', () => {
  const qa = setup(), origin = qa.api.fireOrigin(), {x,y} = qa.center;
  qa.pointer('pointerdown', origin.x, origin.y, 7, 'touch');
  qa.pointer('pointerup', x, y, 8, 'touch');
  assert.equal(qa.state.delivered, 0);
  assert.equal(qa.state.pickup.id, 7);
  qa.pointer('pointerup', origin.x + 60, origin.y, 7, 'touch');
  assert.equal(qa.state.pickup, null);
  assert.equal(qa.light.classList.contains('is-waiting'), true);
});

const pinchPoint = (id, position, pinch = false, sequence = 0, extra = {}) =>
  ({id, ...position, pinch, pinchSequence: sequence, pinchValid: true, held: false, reset: false, ...extra});

test('a fresh pinch at the corner flies to the fire without dragging', () => {
  const qa = setup(), origin = qa.api.fireOrigin();
  qa.feed([pinchPoint(2, origin, true, 4)]);
  assert.equal(qa.state.pickup, null, 'entering with fingers already closed is not a new pinch');
  qa.feed([pinchPoint(2, origin, false, 4)]);
  assert.equal(qa.light.classList.contains('is-reachable'), true);
  qa.feed([pinchPoint(2, origin, true, 5)]);
  assert.equal(qa.state.pickup.kind, 'pinch');
  assert.equal(qa.state.pickup.id, 2);
  assert.equal(qa.state.delivered, 0, 'the accepted light flies before the fire grows');
  qa.advance(119); assert.equal(qa.state.delivered, 0);
  qa.advance(1); assert.equal(qa.state.delivered, 1);
});

test('hovering, moving a hand, or bringing an old pinch to the corner cannot add a light', () => {
  const qa = setup(), origin = qa.api.fireOrigin();
  qa.feed([pinchPoint(1, origin)]);
  qa.feed([pinchPoint(1, qa.center)]);
  assert.equal(qa.state.pickup, null);
  qa.feed([pinchPoint(1, qa.center, true, 1)]);
  qa.feed([pinchPoint(1, origin, true, 1)]);
  assert.equal(qa.state.pickup, null, 'a pinch must begin at the active light');
  qa.feed([pinchPoint(1, origin, false, 1)]);
  qa.feed([pinchPoint(1, origin, true, 2)]);
  qa.advance(120); assert.equal(qa.state.delivered, 1);
});

test('simultaneous pinches count once and gestures made during flight or cooldown are consumed', () => {
  const qa = setup(), first = qa.api.fireOrigin();
  qa.feed([pinchPoint(0, first), pinchPoint(1, first)]);
  qa.feed([pinchPoint(0, first, true, 1), pinchPoint(1, first, true, 2)]);
  qa.api.liftEmbers(true); // A keyboard action cannot bypass the flight.
  qa.advance(120); assert.equal(qa.state.delivered, 1);
  const second = qa.api.fireOrigin();
  qa.feed([pinchPoint(1, second, false, 2)]);
  qa.feed([pinchPoint(1, second, true, 3)]);
  qa.advance(700);
  for (let i = 0; i < 20; i++) qa.feed([pinchPoint(1, second, true, 3)]);
  assert.equal(qa.state.delivered, 1);
  assert.equal(qa.state.pickup, null, 'the old pinch cannot be replayed at the next corner');
  qa.feed([pinchPoint(1, second, false, 3)]);
  qa.feed([pinchPoint(1, second, true, 4)]);
  qa.advance(120); assert.equal(qa.state.delivered, 2);
});

test('held, invalid, reset, and missing observations require a fresh open before another pinch', () => {
  for (const gap of ['held', 'invalid', 'reset', 'missing']) {
    const qa = setup(), origin = qa.api.fireOrigin();
    qa.feed([pinchPoint(3, origin)]);
    qa.feed(gap === 'missing' ? [] : [pinchPoint(3, origin, true, 1,
      gap === 'invalid' ? {pinchValid:false} : {[gap]:true})]);
    qa.feed([pinchPoint(3, origin, true, 2)]);
    assert.equal(qa.state.pickup, null, gap + ' must not trigger a delayed gesture');
    qa.feed([pinchPoint(3, origin, false, 2)]);
    qa.feed([pinchPoint(3, origin, true, 3)]);
    qa.advance(120); assert.equal(qa.state.delivered, 1);
  }
});

test('four people can pinch their corners in turn and only the fourth advances the story', () => {
  const qa = setup();
  for (let id = 0; id < 4; id++) {
    const origin = qa.api.fireOrigin();
    qa.feed([pinchPoint(id, origin)]);
    qa.feed([pinchPoint(id, origin, true, id + 1)]);
    qa.advance(120);
    assert.equal(qa.state.delivered, id + 1);
    assert.equal(qa.videos.length, 0);
    if (id < 3) qa.advance(700);
  }
  qa.advance(900); assert.deepEqual(qa.videos, [2]);
});

test('leaving during a pinch flight cancels its delivery and clears the next session gesture state', () => {
  const qa = setup(), origin = qa.api.fireOrigin();
  qa.feed([pinchPoint(0, origin)]);
  qa.feed([pinchPoint(0, origin, true, 1)]);
  qa.api.showFinale('photo');
  qa.advance(1000); assert.equal(qa.state.delivered, 0);
  qa.api.beginFire();
  qa.feed([pinchPoint(0, origin, true, 1)]);
  assert.equal(qa.state.pickup, null);
});

test('keyboard activation counts separate presses, ignores repeats and respects delivery cooldown', () => {
  const qa = setup(), key = (name, repeat = false) => ({key: name, repeat, preventDefault() {}});
  qa.api.fireKeyDown(key('Enter'));
  assert.equal(qa.state.delivered, 1);
  qa.api.fireKeyDown(key('Enter', true));
  qa.advance(700);
  qa.api.fireKeyDown(key('Enter', true));
  qa.api.fireKeyDown(key('Enter'));
  assert.equal(qa.state.delivered, 1, 'a held key must not fill the next corner');
  qa.api.fireKeyUp(key('Enter'));
  qa.api.fireKeyDown(key(' ')); qa.api.fireKeyUp(key(' '));
  assert.equal(qa.state.delivered, 2);
  qa.api.liftEmbers(true);
  assert.equal(qa.state.delivered, 2);
  qa.advance(700);
  qa.api.liftEmbers(true);
  assert.equal(qa.state.delivered, 3, 'assistive-technology click activation is still available');
});

test('leaving and restarting the stage cancels pending corner and final transitions', () => {
  const qa = setup();
  dragToFire(qa);
  const pending = [...qa.timers.values()].map(timer => timer.callback);
  qa.api.showFinale('photo');
  qa.api.beginFire();
  pending.forEach(callback => callback());
  assert.equal(qa.state.delivered, 0);
  assert.equal(qa.light.dataset.corner, '1');
  for (let i = 0; i < 4; i++) { dragToFire(qa); if (i < 3) qa.advance(700); }
  qa.api.showFinale('photo');
  qa.advance(3000);
  assert.equal(qa.videos.length, 0);
  qa.api.beginFire();
  assert.equal(qa.pad.disabled, false);
  assert.equal(qa.state.delivered, 0);
});

test('corner pickup zones remain inside narrow portrait screens and above footer controls', () => {
  for (const [width,height] of [[320,568],[360,640],[390,844],[430,932]]) {
    const qa = setup(width,height);
    for (let i = 0; i < 4; i++) {
      const origin = qa.api.fireOrigin();
      assert.ok(origin.x >= 44 && origin.x <= width - 44);
      assert.ok(origin.y >= 130 && origin.y <= height - 110);
      qa.api.liftEmbers(true); if (i < 3) qa.advance(700);
    }
  }
});

test('one hand jumping across the screen never shows a second cursor at its held old position',()=>{
  const qa=setup(),tracker=handTracker();
  const raw=x=>({x,y:.5,wristX:x,wristY:.7,pinchRatio:.6});
  tracker.push([raw(.2)],0);
  qa.api.moveCameraEmber(tracker.push([raw(.2)],50));
  assert.equal(qa.api.fireHandCursors.filter(c=>!c.hidden).length,1);
  tracker.push([raw(.8)],100);
  const crossing=tracker.push([raw(.8)],150);
  assert.equal(crossing.length,2,'reproduce the old held point alongside the newly observed hand');
  assert.equal(crossing.filter(p=>p.held).length,1);
  qa.api.moveCameraEmber(crossing);
  assert.equal(qa.api.fireHandCursors.filter(c=>!c.hidden).length,1);
  for(let time=200;time<=1200;time+=50){
    qa.api.moveCameraEmber(tracker.push([raw(Math.floor(time/100)%2?.2:.8)],time));
    assert.ok(qa.api.fireHandCursors.filter(c=>!c.hidden).length<=1);
  }
});

test('four observed hands keep four cursors while a missing hand is hidden immediately',()=>{
  const qa=setup(),tracker=handTracker();
  const raw=[.12,.37,.63,.88].map(x=>({x,y:.5,wristX:x,wristY:.7,pinchRatio:.6}));
  tracker.push(raw,0);qa.api.moveCameraEmber(tracker.push(raw,50));
  assert.equal(qa.api.fireHandCursors.filter(c=>!c.hidden).length,4);
  qa.api.moveCameraEmber(tracker.push(raw.slice(1),100));
  assert.equal(qa.api.fireHandCursors.filter(c=>!c.hidden).length,3);
  qa.api.moveCameraEmber(tracker.push([],150));
  assert.equal(qa.api.fireHandCursors.filter(c=>!c.hidden).length,0);
});
