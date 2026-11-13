/* Local exhibition preview. Photo storage and QR links use the live website API. */
'use strict';
const http = require('node:http');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');

const SITE = 'https://www.pluspsychology.ai';
const API_PATH = '/api/mind-forest-photo';
const UPSTREAM = SITE + API_PATH;
const MAX_BYTES = 2 * 1024 * 1024;
const PHOTO_ID = /^[0-9]{13}-[a-f0-9]{32}$/;
const DEFAULT_ROOT = path.resolve(__dirname, '..');
const TYPES = new Map(Object.entries({
  '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.mjs':'text/javascript; charset=utf-8',
  '.css':'text/css; charset=utf-8', '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg',
  '.webp':'image/webp', '.gif':'image/gif', '.svg':'image/svg+xml', '.ico':'image/x-icon',
  '.mp3':'audio/mpeg', '.wav':'audio/wav', '.webm':'video/webm', '.mp4':'video/mp4',
  '.woff':'font/woff', '.woff2':'font/woff2', '.wasm':'application/wasm',
  '.task':'application/octet-stream', '.tflite':'application/octet-stream'
}));

function json(res, status, data, head = false) {
  res.writeHead(status, {'Content-Type':'application/json; charset=utf-8'});
  res.end(head ? undefined : JSON.stringify(data));
}
function readImage(req) {
  return new Promise(resolve => {
    const chunks = [];
    let length = 0, settled = false;
    const finish = value => { if (!settled) { settled = true; req.setTimeout(0); resolve(value); } };
    req.on('data', chunk => {
      if (settled) return;
      length += chunk.length;
      if (length > MAX_BYTES) { chunks.length = 0; finish(null); return; }
      chunks.push(chunk);
    });
    req.on('end', () => finish(Buffer.concat(chunks)));
    req.on('aborted', () => finish(null));
    req.on('error', () => finish(null));
    req.setTimeout(10000, () => { finish(null); req.destroy(); });
  });
}
function officialPhotoResponse(data) {
  if (!data || typeof data.url !== 'string' || typeof data.qr !== 'string') return false;
  try {
    const url = new URL(data.url);
    return url.origin === SITE && url.pathname === API_PATH && !url.username && !url.password
      && PHOTO_ID.test(url.searchParams.get('photo')) && /^data:image\/(gif|png);base64,[a-zA-Z0-9+/=]+$/.test(data.qr);
  } catch { return false; }
}

