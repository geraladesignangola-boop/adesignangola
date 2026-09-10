# Sistema A.Academy — Documentação Completa

## 1. Visão Geral

A **A.Academy** é uma plataforma web de gestão de inscrições para um curso de Design Gráfico, desenvolvida para a Angola. O sistema permite que alunos se inscrevam online e que administradores gerenciem inscrições, pagamentos, presenças e configurações do curso.

### Stack Tecnológica

| Camada | Tecnologia | Versão |
|--------|-----------|--------|
| **Frontend** | HTML5, CSS3, JavaScript vanilla (ES Modules) | — |
| **Bundler** | Vite | ^5.4.0 |
| **Backend/DB** | Supabase (PostgreSQL + Auth + RLS) | — |
| **Charts** | Chart.js (via CDN) | ^4.4.1 |
| **Deploy** | Netlify | — |

### Arquitetura

```
┌─────────────────────────────────────────────────┐
│                   USUÁRIO                       │
│                                                 │
│  ┌─────────────────┐    ┌─────────────────────┐ │
│  │  Landing Page    │    │  Painel Admin       │ │
│  │  (index.html)    │    │  (admin.html)       │ │
│  │                  │    │                     │ │
│  │  main.js         │    │  admin.js           │ │
│  │  main.css        │    │  auth.js            │ │
│  └────────┬─────────┘    └─────────┬───────────┘ │
│           │                        │             │
│           └──────────┬─────────────┘             │
│                      │                           │
│              supabase.js                         │
│           (Supabase Client)                      │
│                      │                           │
└──────────────────────┼───────────────────────────┘
                       │
                       ▼
         ┌──────────────────────────┐
         │       SUPABASE           │
         │                          │
         │  ┌────────────────────┐  │
         │  │ PostgreSQL         │  │
         │  │ - inscricoes       │  │
         │  │ - configuracoes    │  │
         │  │ - utilizadores     │  │
         │  │ - presencas_*      │  │
         │  │ - notificacoes     │  │
         │  │ - audit_log        │  │
         │  └────────────────────┘  │
         │                          │
         │  ┌────────────────────┐  │
         │  │ Auth               │  │
         │  │ (email/password)   │  │
         │  └────────────────────┘  │
         │                          │
         │  ┌────────────────────┐  │
         │  │ Row Level Security │  │
         │  │ (RLS)              │  │
         │  └────────────────────┘  │
         └──────────────────────────┘
```

---

## 2. Estrutura de Ficheiros

```
curso-design-grafico/
├── index.html                  # Landing page pública (inscrição)
├── admin.html                  # Painel administrativo
├── vite.config.js              # Configuração do Vite (build multi-page)
├── package.json                # Dependências
├── netlify.toml                # Configuração de deploy
├── .env                        # Variáveis de ambiente (Supabase)
│
├── src/
│   ├── js/
│   │   ├── main.js             # Lógica da landing page
│   │   ├── admin.js            # Lógica do painel admin (852 linhas)
│   │   ├── auth.js             # Autenticação via Supabase Auth
│   │   └── supabase.js         # Inicialização do cliente Supabase
│   │
│   ├── styles/
│   │   ├── main.css            # Estilos da landing page
│   │   └── admin.css           # Estilos do painel admin
│   │
│   └── assets/                 # Imagens e logos
│       ├── LOGO_1.png
│       ├── LOGO_2.png
│       ├── modelo.png          # Foto do instrutor
│       ├── adilson.png         # Foto do formador
│       ├── ai.png              # Logo Adobe Illustrator
│       ├── ps.png              # Logo Adobe Photoshop
│       └── aaf.png             # Logo Affinity Designer
│
├── supabase/
│   ├── migration.sql           # Script principal de criação da DB
│   ├── migration_inscricoes_ativas.sql  # Migração para toggle de inscrições
│   ├── fix_rls.sql             # Correções de RLS
│   ├── fix_rls2.sql            # Mais correções de RLS
│   ├── pkg_phase1.sql          # Tabela pacotes (normal, pro)
│   ├── pkg_phase2.sql          # Tabela codigos_parceria + RPC validação
│   ├── pkg_phase3.sql          # Trigger calcular_valor_inscricao
│   ├── pkg_phase3_full.sql     # Script completo fase 3
│   ├── pkg_online.sql          # Pacote online (Zoom/Meet)
│   ├── curso_setup.sql         # Tabela modulos_curso + seed 18 módulos
│   ├── hero_status.sql         # Campo hero_status_texto
│   ├── create_admin.sql        # Criar utilizador admin
│   └── supabase-reset.sql      # RPCs: reset_all_data, functions auxiliares
│
└── dist/                       # Build de produção (gerado pelo Vite)
```

