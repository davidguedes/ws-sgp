const EvolutionModel = require('../models/Evolution');
const PatientModel = require('../models/Patient');
const UserModel = require('../models/User');

class EvolutionController {
  static async getByPatient(req, res, next) {
    try {
      const { patientId } = req.params;

      // Verificar se paciente existe e se usuário tem permissão
      const patient = await PatientModel.findById(patientId);
      
      if (!patient) {
        return res.status(404).json({
          success: false,
          message: 'Aluno não encontrado'
        });
      }

      if (req.user.role === 'profissional' && 
          patient.profissional_id !== req.user.userId) {
        return res.status(403).json({
          success: false,
          message: 'Sem permissão para acessar evoluções deste aluno'
        });
      }

      const evolutions = await EvolutionModel.findByPatientId(patientId);

      res.json({
        success: true,
        data: evolutions
      });
    } catch (error) {
      next(error);
    }
  }

  static async create(req, res, next) {
    try {
      const { patientId } = req.params;
      const { date, eva, exercises, notes } = req.body;

      // Verificar se paciente existe e se usuário tem permissão
      const patient = await PatientModel.findById(patientId);
      
      if (!patient) {
        return res.status(404).json({
          success: false,
          message: 'Aluno não encontrado'
        });
      }

      if (req.user.role === 'profissional' && 
          patient.profissional_id !== req.user.userId) {
        return res.status(403).json({
          success: false,
          message: 'Sem permissão para criar evolução para este aluno'
        });
      }

      // Buscar nome do autor
      const user = await UserModel.findById(req.user.userId);
      const author = user ? user.nome : 'Desconhecido';

      const evolution = await EvolutionModel.create(patientId, {
        date,
        eva,
        exercises,
        notes
      }, author);

      res.status(201).json({
        success: true,
        message: 'Evolução registrada com sucesso',
        data: evolution
      });
    } catch (error) {
      next(error);
    }
  }

  static async update(req, res, next) {
    try {
      const { patientId, evolutionId } = req.params;
      const { date, eva, exercises, notes } = req.body;

      // Verificar se paciente existe e se usuário tem permissão
      const patient = await PatientModel.findById(patientId);
      
      if (!patient) {
        return res.status(404).json({
          success: false,
          message: 'Aluno não encontrado'
        });
      }

      if (req.user.role === 'profissional' && 
          patient.profissional_id !== req.user.userId) {
        return res.status(403).json({
          success: false,
          message: 'Sem permissão para editar evolução deste aluno'
        });
      }

      // Verificar se evolução existe
      const existingEvolution = await EvolutionModel.findById(evolutionId);
      
      if (!existingEvolution) {
        return res.status(404).json({
          success: false,
          message: 'Evolução não encontrada'
        });
      }

      const evolution = await EvolutionModel.update(evolutionId, {
        date,
        eva,
        exercises,
        notes
      });

      res.json({
        success: true,
        message: 'Evolução atualizada com sucesso',
        data: evolution
      });
    } catch (error) {
      next(error);
    }
  }

  static async delete(req, res, next) {
    try {
      const { patientId, evolutionId } = req.params;

      // Verificar se paciente existe e se usuário tem permissão
      const patient = await PatientModel.findById(patientId);
      
      if (!patient) {
        return res.status(404).json({
          success: false,
          message: 'Aluno não encontrado'
        });
      }

      if (req.user.role === 'profissional' && 
          patient.profissional_id !== req.user.userId) {
        return res.status(403).json({
          success: false,
          message: 'Sem permissão para excluir evolução deste aluno'
        });
      }

      // Verificar se evolução existe
      const evolution = await EvolutionModel.findById(evolutionId);
      
      if (!evolution) {
        return res.status(404).json({
          success: false,
          message: 'Evolução não encontrada'
        });
      }

      await EvolutionModel.delete(evolutionId);

      res.json({
        success: true,
        message: 'Evolução excluída com sucesso'
      });
    } catch (error) {
      next(error);
    }
  }

  static async getLatest(req, res, next) {
    try {
      const { patientId } = req.params;
      const limit = parseInt(req.query.limit) || 5;

      // Verificar se paciente existe e se usuário tem permissão
      const patient = await PatientModel.findById(patientId);
      
      if (!patient) {
        return res.status(404).json({
          success: false,
          message: 'Aluno não encontrado'
        });
      }

      if (req.user.role === 'profissional' && 
          patient.profissional_id !== req.user.userId) {
        return res.status(403).json({
          success: false,
          message: 'Sem permissão para acessar evoluções deste aluno'
        });
      }

      const evolutions = await EvolutionModel.getLatestByPatient(patientId, limit);

      res.json({
        success: true,
        data: evolutions
      });
    } catch (error) {
      next(error);
    }
  }

  static async getAverageEVA(req, res, next) {
    try {
      const { patientId } = req.params;

      // Verificar se paciente existe e se usuário tem permissão
      const patient = await PatientModel.findById(patientId);
      
      if (!patient) {
        return res.status(404).json({
          success: false,
          message: 'Aluno não encontrado'
        });
      }

      if (req.user.role === 'profissional' && 
          patient.profissional_id !== req.user.userId) {
        return res.status(403).json({
          success: false,
          message: 'Sem permissão para acessar dados deste aluno'
        });
      }

      const averageEVA = await EvolutionModel.getAverageEVA(patientId);

      res.json({
        success: true,
        data: {
          averageEVA: averageEVA ? parseFloat(averageEVA) : null
        }
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = EvolutionController;
