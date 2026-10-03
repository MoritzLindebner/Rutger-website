(() => {
  'use strict';

  const cards = [...document.querySelectorAll('[data-song-sphere] a[data-song]')];
  const songs = [...new Map(cards.map(card => [card.dataset.song, {
    slug: card.dataset.song, title: card.dataset.title,
    cover: card.querySelector('img').getAttribute('src'), video: card.dataset.video, audio: card.dataset.audio,
  }])).values()];
  if (!songs.length) return;

  const dialog = document.createElement('dialog');
  dialog.className = 'song-viewer';
  dialog.setAttribute('aria-labelledby', 'song-viewer-title');
  dialog.setAttribute('data-lenis-prevent', '');
  // Static markup only. Song metadata is assigned through DOM properties.
  dialog.innerHTML = `
    <header class="song-viewer-header">
      <span class="song-viewer-brand">Rutger</span>
      <button class="song-viewer-close" type="button" autofocus>← Zurück zu Songs</button>
    </header>
    <div class="song-viewer-main">
      <div class="song-viewer-media"><div class="song-viewer-screen"></div></div>
      <div class="song-viewer-info">
        <div><p class="song-viewer-eyebrow"></p><h2 class="song-viewer-title" id="song-viewer-title"></h2></div>
        <a class="song-viewer-external" target="_blank" rel="noopener noreferrer" hidden>Auf YouTube ↗</a>
      </div>
    </div>
    <footer class="song-viewer-footer">
      <nav class="song-viewer-strip" aria-label="Song auswählen"></nav>
      <div class="song-viewer-paging">
        <button type="button" data-direction="-1" aria-label="Vorheriger Song">← Zurück</button>
        <span class="song-viewer-count" aria-live="polite"></span>
        <button type="button" data-direction="1" aria-label="Nächster Song">Weiter →</button>
      </div>
    </footer>`;
  document.body.append(dialog);
  const strip = dialog.querySelector('.song-viewer-strip');
  const screen = dialog.querySelector('.song-viewer-screen');
  const heading = dialog.querySelector('.song-viewer-title');
  const eyebrow = dialog.querySelector('.song-viewer-eyebrow');
  const external = dialog.querySelector('.song-viewer-external');
  const count = dialog.querySelector('.song-viewer-count');
  const originalTitle = document.title;
  let selected = -1;
  let returnFocus = null;
  let returnUrl = null;
  let ownsHistoryEntry = false;
  let captionsInitialized = false;
  let playerHandshake = 0;
  let previewReveal = 0;

  // ponytail: YouTube's URL flag respects saved caption preferences. Its iframe
  // command bridge exposes a track option after the captions module loads.
  // Clear it once, leaving CC available afterwards. Replace this bridge when
  // a documented force-off flag exists.
  const playerOrigin = 'https://www.youtube-nocookie.com';
  function playerCommand(player, func, args) {
    player.contentWindow.postMessage(JSON.stringify({ event: 'command', func, args, id: 'song-player', channel: 'widget' }), playerOrigin);
  }
  function startPlayerHandshake(player) {
    captionsInitialized = false;
    let attempts = 0;
    playerHandshake = setInterval(() => {
      if (!player.isConnected || ++attempts > 40) { clearInterval(playerHandshake); return; }
      player.contentWindow.postMessage(JSON.stringify({ event: 'listening', id: 'song-player', channel: 'widget' }), playerOrigin);
    }, 250);
  }
  window.addEventListener('message', event => {
    const player = screen.querySelector('iframe');
    if (!player || event.origin !== playerOrigin || event.source !== player.contentWindow) return;
    let message;
    try { message = JSON.parse(event.data); } catch { return; }
    if (!message || typeof message !== 'object') return;
    if (message.event === 'initialDelivery') {
      clearInterval(playerHandshake);
      playerCommand(player, 'addEventListener', ['onApiChange']);
    }
    if (message.event === 'apiInfoDelivery' && !captionsInitialized
      && message.info?.captions?.options?.includes('track')) {
      captionsInitialized = true;
      playerCommand(player, 'setOption', ['captions', 'track', {}]);
      if (player.className === 'song-viewer-preview') {
        clearTimeout(previewReveal);
        previewReveal = setTimeout(() => {
          if (player.isConnected) player.dataset.ready = 'true';
        }, 250);
      }
    }
  });

  const thumbs = songs.map((song, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'song-viewer-thumb';
    button.setAttribute('aria-label', song.title);
    const image = document.createElement('img');
    image.src = song.cover;
    image.alt = '';
    image.draggable = false;
    button.append(image);
    button.addEventListener('click', () => select(index));
    strip.append(button);
    return button;
  });

  function centerSelection() {
    if (selected < 0 || !dialog.open) return;
    const thumb = thumbs[selected];
    strip.scrollTo({ left: thumb.offsetLeft - (strip.clientWidth - thumb.offsetWidth) / 2, behavior: 'instant' });
  }

  function select(index, updateUrl = true) {
    clearInterval(playerHandshake);
    clearTimeout(previewReveal);
    selected = (index + songs.length) % songs.length;
    const song = songs[selected];
    heading.textContent = song.title;
    eyebrow.textContent = song.video ? 'RUTGER / MUSIKVIDEO' : 'RUTGER / SONG';
    count.textContent = `${String(selected + 1).padStart(2, '0')} / ${String(songs.length).padStart(2, '0')}`;
    document.title = `${song.title} — Rutger`;
    external.hidden = !song.video && !song.audio;
    external.removeAttribute('href');
    screen.replaceChildren(); // Removing the iframe stops playback on every song change.
    const cover = document.createElement('img');
    cover.src = song.cover;
    cover.alt = `${song.title} – Cover`;
    screen.append(cover);
    if (song.video || song.audio) {
      const videoId = song.video || song.audio;
      external.href = `https://www.youtube.com/watch?v=${videoId}`;
      if (song.video && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        const preview = document.createElement('iframe');
        preview.className = 'song-viewer-preview';
        preview.title = `${song.title} – stumme Videovorschau`;
        preview.src = `${playerOrigin}/embed/${song.video}?autoplay=1&mute=1&controls=0&loop=1&playlist=${song.video}&playsinline=1&rel=0&cc_load_policy=0&enablejsapi=1&origin=${encodeURIComponent(location.origin)}`;
        preview.allow = 'autoplay; encrypted-media';
        preview.referrerPolicy = 'strict-origin-when-cross-origin';
        preview.tabIndex = -1;
        preview.setAttribute('aria-hidden', 'true');
        screen.append(preview);
        startPlayerHandshake(preview);
        // Videos without a captions module still get a preview after loading.
        previewReveal = setTimeout(() => {
          if (preview.isConnected) preview.dataset.ready = 'true';
        }, 1800);
      }
      const play = document.createElement('button');
      play.type = 'button';
      play.className = 'song-viewer-play';
      play.setAttribute('aria-label', song.video ? 'Musikvideo abspielen' : 'Song abspielen');
      play.innerHTML = '<span aria-hidden="true">▶</span>';
      play.addEventListener('click', () => {
        clearInterval(playerHandshake);
        clearTimeout(previewReveal);
        const player = document.createElement('iframe');
        player.title = `${song.title} – ${song.video ? 'Musikvideo' : 'Song'} auf YouTube`;
        player.src = `${playerOrigin}/embed/${videoId}?autoplay=1&playsinline=1&rel=0&cc_load_policy=0&enablejsapi=1&origin=${encodeURIComponent(location.origin)}`;
        player.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
        player.allowFullscreen = true;
        player.referrerPolicy = 'strict-origin-when-cross-origin';
        screen.replaceChildren(player);
        startPlayerHandshake(player);
        player.focus();
      });
      screen.append(play);
    }
    thumbs.forEach((thumb, i) => {
      if (i === selected) thumb.setAttribute('aria-current', 'true');
      else thumb.removeAttribute('aria-current');
    });
    if (updateUrl) {
      const url = new URL(location.href);
      url.searchParams.set('song', song.slug);
      history.replaceState(history.state, '', url);
    }
    centerSelection();
  }

  function open(index, trigger, fromUrl = false) {
    if (!dialog.open) {
      returnFocus = trigger || document.querySelector('[data-song-sphere] .scene');
      returnUrl = new URL(location.href);
      returnUrl.searchParams.delete('song');
      returnUrl.hash = 'songs';
      ownsHistoryEntry = !fromUrl;
      if (ownsHistoryEntry) history.pushState(history.state, '', location.href);
      dialog.showModal();
    }
    select(index, !fromUrl);
  }

  function close() {
    if (ownsHistoryEntry) history.back();
    else {
      if (returnUrl) history.replaceState(history.state, '', returnUrl);
      dialog.close();
    }
  }

  document.addEventListener('click', event => {
    const card = event.target.closest('a[data-song]');
    if (!card || event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const index = songs.findIndex(song => song.slug === card.dataset.song);
    if (index < 0) return;
    event.preventDefault();
    open(index, card);
  });
  dialog.querySelector('.song-viewer-close').addEventListener('click', close);
  dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
  dialog.addEventListener('close', () => {
    clearInterval(playerHandshake);
    clearTimeout(previewReveal);
    screen.replaceChildren();
    document.title = originalTitle;
    const target = returnFocus?.isConnected ? returnFocus : document.querySelector('[data-song-sphere] .scene');
    target?.focus({ preventScroll: true });
    document.querySelector('[data-song-sphere]').scrollIntoView({ block: 'start', behavior: 'instant' });
    ownsHistoryEntry = false;
  });
  dialog.querySelectorAll('[data-direction]').forEach(button => {
    button.addEventListener('click', () => select(selected + Number(button.dataset.direction)));
  });
  dialog.addEventListener('keydown', event => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    select(selected + (event.key === 'ArrowRight' ? 1 : -1));
    if (strip.contains(document.activeElement)) thumbs[selected].focus({ preventScroll: true });
  });
  function syncUrl() {
    const slug = new URL(location.href).searchParams.get('song');
    const index = songs.findIndex(song => song.slug === slug);
    if (index >= 0) open(index, null, true);
    else if (dialog.open) dialog.close();
  }
  window.addEventListener('popstate', syncUrl);
  new ResizeObserver(centerSelection).observe(strip);
  syncUrl();
})();
