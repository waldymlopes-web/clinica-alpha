// Câmera ao vivo em tela cheia e editor para marcar a foto
import { esc, toast } from '../ui.js?v=202611220013';

const svg = p => `<svg viewBox="0 0 24 24" aria-hidden="true">${p}</svg>`;
const I = {
  x: svg('<path d="M6 6l12 12M18 6L6 18"/>'),
  flip: svg('<path d="M4 7h12l-3-3M20 17H8l3 3"/>'),
  grid: svg('<ellipse cx="12" cy="11" rx="6" ry="8"/><path d="M12 2v20M3 11h18"/>'),
  gal: svg('<rect x="3" y="4" width="18" height="16" rx="1"/><path d="M3 16l5-5 4 4 3-3 6 6"/>'),
  pen: svg('<path d="M4 20c4-1 6-3 8-6s4-6 8-10"/>'),
  arrow: svg('<path d="M5 19L19 5M10 5h9v9"/>'),
  circle: svg('<circle cx="12" cy="12" r="8"/>'),
  pin: svg('<circle cx="12" cy="10" r="6"/><path d="M12 16v6"/>'),
  undo: svg('<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>'),
  trash: svg('<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>'),
  ok: svg('<path d="M5 12l5 5 9-10"/>'),
};

function overlay(html) {
  const o = document.createElement('div'); o.className = 'cam'; o.innerHTML = html;
  document.body.append(o); document.body.style.overflow = 'hidden';
  return { o, close: () => { o.remove(); if (!document.querySelector('.cam') && document.getElementById('sheet').hidden) document.body.style.overflow = ''; } };
}

// ---------- câmera ----------
let facingPref = 'user';
export function capturarFoto() {
  return new Promise(resolve => {
    const { o, close } = overlay(`
      <div class="cam-stage"><video playsinline autoplay muted></video><div class="cam-guide" hidden><span class="oval"></span><span class="h"></span><span class="v"></span></div>
        <div class="cam-msg" hidden></div></div>
      <div class="cam-bar">
        <button class="cam-btn" data-a="fechar" aria-label="Fechar">${I.x}<span>Fechar</span></button>
        <label class="cam-btn" aria-label="Escolher da galeria">${I.gal}<span>Galeria</span><input type="file" accept="image/*" hidden></label>
        <button class="cam-shot" data-a="foto" aria-label="Tirar foto"><span></span></button>
        <button class="cam-btn" data-a="guia" aria-label="Guia de enquadramento">${I.grid}<span>Guia</span></button>
        <button class="cam-btn" data-a="trocar" aria-label="Trocar câmera">${I.flip}<span>Trocar</span></button>
      </div>`);
    const video = o.querySelector('video'), msg = o.querySelector('.cam-msg');
    let stream = null;
    const parar = () => stream && stream.getTracks().forEach(t => t.stop());
    const fim = v => { parar(); close(); resolve(v); };
    const iniciar = async () => {
      parar();
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facingPref, width: { ideal: 1920 }, height: { ideal: 1440 } }, audio: false });
        video.srcObject = stream; video.classList.toggle('mirror', facingPref === 'user'); msg.hidden = true;
      } catch (e) {
        msg.hidden = false;
        msg.innerHTML = `Não foi possível abrir a câmera.<br><small>${e?.name === 'NotAllowedError' ? 'Permita o acesso à câmera nas configurações do navegador para este site.' : 'Use o botão Galeria para tirar ou escolher a foto.'}</small>`;
      }
    };
    if (!navigator.mediaDevices?.getUserMedia) { msg.hidden = false; msg.textContent = 'Este navegador não abre a câmera ao vivo. Use o botão Galeria.'; } else iniciar();
    o.querySelector('input[type=file]').onchange = e => { const f = e.target.files[0]; if (f) fim(f); };
    o.querySelector('.cam-bar').addEventListener('click', e => {
      const a = e.target.closest('[data-a]')?.dataset.a; if (!a) return;
      if (a === 'fechar') fim(null);
      if (a === 'trocar') { facingPref = facingPref === 'user' ? 'environment' : 'user'; iniciar(); }
      if (a === 'guia') o.querySelector('.cam-guide').hidden = !o.querySelector('.cam-guide').hidden;
      if (a === 'foto') {
        if (!video.videoWidth) return;
        const c = document.createElement('canvas'); c.width = video.videoWidth; c.height = video.videoHeight;
        c.getContext('2d').drawImage(video, 0, 0);
        o.querySelector('.cam-stage').classList.add('flash');
        c.toBlob(b => fim(b), 'image/jpeg', 0.92);
      }
    });
  });
}

// ---------- marcação ----------
const CORES = [['#e9cf8f', 'Dourado'], ['#ff4d4d', 'Vermelho'], ['#ffffff', 'Branco'], ['#1b1812', 'Preto']];

