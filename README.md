# 🧘 Pilates Backend API

API REST profissional para Sistema de Gestão de Estúdio de Pilates, construída com Node.js, Express e PostgreSQL.

## 📋 Índice

- [Características](#características)
- [Tecnologias](#tecnologias)
- [Pré-requisitos](#pré-requisitos)
- [Instalação](#instalação)
- [Configuração](#configuração)
- [Migrations](#migrations)
- [Uso](#uso)
- [Estrutura do Projeto](#estrutura-do-projeto)
- [API Endpoints](#api-endpoints)
- [Modelos de Dados](#modelos-de-dados)

## ✨ Características

- ✅ Autenticação JWT
- ✅ Controle de permissões (Gestor e Profissional)
- ✅ CRUD completo de Pacientes
- ✅ Gestão de Frequências
- ✅ Registro de Evoluções com EVA
- ✅ Validação de dados com Joi
- ✅ Tratamento de erros robusto
- ✅ Banco de dados PostgreSQL
- ✅ Migrations automáticas
- ✅ Código segmentado e profissional

## 🛠️ Tecnologias

- **Node.js** - Runtime JavaScript
- **Express** - Framework web
- **PostgreSQL** - Banco de dados relacional
- **JWT** - Autenticação
- **Bcrypt** - Hash de senhas
- **Joi** - Validação de schemas
- **dotenv** - Variáveis de ambiente

## 📦 Pré-requisitos

- Node.js v16 ou superior
- PostgreSQL v12 ou superior
- npm ou yarn

## 🚀 Instalação

1. Clone o repositório:
```bash
git clone <url-do-repositorio>
cd pilates-backend
```

2. Instale as dependências:
```bash
npm install
```

3. Configure as variáveis de ambiente:
```bash
cp .env.example .env
```

Edite o arquivo `.env` com suas configurações.

## ⚙️ Configuração

Configure o arquivo `.env` com as seguintes variáveis:

```env
# Servidor
PORT=3000
NODE_ENV=development

# Banco de Dados
DB_HOST=localhost
DB_PORT=5432
DB_NAME=pilates_db
DB_USER=postgres
DB_PASSWORD=sua_senha

# JWT
JWT_SECRET=seu_secret_key_super_seguro
JWT_EXPIRES_IN=24h

# CORS
CORS_ORIGIN=http://localhost:4200
```

## 🗄️ Migrations

### Criar banco de dados

Primeiro, crie o banco de dados PostgreSQL:

```bash
psql -U postgres
CREATE DATABASE pilates_db;
\q
```

### Executar migrations

Para criar as tabelas e popular com dados de exemplo:

```bash
npm run migrate
```

Este comando irá:
1. Criar todas as tabelas necessárias
2. Criar índices para otimização
3. Criar triggers para atualização automática de timestamps
4. Popular o banco com dados de exemplo (usuários e pacientes)

## 🎯 Uso

### Modo desenvolvimento (com hot-reload):
```bash
npm run dev
```

### Modo produção:
```bash
npm start
```

O servidor estará disponível em `http://localhost:3000`

### Health Check:
```bash
curl http://localhost:3000/health
```

## 📁 Estrutura do Projeto

```
pilates-backend/
├── migrations/              # Scripts de migração do banco
│   ├── create_tables.js    # Criação de tabelas
│   ├── seed.js             # População inicial
│   └── run.js              # Executor de migrations
├── src/
│   ├── config/             # Configurações
│   │   └── database.js     # Configuração PostgreSQL
│   ├── controllers/        # Controladores (lógica de negócio)
│   │   ├── authController.js
│   │   ├── patientController.js
│   │   ├── attendanceController.js
│   │   └── evolutionController.js
│   ├── middlewares/        # Middlewares
│   │   ├── auth.js         # Autenticação JWT
│   │   ├── validator.js    # Validação de dados
│   │   └── errorHandler.js # Tratamento de erros
│   ├── models/             # Modelos de dados
│   │   ├── User.js
│   │   ├── Patient.js
│   │   ├── Attendance.js
│   │   └── Evolution.js
│   ├── routes/             # Rotas da API
│   │   ├── authRoutes.js
│   │   ├── patientRoutes.js
│   │   ├── attendanceRoutes.js
│   │   └── evolutionRoutes.js
│   ├── utils/              # Utilitários
│   │   └── validators.js   # Schemas de validação Joi
│   └── server.js           # Arquivo principal
├── .env.example            # Exemplo de variáveis de ambiente
├── .gitignore             # Arquivos ignorados pelo git
├── package.json           # Dependências e scripts
└── README.md              # Documentação
```

## 🔌 API Endpoints

### Autenticação

| Método | Endpoint | Descrição | Auth |
|--------|----------|-----------|------|
| POST | `/api/auth/login` | Login de usuário | Não |
| POST | `/api/auth/register` | Registrar novo usuário | Sim |
| GET | `/api/auth/me` | Dados do usuário logado | Sim |
| PUT | `/api/auth/password` | Alterar senha | Sim |

### Pacientes

| Método | Endpoint | Descrição | Auth |
|--------|----------|-----------|------|
| GET | `/api/patients` | Listar pacientes | Sim |
| GET | `/api/patients/stats` | Estatísticas gerais | Sim |
| GET | `/api/patients/:id` | Obter paciente | Sim |
| POST | `/api/patients` | Criar paciente | Sim |
| PUT | `/api/patients/:id` | Atualizar paciente | Sim |
| DELETE | `/api/patients/:id` | Excluir paciente | Sim |

### Frequência

| Método | Endpoint | Descrição | Auth |
|--------|----------|-----------|------|
| GET | `/api/patients/:id/attendance` | Listar frequências | Sim |
| GET | `/api/patients/:id/attendance/stats` | Estatísticas de frequência | Sim |
| POST | `/api/patients/:id/attendance` | Criar registro | Sim |
| PUT | `/api/patients/:id/attendance/:attId` | Atualizar registro | Sim |
| DELETE | `/api/patients/:id/attendance/:attId` | Excluir registro | Sim |

### Evoluções

| Método | Endpoint | Descrição | Auth |
|--------|----------|-----------|------|
| GET | `/api/patients/:id/evolutions` | Listar evoluções | Sim |
| GET | `/api/patients/:id/evolutions/latest` | Últimas evoluções | Sim |
| GET | `/api/patients/:id/evolutions/eva-average` | Média EVA | Sim |
| POST | `/api/patients/:id/evolutions` | Criar evolução | Sim |
| PUT | `/api/patients/:id/evolutions/:evoId` | Atualizar evolução | Sim |
| DELETE | `/api/patients/:id/evolutions/:evoId` | Excluir evolução | Sim |

## 📊 Modelos de Dados

### User
```typescript
{
  id: number;
  nome: string;
  email: string;
  senha: string (hash);
  role: 'gestor' | 'profissional';
  created_at: Date;
  updated_at: Date;
}
```

### Patient
```typescript
{
  id: number;
  nome: string;
  profissional_id: number;
  dias: string[];
  horarios: { [dia: string]: string };
  valor: number;
  porcentagem: number;
  base: number;
  ganho: number;
  data_inicio: Date;
  data_fim: Date | null;
  created_at: Date;
  updated_at: Date;
}
```

### Attendance
```typescript
{
  id: number;
  patient_id: number;
  date: Date;
  status: 'present' | 'absent' | 'makeup';
  notes: string;
  created_at: Date;
}
```

### Evolution
```typescript
{
  id: number;
  patient_id: number;
  date: Date;
  eva: number (0-10);
  exercises: {
    reformer?: string[];
    cadillac?: string[];
    chair?: string[];
    barrel?: string[];
    solo?: string[];
  };
  notes: string;
  author: string;
  created_at: Date;
  updated_at: Date;
}
```

## 🔐 Autenticação

A API usa JWT (JSON Web Tokens) para autenticação. 

### Login:
```bash
POST /api/auth/login
Content-Type: application/json

{
  "email": "gestor@studio.com",
  "senha": "gestor123"
}
```

### Resposta:
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "nome": "Gestor Master",
    "email": "gestor@studio.com",
    "role": "gestor"
  }
}
```

### Usando o token:
```bash
GET /api/patients
Authorization: Bearer seu_token_aqui
```

## 👥 Credenciais de Teste

Após executar as migrations, você terá acesso a:

**Gestor:**
- Email: `gestor@studio.com`
- Senha: `gestor123`

**Profissional:**
- Email: `prof1@studio.com`
- Senha: `prof123`

## 📝 Exemplos de Uso

### Criar um novo paciente:
```bash
POST /api/patients
Authorization: Bearer <token>
Content-Type: application/json

{
  "nome": "Ana Silva",
  "profissional": 2,
  "dias": ["seg", "qua", "sex"],
  "horarios": {
    "seg": "09:00",
    "qua": "14:00",
    "sex": "16:00"
  },
  "valor": 450.00,
  "porcentagem": 30,
  "data_inicio": "2025-03-01"
}
```

### Registrar frequência:
```bash
POST /api/patients/1/attendance
Authorization: Bearer <token>
Content-Type: application/json

{
  "date": "2025-02-16",
  "status": "present",
  "notes": "Aluna pontual"
}
```

### Criar evolução:
```bash
POST /api/patients/1/evolutions
Authorization: Bearer <token>
Content-Type: application/json

{
  "date": "2025-02-16",
  "eva": 2,
  "exercises": {
    "reformer": ["Footwork", "Hundred"],
    "solo": ["Roll Up", "Single Leg Stretch"]
  },
  "notes": "Excelente progressão no controle do core"
}
```

## 🤝 Contribuindo

1. Fork o projeto
2. Crie uma branch para sua feature (`git checkout -b feature/NovaFeature`)
3. Commit suas mudanças (`git commit -m 'Adiciona nova feature'`)
4. Push para a branch (`git push origin feature/NovaFeature`)
5. Abra um Pull Request

## 📄 Licença

Este projeto está sob a licença ISC.

## 👨‍💻 Autor

Desenvolvido para sistema de gestão de estúdio de Pilates.
