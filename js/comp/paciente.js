// Cadastro de paciente e anamnese
import { sb, q, invalidarPacientes } from '../db.js';
import { $, $$, esc, openSheet, closeSheet, toast, fail, formData, maskCPF, maskTel, maskCEP, opt, busy, fd } from '../ui.js';

const ORIGENS = ['Instagram', 'Indicação', 'Google', 'WhatsApp', 'Passou na porta', 'Retorno', 'Outro'];

export function formPaciente(p = {}, onSaved) {
  const novo = !p.id;
  const b = openSheet({ eyebrow: novo ? 'Novo cadastro' : 'Editar cadastro', title: novo ? 'Nova paciente' : p.nome, body: `
    <form id="pacForm" class="stack" novalidate>
      <div class="panel"><div class="fields">
        <label class="field w2"><span>Nome completo *</span><input name="nome" required value="${esc(p.nome)}" autocomplete="off"></label>
        <label class="field"><span>CPF</span><input name="cpf" inputmode="numeric" value="${esc(p.cpf)}" data-mask="cpf"></label>
        <label class="field"><span>Nascimento</span><input name="nascimento" type="date" value="${esc(p.nascimento)}"></label>
        <label class="field"><span>WhatsApp *</span><input name="telefone" inputmode="tel" value="${esc(p.telefone)}" data-mask="tel" required></label>
        <label class="field"><span>E-mail</span><input name="email" type="email" value="${esc(p.email)}"></label>
        <label class="field"><span>Sexo</span><select name="sexo">${opt('', '—', p.sexo)}${opt('Feminino', null, p.sexo)}${opt('Masculino', null, p.sexo)}${opt('Outro', null, p.sexo)}</select></label>
        <label class="field"><span>Profissão</span><input name="profissao" value="${esc(p.profissao)}"></label>
        <label class="field w2"><span>Endereço</span><input name="endereco" value="${esc(p.endereco)}" placeholder="Rua, número, complemento"></label>
        <label class="field"><span>Bairro</span><input name="bairro" value="${esc(p.bairro)}"></label>
        <label class="field"><span>Cidade</span><input name="cidade" value="${esc(p.cidade ?? 'Fortaleza')}"></label>
        <label class="field"><span>CEP</span><input name="cep" inputmode="numeric" value="${esc(p.cep)}" data-mask="cep"></label>
        <label class="field"><span>Como conheceu</span><select name="origem">${opt('', '—', p.origem)}${ORIGENS.map(o => opt(o, null, p.origem)).join('')}</select></label>
        <label class="field full"><span>Observações</span><textarea name="observacoes">${esc(p.observacoes)}</textarea></label>
        <label class="check field full"><input type="checkbox" name="uso_imagem" ${p.uso_imagem ? 'checked' : ''}> Autoriza uso de imagem (fotos em redes sociais e divulgação)</label>
        ${novo ? '' : `<label class="check field full"><input type="checkbox" name="ativo" ${p.ativo !== false ? 'checked' : ''}> Paciente ativa</label>`}
      </div></div>
      <div class="btns end"><button type="button" class="btn" data-cancel>Cancelar</button><button class="btn gold" id="pacSave">${novo ? 'Cadastrar paciente' : 'Salvar alterações'}</button></div>
    </form>` });
  $$('[data-mask]', b).forEach(i => i.addEventListener('input', () => {
    const f = { cpf: maskCPF, tel: maskTel, cep: maskCEP }[i.dataset.mask]; const v = f(i.value); if (v !== i.value) i.value = v;
  }));
  $('[data-cancel]', b).onclick = closeSheet;
  $('#pacForm', b).onsubmit = async e => {
    e.preventDefault();
    const d = formData($('#pacForm', b));
    if (!d.nome) { toast('Informe o nome da paciente.', true); return; }
    if (!d.telefone) { toast('Informe o WhatsApp: ele é usado no pós-venda.', true); return; }
    await busy($('#pacSave', b), async () => {
      try {
        const row = novo ? await q(sb.from('pacientes').insert(d).select().single())
                         : await q(sb.from('pacientes').update(d).eq('id', p.id).select().single());
        invalidarPacientes(); closeSheet(); toast(novo ? 'Paciente cadastrada.' : 'Cadastro atualizado.');
        onSaved && onSaved(row);
      } catch (err) { fail(err); }
    });
  };
}

