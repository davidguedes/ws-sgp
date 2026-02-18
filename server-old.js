const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const app = express();

const PORT = 3000;
const SECRET_KEY = 'your-secret-key-change-in-production';

// Middleware
app.use(cors());
app.use(express.json());

// Mock Database
let patients = [
  {
    id: '1',
    nome: 'Maria Silva',
    profissional: '2',
    dias: ['seg', 'qua', 'sex'],
    horarios: {
      'seg': '08:00',
      'qua': '10:00',
      'sex': '13:00'
    },
    valor: 400.00,
    porcentagem: 30,
    data_inicio: new Date('2025-01-01'),
    data_fim: new Date('2025-12-31'),
    base: 120.00,
    ganho: 280.00,
    attendance: [
      { id: 'a1', date: new Date('2025-02-10'), status: 'present', notes: '' },
      { id: 'a2', date: new Date('2025-02-12'), status: 'present', notes: '' },
      { id: 'a3', date: new Date('2025-02-14'), status: 'absent', notes: 'Atestado médico' }
    ],
    evolutions: [
      { 
        id: 'e1', 
        date: new Date('2025-02-10'),
        eva: 3,
        exercises: {
          reformer: ['Footwork', 'Hundred', 'Coordination'],
          cadillac: ['Leg Springs'],
          solo: ['The Hundred', 'Roll Up']
        },
        notes: 'Aluna demonstrou boa flexibilidade. Trabalhar mais o core. Reportou leve desconforto lombar (EVA 3).',
        author: 'Profissional Silva'
      },
      { 
        id: 'e2', 
        date: new Date('2025-02-12'),
        eva: 2,
        exercises: {
          reformer: ['Circles', 'Long Stretch', 'Elephant'],
          chair: ['Footwork', 'Pike'],
          solo: ['Single Leg Stretch', 'Double Leg Stretch']
        },
        notes: 'Ótima evolução no controle do core. Dor lombar diminuiu (EVA 2). Conseguiu manter alinhamento durante os exercícios.',
        author: 'Profissional Silva'
      }
    ],
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-02-01')
  },
  {
    id: '2',
    nome: 'João Santos',
    profissional: '2',
    dias: ['ter', 'qui'],
    horarios: { 
      ter: '14:00', 
      qui: '16:00' 
    },
    valor: 350.00,
    porcentagem: 25,
    base: 87.50,
    ganho: 262.50,
    data_inicio: new Date('2025-02-01'),
    data_fim: null,
    attendance: [
      { id: 'a4', date: new Date('2025-02-11'), status: 'present', notes: '' },
      { id: 'a5', date: new Date('2025-02-13'), status: 'present', notes: '' }
    ],
    evolutions: [
      { 
        id: 'e3', 
        date: new Date('2025-02-11'),
        eva: 0,
        exercises: {
          reformer: ['Footwork', 'Hundred'],
          solo: ['The Hundred', 'Roll Up', 'Single Leg Circle']
        },
        notes: 'Primeira aula. Aluno sem dores. Boa compreensão dos movimentos básicos.',
        author: 'Profissional Silva'
      }
    ],
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-02-01')
  }
];

const users = [
  { id: '1', nome: 'Gestor Master', email: 'gestor@studio.com', senha: 'gestor123', role: 'gestor' },
  { id: '2', nome: 'Profissional Silva', email: 'prof1@studio.com', senha: 'prof123', role: 'profissional' },
  { id: '3', nome: 'Profissional Clara', email: 'prof2@studio.com', senha: 'prof123', role: 'profissional' },
];

// Middleware de autenticação
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Token não fornecido' });
  }
  
  jwt.verify(token, SECRET_KEY, (err, user) => {
    if (err) {
      return res.status(403).json({ message: 'Token inválido' });
    }
    req.user = user;
    next();
  });
};

// ═══════════════════════════════════════════════════════════════════════════
// ROTAS DE AUTENTICAÇÃO
// ═══════════════════════════════════════════════════════════════════════════

app.post('/api/auth/login', (req, res) => {
  const { email, senha } = req.body;
  
  const user = users.find(u => u.email === email && u.senha === senha);
  
  if (!user) {
    return res.status(401).json({ message: 'Credenciais inválidas' });
  }
  
  const token = jwt.sign(
    { userId: user.id, email: user.email, role: user.role },
    SECRET_KEY,
    { expiresIn: '24h' }
  );
  
  const { senha: _, ...userWithoutPassword } = user;
  
  res.json({
    token,
    user: userWithoutPassword
  });
});

