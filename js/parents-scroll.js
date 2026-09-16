/** A tactile, always-visible scroll control without changing the editable copy. */
const stylesheet = document.createElement('link');
stylesheet.rel = 'stylesheet';
stylesheet.href = new URL('../css/parents-scroll.css', import.meta.url).href;
document.head.append(stylesheet);

const copy = document.querySelector('#parents-dialog .parents-copy');
if (copy) installScrollbar(copy);

function installScrollbar(copy) {
  const dialog = copy.closest('dialog');
  const shell = document.createElement('div'); shell.className = 'parents-scroll-shell';
  copy.before(shell); shell.append(copy);
  copy.id ||= 'parents-reading-copy';
  const rail = document.createElement('div'); rail.className = 'parents-scroll-rail';
  function arrow(text, name) {
    const button = document.createElement('button'); button.type = 'button';
    button.className = 'parents-scroll-arrow'; button.textContent = text;
    button.setAttribute('aria-label', name); button.setAttribute('aria-controls', copy.id);
    rail.append(button); return button;
  }
  const up = arrow('▲', 'Scroll text up');
  const track = document.createElement('div'); track.className = 'parents-scroll-track'; rail.append(track);
  const thumb = document.createElement('div'); thumb.className = 'parents-scroll-thumb';
  thumb.tabIndex = 0; thumb.setAttribute('role', 'scrollbar');
  thumb.setAttribute('aria-label', 'Scroll the parents and guardians text');
  thumb.setAttribute('aria-controls', copy.id); thumb.setAttribute('aria-orientation', 'vertical');
  thumb.setAttribute('aria-valuemin', '0');
  const grip = document.createElement('span'); grip.textContent = '≡'; grip.setAttribute('aria-hidden', 'true');
  thumb.append(grip); track.append(thumb);
  const down = arrow('▼', 'Scroll text down'); shell.append(rail);
  let pending = false, drag = null;
  function metrics() {
    const max = Math.max(0, copy.scrollHeight - copy.clientHeight);
    const height = track.clientHeight;
    const thumbHeight = Math.min(height, Math.max(44, height * copy.clientHeight / Math.max(1, copy.scrollHeight)));
    return { max, height: thumbHeight, travel: Math.max(0, height - thumbHeight) };
  }
  function update() {
    pending = false;
    const m = metrics(), top = Math.max(0, Math.min(m.max, copy.scrollTop));
    thumb.style.height = `${m.height}px`;
    thumb.style.transform = `translateY(${m.max ? top / m.max * m.travel : 0}px)`;
    thumb.setAttribute('aria-valuemax', String(Math.round(m.max)));
    thumb.setAttribute('aria-valuenow', String(Math.round(top)));
    thumb.setAttribute('aria-valuetext', m.max ? `${Math.round(top / m.max * 100)}% scrolled` : 'All text visible');
    thumb.setAttribute('aria-disabled', String(m.max < 1));
    thumb.tabIndex = m.max < 1 ? -1 : 0;
    up.disabled = top <= 1; down.disabled = top >= m.max - 1;
  }
  function schedule() { if (!pending) { pending = true; requestAnimationFrame(update); } }
  up.addEventListener('click', () => { copy.scrollTop -= Math.max(60, copy.clientHeight * .6); schedule(); });
  down.addEventListener('click', () => { copy.scrollTop += Math.max(60, copy.clientHeight * .6); schedule(); });
  track.addEventListener('pointerdown', event => {
    if (event.target.closest('.parents-scroll-thumb')) return;
    const bounds = thumb.getBoundingClientRect();
    copy.scrollTop += (event.clientY < bounds.top ? -1 : 1) * copy.clientHeight * .85;
    schedule();
  });
  thumb.addEventListener('pointerdown', event => {
    if (event.button !== 0 || !metrics().max) return;
    event.preventDefault(); thumb.focus(); thumb.setPointerCapture(event.pointerId);
    drag = { id: event.pointerId, y: event.clientY, top: copy.scrollTop };
    thumb.classList.add('is-dragging');
  });
  thumb.addEventListener('pointermove', event => {
    if (!drag || drag.id !== event.pointerId) return;
    const m = metrics();
    copy.scrollTop = drag.top + (event.clientY - drag.y) / Math.max(1, m.travel) * m.max;
    schedule();
  });
  function release() { drag = null; thumb.classList.remove('is-dragging'); }
  for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) thumb.addEventListener(event, release);
  thumb.addEventListener('keydown', event => {
    const values = { ArrowDown: 50, ArrowUp: -50, PageDown: copy.clientHeight * .85, PageUp: -copy.clientHeight * .85 };
    if (event.key in values) copy.scrollTop += values[event.key];
    else if (event.key === 'Home') copy.scrollTop = 0;
    else if (event.key === 'End') copy.scrollTop = copy.scrollHeight;
    else return;
    event.preventDefault(); event.stopPropagation(); schedule();
  });
  copy.addEventListener('scroll', schedule, { passive: true });
  const resize = new ResizeObserver(schedule); resize.observe(copy); resize.observe(track);
  new MutationObserver(schedule).observe(copy, { childList: true, subtree: true, characterData: true });
  new MutationObserver(() => { if (!dialog.open) release(); schedule(); }).observe(dialog, { attributes: true, attributeFilter: ['open'] });
  stylesheet.addEventListener('load', schedule);
  document.fonts?.ready.then(schedule);
  schedule();
}
