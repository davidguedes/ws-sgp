const PatientModel = require('../models/Patient');

class PatientController {
  static async getAll(req, res, next) {
    try {
      const profissionalId = req.user.role === 'profissional'
        ? req.user.userId
        : null;

      const patients = await PatientModel.findAll(profissionalId);

      res.json({ success: true, data: patients });
    } catch (error) {
      next(error);
    }
  }

  static async getById(req, res, next) {
    try {
      const { id } = req.params;
      const patient = await PatientModel.findByIdWithDetails(id);

      if (!patient) {
        return res.status(404).json({ success: false, message: 'Aluno não encontrado' });
      }

      // Number() garante comparação correta: userId do JWT pode chegar como string
      if (req.user.role === 'profissional' && patient.profissional_id !== Number(req.user.userId)) {
        return res.status(403).json({ success: false, message: 'Sem permissão para acessar este aluno' });
      }

      res.json({ success: true, data: patient });
    } catch (error) {
      next(error);
    }
  }

  static async create(req, res, next) {
    try {
      // ganho_fixo vem como número ou null/undefined
      const ganhoFixoRaw = req.body.ganho_fixo;
      const ganho_fixo = ganhoFixoRaw != null && ganhoFixoRaw !== '' ? Number(ganhoFixoRaw) : null;

      const patientData = {
        nome:            req.body.nome,
        profissional_id: req.body.profissional || req.body.profissional_id,
        dias:            req.body.dias,
        horarios:        req.body.horarios,
        valor:           req.body.valor,
        porcentagem:     req.body.porcentagem,
        ganho_fixo,
        tipo:            req.body.tipo || 'fixo',
        data_inicio:     req.body.data_inicio,
        data_fim:        req.body.data_fim || null
      };

      const patient = await PatientModel.create(patientData);

      res.status(201).json({ success: true, message: 'Aluno criado com sucesso', data: patient });
    } catch (error) {
      next(error);
    }
  }

  static async update(req, res, next) {
    try {
      const { id } = req.params;
      const existing = await PatientModel.findById(id);

      if (!existing) {
        return res.status(404).json({ success: false, message: 'Aluno não encontrado' });
      }

      if (req.user.role === 'profissional' && existing.profissional_id !== Number(req.user.userId)) {
        return res.status(403).json({ success: false, message: 'Sem permissão para editar este aluno' });
      }

      const ganhoFixoRaw = req.body.ganho_fixo;
      const ganho_fixo = ganhoFixoRaw != null && ganhoFixoRaw !== '' ? Number(ganhoFixoRaw) : null;

      const patientData = {
        nome:            req.body.nome,
        profissional_id: req.body.profissional || req.body.profissional_id,
        dias:            req.body.dias,
        horarios:        req.body.horarios,
        valor:           req.body.valor,
        porcentagem:     req.body.porcentagem,
        ganho_fixo,
        tipo:            req.body.tipo || 'fixo',
        data_inicio:     req.body.data_inicio,
        data_fim:        req.body.data_fim || null
      };

      const patient = await PatientModel.update(id, patientData);

      res.json({ success: true, message: 'Aluno atualizado com sucesso', data: patient });
    } catch (error) {
      next(error);
    }
  }

  static async delete(req, res, next) {
    try {
      const { id } = req.params;
      const patient = await PatientModel.findById(id);

      if (!patient) {
        return res.status(404).json({ success: false, message: 'Aluno não encontrado' });
      }

      if (req.user.role === 'profissional' && patient.profissional_id !== Number(req.user.userId)) {
        return res.status(403).json({ success: false, message: 'Sem permissão para excluir este aluno' });
      }

      await PatientModel.delete(id);

      res.json({ success: true, message: 'Aluno excluído com sucesso' });
    } catch (error) {
      next(error);
    }
  }

  static async getFinancialByPeriod(req, res, next) {
    try {
      const { start, end } = req.query;

      if (!start || !end) {
        return res.status(400).json({
          success: false,
          message: 'Parâmetros start e end são obrigatórios (YYYY-MM-DD)'
        });
      }

      // Validação básica de formato para evitar SQL injection via parâmetro malformado
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(start) || !dateRegex.test(end)) {
        return res.status(400).json({
          success: false,
          message: 'Formato inválido. Use YYYY-MM-DD'
        });
      }

      const profissionalId = req.user.role === 'profissional'
        ? req.user.userId
        : null;

      const patients = await PatientModel.findAllWithPeriod(profissionalId, start, end);

      res.json({ success: true, data: patients });
    } catch (error) {
      next(error);
    }
  }

  static async getStats(req, res, next) {
    try {
      const profissionalId = req.user.role === 'profissional'
        ? Number(req.user.userId)
        : null;

      const stats = await PatientModel.getStats(profissionalId);

      res.json({ success: true, data: stats });
    } catch (error) {
      next(error);
    }
  }

  // GET /patients/stats/period?start=YYYY-MM-DD&end=YYYY-MM-DD
  //
  // Retorna os mesmos campos de getStats mas calculados dentro do período:
  // - aulas_realizadas conta apenas present/makeup entre start e end
  // - total_alunos conta apenas os ativos no intervalo (data_inicio <= end AND data_fim >= start)
  // - ganho_total usa ganho_liquido_periodo proporcional ao período
  //
  // Usado pelo dashboard gestor para garantir que os KPIs batem
  // com o que o financeiro mostra para o mesmo período.
  static async getStatsByPeriod(req, res, next) {
    try {
      const { start, end } = req.query;

      if (!start || !end) {
        return res.status(400).json({
          success: false,
          message: 'Parâmetros start e end são obrigatórios (YYYY-MM-DD)'
        });
      }

      if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) {
        return res.status(400).json({
          success: false,
          message: 'Formato inválido. Use YYYY-MM-DD'
        });
      }

      const profissionalId = req.user.role === 'profissional'
        ? Number(req.user.userId)
        : null;

      const stats = await PatientModel.getStatsByPeriod(profissionalId, start, end);

      res.json({ success: true, data: stats });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = PatientController;