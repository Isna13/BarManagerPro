"""
Script para sincronizar manualmente o estoque do Electron para o Railway.
Este script:
1. Lê todos os itens de inventory_items do banco local
2. Envia para o endpoint /inventory/adjust-by-product no Railway
"""
import sqlite3
import requests
import json

# Configurações
DB_PATH = r'C:\Users\HP\AppData\Roaming\@barmanager\desktop\barmanager.db'
BASE_URL = 'https://barmanagerbackend-production.up.railway.app/api/v1'

# Primeiro, fazer login para obter token
print("🔐 Fazendo login...")
login_response = requests.post(f'{BASE_URL}/auth/login', json={
    'email': 'isnatchuda1@gmail.com',
    'password': 'isna123'
})

if login_response.status_code != 200 and login_response.status_code != 201:
    print(f"❌ Erro no login: {login_response.status_code} - {login_response.text}")
    exit(1)

token = login_response.json().get('accessToken') or login_response.json().get('access_token')
if not token:
    print(f"❌ Token não encontrado na resposta: {login_response.json()}")
    exit(1)

print(f"✅ Login OK - Token: {token[:30]}...")

headers = {'Authorization': f'Bearer {token}'}

# Conectar ao banco local
conn = sqlite3.connect(DB_PATH)
conn.row_factory = sqlite3.Row
cur = conn.cursor()

# Buscar todos os itens de inventory
print("\n📦 Buscando itens de estoque local...")
cur.execute('''
    SELECT 
        i.id,
        i.product_id,
        i.branch_id,
        i.qty_units,
        i.closed_boxes,
        i.open_box_units,
        p.name as product_name,
        p.units_per_box
    FROM inventory_items i
    LEFT JOIN products p ON i.product_id = p.id
''')

items = cur.fetchall()
print(f"   Encontrados {len(items)} itens de estoque")

# Buscar estoque atual no Railway para comparar
print("\n🌐 Buscando estoque atual no Railway...")
railway_response = requests.get(f'{BASE_URL}/inventory', headers=headers)
if railway_response.status_code == 200:
    railway_inventory = railway_response.json()
    print(f"   Encontrados {len(railway_inventory)} itens no Railway")
    
    # Criar mapa de estoque Railway por productId
    railway_stock = {}
    for item in railway_inventory:
        product_id = item.get('productId')
        if product_id:
            railway_stock[product_id] = item.get('qtyUnits', 0)
else:
    print(f"   ⚠️ Não foi possível buscar estoque do Railway: {railway_response.status_code}")
    railway_stock = {}

# Sincronizar cada item
print("\n🔄 Sincronizando estoque...")
success_count = 0
error_count = 0

for item in items:
    item_dict = dict(item)
    product_id = item_dict['product_id']
    product_name = item_dict['product_name'] or 'Unknown'
    local_qty = item_dict['qty_units']
    railway_qty = railway_stock.get(product_id, 0)
    
    # Calcular diferença
    diff = local_qty - railway_qty
    
    print(f"\n📦 {product_name}")
    print(f"   Local: {local_qty} unidades | Railway: {railway_qty} unidades | Diff: {diff:+d}")
    
    if diff == 0:
        print("   ✅ Já sincronizado!")
        success_count += 1
        continue
    
    # Enviar ajuste para o Railway
    try:
        # Usar o branch_id do Railway (precisa mapear)
        # O branch_id local é 'main-branch', precisamos usar o ID real do Railway
        
        # Buscar branch do Railway
        branch_response = requests.get(f'{BASE_URL}/branches', headers=headers)
        if branch_response.status_code == 200:
            branches = branch_response.json()
            if branches:
                railway_branch_id = branches[0]['id']
            else:
                railway_branch_id = item_dict['branch_id']
        else:
            railway_branch_id = item_dict['branch_id']
        
        adjust_response = requests.put(
            f'{BASE_URL}/inventory/adjust-by-product',
            headers=headers,
            json={
                'productId': product_id,
                'branchId': railway_branch_id,
                'adjustment': diff,
                'reason': f'Sincronização manual do Electron - Estoque atual: {local_qty}'
            }
        )
        
        if adjust_response.status_code in [200, 201]:
            print(f"   ✅ Sincronizado! Ajuste de {diff:+d} aplicado")
            success_count += 1
            
            # Marcar como sincronizado no banco local
            cur.execute('UPDATE inventory_items SET synced = 1 WHERE id = ?', (item_dict['id'],))
            conn.commit()
        else:
            print(f"   ❌ Erro: {adjust_response.status_code} - {adjust_response.text}")
            error_count += 1
            
    except Exception as e:
        print(f"   ❌ Exceção: {e}")
        error_count += 1

conn.close()

print(f"\n{'='*50}")
print(f"✅ Sucesso: {success_count} | ❌ Erros: {error_count}")
print(f"{'='*50}")
