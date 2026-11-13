'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const {Readable} = require('node:stream');

const source = fs.readFileSync(path.join(__dirname,'../api/mind-forest-photo.js'),'utf8');
const API = '/api/mind-forest-photo';
const BUCKET = 'mind-forest-photos';
const SITE = 'https://www.pluspsychology.ai';
const STORAGE = 'https://photo-storage.unit-test.invalid';
const SECRET = 'unit-test-service-role-not-a-real-credential';
const NOW = 1800000000123;
const LIMIT = 2 * 1024 * 1024;
// Generated 4 x 4 solid-color JPEG; no camera frame or personal photo.
const JPEG = Buffer.from('/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMDAsKCwsNDhIQDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRT/2wBDAQMEBAUEBQkFBQkUDQsNFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBT/wAARCAAEAAQDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD7gooor8/PqD//2Q==','base64');
const reply = (status, value) => new Response(value === undefined ? null : JSON.stringify(value),{status,headers:{'Content-Type':'application/json'}});
const idAt = (time, suffix = 'a') => `${time}-${suffix.repeat(32)}`;

function setup({configured = true, existingBucket = true, publicBucket = false, entries, fault, cronSecret} = {}) {
  let time = NOW, bucketExists = existingBucket;
  const calls = [], qrCalls = [], objects = new Map();
  const environment = configured ? {SUPABASE_URL:STORAGE+'/',SUPABASE_SERVICE_ROLE_KEY:SECRET} : {};
  if (cronSecret) environment.CRON_SECRET = cronSecret;
  class Clock extends Date {static now(){return time;}}
  const module = {exports:{}};
  const context = vm.createContext({module,exports:module.exports,process:{env:environment},Buffer,URL,Date:Clock,AbortSignal,
    require(name) {
      if (name === 'node:crypto') return crypto;
      assert.equal(name,'qrcode-generator','unexpected dependency');
      return (version, correction) => {
        const qr = {version,correction}; qrCalls.push(qr);
        return {addData:value=>{qr.value=value;},make:()=>{qr.made=true;},createDataURL:(size,margin)=>{
          assert.equal(qr.made,true);qr.size=size;qr.margin=margin;
          return 'data:image/gif;base64,'+Buffer.from('unit-test-qr').toString('base64');
        }};
      };
    },
    async fetch(url, options) {
      assert.ok(url.startsWith(STORAGE+'/storage/v1/'),'only mocked storage URLs may be requested');
      const route = url.slice((STORAGE+'/storage/v1').length), method = options.method || 'GET';
      calls.push({route,method,...options});
      if (fault) {const failure = await fault(route,options);if (failure !== undefined) return failure;}
      if (route === `/bucket/${BUCKET}` && method === 'GET') return reply(bucketExists?200:404,{public:publicBucket});
      if (route === '/bucket' && method === 'POST') {bucketExists=true;return reply(200,{id:BUCKET});}
      if (route === `/object/list/${BUCKET}`) return reply(200,entries || [...objects.keys()].map(name=>({name})));
      if (route === `/object/${BUCKET}` && method === 'DELETE') {
        for (const name of JSON.parse(options.body).prefixes) objects.delete(name);
        return reply(200,[]);
      }
      const write = `/object/${BUCKET}/`, read = `/object/authenticated/${BUCKET}/`;
      if (route.startsWith(write) && method === 'POST') {
        const name = route.slice(write.length);
        if (objects.has(name)) return reply(409,{error:'Duplicate'});
        objects.set(name,Buffer.from(options.body));return reply(200,{Key:BUCKET+'/'+name});
      }
      if (route.startsWith(read) && ['GET','HEAD'].includes(method)) {
        const photo = objects.get(route.slice(read.length));
        return photo ? new Response(method==='HEAD'?null:photo,{status:200}) : reply(404,{error:'Object not found'});
      }
      throw new Error('Unexpected mocked storage operation: '+method+' '+route);
    }});
  vm.runInContext(source,context,{filename:'mind-forest-photo.js'});
  return {calls,qrCalls,objects,advance:ms=>{time+=ms;},
    async request({method='GET',url=API,headers={},body,chunks}={}) {
      const req = chunks ? Readable.from(chunks) : {};
      Object.assign(req,{method,url,headers,socket:{remoteAddress:'198.51.100.42'}});
      if (body !== undefined) req.body=body;
      const res={statusCode:200,headers:{},body:Buffer.alloc(0),
        setHeader(name,value){this.headers[name.toLowerCase()]=value;},
        end(value){this.body=value===undefined?Buffer.alloc(0):Buffer.from(value);}};
      await module.exports(req,res);
      const text=res.body.toString('utf8');
      assert.equal(res.headers['cache-control'],'no-store');
      assert.equal(res.headers['x-content-type-options'],'nosniff');
      assert.equal(res.headers['referrer-policy'],'no-referrer');
      assert.ok(!text.includes(SECRET),'server service role must never appear in the response');
      assert.ok(!JSON.stringify(res.headers).includes(SECRET),'server service role must never appear in headers');
      return {...res,text,json:res.headers['content-type']?.startsWith('application/json')?JSON.parse(text):null};
    },
    upload(options={}) {
      return this.request({method:'POST',body:JPEG,...options,headers:{origin:SITE,'content-type':'application/octet-stream',...options.headers}});
    }};
}

