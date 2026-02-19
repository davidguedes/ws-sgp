const express = require('express');
const router = express.Router();
const PatientController = require('../controllers/patientController');
const { authenticateToken } = require('../middlewares/auth');
const { validate } = require('../middlewares/validator');
const { createPatientSchema, updatePatientSchema } = require('../utils/validators');

router.get('/',      authenticateToken, PatientController.getAll);
// /stats DEVE ficar antes de /:id para não ser capturado como parâmetro
router.get('/stats', authenticateToken, PatientController.getStats);
router.get('/:id',   authenticateToken, PatientController.getById);

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

router.delete('/:id', authenticateToken, PatientController.delete);

module.exports = router;