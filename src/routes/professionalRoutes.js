const express = require('express');
const router = express.Router();
const UserController = require('../controllers/userController');
const { authenticateToken } = require('../middlewares/auth');

router.get('/professionals', authenticateToken, UserController.getAllProfessionals);
router.post('/professionals', authenticateToken, UserController.createProfessional);
router.put('/professionals/:id', authenticateToken, UserController.updateProfessional);
router.delete('/professionals/:id', authenticateToken, UserController.deleteProfessional);

router.get('/', authenticateToken, UserController.getAll);
router.post('/', authenticateToken, UserController.create);
router.put('/:id', authenticateToken, UserController.update);
router.delete('/:id', authenticateToken, UserController.delete);

module.exports = router;