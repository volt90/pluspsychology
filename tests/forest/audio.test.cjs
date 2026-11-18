const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),test=require('node:test'),assert=require('node:assert/strict');
const html=fs.readFileSync(process.env.FOREST_QA_SOURCE||path.join(__dirname,'../../experience/mind-forest.html'),'utf8');
const source=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]).find(s=>s.includes('/* Quiet, gesture-unlocked sound'));
for(const firstInput of ['speaker','touch'])test('blocked opening music starts on the first '+firstInput+' and the speaker can then mute it',async()=>{
  const section=(start,end)=>html.slice(html.indexOf(start),html.indexOf(end,html.indexOf(start)));
  const handlers=new Map(),attributes=new Map(),events=new Map();
  let allowed=false,muted=false,attempts=0;
  const track={paused:true,addEventListener:(type,fn)=>events.set(type,fn),play(){
    attempts++;
    if(!allowed)return Promise.reject(Object.assign(new Error('Blocked'),{name:'NotAllowedError'}));
    this.paused=false;events.get('play')();return Promise.resolve();
  }};
  const button={setAttribute:(key,value)=>attributes.set(key,value),addEventListener:(_,fn)=>handlers.set('speaker',fn)};
  const context=vm.createContext({console,document:{hidden:false,addEventListener:(type,fn)=>handlers.set(type,fn)},
    openingMusic:track,openingMusicVolume:.35,openingScreen:{hidden:false},startScreen:{hidden:true},started:false,
    openingMusicButton:button,audio:{isMuted:()=>muted,setMuted:value=>{muted=value;},cancelMediaFade(){}},
    fadeBackground(media){media.paused=true;events.get('pause')();}});
  vm.runInContext(section('  function updateOpeningMusicButton()', '  function syncGuideMusic()')+
    section("  openingMusicButton.addEventListener('click'", "  document.addEventListener('visibilitychange'"),context);
  context.syncOpeningMusic();
  await Promise.resolve();
  assert.equal(attributes.get('aria-pressed'),'true');
  assert.equal(attributes.get('aria-label'),'배경음 재생');
  assert.equal(track.paused,true);
  allowed=true;
  if(firstInput==='speaker')handlers.get('speaker')();
  else handlers.get('pointerup')({target:{closest:()=>false}});
  assert.equal(track.paused,false);
  assert.equal(attributes.get('aria-label'),'배경음 끄기');
  handlers.get('speaker')();handlers.get('click')({target:{closest:()=>false}});
  assert.equal(attributes.get('aria-pressed'),'false');
  assert.equal(attributes.get('aria-label'),'배경음 켜기');
  assert.equal(track.paused,true);assert.equal(attempts,2);
});
async function setup(){
  let time=0,oscillatorCount=0;const nodes=[],warnings=[];const failures={oscillator:0,param:false};
  class Param{
    constructor(){this.value=1;this.events=[];this.curve=null;}
    setValueCurveAtTime(values,when,duration){time+=.008;this.curve={start:Math.max(when,time),duration};}
    setValueAtTime(value,when){if(this.curve&&when>=this.curve.start&&when<this.curve.start+this.curve.duration)throw new Error('AudioParam events overlap');this.events.push({value,when,type:'set'});}
    linearRampToValueAtTime(value,when){if(failures.param)throw new Error('Injected audio failure');this.events.push({value,when,type:'linear'});}
    exponentialRampToValueAtTime(value,when){this.events.push({value,when,type:'exponential'});}
    cancelScheduledValues(){}cancelAndHoldAtTime(){}setTargetAtTime(){}
  }
  class Node{
    constructor(kind){this.kind=kind;this.connected=false;this.stops=[];this.gain=new Param();this.pan=new Param();this.frequency=new Param();nodes.push(this);}
    connect(){this.connected=true;}disconnect(){this.connected=false;}
    start(when){this.started=when;}stop(when){this.stops.push(when);}
  }
  class AudioContext{
    constructor(){this.state='running';this.destination={};}
    get currentTime(){return time;}
    createGain(){return new Node('gain');}createStereoPanner(){return new Node('panner');}
    createOscillator(){if(++oscillatorCount===failures.oscillator)throw new Error('Injected oscillator failure');return new Node('oscillator');}
    createDynamicsCompressor(){const n=new Node('compressor');for(const p of ['threshold','knee','ratio','attack','release'])n[p]=new Param();return n;}
  }
  const context=vm.createContext({console:{warn:(...args)=>warnings.push(args)},AudioContext,document:{hidden:false,addEventListener(){}},URL});context.window=context;
  vm.runInContext(source,context);const audio=context.ForestAudio;await audio.unlock();
  return {audio,nodes,warnings,failures,advance:()=>time+=1,finish:()=>nodes.filter(n=>n.kind==='oscillator'&&!n.finished).forEach(n=>{n.finished=true;n.onended?.();})};
}
test('effect survives the audio clock advancing during envelope scheduling',async()=>{
  const qa=await setup();assert.doesNotThrow(()=>qa.audio.updateCharge({id:'simri',active:true,charge:.5}));
  assert.equal(qa.audio.getState().activeNotes,1);assert.equal(qa.warnings.length,0);
  const envelope=qa.nodes.find(n=>n.gain.events.length>2).gain.events;
  assert.ok(envelope.every((e,i)=>i===0||e.when>=envelope[i-1].when));assert.ok(envelope.every(e=>e.value>0&&e.value<.04));
  qa.finish();assert.equal(qa.audio.getState().activeNotes,0);
});
test('audio failure is contained and partial sound nodes are released',async()=>{
  for(const failure of ['param','oscillator']){
    const qa=await setup(),baseline=qa.nodes.length;qa.failures[failure]=failure==='param'?true:2;
    assert.doesNotThrow(()=>qa.audio.updateCharge({id:'simri',active:true}));assert.equal(qa.audio.getState().activeNotes,0);
    assert.equal(qa.warnings.length,1);assert.ok(qa.nodes.slice(baseline).every(n=>!n.connected));
    for(const n of qa.nodes.slice(baseline).filter(n=>n.started!==undefined))assert.ok(n.stops.length>0);
    qa.failures[failure]=0;qa.advance();qa.audio.updateCharge({id:'simri',active:true});assert.equal(qa.audio.getState().activeNotes,1);
  }
});
test('repeated exits, reentries and wake chords do not retain ended sound nodes',async()=>{
  const qa=await setup();for(let i=0;i<100;i++){
    qa.advance();qa.audio.updateCharge({id:'simri',active:true,charge:.5});qa.audio.updateCharge({active:false});
    qa.audio.wake('simri');qa.finish();assert.equal(qa.audio.getState().activeNotes,0);
  }
  assert.ok(qa.nodes.slice(2).every(n=>!n.connected));assert.equal(qa.warnings.length,0);
});
test('a transient render error cannot cancel all future forest frames',()=>{
  const render=html.slice(html.indexOf('  function render(now) {'),html.indexOf('  function reset() {'));
  let attempts=0;const scheduled=[];
  const context=vm.createContext({lastFrame:0,requestId:0,started:false,sceneTime:0,help:{hidden:true},cameraActive:false,keys:new Set(),
    width:1280,height:800,dpr:1,pointer:{x:.5,y:.5,targetX:.5,targetY:.5},reducedMotion:{matches:false},friends:[],background:{},foreground:{},
    requestAnimationFrame:callback=>{scheduled.push(callback);return scheduled.length;},
    updateFriends(){if(++attempts===1)throw new Error('QA transient render error');},ctx:{setTransform(){},drawImage(){}},drawLight(){}});
  vm.runInContext(render,context);assert.throws(()=>context.render(100),/QA transient/);assert.equal(scheduled.length,1);
  assert.doesNotThrow(()=>scheduled[0](116));assert.equal(attempts,2);assert.equal(scheduled.length,2);
});
