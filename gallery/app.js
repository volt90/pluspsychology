import {brand, rooms, exhibits, media} from './content.js';

const $ = (id) => document.getElementById(id);
const timeline = exhibits.filter(item => item.room.startsWith('history-'));
const shortNames = ['우리의 마음', '첫 만남의 기록', '넓어지는 경험', '이야기와 체험'];
const headings = ['마음이\n쌓이는 곳.', '처음 만난\n마음들.', '경험으로\n이어지는 이야기.', '내 마음을\n만나는 방법.'];
let currentRoom = rooms[0], scene, scenePromise, sceneFailed = false, currentView = 'space';
let currentExhibit, photoIndex = 0, currentYear = 'all';
const suppressedCloses = new WeakSet();
const announce = (message) => { $('announcement').textContent = message; };

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
function thumb(src, alt = '', character = false) {
  const wrap = element('span', `room-thumb${character ? ' character' : ''}`);
  const img = element('img'); img.src = src; img.alt = alt; img.loading = 'lazy';
  wrap.append(img); return wrap;
}
function writeRoute() {
  const params = new URLSearchParams({room: currentRoom.id});
  if (currentView === 'archive') {params.set('view', 'archive'); if (currentYear !== 'all') params.set('year', currentYear);}
  if (currentExhibit && $('exhibit-dialog').open) params.set('exhibit', currentExhibit.id);
  const hash = '#' + params.toString();
  if (location.hash !== hash) history.pushState(null, '', hash);
}
function selectRoom(id, updateRoute = true) {
  currentRoom = rooms.find(room => room.id === id) || rooms[0];
  const index = rooms.indexOf(currentRoom);
  $('room-title').replaceChildren(...headings[index].split('\n').flatMap((line, i) => i ? [document.createElement('br'), document.createTextNode(line)] : [document.createTextNode(line)]));
  $('room-kicker').textContent = index === 0 ? '김심리월드의 발자취' : currentRoom.title;
  $('room-description').textContent = index === 0 ? '이야기에서 전시로, 전시에서 새로운 경험으로. 우리의 기록을 함께 걸어보세요.' : currentRoom.description;
  $('room-count').textContent = String(index + 1).padStart(2, '0');
  for (const button of document.querySelectorAll('[data-room]')) button.setAttribute('aria-current', String(button.dataset.room === currentRoom.id));
  const items = exhibits.filter(item => item.room === currentRoom.id);
  $('exhibit-buttons').replaceChildren(...items.map((item, i) => {
    const button = element('button'); button.append(element('b', '', String(i + 1).padStart(2, '0')), document.createTextNode(item.title));
    button.addEventListener('click', () => openExhibit(item.id)); return button;
  }));
  $('next-room').setAttribute('aria-label', index === rooms.length - 1 ? '첫 공간으로 돌아가기' : '다음 공간');
  $('next-room').querySelector('span').textContent = index === rooms.length - 1 ? '첫 공간으로' : '다음 공간';
  if (scene) scene.setRoom(currentRoom, items);
  if (updateRoute) writeRoute();
  announce(`${currentRoom.title}. ${items.length}개의 이야기가 있습니다.`);
}
function setView(view, updateRoute = true) {
  currentView = view === 'archive' ? 'archive' : 'space';
  $('space').hidden = currentView !== 'space'; $('archive').hidden = currentView !== 'archive';
  $('space-view').setAttribute('aria-pressed', String(currentView === 'space'));
  $('archive-view').setAttribute('aria-pressed', String(currentView === 'archive'));
  scene?.setActive(currentView === 'space' && !document.hidden);
  if (currentView === 'space') ensureScene();
  if (updateRoute) {writeRoute(); announce(currentView === 'space' ? '공간 관람으로 전환했습니다.' : '연도별 활동 기록입니다.');}
}
function renderArchive(year = 'all', updateRoute = false) {
  currentYear = ['2025', '2026'].includes(year) ? year : 'all';
  for (const button of $('year-filter').querySelectorAll('button')) button.setAttribute('aria-pressed', String(button.dataset.year === currentYear));
  const filtered = timeline.filter(item => currentYear === 'all' || item.year === currentYear);
  $('archive-count').textContent = `${filtered.length}개의 만남`;
  $('archive-list').replaceChildren(...['2025', '2026'].filter(y => filtered.some(e => e.year === y)).map(y => {
    const group = element('section', 'archive-group'); group.setAttribute('aria-label', `${y}년 활동`);
    group.append(element('h2', 'archive-year', y));
    const records = element('div', 'archive-records');
    for (const item of filtered.filter(e => e.year === y)) {
      const card = element('button', 'archive-card'); card.setAttribute('aria-label', `${item.date} ${item.title} 자세히 보기`);
      const image = element('img'); image.src = item.images[0].src; image.alt = item.images[0].alt; image.loading = 'lazy';
      card.append(image, element('span', 'date', `${item.date} / ${item.kind}`), element('h2', '', item.title), element('span', 'location', item.location), element('span', 'read', '이야기 보기'));
      card.addEventListener('click', () => openExhibit(item.id)); records.append(card);
    }
    group.append(records); return group;
  }));
  if (updateRoute) {writeRoute(); announce(`${currentYear === 'all' ? '전체' : currentYear + '년'} 활동 ${filtered.length}건`);}
}
function showPhoto(index) {
  if (!currentExhibit) return;
  photoIndex = (index + currentExhibit.images.length) % currentExhibit.images.length;
  const image = currentExhibit.images[photoIndex];
  $('detail-image').hidden = false; $('image-unavailable').hidden = true;
  $('detail-image').src = image.src; $('detail-image').alt = image.alt;
  $('photo-caption').textContent = image.alt;
  $('photo-count').textContent = `${photoIndex + 1} / ${currentExhibit.images.length}`;
  $('photo-prev').disabled = $('photo-next').disabled = currentExhibit.images.length < 2;
}
function openExhibit(id, updateRoute = true) {
  const item = exhibits.find(entry => entry.id === id); if (!item) return;
  currentExhibit = item;
  $('detail-title').textContent = item.title; $('detail-date').textContent = item.date;
  $('detail-location').textContent = item.location; $('detail-description').textContent = item.description;
  $('detail-source').href = item.sourceUrl;
  showPhoto(0);
  if (!$('exhibit-dialog').open) $('exhibit-dialog').showModal();
  scene?.setActive(false);
  if (updateRoute) writeRoute();
}
function closeAllDialogs() {
  for (const dialog of document.querySelectorAll('dialog[open]')) {
    suppressedCloses.add(dialog); dialog.close();
  }
  currentExhibit = undefined;
}
function applyRoute() {
  const params = new URLSearchParams(location.hash.slice(1));
  closeAllDialogs();
  const item = exhibits.find(e => e.id === params.get('exhibit'));
  selectRoom(params.get('room') || item?.room || 'welcome', false);
  renderArchive(params.get('year') || 'all');
  setView(params.get('view'), false);
  if (item) openExhibit(item.id, false);
}
function failScene(error) {
  sceneFailed = true; $('loading').hidden = true; $('scene-error').hidden = false;
  $('gallery-canvas').hidden = true;
  for (const button of document.querySelectorAll('.camera-controls button')) button.disabled = true;
  console.warn('Gallery space unavailable; archive is available.', error?.message || error || 'WebGL context unavailable');
}
async function ensureScene() {
  if (scene || scenePromise || sceneFailed) return scenePromise;
  scenePromise = (async () => {
    try {
      const {createGallery} = await import('./scene.js');
      if (document.fonts) await Promise.race([document.fonts.ready, new Promise(resolve => setTimeout(resolve, 1800))]);
      scene = await createGallery({canvas: $('gallery-canvas'), container: $('stage'), media,
        onSelect: (id) => openExhibit(id),
        onReady: () => { $('loading').hidden = true; },
        onError: failScene});
      if (!scene) throw new Error('Renderer did not initialize.');
      scene.setRoom(currentRoom, exhibits.filter(item => item.room === currentRoom.id));
      scene.setActive(currentView === 'space' && !document.hidden && !document.querySelector('dialog[open]'));
      $('loading').hidden = true;
    } catch (error) {failScene(error);}
  })();
  return scenePromise;
}

