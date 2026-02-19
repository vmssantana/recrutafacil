# RecrutaFácil (Consolidado)

Sistema web (frontend puro) para Gestão de Recrutamento e Seleção, com persistência em **LocalStorage**, interface **Bootstrap 5** e integração entre módulos (Vagas → Processo Seletivo → Pré‑Admissão).

## Como executar
1. Abra a pasta `RecrutaFacil_Consolidado/`
2. Rode com **Live Server** (VSCode) ou abra `index.html` diretamente no navegador.
3. Navegadores suportados: Chrome / Edge / Firefox (versões recentes).

## Login
- **Admin**
  - usuário: `admin`
  - senha: `admin123`
  - perfil: `ADMIN`
- **Consulta (genérico)**
  - usuário: `recrutafacil`
  - senha: `admin123`
  - perfil: `CONSULTA` (Postos somente leitura)

> Sessão é armazenada em `sessionStorage`. Sem login, o sistema bloqueia acesso aos módulos.

## Funcionalidades principais
- **Postos**
  - CRUD (Admin)
  - Exclusão lógica com validação (não exclui se houver vaga ativa vinculada)
  - Importação CSV/TXT (`docs/modelos/postos_exemplo.csv`)
  - Exportação CSV
- **Vagas**
  - Dropdown de postos no formato `NOME-NUMERO`
  - Data de cadastro automática (DD/MM/AAAA HH:MM)
  - Botões `ALTERAR/EXCLUIR` com regras (criador ou RH/Admin)
  - Listagem principal mostra apenas **RASCUNHO** e **ENVIADA**
  - Indicador automático **FINALIZADA ✓** quando existe candidato aprovado no Processo
  - Exportação CSV
- **Candidatos**
  - Cargo de interesse como lista suspensa (7 opções fixas)
  - Cidade de interesse carregada automaticamente de Postos (sem duplicação, ordenada)
  - Exportação CSV
- **Processo Seletivo**
  - Lista vagas com status **ENVIADA** ou **APROVADA**
  - Botão `INICIAR`
  - Vincular candidato por **ID** com status automático **EM ANÁLISE** (não editável na vinculação)
  - Alterar status (EM ANÁLISE → APROVADO/REPROVADO/DESISTENTE)
  - Apenas 1 aprovado por vaga
  - Ao aprovar: vaga é finalizada automaticamente e candidato vai para **Pré‑Admissão**
  - Exportação CSV
- **Pré‑Admissão**
  - Lista tabulada e botão `ABRIR`
  - Resumo automático do aprovado (somente leitura)
  - 3 anexos com validação (PDF/DOC/DOCX/PNG/JPG)
  - Botões “Enviar para WhatsApp” (abre WhatsApp com mensagem pré‑formatada)
  - Arquivar (FINALIZADA) remove da listagem ativa e mantém no histórico
  - Exportação CSV

## Observações
- O sistema força **MAIÚSCULAS** nas entradas (sempre que aplicável).
- Não há backend: anexos são armazenados apenas como **metadados** (nome/tipo/tamanho) por limitação do WhatsApp Web e do LocalStorage.
- Para resetar dados (somente para testes): use o botão no Dashboard.