app.get('/api/auth/me', authenticateToken, (req, res) => {
  const user = users.find(u => u.id === req.user.userId);
  if (!user) {
    return res.status(404).json({ message: 'Usuário não encontrado' });
  }
  
  const { senha: _, ...userWithoutPassword } = user;
  res.json(userWithoutPassword);
});

// ═══════════════════════════════════════════════════════════════════════════
// ROTAS DE PACIENTES
// ═══════════════════════════════════════════════════════════════════════════

app.get('/api/patients', authenticateToken, (req, res) => {
  // Profissionais vêem apenas seus alunos
  if (req.user.role === 'profissional') {
    const filteredPatients = patients.filter(p => p.profissional === req.user.userId);
    return res.json(filteredPatients);
  }
  
  // Gestores vêem todos
  res.json(patients);
});

app.get('/api/patients/:id', authenticateToken, (req, res) => {
  const patient = patients.find(p => p.id === req.params.id);
  
  if (!patient) {
    return res.status(404).json({ message: 'Aluno não encontrado' });
  }
  
  // Verificar permissão
  if (req.user.role === 'profissional' && patient.profissional !== req.user.userId) {
    return res.status(403).json({ message: 'Sem permissão' });
  }
  
  res.json(patient);
});

app.post('/api/patients', authenticateToken, (req, res) => {
  const { nome, profissional, dias, horarios, valor, porcentagem, data_inicio, data_fim } = req.body;
  
  // Validações
  if (!nome || !profissional || !dias || dias.length === 0 || !valor || !porcentagem) {
    return res.status(400).json({ message: 'Dados incompletos' });
  }
  
  const base = (valor * porcentagem) / 100;
  const ganho = valor - base;
  
  const newPatient = {
    id: String(Date.now()),
    nome,
    profissional,
    dias,
    horarios: horarios || {},
    valor,
    porcentagem,
    base,
    ganho,
    data_inicio: data_inicio ? new Date(data_inicio) : new Date(),
    data_fim: data_fim ? new Date(data_fim) : null,
    attendance: [],
    evolutions: [],
    createdAt: new Date(),
    updatedAt: new Date()
  };
  
  patients.push(newPatient);
  res.status(201).json(newPatient);
});

app.put('/api/patients/:id', authenticateToken, (req, res) => {
  const index = patients.findIndex(p => p.id === req.params.id);
  
  if (index === -1) {
    return res.status(404).json({ message: 'Aluno não encontrado' });
  }
  
  // Verificar permissão
  if (req.user.role === 'profissional' && patients[index].profissional !== req.user.userId) {
    return res.status(403).json({ message: 'Sem permissão' });
  }
  
  const { nome, profissional, dias, horarios, valor, porcentagem, data_inicio, data_fim } = req.body;
  
  const base = (valor * porcentagem) / 100;
  const ganho = valor - base;
  
  patients[index] = {
    ...patients[index],
    nome,
    profissional,
    dias,
    horarios: horarios || {},
    valor,
    porcentagem,
    data_inicio: data_inicio ? new Date(data_inicio) : patients[index].data_inicio,
    data_fim: data_fim ? new Date(data_fim) : null,
    base,
    ganho,
    updatedAt: new Date()
  };
  
  res.json(patients[index]);
});

app.delete('/api/patients/:id', authenticateToken, (req, res) => {
  const index = patients.findIndex(p => p.id === req.params.id);
  
  if (index === -1) {
    return res.status(404).json({ message: 'Aluno não encontrado' });
  }
  
  // Verificar permissão
  if (req.user.role === 'profissional' && patients[index].profissional !== req.user.userId) {
    return res.status(403).json({ message: 'Sem permissão' });
  }
  
  patients.splice(index, 1);
  res.status(204).send();
});

// ═══════════════════════════════════════════════════════════════════════════
// ROTAS DE FREQUÊNCIA
// ═══════════════════════════════════════════════════════════════════════════

app.post('/api/patients/:id/attendance', authenticateToken, (req, res) => {
  const patient = patients.find(p => p.id === req.params.id);
  
  if (!patient) {
    return res.status(404).json({ message: 'Aluno não encontrado' });
  }
  
  const { date, status, notes } = req.body;
  
  const newAttendance = {
    id: String(Date.now()),
    date: new Date(date),
    status,
    notes: notes || '',
    createdAt: new Date()
  };
  
  patient.attendance.push(newAttendance);
  res.status(201).json(newAttendance);
});