$('brand-logo').src = media.logo;
$('brand-logo').addEventListener('load', () => {$('brand-logo').hidden = false; $('brand-text').hidden = true;});
rooms.forEach((room, index) => {
  const button = element('button'); button.dataset.room = room.id;
  const source = index === 0 ? media.simri : index === 3 ? media.seru : exhibits.find(e => e.room === room.id).images[0].src;
  const text = element('span', 'room-label', shortNames[index]); text.append(element('small', '', room.year || (index === 0 ? '김심리월드' : '이야기의 다음 장')));
  button.append(thumb(source, '', index === 0 || index === 3), text);
  button.addEventListener('click', () => {selectRoom(room.id, false); setView('space');}); $('room-nav').append(button);
  const mapButton = element('button'); mapButton.dataset.room = room.id;
  mapButton.append(element('span', '', `공간 ${String(index + 1).padStart(2, '0')}${room.year ? ' / ' + room.year : ''}`), document.createTextNode(shortNames[index]));
  mapButton.addEventListener('click', () => {$('map-dialog').close(); selectRoom(room.id, false); setView('space');}); $('map-rooms').append(mapButton);
});
$('space-view').addEventListener('click', () => setView('space'));
$('archive-view').addEventListener('click', () => setView('archive'));
$('fallback-archive').addEventListener('click', () => setView('archive'));
$('next-room').addEventListener('click', () => selectRoom(rooms[(rooms.indexOf(currentRoom) + 1) % rooms.length].id));
$('help').addEventListener('click', () => {$('help-dialog').showModal(); scene?.setActive(false);});
$('map-open').addEventListener('click', () => {$('map-dialog').showModal(); scene?.setActive(false);});
$('reset-view').addEventListener('click', () => scene?.resetView());
document.querySelectorAll('[data-turn]').forEach(button => button.addEventListener('click', () => scene?.turn(Number(button.dataset.turn))));
document.querySelectorAll('[data-zoom]').forEach(button => button.addEventListener('click', () => scene?.zoom(Number(button.dataset.zoom) * 6)));
$('gallery-canvas').addEventListener('keydown', event => {
  if (event.key === 'ArrowLeft') {event.preventDefault(); scene?.turn(-1);}
  if (event.key === 'ArrowRight') {event.preventDefault(); scene?.turn(1);}
  if (['ArrowUp', '+', '='].includes(event.key)) {event.preventDefault(); scene?.zoom(-6);}
  if (['ArrowDown', '-'].includes(event.key)) {event.preventDefault(); scene?.zoom(6);}
  if (event.key === 'Home') {event.preventDefault(); scene?.resetView();}
});
$('fullscreen').hidden = !document.fullscreenEnabled;
$('fullscreen').addEventListener('click', async () => {
  try {if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen();}
  catch {announce('이 브라우저에서는 전체 화면을 사용할 수 없습니다.');}
});
document.addEventListener('fullscreenchange', () => $('fullscreen').setAttribute('aria-label', document.fullscreenElement ? '전체 화면 나가기' : '전체 화면'));
$('year-filter').addEventListener('click', event => {const button = event.target.closest('[data-year]'); if (button) renderArchive(button.dataset.year, true);});
$('photo-prev').addEventListener('click', () => showPhoto(photoIndex - 1));
$('photo-next').addEventListener('click', () => showPhoto(photoIndex + 1));
$('detail-image').addEventListener('error', () => {$('detail-image').hidden = true; $('image-unavailable').hidden = false;});
$('exhibit-dialog').addEventListener('keydown', event => {
  if (event.key === 'ArrowLeft') {event.preventDefault(); showPhoto(photoIndex - 1);}
  if (event.key === 'ArrowRight') {event.preventDefault(); showPhoto(photoIndex + 1);}
});
document.querySelectorAll('dialog').forEach(dialog => {
  dialog.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', () => dialog.close()));
  dialog.addEventListener('click', event => {if (event.target === dialog) {const r = dialog.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dialog.close();}});
  dialog.addEventListener('close', () => {
    const suppressed = suppressedCloses.has(dialog);
    suppressedCloses.delete(dialog);
    if (dialog.id === 'exhibit-dialog' && !suppressed && !dialog.open) {currentExhibit = undefined; writeRoute();}
    scene?.setActive(currentView === 'space' && !document.hidden && !document.querySelector('dialog[open]'));
  });
});
window.addEventListener('hashchange', applyRoute);
document.querySelector('.skip').addEventListener('click', event => {event.preventDefault(); $('main').focus();});
document.addEventListener('visibilitychange', () => scene?.setActive(!document.hidden && currentView === 'space' && !document.querySelector('dialog[open]')));
applyRoute();
