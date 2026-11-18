const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const html = fs.readFileSync(process.env.FOREST_QA_SOURCE || path.join(__dirname, '../../experience/mind-forest.html'), 'utf8');
const app = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map(match => match[1]).find(script => script.includes('/* 김심리월드 · 고요한 숲.'));
function sourceFunction(name) {
  const start = app.search(new RegExp('^  (?:async )?function ' + name + '\\(', 'm'));
  assert.ok(start >= 0, name);
  const rest = app.slice(start), next = rest.slice(1).search(/\n  (?:async )?function /);
  return next < 0 ? rest : rest.slice(0, next + 1);
}
const keySource = app.slice(app.indexOf("  document.addEventListener('keydown',e=>{"), app.indexOf("  document.addEventListener('keyup',e=>keys.delete(e.key));"));
function element(properties = {}) {
  return {hidden: false, dataset: {}, textContent: '', ...properties,
    setAttribute(key, value) { this[key] = value; }, focus() {},
    classList: {remove() {}, add() {}}};
}
function setup() {
  const calls = [], timers = new Map();
  let keydown, serial = 100;
  const context = vm.createContext({
    stage: 'forest', started: true, activeVideoPart: 0, encounterVersion: 4,
    openingScreen: element({hidden: true}), help: element({hidden: true}), idleTimer: 10,
    cameraActive: false,
    document: {addEventListener(type, listener) { if (type === 'keydown') keydown = listener; }},
    clearTimeout: id => timers.delete(id),
    setTimeout(callback, delay) { timers.set(++serial, {callback, delay}); return serial; },
    finishOpening() { calls.push('guide'); context.openingScreen.hidden = true; },
    startExperience(event) { calls.push('forest'); assert.equal(event.detail, 0); context.started = true; },
    beginFinale() { calls.push('video1'); context.stage = 'transition'; },
    finishFinaleVideo() { const next = context.activeVideoPart === 1 ? 'fire' : 'photo'; calls.push(next); context.stage = next; context.activeVideoPart = 0; },
    playFinaleVideo(part) { calls.push('video' + part); context.stage = 'video'; context.activeVideoPart = part; },
    returnToOpening() { calls.push('opening'); context.openingScreen.hidden = false; context.started = false; context.stage = 'forest'; },
    toggleHelp(open) { calls.push('help:' + open); context.help.hidden = !open; },
    toggleCamera() { calls.push('camera'); }, toggleSound() { calls.push('sound'); },
    toggleCameraMirror() { calls.push('mirror'); }, toggleFullscreen() { calls.push('fullscreen'); },
  });
  vm.runInContext(sourceFunction('advanceDemoScene') + keySource, context);
  return {api: context, calls, timers,
    include(...names) { vm.runInContext(names.map(sourceFunction).join('\n'), context); },
    press(properties = {}) {
      const event = {key: 'g', code: 'KeyG', repeat: false, isComposing: false,
        altKey: false, ctrlKey: false, metaKey: false,
        target: {matches: () => false, closest: () => null, isContentEditable: false},
        preventDefault() { this.prevented = true; }, ...properties};
      keydown(event); return event;
    }};
}

test('G skips the interactive quests but each story video waits for its own ending', () => {
  const qa = setup();
  qa.api.started = false; qa.api.openingScreen.hidden = false;
  qa.press(); qa.press(); qa.press();
  assert.deepEqual(qa.calls, ['guide', 'forest', 'video1']);
  assert.equal(qa.api.encounterVersion, 5, 'old character greetings are invalidated before leaving the forest');
  qa.api.stage = 'video'; qa.api.activeVideoPart = 1;
  qa.press(); qa.press({repeat: true});
  assert.deepEqual(qa.calls, ['guide', 'forest', 'video1']);
  qa.api.finishFinaleVideo();
  qa.press();
  qa.press();
  assert.deepEqual(qa.calls, ['guide', 'forest', 'video1', 'fire', 'video2']);
  qa.api.finishFinaleVideo();
  qa.press();
  assert.deepEqual(qa.calls, ['guide', 'forest', 'video1', 'fire', 'video2', 'photo', 'opening']);
});

test('physical G works with Korean input and uppercase; key fallback supports keyboards without code', () => {
  for (const event of [
    {key: 'g', code: 'KeyG'}, {key: 'G', code: 'KeyG', shiftKey: true},
    {key: 'ㅎ', code: 'KeyG'}, {key: 'g', code: ''}, {key: 'G', code: ''},
  ]) {
    const qa = setup(); assert.equal(qa.press(event).prevented, true);
    assert.deepEqual(qa.calls, ['video1']);
  }
});

