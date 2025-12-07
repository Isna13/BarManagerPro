/**
 * Script para debug do histórico de caixas no Railway
 */

const API_URL = 'https://barmanagerbackend-production.up.railway.app/api/v1';

async function main() {
  console.log('🔍 Debug do histórico de caixas no Railway...\n');
  
  // 1. Login
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
    return;
  }
  
  const loginData = await loginResponse.json();
  const token = loginData.accessToken || loginData.access_token || loginData.token;
  console.log('✅ Login bem-sucedido\n');
  
  // Obter branch do usuário
  const profileResponse = await fetch(`${API_URL}/auth/profile`, {
    headers: { 
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });
  
  if (profileResponse.ok) {
    const profile = await profileResponse.json();
    console.log('📋 Perfil do usuário:');
    console.log('   ID:', profile.id);
    console.log('   Email:', profile.email);
    console.log('   Branch ID:', profile.branchId);
  }
  
  // Obter branches
  console.log('\n📋 BRANCHES:');
  const branchesResponse = await fetch(`${API_URL}/branches`, {
    headers: { 
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });
  
  if (branchesResponse.ok) {
    const branches = await branchesResponse.json();
    branches.forEach((b, i) => {
      console.log(`${i+1}. ID: ${b.id}, Nome: ${b.name}`);
    });
    
    // Para cada branch, buscar histórico
    for (const branch of branches) {
      console.log(`\n📦 Histórico para branch ${branch.name}:`);
      
      const historyResponse = await fetch(`${API_URL}/cash-box/history?branchId=${branch.id}`, {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (historyResponse.ok) {
        const history = await historyResponse.json();
        console.log(`   Total: ${history.length} caixas`);
        history.slice(0, 3).forEach((box, i) => {
          console.log(`   ${i+1}. ID: ${box.id}, Status: ${box.status}, Número: ${box.boxNumber}`);
        });
      } else {
        console.log('   Erro:', await historyResponse.text());
      }
    }
  }
  
  // Buscar o caixa específico
  const cashBoxId = 'f080458b-0111-463a-9134-2b601c2afc63';
  console.log(`\n📦 CAIXA ESPECÍFICO (${cashBoxId}):`);
  const cashBoxResponse = await fetch(`${API_URL}/cash-box/${cashBoxId}`, {
    headers: { 
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });
  
  if (cashBoxResponse.ok) {
    const cashBox = await cashBoxResponse.json();
    console.log('   Status:', cashBox.status);
    console.log('   Branch ID:', cashBox.branchId);
    console.log('   Box Number:', cashBox.boxNumber);
    console.log('   Opening Cash:', cashBox.openingCash);
    console.log('   Closing Cash:', cashBox.closingCash);
    console.log('   Opened At:', cashBox.openedAt);
    console.log('   Closed At:', cashBox.closedAt);
  } else {
    console.log('   Erro:', await cashBoxResponse.text());
  }
  
  // Buscar current para cada branch
  console.log('\n📦 CAIXA ATUAL (current):');
  const branchesData = await (await fetch(`${API_URL}/branches`, {
    headers: { 'Authorization': `Bearer ${token}` }
  })).json();
  
  for (const branch of branchesData) {
    const currentResponse = await fetch(`${API_URL}/cash-box/current?branchId=${branch.id}`, {
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (currentResponse.ok) {
      const current = await currentResponse.json();
      console.log(`   Branch ${branch.name}:`);
      if (current) {
        console.log(`      ID: ${current.id}`);
        console.log(`      Status: ${current.status}`);
        console.log(`      Box Number: ${current.boxNumber}`);
      } else {
        console.log(`      Nenhum caixa aberto`);
      }
    } else if (currentResponse.status === 404) {
      console.log(`   Branch ${branch.name}: Nenhum caixa aberto`);
    } else {
      console.log(`   Branch ${branch.name}: Erro -`, await currentResponse.text());
    }
  }
  
  console.log('\n\n✅ Debug concluído!');
}

main().catch(console.error);
