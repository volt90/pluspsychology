const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../assets/mind-care/mind-care.js'), 'utf8');

function harness() {
  const listeners = new Map();
  const clicks = new Map();
  const focusable = { setAttribute() {}, focus() {} };
  const root = { dataset: {}, addEventListener(type, handler) { clicks.set(type, handler); } };
  const content = { innerHTML: '', querySelector() { return focusable; } };
  const entries = [];
  let cursor = -1;
  const copy = value => JSON.parse(JSON.stringify(value));
  const history = {
    get state() { return entries[cursor]; },
    replaceState(value) { if (cursor < 0) cursor = 0; entries[cursor] = copy(value); },
    pushState(value) { entries.splice(++cursor); entries.push(copy(value)); },
    back() { if (cursor > 0) listeners.get('popstate')({ state: entries[--cursor] }); },
    forward() { if (cursor < entries.length - 1) listeners.get('popstate')({ state: entries[++cursor] }); }
  };
  vm.runInNewContext(source, {
    document: { getElementById: id => id === 'simri-care' ? root : content },
    window: { addEventListener(type, handler) { listeners.set(type, handler); }, scrollTo() {} },
    history
  });
  return {
    get screen() { return root.dataset.screen; },
    get html() { return content.innerHTML; },
    get position() { return history.state; },
    get historyLength() { return entries.length; },
    key(overrides = {}) {
      const event = { key: 'g', code: 'KeyG', target: { closest() { return null; } },
        preventDefault() { this.defaultPrevented = true; }, ...overrides };
      listeners.get('keydown')(event);
      return event;
    },
    click(name, value) {
      const attribute = `data-${name}="${value}"`;
      const markup = [...content.innerHTML.matchAll(/<button\b[^>]*>/g)].map(match => match[0])
        .find(button => button.includes(attribute));
      assert.ok(markup, `Expected visible button ${attribute}`);
      const button = { dataset: { [name]: String(value) }, disabled: /\sdisabled(?:\s|>)/.test(markup) };
      clicks.get('click')({ target: { closest() { return button; } } });
    },
    back() { history.back(); },
    forward() { history.forward(); },
    restore(position) { listeners.get('popstate')({ state: copy(position) }); }
  };
}

test('G shows the first question, then the sunlight example and its recommended postcard', () => {
  const app = harness();
  app.key();
  assert.equal(app.screen, 'check');
  assert.match(app.html, /data-action="next" disabled/);
  app.key();
  assert.equal(app.screen, 'result');
  assert.match(app.html, /시연용 예시 응답/);
  assert.match(app.html, /햇빛부터/);
  const scores = [...app.html.matchAll(/aria-label="([^"]+) 응답 (\d) \/ 4"/g)];
  assert.equal(scores.length, 8);
  assert.deepEqual(scores.filter(match => Number(match[2]) < 3).map(match => match[1]), ['햇빛']);
  assert.match(app.html, /aria-label="햇빛 응답 1 \/ 4"/);
  assert.equal((app.html.match(/class="sc-more"/g) || []).length, 1);
  assert.equal(app.position.selected, 2);
  app.key();
  assert.equal(app.screen, 'postcard');
  assert.match(app.html, /03-sunlight\.png/);
  assert.match(app.html, /밝은 공간에 잠깐 머무르기/);
  app.key();
  assert.equal(app.screen, 'quiz');
  for (let index = 0; index < 8; index++) {
    assert.equal(app.position.quizIndex, index);
    assert.doesNotMatch(app.html, /class="sc-feedback"/);
    assert.doesNotMatch(app.html, /aria-pressed="true"/);
    app.key();
  }
  assert.equal(app.screen, 'complete');
  const length = app.historyLength;
  app.key();
  assert.equal(app.screen, 'complete');
  assert.equal(app.historyLength, length);
  app.back();
  assert.equal(app.screen, 'quiz');
  assert.doesNotMatch(app.html, /class="sc-feedback"/);
});

