/**
 * Script para verificar e sincronizar caixas específicos no Railway
 */

const API_URL = 'https://barmanagerbackend-production.up.railway.app/api/v1';

async function main() {
  console.log('🔍 Verificando e sincronizando caixas no Railway...\n');
  
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
  const access_token = loginData.accessToken || loginData.access_token || loginData.token;
  console.log('✅ Login bem-sucedido');
  console.log('Token (primeiros 50 chars):', access_token?.substring(0, 50) + '...\n');
  
  // Caixas do banco local que precisam ser verificados/sincronizados
  const localCashBoxes = [
    {
      id: 'f080458b-0111-463a-9134-2b601c2afc63',
      boxNumber: 'CX-1765126707291',
      openedAt: '2025-12-07 16:58:27',
      closedAt: '2025-12-07 17:06:46',
      openingCash: 1000000,
      closingCash: 1840000,
      status: 'closed'
    }
  ];
  
  for (const box of localCashBoxes) {
    console.log(`\n📦 Verificando caixa: ${box.id}`);
    console.log(`   Número: ${box.boxNumber}`);
    
    // Verificar se existe no Railway
    try {
      const checkResponse = await fetch(`${API_URL}/cash-box/${box.id}`, {
        headers: { 
          'Authorization': `Bearer ${access_token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (checkResponse.ok) {
        const existingBox = await checkResponse.json();
        console.log(`   ✅ Caixa existe no Railway`);
        console.log(`   Status no Railway: ${existingBox.status}`);
        console.log(`   Closing Cash: ${existingBox.closingCash}`);
        
        // Se está aberto no Railway mas fechado localmente, fechar
        if (existingBox.status === 'open' && box.status === 'closed') {
          console.log(`\n   ⚠️ Caixa aberto no Railway, mas fechado localmente!`);
          console.log(`   Fechando no Railway...`);
          
          const closeResponse = await fetch(`${API_URL}/cash-box/${box.id}/close`, {
            method: 'POST',
            headers: { 
              'Authorization': `Bearer ${access_token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              closingAmount: box.closingCash,
              notes: 'Sincronizado via script de correção'
            })
          });
          
          if (closeResponse.ok) {
            console.log(`   ✅ Caixa fechado com sucesso no Railway!`);
          } else {
            console.error(`   ❌ Erro ao fechar:`, await closeResponse.text());
          }
        }
      } else if (checkResponse.status === 404) {
        console.log(`   ⚠️ Caixa NÃO existe no Railway`);
        console.log(`   Criando e fechando no Railway...`);
        
        // Obter branchId
        const branchesResponse = await fetch(`${API_URL}/branches`, {
          headers: { 
            'Authorization': `Bearer ${access_token}`,
            'Content-Type': 'application/json'
          }
        });
        const branches = await branchesResponse.json();
        const branchId = branches[0]?.id || 'main-branch';
        
        console.log(`   BranchId: ${branchId}`);
        
        // Criar o caixa
        const createResponse = await fetch(`${API_URL}/cash-box/open`, {
          method: 'POST',
          headers: { 
            'Authorization': `Bearer ${access_token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            id: box.id,
            branchId: branchId,
            openingAmount: box.openingCash,
            boxNumber: box.boxNumber,
            notes: 'Sincronizado via script de correção'
          })
        });
        
        if (createResponse.ok) {
          console.log(`   ✅ Caixa criado no Railway`);
          
          // Se estava fechado localmente, fechar no Railway também
          if (box.status === 'closed') {
            const closeResponse = await fetch(`${API_URL}/cash-box/${box.id}/close`, {
              method: 'POST',
              headers: { 
                'Authorization': `Bearer ${access_token}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                closingAmount: box.closingCash,
                notes: 'Sincronizado via script de correção'
              })
            });
            
            if (closeResponse.ok) {
              console.log(`   ✅ Caixa fechado com sucesso!`);
            } else {
              console.error(`   ❌ Erro ao fechar:`, await closeResponse.text());
            }
          }
        } else {
          const errorText = await createResponse.text();
          console.error(`   ❌ Erro ao criar caixa:`, errorText);
          
          // Se já existe um caixa aberto, vamos verificar qual é
          if (errorText.includes('Já existe um caixa aberto')) {
            const currentResponse = await fetch(`${API_URL}/cash-box/current?branchId=${branchId}`, {
              headers: { 
                'Authorization': `Bearer ${access_token}`,
                'Content-Type': 'application/json'
              }
            });
            
            if (currentResponse.ok) {
              const currentBox = await currentResponse.json();
              console.log(`\n   📋 Caixa atualmente aberto no Railway:`);
              console.log(`      ID: ${currentBox.id}`);
              console.log(`      Número: ${currentBox.boxNumber}`);
              console.log(`      Aberto em: ${currentBox.openedAt}`);
            }
          }
        }
      } else {
        console.error(`   ❌ Erro ao verificar:`, await checkResponse.text());
      }
    } catch (error) {
      console.error(`   ❌ Erro:`, error.message);
    }
  }
  
  // Verificar histórico após sincronização
  console.log('\n\n📋 VERIFICANDO HISTÓRICO DE CAIXAS APÓS SINCRONIZAÇÃO:');
  const historyResponse = await fetch(`${API_URL}/cash-box/history/all`, {
    headers: { 
      'Authorization': `Bearer ${access_token}`,
      'Content-Type': 'application/json'
    }
  });
  
  console.log('Status response:', historyResponse.status);
  
  if (historyResponse.ok) {
    const history = await historyResponse.json();
    console.log('Resposta do history/all:', JSON.stringify(history, null, 2).substring(0, 500));
    if (!history || history.length === 0) {
      console.log('   Nenhum caixa fechado encontrado');
    } else {
      history.slice(0, 5).forEach((box, i) => {
        console.log(`\n${i+1}. ID: ${box.id}`);
        console.log(`   Número: ${box.boxNumber}`);
        console.log(`   Status: ${box.status}`);
        console.log(`   Abertura: ${box.openingCash}`);
        console.log(`   Fechamento: ${box.closingCash}`);
      });
    }
  } else {
    console.log('   Erro ao buscar histórico:', await historyResponse.text());
  }
  
  console.log('\n\n✅ Verificação concluída!');
}

main().catch(console.error);
