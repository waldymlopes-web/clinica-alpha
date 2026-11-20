// Banco de imagens de antes e depois, por procedimento
import { cache } from '../db.js';
import { $, $$, esc, opt } from '../ui.js';
import { galeria } from '../comp/fotos.js';

let proc = '';
export async function render(el) {
  el.innerHTML = `<div class="head"><div><div class="eyebrow">Banco de imagens</div><h1>Antes <em>e depois</em></h1><p class="sub">Todas as fotos dos prontuários, por procedimento. Escolha duas para comparar. Fotos de pacientes sem autorização de imagem aparecem marcadas.</p></div></div>
    <div class="tabs"><button aria-pressed="${!proc}" data-p="">Todos</button>${cache.procs.map(p => `<button aria-pressed="${proc === p.id}" data-p="${p.id}">${esc(p.nome)}</button>`).join('')}</div>
    <div class="panel" id="gal"></div>`;
  $$('[data-p]', el).forEach(b => b.onclick = () => { proc = b.dataset.p; render(el); });
  await galeria($('#gal', el), { procedimentoId: proc || null });
}
