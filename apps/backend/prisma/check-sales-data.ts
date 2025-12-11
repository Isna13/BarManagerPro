import axios from 'axios';

const API_URL = 'https://barmanagerbackend-production.up.railway.app/api/v1';

async function checkSales() {
  try {
    // Login primeiro
    const loginResponse = await axios.post(`${API_URL}/auth/login`, {
      email: 'admin@barmanager.gw',
      password: 'admin123'
    });
    const token = loginResponse.data.access_token;
    console.log('✅ Login efetuado');
    
    // Buscar vendas com autenticação
    const response = await axios.get(`${API_URL}/sales`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const sales = response.data;
    console.log('Total vendas:', sales.length);
    console.log('');
    for (const sale of sales.slice(0, 5)) {
      console.log('---');
      console.log('ID:', sale.id);
      console.log('SaleNumber:', sale.saleNumber);
      console.log('Status:', sale.status);
      console.log('Subtotal:', sale.subtotal);
      console.log('Total:', sale.total);
      console.log('Items:', sale.items?.length || 0);
      if (sale.items?.length > 0) {
        for (const item of sale.items) {
          console.log('  - Product:', item.product?.name, 'Qty:', item.qtyUnits, 'Total:', item.total);
        }
      }
      console.log('Payments:', sale.payments?.length || 0);
    }
  } catch (error: any) {
    console.error('Erro:', error.message);
  }
}
checkSales();
