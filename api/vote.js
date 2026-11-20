const { createHash, randomBytes } = require('node:crypto');
const polls = require('../vote/polls.json');

const cookieName = 'pp_vote_v1';
const bucket = process.env.VERCEL_ENV === 'preview' ? 'psychology-votes-preview' : 'psychology-votes';
const storageUrl = (process.env.SUPABASE_URL || '').replace(/\/+$/, '') + '/storage/v1';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
let ready;

function storage(path, method = 'GET', payload, headers = {}) {
  return fetch(storageUrl + path, {
    method,
    signal: AbortSignal.timeout(6000),
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json', ...headers },
    body: payload === undefined ? undefined : JSON.stringify(payload),
  });
}

async function privateBucket() {
  let info = await storage(`/bucket/${bucket}`);
  if (info.status === 400 || info.status === 404) {
    const created = await storage('/bucket', 'POST', {
      id: bucket, name: bucket, public: false, file_size_limit: 256, allowed_mime_types: ['application/json'],
    });
    if (created.ok) return;
    // Another cold instance can create the same bucket at the same time.
    info = await storage(`/bucket/${bucket}`);
  }
  if (!info.ok || (await info.json()).public !== false) throw new Error('Private vote storage unavailable');
}

function ensureBucket() {
  ready ??= privateBucket().catch(error => { ready = undefined; throw error; });
  return ready;
}

function sameOrigin(req) {
  try {
    const origin = new URL(req.headers.origin);
    return origin.host === req.headers.host && (origin.protocol === 'https:' ||
      (origin.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname)));
  } catch {
    return false;
  }
}

async function saveBallot(key, choiceId) {
  const ballot = { choiceId };
  const result = await storage(`/object/${bucket}/${key}`, 'POST', ballot, {
    'x-upsert': 'false', 'Cache-Control': 'no-store',
    'x-metadata': Buffer.from(JSON.stringify(ballot)).toString('base64'),
  });
  if (result.ok) return;
  const error = await result.json().catch(() => ({}));
  if (result.status === 409 || String(error.statusCode) === '409' || error.error === 'Duplicate' || error.code === 'ResourceAlreadyExists') return;
  throw new Error('Could not store ballot');
}

async function results(poll, voterKey) {
  const counts = Object.fromEntries(poll.options.map(({ id }) => [id, 0]));
  let total = 0;
  let myChoice = null;
  let cursor;
  // Some Storage versions omit custom metadata from listings. Identical ballot bodies
  // have the same ETag, so read one representative body per returned ETag when needed.
  const byETag = new Map();
  do {
    const response = await storage(`/object/list-v2/${bucket}`, 'POST', {
      prefix: `${poll.slug}/`, limit: 1000, with_delimiter: false, cursor,
    });
    if (!response.ok) throw new Error('Could not list ballots');
    const page = await response.json();
    for (const object of page.objects) {
      const etag = object.metadata?.eTag;
      let choiceId = object.user_metadata?.choiceId || byETag.get(etag);
      if (!choiceId) {
        const record = await storage(`/object/authenticated/${bucket}/${object.name}`);
        if (!record.ok) throw new Error('Could not read ballot');
        choiceId = (await record.json()).choiceId;
        if (etag) byETag.set(etag, choiceId);
      }
      if (!Object.hasOwn(counts, choiceId)) throw new Error('Invalid stored choice');
      counts[choiceId]++;
      total++;
      if (object.name === voterKey) myChoice = choiceId;
    }
    if (page.hasNext && (!page.nextCursor || page.nextCursor === cursor)) throw new Error('Incomplete ballot listing');
    cursor = page.hasNext ? page.nextCursor : null;
  } while (cursor);
  return { poll: poll.slug, counts, total, myChoice };
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Vary', 'Cookie');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  function reply(status, value) {
    res.statusCode = status;
    res.end(JSON.stringify(value));
  }
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return reply(405, { code: 'method_not_allowed' });
  }
  const slug = new URL(req.url, 'https://www.pluspsychology.ai').searchParams.get('poll');
  const poll = polls.find(item => item.slug === slug);
  if (!poll) return reply(404, { code: 'poll_not_found' });
  let voter = /(?:^|;\s*)pp_vote_v1=([a-f\d]{64})(?:;|$)/.exec(req.headers.cookie || '')?.[1];
  let choiceId;
  if (req.method === 'POST') {
    if (!sameOrigin(req)) return reply(403, { code: 'origin_mismatch' });
    if (!poll.open) return reply(409, { code: 'poll_closed' });
    if (!voter) return reply(409, { code: 'cookie_required' });
    if (req.headers['content-type']?.split(';')[0].trim() !== 'application/json') return reply(415, { code: 'json_required' });
    try {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      choiceId = body?.choiceId;
    } catch {
      return reply(400, { code: 'invalid_choice' });
    }
    if (!poll.options.some(option => option.id === choiceId)) return reply(400, { code: 'invalid_choice' });
  }
  if (!process.env.SUPABASE_URL || !serviceKey) return reply(503, { code: 'storage_unavailable' });
  if (!voter) {
    voter = randomBytes(32).toString('hex');
    res.setHeader('Set-Cookie', `${cookieName}=${voter}; Path=/api/vote; Max-Age=31536000; HttpOnly; Secure; SameSite=Lax`);
  }
  const hash = createHash('sha256').update(`${poll.slug}:${voter}`).digest('hex');
  const key = `${poll.slug}/${hash}.json`;
  try {
    await ensureBucket();
    if (req.method === 'POST') await saveBallot(key, choiceId);
    const data = await results(poll, key);
    if (req.method === 'POST' && !data.myChoice) throw new Error('Ballot not yet visible');
    return reply(200, data);
  } catch {
    return reply(503, { code: 'storage_unavailable' });
  }
};