// ---------- anamnese ----------
export const ANAMNESE = [
  { k: 'queixa', t: 'Queixa principal', tipo: 'texto' },
  { k: 'objetivo', t: 'O que deseja melhorar / expectativa', tipo: 'texto' },
  { k: 'alergias', t: 'Possui alergias (medicamentos, anestésicos, cosméticos, alimentos)?', tipo: 'sn' },
  { k: 'medicamentos', t: 'Usa algum medicamento contínuo?', tipo: 'sn' },
  { k: 'anticoagulante', t: 'Usa anticoagulante, AAS, anti-inflamatório ou suplementos (ômega 3, ginkgo, vitamina E)?', tipo: 'sn' },
  { k: 'gestante', t: 'Está grávida, amamentando ou planejando engravidar?', tipo: 'sn' },
  { k: 'autoimune', t: 'Tem doença autoimune, neuromuscular (ex.: miastenia) ou alteração de coagulação?', tipo: 'sn' },
  { k: 'cronicas', t: 'Diabetes, hipertensão, problemas cardíacos, renais ou hepáticos?', tipo: 'sn' },
  { k: 'herpes', t: 'Tem herpes labial recorrente?', tipo: 'sn' },
  { k: 'queloide', t: 'Tem tendência a queloide ou cicatrização difícil?', tipo: 'sn' },
  { k: 'infeccao', t: 'Está com infecção, inflamação ou lesão na região a tratar?', tipo: 'sn' },
  { k: 'isotretinoina', t: 'Usou isotretinoína (Roacutan) nos últimos 6 meses ou usa ácidos na pele?', tipo: 'sn' },
  { k: 'procedimentos', t: 'Já fez procedimentos estéticos (toxina, preenchimento, fios, PMMA, silicone, bioestimulador)?', tipo: 'sn' },
  { k: 'cirurgias', t: 'Cirurgias plásticas ou faciais recentes?', tipo: 'sn' },
  { k: 'tabagismo', t: 'Fuma ou consome bebida alcoólica com frequência?', tipo: 'sn' },
  { k: 'sol', t: 'Exposição solar frequente / usa protetor diariamente?', tipo: 'texto' },
  { k: 'fototipo', t: 'Fototipo (Fitzpatrick)', tipo: 'opcoes', op: ['I', 'II', 'III', 'IV', 'V', 'VI'] },
  { k: 'pele', t: 'Tipo de pele', tipo: 'opcoes', op: ['Normal', 'Seca', 'Oleosa', 'Mista', 'Sensível', 'Acneica'] },
  { k: 'obs', t: 'Observações da profissional', tipo: 'texto' },
];

export function alertasAnamnese(r = {}) {
  const lista = [];
  const add = (k, rot) => { if (r[k] === 'sim') lista.push(rot + (r[k + '_d'] ? ': ' + r[k + '_d'] : '')); };
  add('alergias', 'Alergia'); add('anticoagulante', 'Anticoagulante/suplemento'); add('gestante', 'Gestação/amamentação');
  add('autoimune', 'Doença autoimune/neuromuscular'); add('herpes', 'Herpes recorrente'); add('queloide', 'Queloide');
  add('infeccao', 'Infecção na região'); add('isotretinoina', 'Isotretinoína/ácidos');
  return lista;
}

export function formAnamnese(paciente, anterior, onSaved) {
  const r = anterior?.respostas || {};
  const campo = c => {
    if (c.tipo === 'texto') return `<label class="field full"><span>${c.t}</span><textarea data-k="${c.k}" rows="2">${esc(r[c.k])}</textarea></label>`;
    if (c.tipo === 'opcoes') return `<label class="field"><span>${c.t}</span><select data-k="${c.k}">${opt('', '—', r[c.k])}${c.op.map(o => opt(o, null, r[c.k])).join('')}</select></label>`;
    return `<div class="field full" style="border-bottom:1px solid var(--line-soft);padding-bottom:12px">
      <div style="display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap"><span style="font-size:14px;letter-spacing:0;text-transform:none;color:var(--text)">${c.t}</span>
      <span class="seg" data-sn="${c.k}"><button type="button" aria-pressed="${r[c.k] === 'sim'}">Sim</button><button type="button" aria-pressed="${r[c.k] === 'nao'}">Não</button></span></div>
      <input data-k="${c.k}_d" placeholder="Detalhes (qual, quando, quanto)" value="${esc(r[c.k + '_d'])}" ${r[c.k] === 'sim' ? '' : 'hidden'}></div>`;
  };
  const b = openSheet({ eyebrow: anterior ? 'Atualizar anamnese · a anterior fica no histórico' : 'Anamnese', title: paciente.nome, body: `
    ${anterior ? `<p class="hint" style="margin-top:-8px">Última versão em ${fd(anterior.criado_em)}. As respostas já vêm preenchidas para confirmar com a paciente.</p>` : ''}
    <div class="panel"><div class="fields f2">${ANAMNESE.map(campo).join('')}</div></div>
    <div class="btns end" style="margin-top:16px"><button class="btn" data-cancel>Cancelar</button><button class="btn gold" id="anSave">Salvar anamnese</button></div>` });
  $$('[data-sn]', b).forEach(s => s.addEventListener('click', e => {
    const btn = e.target.closest('button'); if (!btn) return;
    $$('button', s).forEach(x => x.setAttribute('aria-pressed', x === btn));
    const det = $(`[data-k="${s.dataset.sn}_d"]`, b); det.hidden = btn.textContent !== 'Sim'; if (!det.hidden) det.focus();
  }));
  $('[data-cancel]', b).onclick = closeSheet;
  $('#anSave', b).onclick = async e => {
    const resp = {};
    $$('[data-k]', b).forEach(i => { if (i.value.trim() && !i.hidden) resp[i.dataset.k] = i.value.trim(); });
    $$('[data-sn]', b).forEach(s => { const on = $('[aria-pressed="true"]', s); if (on) resp[s.dataset.sn] = on.textContent === 'Sim' ? 'sim' : 'nao'; });
    await busy(e.currentTarget, async () => {
      try {
        await q(sb.from('anamneses').insert({ paciente_id: paciente.id, respostas: resp }));
        closeSheet(); toast('Anamnese salva no prontuário.'); onSaved && onSaved();
      } catch (err) { fail(err); }
    });
  };
}

// Seletor de paciente com busca (retorna id)
export function seletorPaciente(lista, selecionado, name = 'paciente_id') {
  return `<select name="${name}" required>${opt('', 'Selecione a paciente', selecionado)}${lista.filter(p => p.ativo !== false || p.id === selecionado).map(p => opt(p.id, p.nome, selecionado)).join('')}</select>`;
}
