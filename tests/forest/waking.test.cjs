const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const html=fs.readFileSync(process.env.FOREST_QA_SOURCE||path.join(__dirname,'../../experience/mind-forest.html'),'utf8');
const source=html.slice(html.indexOf('  function updateFriends(dt,lights){'),html.indexOf('  const rigDefinitions='));
const tracking=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]).find(s=>s.includes('/* Local webcam hand tracking.'));
function setup(){
  const friends=Array.from({length:4},(_,i)=>({id:String(i),name:String(i),charge:0,phase:'rest',lastMotion:-10000,wakeCount:0,wakeDuration:2000,
    layout:{x:640+i*350,y:502,w:100,h:200},bubble:{dataset:{},classList:{toggle(){}},setAttribute(){}}}));
  const wakes=[];const ctx=vm.createContext({width:1920,height:800,sceneTime:0,lastRubAt:0,friends,
    compactForest:{matches:false},help:{hidden:true},status:{},audio:{wake:id=>wakes.push(id),updateCharge(){},getState:()=>({})},
    friendLayout:f=>f.layout,positionBubbles(){},beginGreeting:f=>{f.phase='awake';},
    clamp:(v,min,max)=>Math.max(min,Math.min(max,v))});
  ctx.window=ctx;vm.runInContext(tracking+source,ctx);
  return {ctx,friends,wakes,step(dt,lights){ctx.sceneTime+=dt;ctx.updateFriends(dt,lights);}};
}
const light=(extra={})=>({x:640/1920,y:.5,active:true,held:false,movement:.6,...extra});
test('a gentle small rub wakes a friend in about a second without affecting distant friends',()=>{
  const qa=setup();for(let t=0;t<1300;t+=50)qa.step(50,[light()]);
  assert.equal(qa.friends[0].phase,'waking');assert.equal(qa.wakes.length,1);
  assert.ok(qa.friends.slice(1).every(f=>f.charge===0));
  for(let t=0;t<3000;t+=50)qa.step(50,[light()]);
  assert.equal(qa.friends[0].phase,'awake');assert.equal(qa.wakes.length,1);
});
test('stationary, held, absent and impossible-jump inputs cannot wake a friend',()=>{
  for(const input of [light({movement:0}),light({held:true}),light({active:false}),light({movement:10000})]){
    const qa=setup();for(let t=0;t<30000;t+=50)qa.step(50,[input]);
    assert.equal(qa.friends[0].charge,0);assert.equal(qa.wakes.length,0);
  }
});
test('a quick pass and overlapping lights do not trigger an instant wake',()=>{
  const single=setup(),group=setup();for(let t=0;t<200;t+=50){single.step(50,[light({movement:20})]);group.step(50,Array.from({length:4},()=>light({movement:20})));}
  assert.equal(single.friends[0].phase,'rest');assert.equal(group.friends[0].charge,single.friends[0].charge);
});
test('short webcam rubbing survives the real position filter and rendering smoothing',()=>{
  for(const dt of [1000/60,1000/30,50]){
    const qa=setup(),tracker=qa.ctx.ForestHandTracking.createPointTracker();let lastSample=-100,point=null,current=null,wokeAt=0;
    for(let t=0;t<2200;t+=dt){
      if(t-lastSample>=50-.001){
        lastSample=t;const rawX=.02+.96*(640/1920+.025*Math.sin(t/180));
        point=tracker.push({x:rawX,y:.5},t).point||point;
      }
      if(!point){qa.step(dt,[]);continue;}
      if(!current||point.reset)current={x:point.x,y:point.y};
      point={...point,reset:false};
      const ease=1-Math.exp(-dt/75),dx=(point.x-current.x)*ease,dy=(point.y-current.y)*ease;
      current.x+=dx;current.y+=dy;
      qa.step(dt,[light({...current,movement:Math.hypot(dx*1920,dy*800)})]);
      if(qa.wakes.length){wokeAt=t;break;}
    }
    assert.ok(wokeAt>0&&wokeAt<2000,'short filtered gesture should wake at '+dt+' ms frames');
  }
});
