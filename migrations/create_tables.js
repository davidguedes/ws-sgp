const { pool } = require('../src/config/database');

const createTables = async () => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    // Tabela de Usuários
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        nome VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        senha VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL CHECK (role IN ('gestor', 'profissional')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Tabela de Pacientes
    await client.query(`
      CREATE TABLE IF NOT EXISTS patients (
        id SERIAL PRIMARY KEY,
        nome VARCHAR(255) NOT NULL,
        profissional_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        dias TEXT[] NOT NULL,
        horarios JSONB,
        valor DECIMAL(10, 2) NOT NULL,
        porcentagem DECIMAL(5, 2) NOT NULL,
        base DECIMAL(10, 2) NOT NULL,
        ganho DECIMAL(10, 2) NOT NULL,
        ganho_fixo NUMERIC(10,2) DEFAULT NULL,
        data_inicio DATE NOT NULL,
        data_fim DATE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Tabela de Frequência
    await client.query(`
      CREATE TABLE IF NOT EXISTS attendance (
        id SERIAL PRIMARY KEY,
        patient_id INTEGER REFERENCES patients(id) ON DELETE CASCADE,
        date DATE NOT NULL,
        status VARCHAR(20) NOT NULL CHECK (status IN ('present', 'absent', 'makeup')),
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(patient_id, date)
      );
    `);

    // Tabela de Evoluções
    await client.query(`
      CREATE TABLE IF NOT EXISTS evolutions (
        id SERIAL PRIMARY KEY,
        patient_id INTEGER REFERENCES patients(id) ON DELETE CASCADE,
        date TIMESTAMP NOT NULL,
        eva INTEGER CHECK (eva >= 0 AND eva <= 10),
        exercises JSONB,
        notes TEXT NOT NULL,
        author VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Índices para melhor performance
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_patients_profissional ON patients(profissional_id);
      CREATE INDEX IF NOT EXISTS idx_attendance_patient ON attendance(patient_id);
      CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(date);
      CREATE INDEX IF NOT EXISTS idx_evolutions_patient ON evolutions(patient_id);
      CREATE INDEX IF NOT EXISTS idx_evolutions_date ON evolutions(date);
    `);

    // Trigger para atualizar updated_at
    await client.query(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$ language 'plpgsql';
    `);

    await client.query(`
      DROP TRIGGER IF EXISTS update_users_updated_at ON users;
      CREATE TRIGGER update_users_updated_at
        BEFORE UPDATE ON users
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    `);

    await client.query(`
      DROP TRIGGER IF EXISTS update_patients_updated_at ON patients;
      CREATE TRIGGER update_patients_updated_at
        BEFORE UPDATE ON patients
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    `);

    await client.query(`
      DROP TRIGGER IF EXISTS update_evolutions_updated_at ON evolutions;
      CREATE TRIGGER update_evolutions_updated_at
        BEFORE UPDATE ON evolutions
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    `);

    await client.query('COMMIT');
    console.log('✅ Tabelas criadas com sucesso!');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Erro ao criar tabelas:', error);
    throw error;
  } finally {
    client.release();
  }
};

module.exports = { createTables };
