/**
 * Script para ajustar o estoque do Super Bock via API do Railway
 * Execute com: npx ts-node prisma/adjust-super-bock-via-api.ts
 */

const RAILWAY_API_URL = 'https://barmanagerbackend-production.up.railway.app/api/v1';

interface Product {
  id: string;
  name: string;
}

interface InventoryItem {
  id: string;
  productId: string;
  qtyUnits: number;
}

async function login(): Promise<string> {
  console.log('🔐 Fazendo login...');
  
  const response = await fetch(`${RAILWAY_API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'isnatchuda1@gmail.com',
      password: 'isna123'
    })
  });
  
  if (!response.ok) {
    throw new Error(`Login falhou: ${response.status}`);
  }
  
  const data = await response.json() as { accessToken: string };
  console.log('✅ Login bem sucedido!');
  return data.accessToken;
}

async function getProducts(token: string): Promise<Product[]> {
  const response = await fetch(`${RAILWAY_API_URL}/products`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  if (!response.ok) {
    throw new Error(`Erro ao buscar produtos: ${response.status}`);
  }
  
  return response.json() as Promise<Product[]>;
}

async function getInventory(token: string): Promise<InventoryItem[]> {
  const response = await fetch(`${RAILWAY_API_URL}/inventory`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  if (!response.ok) {
    throw new Error(`Erro ao buscar inventário: ${response.status}`);
  }
  
  return response.json() as Promise<InventoryItem[]>;
}

async function adjustStock(token: string, productId: string, branchId: string, adjustment: number): Promise<void> {
  console.log(`📝 Ajustando estoque: productId=${productId}, adjustment=${adjustment}`);
  
  const response = await fetch(`${RAILWAY_API_URL}/inventory/adjust-by-product`, {
    method: 'PUT',
    headers: { 
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      productId,
      branchId,
      adjustment,
      reason: 'Ajuste manual - correção de sync da venda mobile'
    })
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Erro ao ajustar estoque: ${response.status} - ${error}`);
  }
  
  console.log('✅ Estoque ajustado com sucesso!');
}

async function main() {
  try {
    // Login
    const token = await login();
    
    // Buscar produtos
    console.log('🔍 Buscando produtos...');
    const products = await getProducts(token);
    
    // Encontrar Super Bock
    const superBock = products.find(p => 
      p.name.toLowerCase().includes('super bock') ||
      p.name.toLowerCase().includes('superbock')
    );
    
    if (!superBock) {
      console.log('❌ Produto Super Bock não encontrado!');
      console.log('Produtos disponíveis:', products.map(p => p.name));
      return;
    }
    
    console.log(`✅ Produto encontrado: ${superBock.name} (ID: ${superBock.id})`);
    
    // Buscar inventário atual
    console.log('📦 Buscando inventário...');
    const inventory = await getInventory(token);
    const superBockInv = inventory.find(i => i.productId === superBock.id);
    
    if (superBockInv) {
      console.log(`📦 Estoque atual: ${superBockInv.qtyUnits} unidades`);
    } else {
      console.log('📦 Item de inventário não encontrado');
    }
    
    // Ajustar estoque (decrementar 6 unidades)
    await adjustStock(token, superBock.id, 'main-branch', -6);
    
    // Verificar novo estoque
    const updatedInventory = await getInventory(token);
    const updatedSuperBock = updatedInventory.find(i => i.productId === superBock.id);
    
    if (updatedSuperBock) {
      console.log(`📦 Novo estoque: ${updatedSuperBock.qtyUnits} unidades`);
    }
    
    console.log('\n✅ Ajuste concluído com sucesso!');
    
  } catch (error) {
    console.error('❌ Erro:', error);
  }
}

main();
