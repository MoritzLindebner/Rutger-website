const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

// Execute the actual page listeners with controlled input and animation frames.
// Native browser gesture arbitration still needs a real-device check.
function pageHarness(isPhone = true, embedded = false) {
  const frames = new Map();
  let nextFrame = 1;
  class Element extends EventTarget {
    constructor() {
      super();
      this.children = [];
      this.dataset = {};
      this.attributes = {};
      this.clientWidth = 343;
      this.clientHeight = 620;
      this.classList = { add() {}, remove() {} };
      this.style = { setProperty(name, value) { this[name] = value; } };
    }
    append(child) { child.parent = this; this.children.push(child); }
    remove() { this.parent.children = this.parent.children.filter(child => child !== this); }
    querySelectorAll() { return this.children.filter(child => child.className === 'cover'); }
    setAttribute(name, value) { this.attributes[name] = value; }
    setPointerCapture(id) { this.capture = id; }
    hasPointerCapture(id) { return this.capture === id; }
    releasePointerCapture() { this.capture = null; }
  }
  const elements = new Map();
  const element = selector => {
    if (!elements.has(selector)) elements.set(selector, new Element());
    return elements.get(selector);
  };
  const presets = [13, 23, 25, 26, 33, 43, 53].map(count => { const button = new Element(); button.dataset.count = String(count); return button; });
  const document = new EventTarget();
  const site = { querySelector: element, querySelectorAll: () => [] };
  Object.assign(document, { hidden: false, querySelector: selector => selector === '[data-song-sphere]' ? (embedded ? site : null) : element(selector), querySelectorAll: () => presets, createElement: () => new Element() });
  const window = new EventTarget();
  const media = query => Object.assign(new EventTarget(), { matches: query.includes('max-width') ? isPhone : false });
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '_songs-sphere.js'), 'utf8'), {
    document, window, matchMedia: media,
    ResizeObserver: class { observe() {} },
    requestAnimationFrame: callback => { const id = nextFrame++; frames.set(id, callback); return id; },
    cancelAnimationFrame: id => frames.delete(id),
  });
  const fire = (selector, type, values = {}) => {
    const event = new Event(type, { cancelable: true });
    Object.assign(event, values);
    element(selector).dispatchEvent(event);
    return event;
  };
  const pointer = (type, id, x = 100, y = 100) => fire('.scene', type, { pointerId: id, isPrimary: true, pointerType: 'touch', button: 0, clientX: x, clientY: y });
  const flush = (time = 100) => { const pending = [...frames.values()]; frames.clear(); pending.forEach(callback => callback(time)); };
  return { element, presets, fire, pointer, flush, frames, document, window };
}

test('one-finger gestures on the scene suppress native touch scrolling', () => {
  const page = pageHarness();
  for (const type of ['touchstart', 'touchmove']) {
    const event = page.fire('.scene', type, { touches: [{ identifier: 1 }] });
    assert.ok(event.defaultPrevented, `${type} must claim the single-finger gesture`);
  }
});

