/**
 * DIAGNÓSTICO: Railway 200 0b Response
 * 
 * Este script verifica diretamente no banco Railway:
 * 1. Quantidade de registros em cada tabela
 * 2. Estado do filtro isActive em products/customers
 * 3. Se há caixa aberto
 * 
 * Uso: 
 *   DATABASE_URL="postgresql://..." node diagnose-railway-0b.js
 * 
 * Ou configure a variável no .env e execute:
 *   node diagnose-railway-0b.js
 */

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
});

async function diagnose() {
  console.log('\n' + '='.repeat(70));
  console.log('🔍 DIAGNÓSTICO RAILWAY 200 0b');
  console.log('='.repeat(70));
  
  try {
    // Testar conexão
    await prisma.$connect();
    console.log('\n✅ Conexão com banco estabelecida');
    
    // Estatísticas gerais
    console.log('\n📊 CONTAGEM DE REGISTROS POR TABELA:');
    console.log('-'.repeat(50));
    
    const tables = [
      { name: 'Product', model: 'product' },
      { name: 'Customer', model: 'customer' },
      { name: 'Category', model: 'category' },
      { name: 'Supplier', model: 'supplier' },
      { name: 'Branch', model: 'branch' },
      { name: 'Table', model: 'table' },
      { name: 'Sale', model: 'sale' },
      { name: 'CashBox', model: 'cashBox' },
      { name: 'InventoryItem', model: 'inventoryItem' },
      { name: 'Debt', model: 'debt' },
      { name: 'Purchase', model: 'purchase' },
      { name: 'User', model: 'user' },
    ];
    
    for (const t of tables) {
      try {
        const count = await prisma[t.model].count();
        const icon = count > 0 ? '✅' : '⚠️';
        console.log(`   ${icon} ${t.name.padEnd(20)}: ${count} registros`);
      } catch (e) {
        console.log(`   ❌ ${t.name.padEnd(20)}: ERRO - ${e.message}`);
      }
    }
    
    // Análise específica de Products (filtro isActive)
    console.log('\n📦 ANÁLISE DE PRODUCTS (filtro isActive):');
    console.log('-'.repeat(50));
    const productsActive = await prisma.product.count({ where: { isActive: true } });
    const productsInactive = await prisma.product.count({ where: { isActive: false } });
    const productsNull = await prisma.product.count({ where: { isActive: null } });
    console.log(`   ✅ Ativos (isActive=true):     ${productsActive}`);
    console.log(`   ⚠️ Inativos (isActive=false):  ${productsInactive}`);
    console.log(`   ❓ Null (isActive=null):       ${productsNull}`);
    
    if (productsActive === 0 && (productsInactive > 0 || productsNull > 0)) {
      console.log('\n   🔴 PROBLEMA DETECTADO: Todos os produtos têm isActive != true');
      console.log('   💡 SOLUÇÃO: Executar UPDATE no banco ou usar includeInactive=true');
    }
    
    // Análise específica de Customers (filtro isActive)
    console.log('\n👥 ANÁLISE DE CUSTOMERS (filtro isActive):');
    console.log('-'.repeat(50));
    const customersActive = await prisma.customer.count({ where: { isActive: true } });
    const customersInactive = await prisma.customer.count({ where: { isActive: false } });
    const customersNull = await prisma.customer.count({ where: { isActive: null } });
    console.log(`   ✅ Ativos (isActive=true):     ${customersActive}`);
    console.log(`   ⚠️ Inativos (isActive=false):  ${customersInactive}`);
    console.log(`   ❓ Null (isActive=null):       ${customersNull}`);
    
    // Análise de CashBox
    console.log('\n💰 ANÁLISE DE CASHBOX:');
    console.log('-'.repeat(50));
    const cashBoxOpen = await prisma.cashBox.count({ where: { status: 'open' } });
    const cashBoxClosed = await prisma.cashBox.count({ where: { status: 'closed' } });
    console.log(`   🟢 Abertos:  ${cashBoxOpen}`);
    console.log(`   🔴 Fechados: ${cashBoxClosed}`);
    
    if (cashBoxOpen === 0) {
      console.log('\n   ℹ️ /cash-box/current retorna null porque não há caixa aberto');
    }
    
    // Análise de InventoryItem
    console.log('\n📦 ANÁLISE DE INVENTORY:');
    console.log('-'.repeat(50));
    const inventoryTotal = await prisma.inventoryItem.count();
    console.log(`   Total: ${inventoryTotal}`);
    
    if (inventoryTotal === 0) {
      console.log('\n   ⚠️ Sem itens de inventário - isso é normal se não há produtos');
    }
    
    // Últimas vendas
    console.log('\n🛒 ÚLTIMAS VENDAS:');
    console.log('-'.repeat(50));
    const recentSales = await prisma.sale.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: { id: true, saleNumber: true, total: true, status: true, createdAt: true },
    });
    
    if (recentSales.length === 0) {
      console.log('   ⚠️ Nenhuma venda encontrada');
    } else {
      recentSales.forEach(s => {
        console.log(`   ${s.saleNumber} | ${s.status} | ${s.total} | ${s.createdAt.toISOString().slice(0, 19)}`);
      });
    }
    
    // Resumo final
    console.log('\n' + '='.repeat(70));
    console.log('📋 RESUMO DO DIAGNÓSTICO:');
    console.log('='.repeat(70));
    
    const issues = [];
    
    if (productsActive === 0) {
      issues.push('- Products: Nenhum produto ativo (isActive=true)');
    }
    if (cashBoxOpen === 0) {
      issues.push('- CashBox: Nenhum caixa aberto (retorna null)');
    }
    if (inventoryTotal === 0) {
      issues.push('- Inventory: Sem itens de inventário');
    }
    if (recentSales.length === 0) {
      issues.push('- Sales: Sem vendas registradas');
    }
    
    if (issues.length === 0) {
      console.log('\n✅ Nenhum problema detectado. Os dados existem no banco.');
      console.log('   Se ainda recebe 0b, pode ser:');
      console.log('   1. Problema de compressão (gzip) que não seta Content-Length');
      console.log('   2. Problema de serialização');
      console.log('   3. Cache de CDN/proxy');
    } else {
      console.log('\n⚠️ PROBLEMAS DETECTADOS:');
      issues.forEach(i => console.log(`   ${i}`));
      console.log('\n💡 Os endpoints retornam 0b porque os dados estão vazios ou filtrados.');
    }
    
    console.log('\n' + '='.repeat(70) + '\n');
    
  } catch (error) {
    console.error('\n❌ ERRO:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

diagnose();
