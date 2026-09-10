const IS_FILE_ORIGIN = window.location.protocol === 'file:';
const params = new URLSearchParams(window.location.search);
const lang = params.get('cr_lang') || 'english';
const userId = params.get('cr_user_id') || '';
const storageKey = 'drag-into-place-progress-v1';
const SUB_APP_ID = 'drag-into-place';

const state = {
  content: null,
  puzzleIndex: 0,
  puzzle: null,
  placements: [],
  activeTiles: [],
  hints: [],
  moving: false,
  completed: 0,
  sessionEventSent: false,
  completionEventSent: false
};

const $ = (id) => document.getElementById(id);
const views = { game: $('game'), complete: $('complete'), error: $('error') };

function showView(name) {
  Object.entries(views).forEach(([key, element]) => { element.hidden = key !== name; });
}

function uuidv4() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0'));
  return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex.slice(6, 8).join('')}-${hex.slice(8, 10).join('')}-${hex.slice(10).join('')}`;
}

function emit(collection, data, options) {
  try {
    if (typeof window.ReactNativeWebView?.postMessage !== 'function') return;
    const payload = {
      payload_id: uuidv4(), cr_user_id: userId, sub_app_id: SUB_APP_ID,
      payload_version: 1, collection, timestamp: new Date().toISOString(), data
    };
    if (collection === 'summary_data') payload.options = options || {};
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'cr_event', payload }));
  } catch (_) { /* Reporting never interrupts play. */ }
}

function loadText(url) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.onload = () => (xhr.status === 0 || xhr.status === 200) ? resolve(xhr.responseText) : reject(new Error(`XHR ${xhr.status}`));
    xhr.onerror = () => reject(new Error('Local content could not be loaded'));
    xhr.send();
  });
}

async function loadContent() {
  const url = `./lang/${encodeURIComponent(lang)}/data.json`;
  const raw = IS_FILE_ORIGIN ? await loadText(url) : await (await fetch(url)).text();
  const parsed = JSON.parse(raw);
  validateContent(parsed);
  return parsed;
}

function validateContent(content) {
  if (content.schema_version !== 1 || !Array.isArray(content.puzzles) || content.lang !== 'english') throw new Error('Unsupported content');
  const ids = new Set();
  content.puzzles.forEach((puzzle) => {
    if (!Number.isInteger(puzzle.level_id) || ids.has(puzzle.level_id) || !/^[a-z]+$/.test(puzzle.target_word)) throw new Error('Invalid level');
    ids.add(puzzle.level_id);
    if (!Array.isArray(puzzle.letters) || puzzle.letters.join('') !== puzzle.target_word || !Array.isArray(puzzle.foils)) throw new Error('Invalid letters');
    if ([...puzzle.letters, ...puzzle.foils].some((letter) => !/^[a-z]$/.test(letter))) throw new Error('Invalid alphabet');
  });
}

function readProgress() {
  try { return JSON.parse(localStorage.getItem(storageKey) || '{}'); } catch (_) { return {}; }
}

function saveProgress() {
  try { localStorage.setItem(storageKey, JSON.stringify({ completed: state.completed, puzzleIndex: state.puzzleIndex })); } catch (_) { /* In-memory fallback. */ }
}

function speak(text, tone = 520) {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const context = new AudioContext();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.value = tone;
    gain.gain.setValueAtTime(.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(.09, context.currentTime + .02);
    gain.gain.exponentialRampToValueAtTime(.0001, context.currentTime + .18);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(); oscillator.stop(context.currentTime + .2);
  } catch (_) { /* Audio is optional. */ }
  $('feedback').dataset.lastSpoken = text;
}

function surfaceRect() { return $('game').getBoundingClientRect(); }

function getReservedRects(rect) {
  const margin = 10;
  const elements = [$('status-bar'), $('clue-chip'), $('word-area'), $('mode-toggle-wrap')];
  if (!$('next-word').hidden) elements.push($('next-word'));
  return elements.filter(Boolean).map((element) => {
    const box = element.getBoundingClientRect();
    return { left: box.left - rect.left - margin, right: box.right - rect.left + margin, top: box.top - rect.top - margin, bottom: box.bottom - rect.top + margin };
  });
}

function overlapsReserved(left, top, width, height, reserved) {
  const right = left + width; const bottom = top + height;
  return reserved.some((zone) => left < zone.right && right > zone.left && top < zone.bottom && bottom > zone.top);
}

function randomTilePosition(tile) {
  const rect = surfaceRect();
  const width = tile.offsetWidth || 70; const height = tile.offsetHeight || 74;
  const maxLeft = Math.max(0, rect.width - width); const maxTop = Math.max(0, rect.height - height);
  const reserved = getReservedRects(rect);
  for (let attempt = 0; attempt < 24; attempt++) {
    const left = Math.random() * maxLeft; const top = Math.random() * maxTop;
    if (!overlapsReserved(left, top, width, height, reserved)) return { left, top };
  }
  return { left: Math.random() * maxLeft, top: Math.max(0, maxTop - 10) };
}

function randomMovingTop(tile) {
  const rect = surfaceRect();
  const height = tile.offsetHeight || 74; const maxTop = Math.max(0, rect.height - height);
  const reserved = getReservedRects(rect);
  for (let attempt = 0; attempt < 24; attempt++) {
    const top = Math.random() * maxTop;
    if (!overlapsReserved(12, top, 40, height, reserved)) return top;
  }
  return maxTop;
}

function clampToSurface(tile, left, top) {
  const rect = surfaceRect();
  const width = tile.offsetWidth || 70; const height = tile.offsetHeight || 74;
  const maxLeft = Math.max(0, rect.width - width); const maxTop = Math.max(0, rect.height - height);
  return { left: Math.min(Math.max(left, 0), maxLeft), top: Math.min(Math.max(top, 0), maxTop) };
}

function resolveLanding(tile, left, top) {
  const width = tile.offsetWidth || 70; const height = tile.offsetHeight || 74;
  let landing = clampToSurface(tile, left, top);
  for (let pass = 0; pass < 4; pass++) {
    const reserved = getReservedRects(surfaceRect());
    const hit = reserved.find((zone) => overlapsReserved(landing.left, landing.top, width, height, [zone]));
    if (!hit) break;
    landing = clampToSurface(tile, landing.left, hit.bottom + 4);
  }
  return landing;
}

function setFeedback(message, type = '') {
  const feedback = $('feedback');
  feedback.textContent = message;
  feedback.className = `feedback ${type}`;
}

function renderPuzzle() {
  const puzzle = state.puzzle;
  state.placements = Array(puzzle.letters.length).fill(null);
  state.hints = Array(puzzle.letters.length).fill(false);
  state.activeTiles = [...puzzle.letters.map((letter, index) => ({ id: `letter-${index}`, value: letter, index, foil: false })), ...puzzle.foils.map((letter, index) => ({ id: `foil-${index}`, value: letter, index, foil: true }))].sort(() => Math.random() - .5);
  $('clue-art').textContent = puzzle.emoji || '🧩';
  $('clue-art').setAttribute('aria-label', `Picture clue for ${puzzle.target_word}`);
  $('answer-slots').innerHTML = puzzle.letters.map((_, index) => `<div class="slot" data-slot="${index}" tabindex="0" aria-label="Empty letter position ${index + 1}"></div>`).join('');
  $('hints').innerHTML = puzzle.letters.map((letter, index) => `<div class="hint" data-hint="${index}" aria-label="Hint for position ${index + 1}">${state.hints[index] ? letter : '·'}</div>`).join('');
  $('tile-layer').innerHTML = '';
  state.activeTiles.forEach((tile) => addTile(tile));
  $('next-word').hidden = true;
  setFeedback('');
  updateProgress();
}

function addTile(tileData) {
  const tile = document.createElement('button');
  tile.type = 'button'; tile.className = `tile${tileData.foil ? ' foil' : ''}`; tile.textContent = tileData.value.toUpperCase();
  tile.dataset.id = tileData.id; tile.dataset.value = tileData.value; tile.dataset.index = tileData.index; tile.dataset.foil = tileData.foil;
  tile.setAttribute('aria-label', `${tileData.foil ? 'Foil' : 'Letter'} ${tileData.value}`);
  tile.addEventListener('pointerdown', (event) => beginDrag(event, tile));
  $('tile-layer').appendChild(tile);
  if (state.moving) {
    tile.style.left = '12px';
    tile.style.top = `${randomMovingTop(tile)}px`;
    tile.style.animationDuration = `${(4 + Math.random() * 3).toFixed(2)}s`;
    tile.style.animationDelay = `-${(Math.random() * 5).toFixed(2)}s`;
    requestAnimationFrame(() => tile.classList.add('moving'));
  } else {
    const spot = randomTilePosition(tile);
    tile.style.left = `${spot.left}px`;
    tile.style.top = `${spot.top}px`;
  }
}

function beginDrag(event, tile) {
  if (tile.classList.contains('locked') || tile.classList.contains('gone')) return;
  if (tile.classList.contains('moving')) {
    const rect = surfaceRect();
    const box = tile.getBoundingClientRect();
    tile.style.left = `${box.left - rect.left}px`;
    tile.style.top = `${box.top - rect.top}px`;
    tile.classList.remove('moving');
  }
  tile.setPointerCapture?.(event.pointerId);
  tile.classList.add('stopped');
  let moved = false;
  const move = (moveEvent) => {
    moved = moved || Math.hypot(moveEvent.clientX - event.clientX, moveEvent.clientY - event.clientY) > 8;
    tile.style.transform = `translate(${moveEvent.clientX - event.clientX}px, ${moveEvent.clientY - event.clientY}px)`;
  };
  const end = (endEvent) => {
    tile.releasePointerCapture?.(event.pointerId);
    tile.removeEventListener('pointermove', move);
    tile.removeEventListener('pointerup', end);
    tile.removeEventListener('pointercancel', cancel);
    if (moved) {
      const landing = resolveLanding(tile, (parseFloat(tile.style.left) || 0) + (endEvent.clientX - event.clientX), (parseFloat(tile.style.top) || 0) + (endEvent.clientY - event.clientY));
      tile.style.left = `${landing.left}px`;
      tile.style.top = `${landing.top}px`;
      tile.style.transform = '';
      const target = findDropSlot(endEvent.clientX, endEvent.clientY);
      placeTile(tile, target ? Number(target.dataset.slot) : -1);
      return;
    }
    tile.style.transform = '';
    returnToBank(tile);
  };
  const cancel = () => {
    tile.releasePointerCapture?.(event.pointerId);
    tile.removeEventListener('pointermove', move);
    tile.removeEventListener('pointerup', end);
    tile.removeEventListener('pointercancel', cancel);
    tile.style.transform = '';
    returnToBank(tile);
  };
  tile.addEventListener('pointermove', move);
  tile.addEventListener('pointerup', end);
  tile.addEventListener('pointercancel', cancel);
}

function findDropSlot(clientX, clientY) {
  const hit = document.elementFromPoint(clientX, clientY)?.closest('.slot');
  if (hit) return hit;
  return [...document.querySelectorAll('.slot')].find((slot) => {
    const rect = slot.getBoundingClientRect();
    return clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom;
  });
}

function placeTile(tile, slotIndex) {
  if (slotIndex < 0 || state.placements[slotIndex]) { resumeAfterFailedDrop(tile); return; }
  const value = tile.dataset.value;
  const expected = state.puzzle.letters[slotIndex];
  if (tile.dataset.foil === 'true') {
    state.hints[slotIndex] = true;
    tile.classList.add('gone');
    document.querySelector(`.hint[data-hint="${slotIndex}"]`).classList.add('revealed');
    document.querySelector(`.hint[data-hint="${slotIndex}"]`).textContent = expected.toUpperCase();
    setFeedback('Not that one. Here is a hint.', 'bad'); speak('try again', 190);
    emit('user_sessions_data', { type: 'foil_selected', lang, level_id: state.puzzle.level_id });
    return;
  }
  if (value !== expected) {
    setFeedback('Almost. Try another space.', 'bad'); speak('try again', 190);
    if (state.moving) {
      resumeAfterFailedDrop(tile);
    } else {
      const bounce = randomTilePosition(tile);
      tile.style.left = `${bounce.left}px`;
      tile.style.top = `${bounce.top}px`;
    }
    tile.classList.add('wrong-drop');
    setTimeout(() => tile.classList.remove('wrong-drop'), 300);
    emit('user_sessions_data', { type: 'incorrect_letter', lang, level_id: state.puzzle.level_id });
    return;
  }
  state.placements[slotIndex] = value;
  const slot = document.querySelector(`.slot[data-slot="${slotIndex}"]`); slot.textContent = value.toUpperCase(); slot.classList.add('filled'); slot.setAttribute('aria-label', `Correct letter ${value}`);
  tile.remove();
  setFeedback('Yes! That letter belongs there.', 'good'); speak(value, 530 + slotIndex * 70);
  emit('user_sessions_data', { type: 'letter_placed', lang, level_id: state.puzzle.level_id, position: slotIndex + 1 });
  if (state.placements.every(Boolean)) completePuzzle();
}

function returnToBank(tile) { tile.classList.remove('stopped'); }

function resumeAfterFailedDrop(tile) {
  tile.classList.remove('stopped');
  if (!state.moving) return;
  tile.style.animationDuration = `${(4 + Math.random() * 3).toFixed(2)}s`;
  tile.style.animationDelay = `-${(Math.random() * 5).toFixed(2)}s`;
  tile.classList.add('moving');
}

function completePuzzle() {
  if (state.completionEventSent) return;
  state.completionEventSent = true; state.completed += 1; saveProgress(); speak(state.puzzle.target_word, 740); setFeedback(`You spelled ${state.puzzle.target_word}!`, 'good');
  emit('user_sessions_data', { type: 'level_completed', lang, level_id: state.puzzle.level_id, score: state.puzzle.letters.length, max_score: state.puzzle.letters.length });
  setTimeout(() => { $('complete-title').textContent = state.puzzle.target_word.toUpperCase(); $('complete-copy').textContent = 'A new word is ready when you are.'; showView('complete'); }, 650);
}

function nextPuzzle() {
  state.puzzleIndex = (state.puzzleIndex + 1) % state.content.puzzles.length; state.puzzle = state.content.puzzles[state.puzzleIndex]; state.completionEventSent = false; showView('game'); renderPuzzle();
}

function updateProgress() {
  const total = state.content?.puzzles.length || 1; $('progress-label').textContent = `Word ${state.puzzleIndex + 1} of ${total}`; $('progress-bar').style.width = `${((state.puzzleIndex + 1) / total) * 100}%`;
}

function setupEvents() {
  $('next-word').addEventListener('click', nextPuzzle); $('complete-next').addEventListener('click', nextPuzzle); $('retry').addEventListener('click', boot);
  $('speak-word').addEventListener('click', () => speak(state.puzzle?.target_word || 'word', 740));
  $('moving-mode').addEventListener('change', (event) => { state.moving = event.target.checked; renderPuzzle(); });
  $('answer-slots').addEventListener('pointerover', (event) => event.target.closest('.slot')?.classList.add('over'));
  $('answer-slots').addEventListener('pointerout', (event) => event.target.closest('.slot')?.classList.remove('over'));
  let resizeTimer;
  const reclamp = () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(clampAllTilesToSurface, 120); };
  window.addEventListener('resize', reclamp);
  window.addEventListener('orientationchange', reclamp);
}

function clampAllTilesToSurface() {
  if ($('game').hidden) return;
  document.querySelectorAll('#tile-layer .tile').forEach((tile) => {
    if (tile.classList.contains('locked') || tile.classList.contains('gone')) return;
    const landing = clampToSurface(tile, parseFloat(tile.style.left) || 0, parseFloat(tile.style.top) || 0);
    tile.style.left = `${landing.left}px`;
    tile.style.top = `${landing.top}px`;
  });
}

async function boot() {
  try {
    state.content = await loadContent(); const saved = readProgress(); state.puzzleIndex = Number.isInteger(saved.puzzleIndex) ? saved.puzzleIndex % state.content.puzzles.length : 0; state.completed = Number(saved.completed) || 0; state.puzzle = state.content.puzzles[state.puzzleIndex];
    if (!state.sessionEventSent) { emit('user_sessions_data', { type: 'session_started', lang }); state.sessionEventSent = true; }
    showView('game'); renderPuzzle();
  } catch (error) { $('error-copy').textContent = error.message; showView('error'); }
}

setupEvents(); boot();
