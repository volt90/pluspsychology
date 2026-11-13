const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const html = fs.readFileSync(process.env.FOREST_QA_SOURCE || path.join(__dirname,'../../experience/mind-forest.html'),'utf8');
const app = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map(match=>match[1]).find(script=>script.includes('/* 김심리월드 · 고요한 숲.'));
const orientation = app.slice(app.indexOf('  /* Shared camera orientation:'),app.indexOf('  /* End shared camera orientation. */'));
assert.ok(orientation.includes('function setCameraMirrored'));
function sourceFunction(name) {
  const start = app.search(new RegExp('^  (?:async )?function '+name+'\\(', 'm'));
  assert.ok(start>=0,name);
  const rest=app.slice(start), next=rest.slice(1).search(/\n  (?:async )?function /);
  return next<0?rest:rest.slice(0,next+1);
}

function pixelCanvas(initialWidth=0,initialHeight=0) {
  let width=initialWidth,height=initialHeight,pixels=new Uint8ClampedArray(width*height*4);
  let transform=[1,0,0,1,0,0],saved=[];
  const canvas={get width(){return width;},set width(value){width=value;reset();},get height(){return height;},set height(value){height=value;reset();},get pixels(){return pixels;}};
  const context={globalCompositeOperation:'source-over',
    setTransform(...value){transform=value;},save(){saved.push({transform:[...transform],operation:this.globalCompositeOperation});},
    restore(){const state=saved.pop();transform=state.transform;this.globalCompositeOperation=state.operation;},
    clearRect(){pixels.fill(0);},createImageData(w,h){return {data:new Uint8ClampedArray(w*h*4)};},
    getImageData(){return {data:new Uint8ClampedArray(pixels)};},putImageData(image){pixels.set(image.data);},
    drawImage(image,x,y,w,h){
      for(let row=0;row<h;row++)for(let column=0;column<w;column++){
        const targetX=Math.floor(transform[0]*(x+column+.5)+transform[4]),targetY=Math.floor(transform[3]*(y+row+.5)+transform[5]);
        if(targetX<0||targetX>=width||targetY<0||targetY>=height)continue;
        const source=(Math.floor(row*image.height/h)*image.width+Math.floor(column*image.width/w))*4;
        const target=(targetY*width+targetX)*4;
        if(this.globalCompositeOperation==='destination-in')pixels[target+3]=Math.round(pixels[target+3]*image.pixels[source+3]/255);
        else pixels.set(image.pixels.slice(source,source+4),target);
      }
    }};
  function reset(){pixels=new Uint8ClampedArray(width*height*4);transform=[1,0,0,1,0,0];context.globalCompositeOperation='source-over';}
  canvas.getContext=()=>context;
  return canvas;
}
function coloredFrame(left,right) {
  const image={width:4,height:2,pixels:new Uint8ClampedArray(32)};
  for(let row=0;row<2;row++)for(let column=0;column<4;column++)image.pixels.set(column<2?left:right,(row*4+column)*4);
  return image;
}
function setup({stored=new Map(),storageBlocked=false}={}) {
  const elements=new Map(),writes=[],calls={release:0,reset:0,moves:[],fire:[]};
  const element=()=>({disabled:false,hidden:false,style:{},attributes:{},classList:{remove(){},toggle(){}},setAttribute(key,value){this.attributes[key]=value;}});
  elements.set('camera-orientation-status',element());
  const layer=pixelCanvas(),mask=pixelCanvas();
  const context=vm.createContext({console,Map,Boolean,Math,Number,Promise,performance:{now:()=>1000},
    stage:'forest',started:true,windowBlurred:false,cameraActive:true,width:1000,height:800,help:{hidden:true},canvas:{dataset:{}},
    experience:{dataset:{}},document:{hidden:false,getElementById:id=>elements.get(id)},status:{textContent:''},
    photoTake:{disabled:false},photoCaptured:false,photoResult:{hidden:true},photoPreviewReady:false,
    photoBackdropChosen:true,photoBackdropCandidate:2,photoAutoTimer:0,flowVersion:1,
    photoSegmentationRequest:null,photoSegmenter:null,photoPersonMode:'loading',
    photoWindow:{width:4,height:2},photoCameraLayer:layer,photoCameraContext:layer.getContext(),
    photoMaskLayer:mask,photoMaskContext:mask.getContext(),photoMaskPixels:null,
    cameraVideo:{srcObject:null,videoWidth:4,videoHeight:2,readyState:4,play:async()=>{}},
    firePinches:new Map([[0,{sequence:3,armed:true}]]),fireHandCursors:[element(),element()],emberLight:element(),
    fireTimer:0,firePinchTimer:42,firePinchFlight:{cancel(){throw new Error('An earned flight must not be cancelled.');}},
    cameraLights:new Map(),cameraDots:[element(),element(),element(),element()],
    releaseLight(){calls.release++;context.cameraLights.clear();},hand:{resetTracking(){calls.reset++;}},
    moveLight(x,y,now,light){calls.moves.push({x,y});Object.assign(light,{active:true,targetX:x/1000,targetY:y/800});},
    moveCameraEmber:points=>calls.fire.push(points),newLight:color=>({color,active:false}),lightColors:['white','green','blue','pink'],
    localStorage:{getItem(key){if(storageBlocked)throw new Error('Storage blocked');return stored.get(key)??null;},
      setItem(key,value){if(storageBlocked)throw new Error('Storage blocked');stored.set(key,value);writes.push([key,value]);}},
    clearTimeout(){},refreshPhotoForeground:async()=>true,drawGroupPhotoIfCurrent(){},scheduleAutoPhoto(){},
    clamp:(value,min,max)=>Math.max(min,Math.min(max,value))});
  vm.runInContext(orientation+sourceFunction('cameraPoints')+`
    globalThis.orientationState=()=>({mirrored:cameraMirrored,deviceId:cameraOrientationDeviceId,revision:cameraOrientationRevision});
  `,context);
  context.updateCameraOrientationButtons();
  return {api:context,calls,elements,writes,stored,layer,mask,
    attach(deviceId){context.cameraVideo.srcObject={getVideoTracks:()=>[{getSettings:()=>deviceId?{deviceId}:{}}]};context.applyCameraDeviceOrientation();},
    include(...names){vm.runInContext(names.map(sourceFunction).join('\n'),context);}};
}

