// Fotos de antes e depois: envio, galeria e comparação
import { sb, q, cache, procById, signedUrls } from '../db.js?v=202611220013';
import { $, $$, esc, openSheet, closeSheet, toast, fail, opt, iso, fd, busy, lightbox, empty, icon } from '../ui.js?v=202611220013';

export const ANGULOS = ['Frente', 'Perfil direito', 'Perfil esquerdo', '45° direito', '45° esquerdo', 'Detalhe'];
export const MOMENTOS = { antes: 'Antes', depois: 'Depois', retorno: 'Retorno', avaliacao: 'Avaliação' };

// Reduz a foto para no máximo 2000px, JPEG 0,85
async function comprimir(file) {
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }).catch(() => null);
  let img = bmp;
  if (!img) { img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = URL.createObjectURL(file); }); }
  const max = 2000, w = img.width, h = img.height, s = Math.min(1, max / Math.max(w, h));
  const c = document.createElement('canvas'); c.width = Math.round(w * s); c.height = Math.round(h * s);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  return await new Promise(r => c.toBlob(r, 'image/jpeg', 0.85));
}

export function enviarFotos({ paciente, atendimento = null, procedimento_id = null, momento = 'antes', onDone } = {}) {
  const arquivos = [];
  const procs = cache.procs;
  const b = openSheet({ eyebrow: 'Antes e depois', title: 'Adicionar fotos · ' + paciente.nome.split(' ')[0], body: `
    <div class="panel stack">
      <div class="fields">
        <label class="field w2"><span>Procedimento</span><select id="ftProc">${opt('', '—', procedimento_id)}${procs.map(p => opt(p.id, p.nome, procedimento_id)).join('')}</select></label>
        <label class="field"><span>Momento</span><select id="ftMom">${Object.entries(MOMENTOS).filter(([k]) => k !== 'avaliacao').map(([k, v]) => opt(k, v, momento)).join('')}</select></label>
        <label class="field"><span>Data</span><input type="date" id="ftData" value="${atendimento ? iso(atendimento.data) : iso(new Date())}"></label>
        <label class="field w2"><span>Área</span><input id="ftArea" list="ftAreas" placeholder="ex.: Lábios"><datalist id="ftAreas"></datalist></label>
      </div>
      <div class="drop">
        <div class="btns" style="justify-content:center">
          <label class="btn gold">${icon.cam}Tirar foto<input type="file" accept="image/*" capture="environment" id="ftCam" hidden multiple></label>
          <label class="btn">Escolher da galeria<input type="file" accept="image/*" id="ftGal" hidden multiple></label>
        </div>
        <p class="hint" style="margin:10px 0 0">Mesma luz, mesma distância e fundo neutro em todas as fotos deixam a comparação fiel.</p>
      </div>
      <div id="ftList" class="stack"></div>
    </div>
    <div class="btns end" style="margin-top:16px"><button class="btn" data-cancel>Cancelar</button><button class="btn gold" id="ftSave" disabled>Salvar fotos</button></div>` });
  const areas = () => { const p = procById($('#ftProc', b).value); $('#ftAreas', b).innerHTML = (p?.areas || []).map(a => `<option value="${esc(a)}">`).join(''); };
  $('#ftProc', b).onchange = areas; areas();
  const lista = () => {
    $('#ftList', b).innerHTML = arquivos.map((a, i) => `<div style="display:grid;grid-template-columns:90px minmax(0,1fr) 44px;gap:12px;align-items:center">
      <img src="${a.url}" alt="" style="width:90px;aspect-ratio:3/4;object-fit:cover;border:1px solid var(--line-soft)">
      <label class="field"><span>Ângulo</span><select data-ang="${i}">${ANGULOS.map(x => opt(x, null, a.angulo)).join('')}</select></label>
      <button class="btn icon" data-rm="${i}" aria-label="Remover foto">×</button></div>`).join('');
    $('#ftSave', b).disabled = !arquivos.length;
    $('#ftSave', b).textContent = arquivos.length ? `Salvar ${arquivos.length} foto${arquivos.length > 1 ? 's' : ''}` : 'Salvar fotos';
  };
  const add = e => { [...e.target.files].forEach((f, k) => arquivos.push({ file: f, url: URL.createObjectURL(f), angulo: ANGULOS[(arquivos.length) % 5] })); e.target.value = ''; lista(); };
  $('#ftCam', b).onchange = add; $('#ftGal', b).onchange = add;
  $('#ftList', b).addEventListener('change', e => { if (e.target.dataset.ang) arquivos[+e.target.dataset.ang].angulo = e.target.value; });
  $('#ftList', b).addEventListener('click', e => { const r = e.target.closest('[data-rm]'); if (r) { arquivos.splice(+r.dataset.rm, 1); lista(); } });
  $('[data-cancel]', b).onclick = closeSheet;
  $('#ftSave', b).onclick = async e => {
    await busy(e.currentTarget, async () => {
      try {
        const rows = [];
        for (const a of arquivos) {
          const blob = await comprimir(a.file);
          const path = `${paciente.id}/${crypto.randomUUID()}.jpg`;
          const { error } = await sb.storage.from('fotos').upload(path, blob, { contentType: 'image/jpeg' });
          if (error) throw error;
          rows.push({ paciente_id: paciente.id, atendimento_id: atendimento?.id || null, procedimento_id: $('#ftProc', b).value || null,
            area: $('#ftArea', b).value.trim() || null, angulo: a.angulo, momento: $('#ftMom', b).value, caminho: path, tirada_em: $('#ftData', b).value || iso(new Date()) });
        }
        await q(sb.from('fotos').insert(rows));
        closeSheet(); toast(`${rows.length} foto${rows.length > 1 ? 's salvas' : ' salva'} no prontuário.`); onDone && onDone();
      } catch (err) { fail(err); }
    });
  };
}

