# Clínica Alpha · Gestão

Sistema de gestão da Clínica Alpha (estética avançada): prontuário, anamnese, atendimentos por área e lote,
fotos de antes e depois, termos com assinatura digital em PDF, agenda, pós-venda, vendas e ordens de serviço,
estoque, financeiro e relatórios.

- Interface: HTML, CSS e JavaScript puros, publicados pelo GitHub Pages.
- Banco, login e arquivos: Supabase (região São Paulo), com regras de acesso (RLS) em todas as tabelas.
- Os scripts do banco estão em `supabase/`.

A chave em `js/config.js` é a chave pública do Supabase. Ela não dá acesso aos dados:
somente usuários da equipe, autenticados, conseguem ler ou gravar.