test('default direction stays unchanged and one shared switch aligns forest, fire and preview dots',()=>{
  const qa=setup();
  const raw={id:0,x:.2,y:.3,rawX:.25,rawY:.35,held:false,reset:true};
  qa.api.cameraPoints([raw]);
  assert.equal(qa.calls.moves.at(-1).x,200);assert.equal(qa.api.cameraDots[0].style.left,'25%');
  assert.equal(qa.api.experience.dataset.cameraMirrored,'false');
  qa.api.toggleCameraMirror();
  qa.api.cameraPoints([raw]);
  assert.equal(qa.calls.moves.at(-1).x,800);assert.equal(qa.calls.moves.at(-1).y,240);
  assert.equal(qa.api.cameraDots[0].style.left,'75%');assert.equal(qa.api.experience.dataset.cameraMirrored,'true');
  qa.api.stage='fire';qa.api.cameraPoints([raw]);
  assert.equal(qa.calls.fire.at(-1)[0].x,.8);assert.equal(qa.calls.fire.at(-1)[0].y,.3);
  assert.equal(raw.x,.2,'the raw tracker result must remain unchanged');
  assert.equal(qa.calls.reset,1);assert.equal(qa.calls.release,1);assert.equal(qa.api.firePinches.size,0);
  assert.equal(qa.api.firePinchTimer,42,'a previously earned flight can finish');
  assert.ok(qa.api.fireHandCursors.every(cursor=>cursor.hidden));
  qa.api.toggleCameraMirror();qa.api.cameraPoints([raw]);assert.equal(qa.calls.fire.at(-1)[0].x,.2);
});

test('the saved mirror choice belongs to the actual device and an unfamiliar webcam starts in the default direction',()=>{
  const prefix='mind-forest:camera-mirror:',stored=new Map([[prefix+'camera-a','true']]);
  const qa=setup({stored});qa.attach('camera-a');assert.equal(qa.api.orientationState().mirrored,true);
  qa.api.toggleCameraMirror();assert.equal(stored.get(prefix+'camera-a'),'false');
  qa.attach('camera-b');assert.equal(qa.api.orientationState().mirrored,false);
  qa.api.toggleCameraMirror();assert.equal(stored.get(prefix+'camera-b'),'true');
  qa.attach('camera-a');assert.equal(qa.api.orientationState().mirrored,false);
  qa.attach('camera-b');assert.equal(qa.api.orientationState().mirrored,true);
  assert.deepEqual(qa.writes.map(([key])=>key),[prefix+'camera-a',prefix+'camera-b']);
});

