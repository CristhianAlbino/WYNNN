# WYN

Plataforma web que conecta clientes a prestadores de serviços, reunindo descoberta de profissionais, solicitações, contratos, chat, pagamentos, avaliações e recursos assistidos por IA.

## O que existe no projeto

O WYN evoluiu de um protótipo acadêmico para uma aplicação com múltiplos fluxos:

- cadastro e autenticação de clientes e prestadores;
- catálogo de serviços;
- solicitações e acompanhamento de serviços;
- perfis de usuários e prestadores;
- avaliações;
- contratos;
- chat e notificações;
- painel administrativo;
- disponibilidade de prestadores;
- integração com Mercado Pago;
- integração com Twilio/WhatsApp;
- recursos de IA com Google Gemini;
- backend Node.js com MongoDB/Mongoose.

## Estrutura

```text
.
├── frontend/              # páginas, estilos, scripts e assets da interface
├── backend/               # API Node.js/Express e integrações
│   ├── controllers/
│   ├── models/
│   ├── uploads/           # somente .gitkeep; arquivos enviados não são versionados
│   ├── .env.example
│   ├── index.js
│   └── package.json
├── .github/workflows/     # validação automática
├── .gitignore
├── CONTRIBUTING.md
├── SECURITY.md
└── README.md
```

## Backend

Requisitos:

- Node.js 20+
- MongoDB

Instalação:

```bash
cd backend
npm ci
cp .env.example .env
npm run dev
```

No Windows PowerShell:

```powershell
cd backend
npm ci
Copy-Item .env.example .env
npm run dev
```

Preencha o `.env` com as credenciais do ambiente antes de utilizar integrações externas.

## Frontend

O front-end é composto principalmente por HTML, CSS e JavaScript e pode ser servido com qualquer servidor estático.

Exemplo:

```bash
cd frontend
python -m http.server 5500
```

Depois acesse `http://localhost:5500`.

Algumas páginas já apontam para o backend publicado e outras ainda preservam URLs de desenvolvimento. Isso foi mantido para não alterar o comportamento funcional do projeto durante esta reorganização.

## Segurança

Credenciais não devem ser versionadas. Use somente `backend/.env` localmente e mantenha as variáveis esperadas conforme `backend/.env.example`.

O backend legado ainda possui alguns pontos que merecem hardening antes de produção, especialmente autenticação e configuração de ambientes. Consulte `SECURITY.md`.

## Histórico

O repositório original possuía dependências `node_modules`, uploads e várias camadas de pastas como `Tela Inicial copy/LANDING PAGE WYN/LANDING PAGE WYN`. A estrutura atual reorganiza a versão principal em `frontend/` e `backend/` sem apagar os commits antigos, então o histórico completo continua disponível.
