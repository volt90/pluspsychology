const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const file = process.env.FOREST_QA_SOURCE || path.join(__dirname, '../../experience/mind-forest.html');
const html = fs.readFileSync(file, 'utf8');
const scripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
const source = scripts.find(s=>s.includes('/* Local webcam hand tracking.'));
assert.ok(source);
function setup({mediaDevices}={}) {
  let now = 0, id = 0;
  const animations = new Map(), workers = [], points = [], states = [], blobs = new Map();
  const track = {enabled:true,stopped:false,stop(){this.stopped=true;}};
  const stream = {getTracks:()=>[track],getVideoTracks:()=>[track]};
  const video = {readyState:4,currentTime:0,play:async()=>{},pause(){},srcObject:null};
  class Worker {
    constructor(url){workers.push(this);this.sent=[];this.script=blobs.get(url);}
    postMessage(message){this.sent.push(message);if(message.type==='init')queueMicrotask(()=>this.onmessage({data:{type:'ready'}}));}
    result(points, timestamp=this.sent.at(-1).timestamp){this.onmessage({data:{type:'result',points,timestamp}});}
    terminate(){this.terminated=true;}
  }
  class FakeURL extends URL {static createObjectURL(blob){const url='blob:qa/'+blobs.size;blobs.set(url,blob);return url;}static revokeObjectURL(){}}
  const context = vm.createContext({console,Blob,URL:FakeURL,Worker,OffscreenCanvas:class{},
    createImageBitmap:async()=>({close(){}}),performance:{now:()=>now},
    document:{hidden:false,baseURI:'http://localhost/'},navigator:{mediaDevices:mediaDevices??{getUserMedia:async()=>stream}},
    requestAnimationFrame:callback=>{animations.set(++id,callback);return id;},cancelAnimationFrame:id=>animations.delete(id),
    setTimeout:()=>++id,clearTimeout(){},isSecureContext:true});
  context.window=context;vm.runInContext(source,context);
  const api=context.ForestHandTracking;
  const controller=api.create({video,onPoints:next=>points.push(next),onState:s=>states.push(s)});
  return {api,controller,video,track,points,states,context,workers,
    async tick(time){now=time;video.currentTime=time/1000;const callbacks=[...animations.values()];animations.clear();for(const cb of callbacks)cb(time);await new Promise(setImmediate);},
    result(next){workers.at(-1).result(next);}};
}
test('all inline scripts parse',()=>{for(const s of scripts)if(!s.trim().startsWith('{'))new vm.Script(s);});

test('an unreadable default camera falls back sequentially to another video device',async()=>{
  const calls=[],events=[],stream={getTracks:()=>[]};
  let activeRequests=0,maxActiveRequests=0;
  const devices={
    async getUserMedia(constraints){
      calls.push(constraints);
      const deviceId=constraints.video?.deviceId?.exact;
      events.push(deviceId??(constraints.video===true?'default':'preferred'));
      maxActiveRequests=Math.max(maxActiveRequests,++activeRequests);
      await Promise.resolve();
      activeRequests--;
      if(deviceId==='available-camera')return stream;
      throw Object.assign(new Error('Camera is unavailable.'),{name:'NotReadableError'});
    },
    async enumerateDevices(){
      events.push('enumerate');
      return [
        {kind:'audioinput',deviceId:'microphone'},
        {kind:'videoinput',deviceId:'busy-camera'},
        {kind:'videoinput',deviceId:'busy-camera'},
        {kind:'videoinput',deviceId:''},
        {kind:'videoinput',deviceId:'available-camera'},
        {kind:'videoinput',deviceId:'unnecessary-camera'}
      ];
    }
  };
  assert.equal(await setup({mediaDevices:devices}).api.requestCamera(),stream);
  assert.deepEqual(events,['preferred','default','enumerate','busy-camera','available-camera']);
  assert.equal(maxActiveRequests,1,'camera attempts must not compete for the same device');
  assert.ok(calls.every(constraints=>constraints.audio===false),'fallback must not request a microphone');
});

