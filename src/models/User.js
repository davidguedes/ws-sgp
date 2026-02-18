const { query } = require('../config/database');
const bcrypt = require('bcryptjs');

class UserModel {
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

  static async getProfessionals() {    
    // Buscar profissionais
    const professionalsResult = await query(
      `
        SELECT
          u.id as id,
          u.nome as nome,
          COUNT(DISTINCT p.id) as total_alunos
        FROM users u
        LEFT JOIN patients p ON u.id = p.profissional_id
        WHERE u.role = 'profissional'
        GROUP BY u.id, u.nome
        ORDER BY u.nome ASC
      `
    );

    return professionalsResult.rows;
  }
}

module.exports = UserModel;
