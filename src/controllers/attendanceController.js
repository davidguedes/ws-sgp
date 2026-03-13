const AttendanceModel = require('../models/Attendance');
const PatientModel = require('../models/Patient');

class AttendanceController {
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
          message: 'Sem permissão para acessar frequências deste aluno'
        });
      }

      const attendance = await AttendanceModel.findByPatientId(patientId);

      res.json({
        success: true,
        data: attendance
      });
    } catch (error) {
      next(error);
    }
  }

  static async create(req, res, next) {
    try {
      const { patientId } = req.params;
      const { date, status, notes } = req.body;

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
          message: 'Sem permissão para registrar frequência deste aluno'
        });
      }

      // Verificar duplicidade
      const isDuplicate = await AttendanceModel.checkDuplicate(patientId, date);
      
      if (isDuplicate) {
        return res.status(409).json({
          success: false,
          message: 'Já existe um registro de frequência para esta data'
        });
      }

      const attendance = await AttendanceModel.create(patientId, {
        date,
        status,
        notes
      });

      res.status(201).json({
        success: true,
        message: 'Frequência registrada com sucesso',
        data: attendance
      });
    } catch (error) {
      next(error);
    }
  }

  static async update(req, res, next) {
    try {
      const { patientId, attendanceId } = req.params;
      const { date, status, notes } = req.body;

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
          message: 'Sem permissão para editar frequência deste aluno'
        });
      }

      // Verificar se frequência existe
      const existingAttendance = await AttendanceModel.findById(attendanceId);
      
      if (!existingAttendance) {
        return res.status(404).json({
          success: false,
          message: 'Registro de frequência não encontrado'
        });
      }

      // Verificar duplicidade (excluindo o registro atual)
      const isDuplicate = await AttendanceModel.checkDuplicate(
        patientId, 
        date, 
        attendanceId
      );
      
      if (isDuplicate) {
        return res.status(409).json({
          success: false,
          message: 'Já existe um registro de frequência para esta data'
        });
      }

      const attendance = await AttendanceModel.update(attendanceId, {
        date,
        status,
        notes
      });

      res.json({
        success: true,
        message: 'Frequência atualizada com sucesso',
        data: attendance
      });
    } catch (error) {
      next(error);
    }
  }

  static async delete(req, res, next) {
    try {
      const { patientId, attendanceId } = req.params;

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
          message: 'Sem permissão para excluir frequência deste aluno'
        });
      }

      // Verificar se frequência existe
      const attendance = await AttendanceModel.findById(attendanceId);
      
      if (!attendance) {
        return res.status(404).json({
          success: false,
          message: 'Registro de frequência não encontrado'
        });
      }

      await AttendanceModel.delete(attendanceId);

      res.json({
        success: true,
        message: 'Frequência excluída com sucesso'
      });
    } catch (error) {
      next(error);
    }
  }

  static async getStats(req, res, next) {
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
          message: 'Sem permissão para acessar estatísticas deste aluno'
        });
      }

      const stats = await AttendanceModel.getStats(patientId);

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      next(error);
    }
  }

  static async getByDate(req, res, next) {
    try {
      const { date } = req.query;
      if (!date) {
        return res.status(400).json({ success: false, message: 'Parâmetro date é obrigatório (YYYY-MM-DD)' });
      }

      const profissionalId = req.user.role === 'profissional' ? req.user.userId : null;
      const attendance = await AttendanceModel.getByDate(date, profissionalId);

      res.json({ success: true, data: attendance });
    } catch (error) {
      next(error);
    }
  }

  static async createAvulso(req, res, next) {
    try {
      const { patient_ids, date, valor, notes } = req.body;

      if (!patient_ids?.length || !date || !valor) {
        return res.status(400).json({
          success: false,
          message: 'patient_ids, date e valor são obrigatórios'
        });
      }

      const records = await AttendanceModel.createAvulso({
        patient_ids,
        date,
        valor,
        notes,
        profissional_id: req.user.userId
      });

      res.status(201).json({ success: true, data: records });
    } catch (error) {
      next(error);
    }
  }

  static async getAvulsoByPeriod(req, res, next) {
    try {
      const { start, end } = req.query;
      if (!start || !end) {
        return res.status(400).json({ success: false, message: 'Parâmetros start e end são obrigatórios (YYYY-MM-DD)' });
      }
      const profissionalId = req.user.role === 'profissional' ? req.user.userId : null;
      const data = await AttendanceModel.getAvulsoByPeriod(start, end, profissionalId);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  // ─────────────────────────────────────────────
  // REPOSIÇÕES PENDENTES
  // ─────────────────────────────────────────────

  /**
   * GET /attendance/pending-makeups?date=YYYY-MM-DD
   *
   * Lista todos os registros makeup ainda não repostos no mês da data.
   * Filtrado automaticamente pelo profissional logado.
   * Retorna array de { id, patient_id, patient_nome, date, notes }.
   */
  static async getPendingMakeups(req, res, next) {
    try {
      const { date } = req.query;
      if (!date) {
        return res.status(400).json({ success: false, message: 'Parâmetro date é obrigatório (YYYY-MM-DD)' });
      }

      const profissionalId = req.user.role === 'profissional' ? req.user.userId : null;
      if (!profissionalId) {
        // Gestor: retorna lista vazia — alerta não se aplica a gestor
        return res.json({ success: true, data: [] });
      }

      const data = await AttendanceModel.getPendingMakeups(profissionalId, date);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /attendance/resolve-reposto
   *
   * Body: { makeupId, presentPatientId, presentDate, existingAttendanceId? }
   *
   * Atomicamente:
   *   1. Marca o registro makeup (makeupId) como reposto = TRUE
   *   2. Cria ou atualiza um registro 'present' para presentPatientId
   *      em presentDate, vinculado via makeup_origin_id
   */
  static async resolveReposto(req, res, next) {
    try {
      const { makeupId, presentPatientId, presentDate, existingAttendanceId } = req.body;

      if (!makeupId || !presentPatientId || !presentDate) {
        return res.status(400).json({
          success: false,
          message: 'makeupId, presentPatientId e presentDate são obrigatórios'
        });
      }

      // Verificar permissão: o aluno que está sendo marcado deve pertencer ao profissional
      const patient = await PatientModel.findById(presentPatientId);
      if (!patient) {
        return res.status(404).json({ success: false, message: 'Aluno não encontrado' });
      }
      if (req.user.role === 'profissional' && patient.profissional_id !== req.user.userId) {
        return res.status(403).json({ success: false, message: 'Sem permissão para registrar frequência deste aluno' });
      }

      const result = await AttendanceModel.resolveReposto(
        makeupId,
        presentPatientId,
        presentDate,
        existingAttendanceId || null
      );

      res.status(201).json({
        success: true,
        message: 'Reposição registrada com sucesso',
        data: result
      });
    } catch (error) {
      // Erros de negócio (makeup já reposto, não encontrado) viram 409
      if (error.message?.includes('já foi quitada') || error.message?.includes('não encontrado')) {
        return res.status(409).json({ success: false, message: error.message });
      }
      next(error);
    }
  }
}

module.exports = AttendanceController;