test('center text follows the sphere without flipping through dragging, pause and reset', () => {
  const page = pageHarness(false, true);
  page.flush(100);
  page.flush(140);
  const roll = () => Number(page.element('.world').style.transform.match(/rotateZ\(([-\d.]+)deg\)/)[1]);
  const titleAngles = () => [...page.element('.title').style.transform.matchAll(/rotate[ZYX]\(([-\d.]+)deg\)/g)].map(match => Number(match[1]));
  const readable = () => {
    const [inverseZ, inverseY, inverseX, z, y, x] = titleAngles();
    const worldAngles = [...page.element('.world').style.transform.matchAll(/rotate[XYZ]\(([-\d.]+)deg\)/g)].map(match => Number(match[1]));
    assert.ok([inverseX, inverseY, inverseZ].every((angle, index) => Math.abs(angle + worldAngles[index]) < 1e-9));
    assert.ok(Math.abs(z) <= 8 && y >= 0 && y <= 24 && x >= -12 && x <= 0);
  };
  assert.ok(Math.abs(roll() - 5 * .62 * .04) < 1e-10);
  readable();
  assert.ok(page.element('.world').children.every(card => !card.style.opacity), 'covers remain opaque');
  const before = roll();
  const beforeTitle = titleAngles();
  page.pointer('pointerdown', 1);
  page.pointer('pointermove', 1, 200, 170);
  page.flush(180);
  assert.equal(roll(), before, 'dragging retains the current roll');
  assert.notDeepEqual(titleAngles(), beforeTitle, 'the word follows the drag');
  readable();
  page.pointer('pointerup', 1);
  page.fire('#pause', 'click');
  page.flush(220);
  assert.equal(roll(), before, 'pause stops the roll');
  for (let i = 0; i < 20; i++) page.fire('.scene', 'keydown', { key: 'ArrowRight' });
  readable();
  page.fire('#reset', 'click');
  assert.equal(roll(), 0);
  assert.equal(titleAngles()[3], 0);
  readable();
});

test('cancelled gestures release capture and allow the next swipe', () => {
  const page = pageHarness();
  page.fire('#pause', 'click');
  page.pointer('pointerdown', 1);
  page.pointer('pointercancel', 1);
  assert.ok(!page.element('.scene').hasPointerCapture(1));
  const before = page.element('.world').style.transform;
  page.pointer('pointerdown', 2);
  page.pointer('pointermove', 2, 190, 140);
  page.flush();
  assert.notEqual(page.element('.world').style.transform, before);
  page.pointer('pointerup', 2);
  assert.ok(!page.element('.scene').hasPointerCapture(2));
});

test('touch moves are painted once per frame, including while paused', () => {
  const page = pageHarness();
  page.fire('#pause', 'click');
  page.pointer('pointerdown', 1);
  const before = page.element('.world').style.transform;
  for (let i = 1; i <= 30; i++) page.pointer('pointermove', 1, 100 + i * 2, 100 + i);
  assert.equal(page.element('.world').style.transform, before, 'input events must not repaint immediately');
  assert.equal(page.frames.size, 1);
  page.flush();
  assert.notEqual(page.element('.world').style.transform, before);
});

test('phone count input and rendered catalog stop at 25', () => {
  const page = pageHarness();
  assert.equal(Number(page.element('#count').max), 25);
  page.element('#count').value = '64';
  page.fire('#count', 'input');
  assert.equal(page.element('.world').children.length, 25);
  assert.ok(page.presets.filter(button => Number(button.dataset.count) > 25).every(button => button.disabled));
});

test('leaving the browser during a swipe does not leave dragging stuck', () => {
  const page = pageHarness();
  page.fire('#pause', 'click');
  page.pointer('pointerdown', 1);
  page.window.dispatchEvent(new Event('blur'));
  assert.ok(!page.element('.scene').hasPointerCapture(1));
  const before = page.element('.world').style.transform;
  page.pointer('pointerdown', 2);
  page.pointer('pointermove', 2, 200, 180);
  page.flush();
  assert.notEqual(page.element('.world').style.transform, before);
});

test('larger screens retain their separate 64-cover experiment limit', () => {
  const page = pageHarness(false);
  assert.equal(Number(page.element('#count').max), 64);
  assert.ok(page.presets.every(button => !button.disabled));
});

test('embedded website uses the approved fixed profiles without experiment controls', () => {
  for (const [phone, count, scale] of [[true, 13, .30], [false, 26, .25]]) {
    const page = pageHarness(phone, true);
    assert.equal(page.element('.world').children.length, count);
    const diameter = Number(page.element('.scene').style['--diameter'].replace('px', ''));
    const card = Number(page.element('.scene').style['--card'].replace('px', ''));
    assert.ok(Math.abs(card / diameter - scale) < 1e-12);
    assert.ok(page.element('.world').children.every(card => card.children[0].loading === 'lazy'));
  }
});