app.put('/api/patients/:patientId/attendance/:attendanceId', authenticateToken, (req, res) => {
  const patient = patients.find(p => p.id === req.params.patientId);

  if (!patient) {
    return res.status(404).json({ message: 'Aluno não encontrado' });
  }

  const attIndex = patient.attendance.findIndex(a => a.id === req.params.attendanceId);

  if (attIndex === -1) {
    return res.status(404).json({ message: 'Frequência não encontrada' });
  }

  const { date, status, notes } = req.body;

  patient.attendance[attIndex] = { 
    ...patient.attendance[attIndex], 
    date: new Date(date), 
    status, 
    notes: notes || '' 
  };

  res.json(patient.attendance[attIndex]);
});

app.delete('/api/patients/:patientId/attendance/:attendanceId', authenticateToken, (req, res) => {
  const patient = patients.find(p => p.id === req.params.patientId);
  
  if (!patient) {
    return res.status(404).json({ message: 'Aluno não encontrado' });
  }
  
  const index = patient.attendance.findIndex(a => a.id === req.params.attendanceId);
  
  if (index === -1) {
    return res.status(404).json({ message: 'Registro não encontrado' });
  }
  
  patient.attendance.splice(index, 1);
  res.status(204).send();
});

// ═══════════════════════════════════════════════════════════════════════════
// ROTAS DE EVOLUÇÕES
// ═══════════════════════════════════════════════════════════════════════════

app.post('/api/patients/:id/evolutions', authenticateToken, (req, res) => {
  const patient = patients.find(p => p.id === req.params.id);
  
  if (!patient) {
    return res.status(404).json({ message: 'Aluno não encontrado' });
  }
  
  const { eva, exercises, notes, date } = req.body;
  const user = users.find(u => u.id === req.user.userId);
  
  const newEvolution = {
    id: String(Date.now()),
    date: date ? new Date(date) : new Date(),
    eva: eva !== undefined ? eva : 0,
    exercises: exercises || {},
    notes: notes || '',
    author: user ? user.nome : 'Desconhecido',
    createdAt: new Date()
  };
  
  patient.evolutions.push(newEvolution);
  res.status(201).json(newEvolution);
});

app.put('/api/patients/:patientId/evolutions/:evolutionId', authenticateToken, (req, res) => {
  const patient = patients.find(p => p.id === req.params.patientId);

  if (!patient) {
    return res.status(404).json({ message: 'Aluno não encontrado' });
  }

  const evoIndex = patient.evolutions.findIndex(e => e.id === req.params.evolutionId);

  if (evoIndex === -1) {
    return res.status(404).json({ message: 'Evolução não encontrada' });
  }

  const { eva, exercises, notes, date } = req.body;

  patient.evolutions[evoIndex] = { 
    ...patient.evolutions[evoIndex], 
    eva: eva !== undefined ? eva : patient.evolutions[evoIndex].eva,
    exercises: exercises || patient.evolutions[evoIndex].exercises,
    notes: notes || patient.evolutions[evoIndex].notes,
    date: date ? new Date(date) : patient.evolutions[evoIndex].date,
    updatedAt: new Date()
  };

  res.json(patient.evolutions[evoIndex]);
});

app.delete('/api/patients/:patientId/evolutions/:evolutionId', authenticateToken, (req, res) => {
  const patient = patients.find(p => p.id === req.params.patientId);
  
  if (!patient) {
    return res.status(404).json({ message: 'Aluno não encontrado' });
  }
  
  const index = patient.evolutions.findIndex(e => e.id === req.params.evolutionId);
  
  if (index === -1) {
    return res.status(404).json({ message: 'Evolução não encontrada' });
  }
  
  patient.evolutions.splice(index, 1);
  res.status(204).send();
});

// ═══════════════════════════════════════════════════════════════════════════
// SERVIDOR
// ═══════════════════════════════════════════════════════════════════════════

app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
  console.log(`📡 API disponível em http://localhost:${PORT}/api`);
  console.log(`\n🔐 Credenciais de teste:`);
  console.log(`   Gestor: gestor@studio.com / gestor123`);
  console.log(`   Profissional: prof1@studio.com / prof123`);
});