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
function element(attributes = {}) {
  return {hidden: false, disabled: false, textContent: '', ...attributes,
    setAttribute(key, value) { this[key] = value; },
    removeAttribute(key) { delete this[key]; },
    hasAttribute(key) { return Object.hasOwn(this,key); },
    focus() { this.focused = true; }};
}
function videoSetup(config = null) {
  const calls = {play: 0, config: 0, unavailable: 0};
  const context = vm.createContext({
    flowVersion: 1, activeVideoPart: 0, stage: 'forest', videoTimer: 0,
    resolvedFinaleConfig: config, localStoryVideos: ['/local-first.mp4', '/local-second.mp4'],
    videoPlaceholder: element(), videoMessage: element({textContent: 'previous error'}),
    finaleVideo: element({hidden: true, dataset: {}, play: async () => { calls.play++; }}),
    audio: {isMuted: () => false},
    getFinaleConfig() { calls.config++; return new Promise(() => {}); },
    showFinale(name) { context.stage = name; },
    setTimeout: () => 1,
    videoUnavailable() { calls.unavailable++; },
  });
  vm.runInContext(sourceFunction('playFinaleVideo'), context);
  return {api: context, calls};
}

test('story playback starts the bundled video immediately even when the photo service cannot resolve', async () => {
  for (const part of [1, 2]) {
    const qa = videoSetup();
    const playback = qa.api.playFinaleVideo(part);
    assert.equal(qa.calls.play, 1, 'play must start before any configuration promise resolves');
    assert.equal(qa.calls.config, 0, 'photo configuration must not block the transition');
    assert.equal(qa.api.finaleVideo.src, part === 1 ? '/local-first.mp4' : '/local-second.mp4');
    assert.equal(qa.api.videoPlaceholder.hidden, true);
    assert.equal(qa.api.videoMessage.textContent, '');
    assert.equal(qa.api.finaleVideo.hidden, false);
    await playback;
  }
});

test('prefetched story overrides and an explicit first video are used without waiting for another lookup', async () => {
  const qa = videoSetup({storyVideos: ['/configured-first.mp4', '/configured-second.mp4']});
  await qa.api.playFinaleVideo(1);
  assert.equal(qa.api.finaleVideo.src, '/configured-first.mp4');
  await qa.api.playFinaleVideo(2);
  assert.equal(qa.api.finaleVideo.src, '/configured-second.mp4');
  qa.api.finaleVideo.dataset.src = '/explicit-first.mp4';
  await qa.api.playFinaleVideo(1);
  assert.equal(qa.api.finaleVideo.src, '/explicit-first.mp4');
  assert.equal(qa.calls.config, 0);
});

function photoSetup() {
  let serial = 20;
  const timers = new Map([[10, 'old return interval'], [11, 'old auto photo'], [12, 'old idle return']]);
  const calls = {stoppedAudio: 0, stoppedCamera: 0, preview: 0, draw: 0, revoked: [], idle: 0, capture: 0};
  const context = vm.createContext({
    stage: 'photo', flowVersion: 3, photoCaptured: true, photoPreviewReady: true, photoPersonMode: 'mediapipe',
    photoBackdropIndex: 0, photoBackdropChosen: true, photoBackdropLocked: true, photoBackdropCandidate: 2,
    returnTimer: 10, photoAutoTimer: 11, idleTimer: 12, photoAutoDelay: 7000,
    photoObjectURL: 'blob:previous-photo', document: {hidden: false}, help: {hidden: true},
    photoResult: element(), photoPrepare: element({hidden: true}),
    photoTake: element({disabled: true}), photoMessage: element(),
    photoCountdown: element({textContent: '찰칵!'}), photoReturn: element({textContent: '2초 후에 처음으로 돌아갑니다.'}),
    photoDownload: element({href: 'blob:previous-photo'}), photoQr: element({src: 'data:image/old-qr'}),
    clearInterval: id => timers.delete(id), clearTimeout: id => timers.delete(id),
    setTimeout(callback, delay) { timers.set(++serial, {callback, delay}); return serial; },
    audio: {stopAll() { calls.stoppedAudio++; }},
    stopPhotoCamera() { calls.stoppedCamera++; context.photoPreviewReady = false; },
    URL: {revokeObjectURL: url => calls.revoked.push(url)},
    showFinale(name) { context.stage = name; },
    scheduleFinaleIdleReturn() { calls.idle++; context.idleTimer = ++serial; timers.set(serial, 'new idle return'); },
    drawGroupPhoto() { calls.draw++; }, preparePhotoPreview: async () => { calls.preview++; },
    takePhoto: async () => { calls.capture++; },
  });
  vm.runInContext(['beginPhoto', 'retakePhoto', 'scheduleAutoPhoto'].map(sourceFunction).join('\n'), context);
  return {api: context, timers, calls, include(name) { vm.runInContext(sourceFunction(name), context); }};
}