test('configuration advertises website sharing and the ten-minute lifetime without revealing storage configuration',async()=>{
  for(const configured of [true,false]){
    const qa=setup({configured}),res=await qa.request();
    assert.equal(res.statusCode,200);
    assert.deepEqual(res.json,{photoShare:configured,photoShareScope:'website',photoShareLifetimeSeconds:600});
    assert.equal(qa.calls.length,0);
    assert.ok(!res.text.includes(STORAGE));
    if(!configured){const upload=await qa.upload();assert.equal(upload.statusCode,503);assert.equal(qa.calls.length,0);}
  }
});

test('upload creates a private JPEG-only bucket and returns a canonical website QR',async()=>{
  const qa=setup({existingBucket:false});
  const res=await qa.upload({headers:{origin:'https://pluspsychology.ai'}});
  assert.equal(res.statusCode,201);
  const create=qa.calls.find(call=>call.route==='/bucket'&&call.method==='POST');
  assert.deepEqual(JSON.parse(create.body),{id:BUCKET,name:BUCKET,public:false,file_size_limit:LIMIT,allowed_mime_types:['image/jpeg']});
  const saved=qa.calls.find(call=>call.route.startsWith(`/object/${BUCKET}/`)&&call.method==='POST');
  assert.equal(saved.headers['Content-Type'],'image/jpeg');assert.equal(saved.headers['x-upsert'],'false');
  assert.equal(saved.headers['Cache-Control'],'no-store');assert.deepEqual(saved.body,JPEG);
  for(const call of qa.calls){assert.equal(call.headers.apikey,SECRET);assert.equal(call.headers.Authorization,`Bearer ${SECRET}`);assert.ok(call.signal);}
  const url=new URL(res.json.url);
  assert.equal(url.origin,SITE);assert.equal(url.pathname,API);assert.match(url.searchParams.get('photo'),/^\d{13}-[a-f0-9]{32}$/);
  assert.equal(qa.qrCalls.length,1);assert.equal(qa.qrCalls[0].value,res.json.url);
  assert.equal(qa.qrCalls[0].correction,'M');assert.match(res.json.qr,/^data:image\/gif;base64,/);
  assert.ok(!res.text.includes(STORAGE),'client receives the website proxy URL, never the storage endpoint');
});

test('unapproved or missing upload origins are rejected before storage access',async()=>{
  for(const origin of [undefined,'null','https://unrelated.example','http://127.0.0.1:8765','https://www.pluspsychology.ai.unrelated.example']){
    const qa=setup(),res=await qa.upload({headers:{origin}});
    assert.equal(res.statusCode,403);assert.equal(qa.calls.length,0);
  }
});

test('wrong media types, invalid JPEG markers, and oversized buffered or streamed bodies are rejected',async()=>{
  const cases=[
    [{headers:{'content-type':'image/png'}},415],
    [{body:Buffer.from('not a jpeg')},400],
    [{body:JPEG.subarray(0,JPEG.length-2)},400],
    [{headers:{'content-length':String(LIMIT+1)}},413],
    [{body:Buffer.alloc(LIMIT+1)},413],
    [{body:undefined,chunks:[JPEG,Buffer.alloc(LIMIT)]},413],
  ];
  for(const [options,status] of cases){const qa=setup(),res=await qa.upload(options);assert.equal(res.statusCode,status);assert.equal(qa.calls.length,0);}
});

test('a streamed JPEG uploads successfully and duplicate address slots return a retry response',async()=>{
  const qa=setup();
  const first=await qa.upload({body:undefined,chunks:[JPEG.subarray(0,80),JPEG.subarray(80)]});
  assert.equal(first.statusCode,201);
  assert.equal((await qa.upload()).statusCode,429);
  qa.advance(5000);
  const next=await qa.upload();assert.equal(next.statusCode,201);assert.notEqual(next.json.url,first.json.url);
  assert.equal(qa.calls.filter(call=>call.route===`/bucket/${BUCKET}`).length,1,'a verified bucket is reused within a warm invocation');
});

