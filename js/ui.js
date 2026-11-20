// Utilidades de interface e formatação
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const MES = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
export const MES_C = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
export const SEM = ['domingo','segunda-feira','terça-feira','quarta-feira','quinta-feira','sexta-feira','sábado'];
export const SEM_C = ['dom','seg','ter','qua','qui','sex','sáb'];

export const brl = (n, dec) => 'R$ ' + Number(n || 0).toLocaleString('pt-BR', { minimumFractionDigits: dec ?? (Number(n) % 1 ? 2 : 0), maximumFractionDigits: 2 });
export const nfmt = n => Number(n || 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 });
export const pct = n => (isFinite(n) ? Math.round(n * 1000) / 10 : 0).toLocaleString('pt-BR') + '%';

// Datas: "YYYY-MM-DD" sempre em horário local
export const iso = d => { const x = d instanceof Date ? d : new Date(d); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; };
export const parseD = s => { if (!s) return null; if (s instanceof Date) return s; if (/^\d{4}-\d{2}-\d{2}$/.test(s)) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); } return new Date(s); };
export const today = () => { const t = new Date(); t.setHours(0, 0, 0, 0); return t; };
export const addDays = (d, n) => { const x = new Date(parseD(d)); x.setDate(x.getDate() + n); return x; };
export const daysBetween = (a, b) => Math.round((parseD(b) - parseD(a)) / 864e5);
export const fd = s => { const x = parseD(s); if (!x || isNaN(x)) return '—'; return `${String(x.getDate()).padStart(2, '0')}/${String(x.getMonth() + 1).padStart(2, '0')}/${x.getFullYear()}`; };
export const fdc = s => fd(s).slice(0, 5);
export const fh = s => { const x = parseD(s); return `${String(x.getHours()).padStart(2, '0')}h${String(x.getMinutes()).padStart(2, '0')}`; };
export const fdt = s => fd(s) + ' às ' + fh(s);
export const longDate = d => { const x = parseD(d); return `${SEM[x.getDay()]}, ${x.getDate()} de ${MES[x.getMonth()]}`; };
export const age = s => { if (!s) return null; const b = parseD(s), t = today(); let a = t.getFullYear() - b.getFullYear(); if (t < new Date(t.getFullYear(), b.getMonth(), b.getDate())) a--; return a; };
export const localInput = d => { const x = parseD(d); return `${iso(x)}T${String(x.getHours()).padStart(2, '0')}:${String(x.getMinutes()).padStart(2, '0')}`; };

export const ini = n => String(n || '?').split(' ').filter(w => w.length > 2 || w === w.toUpperCase()).filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase() || '?';
export const first = n => String(n || '').split(' ')[0];
export const digits = s => String(s || '').replace(/\D/g, '');
export const waLink = (tel, msg) => { let d = digits(tel); if (d.length <= 11) d = '55' + d; return `https://wa.me/${d}?text=${encodeURIComponent(msg)}`; };
export const maskCPF = v => digits(v).slice(0, 11).replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2');
export const maskTel = v => { const d = digits(v).slice(0, 11); return d.length > 10 ? d.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3') : d.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3').replace(/-$/, ''); };
export const maskCEP = v => digits(v).slice(0, 8).replace(/(\d{5})(\d)/, '$1-$2');

export function toast(t, err) {
  const el = $('#toast'); el.textContent = t; el.classList.toggle('err', !!err); el.classList.add('on');
  clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove('on'), err ? 4500 : 2600);
}
export function fail(e) { console.error(e); toast(traduzErro(e), true); }
export function traduzErro(e) {
  const m = String(e?.message || e || '');
  if (/Failed to fetch|NetworkError|network/i.test(m)) return 'Sem conexão com a internet. Confira o Wi-Fi e tente de novo.';
  if (/JWT|session|not authenticated/i.test(m)) return 'Sua sessão expirou. Entre de novo.';
  if (/row-level security|permission denied/i.test(m)) return 'Esta conta não tem permissão para isso.';
  if (/violates foreign key|still referenced/i.test(m)) return 'Não dá para apagar: este registro está ligado a outros (atendimentos, vendas ou estoque).';
  if (/Invalid login credentials/i.test(m)) return 'E-mail ou senha incorretos.';
  if (/Email not confirmed/i.test(m)) return 'Confirme seu e-mail pelo link que enviamos antes de entrar.';
  if (/Password should be/i.test(m)) return 'A senha precisa ter pelo menos 8 caracteres.';
  if (/already registered/i.test(m)) return 'Este e-mail já tem cadastro. Use "Entrar".';
  return 'Não foi possível concluir: ' + m;
}