export async function marcarFoto(fonte, { pontos: pontosIni = [], titulo = 'Marque os pontos de ação' } = {}) {
  const url = typeof fonte === 'string' ? fonte : URL.createObjectURL(fonte);
  const img = await new Promise((res, rej) => { const i = new Image(); i.crossOrigin = 'anonymous'; i.onload = () => res(i); i.onerror = rej; i.src = url; });
  return new Promise(resolve => {
    const { o, close } = overlay(`
      <div class="mk-top"><button class="cam-btn" data-a="cancelar">${I.x}<span>Cancelar</span></button><b>${esc(titulo)}</b><button class="btn gold" data-a="ok">${I.ok}Concluir</button></div>
      <div class="mk-main"><div class="mk-stage"><canvas></canvas></div>
        <aside class="mk-side"><h3>Pontos marcados</h3><div class="mk-pts"></div><p class="hint">Use a ferramenta <b>Ponto</b> e toque na foto. Cada ponto ganha um número para você descrever aqui.</p></aside></div>
      <div class="mk-tools">
        <div class="mk-group">${[['pen', 'Riscar', I.pen], ['arrow', 'Seta', I.arrow], ['circle', 'Círculo', I.circle], ['pin', 'Ponto', I.pin]].map(([k, t, ic], i) => `<button class="cam-btn${i === 0 ? ' on' : ''}" data-tool="${k}">${ic}<span>${t}</span></button>`).join('')}</div>
        <div class="mk-group">${CORES.map(([c, n], i) => `<button class="mk-cor${i === 0 ? ' on' : ''}" data-cor="${c}" style="background:${c}" aria-label="${n}"></button>`).join('')}
          <button class="cam-btn" data-w="fino"><span style="font-size:18px;line-height:1">─</span><span>Fino</span></button><button class="cam-btn on" data-w="grosso"><span style="font-size:22px;line-height:1;font-weight:700">━</span><span>Grosso</span></button></div>
        <div class="mk-group"><button class="cam-btn" data-a="desfazer">${I.undo}<span>Desfazer</span></button><button class="cam-btn" data-a="limpar">${I.trash}<span>Limpar</span></button></div>
      </div>`);
    const cv = o.querySelector('canvas'), stage = o.querySelector('.mk-stage'), ctx = cv.getContext('2d');
    const marcas = []; let tool = 'pen', cor = CORES[0][0], larg = 'grosso', atual = null;
    let pontos = pontosIni.map(p => ({ ...p }));
    pontos.forEach(p => marcas.push({ t: 'pin', cor: p.cor || CORES[0][0], n: p.n, x: p.x, y: p.y }));
    let esc_ = 1;
    const ajustar = () => {
      const r = stage.getBoundingClientRect(), s = Math.min(r.width / img.width, r.height / img.height);
      const dpr = window.devicePixelRatio || 1; esc_ = s;
      cv.style.width = img.width * s + 'px'; cv.style.height = img.height * s + 'px';
      cv.width = Math.round(img.width * s * dpr); cv.height = Math.round(img.height * s * dpr);
      desenhar();
    };
    const lw = (W, m) => (m.w === 'fino' ? 0.004 : 0.009) * W;
    function pintar(c, W, H, lista) {
      c.lineCap = 'round'; c.lineJoin = 'round';
      for (const m of lista) {
        c.strokeStyle = m.cor; c.fillStyle = m.cor; c.lineWidth = lw(W, m);
        c.shadowColor = 'rgba(0,0,0,.45)'; c.shadowBlur = W * 0.004;
        if (m.t === 'pen' && m.pts.length) { c.beginPath(); c.moveTo(m.pts[0][0] * W, m.pts[0][1] * H); m.pts.forEach(p => c.lineTo(p[0] * W, p[1] * H)); c.stroke(); }
        if (m.t === 'arrow' && m.b) { const ax = m.a[0] * W, ay = m.a[1] * H, bx = m.b[0] * W, by = m.b[1] * H, ang = Math.atan2(by - ay, bx - ax), h = W * 0.03;
          c.beginPath(); c.moveTo(ax, ay); c.lineTo(bx, by); c.stroke(); c.beginPath(); c.moveTo(bx, by); c.lineTo(bx - h * Math.cos(ang - .45), by - h * Math.sin(ang - .45)); c.lineTo(bx - h * Math.cos(ang + .45), by - h * Math.sin(ang + .45)); c.closePath(); c.fill(); }
        if (m.t === 'circle' && m.b) { const cx = (m.a[0] + m.b[0]) / 2 * W, cy = (m.a[1] + m.b[1]) / 2 * H, rx = Math.abs(m.b[0] - m.a[0]) / 2 * W, ry = Math.abs(m.b[1] - m.a[1]) / 2 * H; c.beginPath(); c.ellipse(cx, cy, Math.max(rx, 2), Math.max(ry, 2), 0, 0, Math.PI * 2); c.stroke(); }
        if (m.t === 'pin') { const r = W * 0.022, x = m.x * W, y = m.y * H; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); c.shadowBlur = 0;
          c.fillStyle = m.cor === '#ffffff' || m.cor === '#e9cf8f' ? '#1b1812' : '#ffffff'; c.font = `700 ${r * 1.15}px Jost, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(String(m.n), x, y + r * 0.05); }
        c.shadowBlur = 0;
      }
    }
    function desenhar() { const W = cv.width, H = cv.height; ctx.clearRect(0, 0, W, H); ctx.drawImage(img, 0, 0, W, H); pintar(ctx, W, H, atual ? [...marcas, atual] : marcas); }
    const listaPts = () => {
      o.querySelector('.mk-pts').innerHTML = pontos.length ? pontos.map(p => `<label class="mk-pt"><span class="mk-n" style="background:${p.cor}">${p.n}</span><input data-n="${p.n}" value="${esc(p.texto || '')}" placeholder="O que melhorar aqui?"></label>`).join('') : '<p class="faint small" style="margin:0">Nenhum ponto ainda.</p>';
    };
    o.querySelector('.mk-pts').addEventListener('input', e => { const p = pontos.find(x => x.n === Number(e.target.dataset.n)); if (p) p.texto = e.target.value; });
    const pos = e => { const r = cv.getBoundingClientRect(); return [Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), Math.min(1, Math.max(0, (e.clientY - r.top) / r.height))]; };
    cv.addEventListener('pointerdown', e => {
      e.preventDefault(); cv.setPointerCapture(e.pointerId); const p = pos(e);
      if (tool === 'pin') { const n = (pontos.reduce((a, x) => Math.max(a, x.n), 0)) + 1; const m = { t: 'pin', cor, n, x: p[0], y: p[1] }; marcas.push(m); pontos.push({ n, x: p[0], y: p[1], cor, texto: '' }); listaPts(); desenhar();
        setTimeout(() => o.querySelector(`.mk-pts input[data-n="${n}"]`)?.focus({ preventScroll: false }), 50); return; }
      atual = tool === 'pen' ? { t: 'pen', cor, w: larg, pts: [p] } : { t: tool, cor, w: larg, a: p, b: p }; desenhar();
    });
    cv.addEventListener('pointermove', e => { if (!atual) return; const p = pos(e); if (atual.t === 'pen') atual.pts.push(p); else atual.b = p; desenhar(); });
    const soltar = () => { if (atual) { marcas.push(atual); atual = null; desenhar(); } };
    cv.addEventListener('pointerup', soltar); cv.addEventListener('pointercancel', soltar);
    o.querySelector('.mk-tools').addEventListener('click', e => {
      const t = e.target.closest('[data-tool]'), c = e.target.closest('[data-cor]'), w = e.target.closest('[data-w]'), a = e.target.closest('[data-a]')?.dataset.a;
      if (t) { tool = t.dataset.tool; o.querySelectorAll('[data-tool]').forEach(x => x.classList.toggle('on', x === t)); }
      if (c) { cor = c.dataset.cor; o.querySelectorAll('[data-cor]').forEach(x => x.classList.toggle('on', x === c)); }
      if (w) { larg = w.dataset.w; o.querySelectorAll('[data-w]').forEach(x => x.classList.toggle('on', x === w)); }
      if (a === 'desfazer') { const m = marcas.pop(); if (m?.t === 'pin') { pontos = pontos.filter(p => p.n !== m.n); listaPts(); } desenhar(); }
      if (a === 'limpar') { marcas.length = 0; pontos = []; listaPts(); desenhar(); }
    });
    o.querySelector('.mk-top').addEventListener('click', e => {
      const a = e.target.closest('[data-a]')?.dataset.a;
      if (a === 'cancelar') { removeEventListener('resize', ajustar); close(); resolve(null); }
      if (a === 'ok') {
        const max = 2000, s = Math.min(1, max / Math.max(img.width, img.height));
        const out = document.createElement('canvas'); out.width = Math.round(img.width * s); out.height = Math.round(img.height * s);
        const oc = out.getContext('2d'); oc.drawImage(img, 0, 0, out.width, out.height); pintar(oc, out.width, out.height, marcas);
        const orig = document.createElement('canvas'); orig.width = out.width; orig.height = out.height; orig.getContext('2d').drawImage(img, 0, 0, out.width, out.height);
        out.toBlob(b => orig.toBlob(bo => { removeEventListener('resize', ajustar); close(); resolve({ blob: b, original: bo, pontos, marcou: marcas.length > 0 }); }, 'image/jpeg', 0.88), 'image/jpeg', 0.88);
      }
    });
    addEventListener('resize', ajustar);
    listaPts(); requestAnimationFrame(ajustar);
  });
}