test('the demo never writes example scores into an actual survey', () => {
  const app = harness();
  app.click('action', 'check');
  app.click('answer', 0);
  app.click('action', 'next');
  app.click('answer', 3);
  app.key();
  assert.equal(app.screen, 'result');
  assert.match(app.html, /햇빛부터/);
  app.back();
  assert.equal(app.position.index, 1);
  assert.match(app.html, /data-answer="3" aria-pressed="true"/);
  app.click('action', 'next');
  assert.equal(app.position.index, 2);
  assert.match(app.html, /data-action="next" disabled/);
  for (let index = 2; index < 8; index++) {
    app.click('answer', 4);
    app.click('action', 'next');
  }
  assert.equal(app.screen, 'result');
  assert.match(app.html, /휴식부터/);
  assert.doesNotMatch(app.html, /시연용 예시 응답/);
  assert.equal(app.position.selected, 0);
});

test('ordinary check buttons require all answers and recommend the lowest area', () => {
  const app = harness();
  app.click('action', 'check');
  app.click('action', 'next');
  assert.equal(app.position.index, 0);
  for (let index = 0; index < 8; index++) {
    app.click('action', 'next');
    assert.equal(app.position.index, index);
    app.click('answer', index === 4 ? 0 : 4);
    app.click('action', 'next');
  }
  assert.equal(app.screen, 'result');
  assert.equal(app.position.selected, 4);
  assert.doesNotMatch(app.html, /아직 답하지 않았어요/);
});

test('demo results and selected postcards survive Back/Forward but not a new visit', () => {
  const app = harness();
  app.key();
  app.key();
  assert.equal(app.screen, 'result');
  app.click('area', 5);
  const oldPostcard = app.position;
  app.click('action', 'back-result');
  assert.equal(app.screen, 'result');
  assert.equal(app.position.selected, 5);
  assert.match(app.html, /시연용 예시 응답/);
  app.forward();
  assert.equal(app.screen, 'postcard');
  assert.match(app.html, /06-sleep\.png/);
  assert.deepEqual(Object.keys(app.position).sort(), ['demo', 'index', 'mindCare', 'quizIndex', 'screen', 'selected', 'visit']);
  const reloaded = harness();
  reloaded.restore(oldPostcard);
  assert.equal(reloaded.screen, 'home');
  assert.notEqual(reloaded.position.visit, oldPostcard.visit);
  reloaded.restore({ ...reloaded.position, screen: 'result' });
  assert.equal(reloaded.screen, 'home', 'partial results remain unavailable without the demo shortcut');
});

test('physical G, lowercase and uppercase work while repeats, modifiers and editing do not', () => {
  const app = harness();
  const blocked = [
    { key: 'x', code: 'KeyX' }, { repeat: true }, { ctrlKey: true },
    { altKey: true }, { metaKey: true }, { isComposing: true }, { defaultPrevented: true },
    { target: { isContentEditable: true, closest() { return null; } } },
    ...['input', 'textarea', 'select', 'contenteditable-ancestor'].map(kind => ({ target: {
      closest(selector) {
        assert.match(selector, /input, textarea, select/);
        assert.match(selector, /\[contenteditable\]/);
        return { kind };
      }
    } }))
  ];
  for (const event of blocked) {
    app.key(event);
    assert.equal(app.screen, 'home');
    assert.equal(app.historyLength, 1);
  }
  assert.equal(app.key({ code: 'KeyG', key: 'ㅎ' }).defaultPrevented, true);
  assert.equal(app.screen, 'check');
  app.key({ code: '', key: 'g' });
  assert.equal(app.screen, 'result');
  app.key({ code: '', key: 'G', shiftKey: true });
  assert.equal(app.screen, 'postcard');
});

test('OX answers and normal feedback remain available when mixing clicks with G', () => {
  const app = harness();
  app.click('action', 'quiz');
  assert.doesNotMatch(app.html, /data-action="quiz-next"/);
  app.click('ox', 'false');
  assert.match(app.html, /class="sc-feedback"/);
  app.click('action', 'quiz-next');
  app.key(); // Skip the second question.
  app.back();
  assert.equal(app.position.quizIndex, 1);
  assert.doesNotMatch(app.html, /class="sc-feedback"/);
  app.back();
  assert.equal(app.position.quizIndex, 0);
  assert.match(app.html, /data-ox="false" aria-pressed="true" disabled/);
  assert.match(app.html, /class="sc-feedback"/);
});
