/**
 * Script para corrigir o estoque do Super Bock usando o ID correto
 */

const RAILWAY_API_URL = 'https://barmanagerbackend-production.up.railway.app/api/v1';

async function login(): Promise<string> {
  const response = await fetch(`${RAILWAY_API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'isnatchuda1@gmail.com',
      password: 'isna123'
    })
  });
  
  const data = await response.json() as { accessToken: string };
  return data.accessToken;
}

async function main() {
  try {
    const token = await login();
    console.log('✅ Login OK');
    
    // ID correto do inventário do Super Bock
    const inventoryId = 'a2d5dffe-3bab-4443-a146-a9d348c3b70d';
    
    // Verificar estoque atual
    const getResponse = await fetch(`${RAILWAY_API_URL}/inventory/${inventoryId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (!getResponse.ok) {
      throw new Error(`Erro ao buscar inventário: ${getResponse.status}`);
    }
    
    const item = await getResponse.json() as any;
    console.log(`📦 Estoque atual: ${item.qtyUnits} un`);
    console.log(`📦 ProductId: ${item.productId}`);
    console.log(`📦 BranchId: ${item.branchId}`);
    
    if (item.qtyUnits === 240) {
      console.log('✅ Estoque já está correto!');
      return;
    }
    
    console.log(`📝 Ajustando: ${item.qtyUnits} -> 240`);
    
    // Usar PUT /:id para atualizar diretamente
    const adjustResponse = await fetch(`${RAILWAY_API_URL}/inventory/${inventoryId}`, {
      method: 'PUT',
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        qtyUnits: 240,
        productId: item.productId,
        branchId: item.branchId
      })
    });
    
    if (!adjustResponse.ok) {
      const error = await adjustResponse.text();
      throw new Error(`Erro ao ajustar: ${adjustResponse.status} - ${error}`);
    }
    
    const result = await adjustResponse.json() as any;
    console.log(`✅ Novo estoque: ${result.qtyUnits} un`);
    
  } catch (error) {
    console.error('❌ Erro:', error);
  }
}

main();
