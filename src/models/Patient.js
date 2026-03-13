const { query, getClient } = require('../config/database');

class PatientModel {

  // ─────────────────────────────────────────────────────────────────────────
  // HELPER CENTRAL DE CÁLCULO DE GANHO
  //
  // Esta é a ÚNICA fonte de verdade para cálculos financeiros.
  // Nunca recalcule valor, base ou ganho no frontend — use o que o backend retorna.
  //
  // Regras por modalidade:
  //   experimental → valor=0, base=0, ganho=0 (aula teste, não entra no financeiro)
  //   convenio     → ganho por aula = ganho_fixo. Total do mês = ganho_fixo × aulas_realizadas
  //   fixo         → base = valor × (porcentagem/100)
  //                  ganho = ganho_fixo ?? base × 0.85  (desconto operacional padrão de 15%)
  // ─────────────────────────────────────────────────────────────────────────
  static _calcularGanho(valor, porcentagem, ganho_fixo, tipo) {
    if (tipo === 'experimental') return { base: 0, ganho: 0 };

    // Convênio: armazena o valor por aula no campo ganho.
    // O total do mês (ganho_convenio) é calculado dinamicamente nas queries,
    // nunca persistido — depende de quantas aulas foram dadas no período.
    if (tipo === 'convenio') return { base: 0, ganho: Number(ganho_fixo ?? 0) };

    // Fixo: base = comissão bruta, ganho = líquido após taxa operacional
    const base = (Number(valor) * Number(porcentagem)) / 100;
    const ganho = ganho_fixo != null
      ? Number(ganho_fixo)
      : base * 0.85;  // desconto de 15%
    return { base, ganho };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // _normalizeRow: garante que todo retorno de query tenha os mesmos campos
  // com os tipos corretos. Centralizar aqui evita conversões espalhadas.
  //
  // CAMPO NOVO: ganho_mes_atual
  //   Para o dashboard (sem filtro de período), usamos o mês corrente como
  //   referência para convênio, contando aulas do mês atual.
  //   Para o financeiro (com período), a query já traz aulas_realizadas correto.
  // ─────────────────────────────────────────────────────────────────────────
  static _normalizeRow(p) {
    const tipo             = p.tipo || 'fixo';
    const valor            = Number(p.valor);
    const porcentagem      = Number(p.porcentagem);
    const base             = Number(p.base);
    const ganho            = Number(p.ganho);           // fixo=líquido mensal, convenio=valor/aula
    const ganho_fixo       = p.ganho_fixo != null ? Number(p.ganho_fixo) : null;
    const aulas_realizadas = Number(p.aulas_realizadas ?? 0);
    const total_attendance = Number(p.total_attendance ?? 0);
    const total_evolutions = Number(p.total_evolutions ?? 0);

    // ganho_convenio = quanto o profissional recebe no período pelas aulas de convênio
    // Para fixo/experimental: null (não se aplica — use `ganho` diretamente)
    const ganho_convenio = tipo === 'convenio'
      ? ganho * aulas_realizadas
      : null;

    // ganho_liquido_periodo é o campo que o frontend SEMPRE deve usar para somas.
    // Elimina a necessidade de if/else por tipo no Angular.
    // fixo/experimental → ganho (já é o líquido mensal)
    // convenio          → ganho_convenio (aulas do período × valor/aula)
    const ganho_liquido_periodo = tipo === 'convenio'
      ? (ganho_convenio ?? 0)
      : ganho;

    return {
      ...p,
      tipo,
      valor,
      porcentagem,
      base,
      ganho,
      ganho_fixo,
      aulas_realizadas,
      total_attendance,
      total_evolutions,
      ganho_convenio,
      ganho_liquido_periodo,   // ← NOVO: use este no Angular para todos os cálculos de soma
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // findAll — usado pelo dashboard (sem filtro de período)
  //
  // aulas_realizadas aqui = histórico completo (para exibição no card do aluno).
  // Para o dashboard financeiro correto, use findAllWithPeriod passando o mês atual.
  //
  // ATENÇÃO: não some ganho_convenio de findAll para totais financeiros mensais —
  // ele reflete todo o histórico, não o mês. Para totais mensais, use /financial.
  // ─────────────────────────────────────────────────────────────────────────
  static async findAll(profissionalId = null) {
    let sql = `
      WITH attendance_stats AS (
        SELECT
          patient_id,
          COUNT(*)                                          AS total_attendance,
          COUNT(*) FILTER (WHERE status IN ('present','makeup')) AS aulas_realizadas
        FROM attendance
        GROUP BY patient_id
      ),
      evolution_stats AS (
        SELECT patient_id, COUNT(*) AS total_evolutions
        FROM evolutions
        GROUP BY patient_id
      )
      SELECT
        p.*,
        u.nome AS profissional_nome,
        COALESCE(a.total_attendance, 0)  AS total_attendance,
        COALESCE(a.aulas_realizadas, 0)  AS aulas_realizadas,
        COALESCE(e.total_evolutions, 0)  AS total_evolutions
      FROM patients p
      LEFT JOIN users u           ON p.profissional_id = u.id
      LEFT JOIN attendance_stats a ON p.id = a.patient_id
      LEFT JOIN evolution_stats e  ON p.id = e.patient_id
    `;

    const params = [];
    if (profissionalId) {
      sql += ' WHERE p.profissional_id = $1';
      params.push(profissionalId);
    }

    sql += ' ORDER BY p.nome, p.tipo, p.data_fim, p.created_at DESC';

    const result = await query(sql, params);
    return result.rows.map(p => PatientModel._normalizeRow(p));
  }

  // ─────────────────────────────────────────────────────────────────────────
  // findAllWithPeriod — usado pelo financeiro e pelo dashboard de resumo mensal
  //
  // Filtros de período:
  //   - Só retorna alunos que estavam ATIVOS no período:
  //       data_inicio <= fim_do_período  (já havia iniciado)
  //       data_fim IS NULL OR data_fim >= inicio_do_período  (ainda não havia saído)
  //   - aulas_realizadas conta apenas presences/makeups DENTRO do período
  //   - total_attendance conta o histórico todo (para exibição no card)
  //
  // Com isso, ganho_liquido_periodo reflete exatamente o que o profissional
  // ganhou no período — seja fixo, seja convênio.
  // ─────────────────────────────────────────────────────────────────────────
  static async findAllWithPeriod(profissionalId = null, startDate, endDate) {
    const params = [startDate, endDate];

    let profFilter = '';
    if (profissionalId) {
      params.push(profissionalId);
      profFilter = `AND p.profissional_id = $${params.length}`;
    }

    const sql = `
      WITH attendance_total AS (
        -- Histórico completo (exibição no card do aluno)
        SELECT patient_id, COUNT(*) AS total_attendance
        FROM attendance
        GROUP BY patient_id
      ),
      attendance_period AS (
        -- Aulas efetivamente realizadas DENTRO do período (base do cálculo financeiro)
        SELECT
          patient_id,
          COUNT(*) FILTER (WHERE status IN ('present','makeup')) AS aulas_realizadas
        FROM attendance
        WHERE date BETWEEN $1 AND $2
        GROUP BY patient_id
      ),
      evolution_total AS (
        SELECT patient_id, COUNT(*) AS total_evolutions
        FROM evolutions
        GROUP BY patient_id
      )
      SELECT
        p.*,
        u.nome AS profissional_nome,
        COALESCE(at.total_attendance, 0)   AS total_attendance,
        COALESCE(ap.aulas_realizadas, 0)   AS aulas_realizadas,
        COALESCE(et.total_evolutions, 0)   AS total_evolutions
      FROM patients p
      LEFT JOIN users u              ON p.profissional_id = u.id
      LEFT JOIN attendance_total at  ON p.id = at.patient_id
      LEFT JOIN attendance_period ap ON p.id = ap.patient_id
      LEFT JOIN evolution_total et   ON p.id = et.patient_id
      WHERE
        p.data_inicio <= $2
        AND (p.data_fim IS NULL OR p.data_fim >= $1)
        ${profFilter}
      ORDER BY p.nome, p.tipo, p.data_fim, p.created_at DESC
    `;

    console.log(sql, params);

    const result = await query(sql, params);
    return result.rows.map(p => PatientModel._normalizeRow(p));
  }

  static async findById(id) {
    const result = await query(
      `SELECT p.*, u.nome AS profissional_nome
       FROM patients p
       LEFT JOIN users u ON p.profissional_id = u.id
       WHERE p.id = $1`,
      [id]
    );
    if (!result.rows[0]) return null;
    return PatientModel._normalizeRow(result.rows[0]);
  }

  static async findByIdWithDetails(id) {
    const client = await getClient();
    try {
      const patientResult = await client.query(
        `SELECT p.*, u.nome AS profissional_nome
         FROM patients p
         LEFT JOIN users u ON p.profissional_id = u.id
         WHERE p.id = $1`,
        [id]
      );
      if (!patientResult.rows.length) return null;

      const patient = PatientModel._normalizeRow(patientResult.rows[0]);

      const [attendanceResult, evolutionsResult] = await Promise.all([
        client.query('SELECT * FROM attendance WHERE patient_id = $1 ORDER BY date DESC', [id]),
        client.query('SELECT * FROM evolutions WHERE patient_id = $1 ORDER BY date DESC', [id])
      ]);

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
      nome, profissional_id, dias, horarios,
      valor, porcentagem, ganho_fixo,
      tipo = 'fixo', data_inicio, data_fim
    } = patientData;

    const isExp      = tipo === 'experimental';
    const isConvenio = tipo === 'convenio';

    const { base, ganho } = PatientModel._calcularGanho(
      (isExp || isConvenio) ? 0 : valor,
      (isExp || isConvenio) ? 0 : porcentagem,
      isExp ? null : (ganho_fixo ?? null),
      tipo
    );

    const result = await query(
      `INSERT INTO patients (
        nome, profissional_id, dias, horarios, valor, porcentagem,
        base, ganho, ganho_fixo, tipo, data_inicio, data_fim
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
      RETURNING *`,
      [
        nome, profissional_id, dias,
        JSON.stringify(horarios || {}),
        isExp ? 0 : valor,
        isExp ? 0 : porcentagem,
        base, ganho,
        isExp ? null : (ganho_fixo ?? null),
        tipo, data_inicio, data_fim || null
      ]
    );
    return PatientModel._normalizeRow(result.rows[0]);
  }

  static async update(id, patientData) {
    const {
      nome, profissional_id, dias, horarios,
      valor, porcentagem, ganho_fixo,
      tipo = 'fixo', data_inicio, data_fim
    } = patientData;

    const isExp      = tipo === 'experimental';
    const isConvenio = tipo === 'convenio';

    const { base, ganho } = PatientModel._calcularGanho(
      (isExp || isConvenio) ? 0 : valor,
      (isExp || isConvenio) ? 0 : porcentagem,
      isExp ? null : (ganho_fixo ?? null),
      tipo
    );

    const result = await query(
      `UPDATE patients SET
        nome=$1, profissional_id=$2, dias=$3, horarios=$4,
        valor=$5, porcentagem=$6, base=$7, ganho=$8,
        ganho_fixo=$9, tipo=$10, data_inicio=$11, data_fim=$12
       WHERE id=$13
       RETURNING *`,
      [
        nome, profissional_id, dias,
        JSON.stringify(horarios || {}),
        isExp ? 0 : valor,
        isExp ? 0 : porcentagem,
        base, ganho,
        isExp ? null : (ganho_fixo ?? null),
        tipo, data_inicio, data_fim || null, id
      ]
    );
    return PatientModel._normalizeRow(result.rows[0]);
  }

  static async delete(id) {
    await query('DELETE FROM patients WHERE id = $1', [id]);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // getStats — retorna totais consolidados
  //
  // CORREÇÃO: para convênio, ganho_total deve somar ganho × aulas_realizadas,
  // não apenas ganho (que é o valor por aula). Adicionamos um CASE para isso.
  //
  // Este endpoint é usado pelo dashboard como resumo geral.
  // Para um resumo financeiro de um mês específico, prefira getStatsByPeriod.
  // ─────────────────────────────────────────────────────────────────────────
  static async getStats(profissionalId = null) {
    let sql = `
      WITH attendance_stats AS (
        SELECT
          patient_id,
          COUNT(*) FILTER (WHERE status = 'present')               AS presencas,
          COUNT(*) FILTER (WHERE status = 'absent')                AS faltas,
          COUNT(*) FILTER (WHERE status IN ('present','makeup'))   AS aulas_realizadas
        FROM attendance
        GROUP BY patient_id
      )
      SELECT
        COUNT(p.id) FILTER (WHERE p.tipo != 'experimental') AS total_alunos,
        -- ganho_total correto por modalidade:
        -- convenio: valor_por_aula × total_aulas_realizadas
        -- experimental: 0 (excluído)
        -- fixo: ganho mensal cadastrado
        COALESCE(SUM(
          CASE
            WHEN p.tipo = 'convenio'
            THEN p.ganho * COALESCE(a.aulas_realizadas, 0)
            ELSE p.ganho
          END
        ), 0)                                    AS ganho_total,
        COALESCE(SUM(a.presencas), 0)            AS presencas,
        COALESCE(SUM(a.faltas), 0)               AS faltas
      FROM patients p
      LEFT JOIN attendance_stats a ON p.id = a.patient_id
    `;

    const params = [];
    if (profissionalId) {
      sql += ' WHERE p.profissional_id = $1';
      params.push(profissionalId);
    }

    const result = await query(sql, params);
    const stats  = result.rows[0];
    const total  = parseInt(stats.presencas) + parseInt(stats.faltas);

    return {
      totalAlunos:  parseInt(stats.total_alunos),
      ganhoTotal:   parseFloat(stats.ganho_total),
      presencas:    parseInt(stats.presencas),
      faltas:       parseInt(stats.faltas),
      taxaPresenca: total > 0
        ? parseFloat(((parseInt(stats.presencas) / total) * 100).toFixed(2))
        : 0
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // getStatsByPeriod — NOVO: resumo financeiro de um período específico
  //
  // Diferença em relação a getStats:
  //   - Filtra apenas alunos ativos no período
  //   - aulas_realizadas contadas SOMENTE dentro do período (não histórico todo)
  //   - Usado pelo dashboard quando exibe o resumo do mês atual
  // ─────────────────────────────────────────────────────────────────────────
  static async getStatsByPeriod(profissionalId = null, startDate, endDate) {
    const params = [startDate, endDate];

    let profFilter = '';
    if (profissionalId) {
      params.push(profissionalId);
      profFilter = `AND p.profissional_id = $${params.length}`;
    }

    const sql = `
      WITH attendance_period AS (
        SELECT
          patient_id,
          COUNT(*) FILTER (WHERE status = 'present')               AS presencas,
          COUNT(*) FILTER (WHERE status = 'absent')                AS faltas,
          COUNT(*) FILTER (WHERE status IN ('present','makeup'))   AS aulas_realizadas
        FROM attendance
        WHERE date BETWEEN $1 AND $2
        GROUP BY patient_id
      )
      SELECT
        -- Exclui experimentais da contagem de alunos (não pagam, não entram no financeiro)
        COUNT(p.id) FILTER (WHERE p.tipo != 'experimental') AS total_alunos,
        COALESCE(SUM(
          CASE
            WHEN p.tipo = 'experimental' THEN 0
            WHEN p.tipo = 'convenio'
            THEN p.ganho * COALESCE(ap.aulas_realizadas, 0)
            ELSE p.ganho
          END
        ), 0)         AS ganho_total,
        COALESCE(SUM(ap.presencas), 0)  AS presencas,
        COALESCE(SUM(ap.faltas), 0)     AS faltas
      FROM patients p
      LEFT JOIN attendance_period ap ON p.id = ap.patient_id
      WHERE
        p.data_inicio <= $2
        AND (p.data_fim IS NULL OR p.data_fim >= $1)
        ${profFilter}
    `;

    const result = await query(sql, params);
    const stats  = result.rows[0];
    const total  = parseInt(stats.presencas) + parseInt(stats.faltas);

    return {
      totalAlunos:  parseInt(stats.total_alunos),
      ganhoTotal:   parseFloat(stats.ganho_total),
      presencas:    parseInt(stats.presencas),
      faltas:       parseInt(stats.faltas),
      taxaPresenca: total > 0
        ? parseFloat(((parseInt(stats.presencas) / total) * 100).toFixed(2))
        : 0
    };
  }
}

module.exports = PatientModel;