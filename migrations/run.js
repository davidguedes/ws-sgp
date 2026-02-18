require('dotenv').config();
const { createTables } = require('./create_tables');
const { seedData } = require('./seed');
const { pool } = require('../src/config/database');

const run = async () => {
  try {
    console.log('🚀 Iniciando migrations...\n');
    
    await createTables();
    console.log('\n📦 Populando banco com dados iniciais...\n');
    
    await seedData();
    console.log('\n✅ Migrations concluídas com sucesso!');
    
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Erro ao executar migrations:', error);
    await pool.end();
    process.exit(1);
  }
};

run();
