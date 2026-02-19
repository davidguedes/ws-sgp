const { query } = require('../config/database');

class AttendanceModel {
  static async findByPatientId(patientId) {
    const result = await query(
      'SELECT * FROM attendance WHERE patient_id = $1 ORDER BY date DESC',
      [patientId]
    );
    return result.rows;
  }

  static async findById(id) {
    const result = await query(
      'SELECT * FROM attendance WHERE id = $1',
      [id]
    );
    return result.rows[0];
  }

  static async create(patientId, attendanceData) {
    const { date, status, notes } = attendanceData;

    const result = await query(
      `INSERT INTO attendance (patient_id, date, status, notes)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [patientId, date, status, notes || '']
    );

    return result.rows[0];
  }

  static async update(id, attendanceData) {
    const { date, status, notes } = attendanceData;

    const result = await query(
      `UPDATE attendance 
       SET date = $1, status = $2, notes = $3
       WHERE id = $4
       RETURNING *`,
      [date, status, notes || '', id]
    );

    return result.rows[0];
  }

  static async delete(id) {
    await query('DELETE FROM attendance WHERE id = $1', [id]);
  }

  static async getStats(patientId) {
    const result = await query(
      `SELECT 
        COUNT(CASE WHEN status = 'present' THEN 1 END) as present,
        COUNT(CASE WHEN status = 'absent' THEN 1 END) as absent,
        COUNT(CASE WHEN status = 'makeup' THEN 1 END) as makeup,
        COUNT(*) as total
      FROM attendance
      WHERE patient_id = $1`,
      [patientId]
    );

    const stats = result.rows[0];
    const attendanceRate = stats.total > 0
      ? ((parseInt(stats.present) / parseInt(stats.total)) * 100).toFixed(2)
      : 0;

    return {
      present: parseInt(stats.present),
      absent: parseInt(stats.absent),
      makeup: parseInt(stats.makeup),
      total: parseInt(stats.total),
      attendanceRate: parseFloat(attendanceRate)
    };
  }

  static async checkDuplicate(patientId, date, excludeId = null) {
    let sql = 'SELECT id FROM attendance WHERE patient_id = $1 AND date = $2';
    const params = [patientId, date];

    if (excludeId) {
      sql += ' AND id != $3';
      params.push(excludeId);
    }

    const result = await query(sql, params);
    return result.rows.length > 0;
  }

  static async getByDate(date, profissionalId = null) {
    let sql = `
      SELECT a.*
      FROM attendance a
      JOIN patients p ON a.patient_id = p.id
      WHERE DATE(a.date) = $1
    `;
    const params = [date];
    if (profissionalId) {
      sql += ' AND p.profissional_id = $2';
      params.push(profissionalId);
    }
    const result = await query(sql, params);
    return result.rows;
  }
}

module.exports = AttendanceModel;
