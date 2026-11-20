const test = require('node:test');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const polls = require('../vote/polls.json');

function fixture(t, { bucketExists = true, publicBucket = false } = {}) {
  const origin = 'https://www.pluspsychology.ai';
  const base = 'https://votes.example.invalid/storage/v1';
  const hadURL = process.env.SUPABASE_URL, hadKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  process.env.SUPABASE_URL = 'https://votes.example.invalid';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-only';
  t.after(() => {
    if (hadURL === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = hadURL;
    if (hadKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY; else process.env.SUPABASE_SERVICE_ROLE_KEY = hadKey;
  });
  const objects = new Map();
  const requests = [];
  const state = { failListing: false, listMetadata: true };
  function json(status, data) { return new Response(JSON.stringify(data), { status }); }
  t.mock.method(global, 'fetch', async (url, options) => {
    assert.ok(url.startsWith(base));
    assert.equal(options.headers.Authorization, 'Bearer test-only');
    const path = url.slice(base.length), body = options.body && JSON.parse(options.body);
    requests.push({ path, body });
    if (path === '/bucket') {
      assert.equal(body.public, false);
      bucketExists = true;
      return json(200, {});
    }
    if (path.startsWith('/bucket/')) return json(bucketExists ? 200 : 400, { public: publicBucket });
    if (path.startsWith('/object/list-v2/')) {
      if (state.failListing) return json(500, {});
      const names = [...objects.keys()].filter(key => key.startsWith(body.prefix) && (!body.cursor || key > body.cursor)).sort();
      const batch = names.slice(0, body.limit);
      return json(200, {
        objects: batch.map(name => ({ name, metadata: { eTag: createHash('sha256').update(JSON.stringify(objects.get(name))).digest('hex') },
          ...(state.listMetadata ? { user_metadata: objects.get(name) } : {}) })),
        hasNext: names.length > batch.length,
        nextCursor: names.length > batch.length ? batch.at(-1) : undefined,
      });
    }
    if (path.startsWith('/object/authenticated/')) return json(200, objects.get(path.split('/').slice(4).join('/')));
    if (path.startsWith('/object/')) {
      const key = path.split('/').slice(3).join('/');
      assert.equal(options.headers['x-upsert'], 'false');
      assert.deepEqual(JSON.parse(Buffer.from(options.headers['x-metadata'], 'base64')), body);
      if (objects.has(key)) return json(400, { error: 'Duplicate', statusCode: '409' });
      objects.set(key, body);
      return json(200, {});
    }
    throw new Error(`Unexpected route ${path}`);
  });
  delete require.cache[require.resolve('../api/vote.js')];
  const handler = require('../api/vote.js');
  async function request({ method = 'GET', cookie, choiceId, poll = 'strength', headers, rawBody } = {}) {
    const responseHeaders = {};
    let data;
    const req = { method, url: `/api/vote?poll=${poll}`, headers: { origin, host: new URL(origin).host, cookie, 'content-type': 'application/json', ...headers }, body: rawBody ?? { choiceId } };
    const res = { setHeader: (name, value) => { responseHeaders[name] = value; }, end: text => { data = JSON.parse(text); } };
    await handler(req, res);
    return { status: res.statusCode, data, headers: responseHeaders, cookie: responseHeaders['Set-Cookie']?.split(';')[0] };
  }
  return { request, state, requests, objects };
}

test('different visitors share results, see only their selection, and retries preserve the first ballot', async t => {
  const { request, objects } = fixture(t, { bucketExists: false });
  const initial = await request();
  assert.equal(initial.status, 200);
  assert.equal(initial.data.total, 0);
  assert.equal(initial.data.myChoice, null);
  assert.equal(initial.headers['Cache-Control'], 'private, no-store');
  assert.match(initial.headers['Set-Cookie'], /HttpOnly; Secure; SameSite=Lax/);
  const cookie = initial.cookie;
  const submitted = await Promise.all(['listen', 'rest', 'finish'].map(choiceId => request({ method: 'POST', cookie, choiceId })));
  for (const result of submitted) {
    assert.equal(result.status, 200);
    assert.equal(result.data.total, 1);
    assert.equal(result.data.myChoice, submitted[0].data.myChoice);
  }
  const visitor = await request();
  assert.equal(visitor.data.total, 1);
  assert.equal(visitor.data.myChoice, null);
  const second = await request({ method: 'POST', cookie: visitor.cookie, choiceId: 'laugh' });
  assert.equal(second.data.total, 2);
  assert.equal(second.data.counts.laugh, 1);
  assert.equal(second.data.myChoice, 'laugh');
  assert.equal((await request({ cookie })).data.myChoice, submitted[0].data.myChoice);
  assert.equal(objects.size, 2);
});

test('unavailable listing after write can be retried without a duplicate', async t => {
  const { request, state, objects } = fixture(t);
  const { cookie } = await request();
  state.failListing = true;
  const ballot = { method: 'POST', cookie, choiceId: 'rest' };
  assert.equal((await request(ballot)).status, 503);
  assert.equal(objects.size, 1);
  state.failListing = false;
  assert.deepEqual((await request(ballot)).data, { poll: 'strength', myChoice: 'rest', total: 1, counts: { listen: 0, rest: 1, finish: 0, flow: 0, laugh: 0 } });
});

test('results span all listing pages and older Storage versions without custom metadata', async t => {
  const { request, state, objects, requests } = fixture(t);
  state.listMetadata = false;
  for (let i = 0; i < 1007; i++) objects.set(`strength/${i.toString().padStart(4, '0')}.json`, { choiceId: i % 2 ? 'flow' : 'rest' });
  objects.set('different-poll/abc.json', { choiceId: 'invalid' });
  const { data } = await request();
  assert.equal(data.total, 1007);
  assert.deepEqual([data.counts.flow, data.counts.rest], [503, 504]);
  assert.equal(requests.filter(x => x.path.startsWith('/object/list-v2/')).length, 2);
  assert.equal(requests.filter(x => x.path.startsWith('/object/authenticated/')).length, 2);
});

test('validates poll, origin, cookie and choice and serves a closed poll read-only', async t => {
  const { request, objects } = fixture(t);
  const { cookie } = await request();
  assert.equal((await request({ poll: 'unknown' })).status, 404);
  const submit = { method: 'POST', choiceId: 'flow', cookie };
  assert.equal((await request({ ...submit, cookie: undefined })).data.code, 'cookie_required');
  assert.equal((await request({ ...submit, headers: { origin: 'https://other.example' } })).status, 403);
  assert.equal((await request({ ...submit, choiceId: 'custom' })).status, 400);
  assert.equal((await request({ ...submit, rawBody: '{bad json' })).status, 400);
  assert.equal((await request({ ...submit, headers: { 'content-type': 'text/plain' } })).status, 415);
  assert.equal((await request({ method: 'DELETE' })).status, 405);
  const poll = polls.find(p => p.slug === 'strength');
  const prior = poll.open;
  poll.open = false;
  t.after(() => { poll.open = prior; });
  assert.equal((await request(submit)).data.code, 'poll_closed');
  assert.equal((await request({ cookie })).status, 200);
  assert.equal(objects.size, 0);
});

test('refuses to use a public bucket', async t => {
  const { request, objects } = fixture(t, { publicBucket: true });
  assert.equal((await request()).data.code, 'storage_unavailable');
  assert.equal(objects.size, 0);
});
