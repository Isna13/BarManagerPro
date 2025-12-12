import axios from 'axios';

const API_URL = 'https://barmanagerbackend-production.up.railway.app/api/v1';

async function adjustStock() {
  try {
    // Login
    const loginResponse = await axios.post(`${API_URL}/auth/login`, {
      email: 'admin@barmanager.gw',
      password: 'admin123'
    });
    const token = loginResponse.data.access_token;
    console.log('✅ Login OK');

    // Buscar inventário do Super Bock
    const invResponse = await axios.get(`${API_URL}/inventory`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    const superBock = invResponse.data.find((i: any) => 
      i.product?.name?.toLowerCase().includes('super bock')
    );
    
    if (!superBock) {
      console.log('❌ Super Bock não encontrado');
      return;
    }

    console.log('📦 Estoque atual:', superBock.qtyUnits, 'un');
    console.log('📦 ID:', superBock.id);
    console.log('📦 ProductId:', superBock.productId);
    console.log('📦 BranchId:', superBock.branchId);

    const NOVO_ESTOQUE = 234; // 240 - 6 = 234
    
    if (superBock.qtyUnits === NOVO_ESTOQUE) {
      console.log('✅ Estoque já está correto!');
      return;
    }

    // Calcular ajuste necessário
    const adjustment = NOVO_ESTOQUE - superBock.qtyUnits;
    console.log(`🔧 Ajuste necessário: ${adjustment} (${superBock.qtyUnits} → ${NOVO_ESTOQUE})`);

    // Usar endpoint adjust-by-product
    await axios.put(`${API_URL}/inventory/adjust-by-product`, {
      productId: superBock.productId,
      branchId: superBock.branchId,
      adjustment: adjustment,
      reason: 'Correção: venda mobile não sincronizada'
    }, {
      headers: { Authorization: `Bearer ${token}` }
    });

    console.log('✅ Estoque ajustado para', NOVO_ESTOQUE, 'unidades!');

    // Verificar
    const verifyResponse = await axios.get(`${API_URL}/inventory`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const updated = verifyResponse.data.find((i: any) => i.id === superBock.id);
    console.log('📦 Novo estoque:', updated?.qtyUnits, 'un');

  } catch (error: any) {
    console.error('❌ Erro:', error.response?.data || error.message);
  }
}

adjustStock();
