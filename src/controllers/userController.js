const UserModel = require('../models/User');

class UserController {

  // GET /users
  static async getAll(req, res, next) {
    try {
      const professionals = await UserModel.findAll();
      res.json({ success: true, data: professionals });
    } catch (error) {
      next(error);
    }
  }

  // GET /users/professionals
  static async getAllProfessionals(req, res, next) {
    try {
      const professionals = await UserModel.findAllProfessionals();
      res.json({ success: true, data: professionals });
    } catch (error) {
      next(error);
    }
  }

  // GET /users/professionals/:id
  static async getById(req, res, next) {
    try {
      const user = await UserModel.findById(req.params.id);
      if (!user) {
        return res.status(404).json({ success: false, message: 'Profissional não encontrado' });
      }
      res.json({ success: true, data: user });
    } catch (error) {
      next(error);
    }
  }

  // POST /users
  static async create(req, res, next) {
    try {
      const { nome, email, senha } = req.body;

      if (!nome?.trim() || !email?.trim() || !senha?.trim()) {
        return res.status(400).json({ success: false, message: 'Nome, e-mail e senha são obrigatórios' });
      }

      const emailInUse = await UserModel.emailExists(email);
      if (emailInUse) {
        return res.status(409).json({ success: false, message: 'Este e-mail já está em uso' });
      }

      const user = await UserModel.create({ nome, email, senha, role: 'profissional' });
      res.status(201).json({ success: true, message: 'Profissional criado com sucesso', data: user });
    } catch (error) {
      next(error);
    }
  }

  // POST /users/professionals
  static async createProfessional(req, res, next) {
    try {
      const { nome, email, senha } = req.body;

      if (!nome?.trim() || !email?.trim() || !senha?.trim()) {
        return res.status(400).json({ success: false, message: 'Nome, e-mail e senha são obrigatórios' });
      }

      const emailInUse = await UserModel.emailExists(email);
      if (emailInUse) {
        return res.status(409).json({ success: false, message: 'Este e-mail já está em uso' });
      }

      const user = await UserModel.createProfessional({ nome, email, senha, role: 'profissional' });
      res.status(201).json({ success: true, message: 'Profissional criado com sucesso', data: user });
    } catch (error) {
      next(error);
    }
  }

  // PUT /users/:id
  static async update(req, res, next) {
    try {
      const { id } = req.params;
      const { nome, email, senha } = req.body;

      if (!nome?.trim() || !email?.trim()) {
        return res.status(400).json({ success: false, message: 'Nome e e-mail são obrigatórios' });
      }

      const existing = await UserModel.findById(id);
      if (!existing) {
        return res.status(404).json({ success: false, message: 'Profissional não encontrado' });
      }

      const emailInUse = await UserModel.emailExists(email, id);
      if (emailInUse) {
        return res.status(409).json({ success: false, message: 'Este e-mail já está em uso' });
      }

      const user = await UserModel.update(id, { nome, email, senha: senha || null });
      res.json({ success: true, message: 'Profissional atualizado com sucesso', data: user });
    } catch (error) {
      next(error);
    }
  }

  // PUT /users/professionals/:id
  static async updateProfessional(req, res, next) {
    try {
      const { id } = req.params;
      const { nome, email, senha } = req.body;

      if (!nome?.trim() || !email?.trim()) {
        return res.status(400).json({ success: false, message: 'Nome e e-mail são obrigatórios' });
      }

      const existing = await UserModel.findById(id);
      if (!existing) {
        return res.status(404).json({ success: false, message: 'Profissional não encontrado' });
      }

      const emailInUse = await UserModel.emailExists(email, id);
      if (emailInUse) {
        return res.status(409).json({ success: false, message: 'Este e-mail já está em uso' });
      }

      const user = await UserModel.updateProfessional(id, { nome, email, senha: senha || null });
      res.json({ success: true, message: 'Profissional atualizado com sucesso', data: user });
    } catch (error) {
      next(error);
    }
  }

  // DELETE /users/:id
  static async delete(req, res, next) {
    try {
      const { id } = req.params;

      const existing = await UserModel.findById(id);
      if (!existing) {
        return res.status(404).json({ success: false, message: 'Profissional não encontrado' });
      }

      const hasPatients = await UserModel.hasPatients(id);
      if (hasPatients) {
        return res.status(409).json({
          success: false,
          message: 'Não é possível excluir: profissional possui alunos vinculados'
        });
      }

      await UserModel.delete(id);
      res.json({ success: true, message: 'Profissional excluído com sucesso' });
    } catch (error) {
      next(error);
    }
  }

  // DELETE /users/professionals/:id
  static async deleteProfessional(req, res, next) {
    try {
      const { id } = req.params;

      const existing = await UserModel.findById(id);
      if (!existing) {
        return res.status(404).json({ success: false, message: 'Profissional não encontrado' });
      }

      const hasPatients = await UserModel.hasPatients(id);
      if (hasPatients) {
        return res.status(409).json({
          success: false,
          message: 'Não é possível excluir: profissional possui alunos vinculados'
        });
      }

      await UserModel.delete(id);
      res.json({ success: true, message: 'Profissional excluído com sucesso' });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = UserController;