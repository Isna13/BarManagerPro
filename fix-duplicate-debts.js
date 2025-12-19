/**
 * Script para corrigir dívidas duplicadas
 * 
 * Este script identifica e remove dívidas duplicadas mantendo apenas uma por saleId
 * 
 * Uso: node fix-duplicate-debts.js
 */

const API_URL = 'https://barmanagerpro-production.up.railway.app';

async function getAuthToken() {
  const response = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'admin@bar.com',
      password: 'admin123'
    })
  });
  
  if (!response.ok) {
    throw new Error('Falha na autenticação');
  }
  
  const data = await response.json();
  return data.access_token;
}

async function getAllDebts(token) {
  const response = await fetch(`${API_URL}/debts`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  if (!response.ok) {
    throw new Error('Falha ao buscar dívidas');
  }
  
  return response.json();
}

async function deleteDebt(token, debtId) {
  const response = await fetch(`${API_URL}/debts/${debtId}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  return response.ok;
}

async function main() {
  console.log('🔧 Iniciando correção de dívidas duplicadas...\n');
  
  try {
    // 1. Autenticar
    console.log('🔐 Autenticando...');
    const token = await getAuthToken();
    console.log('✅ Autenticado!\n');
    
    // 2. Buscar todas as dívidas
    console.log('📥 Buscando todas as dívidas...');
    const debts = await getAllDebts(token);
    console.log(`   Total de dívidas: ${debts.length}\n`);
    
    // 3. Agrupar por saleId
    const bySaleId = {};
    const withoutSaleId = [];
    
    for (const debt of debts) {
      if (debt.saleId) {
        if (!bySaleId[debt.saleId]) {
          bySaleId[debt.saleId] = [];
        }
        bySaleId[debt.saleId].push(debt);
      } else {
        withoutSaleId.push(debt);
      }
    }
    
    // 4. Identificar duplicadas
    const duplicates = [];
    let keptCount = 0;
    
    console.log('🔍 Analisando duplicadas por saleId...\n');
    
    for (const [saleId, saleDebts] of Object.entries(bySaleId)) {
      if (saleDebts.length > 1) {
        console.log(`❌ saleId ${saleId}: ${saleDebts.length} dívidas (DUPLICADA)`);
        
        // Ordenar por createdAt para manter a mais antiga
        saleDebts.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        
        const kept = saleDebts[0];
        const toRemove = saleDebts.slice(1);
        
        console.log(`   ✅ Mantendo: ${kept.id} (${kept.createdAt})`);
        for (const dup of toRemove) {
          console.log(`   🗑️  Remover: ${dup.id} (${dup.createdAt})`);
          duplicates.push(dup);
        }
        console.log('');
        keptCount++;
      }
    }
    
    console.log('\n═══════════════════════════════════════════════════════');
    console.log(`📊 RESUMO:`);
    console.log(`   Total de dívidas: ${debts.length}`);
    console.log(`   Dívidas sem saleId: ${withoutSaleId.length}`);
    console.log(`   Sales com duplicatas: ${keptCount}`);
    console.log(`   Dívidas a remover: ${duplicates.length}`);
    console.log('═══════════════════════════════════════════════════════\n');
    
    if (duplicates.length === 0) {
      console.log('✅ Nenhuma duplicata encontrada!');
      return;
    }
    
    // 5. Perguntar antes de deletar
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    const answer = await new Promise(resolve => {
      rl.question(`\n⚠️  Deseja remover ${duplicates.length} dívidas duplicadas? (s/n): `, resolve);
    });
    rl.close();
    
    if (answer.toLowerCase() !== 's') {
      console.log('❌ Operação cancelada.');
      return;
    }
    
    // 6. Remover duplicatas
    console.log('\n🗑️  Removendo duplicatas...\n');
    
    let removed = 0;
    let errors = 0;
    
    for (const debt of duplicates) {
      try {
        const success = await deleteDebt(token, debt.id);
        if (success) {
          console.log(`   ✅ Removido: ${debt.id}`);
          removed++;
        } else {
          console.log(`   ❌ Falha ao remover: ${debt.id}`);
          errors++;
        }
      } catch (e) {
        console.log(`   ❌ Erro ao remover ${debt.id}: ${e.message}`);
        errors++;
      }
    }
    
    console.log('\n═══════════════════════════════════════════════════════');
    console.log(`✅ CONCLUÍDO:`);
    console.log(`   Removidas: ${removed}`);
    console.log(`   Erros: ${errors}`);
    console.log('═══════════════════════════════════════════════════════\n');
    
    // 7. Recalcular saldo dos clientes afetados
    console.log('📊 ATENÇÃO: Execute uma sincronização completa no Electron');
    console.log('   para atualizar os saldos dos clientes.\n');
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
    process.exit(1);
  }
}

main();
