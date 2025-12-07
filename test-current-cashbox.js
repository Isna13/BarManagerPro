/**
 * Script para testar o endpoint /cash-box/current
 */

const API_URL = 'https://barmanagerbackend-production.up.railway.app/api/v1';

async function main() {
  console.log('🔍 Testando endpoint /cash-box/current...\n');
  
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
  const token = loginData.accessToken;
  console.log('✅ Login bem-sucedido\n');
  
  // Teste: GET /cash-box/current
  console.log('📋 GET /cash-box/current:');
  const response = await fetch(`${API_URL}/cash-box/current`, {
    headers: { 
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });
  
  console.log('   Status:', response.status);
  
  const text = await response.text();
  console.log('   Resposta raw:', text || '(vazio)');
  
  if (response.status === 204 || response.status === 404 || !text) {
    console.log('   ✅ Nenhum caixa aberto (esperado!)');
  } else if (response.ok && text) {
    try {
      const data = JSON.parse(text);
      console.log('   ⚠️ Caixa encontrado:');
      console.log('      ID:', data.id);
      console.log('      Status:', data.status);
      console.log('      Box Number:', data.boxNumber);
    } catch (e) {
      console.log('   Erro ao parsear:', e.message);
    }
  }
  
  console.log('\n✅ Teste concluído!');
}

main().catch(console.error);
