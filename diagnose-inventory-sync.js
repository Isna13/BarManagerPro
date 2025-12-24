/**
 * Diagnóstico de Sincronização de Estoque Electron ↔ Railway
 * 
 * Execute com: node diagnose-inventory-sync.js
 */

const axios = require('axios');
const Database = require('better-sqlite3');
const path = require('path');
const os = require('os');

// Configurações
const API_URL = 'https://barmanagerbackend-production.up.railway.app/api/v1';
const DB_PATH = path.join(os.homedir(), 'AppData', 'Roaming', 'bar-manager-desktop', 'data', 'barmanager.db');

async function diagnose() {
  console.log('🔍 DIAGNÓSTICO DE SINCRONIZAÇÃO DE ESTOQUE\n');
  console.log('='.repeat(60) + '\n');

  // 1. Verificar banco de dados local
  console.log('📁 1. BANCO DE DADOS LOCAL');
  console.log('-'.repeat(40));
  
  try {
    const db = new Database(DB_PATH, { readonly: true });
    
    // Total de itens de inventário
    const totalItems = db.prepare('SELECT COUNT(*) as count FROM inventory_items').get();
    console.log(`   Total de itens de inventário: ${totalItems.count}`);
    
    // Itens com synced = 0 (PROBLEMA!)
    const unsyncedItems = db.prepare('SELECT COUNT(*) as count FROM inventory_items WHERE synced = 0').get();
    console.log(`   🔴 Itens NÃO sincronizados (synced=0): ${unsyncedItems.count}`);
    
    if (unsyncedItems.count > 0) {
      console.log('\n   ⚠️ ATENÇÃO: Estes itens estão BLOQUEANDO atualizações do servidor!\n');
      
      const unsyncedList = db.prepare(`
        SELECT i.product_id, p.name as product_name, i.qty_units, i.updated_at
        FROM inventory_items i
        LEFT JOIN products p ON i.product_id = p.id
        WHERE i.synced = 0
        ORDER BY i.updated_at DESC
        LIMIT 10
      `).all();
      
      console.log('   Top 10 itens não sincronizados:');
      unsyncedList.forEach((item, idx) => {
        console.log(`   ${idx + 1}. ${item.product_name || 'Produto desconhecido'}`);
        console.log(`      Qty: ${item.qty_units}, Updated: ${item.updated_at}`);
      });
    }
    
    // Verificar fila de sync
    console.log('\n📋 2. FILA DE SINCRONIZAÇÃO');
    console.log('-'.repeat(40));
    
    const queueStats = db.prepare(`
      SELECT 
        status,
        COUNT(*) as count,
        entity
      FROM sync_queue
      WHERE entity IN ('inventory', 'inventory_item')
      GROUP BY status, entity
    `).all();
    
    if (queueStats.length === 0) {
      console.log('   Nenhum item de inventário na fila de sync');
    } else {
      console.log('   Itens de inventário na fila:');
      queueStats.forEach(stat => {
        const icon = stat.status === 'pending' ? '⏳' : stat.status === 'failed' ? '❌' : '✅';
        console.log(`   ${icon} ${stat.entity}: ${stat.count} (${stat.status})`);
      });
    }
    
    // Verificar última sincronização
    const lastSync = db.prepare("SELECT value FROM settings WHERE key = 'last_sync_date'").get();
    console.log(`\n   Última sincronização: ${lastSync?.value || 'Nunca'}`);
    
    db.close();
  } catch (err) {
    console.log(`   ❌ Erro ao acessar banco local: ${err.message}`);
    console.log(`   Caminho esperado: ${DB_PATH}`);
  }
  
  // 2. Verificar servidor Railway
  console.log('\n\n🌐 3. SERVIDOR RAILWAY');
  console.log('-'.repeat(40));
  
  try {
    // Tentar buscar inventário sem autenticação (vai falhar, mas mostra se servidor responde)
    const response = await axios.get(`${API_URL}/inventory`, {
      timeout: 10000,
      validateStatus: () => true // Aceita qualquer status
    });
    
    console.log(`   Status do servidor: ${response.status}`);
    
    if (response.status === 401) {
      console.log('   ⚠️ Autenticação necessária (esperado)');
      console.log('   ✅ Servidor está respondendo corretamente');
    } else if (response.status === 200) {
      const items = Array.isArray(response.data) ? response.data : response.data?.data || [];
      console.log(`   ✅ Servidor retornou ${items.length} itens de inventário`);
      
      // Mostrar alguns itens
      if (items.length > 0) {
        console.log('\n   Amostra do servidor (primeiros 5):');
        items.slice(0, 5).forEach((item, idx) => {
          console.log(`   ${idx + 1}. ${item.product?.name || item.productId}`);
          console.log(`      Qty: ${item.qtyUnits}, Branch: ${item.branchId}`);
        });
      }
    } else {
      console.log(`   ❌ Resposta inesperada: ${response.status}`);
    }
  } catch (err) {
    console.log(`   ❌ Erro ao conectar ao servidor: ${err.message}`);
  }
  
  // 3. Recomendações
  console.log('\n\n📝 4. RECOMENDAÇÕES');
  console.log('-'.repeat(40));
  console.log('   1. Se há itens com synced=0, eles estão bloqueando atualizações');
  console.log('   2. Execute um sync forçado no Electron (Configurações > Sincronização)');
  console.log('   3. Verifique se há erros de rede no log do Electron');
  console.log('   4. Considere implementar a correção no manager.ts');
  
  console.log('\n' + '='.repeat(60));
  console.log('Diagnóstico concluído!');
}

diagnose().catch(console.error);