// Folha lateral
let sheetClose = null;
export function openSheet({ eyebrow = '', title = '', body = '', wide = false, onClose } = {}) {
  $('#sheetEyebrow').textContent = eyebrow; $('#sheetTitle').textContent = title;
  const b = $('#sheetBody'); if (typeof body === 'string') b.innerHTML = body; else { b.innerHTML = ''; b.append(body); }
  $('#sheet').classList.toggle('wide', wide);
  $('#sheet').hidden = false; $('#sheetBg').hidden = false; $('#sheet').scrollTop = 0;
  document.body.style.overflow = 'hidden'; sheetClose = onClose || null;
  return b;
}
export function closeSheet() {
  $('#sheet').hidden = true; $('#sheetBg').hidden = true; document.body.style.overflow = '';
  const f = sheetClose; sheetClose = null; f && f();
}
export const sheetOpen = () => !$('#sheet').hidden;

// Confirmação dentro da página
export function confirmar(titulo, texto, ok = 'Confirmar', perigo = false) {
  return new Promise(res => {
    const bg = document.createElement('div'); bg.className = 'modal-bg';
    bg.innerHTML = `<div class="modal" role="alertdialog" aria-modal="true"><h2>${esc(titulo)}</h2><p>${esc(texto)}</p><div class="btns end"><button class="btn" data-r="0">Voltar</button><button class="btn ${perigo ? 'danger' : 'gold'}" data-r="1">${esc(ok)}</button></div></div>`;
    bg.addEventListener('click', e => { const b = e.target.closest('[data-r]'); if (b || e.target === bg) { bg.remove(); res(b?.dataset.r === '1'); } });
    document.body.append(bg); bg.querySelector('[data-r="1"]').focus();
  });
}

export function lightbox(src, legenda = '') {
  const bg = document.createElement('div'); bg.className = 'lightbox';
  bg.innerHTML = `<button class="x" aria-label="Fechar">×</button><figure style="margin:0;text-align:center"><img src="${esc(src)}" alt=""><figcaption class="small muted" style="margin-top:8px">${esc(legenda)}</figcaption></figure>`;
  bg.addEventListener('click', e => { if (e.target === bg || e.target.closest('.x')) bg.remove(); });
  document.body.append(bg);
}

export async function copiar(texto, el) {
  try { await navigator.clipboard.writeText(texto); toast('Mensagem copiada.'); }
  catch { if (el) { el.select?.(); } toast('Selecione o texto e copie pelo menu do aparelho.'); }
}

export const busy = async (btn, fn) => {
  if (btn) { btn.disabled = true; btn.dataset.lbl = btn.innerHTML; btn.innerHTML = 'Salvando…'; }
  try { return await fn(); } finally { if (btn) { btn.disabled = false; btn.innerHTML = btn.dataset.lbl; } }
};

export const icon = {
  plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
  back: '<svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg>',
  next: '<svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg>',
  wa: '<svg viewBox="0 0 24 24"><path d="M4 20l1.3-3.9A8 8 0 1 1 8 19z"/></svg>',
  cam: '<svg viewBox="0 0 24 24"><path d="M3 8h4l2-3h6l2 3h4v11H3z"/><circle cx="12" cy="13" r="4"/></svg>',
  doc: '<svg viewBox="0 0 24 24"><path d="M6 2h9l5 5v15H6z"/><path d="M14 2v6h6M9 13h8M9 17h6"/></svg>',
  edit: '<svg viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16z"/></svg>',
  dl: '<svg viewBox="0 0 24 24"><path d="M12 3v12M7 10l5 5 5-5M4 21h16"/></svg>',
};

// Formulário: lê valores [name] de um container
export function formData(root) {
  const o = {};
  $$('[name]', root).forEach(el => {
    if (el.type === 'checkbox') o[el.name] = el.checked;
    else if (el.type === 'number') o[el.name] = el.value === '' ? null : Number(el.value);
    else o[el.name] = el.value.trim() === '' ? null : el.value.trim();
  });
  return o;
}
export const opt = (v, label, sel) => `<option value="${esc(v)}" ${String(v) === String(sel) ? 'selected' : ''}>${esc(label ?? v)}</option>`;
export const kpi = (titulo, valor, detalhe = '', lead = false) => `<div class="kpi${lead ? ' lead' : ''}"><h3>${titulo}</h3><div class="v num">${valor}</div><div class="d">${detalhe}</div></div>`;
export const money = n => `${Number(n) < 0 ? '−' : ''}<small>R$</small>${Math.abs(Number(n || 0)).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`;
export const empty = (t, s = '') => `<div class="empty"><b>${t}</b>${s}</div>`;
