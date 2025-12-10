import requests

# Login
r = requests.post('https://barmanagerbackend-production.up.railway.app/api/v1/auth/login', 
                  json={'email': 'isnatchuda1@gmail.com', 'password': 'isna123'})
token = r.json().get('accessToken')
headers = {'Authorization': f'Bearer {token}'}

# IDs para deletar (duplicados/inválidos)
ids_to_delete = [
    'adjust-by-product',  # ID inválido para XL
    '99aae75c-6c5c-4a30-9801-9ee05a3b524c',  # Duplicado de Pé Tinto (manter eb1dd3b9)
]

print('=== DELETANDO REGISTROS DUPLICADOS ===\n')

for item_id in ids_to_delete:
    print(f"Deletando {item_id}...")
    response = requests.delete(
        f'https://barmanagerbackend-production.up.railway.app/api/v1/inventory/{item_id}',
        headers=headers
    )
    if response.status_code in [200, 204]:
        print(f"   ✅ Deletado com sucesso!")
    else:
        print(f"   ❌ Erro: {response.status_code} - {response.text}")

print('\n=== VERIFICANDO RESULTADO ===\n')

# Get all inventory items
inv = requests.get('https://barmanagerbackend-production.up.railway.app/api/v1/inventory', headers=headers)
data = inv.json()

seen = set()
for item in data:
    name = item['product']['name']
    if name not in seen:
        print(f"{name}: {item['qtyUnits']} unidades")
        seen.add(name)
