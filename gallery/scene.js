import * as THREE from './vendor/three.module.js';

// A small, self-contained gallery. Navigation and accessible exhibit links live
// in app.js; this module owns only the room, its artwork, and camera controls.
const BASE = new URL('.', import.meta.url);
const COLORS = {
  paper: '#FBF6EA', chalk: '#FFFDF7', ink: '#2B2620',
  blue: '#4C8CCB', blueDeep: '#2F6FA8', gold: '#F2B620', wood: '#BD9973'
};

export async function createGallery({ canvas, container, media = {}, onSelect, onReady, onError }) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'low-power' });
  } catch (error) {
    onError?.(error);
    throw error;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.7));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(COLORS.paper);
  scene.fog = new THREE.Fog(COLORS.paper, 29, 60);
  const camera = new THREE.PerspectiveCamera(52, 1, 0.08, 80);
  camera.position.set(0, 2.4, 8.3);
  const shell = new THREE.Group();
  const display = new THREE.Group();
  scene.add(shell, display);
  scene.add(new THREE.HemisphereLight('#FFFCF2', '#BDA88F', 2.35));
  const daylight = new THREE.DirectionalLight('#FFF7E6', 3.25);
  daylight.position.set(-3.8, 8.5, 5.5);
  daylight.castShadow = true;
  daylight.shadow.mapSize.set(1024, 1024);
  Object.assign(daylight.shadow.camera, { left: -12, right: 12, top: 11, bottom: -11, near: 0.5, far: 30 });
  daylight.shadow.normalBias = 0.035;
  daylight.shadow.bias = -0.0003;
  scene.add(daylight);
  const fill = new THREE.DirectionalLight('#E8F1FA', 1.1);
  fill.position.set(6, 5, -1);
  scene.add(fill);

  const loader = new THREE.TextureLoader();
  const textureCache = new Map();
  const ownTextures = new Set();
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let targets = [];
  let destroyed = false;
  let active = true;
  let frame = 0;
  let yaw = 0;
  let pitch = -0.03;
  let fov = 52;
  let roomGeneration = 0;
  let currentRoom = null;
  let currentExhibits = [];
  let dragging = false;
  let gestureStart = null;
  let previousPoint = null;
  let moved = 0;

  function render() {
    frame = 0;
    if (destroyed || !active || document.hidden) return;
    camera.lookAt(
      camera.position.x + Math.sin(yaw) * Math.cos(pitch),
      camera.position.y + Math.sin(pitch),
      camera.position.z - Math.cos(yaw) * Math.cos(pitch)
    );
    camera.fov = fov;
    camera.updateProjectionMatrix();
    renderer.render(scene, camera);
  }
  function invalidate() {
    if (!frame && !destroyed && active && !document.hidden) frame = requestAnimationFrame(render);
  }
  function surface(color, extra = {}) {
    return new THREE.MeshStandardMaterial({ color, roughness: 0.83, metalness: 0, ...extra });
  }
  function box(parent, width, height, depth, x, y, z, material, shadow = true) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
    mesh.position.set(x, y, z);
    mesh.castShadow = shadow;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }
  function plane(parent, width, height, x, y, z, material) {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  }
  function canvasTexture(width, height, painter) {
    const bitmap = document.createElement('canvas');
    bitmap.width = width;
    bitmap.height = height;
    const ctx = bitmap.getContext('2d');
    painter(ctx, width, height);
    const map = new THREE.CanvasTexture(bitmap);
    map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
    ownTextures.add(map);
    return map;
  }
  function flatMaterial(map, extra = {}) {
    return new THREE.MeshBasicMaterial({ map, transparent: true, toneMapped: false, ...extra });
  }
  function wrapText(ctx, value, maxWidth, maxLines = 2) {
    const lines = [];
    let current = '';
    for (const char of String(value || '')) {
      if (ctx.measureText(current + char).width > maxWidth && current) {
        lines.push(current.trim());
        current = char;
      } else current += char;
    }
    if (current) lines.push(current.trim());
    if (lines.length > maxLines) {
      lines.length = maxLines;
      lines[maxLines - 1] = lines[maxLines - 1].replace(/.$/, '…');
    }
    return lines;
  }
  function textPanel(parent, text, width, height, x, y, z, options = {}) {
    const { color = COLORS.ink, background, size = 66, weight = 700, align = 'center', family = '"Noto Sans KR", "Malgun Gothic", sans-serif', maxLines = 2 } = options;
    const pixelWidth = 1200;
    const pixelHeight = Math.round(pixelWidth * height / width);
    const map = canvasTexture(pixelWidth, pixelHeight, (ctx, w, h) => {
      if (background) { ctx.fillStyle = background; ctx.fillRect(0, 0, w, h); }
      ctx.fillStyle = color;
      ctx.font = `${weight} ${size}px ${family}`;
      ctx.textAlign = align;
      ctx.textBaseline = 'middle';
      const lines = wrapText(ctx, text, w - 60, maxLines);
      lines.forEach((line, index) => {
        ctx.fillText(line, align === 'left' ? 30 : w / 2, h / 2 + (index - (lines.length - 1) / 2) * size * 1.45);
      });
    });
    return plane(parent, width, height, x, y, z, flatMaterial(map));
  }
  function loadTexture(src) {
    const url = new URL(src, BASE).href;
    if (textureCache.has(url)) return textureCache.get(url);
    const promise = new Promise((resolve, reject) => {
      loader.load(url, (map) => {
        if (destroyed) { map.dispose(); resolve(null); return; }
        map.colorSpace = THREE.SRGBColorSpace;
        map.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
        resolve(map);
        invalidate();
      }, undefined, reject);
    });
    // A broken artwork can be retried on the next room visit.
    promise.catch(() => textureCache.delete(url));
    textureCache.set(url, promise);
    return promise;
  }
  function imagePlane(parent, src, width, height, x, y, z, { id, generation = roomGeneration, cutout = false } = {}) {
    if (!src) return;
    const mesh = plane(parent, width, height, x, y, z, flatMaterial(null, { opacity: 0 }));
    if (id) { mesh.userData.exhibitId = id; targets.push(mesh); }
    loadTexture(src).then((map) => {
      if (!map || destroyed || generation !== roomGeneration) return;
      const ratio = map.image.width / map.image.height;
      const fittedWidth = Math.min(width, height * ratio);
      const fittedHeight = Math.min(height, width / ratio);
      mesh.geometry.dispose();
      mesh.geometry = new THREE.PlaneGeometry(fittedWidth, fittedHeight);
      mesh.material.map = map;
      mesh.material.opacity = 1;
      mesh.material.alphaTest = cutout ? 0.02 : 0;
      mesh.material.needsUpdate = true;
      invalidate();
    }).catch(() => {
      if (destroyed || generation !== roomGeneration) return;
      textPanel(parent, '사진은 기록에서 볼 수 있어요', width, 0.45, x, y, z + 0.01, { size: 72 });
      invalidate();
    });
    return mesh;
  }
  function arch(parent, width, height, x, z, color) {
    const radius = width / 2;
    const shape = new THREE.Shape();
    shape.moveTo(-radius, 0);
    shape.lineTo(radius, 0);
    shape.lineTo(radius, height - radius);
    shape.absarc(0, height - radius, radius, 0, Math.PI, false);
    shape.lineTo(-radius, 0);
    const mesh = new THREE.Mesh(new THREE.ShapeGeometry(shape, 36), surface(color));
    mesh.position.set(x, 0.035, z);
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }
  function rug(parent, width, depth, x, z, color) {
    const mesh = new THREE.Mesh(new THREE.CircleGeometry(1, 72), surface(color));
    mesh.rotation.x = -Math.PI / 2;
    mesh.scale.set(width / 2, depth / 2, 1);
    mesh.position.set(x, 0.018, z);
    mesh.receiveShadow = true;
    parent.add(mesh);
  }
  function contactShadow(parent, width, depth, x, z, opacity = 0.15) {
    const map = canvasTexture(128, 128, (ctx, w, h) => {
      const gradient = ctx.createRadialGradient(w / 2, h / 2, 3, w / 2, h / 2, w / 2);
      gradient.addColorStop(0, `rgba(52,37,18,${opacity})`);
      gradient.addColorStop(0.5, `rgba(52,37,18,${opacity * 0.7})`);
      gradient.addColorStop(1, 'rgba(52,37,18,0)');
      ctx.fillStyle = gradient; ctx.fillRect(0, 0, w, h);
    });
    const shadow = plane(parent, width, depth, x, 0.025, z, flatMaterial(map, { depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2;
  }
  function plant(parent, x, z, scale = 1) {
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    group.scale.setScalar(scale);
    parent.add(group);
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.21, 0.5, 24), surface('#DDCDB6'));
    pot.position.y = 0.25; pot.castShadow = true; group.add(pot);
    const soil = new THREE.Mesh(new THREE.CircleGeometry(0.245, 24), surface('#7B6A53'));
    soil.rotation.x = -Math.PI / 2; soil.position.y = 0.505; group.add(soil);
    for (let i = 0; i < 8; i++) {
      const angle = i * 2.4;
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 7), surface(i % 2 ? '#6F9A78' : '#87AC85'));
      leaf.scale.set(0.14, 0.48, 0.065);
      leaf.position.set(Math.cos(angle) * 0.18, 0.95 + (i % 3) * 0.13, Math.sin(angle) * 0.18);
      leaf.rotation.set(Math.sin(angle) * 0.65, angle, Math.cos(angle) * 0.55);
      leaf.castShadow = true; group.add(leaf);
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.02, 0.72, 6), surface('#6D8C62'));
      stem.position.set(Math.cos(angle) * 0.07, 0.76, Math.sin(angle) * 0.07);
      group.add(stem);
    }
    contactShadow(parent, 1.35 * scale, 1.35 * scale, x, z, 0.13);
  }
  function bench(parent, x, z) {
    const group = new THREE.Group(); group.position.set(x, 0, z); parent.add(group);
    box(group, 2.3, 0.16, 0.78, 0, 0.54, 0, surface('#C29B71'));
    for (const side of [-0.82, 0.82]) box(group, 0.12, 0.48, 0.64, side, 0.25, 0, surface('#A98561'));
    box(group, 2.05, 0.09, 0.59, 0, 0.66, 0, surface('#EEE4D1'));
    contactShadow(parent, 3.2, 1.6, x, z, 0.12);
  }

  // The main room is fourteen metres wide, with a quiet entrance alcove behind
  // the initial camera position so a full turn remains an enclosed experience.
  const plaster = surface(COLORS.paper);
  const sidePlaster = surface('#F4ECDD');
  const backWall = box(shell, 14.3, 5.7, 0.2, 0, 2.85, -5.9, plaster, false);
  box(shell, 0.2, 5.7, 18.2, -7.1, 2.85, 3.1, sidePlaster, false);
  box(shell, 0.2, 5.7, 18.2, 7.1, 2.85, 3.1, sidePlaster, false);
  box(shell, 14.4, 5.7, 0.2, 0, 2.85, 12.1, plaster, false);
  box(shell, 14.4, 0.12, 18.1, 0, 5.7, 3.1, surface('#FFFBF0'), false);
  const floor = box(shell, 14.4, 0.08, 18.1, 0, -0.05, 3.1, surface('#D6B994'), false);
  // Narrow floorboards establish scale without a repeating downloaded texture.
  const seamMaterial = surface('#C4A582');
  for (let x = -6.75; x <= 7; x += 0.54) box(shell, 0.008, 0.005, 18, x, -0.006, 3.1, seamMaterial, false);
  for (let row = 0; row < 26; row++) {
    const x = -6.75 + row * 0.54;
    for (let z = -5.8 + (row % 3) * 1.04; z < 12; z += 3.12) box(shell, 0.53, 0.005, 0.006, x + 0.265, -0.005, z, seamMaterial, false);
  }
  const skirting = surface('#E4D6BF');
  box(shell, 14.1, 0.17, 0.12, 0, 0.085, -5.71, skirting, false);
  box(shell, 0.12, 0.17, 17.6, -6.93, 0.085, 3.1, skirting, false);
  box(shell, 0.12, 0.17, 17.6, 6.93, 0.085, 3.1, skirting, false);
  // A gold rail and two slim lighting tracks are physical wayfinding details.
  box(shell, 13.9, 0.045, 0.045, 0, 4.98, -5.71, surface('#C6A76B'), false);
  for (const x of [-3.5, 3.5]) {
    box(shell, 0.06, 0.08, 10, x, 5.35, 0, surface('#D0C6B5'), false);
    for (const z of [-3.2, 0, 3.2]) {
      const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.18, 16), surface('#FBF8F0'));
      lamp.position.set(x, 5.2, z); shell.add(lamp);
      const bulb = new THREE.Mesh(new THREE.CircleGeometry(0.09, 16), new THREE.MeshBasicMaterial({ color: '#FFF8D9', toneMapped: false }));
      bulb.rotation.x = Math.PI / 2; bulb.position.set(x, 5.105, z); shell.add(bulb);
    }
  }
  const entranceArch = arch(shell, 4.8, 4.7, 0, 11.96, '#DDE8ED');
  entranceArch.rotation.y = Math.PI;
  const exitLabel = textPanel(shell, '다시, 마음을 만나는 곳', 3.6, 0.6, 0, 3.5, 11.9, { color: COLORS.blueDeep, size: 90 });
  exitLabel.rotation.y = Math.PI;
  bench(shell, -4.65, 3.3);
  bench(shell, 4.65, 3.3);
  plant(shell, -6.1, -4.7, 1.3);
  plant(shell, 6.1, -4.7, 1.3);
  plant(shell, -5.7, 8.8, 1.2);

  function disposeGroup(group) {
    group.traverse((object) => {
      object.geometry?.dispose();
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) {
        if (!material) continue;
        if (ownTextures.has(material.map)) { material.map.dispose(); ownTextures.delete(material.map); }
        material.dispose();
      }
    });
    group.clear();
  }
  function framedArtwork(exhibit, x, z, angle = 0, options = {}) {
    const group = new THREE.Group();
    group.position.set(x, 0, z); group.rotation.y = angle; display.add(group);
    const width = options.width || 3.05;
    const height = options.height || 2.42;
    const y = options.y || 2.7;
    const frame = box(group, width + 0.18, height + 0.18, 0.11, 0, y, 0, surface('#B98D5E'));
    frame.userData.exhibitId = exhibit.id; targets.push(frame);
    box(group, width + 0.035, height + 0.035, 0.025, 0, y, 0.067, surface('#E8D7BB'), false);
    const matte = plane(group, width, height, 0, y, 0.083, new THREE.MeshBasicMaterial({ color: '#FFFCF5', toneMapped: false }));
    matte.userData.exhibitId = exhibit.id; targets.push(matte);
    imagePlane(group, options.src || exhibit.images?.[0]?.src, width - 0.24, height - 0.24, 0, y, 0.092, { id: exhibit.id, cutout: true });
    const labelY = y - height / 2 - 0.34;
    textPanel(group, exhibit.title, width + 0.3, 0.47, 0, labelY, 0.09, { size: 76, maxLines: 2 });
    textPanel(group, exhibit.date || exhibit.year || '', width, 0.22, 0, labelY - 0.4, 0.09, { size: 69, color: '#6E6658' });
    return group;
  }
  function character(src, x, z, height, id, y = 0) {
    const group = new THREE.Group(); group.position.set(x, y, z); display.add(group);
    imagePlane(group, src, height, height, 0, height / 2 + 0.025, 0, { id, cutout: true });
    contactShadow(display, height * 1.2, height * 0.42, x, z, 0.18);
    return group;
  }
  function characterStage(exhibitId) {
    rug(display, 5.9, 2.45, 0, -1.25, '#E9DAB8');
    const plinth = new THREE.Mesh(new THREE.CylinderGeometry(2.65, 2.65, 0.17, 64), surface('#FAF3E1'));
    plinth.scale.z = 0.36; plinth.position.set(0, 0.11, -1.65); plinth.receiveShadow = true; plinth.castShadow = true; display.add(plinth);
    character(media.simri, -1.7, -1.65, 1.85, exhibitId, 0.2);
    character(media.seru, -0.55, -1.7, 1.63, exhibitId, 0.2);
    character(media.ruby, 0.72, -1.68, 1.63, exhibitId, 0.2);
    character(media.ar, 1.85, -1.62, 1.02, exhibitId, 0.2);
  }
  function setRoom(room, exhibits = []) {
    if (destroyed) return;
    currentRoom = room;
    currentExhibits = exhibits;
    roomGeneration++;
    targets = [];
    disposeGroup(display);
    const color = room?.color || COLORS.blue;
    const pale = new THREE.Color(color).lerp(new THREE.Color(COLORS.chalk), 0.87);
    const isWelcome = !room || room.id === 'welcome';
    backWall.material.color.set(isWelcome ? COLORS.paper : '#FBF6EA');
    if (isWelcome) {
      arch(display, 4.7, 4.7, 0, -5.77, '#DBE9F2');
      imagePlane(display, media.logo, 3.62, 1.3, 0, 3.87, -5.72);
      textPanel(display, '마음을 이해하는 다정한 방법', 4.12, 0.55, 0, 2.94, -5.70, { color: COLORS.blueDeep, size: 92 });
      textPanel(display, '이야기로 연결되고, 심리학으로 성장하는 우리', 4.22, 0.43, 0, 2.35, -5.70, { color: '#4E7189', size: 59 });
      characterStage(exhibits.find((item) => item.id === 'our-friends')?.id || exhibits[0]?.id);
      if (exhibits[0]) framedArtwork(exhibits[0], -4.65, -5.65, 0, { width: 2.35, height: 2.3, y: 2.67 });
      if (exhibits[1]) {
        framedArtwork(exhibits[1], 4.65, -5.65, 0, { width: 2.35, height: 2.3, y: 2.67, src: media.seru });
        framedArtwork(exhibits[1], -6.94, -0.85, Math.PI / 2, { width: 2.5, height: 2.3, src: media.ruby });
        framedArtwork(exhibits[1], 6.94, -0.85, -Math.PI / 2, { width: 2.5, height: 2.3, src: media.ar });
      }
    } else {
      arch(display, 5.1, 4.85, 0, -5.78, `#${pale.getHexString()}`);
      const heading = room.year || room.title || '김심리월드';
      textPanel(display, heading, room.year ? 2.5 : 5.9, 0.62, 0, 4.53, -5.70, { color: room.year ? color : COLORS.ink, size: room.year ? 265 : 100, family: '"Jua", "Noto Sans KR", sans-serif' });
      const count = Math.min(exhibits.length, 3);
      const positions = count === 1 ? [0] : count === 2 ? [-2.65, 2.65] : [-4.45, 0, 4.45];
      exhibits.slice(0, 3).forEach((exhibit, index) => {
        framedArtwork(exhibit, positions[index], -5.65, 0, { width: count === 2 ? 3.72 : 3.25, height: 2.42, y: 2.64 });
      });
      // Side walls give the visitor more original photographs to find by turning.
      exhibits.slice(0, 2).forEach((exhibit, index) => {
        const src = exhibit.images?.[1]?.src || exhibit.images?.[0]?.src;
        framedArtwork(exhibit, index === 0 ? -6.94 : 6.94, -0.3, index === 0 ? Math.PI / 2 : -Math.PI / 2, { width: 3.0, height: 2.5, src });
      });
      rug(display, 4.8, 2.4, 0, 0.05, '#E9DFC9');
      character(media.simri, -5.65, -2.8, 1.25, exhibits[0]?.id);
      character(media.ar, 5.7, -2.8, 0.86, exhibits[exhibits.length - 1]?.id);
    }
    resetView();
    invalidate();
  }
  function resetView() {
    yaw = 0;
    pitch = -0.03;
    fov = 52;
    invalidate();
  }
  function turn(direction) {
    const amount = typeof direction === 'number' ? direction : direction === 'left' ? -1 : 1;
    yaw += amount * Math.PI / 8;
    invalidate();
  }
  function zoom(delta) {
    // Positive deltas follow wheel semantics: zoom out. Buttons can pass ±6.
    const value = Number(delta) || 0;
    fov = THREE.MathUtils.clamp(fov + value, 30, 79);
    invalidate();
  }
  function hitTest(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    pointer.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    return raycaster.intersectObjects(targets, false).find((hit) => hit.object.userData.exhibitId)?.object.userData.exhibitId;
  }
  function pointerDown(event) {
    if (!active || (event.pointerType === 'mouse' && event.button !== 0)) return;
    dragging = true; moved = 0;
    gestureStart = { x: event.clientX, y: event.clientY, pointerId: event.pointerId };
    previousPoint = { x: event.clientX, y: event.clientY };
    canvas.setPointerCapture?.(event.pointerId);
    canvas.style.cursor = 'grabbing';
  }
  function pointerMove(event) {
    if (!active) return;
    if (!dragging || event.pointerId !== gestureStart?.pointerId) {
      canvas.style.cursor = hitTest(event.clientX, event.clientY) ? 'pointer' : 'grab';
      return;
    }
    const dx = event.clientX - previousPoint.x;
    const dy = event.clientY - previousPoint.y;
    moved = Math.max(moved, Math.hypot(event.clientX - gestureStart.x, event.clientY - gestureStart.y));
    yaw -= dx * 0.0036;
    pitch = THREE.MathUtils.clamp(pitch + dy * 0.0032, -0.48, 0.48);
    previousPoint = { x: event.clientX, y: event.clientY };
    invalidate();
  }
  function pointerUp(event) {
    if (!dragging || event.pointerId !== gestureStart?.pointerId) return;
    dragging = false;
    canvas.releasePointerCapture?.(event.pointerId);
    canvas.style.cursor = 'grab';
    if (moved < 7 && event.type !== 'pointercancel') {
      const id = hitTest(event.clientX, event.clientY);
      if (id) onSelect?.(id);
    }
    gestureStart = null;
  }
  function wheel(event) {
    if (!active || !event.deltaY) return;
    event.preventDefault();
    zoom(Math.sign(event.deltaY) * 2.4);
  }
  function resize() {
    if (destroyed) return;
    const width = Math.max(1, container.clientWidth);
    const height = Math.max(1, container.clientHeight);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    invalidate();
  }
  function visibilityChange() { if (!document.hidden) invalidate(); }
  function contextLost(event) {
    event.preventDefault();
    active = false;
    onError?.(new Error('3D 화면 연결이 중단되었습니다. 기록 보기에서 전시를 계속 볼 수 있어요.'));
  }
  function contextRestored() { active = true; resize(); }

  canvas.style.touchAction = 'none';
  canvas.style.cursor = 'grab';
  canvas.addEventListener('pointerdown', pointerDown);
  canvas.addEventListener('pointermove', pointerMove);
  canvas.addEventListener('pointerup', pointerUp);
  canvas.addEventListener('pointercancel', pointerUp);
  canvas.addEventListener('wheel', wheel, { passive: false });
  canvas.addEventListener('webglcontextlost', contextLost);
  canvas.addEventListener('webglcontextrestored', contextRestored);
  document.addEventListener('visibilitychange', visibilityChange);
  const observer = new ResizeObserver(resize);
  observer.observe(container);
  resize();

  // Redraw text textures once the site's Korean display fonts are ready.
  document.fonts?.ready.then(() => {
    if (!destroyed && currentRoom) setRoom(currentRoom, currentExhibits);
  });

  onReady?.();
  return {
    setRoom, resetView, turn, zoom,
    setActive(value) {
      active = Boolean(value);
      if (!active && frame) { cancelAnimationFrame(frame); frame = 0; }
      if (active) { resize(); invalidate(); }
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      canvas.removeEventListener('pointerdown', pointerDown);
      canvas.removeEventListener('pointermove', pointerMove);
      canvas.removeEventListener('pointerup', pointerUp);
      canvas.removeEventListener('pointercancel', pointerUp);
      canvas.removeEventListener('wheel', wheel);
      canvas.removeEventListener('webglcontextlost', contextLost);
      canvas.removeEventListener('webglcontextrestored', contextRestored);
      document.removeEventListener('visibilitychange', visibilityChange);
      disposeGroup(display);
      disposeGroup(shell);
      for (const promise of textureCache.values()) promise.then((texture) => texture?.dispose()).catch(() => {});
      for (const texture of ownTextures) texture.dispose();
      ownTextures.clear();
      renderer.dispose();
      canvas.style.cursor = '';
      canvas.style.touchAction = '';
    }
  };
}
