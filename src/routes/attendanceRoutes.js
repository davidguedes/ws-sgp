const express = require('express');
const router = express.Router();
const AttendanceController = require('../controllers/attendanceController');
const { authenticateToken } = require('../middlewares/auth');
const { validate } = require('../middlewares/validator');
const { 
  createAttendanceSchema, 
  updateAttendanceSchema 
} = require('../utils/validators');

router.get('/', authenticateToken, AttendanceController.getByDate);

// ✅ Rotas estáticas PRIMEIRO
router.post('/avulso', authenticateToken, AttendanceController.createAvulso);
router.get('/avulso', authenticateToken, AttendanceController.getAvulsoByPeriod);
router.get('/pending-makeups', authenticateToken, AttendanceController.getPendingMakeups);
router.post('/resolve-reposto', authenticateToken, AttendanceController.resolveReposto);

// ✅ Rotas dinâmicas DEPOIS
router.get('/:patientId/attendance', authenticateToken, AttendanceController.getByPatient);
router.get('/:patientId/attendance/stats', authenticateToken, AttendanceController.getStats);
router.post('/:patientId/attendance', authenticateToken, validate(createAttendanceSchema), AttendanceController.create);
router.put('/:patientId/attendance/:attendanceId', authenticateToken, validate(updateAttendanceSchema), AttendanceController.update);
router.delete('/:patientId/attendance/:attendanceId', authenticateToken, AttendanceController.delete);

module.exports = router;