---

## 3. Base de Dados (Supabase / PostgreSQL)

### 3.1 Diagrama das Tabelas

```
┌──────────────────┐       ┌──────────────────────┐
│   utilizadores   │       │    configuracoes     │
├──────────────────┤       ├──────────────────────┤
│ id (UUID, PK)    │       │ id (UUID, PK)        │
│ nome             │       │ nome_curso           │
│ email (UNIQUE)   │       │ data_inicio          │
│ password_hash    │       │ num_modulos          │
│ role             │       │ duracao              │
│ ativo            │       │ valor_total          │
│ criado_em        │       │ parcelas             │
│ atualizado_em    │       │ valor_parcela        │
└──────────────────┘       │ regra_liberacao_codigo│
                           │ iban                 │
                           │ titular_iban         │
                           │ whatsapp_comprovativo│
                           │ link_grupo           │
                           │ inscricoes_ativas    │
                           │ textos_landing       │
                           │ hero_status_texto    │
                           │ data_confirmada      │
                           │ localizacao          │
                           │ localizacao_link     │
                           │ horario              │
                           │ descricao_curso      │
                           │ publico_alvo         │
                           │ ferramentas          │
                           │ carga_horaria        │
                           │ certificado          │
                           └──────────────────────┘

┌─────────────────────────────────────┐
│            inscricoes               │
├─────────────────────────────────────┤
│ id (UUID, PK)                       │
│ numero_sequencial (SERIAL UNIQUE)   │
│ nome_completo                       │
│ email                               │
│ telefone                            │
│ cidade                              │
│ perfil (igreja|empresa|freelancer|  │
│         pessoal|outro)              │
│ perfil_label                        │
│ campos_especificos (JSONB)          │
│ pacote_id (FK → pacotes)           │
│ valor_total                         │
│ modalidade_pagamento (integral|     │
│                       parcelado)    │
│ numero_parcelas                     │
│ estado (iniciada|aguarda_|          │
│         confirmacao|confirmada|     │
│         rejeitada|cancelada)        │
│ codigo_referencia (UNIQUE)          │
│ codigo_conclusao                    │
│ codigo_parceria_usado (FK)          │
│ data_inscricao                      │
│ data_confirmacao                    │
│ canal                               │
│ notas_internas (JSONB)             │
│ historico_estados (JSONB)          │
│ parcelas (JSONB)                   │
│ tipo_inscricao (nova|renovacao)    │
│ motivo_rejeicao                     │
│ renovacao_de (FK → inscricoes.id)  │
│ criado_em                           │
│ atualizado_em                       │
└─────────────────────────────────────┘
        │                    │
        ▼                    ▼
┌───────────────────┐  ┌──────────────────┐
│ presencas_sessoes │  │  notificacoes    │
├───────────────────┤  ├──────────────────┤
│ id (UUID, PK)     │  │ id (UUID, PK)    │
│ titulo            │  │ tipo             │
│ data              │  │ titulo           │
│ criado_em         │  │ mensagem         │
│ criado_por (FK)   │  │ inscricao_id(FK) │
└─────────┬─────────┘  │ lida             │
          │             │ criada_em        │
          ▼             └──────────────────┘
┌───────────────────┐
│presencas_registos │  ┌──────────────────┐
├───────────────────┤  │   audit_log      │
│ id (UUID, PK)     │  ├──────────────────┤
│ sessao_id (FK)    │  │ id (UUID, PK)    │
│ inscricao_id (FK) │  │ utilizador_id(FK)│
│ presente (BOOL)   │  │ acao             │
│ registrado_em     │  │ detalhes (JSONB) │
│ UNIQUE(sessao,    │  │ ip_address       │
│        inscricao) │  │ criado_em        │
└───────────────────┘  └──────────────────┘

┌───────────────────┐  ┌──────────────────┐
│    pacotes        │  │ codigos_parceria │
├───────────────────┤  ├──────────────────┤
│ id (UUID, PK)     │  │ id (UUID, PK)    │
│ slug (UNIQUE)     │  │ codigo (UNIQUE)  │
│ nome              │  │ nome_parceiro    │
│ valor             │  │ percentual_desconto│
│ parcelas          │  │ limite_usos      │
│ valor_parcela     │  │ usos_atuais      │
│ inclui_mentoria   │  │ ativo            │
│ descricao         │  │ criado_por (FK)  │
│ ativo             │  │ criado_em        │
│ criado_em         │  └──────────────────┘
└───────────────────┘

┌───────────────────┐
│  modulos_curso    │
├───────────────────┤
│ id (UUID, PK)     │
│ fase (1|2|3)      │
│ fase_nome         │
│ numero            │
│ nome              │
│ descricao         │
│ ordem             │
│ ativo             │
│ criado_em         │
└───────────────────┘
```

