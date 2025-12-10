import requests
import json

# Login
r = requests.post('https://barmanagerbackend-production.up.railway.app/api/v1/auth/login', 
                  json={'email': 'isnatchuda1@gmail.com', 'password': 'isna123'})
token = r.json().get('accessToken')
headers = {'Authorization': f'Bearer {token}'}

# Get all inventory items
inv = requests.get('https://barmanagerbackend-production.up.railway.app/api/v1/inventory', headers=headers)
data = inv.json()

print('=== TODOS OS ITENS DE INVENTÁRIO NO RAILWAY ===\n')
for item in data:
    print(f"ID: {item['id']}")
    print(f"   Produto: {item['product']['name']}")
    print(f"   ProductId: {item['productId']}")
    print(f"   Qty: {item['qtyUnits']} unidades")
    print(f"   ClosedBoxes: {item.get('closedBoxes', 0)} | OpenBoxUnits: {item.get('openBoxUnits', 0)}")
    print()
