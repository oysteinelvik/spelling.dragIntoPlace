const logEl = document.getElementById('log');
const languageEl = document.getElementById('language');
const orientationEl = document.getElementById('orientation');

function appendLog(line) {
  logEl.textContent += `${line}\n`;
  logEl.scrollTop = logEl.scrollHeight;
}

function connectLogStream() {
  const source = new EventSource('/api/logs');
  source.onmessage = (event) => appendLog(event.data.replace(/\\n/g, '\n'));
  source.onerror = () => appendLog('(log stream disconnected, retrying...)');
}

async function loadLanguages(selectCode) {
  const response = await fetch('/api/languages');
  const { languages } = await response.json();
  languageEl.innerHTML = languages.map((code) => `<option value="${code}">${code}</option>`).join('');
  if (selectCode && languages.includes(selectCode)) languageEl.value = selectCode;
}

document.getElementById('rebuild').addEventListener('click', async () => {
  appendLog('> rebuild requested');
  await fetch('/api/rebuild', { method: 'POST' });
  setTimeout(() => loadLanguages(languageEl.value), 800);
});

document.getElementById('package').addEventListener('click', async () => {
  appendLog('> make package & upload requested');
  await fetch('/api/package', { method: 'POST' });
});

document.getElementById('preview').addEventListener('click', () => {
  const lang = languageEl.value || 'english';
  const landscape = orientationEl.checked;
  const width = landscape ? 800 : 420;
  const height = landscape ? 420 : 800;
  const win = window.open(`/game/index.html?cr_lang=${encodeURIComponent(lang)}`, 'drag-into-place-preview', `width=${width},height=${height}`);
  if (!win) appendLog('Preview window was blocked by the browser. Allow popups for this page.');
});

connectLogStream();
loadLanguages();