### 3.2 Triggers Automáticos

| Trigger | Quando | O que faz |
|---------|--------|-----------|
| `trg_gerar_codigo_referencia` | BEFORE INSERT em `inscricoes` | Gera código `ADG-YYYY-XXXX` automaticamente |
| `trg_gerar_codigo_conclusao` | BEFORE UPDATE em `inscricoes` | Gera código de 8 caracteres quando estado → `confirmada` |
| `trg_inscricoes_updated_at` | BEFORE UPDATE em `inscricoes` | Atualiza `atualizado_em` automaticamente |
| `trg_registrar_historico_estado` | BEFORE UPDATE em `inscricoes` | Regista mudanças de estado no `historico_estados` |
| `trg_notificar_nova_inscricao` | AFTER INSERT em `inscricoes` | Cria notificação quando alguém se inscreve |
| `trg_notificar_pagamento` | AFTER UPDATE em `inscricoes` | Cria notificação ao confirmar/rejeitar pagamento |

### 3.3 Row Level Security (RLS)

| Tabela | INSERT | SELECT | UPDATE | DELETE |
|--------|--------|--------|--------|--------|
| `inscricoes` | Qualquer pessoa (se inscricoes_ativas=true) | Admin/Operador vê todas | Apenas Admin | Apenas Admin |
| `configuracoes` | Apenas Admin | Qualquer pessoa | Apenas Admin | — |
| `utilizadores` | Apenas Admin | Admin vê todos / Utilizador vê o seu | Apenas Admin | — |
| `presencas_sessoes` | Admin/Operador | Admin/Operador | — | Apenas Admin |
| `presencas_registos` | Admin/Operador | Admin/Operador | Admin/Operador | Admin/Operador |
| `notificacoes` | Sistema (triggers) | Admin/Operador | Admin/Operador | — |
| `audit_log` | Sistema | Apenas Admin | — | — |

### 3.4 RPCs (Remote Procedure Calls)

| Função | Acesso | Descrição |
|--------|--------|-----------|
| `consultar_inscricao_publica(codigo)` | anon, authenticated | Consulta pública por código de referência |
| `get_dashboard_stats()` | security_definer | Estatísticas do dashboard |
| `get_presenca_stats(sessao)` | security_definer | Estatísticas de presença por sessão |
| `get_relatorio_mensal(mes, ano)` | security_definer | Relatório mensal |
| `inscricoes_estao_ativas()` | anon, authenticated | Verifica se inscrições estão abertas |
| `definir_inscricoes_ativas(p_ativas)` | authenticated | Liga/desliga inscrições (apenas admin) |
| `validar_codigo_parceria(p_codigo)` | anon, authenticated | Valida código de desconto (retorna JSONB) |
| `reset_all_data()` | security_definer | Apaga inscrições e presenças (mantém pacotes/módulos) |

---

## 4. Frontend — Landing Page (`index.html` + `main.js`)

### 4.1 Fluxo do Utilizador

