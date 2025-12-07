/**
 * Script para verificar e sincronizar o fechamento de caixa
 * 
 * Uso: node fix-cashbox-sync.js
 */

const API_URL = 'https://barmanagerbackend-production.up.railway.app/api/v1';

async function main() {
  console.log('🔍 Verificando status de caixas no Railway...\n');
  
  // 1. Login
  const loginRes = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'isnatchuda1@gmail.com',
      password: 'isna123'
    })
  });
  
  if (!loginRes.ok) {
    console.error('❌ Erro no login:', await loginRes.text());
    return;
  }
  
  const { access_token } = await loginRes.json();
  const headers = {
    'Authorization': `Bearer ${access_token}`,
    'Content-Type': 'application/json'
  };
  
  console.log('✅ Login bem-sucedido\n');
  
  // 2. Verificar caixa atual (aberto)
  console.log('📦 Verificando caixa atual (aberto)...');
  const currentRes = await fetch(`${API_URL}/cash-box/current/main-branch`, { headers });
  
  if (currentRes.ok) {
    const currentBox = await currentRes.json();
    console.log('\n🔓 CAIXA ABERTO ENCONTRADO:');
    console.log(`   ID: ${currentBox.id}`);
    console.log(`   Número: ${currentBox.boxNumber}`);
    console.log(`   Aberto em: ${currentBox.openedAt}`);
    console.log(`   Valor abertura: ${currentBox.openingCash}`);
    console.log(`   Status: ${currentBox.status}`);
    
    // Perguntar se deve fechar
    console.log('\n⚠️  Este caixa precisa ser fechado no Railway!');
    console.log('   Execute o comando abaixo para fechá-lo:\n');
    console.log(`   node fix-cashbox-sync.js close ${currentBox.id}\n`);
    
    // Verificar argumentos
    if (process.argv[2] === 'close' && process.argv[3] === currentBox.id) {
      await closeCashBox(currentBox.id, headers);
    }
  } else {
    console.log('✅ Nenhum caixa aberto no Railway\n');
  }
  
  // 3. Verificar histórico
  console.log('📋 Últimos caixas fechados no Railway:');
  const historyRes = await fetch(`${API_URL}/cash-box/history/main-branch`, { headers });
  
  if (historyRes.ok) {
    const history = await historyRes.json();
    if (history.length === 0) {
      console.log('   Nenhum caixa fechado encontrado');
    } else {
      history.slice(0, 5).forEach((box, i) => {
        console.log(`   ${i+1}. ID: ${box.id.substring(0, 8)}... | Fechado: ${box.closedAt || 'N/A'} | Status: ${box.status}`);
      });
    }
  }
  
  // 4. Buscar TODOS os caixas (incluindo abertos) via outra rota
  console.log('\n📋 Verificando TODOS os caixas no banco (debug)...');
  try {
    // Tentar pegar pelo histórico geral
    const allRes = await fetch(`${API_URL}/cash-box/history`, { headers });
    console.log('   Status resposta history:', allRes.status);
    const allText = await allRes.text();
    console.log('   Resposta raw:', allText.substring(0, 200));
    if (allRes.ok && allText) {
      try {
        const allBoxes = JSON.parse(allText);
        console.log(`   Total de caixas: ${allBoxes.length}`);
        allBoxes.slice(0, 10).forEach((box, i) => {
          console.log(`   ${i+1}. ID: ${box.id.substring(0, 8)}... | Status: ${box.status} | Aberto: ${box.openedAt} | Fechado: ${box.closedAt || 'N/A'}`);
        });
      } catch (e) {
        console.log('   Erro ao parsear:', e.message);
      }
    }
  } catch (e) {
    console.log('   Não foi possível obter lista completa:', e.message);
  }
  
  console.log('\n✅ Verificação concluída!');
}

async function closeCashBox(cashBoxId, headers) {
  console.log(`\n🔒 Fechando caixa ${cashBoxId}...`);
  
  try {
    const closeRes = await fetch(`${API_URL}/cash-box/${cashBoxId}/close`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        closingAmount: 0,
        notes: 'Fechado via script de sincronização'
      })
    });
    
    if (closeRes.ok) {
      const result = await closeRes.json();
      console.log('✅ Caixa fechado com sucesso!');
      console.log(`   Status: ${result.status}`);
      console.log(`   Fechado em: ${result.closedAt}`);
    } else {
      const error = await closeRes.text();
      console.error('❌ Erro ao fechar caixa:', error);
      
      // Tentar force-close
      console.log('\n⚠️  Tentando force-close...');
      const forceRes = await fetch(`${API_URL}/cash-box/${cashBoxId}/force-close`, {
        method: 'PATCH',
        headers
      });
      
      if (forceRes.ok) {
        console.log('✅ Force-close bem-sucedido!');
      } else {
        console.error('❌ Force-close também falhou:', await forceRes.text());
      }
    }
  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
}

main().catch(console.error);
