const { createHmac } = require('node:crypto');
const qrcode = require('qrcode-generator');

const site = 'https://www.pluspsychology.ai';
const origins = new Set([site, 'https://pluspsychology.ai']);
const apiPath = '/api/mind-forest-photo';
const bucket = 'mind-forest-photos';
const maxBytes = 2 * 1024 * 1024;
const lifetime = 10 * 60 * 1000;
const maxActive = 120;
const photoId = /^([0-9]{13})-[a-f0-9]{32}$/;
const storageUrl = (process.env.SUPABASE_URL || '').replace(/\/+$/, '') + '/storage/v1';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const configured = Boolean(process.env.SUPABASE_URL && serviceKey);
let bucketReady;

function json(res, status, data) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(data));
}

function store(route, options = {}) {
  return fetch(storageUrl + route, {
    ...options,
    signal: AbortSignal.timeout(4500),
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, ...options.headers },
  });
}

function storeJson(route, method, body) {
  return store(route, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
}

function ensureBucket() {
  bucketReady ??= (async () => {
    let info = await store(`/bucket/${bucket}`);
    if (info.status === 404 || info.status === 400) {
      const created = await storeJson('/bucket', 'POST', {
        id: bucket, name: bucket, public: false, file_size_limit: maxBytes, allowed_mime_types: ['image/jpeg'],
      });
      if (created.ok) return;
      info = await store(`/bucket/${bucket}`);
    }
    if (!info.ok || (await info.json()).public !== false) throw new Error('Private photo bucket unavailable');
  })().catch(error => { bucketReady = undefined; throw error; });
  return bucketReady;
}

async function prunePhotos(now) {
  const list = await storeJson(`/object/list/${bucket}`, 'POST', {
    prefix: '', limit: maxActive + 1, offset: 0, sortBy: { column: 'name', order: 'asc' },
  });
  if (!list.ok) throw new Error('Photo listing unavailable');
  const entries = await list.json();
  const expired = entries.filter(({ name }) => {
    const match = photoId.exec(name.replace(/\.jpg$/, ''));
    return match && now - Number(match[1]) >= lifetime;
  }).map(({ name }) => name);
  if (expired.length) {
    const deleted = await storeJson(`/object/${bucket}`, 'DELETE', { prefixes: expired });
    if (!deleted.ok) throw new Error('Photo cleanup unavailable');
  }
  return entries.length - expired.length;
}

async function receiveImage(req) {
  if (Buffer.isBuffer(req.body)) return req.body;
  const chunks = [];
  let length = 0;
  for await (const part of req) {
    const chunk = Buffer.isBuffer(part) ? part : Buffer.from(part);
    length += chunk.length;
    if (length > maxBytes) return null;
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function uploadPhoto(req, res) {
  if (!origins.has(req.headers.origin)) return json(res, 403, { error: 'Open the exhibition page to take a photo.' });
  if (req.headers['content-type'] !== 'application/octet-stream') return json(res, 415, { error: 'JPEG required.' });
  if (Number(req.headers['content-length']) > maxBytes) return json(res, 413, { error: 'Photo too large.' });
  const image = await receiveImage(req);
  if (!image || image.length > maxBytes) return json(res, 413, { error: 'Photo too large.' });
  if (image.length < 4 || image.readUInt16BE(0) !== 0xffd8 || image.readUInt16BE(image.length - 2) !== 0xffd9) {
    return json(res, 400, { error: 'Invalid JPEG.' });
  }
  const now = Date.now();
  // One upload slot per address every five seconds, enforced by storage's no-overwrite write.
  const slot = Math.floor(now / 5000) * 5000;
  const ip = req.headers['x-vercel-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
  const key = createHmac('sha256', serviceKey).update(`mind-forest-photo:${slot}:${ip}`).digest('hex').slice(0, 32);
  const id = `${slot}-${key}`;
  await ensureBucket();
  if (await prunePhotos(now) >= maxActive) return json(res, 429, { error: 'Photo sharing is busy.' });
  const saved = await store(`/object/${bucket}/${id}.jpg`, {
    method: 'POST', headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'no-store', 'x-upsert': 'false' }, body: image,
  });
  if (!saved.ok) {
    const error = await saved.json().catch(() => ({}));
    if (saved.status === 409 || String(error.statusCode) === '409' || error.error === 'Duplicate') {
      return json(res, 429, { error: 'Please wait a moment before trying again.' });
    }
    throw new Error('Photo upload unavailable');
  }
  const url = `${site}${apiPath}?photo=${id}`;
  const qr = qrcode(0, 'M');
  qr.addData(url);
  qr.make();
  return json(res, 201, { url, qr: qr.createDataURL(5, 20) });
}

function photoPage(req, res, id) {
  const title = id ? '우리의 단체 사진' : '사진을 찾을 수 없어요';
  const content = id
    ? `<img src="${apiPath}?photo=${id}&amp;view=1" alt="캐릭터들과 함께 찍은 단체 사진"><a href="${apiPath}?photo=${id}&amp;download=1" download="forest-group-photo.jpg">사진 저장</a>`
    : '<p>사진 링크는 촬영 후 약 10분 동안 열립니다.</p>';
  res.statusCode = id ? 200 : 404;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end(req.method === 'HEAD' ? undefined : `<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>body{margin:0;padding:24px 16px;text-align:center;color:#fff4db;background:#101c20;font:16px system-ui,sans-serif}main{margin:auto;max-width:480px}img{display:block;width:100%;height:auto;border-radius:10px}a{display:inline-block;margin-top:18px;padding:12px 24px;background:#f1d7a2;color:#20342d;border-radius:24px;text-decoration:none;font-weight:700}</style><main><h1>${title}</h1>${content}</main></html>`);
}

async function downloadPhoto(req, res, url, id) {
  const match = photoId.exec(id);
  const age = match ? Date.now() - Number(match[1]) : Infinity;
  if (age < 0 || age >= lifetime) return photoPage(req, res, null);
  const view = url.searchParams.has('view');
  const download = url.searchParams.has('download');
  const route = `/object/authenticated/${bucket}/${id}.jpg`;
  const image = await store(route, { method: !view && !download || req.method === 'HEAD' ? 'HEAD' : 'GET' });
  if (image.status === 400 || image.status === 404) return photoPage(req, res, null);
  if (!image.ok) throw new Error('Photo download unavailable');
  if (!view && !download) return photoPage(req, res, id);
  res.setHeader('Content-Type', 'image/jpeg');
  if (download) res.setHeader('Content-Disposition', 'attachment; filename="forest-group-photo.jpg"');
  res.end(req.method === 'HEAD' ? undefined : Buffer.from(await image.arrayBuffer()));
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  res.setHeader('Referrer-Policy', 'no-referrer');
  try {
    const url = new URL(req.url, site);
    if (req.method === 'POST') {
      if (!configured) return json(res, 503, { error: 'Photo sharing is unavailable.' });
      return await uploadPhoto(req, res);
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') return json(res, 405, { error: 'Method not allowed.' });
    if (req.method === 'GET' && req.headers['user-agent'] === 'vercel-cron/1.0') {
      if (process.env.CRON_SECRET && req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
        return json(res, 403, { error: 'Forbidden.' });
      }
      if (configured) { await ensureBucket(); await prunePhotos(Date.now()); }
      return json(res, 200, { cleaned: configured });
    }
    if (!url.searchParams.has('photo')) return json(res, 200, {
      photoShare: configured, photoShareScope: 'website', photoShareLifetimeSeconds: lifetime / 1000,
    });
    if (!configured) return photoPage(req, res, null);
    return await downloadPhoto(req, res, url, url.searchParams.get('photo'));
  } catch {
    return json(res, 503, { error: 'Photo sharing is temporarily unavailable.' });
  }
};
