const { query, getClient } = require('../config/database');

class PatientModel {
  static async findAll(profissionalId = null) {
    let sql = `
      WITH attendance_stats AS (
        SELECT
          patient_id,
          COUNT(*) AS total_attendance,
          COUNT(*) FILTER (
            WHERE status IN ('present','makeup')
          ) AS aulas_realizadas
        FROM attendance
        GROUP BY patient_id
      ),

      evolution_stats AS (
        SELECT
          patient_id,
          COUNT(*) AS total_evolutions
        FROM evolutions
        GROUP BY patient_id
      )

      SELECT
        p.*,
        u.nome AS profissional_nome,
        COALESCE(a.total_attendance,0) AS total_attendance,
        COALESCE(a.aulas_realizadas,0) AS aulas_realizadas,
        COALESCE(e.total_evolutions,0) AS total_evolutions

      FROM patients p
      LEFT JOIN users u ON p.profissional_id = u.id
      LEFT JOIN attendance_stats a ON p.id = a.patient_id
      LEFT JOIN evolution_stats e ON p.id = e.patient_id
    `;

    const params = [];
    if (profissionalId) {
      sql += ' WHERE p.profissional_id = $1';
      params.push(profissionalId);
    }

    sql += ` ORDER BY p.nome, p.tipo, p.data_fim, p.created_at DESC`;

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
      aulas_realizadas: Number(p.aulas_realizadas),
      ganho_convenio: p.tipo === 'convenio' ? Number(p.ganho) * Number(p.aulas_realizadas) : null
    }));
  }

  /**
   * Retorna pacientes que estavam ativos no período [startDate, endDate].
   * - Exclui alunos cujo data_inicio é posterior ao fim do período (ainda não existiam)
   * - Exclui alunos cujo data_fim é anterior ao início do período (já haviam saído)
   * - aulas_realizadas e ganho_convenio são calculados APENAS para o período informado
   */
  static async findAllWithPeriod(profissionalId = null, startDate, endDate) {
    const params = [startDate, endDate];

    let profFilter = '';
    if (profissionalId) {
      params.push(profissionalId);
      profFilter = `AND p.profissional_id = $${params.length}`;
    }

    const sql = `
      WITH attendance_total AS (
        SELECT
          patient_id,
          COUNT(*) AS total_attendance
        FROM attendance
        GROUP BY patient_id
      ),

      attendance_period AS (
        SELECT
          patient_id,
          COUNT(*) FILTER (
            WHERE status IN ('present','makeup')
          ) AS aulas_realizadas
        FROM attendance
        WHERE date BETWEEN $1 AND $2
        GROUP BY patient_id
      ),

      evolution_total AS (
        SELECT
          patient_id,
          COUNT(*) AS total_evolutions
        FROM evolutions
        GROUP BY patient_id
      )

      SELECT
        p.*,
        u.nome AS profissional_nome,
        COALESCE(at.total_attendance,0) AS total_attendance,
        COALESCE(ap.aulas_realizadas,0) AS aulas_realizadas,
        COALESCE(et.total_evolutions,0) AS total_evolutions

      FROM patients p

      LEFT JOIN users u
        ON p.profissional_id = u.id

      LEFT JOIN attendance_total at
        ON p.id = at.patient_id

      LEFT JOIN attendance_period ap
        ON p.id = ap.patient_id

      LEFT JOIN evolution_total et
        ON p.id = et.patient_id

      WHERE
        p.data_inicio <= $2
        AND (p.data_fim IS NULL OR p.data_fim >= $1)
        ${profFilter}

      ORDER BY p.nome, p.tipo, p.data_fim, p.created_at DESC
    `;

    const result = await query(sql, params);

    return result.rows.map(p => ({
      ...p,
      tipo:             p.tipo || 'fixo',
      valor:            Number(p.valor),
      porcentagem:      Number(p.porcentagem),
      base:             Number(p.base),
      ganho:            Number(p.ganho),
      ganho_fixo:       p.ganho_fixo != null ? Number(p.ganho_fixo) : null,
      total_attendance: Number(p.total_attendance),
      total_evolutions: Number(p.total_evolutions),
      aulas_realizadas: Number(p.aulas_realizadas),
      // ganho_convenio recalculado para o período (aulas * valor por aula)
      ganho_convenio:   p.tipo === 'convenio'
        ? Number(p.ganho) * Number(p.aulas_realizadas)
        : null
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

    // Convênio: ganho = valor por aula (armazenado em ganho_fixo), base = 0
    if (tipo === 'convenio') return { base: 0, ganho: Number(ganho_fixo ?? 0) };

    // Fixo: cálculo padrão
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
    const isConvenio = tipo === 'convenio';
    const { base, ganho } = PatientModel._calcularGanho(
      (isExp || isConvenio) ? 0 : valor,
      (isExp || isConvenio) ? 0 : porcentagem,
      isExp ? null : (ganho_fixo ?? null),   // convenio mantém ganho_fixo
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
    const isConvenio = tipo === 'convenio';
    const { base, ganho } = PatientModel._calcularGanho(
      (isExp || isConvenio) ? 0 : valor,
      (isExp || isConvenio) ? 0 : porcentagem,
      isExp ? null : (ganho_fixo ?? null),   // convenio mantém ganho_fixo
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
      WITH attendance_stats AS (
        SELECT
          patient_id,
          COUNT(*) FILTER (WHERE status = 'present') AS presencas,
          COUNT(*) FILTER (WHERE status = 'absent') AS faltas
        FROM attendance
        GROUP BY patient_id
      )

      SELECT
        COUNT(p.id) AS total_alunos,
        COALESCE(SUM(p.ganho),0) AS ganho_total,
        COALESCE(SUM(a.presencas),0) AS presencas,
        COALESCE(SUM(a.faltas),0) AS faltas

      FROM patients p
      LEFT JOIN attendance_stats a
        ON p.id = a.patient_id
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
