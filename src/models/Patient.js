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
      tipo: p.tipo || 'fixo',
      valor: Number(p.valor),
      porcentagem: Number(p.porcentagem),
      base: Number(p.base),
      ganho: Number(p.ganho),
      ganho_fixo: p.ganho_fixo != null ? Number(p.ganho_fixo) : null,
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

      const attendanceResult = await client.query(
        `SELECT * FROM attendance WHERE patient_id = $1 ORDER BY date DESC`,
        [id]
      );

      const evolutionsResult = await client.query(
        `SELECT * FROM evolutions WHERE patient_id = $1 ORDER BY date DESC`,
        [id]
      );

      return {
        ...patient,
        ganho_fixo: patient.ganho_fixo != null ? Number(patient.ganho_fixo) : null,
        attendance: attendanceResult.rows,
        evolutions: evolutionsResult.rows
      };
    } finally {
      client.release();
    }
  }

  /**
   * Calcula base e ganho considerando ganho_fixo.
   * Se ganho_fixo estiver definido, ele é usado diretamente como ganho líquido.
   * Caso contrário, usa o cálculo padrão: (valor * porcentagem / 100) * 0.85
   */
  static _calcularGanho(valor, porcentagem, ganho_fixo, tipo) {
    if (tipo === 'experimental') return { base: 0, ganho: 0 };
    const base = (valor * porcentagem) / 100;
    const ganho = ganho_fixo != null
      ? Number(ganho_fixo)
      : base - (base * 0.15);
    return { base, ganho };
  }

  static async create(patientData) {
    const {
      nome,
      profissional_id,
      dias,
      horarios,
      valor,
      porcentagem,
      ganho_fixo,
      tipo = 'fixo',
      data_inicio,
      data_fim
    } = patientData;

    const isExp = tipo === 'experimental';
    const { base, ganho } = PatientModel._calcularGanho(
      isExp ? 0 : valor,
      isExp ? 0 : porcentagem,
      isExp ? null : (ganho_fixo ?? null),
      tipo
    );

    console.log(nome,
        profissional_id,
        dias,
        JSON.stringify(horarios || {}),
        isExp ? 0 : valor,
        isExp ? 0 : porcentagem,
        base,
        ganho,
        isExp ? null : (ganho_fixo ?? null),
        tipo,
        data_inicio,
        data_fim || null);
    
    const result = await query(
      `INSERT INTO patients (
        nome, profissional_id, dias, horarios, valor, porcentagem,
        base, ganho, ganho_fixo, tipo, data_inicio, data_fim
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *`,
      [
        nome,
        profissional_id,
        dias,
        JSON.stringify(horarios || {}),
        isExp ? 0 : valor,
        isExp ? 0 : porcentagem,
        base,
        ganho,
        isExp ? null : (ganho_fixo ?? null),
        tipo,
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
      ganho_fixo,
      tipo = 'fixo',
      data_inicio,
      data_fim
    } = patientData;

    const isExp = tipo === 'experimental';
    const { base, ganho } = PatientModel._calcularGanho(
      isExp ? 0 : valor,
      isExp ? 0 : porcentagem,
      isExp ? null : (ganho_fixo ?? null),
      tipo
    );

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
        ganho_fixo = $9,
        tipo = $10,
        data_inicio = $11,
        data_fim = $12
      WHERE id = $13
      RETURNING *`,
      [
        nome,
        profissional_id,
        dias,
        JSON.stringify(horarios || {}),
        isExp ? 0 : valor,
        isExp ? 0 : porcentagem,
        base,
        ganho,
        isExp ? null : (ganho_fixo ?? null),
        tipo,
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