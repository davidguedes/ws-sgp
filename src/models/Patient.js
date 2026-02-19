const { query, getClient } = require('../config/database');

class PatientModel {
  static async findAll(profissionalId = null) {
    let sql = `
      SELECT 
        p.*,
        u.nome as profissional_nome,
        COUNT(DISTINCT a.id) as total_attendance,
        COUNT(DISTINCT e.id) as total_evolutions
      FROM patients p
      LEFT JOIN users u ON p.profissional_id = u.id
      LEFT JOIN attendance a ON p.id = a.patient_id
      LEFT JOIN evolutions e ON p.id = e.patient_id
    `;

    const params = [];
    if (profissionalId) {
      sql += ' WHERE p.profissional_id = $1';
      params.push(profissionalId);
    }

    sql += ' GROUP BY p.id, u.nome ORDER BY p.created_at DESC';

    const result = await query(sql, params);
    return result.rows.map(p => ({
      ...p,
      valor: Number(p.valor),
      porcentagem: Number(p.porcentagem),
      base: Number(p.base),
      ganho: Number(p.ganho),
      total_attendance: Number(p.total_attendance),
      total_evolutions: Number(p.total_evolutions),
    }));
  }

  static async findById(id) {
    const result = await query(
      `SELECT 
        p.*,
        u.nome as profissional_nome
      FROM patients p
      LEFT JOIN users u ON p.profissional_id = u.id
      WHERE p.id = $1`,
      [id]
    );
    return result.rows[0];
  }

  static async findByIdWithDetails(id) {
    const client = await getClient();
    
    try {
      // Buscar paciente
      const patientResult = await client.query(
        `SELECT 
          p.*,
          u.nome as profissional_nome
        FROM patients p
        LEFT JOIN users u ON p.profissional_id = u.id
        WHERE p.id = $1`,
        [id]
      );

      if (patientResult.rows.length === 0) {
        return null;
      }

      const patient = patientResult.rows[0];

      // Buscar frequências
      const attendanceResult = await client.query(
        `SELECT * FROM attendance WHERE patient_id = $1 ORDER BY date DESC`,
        [id]
      );

      // Buscar evoluções
      const evolutionsResult = await client.query(
        `SELECT * FROM evolutions WHERE patient_id = $1 ORDER BY date DESC`,
        [id]
      );

      return {
        ...patient,
        attendance: attendanceResult.rows,
        evolutions: evolutionsResult.rows
      };
    } finally {
      client.release();
    }
  }

  static async create(patientData) {
    const {
      nome,
      profissional_id,
      dias,
      horarios,
      valor,
      porcentagem,
      data_inicio,
      data_fim
    } = patientData;

    const base = (valor * porcentagem) / 100;
    const ganho = base - (base * 0.15);

    const result = await query(
      `INSERT INTO patients (
        nome, profissional_id, dias, horarios, valor, porcentagem,
        base, ganho, data_inicio, data_fim
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *`,
      [
        nome,
        profissional_id,
        dias,
        JSON.stringify(horarios || {}),
        valor,
        porcentagem,
        base,
        ganho,
        data_inicio,
        data_fim || null
      ]
    );

    return result.rows[0];
  }

  static async update(id, patientData) {
    const {
      nome,
      profissional_id,
      dias,
      horarios,
      valor,
      porcentagem,
      data_inicio,
      data_fim
    } = patientData;

    const base = (valor * porcentagem) / 100;
    const ganho = base - (base * 0.15);

    const result = await query(
      `UPDATE patients SET
        nome = $1,
        profissional_id = $2,
        dias = $3,
        horarios = $4,
        valor = $5,
        porcentagem = $6,
        base = $7,
        ganho = $8,
        data_inicio = $9,
        data_fim = $10
      WHERE id = $11
      RETURNING *`,
      [
        nome,
        profissional_id,
        dias,
        JSON.stringify(horarios || {}),
        valor,
        porcentagem,
        base,
        ganho,
        data_inicio,
        data_fim || null,
        id
      ]
    );

    return result.rows[0];
  }

  static async delete(id) {
    await query('DELETE FROM patients WHERE id = $1', [id]);
  }

  static async getStats(profissionalId = null) {
    let sql = `
      SELECT 
        COUNT(DISTINCT p.id) as total_alunos,
        COALESCE(SUM(p.ganho), 0) as ganho_total,
        COUNT(CASE WHEN a.status = 'present' THEN 1 END) as presencas,
        COUNT(CASE WHEN a.status = 'absent' THEN 1 END) as faltas
      FROM patients p
      LEFT JOIN attendance a ON p.id = a.patient_id
    `;

    const params = [];
    if (profissionalId) {
      sql += ' WHERE p.profissional_id = $1';
      params.push(profissionalId);
    }

    const result = await query(sql, params);
    const stats = result.rows[0];

    const total = parseInt(stats.presencas) + parseInt(stats.faltas);
    const taxaPresenca = total > 0 
      ? ((parseInt(stats.presencas) / total) * 100).toFixed(2)
      : 0;

    return {
      totalAlunos: parseInt(stats.total_alunos),
      ganhoTotal: parseFloat(stats.ganho_total),
      presencas: parseInt(stats.presencas),
      faltas: parseInt(stats.faltas),
      taxaPresenca: parseFloat(taxaPresenca)
    };
  }
}

module.exports = PatientModel;
