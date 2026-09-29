/* מחליף הוריאנטים המשותף. במכוון לא חלק מהעיצוב הנבדק.
   כל עמוד מגדיר window.VARIANTS = [{key,name,render()}] וקורא mountPrototype(). */

function mountPrototype() {
  const V = window.VARIANTS;

  const read = () => {
    const k = new URLSearchParams(location.search).get('variant');
    const i = V.findIndex(v => v.key === k);
    return i < 0 ? 0 : i;
  };
  let idx = read();

  const write = () => {
    try {
      const u = new URL(location.href);
      u.searchParams.set('variant', V[idx].key);
      history.replaceState(null, '', u);
    } catch (e) { /* file:// בדפדפנים מסוימים — לא נורא */ }
  };

  const host = document.getElementById('app');

  function paint() {
    host.innerHTML = `
      <div class="phone">
        <div class="status"><span>9:41</span><span>◍ ▮▮▮ 78%</span></div>
        <div class="screen" id="screen"></div>
      </div>`;
    document.getElementById('screen').innerHTML = V[idx].render();
    if (V[idx].after) V[idx].after(document.getElementById('screen'));
    bar.querySelector('.lbl').innerHTML =
      `${V[idx].key} <small>${V[idx].name}</small>`;
    write();
  }

  const bar = document.createElement('div');
  bar.className = 'switcher';
  bar.innerHTML = `<a class="home" href="index.html">☰</a>
    <button data-d="-1">‹</button><div class="lbl"></div><button data-d="1">›</button>`;
  document.body.appendChild(bar);

  const go = d => { idx = (idx + d + V.length) % V.length; paint(); };
  bar.addEventListener('click', e => {
    const d = e.target.dataset.d; if (d) go(+d);
  });
  addEventListener('keydown', e => {
    if (/^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName)) return;
    if (e.key === 'ArrowLeft') go(1);        // RTL: שמאלה = הבא
    if (e.key === 'ArrowRight') go(-1);
  });

  paint();
  window.repaint = paint;
}

/* עוזרים זעירים שכל וריאנט רשאי להתעלם מהם */
const A = n => `<div class="avatar" style="background:${CAMP.color(n)}">${n[0]}</div>`;
const esc = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
