const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

// Run the page code against the actual message boundary. A browser check still
// verifies that YouTube accepts this protocol and visibly disables captions.
function playerHarness({ click = true, audio = false } = {}) {
  const nodes = new Map();
  const timers = new Map();
  const timeouts = new Map();
  const messages = [];
  let nextTimer = 0;
  class Element extends EventTarget {
    constructor(tag) {
      super();
      this.tag = tag;
      this.children = [];
      this.dataset = {};
      this.attrs = {};
      this.isConnected = true;
      this.contentWindow = { postMessage: (data, origin) => messages.push({ ...JSON.parse(data), origin }) };
    }
    querySelector(selector) {
      if (selector === 'iframe') return this.children.find(child => child.tag === 'iframe') || null;
      if (!nodes.has(selector)) nodes.set(selector, new Element(selector));
      return nodes.get(selector);
    }
    querySelectorAll() { return []; }
    append(child) { this.children.push(child); }
    replaceChildren(...children) { this.children.forEach(child => { child.isConnected = false; }); this.children = children; }
    setAttribute(name, value) { this.attrs[name] = value; }
    getAttribute(name) { return this.attrs[name]; }
    removeAttribute(name) { delete this.attrs[name]; }
    showModal() { this.open = true; }
    scrollTo() {}
    focus() {}
  }
  const card = new Element('a');
  card.dataset = audio
    ? { song: 'cover-polaroid', title: 'Polaroid', audio: 'atiBaTDbJbA' }
    : { song: 'roll-rutger', title: 'Roll', video: '6npK3I6hPRk' };
  card.querySelector('img').setAttribute('src', `covers/${card.dataset.song}.webp`);
  const document = Object.assign(new EventTarget(), {
    title: 'Rutger', body: new Element('body'),
    querySelectorAll: () => [card], querySelector: () => card,
    createElement: tag => new Element(tag),
  });
  const window = Object.assign(new EventTarget(), {
    matchMedia: () => ({ matches: false }),
  });
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '_song-viewer.js'), 'utf8'), {
    document, window, URL,
    location: new URL(`https://example.test/?song=${card.dataset.song}#songs`),
    history: { replaceState() {} },
    ResizeObserver: class { observe() {} },
    setInterval: callback => { timers.set(++nextTimer, callback); return nextTimer; },
    clearInterval: id => timers.delete(id),
    setTimeout: callback => { timeouts.set(++nextTimer, callback); return nextTimer; },
    clearTimeout: id => timeouts.delete(id),
  });
  const screen = nodes.get('.song-viewer-screen');
  const preview = screen.querySelector('iframe');
  const playButton = screen.children.find(child => child.tag === 'button');
  if (click) playButton.dispatchEvent(new Event('click'));
  const player = screen.querySelector('iframe');
  const receive = (message, overrides = {}) => {
    const event = new Event('message');
    Object.assign(event, { data: JSON.stringify(message), origin: 'https://www.youtube-nocookie.com', source: player.contentWindow, ...overrides });
    window.dispatchEvent(event);
  };
  return { timers, timeouts, messages, receive, player, preview, playButton, screen };
}

test('video preview is muted and replaced by the full player on click', () => {
  const page = playerHarness();
  assert.match(page.preview.src, /autoplay=1&mute=1&controls=0&loop=1&playlist=6npK3I6hPRk/);
  assert.match(page.preview.src, /enablejsapi=1&origin=/);
  assert.equal(page.preview.tabIndex, -1);
  assert.equal(page.preview.isConnected, false);
  assert.doesNotMatch(page.player.src, /mute=1|controls=0/);
  assert.notEqual(page.player, page.preview);
  assert.equal(page.playButton.getAttribute('aria-label'), 'Musikvideo abspielen');
  assert.equal(page.playButton.innerHTML, '<span aria-hidden="true">▶</span>');
});

test('preview appears after its captions track is cleared', () => {
  const page = playerHarness({ click: false });
  assert.equal(page.preview.dataset.ready, undefined);
  page.receive({ event: 'apiInfoDelivery', info: { captions: { options: ['track'] } } });
  assert.equal(page.messages.some(message => message.func === 'setOption'), true);
  [...page.timeouts.values()][0]();
  assert.equal(page.preview.dataset.ready, 'true');
});

test('audio-only song keeps its cover and starts the official audio on click', () => {
  const page = playerHarness({ click: false, audio: true });
  assert.equal(page.preview, null);
  assert.equal(page.playButton.getAttribute('aria-label'), 'Song abspielen');
  page.playButton.dispatchEvent(new Event('click'));
  assert.match(page.screen.querySelector('iframe').src, /\/embed\/atiBaTDbJbA\?/);
});

test('player handshake and caption commands carry the YouTube widget envelope', () => {
  const page = playerHarness();
  [...page.timers.values()][0]();
  assert.deepEqual(page.messages[0], { event: 'listening', id: 'song-player', channel: 'widget', origin: 'https://www.youtube-nocookie.com' });
  page.receive({ event: 'initialDelivery' });
  assert.equal(page.timers.size, 0);
  page.receive({ event: 'apiInfoDelivery', info: { captions: { options: ['track'] } } });
  const command = page.messages.find(message => message.func === 'setOption');
  assert.deepEqual(command, { event: 'command', func: 'setOption', args: ['captions', 'track', {}], id: 'song-player', channel: 'widget', origin: 'https://www.youtube-nocookie.com' });
  page.receive({ event: 'apiInfoDelivery', info: { captions: { options: ['track'] } } });
  assert.equal(page.messages.filter(message => message.func === 'setOption').length, 1, 'later manual CC choices must remain available');
});

test('caption initialization waits for the module and rejects foreign or detached frames', () => {
  const page = playerHarness();
  const ready = { event: 'apiInfoDelivery', info: { captions: { options: ['track'] } } };
  page.receive(ready, { origin: 'https://untrusted.example' });
  page.receive(ready, { source: {} });
  page.receive({ event: 'apiInfoDelivery', info: {} });
  page.receive(null);
  page.receive({}, { data: 'invalid JSON' });
  assert.equal(page.messages.length, 0);
  page.screen.replaceChildren();
  page.receive(ready);
  [...page.timers.values()][0]();
  assert.equal(page.messages.length, 0);
  assert.equal(page.timers.size, 0);
});
