-- Clínica Alpha · dados iniciais (catálogo real e dados da clínica)

insert into public.config (id, dados) values (1, jsonb_build_object(
  'clinica', 'Clínica Alpha',
  'subtitulo', 'Estética Avançada',
  'profissional', 'Márcia Vanessa Sales Amaral',
  'nome_curto', 'Dra. Vanessa Amaral',
  'registro', '10470',
  'endereco', 'Rua Dezenove de Março, 892 · Mondubim',
  'cidade', 'Fortaleza',
  'uf', 'CE',
  'cep', '60760-365',
  'telefone', '(85) 98889-0548',
  'taxa_debito', 0,
  'taxa_credito_avista', 0,
  'taxa_credito_parcelado', 0,
  'mensagens', jsonb_build_object(
    'd1', 'Oi, {nome}! Aqui é a Vanessa, da Clínica Alpha. Passando para saber como você está depois do procedimento de {procedimento}. Qualquer dúvida ou sensação diferente, me chama aqui. 🤍',
    'revisao', 'Oi, {nome}! Já está na hora da revisão do procedimento de {procedimento}. Quero ver como ficou o resultado. Qual dia fica melhor para você passar aqui?',
    'sessao', 'Oi, {nome}! Sua próxima sessão de {procedimento} está chegando. Vamos deixar o horário reservado? Me diz o melhor dia para você.',
    'manutencao', 'Oi, {nome}! Tudo bem? Está chegando o tempo de manutenção de {procedimento}, quando o efeito começa a diminuir. Que tal já deixarmos seu horário reservado? ✨',
    'orcamento', 'Oi, {nome}! Ficou alguma dúvida sobre o orçamento que te enviei? Estou à disposição para te explicar tudo com calma.',
    'reativacao', 'Oi, {nome}! Lembrei de você aqui. Se quiser retomar seus cuidados na Clínica Alpha, consigo uma condição especial para você este mês. Posso te mandar os detalhes?',
    'aniversario', '{nome}, feliz aniversário! 🥂 Que este novo ciclo venha cheio de coisas boas. Um carinho especial da Clínica Alpha para você.',
    'outro', 'Oi, {nome}! Tudo bem?'
  )
)) on conflict (id) do nothing;

insert into public.procedimentos
  (nome, categoria, unidade, modo_preco, preco, duracao_min, ciclo_dias, revisao_dias, sessoes, intervalo_sessoes_dias, categoria_estoque, areas, termo, ordem)
values
  ('Toxina botulínica', 'Injetável', 'U', 'fixo', 749, 45, 120, 15, 1, null, 'Toxina',
    array['Testa','Glabela','Pés de galinha','Nariz (bunny lines)','Mento','Masseter','Platisma','Sorriso gengival','Axilas'], 'injetavel', 1),
  ('Preenchimento com ácido hialurônico', 'Injetável', 'ml', 'por_unidade', 749, 60, 270, 15, 1, null, 'Preenchedor',
    array['Lábios','Olheiras','Malar','Mandíbula','Mento','Nariz (rinomodelação)','Sulco nasogeniano','Têmporas'], 'injetavel', 2),
  ('Otomodelação', 'Injetável', 'ml', 'fixo', 2000, 60, 365, 15, 1, null, 'Preenchedor',
    array['Lóbulo direito','Lóbulo esquerdo'], 'injetavel', 3),
  ('Bioestimulador · Sculptra', 'Bioestimulador', 'frasco', 'fixo', 2100, 60, 365, 30, 1, null, 'Bioestimulador',
    array['Terço médio','Terço inferior','Face completa','Pescoço','Colo','Glúteos'], 'injetavel', 4),
  ('Bioestimulador · Rad-S', 'Bioestimulador', 'seringa', 'fixo', 1700, 60, 365, 30, 1, null, 'Bioestimulador',
    array['Terço médio','Terço inferior','Face completa','Pescoço','Mãos'], 'injetavel', 5),
  ('Skinbooster', 'Injetável', 'sessão', 'fixo', 350, 45, 120, null, 3, 30, 'Skinbooster',
    array['Face','Pescoço','Colo','Mãos'], 'injetavel', 6),
  ('Limpeza de pele', 'Facial', 'sessão', 'fixo', 150, 90, 30, null, 1, null, null,
    array['Face'], 'faciais', 7),
  ('Microagulhamento', 'Facial', 'sessão', 'fixo', 150, 60, null, null, 3, 30, null,
    array['Face','Pescoço','Colo','Cicatrizes de acne','Estrias'], 'faciais', 8);

insert into public.produtos (nome, categoria, fabricante, unidade, conteudo, embalagem, estoque_minimo) values
  ('Botox 100U', 'Toxina', 'Allergan', 'U', 100, 'frasco', 1),
  ('Ácido hialurônico 1 ml', 'Preenchedor', null, 'ml', 1, 'seringa', 2),
  ('Sculptra', 'Bioestimulador', 'Galderma', 'frasco', 1, 'frasco', 1),
  ('Rad-S', 'Bioestimulador', null, 'seringa', 1, 'seringa', 1),
  ('Skinbooster', 'Skinbooster', null, 'ml', 1, 'seringa', 1);
