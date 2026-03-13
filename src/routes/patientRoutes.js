const express = require('express');
const router  = express.Router();
const PatientController = require('../controllers/patientController');
const { authenticateToken } = require('../middlewares/auth');
const { validate } = require('../middlewares/validator');
const { createPatientSchema, updatePatientSchema } = require('../utils/validators');

// ─────────────────────────────────────────────────────────────────────────────
// ATENÇÃO À ORDEM DAS ROTAS
//
// Rotas com segmentos literais (ex: /stats, /financial, /stats/period)
// DEVEM ser declaradas ANTES de rotas com parâmetros dinâmicos (ex: /:id).
//
// Se /:id vier antes, o Express interpreta "stats" como um id e chama getById,
// que tentará buscar um paciente com id="stats" e retornará 404.
// ─────────────────────────────────────────────────────────────────────────────

// Listagem geral (dashboard, lista de pacientes)
router.get('/',
  authenticateToken,
  PatientController.getAll
);

// Resumo histórico (sem filtro de período)
router.get('/stats',
  authenticateToken,
  PatientController.getStats
);

// NOVO: resumo financeiro de um período específico
// Ex: GET /patients/stats/period?start=2025-03-01&end=2025-03-31
router.get('/stats/period',
  authenticateToken,
  PatientController.getStatsByPeriod
);

// Financeiro com período — retorna alunos ativos + cálculos do intervalo
// Ex: GET /patients/financial?start=2025-03-01&end=2025-03-31
router.get('/financial',
  authenticateToken,
  PatientController.getFinancialByPeriod
);

// Detalhe de um aluno (com attendance e evolutions)
router.get('/:id',
  authenticateToken,
  PatientController.getById
);

router.post('/',
  authenticateToken,
  validate(createPatientSchema),
  PatientController.create
);

router.put('/:id',
  authenticateToken,
  validate(updatePatientSchema),
  PatientController.update
);

router.delete('/:id',
  authenticateToken,
  PatientController.delete
);

module.exports = router;