```
Utilizador visita index.html
    │
    ▼
┌─────────────────────────────────┐
│  HERO: Informações do curso     │
│  - Nome, Preço, Localização     │
│  - Navegação para secções       │
└─────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────┐
│  SECÇÕES INFORMATIVAS           │
│  - Porquê este curso            │
│  - Ferramentas (AI, PS, Aff)    │
│  - Programa (3 fases, 18 mód)   │
│  - Jornada de inscrição         │
│  - Para quem é                  │
│  - Instrutor                    │
│  - Preço                        │
│  - FAQ                          │
└─────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────┐
│  FORMULÁRIO MULTI-PASSO         │
│  Passo 1: Perfil                │
│    → Igreja/Empresa/Freelancer/ │
│      Pessoal/Outro              │
│  Passo 2: Dados pessoais        │
│    → Nome, WhatsApp, Email,     │
│      Cidade                     │
│  Passo 3: Detalhes específicos  │
│    → Campos variáveis por perfil│
│  Passo 4: Pagamento             │
│    → Integral ou Parcelado      │
│    → Resumo                     │
└─────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────┐
│  CONFIRMAÇÃO                    │
│  - Código de referência         │
│    (ADG-YYYY-XXXX)              │
│  - IBAN para pagamento          │
│  - WhatsApp para envio de       │
│    comprovativo                 │
│  - Link para WhatsApp           │
└─────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────┐
│  CONSULTA DE ESTADO             │
│  - Input com código             │
│  - Resultado: Pendente/         │
│    Confirmado/Rejeitado         │
└─────────────────────────────────┘
```

### 4.2 O que `main.js` faz

| Funcionalidade | Descrição |
|----------------|-----------|
| **Menu Mobile** | Toggle do menu hamburger com overlay |
| **Scroll Reveals** | Animações de entrada ao fazer scroll (bidirecional) |
| **Parallax** | Efeitos de profundidade no hero e glows das secções |
| **Progress Bar** | Barra de progresso no topo durante scroll |
| **Counter Animation** | Animação numérica nos stats do instrutor |
| **Magnetic Buttons** | Botões que seguem o cursor ao hover |
| **Smooth Anchor** | Scroll suave para âncoras internas |
| **Card Tilt** | Efeito 3D nos cards ao hover |
| **Accordion Fases** | Accordion que expande/recolhe as fases do curso |
| **Multi-Step Form** | Formulário de 4 passos com validação |
| **Perfil Dinâmico** | Campos condicionais baseados no perfil selecionado |
| **Resumo Dinâmico** | Resumo da inscrição antes de submeter |
| **Submit → Supabase** | Envio dos dados para a tabela `inscricoes` |
| **Consulta por Código** | Lookup público via RPC `consultar_inscricao_publica` |
| **Config Dinâmica** | Carrega IBAN, valores, WhatsApp do Supabase |

---

## 5. Frontend — Painel Admin (`admin.html` + `admin.js`)

### 5.1 Autenticação

```
admin.html
    │
    ▼
┌─────────────────────────┐
│  Tela de Login          │
│  Email + Password       │
│  → Supabase Auth        │
│  → Verifica role na     │
│    tabela utilizadores  │
│  → Verifica ativo=true  │
└─────────────────────────┘
    │
    ▼ (sucesso)
┌─────────────────────────┐
│  App Principal          │
│  - Topbar               │
│  - Nav Principal        │
│  - Bottom Nav (mobile)  │
│  - Side Drawer (mobile) │
│  - Conteúdo dinâmico    │
└─────────────────────────┘
```

### 5.2 Módulos do Admin

#### 5.2.1 Dashboard (`App.go('dashboard')`)

- **Cards de stats**: Total inscrições, taxa de confirmação
- **Gráfico de linha**: Receita confirmada (últimos 6 meses)
- **Gráfico de anel**: Distribuição por perfil
- **Pills**: Receita confirmada, total inscrições, confirmadas, aguarda
- **Tabela**: Inscrições recentes
- **Timeline**: Atividades recentes
- **Action Needed**: Inscrições antigas pendentes

#### 5.2.2 Inscrições (`App.go('inscricoes')`)

- **Tabela completa** com todas as inscrições
- **Filtros**: Nome, estado, perfil, pagamento, data início/fim
- **Exportar CSV**
- **Clique numa linha** → Modal com detalhes

#### 5.2.3 Detalhe da Inscrição (`App.openDetail(id)`)

- **Dados pessoais**: Nome, email, telefone, cidade
- **Perfil**: Campos específicos dinâmicos
- **Pagamento**: Modalidade, parcelas, código de conclusão
- **Ações**:
  - Confirmar pagamento (integral ou parcela)
  - Rejeitar inscrição (com motivo)
  - Reabrir inscrição
  - Alterar tipo (Nova/Renovação)
