import {renderArchive} from './archive.js';

const {poll: slug, view, titleEn} = document.body.dataset;
const board = document.querySelector('#board');
const archive = document.querySelector('#archive');
const titleKo = document.title;
const pollPath = '/vote/' + encodeURIComponent(slug);
const resultPath = pollPath + '/results';
const shellText = Array.from(document.querySelectorAll('[data-en]'), el => [el, el.textContent]);
const shellAttrs = ['aria-label', 'alt'].flatMap(attr => {
  const dataAttr = attr === 'alt' ? 'data-en-alt' : 'data-en-aria';
  return Array.from(document.querySelectorAll('[' + dataAttr + ']'), el => [el, attr, el.getAttribute(attr), el.getAttribute(dataAttr)]);
});
let lang = new URLSearchParams(location.search).get('lang') === 'en' ? 'en' : 'ko';
let polls, poll, snapshot, chosen, notice = '', busy = false, reading = false, catalogFailed = false;
const t = (ko, en) => lang === 'en' ? en : ko;
const localPath = path => path + (lang === 'en' ? '?lang=en' : '');
const field = (item, key) => lang === 'en' && item[key + 'En'] || item[key];
const number = n => n.toLocaleString(lang);
const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};
const icons = {
  note:'M4 4h16v11l-5 5H4z M15 20v-5h5',
  share:'M8 12l8-5m-8 5 8 5 M7 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z M18 3a3 3 0 1 0 0 6 3 3 0 0 0 0-6z M18 15a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  list:'M8 6h12M8 12h12M8 18h12 M4 6h.1M4 12h.1M4 18h.1',
  chart:'M4 20h16 M7 16v-4 M12 16V5 M17 16V9'
};
function icon(name) {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  const path = document.createElementNS(ns, 'path');
  svg.setAttribute('class','desk-icon');
  svg.setAttribute('aria-hidden','true');
  svg.setAttribute('viewBox','0 0 24 24');
  path.setAttribute('d', icons[name]);
  svg.append(path);
  return svg;
}
function action(text, className, href, mark) {
  const node = el(href ? 'a' : 'button', className, text);
  if (href) node.href = localPath(href);
  else node.type = 'button';
  if (mark) node.prepend(icon(mark));
  return node;
}
function setLanguage(next) {
  lang = next;
  document.documentElement.lang = lang;
  document.title = t(titleKo, titleEn);
  shellText.forEach(([node, ko]) => {node.textContent = t(ko, node.dataset.en);});
  shellAttrs.forEach(([node, attr, ko, en]) => node.setAttribute(attr, t(ko,en)));
  document.querySelectorAll('[data-lang]').forEach(button => {
    const active = button.dataset.lang === lang;
    button.classList.toggle('on', active);
    button.setAttribute('aria-checked', String(active));
    if (active) document.querySelector('.lgnow').textContent = button.textContent;
  });
  document.querySelectorAll('.crumb a[href^="/vote"],.under-board a').forEach(a => {a.href = localPath(a.pathname);});
  if (document.querySelector('#share-notice')) document.querySelector('#share-notice').textContent = '';
  render();
}
const switcher = document.querySelector('.langsw');
const trigger = switcher.querySelector('.lgtrig');
function toggleMenu(open) {
  switcher.classList.toggle('open', open);
  switcher.querySelector('.lgmenu').hidden = !open;
  trigger.setAttribute('aria-expanded',String(open));
  if (open) switcher.querySelector('[aria-checked="true"]').focus();
}
trigger.addEventListener('click', () => toggleMenu(!switcher.classList.contains('open')));
switcher.addEventListener('click', event => {
  const button = event.target.closest('[data-lang]');
  if (!button) return;
  toggleMenu(false);
  setLanguage(button.dataset.lang);
  const url = new URL(location.href);
  if (lang === 'en') url.searchParams.set('lang',lang);
  else url.searchParams.delete('lang');
  history.replaceState(null,'',url);
  trigger.focus();
});
document.addEventListener('click', e => {if (!switcher.contains(e.target)) toggleMenu(false);});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && switcher.classList.contains('open')) {toggleMenu(false); trigger.focus();}
});

