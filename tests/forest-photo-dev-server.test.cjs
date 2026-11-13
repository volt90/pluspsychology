'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {once} = require('node:events');
const {createDevServer, commandLine} = require('../scripts/mind-forest-dev-server.cjs');

const SITE = 'https://www.pluspsychology.ai';
const API = '/api/mind-forest-photo';
const PHOTO = '1760000000000-' + 'a'.repeat(32);
const SHARED = {url:SITE + API + '?photo=' + PHOTO, qr:'data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACwAAAAAAQABAAACAkQBADs=', expiresIn:600};
// Generated 4 x 4 solid-color JPEG; no camera or personal photo is used.
const JPEG = Buffer.from('/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMDAsKCwsNDhIQDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRT/2wBDAQMEBAUEBQkFBQkUDQsNFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBT/wAARCAAEAAQDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD7gooor8/PqD//2Q==', 'base64');
const reply = (data,status=200) => new Response(JSON.stringify(data), {status, headers:{'Content-Type':'application/json'}});

async function harness(t, fetchUpstream, options = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(),'forest-photo-dev-'));
  const assets = path.join(root,'03_체험자료/assets/mind-forest');
  fs.mkdirSync(path.join(root,'experience'),{recursive:true});
  fs.mkdirSync(assets,{recursive:true});
  fs.writeFileSync(path.join(root,'experience/mind-forest.html'),'<!doctype html><title>Forest fixture</title>');
  fs.writeFileSync(path.join(assets,'sample.mp4'),'synthetic-video-for-range-test');
  const logs = [];
  const server = createDevServer({root,fetchUpstream,log:message=>logs.push(message),...options});
  server.listen(0,'127.0.0.1');await once(server,'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  t.after(async()=>{
    await new Promise(resolve=>{server.close(resolve);server.closeAllConnections();});
    const relative = path.relative(fs.realpathSync(os.tmpdir()),fs.realpathSync(root));
    assert.ok(relative.startsWith('forest-photo-dev-')&&!relative.includes(path.sep)&&!path.isAbsolute(relative));
    fs.rmSync(root,{recursive:true,force:true});
  });
  return {base,logs,root,upload:(body=JPEG,headers={})=>fetch(base+API,{method:'POST',headers:{Origin:base,'Content-Type':'application/octet-stream',...headers},body})};
}

test('local config and a synthetic upload use the fixed website API and preserve its public QR URL',async t=>{
  const calls=[];
  const config={photoShare:true,photoShareLifetimeSeconds:600};
  const h=await harness(t,async(url,options)=>{calls.push({url,options});return options.method==='POST'?reply(SHARED,201):reply(config);});
  const response=await fetch(h.base+API);assert.equal(response.status,200);assert.deepEqual(await response.json(),config);
  const uploaded=await h.upload(JPEG,{Authorization:'Bearer local-only',Cookie:'local-cookie=value'});
  assert.equal(uploaded.status,201);assert.deepEqual(await uploaded.json(),SHARED);
  assert.equal(calls.length,2);
  for(const call of calls){
    assert.equal(call.url,SITE+API);assert.equal(call.options.headers.Origin,SITE);assert.equal(call.options.redirect,'manual');
    assert.equal(call.options.headers.Authorization,undefined);assert.equal(call.options.headers.Cookie,undefined);
  }
  assert.deepEqual(calls[1].options.body,JPEG);
  assert.equal(calls[1].options.headers['Content-Type'],'application/octet-stream');
  assert.deepEqual(h.logs,[]);
});

test('website configuration and rate-limit errors remain authoritative without a local fallback',async t=>{
  let enabled=false;
  const h=await harness(t,async(url,options)=>options.method==='POST'?reply({error:'Please wait before trying again.'},429):reply({photoShare:enabled}));
  assert.deepEqual(await (await fetch(h.base+API)).json(),{photoShare:false});
  enabled=true;
  assert.deepEqual(await (await fetch(h.base+API)).json(),{photoShare:true});
  const upload=await h.upload();assert.equal(upload.status,429);assert.deepEqual(await upload.json(),{error:'Please wait before trying again.'});
  assert.deepEqual(h.logs,[]);
});

test('old photo links go to the website for expiry checks and never depend on the local server lifetime',async t=>{
  let calls=0;
  const h=await harness(t,async()=>{calls++;throw new Error('Must not proxy a photo download.');});
  const oldId='0000000000001-'+'b'.repeat(32);
  for(const suffix of ['', '&view=1', '&download=1']){
    const response=await fetch(h.base+API+'?photo='+oldId+suffix,{redirect:'manual'});
    assert.equal(response.status,307);assert.equal(response.headers.get('location'),SITE+API+'?photo='+oldId+suffix);
  }
  assert.equal(calls,0);assert.deepEqual(h.logs,[]);
});

