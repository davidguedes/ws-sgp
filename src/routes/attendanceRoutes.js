const express = require('express');
const router = express.Router();
const AttendanceController = require('../controllers/attendanceController');
const { authenticateToken } = require('../middlewares/auth');
const { validate } = require('../middlewares/validator');
const { 
  createAttendanceSchema, 
  updateAttendanceSchema 
} = require('../utils/validators');

// GET /api/patients/:patientId/attendance - Listar frequências do paciente
router.get('/:patientId/attendance', 
  authenticateToken, 
  AttendanceController.getByPatient
);

// GET /api/patients/:patientId/attendance/stats - Estatísticas de frequência
router.get('/:patientId/attendance/stats', 
  authenticateToken, 
  AttendanceController.getStats
);

// POST /api/patients/:patientId/attendance - Criar registro de frequência
router.post('/:patientId/attendance',
  authenticateToken,
  validate(createAttendanceSchema),
  AttendanceController.create
);

// PUT /api/patients/:patientId/attendance/:attendanceId - Atualizar frequência
router.put('/:patientId/attendance/:attendanceId',
  authenticateToken,
  validate(updateAttendanceSchema),
  AttendanceController.update
);

// DELETE /api/patients/:patientId/attendance/:attendanceId - Excluir frequência
router.delete('/:patientId/attendance/:attendanceId',
  authenticateToken,
  AttendanceController.delete
);

module.exports = router;
