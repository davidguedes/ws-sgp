const { query } = require('../config/database');

class EvolutionModel {
  static async findByPatientId(patientId) {
    const result = await query(
      'SELECT * FROM evolutions WHERE patient_id = $1 ORDER BY date DESC',
      [patientId]
    );
    return result.rows;
  }

  static async findById(id) {
    const result = await query(
      'SELECT * FROM evolutions WHERE id = $1',
      [id]
    );
    return result.rows[0];
  }

  static async create(patientId, evolutionData, author) {
    const { date, eva, exercises, notes } = evolutionData;

    const result = await query(
      `INSERT INTO evolutions (patient_id, date, eva, exercises, notes, author)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        patientId,
        date || new Date(),
        eva !== undefined ? eva : null,
        JSON.stringify(exercises || {}),
        notes,
        author
      ]
    );

    return result.rows[0];
  }

  static async update(id, evolutionData) {
    const { date, eva, exercises, notes } = evolutionData;

    const result = await query(
      `UPDATE evolutions 
       SET date = $1, eva = $2, exercises = $3, notes = $4
       WHERE id = $5
       RETURNING *`,
      [
        date,
        eva !== undefined ? eva : null,
        JSON.stringify(exercises || {}),
        notes,
        id
      ]
    );

    return result.rows[0];
  }

  static async delete(id) {
    await query('DELETE FROM evolutions WHERE id = $1', [id]);
  }

  static async getLatestByPatient(patientId, limit = 5) {
    const result = await query(
      `SELECT * FROM evolutions 
       WHERE patient_id = $1 
       ORDER BY date DESC 
       LIMIT $2`,
      [patientId, limit]
    );
    return result.rows;
  }

  static async getAverageEVA(patientId) {
    const result = await query(
      `SELECT AVG(eva) as average_eva
       FROM evolutions
       WHERE patient_id = $1 AND eva IS NOT NULL`,
      [patientId]
    );

    return result.rows[0]?.average_eva 
      ? parseFloat(result.rows[0].average_eva).toFixed(2)
      : null;
  }
}

module.exports = EvolutionModel;