- **Parcelas**: Lista de parcelas com estado
- **Histórico**: Timeline de mudanças de estado
- **Notas internas**: Adicionar notas administrativas

#### 5.2.4 Presença (`App.go('presenca')`)

- **Stats**: Sessões registadas, alunos confirmados, presenças, taxa global
- **Criar sessão**: Título + data + checklist de alunos
- **Ver sessão**: Lista de presentes/ausentes com taxa
- **Exportar CSV**
- **Eliminar sessão**

#### 5.2.5 Definições (`App.go('settings')`)

- **Dados do curso**: Nome, data início, módulos, duração
- **Inscrições**: Toggle ativar/desativar (chama RPC)
- **Preço e parcelamento**: Valor, parcelas, regra de libertação do código
- **Dados de pagamento**: IBAN, titular, WhatsApp
- **Grupo da turma**: Link WhatsApp/Telegram
- **Zona de Perigo**: Botão para reset total de dados (apaga inscrições e presenças, mantém pacotes e módulos)

#### 5.2.6 Relatórios (`App.go('reports')`)

- **Gráfico de barras**: Receita mensal (novas vs renovações)
- **Gráfico de anel**: Distribuição novas vs renovações
- **Tabela mensal**: Detalhe mês a mês
- **Métricas**: Receita total, pendente, média, taxa conversão

#### 5.2.7 Parcerias (`App.go('parcerias')`)

- **Criar código**: Código, nome do parceiro, percentual de desconto, limite de usos
- **Listar códigos**: Todos os códigos com estado (ativo/inativo)
- **Ativar/Desativar**: Toggle de estado do código
- **Tabela**: `codigos_parceria` no Supabase

#### 5.2.8 Curso (`App.go('curso')`)

- **Listar módulos**: 18 módulos organizados por fase (3 fases)
- **Estado**: Mostra módulos ativos/inativos
- **Dados**: Tabela `modulos_curso` no Supabase (script `curso_setup.sql`)

### 5.3 Sistema de Notificações

- **Auto-geradas**: Triggers no Supabase criam notificações
- **Scan local**: `Notif._scanNewInscricoes()` verifica novas inscrições
- **Badge**: Contador de não lidas
- **Dropdown**: Lista com ícones, títulos, tempos
- **Click**: Abre detalhe da inscrição
- **Marcar todas como lidas**

### 5.4 Arquitetura do `admin.js`

```javascript
// 4 objetos globais principais:

DB          // Camada de dados (Supabase + localStorage cache)
├── load()          // Carrega de localStorage
├── refresh()       // Sincroniza com Supabase
├── save()          // Grava em localStorage
├── saveInscricao() // Atualiza no Supabase
├── getInscricao()  // Busca por ID
└── updateInscricao()

AuthUI       // Interface de autenticação
├── handleLogin()   // Login via Auth.login()
├── handleLogout()  // Logout via Auth.logout()
├── init()          // Verifica sessão existente
└── showApp()       // Mostra app após login

Notif        // Sistema de notificações
├── init()          // Inicializa notificações
├── toggle()        // Abre/fecha dropdown
├── addCustom()     // Adiciona notificação manual
├── clickItem()     // Abre inscrição ao clicar
└── markAllRead()   // Marca todas como lidas

App          // Router e controllers
├── go(route)       // Navega para uma página
├── render()        // Renderiza a página atual
├── openModal()     // Abre modal genérico
├── closeModal()    // Fecha modal
├── openDetail()    // Abre detalhe da inscrição
├── globalSearch()  // Pesquisa global
└── initDrawer()    // Inicializa drawer mobile

Modules      // Renderizadores de cada módulo
├── dashboard()           // Renderiza dashboard
├── inscricoes()          // Renderiza lista de inscrições
├── inscricaoDetail()     // Renderiza detalhe
├── presenca()            // Renderiza lista de presenças
├── presencaNova()        // Formulário nova sessão
├── presencaVer()         // Visualiza sessão
├── settings()            // Renderiza definições
├── reports()             // Renderiza relatórios
├── parcerias()           // Renderiza gestão de parcerias
├── curso()               // Renderiza gestão de curso
├── confirmPayment()      // Confirma pagamento
├── confirmParcela()      // Confirma parcela
├── rejectInscricao()     // Rejeita inscrição
├── reopenInscricao()     // Reabre inscrição
├── addNote()             // Adiciona nota interna
├── savePresenca()        // Guarda sessão de presença
├── saveSettings()        // Guarda definições
├── toggleInscricoes()    // Liga/desliga inscrições
├── resetAllData()        // Apaga todos os dados (reset total)
├── criarParceria()       // Cria código de parceria
├── loadParcerias()       // Carrega lista de parcerias
├── toggleParceria()      // Ativa/desativa parceria
├── loadCurso()           // Carrega módulos do curso
└── exportCSV()           // Exporta dados
```