test('an anonymous stream is not persisted, and blocked storage still permits per-device choices within this page',()=>{
  const anonymous=setup();anonymous.attach('');anonymous.api.toggleCameraMirror();
  anonymous.api.applyCameraDeviceOrientation();assert.equal(anonymous.api.orientationState().mirrored,true);
  assert.equal(anonymous.writes.length,0);
  anonymous.attach('');assert.equal(anonymous.api.orientationState().mirrored,false,'a different anonymous stream must not inherit the last camera choice');
  const blocked=setup({storageBlocked:true});blocked.attach('camera-a');blocked.api.toggleCameraMirror();
  blocked.attach('camera-b');assert.equal(blocked.api.orientationState().mirrored,false);
  blocked.attach('camera-a');assert.equal(blocked.api.orientationState().mirrored,true);
});

test('help reports the direction while the shortcut cannot change a countdown or an already captured photo',()=>{
  const qa=setup();qa.attach('camera-a');qa.api.stage='photo';
  for(const state of [{disabled:true,captured:false,resultHidden:true},{disabled:false,captured:true,resultHidden:false}]){
    qa.api.photoTake.disabled=state.disabled;qa.api.photoCaptured=state.captured;qa.api.photoResult.hidden=state.resultHidden;
    qa.api.updateCameraOrientationButtons();qa.api.toggleCameraMirror();
    assert.equal(qa.api.orientationState().mirrored,false);
    assert.match(qa.elements.get('camera-orientation-status').textContent,/기본 · 촬영 중에는 방향을 유지/);
  }
  qa.api.photoTake.disabled=false;qa.api.photoCaptured=false;qa.api.photoResult.hidden=true;
  qa.api.updateCameraOrientationButtons();qa.api.toggleCameraMirror();
  assert.equal(qa.elements.get('camera-orientation-status').textContent,'현재 웹캠 방향: 좌우 반전');
});

test('chroma-key photos use the same direction as the forest without flipping the photo frame',()=>{
  const qa=setup();qa.include('updateKeyedPhoto');
  const frame=coloredFrame([0,255,0,255],[220,20,40,255]);
  Object.assign(qa.api.cameraVideo,{...frame,srcObject:{}});
  qa.api.updateKeyedPhoto();
  assert.equal(qa.layer.pixels[3],0);assert.equal(qa.layer.pixels[15],255);assert.equal(qa.layer.pixels[12],220);
  qa.api.setCameraMirrored(true);qa.api.updateKeyedPhoto();
  assert.equal(qa.layer.pixels[3],255);assert.equal(qa.layer.pixels[0],220);assert.equal(qa.layer.pixels[15],0);
  qa.api.setCameraMirrored(false);qa.api.updateKeyedPhoto();assert.equal(qa.layer.pixels[3],0);assert.equal(qa.layer.pixels[15],255);
});

test('the segmentation bitmap and alpha mask flip together rather than moving the cutout to the wrong side',()=>{
  const qa=setup();qa.include('applyPhotoMask');
  const frame={bitmap:coloredFrame([220,20,40,255],[10,40,230,255]),alpha:new Uint8ClampedArray([255,255,0,0,255,255,0,0]),width:4,height:2};
  qa.api.applyPhotoMask(frame);
  assert.equal(qa.layer.pixels[3],255);assert.equal(qa.layer.pixels[0],220);assert.equal(qa.layer.pixels[15],0);
  qa.api.setCameraMirrored(true);qa.api.applyPhotoMask(frame);
  assert.equal(qa.layer.pixels[3],0);assert.equal(qa.layer.pixels[15],255);assert.equal(qa.layer.pixels[12],220);
});

