const express = require('express');
const router = express.Router();
const AuthController = require('../controllers/authController');
const { authenticateToken } = require('../middlewares/auth');
const { validate } = require('../middlewares/validator');
const { 
  loginSchema, 
  registerSchema,
  updatePasswordSchema 
} = require('../utils/validators');

// POST /api/auth/login - Login
router.post('/login', validate(loginSchema), AuthController.login);

// POST /api/auth/register - Registrar novo usuário (apenas gestor pode criar)
router.post('/register', 
  authenticateToken,
  validate(registerSchema), 
  AuthController.register
);

// GET /api/auth/me - Obter dados do usuário logado
router.get('/me', authenticateToken, AuthController.getMe);

// PUT /api/auth/password - Alterar senha
router.put('/password', 
  authenticateToken,
  validate(updatePasswordSchema),
  AuthController.updatePassword
);

router.get('/professionals', authenticateToken, AuthController.getProfessionals);

module.exports = router;