---

## 6. Fluxo Completo de Inscrição

```
1. Aluno preenche formulário (4 passos)
   │
   ├─ Passo 1: Seleciona perfil → campos condicionais aparecem
   ├─ Passo 2: Dados pessoais (nome, email, whatsapp, cidade)
   ├─ Passo 3: Detalhes específicos do perfil
   └─ Passo 4: Escolhe pagamento (integral/parcelado) + resumo
   │
   ▼
2. Submissão
   │
   ├─ main.js gera código: ADG-2026-XXXX
   ├─ Envia para Supabase (table: inscricoes)
   ├─ Trigger trg_gerar_codigo_referencia valida/gera código
   ├─ Trigger trg_notificar_nova_inscricao cria notificação
   └─ Salvamento em localStorage como backup
   │
   ▼
3. Aluno vê confirmação
   │
   ├─ Código de referência
   ├─ IBAN para transferência
   ├─ Número WhatsApp para comprovativo
   └─ Link direto para WhatsApp com mensagem pré-preenchida
   │
   ▼
4. Aluno envia comprovativo via WhatsApp
   │
   ▼
5. Admin confirma pagamento no painel
   │
   ├─ Clica "Confirmar Pagamento" na inscrição
   ├─ Estado muda: aguarda_confirmacao → confirmada
   ├─ Trigger trg_gerar_codigo_conclusao gera código de conclusão
   ├─ Trigger trg_registrar_historico_estado regista mudança
   ├─ Trigger trg_notificar_pagamento cria notificação
   └─ Se parcelado, confirma parcela a parcela
   │
   ▼
6. Aluno consulta estado no site
   │
   ├─ Insere código ADG-2026-XXXX
   ├─ site chama RPC consultar_inscricao_publica
   └─ Ve: "Inscrição confirmada!" + código de conclusão
```

---

## 7. Fluxo de Pagamento Parcelado

```
Inscrição parcelada (ex: 3x Kz 15.000)
    │
    ├─ Parcela 1: pendente
    ├─ Parcela 2: pendente
    └─ Parcela 3: pendente
    │
    ▼ (aluno paga 1ª parcela)
Admin confirma Parcela 1
    │
    ├─ parcela[0].estado = "confirmada"
    ├─ Verifica regra_liberacao_codigo:
    │   ├─ "primeira_parcela" → Confirma inscrição automaticamente
    │   └─ "pagamento_total" → Aguarda todas as parcelas
    └─ Se regra = "primeira_parcela":
        ├─ estado → "confirmada"
        ├─ Gera codigo_conclusao
        └─ Aluno pode aceder ao curso
    │
    ▼ (aluno paga 2ª e 3ª parcelas)
Admin confirma cada parcela individualmente
    │
    └─ Quando todas confirmadas (se regra = "pagamento_total"):
        ├─ estado → "confirmada"
        └─ Gera codigo_conclusao
```

---

## 8. Variáveis de Ambiente

```env
VITE_SUPABASE_URL=https://vwswnychvovlhgccscqh.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...
```

**Importante**: Estas variáveis estão expostas no frontend (normalmente para Vite). O Supabase usa RLS para proteger os dados, então a anon key sozinha não dá acesso irrestrito.

---

## 9. Configuração do Build

### Vite (`vite.config.js`)

- **Multi-page app**: Dois entry points (`index.html` e `admin.html`)
- **Dev server**: Porta 3000, host 0.0.0.0, abre automaticamente
- **Build output**: Pasta `dist/`

### Netlify (`netlify.toml`)

