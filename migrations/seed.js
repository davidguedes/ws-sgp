const { pool } = require('../src/config/database');
const bcrypt = require('bcryptjs');

const seedData = async () => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    // Hash das senhas
    const gestorPassword = await bcrypt.hash('gestor123', 10);
    const profPassword = await bcrypt.hash('prof123', 10);

    // Inserir usuários
    const usersResult = await client.query(`
      INSERT INTO users (nome, email, senha, role) 
      VALUES 
        ('Gestor Master', 'gestor@studio.com', $1, 'gestor'),
        ('Profissional Silva', 'prof1@studio.com', $2, 'profissional'),
        ('Profissional Clara', 'prof2@studio.com', $2, 'profissional')
      ON CONFLICT (email) DO NOTHING
      RETURNING id;
    `, [gestorPassword, profPassword]);

    console.log('✅ Usuários criados');

    // Buscar ID do profissional para criar pacientes
    const profResult = await client.query(
      "SELECT id FROM users WHERE email = 'prof1@studio.com'"
    );
    
    if (profResult.rows.length > 0) {
      const profId = profResult.rows[0].id;

      // Inserir pacientes
      const patient1 = await client.query(`
        INSERT INTO patients (
          nome, profissional_id, dias, horarios, valor, porcentagem, 
          base, ganho, data_inicio, data_fim
        ) 
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING id;
      `, [
        'Maria Silva',
        profId,
        ['seg', 'qua', 'sex'],
        JSON.stringify({ seg: '08:00', qua: '10:00', sex: '13:00' }),
        400.00,
        30,
        120.00,
        280.00,
        '2025-01-01',
        '2025-12-31'
      ]);

      const patient2 = await client.query(`
        INSERT INTO patients (
          nome, profissional_id, dias, horarios, valor, porcentagem, 
          base, ganho, data_inicio, data_fim
        ) 
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING id;
      `, [
        'João Santos',
        profId,
        ['ter', 'qui'],
        JSON.stringify({ ter: '14:00', qui: '16:00' }),
        350.00,
        25,
        87.50,
        262.50,
        '2025-02-01',
        null
      ]);

      console.log('✅ Pacientes criados');

      // Inserir registros de frequência
      if (patient1.rows.length > 0) {
        const p1Id = patient1.rows[0].id;
        
        await client.query(`
          INSERT INTO attendance (patient_id, date, status, notes) 
          VALUES 
            ($1, '2025-02-10', 'present', ''),
            ($1, '2025-02-12', 'present', ''),
            ($1, '2025-02-14', 'absent', 'Atestado médico');
        `, [p1Id]);

        // Inserir evoluções
        await client.query(`
          INSERT INTO evolutions (patient_id, date, eva, exercises, notes, author) 
          VALUES 
            ($1, '2025-02-10', 3, $2, $3, 'Profissional Silva'),
            ($1, '2025-02-12', 2, $4, $5, 'Profissional Silva');
        `, [
          p1Id,
          JSON.stringify({
            reformer: ['Footwork', 'Hundred', 'Coordination'],
            cadillac: ['Leg Springs'],
            solo: ['The Hundred', 'Roll Up']
          }),
          'Aluna demonstrou boa flexibilidade. Trabalhar mais o core. Reportou leve desconforto lombar (EVA 3).',
          JSON.stringify({
            reformer: ['Circles', 'Long Stretch', 'Elephant'],
            chair: ['Footwork', 'Pike'],
            solo: ['Single Leg Stretch', 'Double Leg Stretch']
          }),
          'Ótima evolução no controle do core. Dor lombar diminuiu (EVA 2). Conseguiu manter alinhamento durante os exercícios.'
        ]);
      }

      if (patient2.rows.length > 0) {
        const p2Id = patient2.rows[0].id;
        
        await client.query(`
          INSERT INTO attendance (patient_id, date, status, notes) 
          VALUES 
            ($1, '2025-02-11', 'present', ''),
            ($1, '2025-02-13', 'present', '');
        `, [p2Id]);

        await client.query(`
          INSERT INTO evolutions (patient_id, date, eva, exercises, notes, author) 
          VALUES ($1, '2025-02-11', 0, $2, $3, 'Profissional Silva');
        `, [
          p2Id,
          JSON.stringify({
            reformer: ['Footwork', 'Hundred'],
            solo: ['The Hundred', 'Roll Up', 'Single Leg Circle']
          }),
          'Primeira aula. Aluno sem dores. Boa compreensão dos movimentos básicos.'
        ]);
      }

      console.log('✅ Dados de frequência e evoluções criados');
    }

    await client.query('COMMIT');
    console.log('✅ Seed concluído com sucesso!');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Erro ao popular banco:', error);
    throw error;
  } finally {
    client.release();
  }
};

module.exports = { seedData };