test('a direction change while segmentation is pending retries a fresh frame for the same awaiting photo request',async()=>{
  const qa=setup();qa.include('refreshPhotoForeground');
  const pending=[],applied=[],closed=[];
  Object.assign(qa.api,{stage:'photo',photoPreviewReady:true,photoPersonMode:'loading',photoTake:{disabled:true},
    photoSegmenter:{process:()=>new Promise(resolve=>pending.push(resolve))},applyPhotoMask:frame=>applied.push(frame.id)});
  const request=qa.api.refreshPhotoForeground(1);assert.equal(pending.length,1);
  qa.api.setCameraMirrored(true);
  pending[0]({id:'old-direction',bitmap:{close(){closed.push('old');}}});
  await new Promise(setImmediate);assert.equal(pending.length,2);
  pending[1]({id:'current-direction',bitmap:{close(){closed.push('current');}}});
  assert.equal(await request,true);
  assert.deepEqual(applied,['current-direction']);assert.deepEqual(closed,['old','current']);
});

test('photo-only camera acquisition loads the same device preference as a metadata event',async()=>{
  const qa=setup({stored:new Map([['mind-forest:camera-mirror:photo-camera','true']])});qa.include('preparePhotoCamera');
  const stream={getVideoTracks:()=>[{readyState:'live',getSettings:()=>({deviceId:'photo-camera'})}]};
  Object.assign(qa.api,{stage:'photo',photoCameraRequest:null,extraPhotoStream:null,waitForPhotoFrames:async()=>{},
    window:{ForestHandTracking:{requestCamera:async()=>stream}}});
  assert.equal(await qa.api.preparePhotoCamera(1),true);
  assert.equal(qa.api.orientationState().mirrored,true);assert.equal(qa.api.cameraVideo.srcObject,stream);
  qa.api.applyCameraDeviceOrientation();assert.equal(qa.calls.reset,1,'repeated metadata for the same stream must not reset the preference');
});

test('physical N works with Korean input across the three camera scenes and ignores repeat or modifier keys',()=>{
  const qa=setup();
  const start=app.indexOf("  document.addEventListener('keydown',e=>{");
  const end=app.indexOf("  document.addEventListener('keyup'",start);
  let keydown;qa.api.document.addEventListener=(type,callback)=>{if(type==='keydown')keydown=callback;};
  vm.runInContext(app.slice(start,end),qa.api);
  const event=(extra={})=>({code:'KeyN',key:'ㅜ',repeat:false,altKey:false,ctrlKey:false,metaKey:false,target:{matches:()=>false},preventDefault(){},...extra});
  for(const stage of ['forest','fire','photo']){qa.api.stage=stage;const before=qa.api.orientationState().mirrored;keydown(event());assert.equal(qa.api.orientationState().mirrored,!before);}
  for(const stage of ['forest','fire','photo']){qa.api.stage=stage;const before=qa.api.orientationState().mirrored;keydown(event({code:'KeyV',key:'ㅍ'}));assert.equal(qa.api.orientationState().mirrored,before,'the retired V shortcut must not toggle the camera');}
  for(const extra of [{repeat:true},{ctrlKey:true},{altKey:true},{metaKey:true},{target:{matches:()=>true}}]){
    const before=qa.api.orientationState().mirrored;keydown(event(extra));assert.equal(qa.api.orientationState().mirrored,before);
  }
  qa.api.photoTake.disabled=true;const before=qa.api.orientationState().mirrored;keydown(event());assert.equal(qa.api.orientationState().mirrored,before);
});

test('H opens help and Escape closes it in each camera scene, including Korean keyboard input',()=>{
  const qa=setup();
  const start=app.indexOf("  document.addEventListener('keydown',e=>{");
  const end=app.indexOf("  document.addEventListener('keyup'",start);
  let keydown;qa.api.document.addEventListener=(type,callback)=>{if(type==='keydown')keydown=callback;};
  qa.api.toggleHelp=(open=qa.api.help.hidden)=>{qa.api.help.hidden=!open;};
  vm.runInContext(app.slice(start,end),qa.api);
  const event=(extra={})=>({code:'KeyH',key:'ㅗ',repeat:false,altKey:false,ctrlKey:false,metaKey:false,target:{matches:()=>false},preventDefault(){},...extra});
  for(const stage of ['forest','fire','photo']){
    qa.api.stage=stage;qa.api.help.hidden=true;
    keydown(event());assert.equal(qa.api.help.hidden,false);
    keydown(event({repeat:true}));assert.equal(qa.api.help.hidden,false,'holding H does not flicker the help');
    keydown(event({code:'Escape',key:'Escape'}));assert.equal(qa.api.help.hidden,true);
  }
});
