import requests

# Login
r = requests.post('https://barmanagerbackend-production.up.railway.app/api/v1/auth/login', 
                  json={'email': 'isnatchuda1@gmail.com', 'password': 'isna123'})
token = r.json().get('accessToken')
headers = {'Authorization': f'Bearer {token}'}

# Get inventory
inv = requests.get('https://barmanagerbackend-production.up.railway.app/api/v1/inventory', headers=headers)
data = inv.json()

print('=== ESTOQUE RAILWAY (após sync) ===')
seen = set()
for item in data:
    name = item['product']['name']
    if name not in seen:
        print(f"{name}: {item['qtyUnits']} unidades")
        seen.add(name)