test('camera permission denial stops retries without enumerating devices',async()=>{
  for(const denyAt of [1,2]){
    const denial=Object.assign(new Error('Permission denied.'),{name:'NotAllowedError'});
    let requests=0,enumerations=0;
    const {api}=setup({mediaDevices:{
      async getUserMedia(){
        if(++requests===denyAt)throw denial;
        throw Object.assign(new Error('Device is busy.'),{name:'NotReadableError'});
      },
      async enumerateDevices(){enumerations++;return [{kind:'videoinput',deviceId:'other-camera'}];}
    }});
    await assert.rejects(api.requestCamera(),error=>error===denial);
    assert.equal(requests,denyAt);
    assert.equal(enumerations,0,'a permission refusal must not trigger device discovery');
  }
});

test('a cancelled camera request never starts a device or retries a failed request',async()=>{
  let current=false,requests=0,enumerations=0,rejectRequest;
  const {api}=setup({mediaDevices:{
    getUserMedia(){
      requests++;
      if(!current)return Promise.reject(Object.assign(new Error('A cancelled request reached the camera.'),{name:'NotReadableError'}));
      return new Promise((resolve,reject)=>{rejectRequest=reject;});
    },
    async enumerateDevices(){enumerations++;return [];}
  }});
  await assert.rejects(api.requestCamera(()=>current),{name:'AbortError'});
  assert.equal(requests,0,'an already cancelled session must not prompt for the camera');
  current=true;
  const result=api.requestCamera(()=>current).catch(error=>error);
  assert.equal(requests,1);
  current=false;
  rejectRequest(Object.assign(new Error('Device is busy.'),{name:'NotReadableError'}));
  assert.equal((await result).name,'AbortError');
  assert.equal(requests,1,'a failure arriving after cancellation must not start a fallback');
  assert.equal(enumerations,0);
});

test('cancelling during device discovery prevents opening an alternate camera',async()=>{
  let current=true,requests=0,resolveDevices;
  const {api}=setup({mediaDevices:{
    async getUserMedia(){requests++;throw Object.assign(new Error('Device is busy.'),{name:'NotReadableError'});},
    enumerateDevices(){return new Promise(resolve=>{resolveDevices=resolve;});}
  }});
  const result=api.requestCamera(()=>current).catch(error=>error);
  await new Promise(setImmediate);
  assert.equal(requests,2);
  assert.equal(typeof resolveDevices,'function');
  current=false;
  resolveDevices([{kind:'videoinput',deviceId:'available-camera'}]);
  assert.equal((await result).name,'AbortError');
  assert.equal(requests,2,'a completed device list must not revive a cancelled session');
});

test('a stream arriving after cancellation releases every track, including on a fallback device',async()=>{
  for(const succeedAt of [1,3]){
    let current=true,requests=0,resolveStream;
    const tracks=[0,0].map(()=>({stops:0,stop(){this.stops++;}}));
    const stream={getTracks:()=>tracks};
    const {api}=setup({mediaDevices:{
      async getUserMedia(){
        if(++requests===succeedAt)return new Promise(resolve=>{resolveStream=resolve;});
        throw Object.assign(new Error('Device is busy.'),{name:'NotReadableError'});
      },
      async enumerateDevices(){return [{kind:'videoinput',deviceId:'available-camera'},{kind:'videoinput',deviceId:'unused-camera'}];}
    }});
    const result=api.requestCamera(()=>current).catch(error=>error);
    await new Promise(setImmediate);
    assert.equal(requests,succeedAt);
    assert.equal(typeof resolveStream,'function');
    current=false;
    resolveStream(stream);
    assert.equal((await result).name,'AbortError');
    assert.deepEqual(tracks.map(track=>track.stops),[1,1],'late camera streams must not remain active');
    assert.equal(requests,succeedAt,'disposing a late stream must not trigger another attempt');
  }
});

