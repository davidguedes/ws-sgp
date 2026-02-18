const express = require('express');
const router = express.Router();
const EvolutionController = require('../controllers/evolutionController');
const { authenticateToken } = require('../middlewares/auth');
const { validate } = require('../middlewares/validator');
const { 
  createEvolutionSchema, 
  updateEvolutionSchema 
} = require('../utils/validators');

// GET /api/patients/:patientId/evolutions - Listar evoluções do paciente
router.get('/:patientId/evolutions', 
  authenticateToken, 
  EvolutionController.getByPatient
);

// GET /api/patients/:patientId/evolutions/latest - Últimas evoluções
router.get('/:patientId/evolutions/latest', 
  authenticateToken, 
  EvolutionController.getLatest
);

// GET /api/patients/:patientId/evolutions/eva-average - Média EVA
router.get('/:patientId/evolutions/eva-average', 
  authenticateToken, 
  EvolutionController.getAverageEVA
);

// POST /api/patients/:patientId/evolutions - Criar evolução
router.post('/:patientId/evolutions',
  authenticateToken,
  validate(createEvolutionSchema),
  EvolutionController.create
);

// PUT /api/patients/:patientId/evolutions/:evolutionId - Atualizar evolução
router.put('/:patientId/evolutions/:evolutionId',
  authenticateToken,
  validate(updateEvolutionSchema),
  EvolutionController.update
);

// DELETE /api/patients/:patientId/evolutions/:evolutionId - Excluir evolução
router.delete('/:patientId/evolutions/:evolutionId',
  authenticateToken,
  EvolutionController.delete
);

module.exports = router;
