/**
 * Script para testar os endpoints de history do cash-box
 */

const API_URL = 'https://barmanagerbackend-production.up.railway.app/api/v1';

async function main() {
  console.log('🔍 Testando endpoints de histórico de caixas...\n');
  
  // 1. Login
  const loginResponse = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'isnatchuda1@gmail.com',
      password: 'isna123'
    })
  });
  
  const loginData = await loginResponse.json();
  const token = loginData.accessToken || loginData.access_token || loginData.token;
  console.log('✅ Login bem-sucedido\n');
  
  // Teste 1: GET /cash-box/history (sem parâmetros)
  console.log('📋 TESTE 1: GET /cash-box/history (sem parâmetros)');
  const test1 = await fetch(`${API_URL}/cash-box/history`, {
    headers: { 
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });
  console.log('   Status:', test1.status);
  const data1 = await test1.json();
  console.log('   Tipo resposta:', typeof data1, Array.isArray(data1) ? `(array de ${data1.length})` : '');
  console.log('   Resposta (primeiros 500 chars):', JSON.stringify(data1).substring(0, 500));
  
  // Teste 2: GET /cash-box/history?branchId=main-branch
  console.log('\n📋 TESTE 2: GET /cash-box/history?branchId=main-branch');
  const test2 = await fetch(`${API_URL}/cash-box/history?branchId=main-branch`, {
    headers: { 
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });
  console.log('   Status:', test2.status);
  const data2 = await test2.json();
  console.log('   Tipo resposta:', typeof data2, Array.isArray(data2) ? `(array de ${data2.length})` : '');
  if (Array.isArray(data2) && data2.length > 0) {
    console.log('   Primeiro item:', JSON.stringify(data2[0]).substring(0, 300));
  }
  
  // Teste 3: GET /cash-box/history/main-branch
  console.log('\n📋 TESTE 3: GET /cash-box/history/main-branch');
  const test3 = await fetch(`${API_URL}/cash-box/history/main-branch`, {
    headers: { 
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });
  console.log('   Status:', test3.status);
  const data3 = await test3.json();
  console.log('   Tipo resposta:', typeof data3, Array.isArray(data3) ? `(array de ${data3.length})` : '');
  if (Array.isArray(data3) && data3.length > 0) {
    console.log('   Primeiro item:', JSON.stringify(data3[0]).substring(0, 300));
  }
  
  console.log('\n\n✅ Testes concluídos!');
}

main().catch(console.error);
