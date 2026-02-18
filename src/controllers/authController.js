const jwt = require('jsonwebtoken');
const UserModel = require('../models/User');

class AuthController {
  static async login(req, res, next) {
    try {
      const { email, senha } = req.body;

      // Buscar usuário
      const user = await UserModel.findByEmail(email);
      
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Credenciais inválidas'
        });
      }

      // Verificar senha
      const isPasswordValid = await UserModel.comparePassword(senha, user.senha);
      
      if (!isPasswordValid) {
        return res.status(401).json({
          success: false,
          message: 'Credenciais inválidas'
        });
      }

      // Gerar token
      const token = jwt.sign(
        { 
          userId: user.id,
          email: user.email,
          role: user.role
        },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN }
      );

      // Remover senha do objeto
      const { senha: _, ...userWithoutPassword } = user;

      res.json({
        success: true,
        token,
        user: userWithoutPassword
      });
    } catch (error) {
      next(error);
    }
  }

  static async getMe(req, res, next) {
    try {
      const user = await UserModel.findById(req.user.userId);
      
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Usuário não encontrado'
        });
      }

      res.json({
        success: true,
        user
      });
    } catch (error) {
      next(error);
    }
  }

  static async register(req, res, next) {
    try {
      const { nome, email, senha, role } = req.body;

      // Verificar se usuário já existe
      const existingUser = await UserModel.findByEmail(email);
      
      if (existingUser) {
        return res.status(409).json({
          success: false,
          message: 'Este e-mail já está em uso'
        });
      }

      // Criar novo usuário
      const user = await UserModel.create({ nome, email, senha, role });

      // Gerar token
      const token = jwt.sign(
        { 
          userId: user.id,
          email: user.email,
          role: user.role
        },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN }
      );

      res.status(201).json({
        success: true,
        token,
        user
      });
    } catch (error) {
      next(error);
    }
  }

  static async updatePassword(req, res, next) {
    try {
      const { senhaAtual, novaSenha } = req.body;
      const userId = req.user.userId;

      // Buscar usuário com senha
      const user = await UserModel.findByEmail(req.user.email);
      
      // Verificar senha atual
      const isPasswordValid = await UserModel.comparePassword(senhaAtual, user.senha);
      
      if (!isPasswordValid) {
        return res.status(401).json({
          success: false,
          message: 'Senha atual incorreta'
        });
      }

      // Atualizar senha
      await UserModel.updatePassword(userId, novaSenha);

      res.json({
        success: true,
        message: 'Senha atualizada com sucesso'
      });
    } catch (error) {
      next(error);
    }
  }

  static async getProfessionals(req, res, next) {
    try {
      const professionals = await UserModel.getProfessionals();

      res.json({
        success: true,
        data: professionals
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = AuthController;
