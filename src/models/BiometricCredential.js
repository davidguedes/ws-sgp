// Responsável por todas as operações de banco relacionadas às credenciais WebAuthn.

const { query } = require('../config/database');

class BiometricCredentialModel {

  // ── CHALLENGES ──────────────────────────────────────────────────────────────

  /**
   * Salva um challenge temporário no banco.
   * O challenge é uma string aleatória gerada pelo @simplewebauthn/server.
   * Ele precisa ser validado na etapa "complete" para evitar ataques CSRF/replay.
   *
   * @param {string} challenge  - String aleatória base64url
   * @param {string} type       - 'registration' | 'authentication'
   * @param {string|null} patientId - Preenchido apenas na autenticação
   */
  static async saveChallenge(challenge, type, patientId = null) {
    // patientId é INTEGER no banco — converte string para number quando necessário
    const pid = patientId ? parseInt(patientId, 10) : null;
    await query(
      `INSERT INTO webauthn_challenges (challenge, type, patient_id)
       VALUES ($1, $2, $3)`,
      [challenge, type, pid]
    );
  }

  /**
   * Busca e remove o challenge (uso único).
   * Retorna null se expirado ou inexistente — força nova tentativa.
   */
  static async consumeChallenge(challenge, type) {
    const result = await query(
      `DELETE FROM webauthn_challenges
       WHERE challenge = $1
         AND type = $2
         AND expires_at > NOW()
       RETURNING *`,
      [challenge, type]
    );
    return result.rows[0] || null;
  }

  /**
   * Limpa challenges expirados. Chame isso periodicamente (ex: a cada 10 min).
   */
  static async cleanExpiredChallenges() {
    await query(`DELETE FROM webauthn_challenges WHERE expires_at < NOW()`);
  }

  // ── CREDENCIAIS ─────────────────────────────────────────────────────────────

  /**
   * Lista todas as credenciais cadastradas de um aluno.
   * Usado na tela de gerenciamento biométrico do aluno.
   */
  static async findByPatientId(patientId) {
    const result = await query(
      `SELECT id, patient_id, credential_id, device_name, created_at, last_used_at
       FROM biometric_credentials
       WHERE patient_id = $1
       ORDER BY created_at DESC`,
      [parseInt(patientId, 10)]
    );
    return result.rows;
  }

  /**
   * Busca UMA credencial pelo credential_id (chave pública do autenticador).
   * Usado durante a verificação de autenticação.
   */
  static async findByCredentialId(credentialId) {
    const result = await query(
      `SELECT * FROM biometric_credentials WHERE credential_id = $1`,
      [credentialId]
    );
    return result.rows[0] || null;
  }

  /**
   * Persiste uma nova credencial após registro bem-sucedido.
   *
   * @param {string} patientId
   * @param {string} credentialId  - ID do autenticador (base64url)
   * @param {string} publicKey     - Chave pública COSE (base64url)
   * @param {number} counter       - Contador inicial (geralmente 0)
   * @param {string} deviceName    - Nome amigável (ex: "iPhone de João")
   */
  static async create(patientId, credentialId, publicKey, counter, deviceName) {
    const result = await query(
      `INSERT INTO biometric_credentials
         (patient_id, credential_id, public_key, counter, device_name)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [parseInt(patientId, 10), credentialId, publicKey, counter, deviceName]
    );
    return result.rows[0];
  }

  /**
   * Atualiza o counter após cada autenticação.
   * O counter é incrementado pelo autenticador e serve para detectar clonagem.
   * Se o novo counter for menor que o armazenado, é sinal de ataque — o
   * @simplewebauthn/server lança um erro automaticamente antes de chegarmos aqui.
   */
  static async updateCounter(credentialId, newCounter) {
    await query(
      `UPDATE biometric_credentials
       SET counter = $1, last_used_at = NOW()
       WHERE credential_id = $2`,
      [newCounter, credentialId]
    );
  }

  /**
   * Remove uma credencial específica (o aluno pode revogar um dispositivo).
   */
  static async delete(id, patientId) {
    const result = await query(
      `DELETE FROM biometric_credentials
       WHERE id = $1 AND patient_id = $2
       RETURNING id`,
      [parseInt(id, 10), parseInt(patientId, 10)]
    );
    return result.rows[0] || null;
  }
}

module.exports = BiometricCredentialModel;