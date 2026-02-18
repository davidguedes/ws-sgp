const PatientModel = require('../models/Patient');

class PatientController {
  static async getAll(req, res, next) {
    try {
      const profissionalId = req.user.role === 'profissional' 
        ? req.user.userId 
        : null;

      const patients = await PatientModel.findAll(profissionalId);

      res.json({
        success: true,
        data: patients
      });
    } catch (error) {
      next(error);
    }
  }

  static async getById(req, res, next) {
    try {
      const { id } = req.params;
      const patient = await PatientModel.findByIdWithDetails(id);

      if (!patient) {
        return res.status(404).json({
          success: false,
          message: 'Aluno não encontrado'
        });
      }

      // Verificar permissão
      if (req.user.role === 'profissional' && 
          patient.profissional_id !== req.user.userId) {
        return res.status(403).json({
          success: false,
          message: 'Você não tem permissão para acessar este aluno'
        });
      }

      res.json({
        success: true,
        data: patient
      });
    } catch (error) {
      next(error);
    }
  }

  static async create(req, res, next) {
    try {
      const patientData = {
        nome: req.body.nome,
        profissional_id: req.body.profissional || req.body.profissional_id,
        dias: req.body.dias,
        horarios: req.body.horarios,
        valor: req.body.valor,
        porcentagem: req.body.porcentagem,
        data_inicio: req.body.data_inicio || req.body.data_inicio,
        data_fim: req.body.data_fim || req.body.data_fim
      };

      const patient = await PatientModel.create(patientData);

      res.status(201).json({
        success: true,
        message: 'Aluno criado com sucesso',
        data: patient
      });
    } catch (error) {
      next(error);
    }
  }

  static async update(req, res, next) {
    try {
      const { id } = req.params;

      // Verificar se aluno existe
      const existingPatient = await PatientModel.findById(id);
      
      console.log('existingPatient', existingPatient);
      if (!existingPatient) {
        return res.status(404).json({
          success: false,
          message: 'Aluno não encontrado'
        });
      }

      // Verificar permissão
      if (req.user.role === 'profissional' && 
          existingPatient.profissional_id !== req.user.userId) {
        return res.status(403).json({
          success: false,
          message: 'Você não tem permissão para editar este aluno'
        });
      }

      const patientData = {
        nome: req.body.nome,
        profissional_id: req.body.profissional || req.body.profissional_id,
        dias: req.body.dias,
        horarios: req.body.horarios,
        valor: req.body.valor,
        porcentagem: req.body.porcentagem,
        data_inicio: req.body.data_inicio || req.body.data_inicio,
        data_fim: req.body.data_fim || req.body.data_fim
      };

      const patient = await PatientModel.update(id, patientData);

      res.json({
        success: true,
        message: 'Aluno atualizado com sucesso',
        data: patient
      });
    } catch (error) {
      console.error(error);
      next(error);
    }
  }

  static async delete(req, res, next) {
    try {
      const { id } = req.params;

      // Verificar se aluno existe
      const patient = await PatientModel.findById(id);
      
      if (!patient) {
        return res.status(404).json({
          success: false,
          message: 'Aluno não encontrado'
        });
      }

      // Verificar permissão
      if (req.user.role === 'profissional' && 
          patient.profissional_id !== req.user.userId) {
        return res.status(403).json({
          success: false,
          message: 'Você não tem permissão para excluir este aluno'
        });
      }

      await PatientModel.delete(id);

      res.json({
        success: true,
        message: 'Aluno excluído com sucesso'
      });
    } catch (error) {
      next(error);
    }
  }

  static async getStats(req, res, next) {
    try {
      const profissionalId = req.user.role === 'profissional' 
        ? req.user.userId 
        : null;

      const stats = await PatientModel.getStats(profissionalId);

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = PatientController;
