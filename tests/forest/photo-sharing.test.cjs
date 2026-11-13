const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const html = fs.readFileSync(process.env.FOREST_QA_SOURCE || path.join(__dirname, '../../experience/mind-forest.html'), 'utf8');
const configSource = html.slice(html.indexOf('  function getFinaleConfig() {'), html.indexOf('  function showFinale(name) {'));
const shareSource = html.slice(html.indexOf('  async function sharePhoto(blob) {'), html.indexOf('  async function takePhoto(automatic = false) {'));
const shared = {url: 'https://www.pluspsychology.ai/api/mind-forest-photo?photo=1794500000000-12345678901234567890123456789012', qr: 'data:image/gif;base64,R0lGODlh'};

function setup(fetch, protocol = 'http:') {
  const context = vm.createContext({fetch, location: {protocol}, URL, AbortSignal});
  vm.runInContext('let finaleConfig = null, resolvedFinaleConfig = null;\n' + configSource + shareSource, context);
  return context;
}

test('a failed opening configuration does not prevent uploading to the website later', async () => {
  const calls = [], image = new Blob(['synthetic JPEG']);
  const api = setup(async (url, options) => {
    calls.push({url, options});
    return options.method === 'POST' ? {ok: true, json: async () => shared} : {ok: false};
  });
  assert.equal(Object.keys(await api.getFinaleConfig()).length, 0);
  assert.equal(await api.sharePhoto(image), shared);
  assert.equal(calls.length, 2);
  assert.equal(calls[1].url, '/api/mind-forest-photo');
  assert.equal(calls[1].options.body, image);
  assert.equal(calls[1].options.headers['Content-Type'], 'application/octet-stream');
});

test('transient configuration failures are retried while successful requests are shared', async () => {
  let calls = 0;
  const config = {photoShare: true, photoShareScope: 'website'};
  const api = setup(async () => {
    if (++calls === 1) throw new Error('Temporary network failure');
    return {ok: true, json: async () => config};
  });
  await api.getFinaleConfig();
  const [first, second] = await Promise.all([api.getFinaleConfig(), api.getFinaleConfig()]);
  assert.equal(first, config); assert.equal(second, config); assert.equal(calls, 2);
});

test('an unavailable share response or a LAN QR cannot be displayed as a website photo', async () => {
  for (const response of [
    {ok: false},
    {ok: true, json: async () => ({...shared, url: 'http://192.168.0.5:8765/api/mind-forest-photo?photo=old'})},
    {ok: true, json: async () => ({...shared, url: 'https://www.pluspsychology.ai/another-page?photo=old'})},
    {ok: true, json: async () => ({...shared, qr: null})},
    {ok: true, json: async () => {throw new Error('Invalid JSON');}},
  ]) {
    assert.equal(await setup(async () => response).sharePhoto(new Blob()), null);
  }
  assert.equal(await setup(async () => {throw new Error('Offline');}).sharePhoto(new Blob()), null);
});

test('opening the HTML file directly does not send a photo to an unintended location', async () => {
  let calls = 0;
  const api = setup(async () => {calls++;}, 'file:');
  await api.getFinaleConfig();
  assert.equal(await api.sharePhoto(new Blob()), null);
  assert.equal(calls, 0);
});