function createDevServer({root = DEFAULT_ROOT, fetchUpstream = globalThis.fetch, timeoutMs = 15000,
  log = message => console.error(message)} = {}) {
  root = path.resolve(root);
  const assetRoots = ['01_카메라엔진','02_사람분리모델','03_체험자료'].map(folder => ({
    prefix:`/${folder}/assets/mind-forest/`, directory:path.join(root, folder, 'assets/mind-forest')
  }));
  function allowedOrigins() {
    const port = server.address()?.port;
    return new Set([`http://127.0.0.1:${port}`, `http://localhost:${port}`]);
  }
  async function proxyPhotoAPI(req, res, image) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    timeout.unref();
    const disconnected = () => { if (!res.writableEnded) controller.abort(); };
    res.once('close', disconnected);
    try {
      // This destination cannot be changed by a URL, request header or CLI option.
      // Never forward local cookies, authorization headers or storage credentials.
      const response = await fetchUpstream(UPSTREAM, {
        method:image ? 'POST' : 'GET', redirect:'manual', signal:controller.signal,
        headers:{Accept:'application/json', Origin:SITE, ...(image ? {'Content-Type':'application/octet-stream'} : {})},
        ...(image ? {body:image} : {})
      });
      const data = await response.json();
      if (response.status >= 300 && response.status < 400) throw new Error('Unexpected photo service redirect.');
      if (response.ok && (image ? !officialPhotoResponse(data) : typeof data.photoShare !== 'boolean')) throw new Error('Invalid photo service response.');
      if (!response.ok && ![400,403,413,415,429,503].includes(response.status)) throw new Error('Photo service unavailable.');
      if (!response.ok && typeof data.error !== 'string') throw new Error('Invalid photo service error.');
      if (!res.destroyed) json(res,response.status,data,req.method==='HEAD');
    } catch(error) {
      log(`Website photo service unavailable (${error.name || 'Error'}).`);
      if (!res.destroyed) json(res,503,{error:'웹사이트 사진 저장 서비스에 연결하지 못했어요. 잠시 후 다시 촬영해 주세요.'});
    } finally {
      clearTimeout(timeout);
      res.removeListener('close',disconnected);
    }
  }
  async function photoAPI(req,res,url) {
    if (!['GET','HEAD','POST'].includes(req.method)) return json(res,405,{error:'Method not allowed.'});
    if (req.method === 'POST') {
      if (url.search) return json(res,400,{error:'Unexpected photo upload parameters.'});
      if (!allowedOrigins().has(req.headers.origin)) return json(res,403,{error:'Open the local exhibition page to take a photo.'});
      if (req.headers['content-type'] !== 'application/octet-stream') return json(res,415,{error:'JPEG required.'});
      if (Number(req.headers['content-length']) > MAX_BYTES) {req.resume();return json(res,413,{error:'Photo too large.'});}
      const image = await readImage(req);
      if (res.destroyed) return;
      if (!image) return json(res,413,{error:'Photo too large or incomplete.'});
      if (image.length < 4 || image.readUInt16BE(0) !== 0xffd8 || image.readUInt16BE(image.length-2) !== 0xffd9) return json(res,400,{error:'Invalid JPEG.'});
      return proxyPhotoAPI(req,res,image);
    }
    if (url.searchParams.has('photo')) {
      const id=url.searchParams.get('photo');
      if (!PHOTO_ID.test(id) || [...url.searchParams.keys()].some(key => !['photo','view','download'].includes(key))) return json(res,400,{error:'Invalid photo link.'});
      const destination=new URL(UPSTREAM);
      destination.searchParams.set('photo',id);
      for(const flag of ['view','download'])if(url.searchParams.has(flag))destination.searchParams.set(flag,'1');
      // Existence and expiry belong to the website. There is no local photo store.
      res.writeHead(307,{Location:destination.href});res.end();return;
    }
    if (url.search) return json(res,400,{error:'Unexpected photo service parameters.'});
    return proxyPhotoAPI(req,res);
  }
  function publicFile(pathname) {
    if (pathname.includes('\\') || pathname.includes('\0') || pathname.split('/').some(segment => segment.startsWith('.'))) return null;
    if (['/experience/mind-forest','/experience/mind-forest.html'].includes(pathname)) return {file:path.join(root,'experience/mind-forest.html'),directory:path.join(root,'experience')};
    const entry=assetRoots.find(item => pathname.startsWith(item.prefix));
    if (!entry || !TYPES.has(path.extname(pathname).toLowerCase()) || path.extname(pathname).toLowerCase()==='.html') return null;
    const relative=pathname.slice(entry.prefix.length);
    if (!relative || relative.includes(':')) return null;
    return {file:path.join(entry.directory,relative),directory:entry.directory};
  }
  async function staticFile(req,res,pathname) {
    if (!['GET','HEAD'].includes(req.method)) return json(res,405,{error:'Method not allowed.'});
    if (pathname==='/') {res.writeHead(302,{Location:'/experience/mind-forest.html'});res.end();return;}
    const entry=publicFile(pathname);
    if (!entry) return json(res,404,{error:'Not found.'});
    let actual,directory,stat;
    try { [actual,directory]=await Promise.all([fsp.realpath(entry.file),fsp.realpath(entry.directory)]);stat=await fsp.stat(actual); }
    catch { return json(res,404,{error:'Not found.'}); }
    const relative=path.relative(directory,actual);
    if (relative.startsWith('..') || path.isAbsolute(relative) || !stat.isFile()) return json(res,404,{error:'Not found.'});
    let start=0,end=stat.size-1,status=200;
    if (req.headers.range) {
      const match=/^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
      if (!match || !match[1]&&!match[2]) {res.writeHead(416,{'Content-Range':`bytes */${stat.size}`});res.end();return;}
      start=match[1]?Number(match[1]):Math.max(0,stat.size-Number(match[2]));
      end=match[1]&&match[2]?Math.min(Number(match[2]),stat.size-1):stat.size-1;
      if (!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start>end||start>=stat.size) {res.writeHead(416,{'Content-Range':`bytes */${stat.size}`});res.end();return;}
      status=206;res.setHeader('Content-Range',`bytes ${start}-${end}/${stat.size}`);
    }
    res.writeHead(status,{'Content-Type':TYPES.get(path.extname(actual).toLowerCase())||'application/octet-stream','Content-Length':Math.max(0,end-start+1),'Accept-Ranges':'bytes'});
    if (req.method==='HEAD'||stat.size===0) {res.end();return;}
    const stream=fs.createReadStream(actual,{start,end});
    stream.on('error',()=>res.destroy());res.on('close',()=>stream.destroy());stream.pipe(res);
  }
  const server=http.createServer(async(req,res)=>{
    res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Robots-Tag','noindex, nofollow');
    try {
      const origin=`http://${req.headers.host}`;
      if (!allowedOrigins().has(origin)) return json(res,403,{error:'Unknown host.'});
      const url=new URL(req.url,origin);
      if (url.origin!==origin) return json(res,400,{error:'Invalid URL.'});
      let pathname;
      try {pathname=decodeURIComponent(url.pathname);}catch{return json(res,400,{error:'Invalid path.'});}
      if (pathname===API_PATH) await photoAPI(req,res,url);
      else await staticFile(req,res,pathname);
    } catch(error) {
      log(`Local forest request failed (${error.code||error.name||'Error'}).`);
      if (!res.headersSent) json(res,503,{error:'Local preview temporarily unavailable.'});
      else res.destroy();
    }
  });
  server.requestTimeout=20000;server.headersTimeout=10000;server.keepAliveTimeout=2000;
  return server;
}

function commandLine(argv) {
  const options={};
  for(let index=0;index<argv.length;index++){
    const key=argv[index];
    if(!['--root','--port'].includes(key)||!argv[index+1])throw new Error('Use --root and --port with values.');
    options[key.slice(2)]=argv[++index];
  }
  const port=Number(options.port||8765);
  if(!Number.isInteger(port)||port<1||port>65535)throw new Error('Choose a port from 1 to 65535.');
  const server=createDevServer({root:options.root||DEFAULT_ROOT});
  server.on('error',error=>{console.error(`Local forest server failed (${error.code||error.name}).`);process.exitCode=1;});
  server.listen(port,'127.0.0.1',()=>{
    console.log(`Experience: http://127.0.0.1:${port}/experience/mind-forest.html`);
    console.log(`Photo service: ${UPSTREAM}`);
    console.log('Photo uploads and QR downloads use the website; no local photo storage.');
  });
  const stop=()=>{server.close();server.closeAllConnections();};
  process.once('SIGINT',stop);process.once('SIGTERM',stop);
  return server;
}
module.exports={createDevServer,commandLine};
if(require.main===module){try{commandLine(process.argv.slice(2));}catch(error){console.error(error.message);process.exitCode=1;}}
