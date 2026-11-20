// Criar e editar agendamentos
import { sb, q, procsAtivos, procById, pacientesLeves, cache } from '../db.js';
import { $, esc, openSheet, closeSheet, toast, fail, opt, localInput, busy, fdt, waLink, first, confirmar, icon } from '../ui.js';
import { seletorPaciente, formPaciente } from './paciente.js';
import { registrarAtendimento } from './atendimento.js';

export const STATUS_AG = { agendado: 'Agendado', confirmado: 'Confirmado', realizado: 'Realizado', faltou: 'Faltou', cancelado: 'Cancelado' };

export async function agendar({ ag = null, paciente_id = null, procedimento_id = null, inicio = null, venda_id = null, onSaved } = {}) {
  const pacs = await pacientesLeves();
  const a = ag || { paciente_id, procedimento_id, venda_id, inicio: inicio || proximoHorario(), duracao_min: procById(procedimento_id)?.duracao_min || 60, status: 'agendado' };
  const novo = !a.id;
  const pac = pacs.find(p => p.id === a.paciente_id);
  const b = openSheet({ eyebrow: novo ? 'Novo horário' : STATUS_AG[a.status], title: novo ? 'Agendar' : (pac?.nome || 'Agendamento'), body: `
    <form class="stack" id="agForm">
      <div class="panel"><div class="fields f2">
        <div class="field full"><span>Paciente *</span><div style="display:flex;gap:8px">${seletorPaciente(pacs, a.paciente_id)}<button type="button" class="btn icon" id="agNovaPac" title="Nova paciente" aria-label="Cadastrar nova paciente">${icon.plus}</button></div></div>
        <label class="field full"><span>Procedimento</span><select name="procedimento_id">${opt('', 'Avaliação / outro', a.procedimento_id)}${procsAtivos().map(p => opt(p.id, p.nome, a.procedimento_id)).join('')}</select></label>
        <label class="field"><span>Data e hora *</span><input type="datetime-local" name="inicio" value="${localInput(a.inicio)}" required step="900"></label>
        <label class="field"><span>Duração (min)</span><input type="number" name="duracao_min" min="15" step="15" value="${a.duracao_min}"></label>
        ${novo ? '' : `<label class="field"><span>Situação</span><select name="status">${Object.entries(STATUS_AG).map(([k, v]) => opt(k, v, a.status)).join('')}</select></label>`}
        <label class="field full"><span>Observações</span><textarea name="observacoes" rows="2">${esc(a.observacoes)}</textarea></label>
      </div></div>
      <div class="btns end">
        ${novo ? '' : `<button type="button" class="btn danger" id="agDel">Excluir</button><span style="flex:1"></span>`}
        ${!novo && pac ? `<a class="btn" target="_blank" rel="noopener" href="${waLink(pac.telefone, `Oi, ${first(pac.nome)}! Confirmando seu horário na ${cache.config.clinica || 'Clínica Alpha'}: ${fdt(a.inicio)}${a.procedimento_id ? ' · ' + procById(a.procedimento_id)?.nome : ''}. Posso confirmar? ✨`)}">${icon.wa}Confirmar pelo WhatsApp</a>` : ''}
        ${!novo && a.status !== 'realizado' && pac ? `<button type="button" class="btn" id="agAtender">Registrar atendimento</button>` : ''}
        <button class="btn gold" id="agSave">${novo ? 'Agendar' : 'Salvar'}</button>
      </div>
    </form>` });
  const form = $('#agForm', b);
  form.procedimento_id.onchange = () => { const p = procById(form.procedimento_id.value); if (p && novo) form.duracao_min.value = p.duracao_min; };
  $('#agNovaPac', b).onclick = () => formPaciente({}, p => agendar({ ...arguments[0], ag: { ...a, paciente_id: p.id, inicio: new Date(form.inicio.value).toISOString() } }));
  form.onsubmit = async e => {
    e.preventDefault();
    const d = { paciente_id: form.paciente_id.value, procedimento_id: form.procedimento_id.value || null, inicio: new Date(form.inicio.value).toISOString(), duracao_min: Number(form.duracao_min.value) || 60, observacoes: form.observacoes.value.trim() || null, venda_id: a.venda_id || null };
    if (!novo) d.status = form.status.value;
    if (!d.paciente_id) { toast('Escolha a paciente.', true); return; }
    // conflito de horário
    const ini = new Date(d.inicio), fim = new Date(ini.getTime() + d.duracao_min * 60000);
    const dia0 = new Date(ini); dia0.setHours(0, 0, 0, 0); const dia1 = new Date(dia0); dia1.setDate(dia1.getDate() + 1);
    const outros = await q(sb.from('agendamentos').select('id,inicio,duracao_min,pacientes(nome)').gte('inicio', dia0.toISOString()).lt('inicio', dia1.toISOString()).not('status', 'in', '(cancelado,faltou)'));
    const choque = outros.find(o => o.id !== a.id && new Date(o.inicio) < fim && new Date(new Date(o.inicio).getTime() + o.duracao_min * 60000) > ini);
    if (choque && !(await confirmar('Horário ocupado', `${choque.pacientes?.nome} já está agendada às ${fdt(choque.inicio).split(' às ')[1]}. Agendar mesmo assim?`, 'Agendar assim'))) return;
    await busy($('#agSave', b), async () => {
      try {
        if (novo) await q(sb.from('agendamentos').insert(d)); else await q(sb.from('agendamentos').update(d).eq('id', a.id));
        closeSheet(); toast(novo ? 'Horário agendado.' : 'Agendamento atualizado.'); onSaved && onSaved();
      } catch (err) { fail(err); }
    });
  };
  if (!novo) {
    $('#agDel', b).onclick = async () => {
      if (!(await confirmar('Excluir agendamento?', 'Se a paciente desmarcou, prefira mudar a situação para "Cancelado" para manter o histórico.', 'Excluir', true))) return;
      try { await q(sb.from('agendamentos').delete().eq('id', a.id)); closeSheet(); toast('Agendamento excluído.'); onSaved && onSaved(); } catch (err) { fail(err); }
    };
    const at = $('#agAtender', b);
    if (at) at.onclick = async () => {
      const full = await q(sb.from('pacientes').select('*').eq('id', a.paciente_id).single());
      registrarAtendimento({ paciente: full, procedimento_id: a.procedimento_id, data: a.inicio, agendamento_id: a.id, venda_id: a.venda_id, depois: onSaved });
    };
  }
}

function proximoHorario() {
  const d = new Date(); d.setMinutes(d.getMinutes() < 30 ? 30 : 60, 0, 0); if (d.getHours() < 8) d.setHours(9, 0); if (d.getHours() >= 19) { d.setDate(d.getDate() + 1); d.setHours(9, 0); }
  return d;
}
