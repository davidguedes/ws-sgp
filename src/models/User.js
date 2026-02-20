const { query } = require('../config/database');
const bcrypt = require('bcryptjs');

class UserModel {

  // ─────────────────────────────────────────────
  // MÉTODOS EXISTENTES — não alterados
  // ─────────────────────────────────────────────

  static async findAll() {
    const result = await query(
      'SELECT id, nome, email, role, created_at, updated_at FROM users ORDER BY id'
    );
    return result.rows;
  }

  static async findById(id) {
    const result = await query(
      'SELECT id, nome, email, role, created_at, updated_at FROM users WHERE id = $1',
      [id]
    );
    return result.rows[0];
  }

  static async findByEmail(email) {
    const result = await query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );
    return result.rows[0];
  }

  static async create(userData) {
    const { nome, email, senha, role } = userData;
    const hashedPassword = await bcrypt.hash(senha, 10);

    const result = await query(
      `INSERT INTO users (nome, email, senha, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, nome, email, role, created_at, updated_at`,
      [nome, email, hashedPassword, role]
    );
    return result.rows[0];
  }

  static async update(id, userData) {
    const { nome, email, role } = userData;

    const result = await query(
      `UPDATE users
       SET nome = $1, email = $2, role = $3
       WHERE id = $4
       RETURNING id, nome, email, role, created_at, updated_at`,
      [nome, email, role, id]
    );
    return result.rows[0];
  }

  static async updatePassword(id, newPassword) {
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await query(
      'UPDATE users SET senha = $1 WHERE id = $2',
      [hashedPassword, id]
    );
  }

  static async delete(id) {
    await query('DELETE FROM users WHERE id = $1', [id]);
  }

  static async comparePassword(plainPassword, hashedPassword) {
    return await bcrypt.compare(plainPassword, hashedPassword);
  }

  // Usado pelo AuthService do frontend (select de pacientes)
  static async getProfessionals() {
    const result = await query(`
      SELECT
        u.id,
        u.nome,
        COUNT(DISTINCT p.id) AS total_alunos
      FROM users u
      LEFT JOIN patients p ON u.id = p.profissional_id
      WHERE u.role = 'profissional'
      GROUP BY u.id, u.nome
      ORDER BY u.nome ASC
    `);
    return result.rows.map(r => ({ ...r, total_alunos: Number(r.total_alunos) }));
  }

  // ─────────────────────────────────────────────
  // NOVOS MÉTODOS — gestão de profissionais
  // ─────────────────────────────────────────────

  // Listagem completa com stats (para a tela de gestão)
  static async findAllProfessionals() {
    const result = await query(`
      SELECT
        u.id,
        u.nome,
        u.email,
        u.role,
        u.created_at,
        COUNT(DISTINCT p.id)      AS total_alunos,
        COALESCE(SUM(p.ganho), 0) AS ganho_total
      FROM users u
      LEFT JOIN patients p ON p.profissional_id = u.id
      WHERE u.role = 'profissional'
      GROUP BY u.id
      ORDER BY u.nome ASC
    `);

    return result.rows.map(r => ({
      ...r,
      total_alunos: Number(r.total_alunos),
      ganho_total:  Number(r.ganho_total)
    }));
  }

  // Atualização com senha opcional (para edição via tela de gestão)
  static async updateProfessional(id, { nome, email, senha }) {
    if (senha) {
      const hash = await bcrypt.hash(senha, 10);
      const result = await query(
        `UPDATE users SET nome = $1, email = $2, senha = $3
         WHERE id = $4
         RETURNING id, nome, email, role, created_at`,
        [nome, email, hash, id]
      );
      return result.rows[0];
    }

    const result = await query(
      `UPDATE users SET nome = $1, email = $2
       WHERE id = $3
       RETURNING id, nome, email, role, created_at`,
      [nome, email, id]
    );
    return result.rows[0];
  }

  // Verifica e-mail duplicado (ignora o próprio usuário em edição)
  static async emailExists(email, excludeId = null) {
    const result = excludeId
      ? await query(`SELECT id FROM users WHERE email = $1 AND id != $2`, [email, excludeId])
      : await query(`SELECT id FROM users WHERE email = $1`, [email]);
    return result.rows.length > 0;
  }

  // Bloqueia exclusão se houver alunos vinculados
  static async hasPatients(id) {
    const result = await query(
      `SELECT COUNT(*) AS total FROM patients WHERE profissional_id = $1`,
      [id]
    );
    return Number(result.rows[0].total) > 0;
  }
}

module.exports = UserModel;