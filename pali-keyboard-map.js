const PALI_KEY_MAP = {
  KeyA: { alt: 'ā', shiftAlt: 'Ā' },
  KeyI: { alt: 'ī', shiftAlt: 'Ī' },
  KeyU: { alt: 'ū', shiftAlt: 'Ū' },
  KeyM: { alt: 'ṃ', shiftAlt: 'Ṃ' },
  KeyN: { alt: 'ṇ', shiftAlt: 'Ṇ' },
  KeyJ: { alt: 'ñ', shiftAlt: 'Ñ' },
  KeyT: { alt: 'ṭ', shiftAlt: 'Ṭ' },
  KeyD: { alt: 'ḍ', shiftAlt: 'Ḍ' },
  KeyL: { alt: 'ḷ', shiftAlt: 'Ḷ' },
  KeyG: { alt: 'ṅ', shiftAlt: 'Ṅ' }
};

document.addEventListener('keydown', (e) => {
  if (e.key === 'Alt') return;
  if (!e.altKey) return;

  const mapping = PALI_KEY_MAP[e.code];
  if (mapping) {
    // Only intercept if we are in an input or textarea
    const activeEl = document.activeElement;
    if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) {
      e.preventDefault();
      const useShift = e.shiftKey;
      const ch = useShift ? (mapping.shiftAlt || mapping.alt) : mapping.alt;
      const start = activeEl.selectionStart;
      const end = activeEl.selectionEnd;
      activeEl.value = activeEl.value.slice(0, start) + ch + activeEl.value.slice(end);
      activeEl.selectionStart = activeEl.selectionEnd = start + ch.length;
      
      // Dispatch input event so that frameworks/listeners pick up the change
      activeEl.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }
});

function initPaliWidget() {
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0 || /Mac|iPhone|iPad/.test(navigator.userAgent);
  let savedOS = localStorage.getItem('paliKeyboardOS');
  if (!savedOS) savedOS = isMac ? 'mac' : 'win';

  const widgetHTML = `
    <div id="pali-kb-widget" class="pali-kb-widget collapsed">
      <div class="pali-kb-header" onclick="document.getElementById('pali-kb-widget').classList.toggle('collapsed')">
        <span class="pali-kb-title"><svg class="custom-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="1em" height="1em" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-right: 6px;"><path d="M4 6h16a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z"></path><line x1="8" y1="10" x2="8" y2="10"></line><line x1="12" y1="10" x2="12" y2="10"></line><line x1="16" y1="10" x2="16" y2="10"></line><line x1="12" y1="14" x2="12" y2="14"></line><line x1="8" y1="14" x2="8" y2="14"></line><line x1="16" y1="14" x2="16" y2="14"></line></svg> Pāli Typing</span>
        <button class="pali-kb-toggle">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"></polyline></svg>
        </button>
      </div>
      <div class="pali-kb-body">
        <div class="pali-kb-os-toggle">
          <button class="${savedOS === 'mac' ? 'active' : ''}" onclick="window.setPaliOS('mac', this)">Mac (Option)</button>
          <button class="${savedOS === 'win' ? 'active' : ''}" onclick="window.setPaliOS('win', this)">Win (Alt)</button>
        </div>
        <div class="pali-kb-grid">
          <div class="pali-kb-row"><span><kbd class="os-mod">${savedOS === 'mac' ? '⌥' : 'Alt'}</kbd> + A</span> <span class="pali-char">ā</span></div>
          <div class="pali-kb-row"><span><kbd class="os-mod">${savedOS === 'mac' ? '⌥' : 'Alt'}</kbd> + I</span> <span class="pali-char">ī</span></div>
          <div class="pali-kb-row"><span><kbd class="os-mod">${savedOS === 'mac' ? '⌥' : 'Alt'}</kbd> + U</span> <span class="pali-char">ū</span></div>
          <div class="pali-kb-row"><span><kbd class="os-mod">${savedOS === 'mac' ? '⌥' : 'Alt'}</kbd> + M</span> <span class="pali-char">ṃ</span></div>
          <div class="pali-kb-row"><span><kbd class="os-mod">${savedOS === 'mac' ? '⌥' : 'Alt'}</kbd> + N</span> <span class="pali-char">ṇ</span></div>
          <div class="pali-kb-row"><span><kbd class="os-mod">${savedOS === 'mac' ? '⌥' : 'Alt'}</kbd> + T</span> <span class="pali-char">ṭ</span></div>
          <div class="pali-kb-row"><span><kbd class="os-mod">${savedOS === 'mac' ? '⌥' : 'Alt'}</kbd> + D</span> <span class="pali-char">ḍ</span></div>
          <div class="pali-kb-row"><span><kbd class="os-mod">${savedOS === 'mac' ? '⌥' : 'Alt'}</kbd> + L</span> <span class="pali-char">ḷ</span></div>
          <div class="pali-kb-row"><span><kbd class="os-mod">${savedOS === 'mac' ? '⌥' : 'Alt'}</kbd> + J</span> <span class="pali-char">ñ</span></div>
          <div class="pali-kb-row"><span><kbd class="os-mod">${savedOS === 'mac' ? '⌥' : 'Alt'}</kbd> + G</span> <span class="pali-char">ṅ</span></div>
        </div>
        <a href="typing-guide.html" class="pali-kb-link">View Full Guide →</a>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', widgetHTML);

  window.setPaliOS = function(os, btn) {
    localStorage.setItem('paliKeyboardOS', os);
    document.querySelectorAll('.pali-kb-os-toggle button').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    
    const modText = os === 'mac' ? '⌥' : 'Alt';
    document.querySelectorAll('.os-mod').forEach(kbd => kbd.textContent = modText);
  };
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initPaliWidget);
} else {
  initPaliWidget();
}
