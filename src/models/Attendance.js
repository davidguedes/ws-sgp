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
    // Se o registro sendo deletado é uma presença de reposição (makeup_origin_id preenchido),
    // reverte o makeup original para reposto = FALSE — o professor poderá registrá-la novamente.
    const check = await query(
      'SELECT makeup_origin_id FROM attendance WHERE id = $1',
      [id]
    );
    const row = check.rows[0];
    if (row?.makeup_origin_id) {
      await query(
        'UPDATE attendance SET reposto = FALSE WHERE id = $1',
        [row.makeup_origin_id]
      );
    }
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

  static async createAvulso({ patient_ids, date, valor, notes, profissional_id }) {
    const results = [];
    for (const patient_id of patient_ids) {
      const r = await query(
        `INSERT INTO attendance (patient_id, date, status, tipo, valor, notes)
        VALUES ($1, $2, 'present', 'avulso', $3, $4)
        ON CONFLICT (patient_id, date, tipo) DO UPDATE
          SET valor = EXCLUDED.valor, notes = EXCLUDED.notes
        RETURNING *`,
        [patient_id, date, valor, notes ?? null]
      );
      results.push(r.rows[0]);
    }
    return results;
  }

  static async getAvulsoByPeriod(startDate, endDate, profissionalId = null) {
    let sql = `
      SELECT a.*, p.nome as patient_nome, p.profissional_id, p.horarios
      FROM attendance a
      JOIN patients p ON a.patient_id = p.id
      WHERE a.tipo = 'avulso'
        AND DATE(a.date) BETWEEN $1 AND $2
    `;
    const params = [startDate, endDate];
    if (profissionalId) {
      sql += ' AND p.profissional_id = $3';
      params.push(profissionalId);
    }
    sql += ' ORDER BY a.date ASC';
    const result = await query(sql, params);
    return result.rows;
  }

  // ─────────────────────────────────────────────
  // REPOSIÇÕES PENDENTES
  // ─────────────────────────────────────────────

  /**
   * Lista todos os registros makeup ainda não repostos (reposto = FALSE)
   * dos alunos do profissional, dentro do mês da data de referência.
   *
   * Retorna linhas com campos do attendance + nome do aluno,
   * ordenadas por data ASC (falta mais antiga primeiro).
   */
  static async getPendingMakeups(profissionalId, referenceDate) {
    const d     = new Date(referenceDate);
    const year  = d.getFullYear();
    const month = d.getMonth();
    const start = new Date(year, month, 1).toISOString().split('T')[0];
    const end   = new Date(year, month + 1, 0).toISOString().split('T')[0];

    const result = await query(
      `SELECT
         a.id,
         a.patient_id,
         a.date,
         a.notes,
         p.nome AS patient_nome
       FROM attendance a
       JOIN patients p ON a.patient_id = p.id
       WHERE a.status     = 'makeup'
         AND a.reposto    = FALSE
         AND (a.tipo IS NULL OR a.tipo = 'regular')
         AND p.profissional_id = $1
         AND DATE(a.date) BETWEEN $2 AND $3
       ORDER BY a.date ASC`,
      [profissionalId, start, end]
    );
    return result.rows;
  }

  /**
   * Registra a realização de uma reposição de forma atômica:
   *
   * 1. Marca o registro makeup original como reposto = TRUE
   * 2. Cria (ou atualiza) um registro 'present' no dia atual
   *    para o aluno que está fazendo a reposição, vinculando
   *    makeup_origin_id ao registro original.
   *
   * Executa dentro de uma transação para garantir consistência.
   *
   * @param {string} makeupId        - ID do registro makeup a quitar
   * @param {string} presentPatientId - ID do aluno que está presente hoje (pode ser diferente do aluno que faltou, mas em geral é o mesmo)
   * @param {string} presentDate     - Data da presença (YYYY-MM-DD)
   * @param {string|null} existingAttendanceId - Se já há registro de presença no dia, atualiza em vez de inserir
   * @returns {{ makeup: object, presence: object }}
   */
  static async resolveReposto(makeupId, presentPatientId, presentDate, existingAttendanceId = null) {
    // Garantir que IDs são inteiros — attendance.id é serial4 (INTEGER)
    const makeupIdInt   = parseInt(makeupId, 10);
    const patientIdInt  = parseInt(presentPatientId, 10);
    const existingIdInt = existingAttendanceId ? parseInt(existingAttendanceId, 10) : null;

    if (isNaN(makeupIdInt) || isNaN(patientIdInt)) {
      throw new Error('IDs inválidos para resolução de reposição');
    }

    const client = await require('../config/database').pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Verificar que o makeup existe e ainda não foi reposto
      const makeupCheck = await client.query(
        `SELECT id, patient_id, reposto FROM attendance WHERE id = $1 AND status = 'makeup'`,
        [makeupIdInt]
      );
      if (makeupCheck.rows.length === 0) {
        throw new Error('Registro de reposição não encontrado');
      }
      if (makeupCheck.rows[0].reposto) {
        throw new Error('Esta reposição já foi quitada');
      }

      // 2. Marcar o makeup original como reposto
      const makeupResult = await client.query(
        `UPDATE attendance SET reposto = TRUE WHERE id = $1 RETURNING *`,
        [makeupIdInt]
      );

      // 3. Criar ou atualizar presença do aluno na data informada
      let presenceResult;
      if (existingIdInt) {
        presenceResult = await client.query(
          `UPDATE attendance
           SET status = 'present', makeup_origin_id = $1
           WHERE id = $2
           RETURNING *`,
          [makeupIdInt, existingIdInt]
        );
      } else {
        presenceResult = await client.query(
          `INSERT INTO attendance (patient_id, date, status, makeup_origin_id, notes)
           VALUES ($1, $2, 'present', $3, 'Reposição registrada')
           ON CONFLICT (patient_id, date, tipo) DO UPDATE
             SET status = 'present', makeup_origin_id = EXCLUDED.makeup_origin_id
           RETURNING *`,
          [patientIdInt, presentDate, makeupIdInt]
        );
      }

      await client.query('COMMIT');
      return {
        makeup:   makeupResult.rows[0],
        presence: presenceResult.rows[0]
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
}

module.exports = AttendanceModel;