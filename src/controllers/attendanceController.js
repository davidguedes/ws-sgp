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
}

module.exports = AttendanceController;
