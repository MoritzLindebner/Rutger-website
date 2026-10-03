/* Reference: oumahi.art/assets/js/app.js?v=769ec1c2.
 * Fibonacci placement and tangent CSS planes, with a fixed spherical shape.
 * Original implementation; no downloaded scripts or external dependencies.
 */
(() => {
  'use strict';

  const covers = [
    ['camcorder-rutger-feat-barre.webp', 'Camcorder', 'SMIw6uyCj1o'],
    ['cover-polaroid.webp', 'Polaroid', null, 'atiBaTDbJbA'],
    ['freitag-auf-montag-freestyle-rutger.webp', 'Freitag auf Montag Freestyle', 'l1f0stpdWjE'],
    ['hit-the-road-jack-rutger-dj-susi.webp', 'Hit the Road Jack', 'GAOfcdUSgdA'],
    ['jukebox-rutger-jimbo.webp', 'Jukebox', null, 'uR0LXVolFow'],
    ['ketchup-rutger.webp', 'Ketchup', '_9zo9Lmf6hg'],
    ['lebenschmeckt-rutgercover7-2.webp', 'Leben schmeckt', 'QffAAuoOTNM'],
    ['new-chapter-rutger-kahlert.webp', 'New Chapter', 'mODi4s2GGNU'],
    ['roll-rutger.webp', 'Roll', '6npK3I6hPRk'],
    ['sundowner-rutger.webp', 'Sundowner', null, 'qpbc925Rkx8'],
    ['uhrzeit-final-cover.webp', 'Uhrzeit', 'YnWFptA2wKI'],
    ['ying-yang-rutger-dj-susi.webp', 'Ying Yang', null, 'VDq1D2CzEI4'],
    ['zick-zack-rutger-julez-kahlert.webp', 'Zick Zack', null, 'hGt_hqQP-q4'],
  ];

  const pointCache = new Map();
  function spherePoints(count) {
    if (pointCache.has(count)) return pointCache.get(count);
    const goldenAngle = Math.PI * (3 - Math.sqrt(5));
    const paired = count === covers.length * 2;
    const baseCount = paired ? covers.length : count;
    let points = Array.from({ length: baseCount }, (_, i) => {
      // In paired mode, fill one hemisphere and mirror every cover through
      // the center. Indices i and i + covers.length carry the same artwork.
      const y = 1 - (paired ? 1 : 2) * (i + .5) / baseCount;
      const ring = Math.sqrt(1 - y * y);
      const x = Math.cos(i * goldenAngle) * ring;
      const z = Math.sin(i * goldenAngle) * ring;
      return { x, y, z, latitude: Math.asin(y), longitude: Math.atan2(x, z) };
    });
    if (paired) points = points.concat(points.map(({ x, y, z }) => ({
      x: -x, y: -y, z: -z,
      latitude: Math.asin(-y), longitude: Math.atan2(-x, -z),
    })));
    // Relax the distribution once, before display. Antipodal partners stay
    // locked together; dragging only rotates this cached, rigid layout.
    for (let step = 0; step < 240; step++) {
      const next = points.slice(0, baseCount).map(point => {
        const force = { x: 0, y: 0, z: 0 };
        for (const other of points) {
          if (point === other) continue;
          const distance = Math.hypot(point.x - other.x, point.y - other.y, point.z - other.z);
          for (const axis of ['x', 'y', 'z']) force[axis] += (point[axis] - other[axis]) / distance ** 3;
        }
        const radial = point.x * force.x + point.y * force.y + point.z * force.z;
        const rate = .018 * (1 - step / 300) / Math.sqrt(count);
        const result = {};
        for (const axis of ['x', 'y', 'z']) result[axis] = point[axis] + rate * (force[axis] - radial * point[axis]);
        const length = Math.hypot(result.x, result.y, result.z);
        for (const axis of ['x', 'y', 'z']) result[axis] /= length;
        return result;
      });
      points = paired ? next.concat(next.map(({ x, y, z }) => ({ x: -x, y: -y, z: -z }))) : next;
    }
    points = points.map(point => Object.freeze({ ...point, latitude: Math.asin(point.y), longitude: Math.atan2(point.x, point.z) }));
    pointCache.set(count, Object.freeze(points));
    return points;
  }

  function dimensions(width, height, count, cardScale = count === 13 ? .28 : .20) {
    const outerRadius = Math.hypot(.43, cardScale / Math.sqrt(2));
    const fit = Math.min(.90, .48 / (outerRadius * 5 / (5 - outerRadius)));
    const diameter = Math.max(1, Math.min(width, height)) * fit;
    return { diameter, radius: diameter * .43, card: diameter * cardScale, perspective: diameter * 5 };
  }

  function collisionPairs(count, cardScale) {
    const geometry = dimensions(1000, 1000, count, cardScale);
    const dot = (a, b) => a.reduce((sum, value, i) => sum + value * b[i], 0);
    const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
    const cards = spherePoints(count).map(({ x, y, z, latitude: lat, longitude: lon }) => {
      const normal = [x, y, z];
      const right = [Math.cos(lon), 0, -Math.sin(lon)];
      const up = [-Math.sin(lon) * Math.sin(lat), Math.cos(lat), -Math.cos(lon) * Math.sin(lat)];
      const corners = [[-1, -1], [-1, 1], [1, -1], [1, 1]].map(([a, b]) => normal.map((value, i) => value * geometry.radius + (right[i] * a + up[i] * b) * geometry.card / 2));
      return { normal, right, up, corners };
    });
    const pairs = [];
    cards.forEach((a, i) => cards.slice(i + 1).forEach((b, offset) => {
      const axes = [a.normal, b.normal, ...[a.right, a.up].flatMap(u => [b.right, b.up].map(v => cross(u, v)))];
      const separated = axes.some(axis => {
        if (Math.hypot(...axis) < 1e-10) return false;
        const aa = a.corners.map(p => dot(p, axis)), bb = b.corners.map(p => dot(p, axis));
        return Math.max(...aa) < Math.min(...bb) - 1e-8 || Math.max(...bb) < Math.min(...aa) - 1e-8;
      });
      if (!separated) pairs.push([i, i + offset + 1]);
    }));
    return pairs;
  }

  function rotate(x, y, dx, dy, diameter) {
    const sensitivity = 110 / Math.max(1, diameter);
    return { x: (x - dy * sensitivity) % 360, y: (y + dx * sensitivity) % 360 };
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { spherePoints, dimensions, collisionPairs, rotate, covers };
  }
  if (typeof document === 'undefined') return;

  const site = document.querySelector('[data-song-sphere]');
  const root = site || document;
  const scene = root.querySelector('.scene');
  const world = root.querySelector('.world');
  const title = root.querySelector('.title');
  const pauseButton = root.querySelector('#pause');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const phone = matchMedia('(max-width: 600px), (max-height: 450px) and (max-width: 950px)');
  const profiles = site
    ? { phone: { count: 13, size: 150 }, desktop: { count: 26, size: 125 } }
    : { phone: { count: 13, size: 140 }, desktop: { count: 26, size: 100 } };
  const profile = () => profiles[phone.matches ? 'phone' : 'desktop'];
  const countLimit = () => phone.matches ? 25 : 64;
  let count = profile().count;
  let geometry;
  let rotation = { x: -12, y: 22 };
  let roll = 0;
  let velocity = { x: 0, y: 0 };
  let pointer = null;
  let paused = reducedMotion.matches;
  let previousTime = 0;
  let animation = 0;
  let dragFrame = 0;
  let inView = true;

  function render() {
    world.style.transform = `rotateX(${rotation.x}deg) rotateY(${rotation.y}deg) rotateZ(${roll}deg)`;
    // Keep the title inside the sphere, with bounded tilts so it cannot flip.
    const tiltY = 12 + Math.sin(rotation.y * Math.PI / 180) * 12;
    const tiltX = -6 + Math.sin(rotation.x * Math.PI / 180) * 6;
    const tiltZ = Math.sin(roll * Math.PI / 180) * 8;
    title.style.transform = `translate(-50%, -50%) rotateZ(${-roll}deg) rotateY(${-rotation.y}deg) rotateX(${-rotation.x}deg) translateZ(${geometry.radius * .7}px) rotateZ(${tiltZ}deg) rotateY(${tiltY}deg) rotateX(${tiltX}deg)`;
  }

  function scheduleDragRender() {
    if (!dragFrame) dragFrame = requestAnimationFrame(() => { dragFrame = 0; render(); });
  }

  function resize() {
    geometry = dimensions(scene.clientWidth, scene.clientHeight, count, profile().size / 500);
    for (const name of ['diameter', 'card', 'perspective']) scene.style.setProperty(`--${name}`, `${geometry[name]}px`);
    const points = spherePoints(count);
    world.querySelectorAll('.cover').forEach((card, index) => {
      const point = points[index];
      card.style.transform = `rotateY(${point.longitude}rad) rotateX(${-point.latitude}rad) translateZ(${geometry.radius}px)`;
    });
    render();
    if (!site) root.querySelector('#card-pixels').textContent = `${Math.round(geometry.card)} px`;
  }

  function build() {
    count = Math.max(8, Math.min(countLimit(), count));
    profile().count = count;
    world.querySelectorAll('.cover').forEach(card => card.remove());
    for (let index = 0; index < count; index++) {
      const [file, name, video, audio] = covers[index % covers.length];
      const card = document.createElement(site ? 'a' : 'div');
      card.className = 'cover';
      if (site) {
        card.dataset.song = file.replace(/\.webp$/, '');
        card.dataset.title = name;
        if (video) card.dataset.video = video;
        if (audio) card.dataset.audio = audio;
        card.href = `?song=${card.dataset.song}#songs`;
        card.setAttribute('aria-label', `${name} öffnen`);
        if (index >= covers.length) card.tabIndex = -1;
      }
      const image = document.createElement('img');
      image.src = `covers/${file}`;
      image.alt = name;
      image.draggable = false;
      image.loading = site ? 'lazy' : 'eager';
      if (index >= covers.length) card.setAttribute('aria-hidden', 'true');
      card.append(image);
      world.append(card);
    }
    root.querySelectorAll('[data-count]').forEach(button => button.setAttribute('aria-pressed', String(Number(button.dataset.count) === count)));
    root.querySelector('#status').textContent = `${count} Cover auf der Kugel.`;
    resize();
    updateControls();
  }

  function updateControls() {
    if (site) return;
    document.querySelector('#count').max = String(countLimit());
    document.querySelector('#count').value = count;
    document.querySelector('#size').value = profile().size;
    document.querySelector('#count-value').textContent = count;
    document.querySelector('#size-value').textContent = `${profile().size} %`;
    document.querySelector('#profile-name').textContent = phone.matches ? 'Handy' : 'Größerer Bildschirm';
    document.querySelectorAll('[data-count]').forEach(button => { button.disabled = Number(button.dataset.count) > countLimit(); });
    const pairs = collisionPairs(count, profile().size / 500);
    const result = document.querySelector('#density-result');
    result.textContent = pairs.length ? `${pairs.length} Rahmenpaare schneiden sich — Anzahl oder Größe reduzieren.` : 'Rahmen frei voneinander. Wirkt die Kugel noch gut lesbar?';
    result.dataset.collision = String(pairs.length > 0);
    document.querySelector('#simulation-note').textContent = count <= covers.length
      ? `${count} echte Songcover, ohne Duplikate.`
      : count === covers.length * 2
        ? '13 Songs doppelt. Gleiche Cover liegen exakt gegenüber.'
        : `${count} Songs simuliert: Zusätzliche Einträge nutzen vorhandene Motive.`;
  }

  function wake() {
    if (!animation && inView && !document.hidden && !paused && !pointer) animation = requestAnimationFrame(tick);
  }

  function tick(now) {
    animation = 0;
    const dt = previousTime ? Math.min((now - previousTime) / 1000, .04) : 0;
    previousTime = now;
    if (!paused && !pointer && inView && !document.hidden) {
      rotation.y = (rotation.y + (5 + velocity.y) * dt) % 360;
      rotation.x = (rotation.x + velocity.x * dt) % 360;
      roll = (roll + 5 * .62 * dt) % 360;
      const decay = Math.exp(-5 * dt);
      velocity.x *= decay;
      velocity.y *= decay;
      render();
      wake();
    }
  }

  function setPaused(value) {
    paused = value;
    pauseButton.textContent = paused ? 'Drehen' : 'Pause';
    pauseButton.setAttribute('aria-pressed', String(paused));
    velocity = { x: 0, y: 0 };
    previousTime = 0;
    if (paused) { cancelAnimationFrame(animation); animation = 0; }
    wake();
  }

  scene.addEventListener('pointerdown', event => {
    if (!event.isPrimary || event.button !== 0 || pointer) return;
    scene.setPointerCapture(event.pointerId);
    pointer = { id: event.pointerId, x: event.clientX, y: event.clientY, time: event.timeStamp,
      startX: event.clientX, startY: event.clientY, dragged: false,
      link: site ? event.target.closest?.('a.cover') : null };
    velocity = { x: 0, y: 0 };
    scene.classList.add('dragging');
    cancelAnimationFrame(animation);
    animation = 0;
  });

  // Claim single-finger gestures on the fixed scene, including browsers
  // that still arbitrate scrolling through legacy Touch Events.
  const claimTouch = event => {
    if (event.touches.length === 1 && event.cancelable) event.preventDefault();
  };
  scene.addEventListener('touchstart', claimTouch, { passive: false });
  scene.addEventListener('touchmove', claimTouch, { passive: false });
  scene.addEventListener('dragstart', event => event.preventDefault());

  scene.addEventListener('pointermove', event => {
    if (!pointer || pointer.id !== event.pointerId) return;
    const dx = event.clientX - pointer.x;
    const dy = event.clientY - pointer.y;
    const dt = Math.max(8, event.timeStamp - pointer.time) / 1000;
    const sensitivity = 110 / geometry.diameter;
    rotation = rotate(rotation.x, rotation.y, dx, dy, geometry.diameter);
    velocity.x = Math.max(-100, Math.min(100, velocity.x * .65 - dy * sensitivity / dt * .35));
    velocity.y = Math.max(-100, Math.min(100, velocity.y * .65 + dx * sensitivity / dt * .35));
    pointer = { ...pointer, x: event.clientX, y: event.clientY, time: event.timeStamp,
      dragged: pointer.dragged || Math.hypot(event.clientX - pointer.startX, event.clientY - pointer.startY) > 7 };
    scheduleDragRender();
  });

  function release(event) {
    if (!pointer || pointer.id !== event.pointerId) return;
    const link = event.type === 'pointerup' && !pointer.dragged
      && Math.hypot(event.clientX - pointer.startX, event.clientY - pointer.startY) <= 7 ? pointer.link : null;
    if (event.type !== 'pointerup' || event.timeStamp - pointer.time > 100 || reducedMotion.matches) velocity = { x: 0, y: 0 };
    pointer = null;
    scene.classList.remove('dragging');
    if (scene.hasPointerCapture(event.pointerId)) scene.releasePointerCapture(event.pointerId);
    previousTime = 0;
    wake();
    if (link) link.click();
  }
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(type => scene.addEventListener(type, release));
  // Pointer capture and touch prevention suppress native link activation.
  // Release activates taps once; keyboard clicks keep their native behavior.
  scene.addEventListener('click', event => {
    if (site && event.detail > 0) { event.preventDefault(); event.stopPropagation(); }
  });

  function cancelDrag() {
    if (pointer) release({ pointerId: pointer.id, type: 'pointercancel' });
    if (dragFrame) { cancelAnimationFrame(dragFrame); dragFrame = 0; }
  }
  window.addEventListener('blur', cancelDrag);

  scene.addEventListener('keydown', event => {
    const steps = { ArrowLeft: [-35, 0], ArrowRight: [35, 0], ArrowUp: [0, -35], ArrowDown: [0, 35] };
    if (!steps[event.key]) return;
    event.preventDefault();
    setPaused(true);
    rotation = rotate(rotation.x, rotation.y, ...steps[event.key], 385);
    render();
  });

  root.querySelectorAll('[data-count]').forEach(button => button.addEventListener('click', () => {
    count = Number(button.dataset.count);
    profile().count = count;
    velocity = { x: 0, y: 0 };
    build();
  }));
  if (!site) root.querySelector('#count').addEventListener('input', event => {
    count = Number(event.target.value);
    profile().count = count;
    build();
  });
  if (!site) root.querySelector('#size').addEventListener('input', event => {
    profile().size = Number(event.target.value);
    resize();
    updateControls();
  });
  phone.addEventListener('change', () => { count = profile().count; build(); });
  pauseButton.addEventListener('click', () => setPaused(!paused));
  root.querySelector('#reset').addEventListener('click', () => {
    rotation = { x: -12, y: 22 };
    roll = 0;
    velocity = { x: 0, y: 0 };
    render();
  });
  reducedMotion.addEventListener('change', event => setPaused(event.matches));
  document.addEventListener('visibilitychange', () => {
    previousTime = 0;
    if (document.hidden) { cancelDrag(); cancelAnimationFrame(animation); animation = 0; }
    else wake();
  });
  new ResizeObserver(resize).observe(scene);
  build();
  if (site && typeof IntersectionObserver === 'function') {
    inView = false;
    new IntersectionObserver(entries => {
      inView = entries[0].isIntersecting;
      previousTime = 0;
      if (!inView) { cancelDrag(); cancelAnimationFrame(animation); animation = 0; }
      else wake();
    }).observe(scene);
  }
  setPaused(paused);
})();
