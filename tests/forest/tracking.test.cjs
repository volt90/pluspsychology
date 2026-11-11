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
function setup() {
  let now = 0, id = 0;
  const animations = new Map(), workers = [], points = [], states = [];
  const track = {enabled:true,stopped:false,stop(){this.stopped=true;}};
  const stream = {getTracks:()=>[track],getVideoTracks:()=>[track]};
  const video = {readyState:4,currentTime:0,play:async()=>{},pause(){},srcObject:null};
  class Worker {
    constructor(){workers.push(this);this.sent=[];}
    postMessage(message){this.sent.push(message);if(message.type==='init')queueMicrotask(()=>this.onmessage({data:{type:'ready'}}));}
    result(point, timestamp=this.sent.at(-1).timestamp){this.onmessage({data:{type:'result',point,timestamp}});}
    terminate(){this.terminated=true;}
  }
  class FakeURL extends URL {static createObjectURL(){return 'blob:qa';}static revokeObjectURL(){}}
  const context = vm.createContext({console,Blob,URL:FakeURL,Worker,OffscreenCanvas:class{},
    createImageBitmap:async()=>({close(){}}),performance:{now:()=>now},
    document:{hidden:false,baseURI:'http://localhost/'},navigator:{mediaDevices:{getUserMedia:async()=>stream}},
    requestAnimationFrame:callback=>{animations.set(++id,callback);return id;},cancelAnimationFrame:id=>animations.delete(id),
    setTimeout:()=>++id,clearTimeout(){},isSecureContext:true});
  context.window=context;vm.runInContext(source,context);
  const api=context.ForestHandTracking;
  const controller=api.create({video,onPoint:p=>points.push(p),onState:s=>states.push(s)});
  return {api,controller,video,track,points,states,context,workers,
    async tick(time){now=time;video.currentTime=time/1000;const callbacks=[...animations.values()];animations.clear();for(const cb of callbacks)cb(time);await new Promise(setImmediate);},
    result(point){workers.at(-1).result(point);}};
}
test('all inline scripts parse',()=>{for(const s of scripts)if(!s.trim().startsWith('{'))new vm.Script(s);});
test('horizontal motion is mirrored and vertical motion is preserved',()=>{
  const {api}=setup(),a=api.mapPoint({x:.2,y:.25}),b=api.mapPoint({x:.8,y:.75});
  assert.ok(a.x>b.x);assert.ok(a.rawX>b.rawX);assert.ok(a.y<b.y);assert.ok(a.rawY<b.rawY);
  assert.match(html,/#camera-video\s*\{[^}]*transform:\s*scaleX\(-1\)/);
});
test('off-camera and invalid landmarks are missing hands, not stuck edge positions',()=>{
  const {api}=setup();
  for(const p of [null,{x:NaN,y:.5},{x:.5,y:Infinity},{x:-.05,y:.5},{x:1.05,y:.5},{x:.5,y:-.05},{x:.5,y:1.05}])assert.equal(api.mapPoint(p),null);
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
  await qa.tick(100);qa.result({x:.5,y:.5});await qa.tick(150);qa.result({x:.5,y:.5});assert.equal(qa.controller.getState().status,'tracking');
  await qa.tick(200);await qa.tick(650);assert.equal(qa.controller.getState().status,'searching');assert.equal(qa.controller.getState().lastPoint,null);
  qa.result({x:.2,y:.2});assert.equal(qa.controller.getState().status,'searching');
  await qa.tick(700);qa.result({x:.7,y:.6});await qa.tick(750);qa.result({x:.7,y:.6});
  assert.equal(qa.controller.getState().status,'tracking');assert.ok(qa.controller.getState().lastPoint);qa.controller.stop();
  assert.equal(qa.track.stopped,true);assert.equal(qa.controller.getState().active,false);
});
test('long help pause does not treat an outstanding frame as a seven-second failure',async()=>{
  const qa=setup();await qa.controller.start();await qa.tick(100);qa.controller.setPaused(true);await qa.tick(10000);qa.controller.setPaused(false);await qa.tick(10050);
  assert.notEqual(qa.controller.getState().status,'error');assert.equal(qa.track.stopped,false);
  qa.result({x:.5,y:.5});await qa.tick(10100);qa.result({x:.5,y:.5});await qa.tick(10150);qa.result({x:.5,y:.5});assert.equal(qa.controller.getState().status,'tracking');qa.controller.stop();
});
test('stop prevents old sessions from injecting a light into a restarted session',async()=>{
  const qa=setup();await qa.controller.start();await qa.tick(100);const old=qa.workers[0];qa.controller.stop();await qa.controller.start();
  old.result({x:.9,y:.9});assert.equal(qa.controller.getState().lastPoint,null);assert.equal(qa.controller.getState().frames,0);qa.controller.stop();
});
