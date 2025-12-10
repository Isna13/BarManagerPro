import requests
import json

BASE_URL = 'https://barmanagerbackend-production.up.railway.app/api/v1'

# Obter novo token
login_data = {"email": "isnagomes@gmail.com", "password": "Inacia18!"}
r = requests.post(f'{BASE_URL}/auth/login', json=login_data)
print(f"Login response: {r.status_code} - {r.text}")
token = r.json().get('access_token')
if not token:
    print("Erro ao obter token!")
    exit(1)
print(f"Token: {token[:50]}...")

headers = {'Authorization': f'Bearer {token}'}

# Buscar compras
r = requests.get(f'{BASE_URL}/sync/pull', 
                 headers=headers, 
                 params={'lastSync': '2024-01-01T00:00:00.000Z'})

data = r.json()
print(f"\nStatus: {r.status_code}")
print(f"Keys: {data.keys() if isinstance(data, dict) else 'Not a dict'}")

if isinstance(data, dict):
    if 'purchases' in data:
        print(f"\n=== Purchases ({len(data['purchases'])}) ===")
        for p in data['purchases'][-3:]:
            print(f"\nPurchase: {p.get('purchaseNumber', 'N/A')}")
            print(f"  total: {p.get('total', 'N/A')}")
            print(f"  totalCost: {p.get('totalCost', 'N/A')}")
            print(f"  subtotal: {p.get('subtotal', 'N/A')}")
            
            if 'items' in p:
                print(f"  Items: {len(p['items'])}")
                for item in p['items']:
                    print(f"    - {item.get('product', {}).get('name', 'N/A')}")
                    print(f"      quantity: {item.get('quantity', 'N/A')}")
                    print(f"      unitsPerBox: {item.get('unitsPerBox', 'N/A')}")
                    print(f"      unitCost: {item.get('unitCost', 'N/A')}")
                    print(f"      totalCost: {item.get('totalCost', 'N/A')}")
                    print(f"      total: {item.get('total', 'N/A')}")