test('horizontal motion and camera preview use the corrected shared direction',()=>{
  const {api}=setup(),a=api.mapPoint({x:.2,y:.25}),b=api.mapPoint({x:.8,y:.75});
  assert.ok(a.x<b.x);assert.ok(a.rawX<b.rawX);assert.ok(a.y<b.y);assert.ok(a.rawY<b.rawY);
  assert.match(html,/#camera-video\s*\{[^}]*transform:\s*none/);
});
test('off-camera and invalid landmarks are missing hands, not stuck edge positions',()=>{
  const {api}=setup();
  for(const p of [null,{x:NaN,y:.5},{x:.5,y:Infinity},{x:-.05,y:.5},{x:1.05,y:.5},{x:.5,y:-.05},{x:.5,y:1.05}])assert.equal(api.mapPoint(p),null);
});

function pinchLandmarks(ratio,scale=.2,aspectRatio=4/3){
  const landmarks=Array.from({length:21},()=>({x:.5,y:.5}));
  const palm={0:[0,.5],5:[-.4,0],9:[0,-.5],17:[.4,0],8:[.1,-.9],4:[.1+ratio/Math.SQRT2,-.9+ratio/Math.SQRT2]};
  for(const [index,[x,y]] of Object.entries(palm))landmarks[index]={x:.5+x*scale/aspectRatio,y:.5+y*scale};
  return landmarks;
}
const observedHand=(pinchRatio,extra={})=>({x:.5,y:.5,wristX:.5,wristY:.7,pinchRatio,...extra});

test('pinch measurement is invariant to hand size and camera image aspect ratio',()=>{
  const {api}=setup();
  for(const expected of [.2,.6])for(const size of [.08,.24])for(const aspect of [1,4/3,16/9,9/16]){
    const actual=api.calculatePinchRatio(pinchLandmarks(expected,size,aspect),aspect);
    assert.ok(Math.abs(actual-expected)<1e-12,`ratio should remain ${expected} for size ${size}, aspect ${aspect}`);
  }
});

test('missing or malformed hand geometry cannot be interpreted as a pinch',()=>{
  const {api}=setup(),valid=pinchLandmarks(.2);
  const missing=valid.map(point=>({...point}));missing[4]=undefined;
  const invalid=valid.map(point=>({...point}));invalid[17].x=NaN;
  const outside=valid.map(point=>({...point}));outside[8].y=1.1;
  const collapsed=Array.from({length:21},()=>({x:.5,y:.5}));
  for(const landmarks of [null,[],valid.slice(0,20),missing,invalid,outside,collapsed])assert.equal(api.calculatePinchRatio(landmarks,4/3),null);
  for(const aspect of [0,-1,NaN,Infinity,undefined])assert.equal(api.calculatePinchRatio(valid,aspect),null);
});

test('the serialized inference worker sends a measured pinch ratio and closes its frame',async()=>{
  const qa=setup();await qa.controller.start();
  const messages=[],landmarks=pinchLandmarks(.2,.2,16/9);
  const self={postMessage:message=>messages.push(message),close(){},Vision:{HandLandmarker:{
    createFromOptions:async()=>({detectForVideo:()=>({landmarks:[landmarks]}),close(){}})
  }}};
  vm.runInNewContext(await qa.workers[0].script.text(),{self,importScripts(){},OffscreenCanvas:class{}});
  await self.onmessage({data:{type:'init',assets:{}}});
  let closed=0;
  await self.onmessage({data:{type:'frame',timestamp:120,bitmap:{width:1280,height:720,close(){closed++;}}}});
  assert.equal(messages.at(-1).type,'result');
  assert.equal(messages.at(-1).timestamp,120);
  assert.equal(messages.at(-1).points.length,1);
  assert.ok(Math.abs(messages.at(-1).points[0].pinchRatio-.2)<1e-12);
  assert.equal(messages.at(-1).points[0].x,landmarks[8].x);
  assert.equal(messages.at(-1).points[0].wristX,landmarks[0].x);
  assert.equal(closed,1);
  qa.controller.stop();
});

test('a stationary finger can pinch once after a sustained close without threshold chatter',()=>{
  const tracker=setup().api.createHandTracker();
  const push=(ratio,time)=>tracker.push([observedHand(ratio)],time)[0];
  push(.6,0);push(.6,50);
  const anchor=push(.6,100);
  assert.equal(anchor.pinch,false);assert.equal(anchor.pinchValid,true);
  assert.equal(push(.29,150).pinch,false);
  assert.equal(push(.31,200).pinch,false,'a brief threshold crossing must cancel an unfinished close');
  assert.equal(push(.29,250).pinch,false);
  assert.equal(push(.29,300).pinch,false);
  const closed=push(.29,350);
  assert.equal(closed.pinch,true);
  assert.ok(closed.pinchSequence>0);
  assert.equal(closed.x,anchor.x);assert.equal(closed.y,anchor.y);
  assert.equal(closed.observedAt,350,'gesture freshness must advance even inside the position dead zone');
  for(const [index,ratio] of [.32,.46,.28,.47].entries()){
    const point=push(ratio,400+index*50);
    assert.equal(point.pinch,true);
    assert.equal(point.pinchSequence,closed.pinchSequence,'holding one pinch must never produce multiple onsets');
  }
  assert.equal(push(.49,600).pinch,false);
  push(.29,650);
  const next=push(.29,750);
  assert.equal(next.pinch,true);assert.ok(next.pinchSequence>closed.pinchSequence);
  assert.equal(anchor.pinch,false,'later updates must not mutate previously delivered snapshots');
  const snapshot=tracker.snapshot();snapshot[0].x=0;
  assert.equal(tracker.snapshot()[0].x,anchor.x,'a consumer must not mutate the tracker through its snapshot');
});

test('closed arrival, missing geometry, a held hand and reacquisition require a fresh open before pinching',()=>{
  const tracker=setup().api.createPointTracker();
  const push=(ratio,time,extra)=>tracker.push(observedHand(ratio,extra),time).point;
  for(const time of [0,50,100,150,250])assert.notEqual(push(.2,time)?.pinch,true,'arriving with closed fingers is not a new pinch');
  push(.6,300);push(.2,350);push(.2,400);
  const first=push(.2,450);assert.equal(first.pinch,true);
  const invalid=push(null,500);assert.equal(invalid.pinch,false);assert.equal(invalid.pinchValid,false);
  for(const time of [550,650])assert.equal(push(.2,time).pinch,false);
  push(.6,700);push(.2,750);
  const held=tracker.push(null,800).point;
  assert.equal(held.held,true);assert.equal(held.pinch,false);assert.equal(held.pinchValid,false);
  assert.equal(held.observedAt,750);
  for(const time of [850,950])assert.equal(push(.2,time).pinch,false,'closing time must not accumulate across a detection gap');
  push(.6,1000);push(.2,1050);
  assert.equal(push(.2,1150).pinch,true);
  tracker.push(null,1200);
  const reacquired=push(.2,1250,{x:.05,y:.05});
  assert.equal(reacquired.reset,true);assert.equal(reacquired.pinchValid,false);assert.equal(reacquired.pinch,false);
  for(const time of [1300,1400])assert.equal(push(.2,time,{x:.05,y:.05}).pinch,false);
});

test('gesture event identities survive track expiry and explicit camera reset',()=>{
  const tracker=setup().api.createHandTracker();
  let previous=0;
  for(const base of [0,1000,2000]){
    for(const offset of [0,50,100])tracker.push([observedHand(.6)],base+offset);
    tracker.push([observedHand(.2)],base+150);
    const closed=tracker.push([observedHand(.2)],base+250)[0];
    assert.equal(closed.id,0);assert.equal(closed.pinch,true);
    assert.ok(closed.pinchSequence>previous,'reusing a hand ID must not reuse an already consumed event');
    previous=closed.pinchSequence;
    if(base===0)assert.equal(tracker.expire(base+650),true);
    else tracker.reset();
  }
});

test('pinch state stays with its wrist when four detector results are shuffled',()=>{
  const tracker=setup().api.createHandTracker();
  const hands=[.2,.4,.6,.8].map(x=>observedHand(.6,{x,wristX:x}));
  const orders=[[3,1,0,2],[2,0,3,1],[1,3,2,0],[0,2,1,3]];
  for(const time of [0,50,100])tracker.push(hands,time);
  let firstSequence=0;
  for(let frame=0;frame<8;frame++){
    const observed=hands.map((hand,id)=>({...hand,pinchRatio:id===1||id===3&&frame>=3?.2:.6}));
    const points=tracker.push(orders[frame%orders.length].map(id=>observed[id]),150+frame*50);
    for(const point of points){
      const expectedClosed=point.id===1&&frame>=2||point.id===3&&frame>=5;
      assert.equal(point.pinch,expectedClosed);
      if(point.id===0||point.id===2){assert.equal(point.pinch,false);assert.equal(point.pinchSequence,0);}
      if(point.id===1&&frame===2)firstSequence=point.pinchSequence;
      if(point.id===3&&frame>=5)assert.ok(point.pinchSequence>firstSequence);
    }
  }
});

test('controller publishes invalid pinch immediately on a missing stationary hand and ignores late closes',async()=>{
  const qa=setup();await qa.controller.start();
  for(const time of [100,150,200]){await qa.tick(time);qa.result([observedHand(.6)]);}
  for(const time of [250,300,350]){await qa.tick(time);qa.result([observedHand(.2)]);}
  const closed=qa.points.at(-1)[0];assert.equal(closed.pinch,true);
  await qa.tick(400);qa.result([]);
  const held=qa.points.at(-1)[0];
  assert.equal(held.x,closed.x);assert.equal(held.y,closed.y);
  assert.equal(held.pinch,false);assert.equal(held.pinchValid,false);assert.equal(held.held,true);
  assert.equal(closed.pinch,true,'invalidating a hold must not change the previous callback payload');
  await qa.tick(450);await qa.tick(850);
  assert.equal(qa.points.at(-1).length,0);
  qa.result([observedHand(.2)]);
  assert.equal(qa.points.at(-1).length,0,'a late closed frame must not recreate a gesture');
  for(const time of [900,950,1000,1100]){await qa.tick(time);qa.result([observedHand(.2)]);}
  assert.equal(qa.points.at(-1)[0].pinch,false,'reappearing closed fingers must not replay the expired event');
  qa.controller.stop();
});

test('a stationary fingertip does not move the light through sustained small tremors',()=>{
  const filter=setup().api.createPointFilter();
  filter.push({x:.5,y:.5});
  const anchor=filter.push({x:.5,y:.5});
  assert.ok(anchor);
  const moved=[];
  // Holding each excursion for several frames also exercises the smoothing
  // state; isolated alternating spikes alone would be removed by the median.
  for(let cycle=0;cycle<8;cycle++)for(const offset of [.0085,-.0085])for(let frame=0;frame<8;frame++){
    const point=filter.push({x:.5+offset,y:.5});
    if(point)moved.push(point);
  }
  assert.equal(moved.length,0,'subtle tracking tremors should not accumulate light or orbit sounds');
});

test('deliberate slow movement accumulates beyond the dead zone without freezing or reversing',()=>{
  const {api}=setup(),filter=api.createPointFilter();
  filter.push({x:.5,y:.5});
  const anchor=filter.push({x:.5,y:.5}),moved=[];
  // Each observation is much smaller than the dead zone, but the complete
  // gesture must still be followed rather than discarded sample by sample.
  for(let frame=1;frame<=120;frame++){
    const point=filter.push({x:.5+Math.min(frame,100)*.001,y:.5});
    if(point)moved.push(point);
  }
  assert.ok(moved.length>=6,'a slow intentional gesture should produce several updates');
  let previous=anchor;
  for(const point of moved){
    assert.ok(point.x>previous.x,'horizontal motion must keep the corrected direction');
    assert.equal(point.reset,false,'continuous motion must not be mistaken for reacquisition');
    assert.equal(point.y,anchor.y);
    previous=point;
  }
  const target=api.mapPoint({x:.6,y:.5});
  assert.ok(Math.abs(previous.x-target.x)<.015,'the light should settle near the intended destination');
});

test('gentler mapping keeps the center aligned and every screen edge reachable',()=>{
  const {api}=setup();
  const center=api.mapPoint({x:.5,y:.5});
  assert.ok(Math.abs(center.x-.5)<1e-12&&Math.abs(center.y-.5)<1e-12);
  for(const [axis,destination,screenEdge] of [['x',.03,0],['x',.97,1],['y',.03,0],['y',.97,1]]){
    const filter=api.createPointFilter();
    filter.push({x:.5,y:.5});
    let latest=filter.push({x:.5,y:.5});
    for(let frame=1;frame<=70;frame++){
      const raw={x:.5,y:.5};
      raw[axis]=.5+(destination-.5)*Math.min(frame/50,1);
      const point=filter.push(raw);
      if(point)latest=point;
    }
    assert.ok(Math.abs(latest[axis]-screenEdge)<.015,`${axis} should reach screen edge ${screenEdge}`);
    assert.ok(Math.abs(latest[axis==='x'?'y':'x']-.5)<1e-12,'moving one axis should not disturb the other');
  }
});

test('four hands retain independent identities and filters when detector order changes',()=>{
  const {api}=setup(),tracker=api.createHandTracker();
  const hands=[.2,.4,.6,.8].map(x=>({x,y:.5,wristX:x,wristY:.7}));
  assert.equal(tracker.push(hands,0).length,0);
  const initial=tracker.push(hands,50);
  assert.equal(initial.length,4);
  const anchors=new Map(initial.map(point=>[point.id,point]));
  const orders=[[3,1,0,2],[2,0,3,1],[1,3,2,0],[0,2,1,3]];
  let previousMoving=anchors.get(1),latest;
  for(let frame=1;frame<=120;frame++){
    const observed=hands.map((hand,id)=>({...hand,
      // Only one person's finger travels. Wrist anchors stay fixed while
      // neighbors tremble, so detector ordering cannot transfer filter state.
      x:hand.x+(id===1?Math.min(frame,100)*.001:(frame%2?.006:-.006))}));
    latest=tracker.push(orders[frame%orders.length].map(id=>observed[id]),50+frame*50);
    assert.equal(latest.length,4);
    assert.equal(new Set(latest.map(point=>point.id)).size,4);
    for(const point of latest){
      assert.equal(point.held,false);
      assert.equal(point.reset,false,'reordering must not reacquire an existing hand');
      const anchor=anchors.get(point.id);
      if(point.id===1){
        assert.ok(point.x>=previousMoving.x,'only the moving hand should advance in its own direction');
        previousMoving=point;
      }else{
        assert.equal(point.x,anchor.x,'a neighbor must not inherit the moving hand filter');
      }
      assert.equal(point.y,anchor.y);
    }
  }
  const moving=latest.find(point=>point.id===1),target=api.mapPoint({x:.5,y:.5});
  assert.ok(Math.abs(moving.x-target.x)<.015);
  assert.ok(moving.x-anchors.get(1).x>.09,'the intended hand must actually move');
});
test('loss expires even when the inference worker sends no next result',()=>{
  const tracker=setup().api.createPointTracker();tracker.push({x:.5,y:.5},0);assert.ok(tracker.push({x:.5,y:.5},50).point);
  assert.equal(tracker.expire(449),false);assert.equal(tracker.expire(450),true);
});
test('stationary observations keep tracking alive; brief gaps hold without motion',()=>{
  const tracker=setup().api.createPointTracker();tracker.push({x:.5,y:.5},0);tracker.push({x:.5,y:.5},50);
  for(let t=100;t<=2000;t+=50){tracker.push({x:.5,y:.5},t);assert.equal(tracker.expire(t),false);}
  assert.equal(tracker.push(null,2050).point.held,true);
  assert.equal(tracker.push({x:.5,y:.5},2100).point.held,false);
});
test('long and repeated exits recover at a fresh position without drawing a cross-screen sweep',()=>{
  const tracker=setup().api.createPointTracker();let time=0;
  for(let cycle=0;cycle<100;cycle++){
    const p={x:cycle%2?.2:.8,y:.4};tracker.push(p,time);const found=tracker.push(p,time+50);assert.equal(found.point.reset,true);
    assert.equal(tracker.push(null,time+100).point.held,true);assert.equal(tracker.expire(time+500),true);
    assert.equal(tracker.push(null,time+550).status,'searching');time+=700;
  }
});
test('controller clears stale light, drops late results, then reacquires automatically',async()=>{
  const qa=setup();assert.equal(await qa.controller.start(),true);
  await qa.tick(100);qa.result([{x:.5,y:.5}]);await qa.tick(150);qa.result([{x:.5,y:.5}]);assert.equal(qa.controller.getState().status,'tracking');
  assert.equal(qa.points.at(-1).length,1,'the current array callback should receive the detected hand');
  await qa.tick(200);await qa.tick(650);assert.equal(qa.controller.getState().status,'searching');assert.equal(qa.controller.getState().lastPoints.length,0);
  assert.equal(qa.points.at(-1).length,0,'expired lights should be removed through the array callback');
  qa.result([{x:.2,y:.2}]);assert.equal(qa.controller.getState().status,'searching');
  await qa.tick(700);qa.result([{x:.7,y:.6}]);await qa.tick(750);qa.result([{x:.7,y:.6}]);
  assert.equal(qa.controller.getState().status,'tracking');assert.equal(qa.controller.getState().lastPoints.length,1);qa.controller.stop();
  assert.equal(qa.track.stopped,true);assert.equal(qa.controller.getState().active,false);
});
test('long help pause does not treat an outstanding frame as a seven-second failure',async()=>{
  const qa=setup();await qa.controller.start();await qa.tick(100);qa.controller.setPaused(true);await qa.tick(10000);qa.controller.setPaused(false);await qa.tick(10050);
  assert.notEqual(qa.controller.getState().status,'error');assert.equal(qa.track.stopped,false);
  qa.result([{x:.5,y:.5}]);await qa.tick(10100);qa.result([{x:.5,y:.5}]);await qa.tick(10150);qa.result([{x:.5,y:.5}]);assert.equal(qa.controller.getState().status,'tracking');qa.controller.stop();
});
test('stop prevents old sessions from injecting a light into a restarted session',async()=>{
  const qa=setup();await qa.controller.start();await qa.tick(100);const old=qa.workers[0];qa.controller.stop();await qa.controller.start();
  old.result([{x:.9,y:.9}]);assert.equal(qa.controller.getState().lastPoints.length,0);assert.equal(qa.controller.getState().frames,0);qa.controller.stop();
});

test('a display-direction reset drops in-flight coordinates and requires a fresh open hand without restarting the camera',async()=>{
  const qa=setup();await qa.controller.start();
  for(const time of [100,150,200]){await qa.tick(time);qa.result([observedHand(.6)]);}
  assert.equal(qa.controller.getState().lastPoints.length,1);
  await qa.tick(250);
  qa.controller.resetTracking();
  assert.equal(qa.points.at(-1).length,0);
  assert.equal(qa.controller.getState().status,'searching');
  qa.result([observedHand(.2)]);
  assert.equal(qa.controller.getState().lastPoints.length,0,'a result captured at the reset boundary must be ignored');
  for(const time of [300,350,400,450]){await qa.tick(time);qa.result([observedHand(.2)]);}
  assert.equal(qa.points.at(-1)[0].pinch,false,'an old closed gesture must not rearm after changing direction');
  await qa.tick(500);qa.result([observedHand(.6)]);
  await qa.tick(550);qa.result([observedHand(.2)]);
  await qa.tick(650);qa.result([observedHand(.2)]);
  assert.equal(qa.points.at(-1)[0].pinch,true);
  assert.equal(qa.workers.length,1);assert.equal(qa.track.stopped,false);assert.equal(qa.track.enabled,true);
  qa.controller.stop();
});
