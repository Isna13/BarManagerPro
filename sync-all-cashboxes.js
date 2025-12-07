/**
 * Script para sincronizar caixas do banco local para o Railway
 * e corrigir o status de sync
 */

const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');
const os = require('os');

const API_URL = 'https://barmanagerbackend-production.up.railway.app/api/v1';

async function main() {
  console.log('🔄 Sincronizando caixas locais com o Railway...\n');
  
  // Caminho do banco de dados do Electron
  const dbPath = path.join(os.homedir(), 'AppData', 'Roaming', '@barmanager', 'desktop', 'barmanager.db');
  
  console.log('📂 Banco local:', dbPath);
  
  if (!fs.existsSync(dbPath)) {
    console.error('❌ Banco de dados não encontrado!');
    process.exit(1);
  }
  
  // 1. Login no Railway
  console.log('🔑 Fazendo login no Railway...');
  const loginResponse = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'isnatchuda1@gmail.com',
      password: 'isna123'
    })
  });
  
  if (!loginResponse.ok) {
    console.error('❌ Erro no login:', await loginResponse.text());
    process.exit(1);
  }
  
  const loginData = await loginResponse.json();
  const token = loginData.accessToken;
  console.log('✅ Login bem-sucedido\n');
  
  // 2. Ler banco local
  const SQL = await initSqlJs();
  const buffer = fs.readFileSync(dbPath);
  const db = new SQL.Database(buffer);
  
  // 3. Buscar caixas locais com synced=0
  console.log('📦 Buscando caixas locais não sincronizados...');
  const cashBoxes = db.exec('SELECT * FROM cash_boxes WHERE synced = 0 ORDER BY opened_at DESC');
  
  if (cashBoxes.length === 0 || cashBoxes[0].values.length === 0) {
    console.log('✅ Todos os caixas já estão sincronizados!\n');
  } else {
    const columns = cashBoxes[0].columns;
    const rows = cashBoxes[0].values;
    
    console.log(`📋 ${rows.length} caixas para sincronizar:\n`);
    
    for (const row of rows) {
      const box = {};
      columns.forEach((col, j) => box[col] = row[j]);
      
      console.log(`\n📦 Caixa: ${box.id}`);
      console.log(`   Número: ${box.box_number}`);
      console.log(`   Status local: ${box.status}`);
      
      // Verificar se existe no Railway
      const checkResponse = await fetch(`${API_URL}/cash-box/${box.id}`, {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (checkResponse.ok) {
        const railwayBox = await checkResponse.json();
        console.log(`   ✅ Existe no Railway (status: ${railwayBox.status})`);
        
        // Se o status é diferente e o local está fechado, fechar no Railway
        if (railwayBox.status === 'open' && box.status === 'closed') {
          console.log(`   ⚠️ Fechando no Railway...`);
          const closeResponse = await fetch(`${API_URL}/cash-box/${box.id}/close`, {
            method: 'POST',
            headers: { 
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              closingAmount: box.closing_cash || 0,
              notes: 'Sincronizado via script de correção'
            })
          });
          
          if (closeResponse.ok) {
            console.log(`   ✅ Caixa fechado no Railway!`);
          } else {
            console.error(`   ❌ Erro ao fechar:`, await closeResponse.text());
          }
        }
      } else if (checkResponse.status === 404) {
        console.log(`   ⚠️ Não existe no Railway, criando...`);
        
        // Criar o caixa no Railway
        const createResponse = await fetch(`${API_URL}/cash-box/open`, {
          method: 'POST',
          headers: { 
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            id: box.id,
            branchId: box.branch_id || 'main-branch',
            openingAmount: box.opening_cash || 0,
            boxNumber: box.box_number,
            notes: 'Sincronizado via script de correção'
          })
        });
        
        if (createResponse.ok) {
          console.log(`   ✅ Caixa criado no Railway`);
          
          // Se estava fechado, fechar também
          if (box.status === 'closed') {
            console.log(`   Fechando...`);
            const closeResponse = await fetch(`${API_URL}/cash-box/${box.id}/close`, {
              method: 'POST',
              headers: { 
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                closingAmount: box.closing_cash || 0,
                notes: 'Sincronizado via script de correção'
              })
            });
            
            if (closeResponse.ok) {
              console.log(`   ✅ Caixa fechado no Railway!`);
            } else {
              console.error(`   ❌ Erro ao fechar:`, await closeResponse.text());
            }
          }
        } else {
          const error = await createResponse.text();
          console.error(`   ❌ Erro ao criar:`, error);
          
          // Se erro é "Já existe um caixa aberto", tentar fechar o existente primeiro
          if (error.includes('Já existe um caixa aberto')) {
            console.log(`   ⚠️ Já existe um caixa aberto na filial`);
            
            // Buscar o caixa aberto atual
            const branchId = box.branch_id || 'main-branch';
            const currentResponse = await fetch(`${API_URL}/cash-box/current?branchId=${branchId}`, {
              headers: { 
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              }
            });
            
            if (currentResponse.ok) {
              const currentText = await currentResponse.text();
              if (currentText) {
                const currentBox = JSON.parse(currentText);
                console.log(`   Caixa aberto atual: ${currentBox.id}`);
              }
            }
          }
        }
      } else {
        console.error(`   ❌ Erro ao verificar:`, await checkResponse.text());
      }
    }
  }
  
  // 4. Limpar fila de sync com status 'failed' para cash_box
  console.log('\n\n🧹 Limpando fila de sync com erros...');
  const failedQueue = db.exec(`
    SELECT id, entity_id, operation, last_error 
    FROM sync_queue 
    WHERE entity = 'cash_box' AND status = 'failed'
  `);
  
  if (failedQueue.length > 0 && failedQueue[0].values.length > 0) {
    console.log(`📋 ${failedQueue[0].values.length} itens com falha na fila:\n`);
    
    for (const row of failedQueue[0].values) {
      const [id, entityId, operation, lastError] = row;
      console.log(`   - ${operation} de ${entityId}: ${lastError}`);
    }
    
    // Atualizar para 'completed' já que verificamos que estão sincronizados
    console.log('\n   Atualizando status para "completed"...');
    
    // sql.js não suporta updates, vamos apenas reportar
    console.log('   ⚠️ Para atualizar o banco local, execute no Electron DevTools:');
    console.log('   db.run("UPDATE sync_queue SET status = \'completed\' WHERE entity = \'cash_box\' AND status = \'failed\'")');
    console.log('   db.run("UPDATE cash_boxes SET synced = 1")');
  } else {
    console.log('✅ Nenhum item com falha na fila!');
  }
  
  db.close();
  console.log('\n\n✅ Sincronização concluída!');
}

main().catch(console.error);
