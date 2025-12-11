/**
 * Script para verificar movimentos de estoque do Super Bock
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
    
    // Buscar inventário do Super Bock
    const productId = 'c5b3a8cc-d072-4c01-8754-097b53fba8ce';
    
    // Buscar todos os itens de inventário
    const invResponse = await fetch(`${RAILWAY_API_URL}/inventory?branchId=main-branch`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const inventory = await invResponse.json() as any[];
    console.log('\n📦 Todos os itens de inventário:');
    for (const item of inventory) {
      console.log(`  - ${item.product?.name || item.productId}: ${item.qtyUnits} un (ID: ${item.id})`);
    }
    
    const superBock = inventory.find(i => i.productId === productId);
    if (superBock) {
      console.log(`\n🍺 Super Bock:`);
      console.log(`  ID: ${superBock.id}`);
      console.log(`  Estoque: ${superBock.qtyUnits}`);
      
      // Buscar movimentos
      const movResponse = await fetch(`${RAILWAY_API_URL}/inventory/movements/${superBock.id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (movResponse.ok) {
        const movements = await movResponse.json() as any[];
        console.log(`\n📋 Últimos ${movements.length} movimentos:`);
        for (const mov of movements.slice(0, 10)) {
          console.log(`  - ${mov.type}: ${mov.qtyUnits} un - ${mov.reason} (${mov.createdAt})`);
        }
      }
    } else {
      console.log('❌ Super Bock não encontrado no inventário');
    }
    
  } catch (error) {
    console.error('❌ Erro:', error);
  }
}

main();