function message(code) {
  if (code === 'cookie_required') return t('투표를 저장하려면 이 사이트의 쿠키를 허용한 뒤 다시 시도해 주세요.', 'Allow cookies for this site and try again to save your vote.');
  if (code === 'save_failed') return t('포스트잇이 붙었는지 확인하지 못했어요. 다시 눌러 확인해 주세요.', 'We couldn’t confirm your note. Try posting it again.');
  if (code === 'read_failed') return t('보드를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.', 'We couldn’t load the board. Please try again.');
  return '';
}
function makeBoard(title, meta) {
  const panel = el('section', 'memo-board');
  const heading = el('div','board-heading');
  const h2 = el('h2','',title);
  const info = el('span','board-meta',meta);
  info.prepend(icon('note'));
  heading.append(h2,info);
  panel.append(heading);
  return panel;
}
function addWarning(panel) {
  if (!notice) return;
  const warning = el('p','vote-message error-message',message(notice));
  warning.setAttribute('role','alert');
  panel.append(warning);
  if (notice === 'read_failed' || notice === 'cookie_required') {
    const line = el('div','board-actions retry');
    const retry = action(t('다시 불러오기','Reload board'),'text-action');
    retry.addEventListener('click', () => loadSnapshot());
    line.append(retry);
    panel.append(line);
  }
}
function drawVote() {
  const panel = makeBoard(t('마음 게시판','Your note board'), t('한 장 선택','Choose one'));
  const choices = el('fieldset','notes');
  choices.append(el('legend','sr-only',field(poll,'title')));
  const submit = action(t('포스트잇 붙이기','Post my note'),'action',null,'note');
  const link = action(t('결과 먼저 보기','See results first'),'text-action',resultPath,'chart');
  for (const option of poll.options) {
    const note = el('label','sticky option paper-' + option.color);
    const radio = el('input');
    radio.type = 'radio'; radio.name = 'experience'; radio.value = option.id;
    radio.checked = chosen === option.id; radio.disabled = busy;
    radio.addEventListener('change', () => {
      chosen = option.id;
      submit.disabled = !snapshot || busy;
    });
    const art = el('img');
    art.src = '/vote/assets/' + encodeURIComponent(option.art) + '.png';
    art.alt = ''; art.width = 81; art.height = 66;
    note.append(art,el('span','answer',field(option,'label')),radio,el('span','check'));
    choices.append(note);
  }
  submit.disabled = !chosen || !snapshot || busy;
  if (busy) submit.lastChild.textContent = t('붙이는 중…','Posting…');
  submit.addEventListener('click', postVote);
  const actions = el('div','board-actions');
  actions.append(submit,link);
  panel.append(choices,actions);
  addWarning(panel);
  return panel;
}
function drawResults() {
  const meta = snapshot ? t('포스트잇 ' + number(snapshot.total) + '장',number(snapshot.total) + (snapshot.total === 1 ? ' note' : ' notes')) : '…';
  const panel = makeBoard(t('우리들의 포스트잇','Everyone’s notes'),meta);
  if (snapshot) {
    const notes = el('div','result-notes');
    const unit = Math.max(1,Math.ceil(Math.max(...Object.values(snapshot.counts))/12));
    for (const option of poll.options) {
      const count = snapshot.counts[option.id];
      const percent = snapshot.total ? Math.round(count / snapshot.total * 100) : 0;
      const mine = option.id === snapshot.myChoice;
      const note = el('article','sticky result-note paper-' + option.color + (mine ? ' just-posted' : ''));
      const heading = el('h3','',field(option,'short'));
      heading.title = field(option,'label');
      const marks = el('div','marks' + (count ? '' : ' empty'));
      marks.setAttribute('aria-hidden','true');
      for (let i = 0; i < Math.ceil(count/unit); i++) marks.append(el('i','mark'));
      const tally = el('div');
      tally.append(el('strong','',t(number(count) + '표',number(count) + (count === 1 ? ' vote' : ' votes'))),el('span','pct','(' + percent + '%)'));
      note.append(heading,marks,tally);
      if (mine) note.append(el('span','my-stamp',t('내 포스트잇','My note')));
      notes.append(note);
    }
    panel.append(notes);
    let caption = t('작은 메모 한 장이 한 표예요.', 'Each little note represents one vote.');
    if (!snapshot.total) caption = t('아직 붙은 포스트잇이 없어요.' + (poll.open ? ' 첫 장을 붙여 볼까요?' : ''), 'No notes were posted.' + (poll.open ? ' Add the first one?' : ''));
    else if (unit > 1) caption = t('작은 메모 한 장은 최대 ' + number(unit) + '표를 나타내요.', 'Each little note represents up to ' + number(unit) + ' votes.');
    panel.append(el('p','result-meta',caption));
    if (poll.open && !snapshot.myChoice) {
      const row = el('div','board-actions');
      row.append(action(t('나도 포스트잇 붙이기','Add my note'),'action',pollPath,'note'));
      panel.append(row);
    }
  } else if (!notice) panel.append(el('p','vote-message',t('보드를 불러오고 있어요…','Loading the board…')));
  addWarning(panel);
  return panel;
}
function render() {
  if (catalogFailed) {
    const dest = archive || board;
    const warning = el('p','vote-message error-message',message('read_failed'));
    const retry = action(t('다시 불러오기','Try again'),'text-action');
    retry.addEventListener('click',loadCatalog);
    dest.replaceChildren(warning,retry);
  } else if (archive && polls) {
    renderArchive(archive,polls,lang);
    if (lang === 'en') archive.querySelectorAll('.archive-card').forEach(a => {a.href = localPath(a.pathname);});
  } else if (poll) {
    const copy = document.querySelector('.intro-copy');
    const status = copy.querySelector('.poll-status');
    if (poll.open) {
      status?.remove();
    } else {
      const closedStatus = status || el('div', 'poll-status closed');
      closedStatus.textContent = t('종료', 'Closed');
      if (!status) copy.prepend(closedStatus);
    }
    board.replaceChildren(view === 'results' ? drawResults() : drawVote());
  }
}
async function api(options = {}) {
  const response = await fetch('/api/vote?poll=' + encodeURIComponent(slug), {
    cache:'no-store',credentials:'same-origin',signal:AbortSignal.timeout(20000),...options
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.code || 'unavailable');
  if (data.poll !== slug || !Number.isSafeInteger(data.total) || !poll.options.every(o => Number.isSafeInteger(data.counts?.[o.id]))) throw new Error('invalid_results');
  return data;
}
async function loadSnapshot(quiet = false) {
  if (reading || busy) return;
  reading = true;
  try {
    const next = await api();
    if (next.myChoice && view === 'vote') {location.replace(localPath(resultPath)); return;}
    const changed = JSON.stringify(next) !== JSON.stringify(snapshot) || notice;
    snapshot = next; notice = '';
    if (changed || !quiet) render();
  } catch {notice = 'read_failed'; render();}
  finally {reading = false;}
}
async function postVote() {
  if (!chosen || busy || !snapshot) return;
  busy = true; notice = ''; render();
  try {
    await api({method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({choiceId:chosen})});
    location.assign(localPath(resultPath));
  } catch(error) {
    if (error.message === 'poll_closed') {location.replace(localPath(resultPath)); return;}
    notice = error.message === 'cookie_required' ? error.message : 'save_failed';
    busy = false; render();
    board.querySelector('.action')?.focus();
  }
}
async function loadCatalog() {
  try {
    const response = await fetch('/vote/polls.json',{cache:'no-cache'});
    if (!response.ok) throw new Error('Missing catalog');
    polls = await response.json();
    catalogFailed = false;
    if (slug) {
      poll = polls.find(item => item.slug === slug);
      if (!poll) throw new Error('Unknown poll');
      if (!poll.open && view === 'vote') {location.replace(localPath(resultPath)); return;}
    }
    render();
    if (slug) await loadSnapshot();
  } catch {catalogFailed = true; render();}
}
if (board) {
  const share = document.querySelector('#share');
  share.prepend(icon('share'));
  document.querySelector('.under-board a').prepend(icon('list'));
  share.addEventListener('click', async() => {
    const url = new URL(localPath(resultPath),location.origin).href;
    const status = document.querySelector('#share-notice');
    const manual = document.querySelector('#manual-share');
    manual.hidden = true; status.textContent = '';
    if (navigator.share) {
      try {await navigator.share({title:t('김심리월드 · 마음 투표 결과','Heart notes · Poll results'),url}); return;}
      catch(error) {if (error.name === 'AbortError') return;}
    }
    try {
      await navigator.clipboard.writeText(url);
      status.textContent = t('결과 링크를 복사했어요.', 'Result link copied.');
    } catch {
      manual.hidden = false;
      const input = manual.querySelector('input'); input.value = url; input.focus(); input.select();
      status.textContent = t('아래 주소를 복사해 공유해 주세요.','Copy the address below to share.');
    }
  });
  if (view === 'results') {
    const refresh = () => {if (poll && !document.hidden) loadSnapshot(true);};
    document.addEventListener('visibilitychange',refresh);
    window.addEventListener('pageshow',e => {if (e.persisted) refresh();});
    setInterval(refresh,60000);
  } else window.addEventListener('pageshow', e => {if (e.persisted && poll) loadSnapshot(true);});
}
setLanguage(lang);
loadCatalog();
