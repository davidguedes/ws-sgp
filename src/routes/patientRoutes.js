const express = require('express');
const router = express.Router();
const PatientController = require('../controllers/patientController');
const { authenticateToken } = require('../middlewares/auth');
const { validate } = require('../middlewares/validator');
const { 
  createPatientSchema, 
  updatePatientSchema 
} = require('../utils/validators');

// GET /api/patients - Listar todos os pacientes
router.get('/', authenticateToken, PatientController.getAll);

// GET /api/patients/stats - Obter estatísticas
router.get('/stats', authenticateToken, PatientController.getStats);

// GET /api/patients/:id - Obter um paciente específico
router.get('/:id', authenticateToken, PatientController.getById);

// POST /api/patients - Criar novo paciente
router.post('/', 
  authenticateToken,
  validate(createPatientSchema),
  PatientController.create
);

// PUT /api/patients/:id - Atualizar paciente
router.put('/:id', 
  authenticateToken,
  validate(updatePatientSchema),
  PatientController.update
);

// DELETE /api/patients/:id - Excluir paciente
router.delete('/:id', authenticateToken, PatientController.delete);

module.exports = router;
