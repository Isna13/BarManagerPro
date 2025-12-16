/**
 * Script para corrigir métodos de pagamento no PostgreSQL do Railway
 */
const { Client } = require('pg');

const DATABASE_URL = 'postgresql://postgres:HWtUBTHXfKcStZOPydjJyvoNAhkvpgBV@switchyard.proxy.rlwy.net:57641/railway';

async function main() {
  console.log('🔌 Conectando ao PostgreSQL do Railway...');
  
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    await client.connect();
    console.log('✅ Conectado!\n');
    
    // 1. Verificar situação atual
    console.log('📊 Situação atual dos métodos de pagamento:');
    const before = await client.query(`
      SELECT method, COUNT(*) as count 
      FROM payments 
      GROUP BY method 
      ORDER BY count DESC
    `);
    console.table(before.rows);
    
    // 2. Aplicar correções
    console.log('\n🔧 Aplicando correções...\n');
    
    // Corrigir 'orange' -> 'ORANGE_MONEY'
    const r1 = await client.query(`UPDATE payments SET method = 'ORANGE_MONEY' WHERE LOWER(method) = 'orange'`);
    console.log(`   ✅ orange -> ORANGE_MONEY: ${r1.rowCount} registros`);
    
    // Normalizar 'cash' -> 'CASH'
    const r2 = await client.query(`UPDATE payments SET method = 'CASH' WHERE LOWER(method) = 'cash' AND method != 'CASH'`);
    console.log(`   ✅ cash -> CASH: ${r2.rowCount} registros`);
    
    // Normalizar 'vale' -> 'VALE'
    const r3 = await client.query(`UPDATE payments SET method = 'VALE' WHERE LOWER(method) IN ('vale', 'debt', 'fiado') AND method != 'VALE'`);
    console.log(`   ✅ vale/debt/fiado -> VALE: ${r3.rowCount} registros`);
    
    // Normalizar 'teletaku' -> 'TELETAKU'
    const r4 = await client.query(`UPDATE payments SET method = 'TELETAKU' WHERE LOWER(method) = 'teletaku' AND method != 'TELETAKU'`);
    console.log(`   ✅ teletaku -> TELETAKU: ${r4.rowCount} registros`);
    
    // Normalizar 'mixed' -> 'MIXED'
    const r5 = await client.query(`UPDATE payments SET method = 'MIXED' WHERE LOWER(method) IN ('mixed', 'misto') AND method != 'MIXED'`);
    console.log(`   ✅ mixed/misto -> MIXED: ${r5.rowCount} registros`);
    
    // 3. Verificar situação após correções
    console.log('\n📊 Situação APÓS correções:');
    const after = await client.query(`
      SELECT method, COUNT(*) as count 
      FROM payments 
      GROUP BY method 
      ORDER BY count DESC
    `);
    console.table(after.rows);
    
    console.log('\n✅ Migração concluída com sucesso!');
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    await client.end();
    console.log('\n🔌 Conexão fechada.');
  }
}

main();