// Galeria com seleção para comparar
export async function galeria(el, { pacienteId = null, procedimentoId = null, paciente = null, uso = false } = {}) {
  let query = sb.from('fotos').select('*, pacientes(nome,uso_imagem)').order('tirada_em', { ascending: false }).order('criado_em', { ascending: false }).limit(300);
  if (pacienteId) query = query.eq('paciente_id', pacienteId);
  if (procedimentoId) query = query.eq('procedimento_id', procedimentoId);
  const fotos = await q(query);
  if (!fotos.length) { el.innerHTML = empty('Nenhuma foto ainda', paciente ? 'Toque em "Adicionar fotos" para registrar o antes.' : 'As fotos aparecem aqui quando forem adicionadas nos prontuários.'); return; }
  const urls = await signedUrls('fotos', fotos.map(f => f.caminho));
  const sel = [];
  el.innerHTML = `<div class="btns" style="margin-bottom:12px"><span class="hint" id="cmpHint">Toque em duas fotos para comparar lado a lado.</span><button class="btn sm gold" id="cmpBtn" hidden>Comparar</button></div>
    <div class="photo-grid">${fotos.map(f => `<button class="photo" data-id="${f.id}" aria-pressed="false">
      <img src="${urls[f.caminho]}" alt="${esc(MOMENTOS[f.momento])} · ${esc(f.area || '')}" loading="lazy">
      <span class="tag chip ${f.momento === 'antes' ? 'mute' : 'ok'}" style="background:rgba(0,0,0,.6)">${MOMENTOS[f.momento]}</span>
      <span class="cap"><b>${esc(procById(f.procedimento_id)?.nome || 'Sem procedimento')}</b>${!pacienteId ? esc(f.pacientes?.nome || '') + ' · ' : ''}${esc(f.area || '')}${f.area ? ' · ' : ''}${esc(f.angulo || '')}<br>${fd(f.tirada_em)}${!pacienteId && !f.pacientes?.uso_imagem ? ' · <span class="bad-t">sem autorização de imagem</span>' : ''}</span>
    </button>`).join('')}</div>`;
  const btn = $('#cmpBtn', el);
  el.querySelector('.photo-grid').addEventListener('click', e => {
    const p = e.target.closest('.photo'); if (!p) return;
    const id = p.dataset.id, i = sel.indexOf(id);
    if (i >= 0) sel.splice(i, 1); else { sel.push(id); if (sel.length > 2) sel.shift(); }
    $$('.photo', el).forEach(x => x.setAttribute('aria-pressed', sel.includes(x.dataset.id)));
    btn.hidden = sel.length !== 2;
    if (sel.length === 0) { const f = fotos.find(x => x.id === id); }
  });
  el.querySelector('.photo-grid').addEventListener('dblclick', e => {
    const p = e.target.closest('.photo'); if (!p) return; const f = fotos.find(x => x.id === p.dataset.id);
    lightbox(urls[f.caminho], `${MOMENTOS[f.momento]} · ${f.area || ''} · ${fd(f.tirada_em)}`);
  });
  btn.onclick = () => {
    const [a, b2] = sel.map(id => fotos.find(f => f.id === id)).sort((x, y) => x.tirada_em.localeCompare(y.tirada_em));
    comparar(a, b2, urls);
  };
}

export function comparar(a, b2, urls) {
  const dias = Math.round((new Date(b2.tirada_em) - new Date(a.tirada_em)) / 864e5);
  const body = openSheet({ eyebrow: 'Comparação', title: `${fd(a.tirada_em)} → ${fd(b2.tirada_em)}`, wide: true, body: `
    <div class="tabs"><button aria-pressed="true" data-m="slide">Deslizar</button><button aria-pressed="false" data-m="lado">Lado a lado</button></div>
    <div id="cmpArea"></div>
    <p class="hint" style="text-align:center;margin-top:12px">${dias} dias entre as fotos · ${esc(procById(a.procedimento_id)?.nome || '')} ${a.area ? '· ' + esc(a.area) : ''}</p>` });
  const area = $('#cmpArea', body);
  const slide = () => {
    area.innerHTML = `<div class="compare"><img src="${urls[a.caminho]}" alt="Antes"><img class="after" src="${urls[b2.caminho]}" alt="Depois"><div class="handle"></div><span class="lb" style="left:10px">${fd(a.tirada_em)}</span><span class="lb" style="right:10px">${fd(b2.tirada_em)}</span></div>`;
    const box = $('.compare', area), after = $('.after', area), h = $('.handle', area);
    const mv = x => { const r = box.getBoundingClientRect(); const p = Math.max(0, Math.min(1, (x - r.left) / r.width)) * 100; after.style.clipPath = `inset(0 0 0 ${p}%)`; h.style.left = p + '%'; };
    let drag = false;
    box.onpointerdown = e => { drag = true; box.setPointerCapture(e.pointerId); mv(e.clientX); };
    box.onpointermove = e => drag && mv(e.clientX);
    box.onpointerup = box.onpointercancel = () => drag = false;
  };
  const lado = () => { area.innerHTML = `<div class="side-by-side"><figure><img src="${urls[a.caminho]}" alt=""><figcaption>${MOMENTOS[a.momento]} · ${fd(a.tirada_em)}</figcaption></figure><figure><img src="${urls[b2.caminho]}" alt=""><figcaption>${MOMENTOS[b2.momento]} · ${fd(b2.tirada_em)}</figcaption></figure></div>`; };
  $$('[data-m]', body).forEach(t => t.onclick = () => { $$('[data-m]', body).forEach(x => x.setAttribute('aria-pressed', x === t)); t.dataset.m === 'slide' ? slide() : lado(); });
  slide();
}