- **Build command**: `npm run build`
- **Publish dir**: `dist`
- **Node version**: 20

---

## 10. Deploy

### Passos

1. **Supabase**: Executar `supabase/migration.sql` no SQL Editor
2. **Supabase**: Executar `supabase/migration_inscricoes_ativas.sql`
3. **Supabase**: Executar `supabase/pkg_phase1.sql` (tabela pacotes)
4. **Supabase**: Executar `supabase/pkg_phase2.sql` (tabela codigos_parceria)
5. **Supabase**: Executar `supabase/pkg_phase3.sql` (trigger calcular valor)
6. **Supabase**: Executar `supabase/pkg_online.sql` (pacote online)
7. **Supabase**: Executar `supabase/curso_setup.sql` (módulos do curso)
8. **Supabase**: Executar `supabase/hero_status.sql` (campo hero_status_texto)
9. **Supabase**: Executar `supabase-reset.sql` (RPCs: reset_all_data, validar_codigo_parceria, etc)
10. **Supabase**: Criar utilizador admin na tabela `utilizadores` + Supabase Auth
11. **Variáveis de ambiente**: Configurar `.env` com URL e Key do Supabase
12. **Build**: `npm run build`
13. **Deploy**: Push para GitHub → Netlify faz deploy automático

### Criar Admin Inicial

```sql
-- No Supabase SQL Editor:
-- 1. Criar utilizador no Auth (via Dashboard > Auth > Users)
-- 2. Inserir na tabela:
INSERT INTO utilizadores (id, nome, email, role, ativo)
VALUES ('<uuid-do-auth>', 'Admin', 'admin@aacademy.ao', 'admin', true);
```

---

## 11. Mecanismos de Segurança

| Mecanismo | Implementação |
|-----------|---------------|
| **Autenticação** | Supabase Auth (email/password) |
| **Autorização** | Tabela `utilizadores` com roles (admin/operador/viewer) |
| **RLS** | Row Level Security em todas as tabelas |
| **Consultas públicas** | RPCs com `SECURITY DEFINER` + `REVOKE/GRANT` |
| **Inscrições** | Só aceita INSERT se `inscricoes_ativas = true` |
| **Admin actions** | Verificação `Auth.isAdmin()` no frontend |
| **Audit trail** | Tabela `audit_log` para ações administrativas |

---

## 12. Convenções de Código

- **Módulos ES**: `import/export` em vez de scripts tradicionais
- **Objetos globais**: `window.App`, `window.Modules`, `window.DB`, etc. (expostos para uso em `onclick` inline)
- **Funções de renderização**: Cada módulo retorna um `HTMLElement` que é injetado no `#app-content`
- **Estado**: Mix de Supabase (fonte de verdade) + localStorage (cache offline)
- **Estilos**: CSS vanilla sem pré-processadores
- **Naming**: Nomes em português para domínio do negócio, nomes técnicos em inglês

---

## 13. Dependências de Runtime

| Pacote | Uso |
|--------|-----|
| `@supabase/supabase-js` | Cliente Supabase para autenticação e queries |
| `vite` (dev) | Bundler e dev server |
| `chart.js` (CDN) | Gráficos no dashboard e relatórios |

---

## 14. Notas Importantes para Desenvolvedores

1. **Dual storage**: O sistema usa Supabase como fonte de verdade E localStorage como cache. Sempre que possível, os dados são sincronizados com `DB.refresh()`.

2. **Triggers server-side**: Vários mecanismos (código de referência, código de conclusão, notificações, histórico) são executados como triggers no PostgreSQL. Não dependem do frontend.

3. **RLS é crítico**: Não remova as policies de RLS. O frontend depende delas para segurança. A policy de INSERT em `inscricoes` verifica `inscricoes_estao_ativas()`.

4. **Formulário dinâmico**: Os campos do passo 3 mudam completamente conforme o perfil selecionado. Ao adicionar um novo perfil, adicione: botão no HTML, bloco `rf-conditional` no HTML, entrada em `profileData` no JS.

5. **Configuração remota**: IBAN, valores e WhatsApp são carregados do Supabase. Se o Supabase estiver indisponível, usa valores hardcoded como fallback.

6. **Encoding**: Existe uma função `repairMojibake()` que corrige problemas de encoding UTF-8 vs CP1252 em textos do Supabase.