test('network failure, timeout and an unexpected redirect produce a clear unavailable response',async t=>{
  const implementations=[
    async()=>{throw new TypeError('Offline');},
    async(_url,{signal})=>new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(Object.assign(new Error('Timed out'),{name:'AbortError'})),{once:true})),
    async()=>new Response(null,{status:302,headers:{Location:'http://192.168.0.5/photo'}}),
    async()=>new Response('<html>Unavailable</html>',{status:502})
  ];
  for(const fetchUpstream of implementations){
    const h=await harness(t,fetchUpstream,{timeoutMs:20});
    const response=await fetch(h.base+API);assert.equal(response.status,503);
    assert.match((await response.json()).error,/웹사이트 사진 저장 서비스/);
    assert.equal(h.logs.length,1);
  }
});

test('a LAN or unrelated upload URL is rejected instead of becoming the phone QR destination',async t=>{
  for(const url of ['http://192.168.0.5:8765'+API+'?photo='+PHOTO,'https://unrelated.example'+API+'?photo='+PHOTO]){
    const h=await harness(t,async()=>reply({...SHARED,url},201));
    const response=await h.upload();assert.equal(response.status,503);assert.match((await response.json()).error,/웹사이트 사진 저장 서비스/);
  }
});

test('only a local page can upload a bounded JPEG and request parameters cannot select an upstream',async t=>{
  let calls=0;
  const h=await harness(t,async()=>{calls++;return reply(SHARED,201);});
  assert.equal((await h.upload(JPEG,{Origin:'http://unrelated.example'})).status,403);
  assert.equal((await fetch(h.base+API,{method:'POST',headers:{'Content-Type':'application/octet-stream'},body:JPEG})).status,403);
  assert.equal((await h.upload(JPEG,{'Content-Type':'image/jpeg'})).status,415);
  assert.equal((await h.upload(Buffer.alloc(2*1024*1024+1))).status,413);
  assert.equal((await h.upload(Buffer.from('not a JPEG'))).status,400);
  for(const query of ['?url=https://unrelated.example','?photo='+PHOTO+'&url=http://127.0.0.1:1','?photo=invalid']){
    assert.equal((await fetch(h.base+API+query,{redirect:'manual'})).status,400);
  }
  assert.equal((await fetch(h.base+API+'?target=other',{method:'POST',headers:{Origin:h.base,'Content-Type':'application/octet-stream'},body:JPEG})).status,400);
  const preflight=await fetch(h.base+API,{method:'OPTIONS',headers:{Origin:'http://unrelated.example'}});
  assert.equal(preflight.status,405);assert.equal(preflight.headers.get('access-control-allow-origin'),null);
  const hostStatus=await new Promise((resolve,reject)=>http.get(h.base+API,{headers:{Host:'unrelated.example'}},response=>{response.resume();resolve(response.statusCode);}).on('error',reject));
  assert.equal(hostStatus,403);assert.equal(calls,0);
});

test('public static files retain HEAD and video range support while repository internals stay private',async t=>{
  const h=await harness(t,async()=>reply({photoShare:true}));
  assert.equal((await fetch(h.base+'/experience/mind-forest')).status,200);
  const asset='/03_체험자료/assets/mind-forest/sample.mp4';
  const full=await fetch(h.base+asset),body=Buffer.from(await full.arrayBuffer());
  assert.equal(full.headers.get('content-type'),'video/mp4');
  const ranged=await fetch(h.base+asset,{headers:{Range:'bytes=2-7'}});
  assert.equal(ranged.status,206);assert.deepEqual(Buffer.from(await ranged.arrayBuffer()),body.subarray(2,8));
  const head=await fetch(h.base+asset,{method:'HEAD'});
  assert.equal(Number(head.headers.get('content-length')),body.length);assert.equal(await head.text(),'');
  assert.equal((await fetch(h.base+asset,{headers:{Range:'bytes=9999-'}})).status,416);
  for(const blocked of ['/.git/config','/.env','/docs/mind-forest.md','/tests/forest-photo-dev-server.test.cjs',
    '/scripts/mind-forest-dev-server.cjs','/api/mind-forest-photo.js','/package.json','/vercel.json',
    '/03_체험자료/assets/mind-forest/','/03_체험자료/assets/mind-forest/..%5c..%5cpackage.json']){
    assert.equal((await fetch(h.base+blocked)).status,404,blocked);
  }
});

test('CLI cannot override the photo service destination or expose a LAN listener',()=>{
  assert.throws(()=>commandLine(['--public-origin','http://192.168.0.5:8765']),/Use --root and --port/);
  assert.throws(()=>commandLine(['--upstream','https://unrelated.example']),/Use --root and --port/);
  assert.throws(()=>commandLine(['--host','0.0.0.0']),/Use --root and --port/);
});
