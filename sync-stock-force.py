"""
Script para sincronizar forçadamente o estoque do Electron para o Railway.
Este script:
1. Lê todos os itens de inventory_items do banco local
2. Define diretamente o valor absoluto no Railway usando POST /inventory (upsert)
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

if login_response.status_code not in [200, 201]:
    print(f"❌ Erro no login: {login_response.status_code} - {login_response.text}")
    exit(1)

token = login_response.json().get('accessToken') or login_response.json().get('access_token')
if not token:
    print(f"❌ Token não encontrado na resposta: {login_response.json()}")
    exit(1)

print(f"✅ Login OK - Token: {token[:30]}...")

headers = {'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'}

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

local_items = cur.fetchall()
print(f"   Encontrados {len(local_items)} itens de estoque")

# Buscar inventário atual do Railway para obter os IDs corretos
print("\n🌐 Buscando inventário atual do Railway...")
railway_response = requests.get(f'{BASE_URL}/inventory', headers=headers)
railway_items = railway_response.json()
print(f"   Encontrados {len(railway_items)} itens no Railway")

# Criar mapa por productId -> item com maior qtyUnits (ignora duplicatas)
railway_map = {}
for item in railway_items:
    pid = item['productId']
    if pid not in railway_map or item['qtyUnits'] > railway_map[pid]['qtyUnits']:
        railway_map[pid] = item

# Sincronizar cada item do Electron
print("\n🔄 Sincronizando estoque...")
success_count = 0
error_count = 0

for item in local_items:
    item_dict = dict(item)
    product_id = item_dict['product_id']
    product_name = item_dict['product_name'] or 'Unknown'
    local_qty = item_dict['qty_units']
    local_closed_boxes = item_dict['closed_boxes']
    local_open_units = item_dict['open_box_units']
    
    railway_item = railway_map.get(product_id)
    railway_qty = railway_item['qtyUnits'] if railway_item else 0
    
    print(f"\n📦 {product_name}")
    print(f"   Local: {local_qty} unidades ({local_closed_boxes} caixas + {local_open_units} soltas)")
    print(f"   Railway: {railway_qty} unidades")
    
    if local_qty == railway_qty:
        print("   ✅ Já sincronizado!")
        success_count += 1
        continue
    
    try:
        if railway_item:
            # Atualizar usando PUT com ID existente
            railway_id = railway_item['id']
            print(f"   🔄 Atualizando item {railway_id}...")
            
            update_response = requests.put(
                f'{BASE_URL}/inventory/{railway_id}',
                headers=headers,
                json={
                    'productId': product_id,
                    'branchId': 'main-branch',
                    'qtyUnits': local_qty,
                    'closedBoxes': local_closed_boxes,
                    'openBoxUnits': local_open_units,
                    'synced': True,
                }
            )
            
            if update_response.status_code in [200, 201]:
                result = update_response.json()
                print(f"   ✅ Atualizado! Railway agora: {result.get('qtyUnits', 'N/A')} unidades")
                success_count += 1
            else:
                print(f"   ❌ Erro PUT: {update_response.status_code} - {update_response.text}")
                error_count += 1
        else:
            # Criar novo item usando POST
            print(f"   🆕 Criando novo item...")
            
            create_response = requests.post(
                f'{BASE_URL}/inventory',
                headers=headers,
                json={
                    'productId': product_id,
                    'branchId': 'main-branch',
                    'qtyUnits': local_qty,
                    'closedBoxes': local_closed_boxes,
                    'openBoxUnits': local_open_units,
                    'minStock': 10,
                    'synced': True,
                }
            )
            
            if create_response.status_code in [200, 201]:
                print(f"   ✅ Criado com sucesso!")
                success_count += 1
            else:
                print(f"   ❌ Erro POST: {create_response.status_code} - {create_response.text}")
                error_count += 1
            
    except Exception as e:
        print(f"   ❌ Exceção: {e}")
        error_count += 1

conn.close()

# Verificar resultado final
print("\n" + "="*50)
print("🔍 Verificando resultado final...")
print("="*50)

railway_response = requests.get(f'{BASE_URL}/inventory', headers=headers)
railway_items = railway_response.json()

seen = set()
for item in railway_items:
    name = item['product']['name']
    if name not in seen:
        print(f"   {name}: {item['qtyUnits']} unidades")
        seen.add(name)

print(f"\n{'='*50}")
print(f"✅ Sucesso: {success_count} | ❌ Erros: {error_count}")
print(f"{'='*50}")
