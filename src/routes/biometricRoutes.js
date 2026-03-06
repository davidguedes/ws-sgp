// Divide as rotas em dois grupos:
//   - Públicas: auth/begin e auth/complete (o aluno não está logado)
//   - Protegidas: registro e gestão (requer JWT de profissional/gestor)

const express  = require('express');
const router   = express.Router();
const BiometricController = require('../controllers/biometricController');
const { authenticateToken } = require('../middlewares/auth');

// ── ROTAS PÚBLICAS (sem JWT) ──────────────────────────────────────────────
// O aluno se identifica pela biometria — não existe "login" prévio.
router.post('/auth/begin',    BiometricController.authBegin);
router.post('/auth/complete', BiometricController.authComplete);

// ── ROTAS PROTEGIDAS (requer JWT) ────────────────────────────────────────
// Apenas profissional/gestor pode cadastrar e gerenciar biometrias.
router.use(authenticateToken);

router.post('/register/begin',    BiometricController.registerBegin);
router.post('/register/complete', BiometricController.registerComplete);
router.get('/:patientId',         BiometricController.listCredentials);
router.delete('/:patientId/:credentialId', BiometricController.deleteCredential);

module.exports = router;