test('retaking clears the old photo and its return timers before opening a fresh preview', () => {
  const qa = photoSetup();
  qa.api.retakePhoto();
  assert.equal(qa.api.flowVersion, 4, 'old asynchronous captures and shares are invalidated');
  for (const id of [10, 11, 12]) assert.equal(qa.timers.has(id), false, 'the previous session timer must be cancelled');
  assert.deepEqual(qa.calls.revoked, ['blob:previous-photo']);
  assert.equal(qa.api.photoObjectURL, null);
  assert.equal(qa.api.photoDownload.href, undefined);
  assert.equal(qa.api.photoQr.src, undefined); assert.equal(qa.api.photoQr.hidden, true);
  assert.equal(qa.api.photoReturn.textContent, ''); assert.equal(qa.api.photoCountdown.textContent, '');
  assert.equal(qa.api.photoResult.hidden, true); assert.equal(qa.api.photoPrepare.hidden, false);
  assert.equal(qa.api.photoCaptured, false); assert.equal(qa.api.photoTake.disabled, false);
  assert.equal(qa.api.photoTake.focused, true);
  assert.equal(qa.calls.preview, 1); assert.equal(qa.calls.draw, 1); assert.equal(qa.calls.idle, 1);
  assert.equal(qa.calls.stoppedCamera, 1); assert.equal(qa.calls.stoppedAudio, 1);
  qa.api.retakePhoto();
  assert.equal(qa.api.flowVersion, 4, 'a repeated retake event cannot restart the preview twice');
  assert.equal(qa.calls.preview, 1);
});

test('help and completed results cannot start another automatic or manual capture', async () => {
  for (const scenario of ['help', 'result']) {
    const qa = photoSetup();
    qa.api.photoTake.disabled = false;
    if (scenario === 'help') {
      qa.api.photoCaptured = false; qa.api.photoResult.hidden = true; qa.api.help.hidden = false;
    }
    qa.api.scheduleAutoPhoto();
    assert.equal(qa.timers.has(11), false);
    assert.equal([...qa.timers.values()].some(timer => typeof timer === 'object'), false);
    qa.include('takePhoto');
    await qa.api.takePhoto(true); await qa.api.takePhoto(false);
    assert.equal(qa.calls.idle, 0, 'blocked captures must not restart any session work');
    assert.equal(qa.api.photoTake.disabled, false);
  }
  const qa = photoSetup();
  qa.api.photoCaptured = false; qa.api.photoResult.hidden = true; qa.api.photoTake.disabled = false;
  qa.api.scheduleAutoPhoto();
  const scheduled = qa.timers.get(qa.api.photoAutoTimer);
  assert.equal(scheduled.delay, 7000);
  await scheduled.callback(); assert.equal(qa.calls.capture, 1, 'a ready preview still receives its normal automatic capture');
});

test('automatic capture waits for a valid person mask, and a failed manual attempt releases the shutter',async()=>{
  for(const mode of ['loading','error']){
    const qa=photoSetup();
    Object.assign(qa.api,{photoCaptured:false,photoResult:element({hidden:true}),photoTake:element(),photoPersonMode:mode,
      updateCameraOrientationButtons(){},preparePhotoCamera:async()=>true,refreshPhotoForeground:async()=>false});
    qa.api.scheduleAutoPhoto();
    assert.equal([...qa.timers.values()].some(timer=>typeof timer==='object'),false);
    qa.include('takePhoto');await qa.api.takePhoto();
    assert.equal(qa.api.photoTake.disabled,false);
    assert.equal(qa.api.photoCountdown.hidden,true);
    assert.equal(qa.api.photoCaptured,false);assert.equal(qa.calls.draw,0);
    assert.equal(qa.api.photoBackdropLocked,false);
  }
});

test('mobile photo results offer direct download while desktop retains the QR and matching instructions',()=>{
  const qa=photoSetup();qa.api.mobilePhotoLayout={matches:true};
  qa.include('updatePhotoResultPresentation');qa.api.updatePhotoResultPresentation();
  assert.equal(qa.api.photoQr.hidden,true);
  assert.match(qa.api.photoMessage.textContent,/다운로드 버튼/);
  assert.doesNotMatch(qa.api.photoMessage.textContent,/QR/);
  assert.equal(qa.api.photoDownload.href,'blob:previous-photo');
  qa.api.mobilePhotoLayout.matches=false;qa.api.updatePhotoResultPresentation();
  assert.equal(qa.api.photoQr.hidden,false);assert.match(qa.api.photoMessage.textContent,/QR/);
  qa.api.photoQr.removeAttribute('src');qa.api.mobilePhotoLayout.matches=true;
  qa.api.updatePhotoResultPresentation();
  assert.match(qa.api.photoMessage.textContent,/다운로드 버튼/,'mobile does not need a successful QR upload');
  qa.api.mobilePhotoLayout.matches=false;qa.api.updatePhotoResultPresentation();
  assert.equal(qa.api.photoQr.hidden,true);assert.match(qa.api.photoMessage.textContent,/아래 버튼/);
  qa.api.photoResult.hidden=true;qa.api.photoMessage.textContent='촬영 준비';
  qa.api.updatePhotoResultPresentation();assert.equal(qa.api.photoMessage.textContent,'촬영 준비');
});