test('mobile landing pages and image downloads use server-authenticated storage without exposing credentials',async()=>{
  const qa=setup(),id=idAt(NOW-1000);qa.objects.set(id+'.jpg',JPEG);
  const landing=await qa.request({url:API+'?photo='+id});
  assert.equal(landing.statusCode,200);assert.match(landing.headers['content-type'],/^text\/html/);
  assert.match(landing.text,/사진 저장/);assert.match(landing.text,/download=1/);assert.ok(!landing.text.includes(STORAGE));
  assert.equal(qa.calls.at(-1).method,'HEAD');assert.equal(qa.calls.at(-1).route,`/object/authenticated/${BUCKET}/${id}.jpg`);
  const view=await qa.request({url:API+'?photo='+id+'&view=1'});
  assert.equal(view.statusCode,200);assert.equal(view.headers['content-type'],'image/jpeg');assert.deepEqual(view.body,JPEG);
  assert.equal(view.headers['content-disposition'],undefined);
  const download=await qa.request({url:API+'?photo='+id+'&download=1'});
  assert.equal(download.statusCode,200);assert.deepEqual(download.body,JPEG);
  assert.equal(download.headers['content-disposition'],'attachment; filename="forest-group-photo.jpg"');
  const head=await qa.request({method:'HEAD',url:API+'?photo='+id+'&download=1'});
  assert.equal(head.statusCode,200);assert.equal(head.body.length,0);assert.equal(qa.calls.at(-1).method,'HEAD');
  for(const call of qa.calls){assert.equal(call.headers.Authorization,`Bearer ${SECRET}`);assert.ok(call.route.startsWith('/object/authenticated/'));}
});

test('invalid, expired, and future photo links are rejected without fetching private storage',async()=>{
  for(const id of ['invalid',idAt(NOW-600000),idAt(NOW+1),'<script>alert(1)</script>']){
    const qa=setup(),res=await qa.request({url:API+'?photo='+encodeURIComponent(id)});
    assert.equal(res.statusCode,404);assert.match(res.text,/사진을 찾을 수 없어요/);assert.equal(qa.calls.length,0);
    assert.ok(!res.text.includes('<script>'));
  }
  const missing=setup(),res=await missing.request({url:API+'?photo='+idAt(NOW)});
  assert.equal(res.statusCode,404);assert.equal(missing.calls.length,1);
});

test('expired objects are deleted before a new upload and a full active collection refuses new photos',async()=>{
  const expired=idAt(NOW-600000)+'.jpg',active=idAt(NOW-1000,'b')+'.jpg';
  const qa=setup({entries:[{name:expired},{name:active}]});
  assert.equal((await qa.upload()).statusCode,201);
  const deletion=qa.calls.findIndex(call=>call.method==='DELETE');
  const upload=qa.calls.findIndex(call=>call.route.startsWith(`/object/${BUCKET}/`));
  assert.ok(deletion>=0&&deletion<upload);assert.deepEqual(JSON.parse(qa.calls[deletion].body),{prefixes:[expired]});
  const full=setup({entries:Array.from({length:120},(_,index)=>({name:`${NOW-1000}-${index.toString(16).padStart(32,'0')}.jpg`}))});
  assert.equal((await full.upload()).statusCode,429);
  assert.ok(full.calls.every(call=>!call.route.startsWith(`/object/${BUCKET}/`)));
});

test('a public bucket is refused and a failed bucket check can recover on the next request',async()=>{
  const publicStore=setup({publicBucket:true});
  assert.equal((await publicStore.upload()).statusCode,503);assert.equal(publicStore.qrCalls.length,0);
  assert.ok(publicStore.calls.every(call=>!call.route.startsWith('/object/')));
  let fail=true;
  const qa=setup({fault:route=>{if(fail&&route===`/bucket/${BUCKET}`){fail=false;return reply(503,{error:'temporary'});}}});
  assert.equal((await qa.upload()).statusCode,503);
  assert.equal((await qa.upload()).statusCode,201);
});

test('storage listing, cleanup, upload, and download failures return generic errors without credentials',async()=>{
  const expired=idAt(NOW-600000)+'.jpg';
  for(const failure of ['list','delete','upload','download','network']){
    const qa=setup({entries:[{name:expired}],fault:(route,options)=>{
      const matches=failure==='network'||failure==='list'&&route.includes('/object/list/')||failure==='delete'&&options.method==='DELETE'
        ||failure==='upload'&&route.startsWith(`/object/${BUCKET}/`)||failure==='download'&&route.includes('/authenticated/');
      if(matches){if(failure==='network')throw new Error('private upstream detail '+SECRET);return reply(500,{error:'private upstream detail '+SECRET});}
    }});
    const res=failure==='download'?await qa.request({url:API+'?photo='+idAt(NOW)+'&download=1'}):await qa.upload();
    assert.equal(res.statusCode,503);assert.deepEqual(res.json,{error:'Photo sharing is temporarily unavailable.'});
    assert.ok(!res.text.includes(STORAGE));assert.equal(qa.qrCalls.length,0);
  }
});

test('scheduled cleanup checks its configured secret and unsupported methods cannot modify photos',async()=>{
  const qa=setup({cronSecret:'unit-test-cron-secret'});
  const denied=await qa.request({headers:{'user-agent':'vercel-cron/1.0'}});
  assert.equal(denied.statusCode,403);assert.equal(qa.calls.length,0);
  const cleaned=await qa.request({headers:{'user-agent':'vercel-cron/1.0',authorization:'Bearer unit-test-cron-secret'}});
  assert.equal(cleaned.statusCode,200);assert.deepEqual(cleaned.json,{cleaned:true});
  const methods=setup();
  for(const method of ['PUT','DELETE','PATCH'])assert.equal((await methods.request({method})).statusCode,405);
  assert.equal(methods.calls.length,0);
});
