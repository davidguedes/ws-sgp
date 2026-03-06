const express    = require('express');
const router     = express.Router();
const Biometric  = require('../controllers/biometricController');
const { authenticateToken } = require('../middlewares/auth');

// ── ROTAS PÚBLICAS ────────────────────────────────────────────────────────
// Autenticação identificada (patientId conhecido)
router.post('/auth/begin',    Biometric.authBegin);
router.post('/auth/complete', Biometric.authComplete);

// Check-in discoverable — "modo academia" (sem patientId)
router.post('/checkin/begin',    Biometric.checkinBegin);
router.post('/checkin/complete', Biometric.checkinComplete);

// ── ROTAS PROTEGIDAS (JWT) ────────────────────────────────────────────────
router.use(authenticateToken);

router.post('/register/begin',              Biometric.registerBegin);
router.post('/register/complete',           Biometric.registerComplete);
router.get('/:patientId',                   Biometric.listCredentials);
router.delete('/:patientId/:credentialId',  Biometric.deleteCredential);

module.exports = router;