test('held keys, composing, modified shortcuts and editable descendants do not skip a scene', () => {
  const editableTarget = {matches: () => false, closest: () => ({}), isContentEditable: false};
  for (const event of [
    {repeat: true}, {isComposing: true}, {ctrlKey: true}, {altKey: true}, {metaKey: true},
    {target: {matches: () => true}}, {target: editableTarget},
    {target: {matches: () => false, isContentEditable: true}},
    {key: 'x', code: 'KeyX'},
  ]) {
    const qa = setup(); qa.press(event); assert.deepEqual(qa.calls, []);
  }
});

test('G ignores an in-progress transition and closes help before advancing', () => {
  for (const state of [{stage: 'transition'}, {stage: 'video', activeVideoPart: 0}]) {
    const qa = setup(); Object.assign(qa.api, state); qa.api.help.hidden = false;
    qa.press(); assert.deepEqual(qa.calls, []);
  }
  const qa = setup(); qa.api.help.hidden = false;
  qa.press(); qa.press(); qa.press({repeat: true});
  assert.deepEqual(qa.calls, ['help:false', 'video1']);
});

test('the existing camera, sound, mirror and reset shortcuts keep their behavior', () => {
  const qa = setup();
  for (const key of ['c', 'm', 'n', 'r']) qa.press({key, code: 'Key' + key.toUpperCase()});
  assert.deepEqual(qa.calls, ['camera', 'sound', 'mirror', 'opening']);
});

test('skipping the forest invalidates dialogue before stopping audio and waits for just one video transition', async () => {
  const qa = setup(), oldEncounter = qa.api.encounterVersion;
  let staleGreeting = false;
  Object.assign(qa.api, {
    experience: element(), flowVersion: 2, controls: {}, canvas: {},
    rubGuide: element(), sleepingNotice: element(), reducedMotion: {matches: true},
    syncGuideMusic() {}, releaseLight() {}, syncCameraPause() {}, flashScreen() {},
    audio: {stopAll() { if (oldEncounter === qa.api.encounterVersion) staleGreeting = true; }},
  });
  qa.include('beginFinale');
  qa.press(); qa.press();
  assert.equal(staleGreeting, false);
  assert.equal(qa.api.stage, 'transition'); assert.equal(qa.api.flowVersion, 3);
  assert.equal(qa.timers.size, 1);
  const delay = [...qa.timers.values()][0]; delay.callback();
  await Promise.resolve(); await Promise.resolve();
  assert.deepEqual(qa.calls, ['video1']);
});

test('skipping fire cancels its queued completion, idle return, gestures and pointer capture', async () => {
  const qa = setup();
  let cancellations = 0, released = 0;
  Object.assign(qa.api, {
    stage: 'fire', flowVersion: 2, fireDelivered: 4, fireSequence: 7,
    firePinchTimer: 11, fireStepTimer: 12, fireTimer: 0,
    firePinchFlight: {cancel() { cancellations++; }}, fireBurst: {cancel() { cancellations++; }},
    firePinches: new Map([[0, {}]]), fireHandCursors: [element()], emberLight: element(),
    firePickup: {kind: 'pointer', id: 1}, fireTracksHand: true, fireKeyHeld: true, lastFireMovement: {},
    releaseFirePointer() { released++; }, reducedMotion: {matches: true},
    helpToggle: element(), experience: element(), finale: element(),
    finaleSections: {video: element(), fire: element(), photo: element()},
    updateCameraOrientationButtons() {}, syncGuideMusic() {}, syncCampfireAudio() {}, syncCameraPause() {},
    audio: {setPaused() {}, isMuted: () => true},
    resolvedFinaleConfig: null, localStoryVideos: ['/first.mp4', '/second.mp4'],
    videoPlaceholder: element(), videoMessage: element(), videoRetry: element(), videoTimer: 0,
    finaleVideo: element({play: async () => {}, dataset: {}}), videoUnavailable() {},
  });
  qa.api.document.getElementById = () => element();
  for (const id of [10, 11, 12]) qa.timers.set(id, {callback() { throw new Error('Old fire timer survived.'); }});
  qa.include('transitionFromFire', 'cancelFireInteraction', 'showFinale', 'offerRetryForSlowVideo', 'playFinaleVideo');
  qa.api.transitionFromFire();
  const oldCompletionId = qa.api.fireTimer, oldCompletion = qa.timers.get(oldCompletionId).callback;
  qa.press();
  assert.equal(qa.api.stage, 'video'); assert.equal(qa.api.activeVideoPart, 2);
  assert.equal(qa.api.finaleVideo.src, '/second.mp4');
  for (const id of [10, 11, 12, oldCompletionId]) assert.equal(qa.timers.has(id), false);
  assert.equal(qa.api.fireSequence, 8); assert.equal(cancellations, 2); assert.equal(released, 1);
  assert.equal(qa.api.firePickup, null); assert.equal(qa.api.firePinches.size, 0);
  assert.equal(qa.api.fireHandCursors[0].hidden, true);
  qa.api.stage = 'photo'; oldCompletion();
  assert.equal(qa.api.stage, 'photo', 'a stale fire callback cannot interrupt the later photo scene');
});
