require('dotenv').config();
const express = require('express');
const cors = require('cors');

// Importar rotas
const authRoutes = require('./routes/authRoutes');
const patientRoutes = require('./routes/patientRoutes');
const attendanceRoutes = require('./routes/attendanceRoutes');
const evolutionRoutes = require('./routes/evolutionRoutes');
const professionalRoutes = require('./routes/professionalRoutes');
const biometricRoutes = require('./routes/biometricRoutes');

// Importar middlewares
const { errorHandler, notFound } = require('./middlewares/errorHandler');

// Criar aplicação
const app = express();
const PORT = process.env.PORT || 3000;

// ═══════════════════════════════════════════════════════════════════════════
// MIDDLEWARES GLOBAIS
// ═══════════════════════════════════════════════════════════════════════════

app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logging de requisições em desenvolvimento
if (process.env.NODE_ENV === 'development') {
  app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// ROTAS
// ═══════════════════════════════════════════════════════════════════════════

// Rota de health check
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'API está funcionando',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV
  });
});

// Rotas da API
app.use('/api/auth', authRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/evolution', evolutionRoutes);
app.use('/api/users', professionalRoutes);
app.use('/api/biometric', biometricRoutes);

// ═══════════════════════════════════════════════════════════════════════════
// TRATAMENTO DE ERROS
// ═══════════════════════════════════════════════════════════════════════════

// Rota não encontrada
app.use(notFound);

// Handler de erros global
app.use(errorHandler);

// ═══════════════════════════════════════════════════════════════════════════
// INICIAR SERVIDOR
// ═══════════════════════════════════════════════════════════════════════════

app.listen(PORT, () => {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║          🚀 SERVIDOR PILATES BACKEND INICIADO             ║');
  console.log('╠════════════════════════════════════════════════════════════╣');
  console.log(`║  Porta:        ${PORT.toString().padEnd(45)}║`);
  console.log(`║  Ambiente:     ${(process.env.NODE_ENV || 'development').padEnd(45)}║`);
  console.log(`║  URL:          http://localhost:${PORT.toString().padEnd(33)}║`);
  console.log(`║  Health:       http://localhost:${PORT}/health${' '.repeat(21)}║`);
  console.log('╠════════════════════════════════════════════════════════════╣');
  console.log('║  📡 Rotas da API:                                         ║');
  console.log('║                                                            ║');
  console.log('║  Autenticação:                                             ║');
  console.log(`║    POST   /api/auth/login                                 ║`);
  console.log(`║    POST   /api/auth/register                              ║`);
  console.log(`║    GET    /api/auth/me                                    ║`);
  console.log(`║    PUT    /api/auth/password                              ║`);
  console.log('║                                                            ║');
  console.log('║  Pacientes:                                                ║');
  console.log(`║    GET    /api/patients                                   ║`);
  console.log(`║    GET    /api/patients/stats                             ║`);
  console.log(`║    GET    /api/patients/:id                               ║`);
  console.log(`║    POST   /api/patients                                   ║`);
  console.log(`║    PUT    /api/patients/:id                               ║`);
  console.log(`║    DELETE /api/patients/:id                               ║`);
  console.log('║                                                            ║');
  console.log('║  Frequência:                                               ║');
  console.log(`║    GET    /api/patients/:id/attendance                    ║`);
  console.log(`║    GET    /api/patients/:id/attendance/stats              ║`);
  console.log(`║    POST   /api/patients/:id/attendance                    ║`);
  console.log(`║    PUT    /api/patients/:id/attendance/:attId             ║`);
  console.log(`║    DELETE /api/patients/:id/attendance/:attId             ║`);
  console.log('║                                                            ║');
  console.log('║  Evoluções:                                                ║');
  console.log(`║    GET    /api/patients/:id/evolutions                    ║`);
  console.log(`║    GET    /api/patients/:id/evolutions/latest             ║`);
  console.log(`║    GET    /api/patients/:id/evolutions/eva-average        ║`);
  console.log(`║    POST   /api/patients/:id/evolutions                    ║`);
  console.log(`║    PUT    /api/patients/:id/evolutions/:evoId             ║`);
  console.log(`║    DELETE /api/patients/:id/evolutions/:evoId             ║`);
  console.log('╠════════════════════════════════════════════════════════════╣');
  console.log('║  🔐 Credenciais de teste:                                 ║');
  console.log('║    Gestor:       gestor@studio.com / gestor123            ║');
  console.log('║    Profissional: prof1@studio.com / prof123               ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');
});

// Tratamento de erros não capturados
process.on('unhandledRejection', (err) => {
  console.error('❌ Unhandled Rejection:', err);
  process.exit(1);
});

process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err);
  process.exit(1);
});

module.exports = app;
