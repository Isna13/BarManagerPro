import sqlite3
import os
import json
import requests

RAILWAY_URL = "https://barmanagerbackend-production.up.railway.app/api/v1"
db_path = os.path.join(os.environ['APPDATA'], '@barmanager', 'desktop', 'barmanager.db')

def login():
    response = requests.post(f"{RAILWAY_URL}/auth/login", json={
        "email": "isnatchuda1@gmail.com",
        "password": "isna123"
    })
    return response.json().get('accessToken')

conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
c = conn.cursor()

# Compras que estão com 0 itens no Railway
problem_purchases = ['fc76e588-7e24-4585-b656-d9c1e6c6f38d', 'bb520427-e946-40dd-9400-e4b65b63cdaf']

print('=== ITENS LOCAIS DAS COMPRAS COM PROBLEMA ===')
for pid in problem_purchases:
    c.execute('SELECT p.purchase_number, pi.* FROM purchase_items pi JOIN purchases p ON p.id = pi.purchase_id WHERE pi.purchase_id = ?', (pid,))
    items = c.fetchall()
    print(f"\nCompra {pid[:8]}: {len(items)} itens")
    for item in items:
        print(f"  - ID: {item['id'][:8]} | Produto: {item['product_id'][:8]} | Qtd: {item['qty_units']} | Custo: {item['unit_cost']}")

# Sincronizar itens faltantes
print('\n=== SINCRONIZANDO ITENS FALTANTES ===')
token = login()
headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

for pid in problem_purchases:
    print(f"\nProcessando compra {pid[:8]}...")
    
    # Reabrir a compra (está completed)
    requests.put(f"{RAILWAY_URL}/purchases/{pid}", headers=headers, json={"status": "pending"})
    print(f"  Compra reaberta para pending")
    
    # Buscar itens locais
    c.execute('SELECT * FROM purchase_items WHERE purchase_id = ?', (pid,))
    items = c.fetchall()
    
    for item in items:
        payload = {
            "productId": item['product_id'],
            "qtyUnits": item['qty_units'],
            "qtyBoxes": 0,
            "unitCost": item['unit_cost']
        }
        
        response = requests.post(f"{RAILWAY_URL}/purchases/{pid}/items", headers=headers, json=payload)
        if response.status_code in [200, 201]:
            print(f"  ✅ Item adicionado: {item['product_id'][:8]}")
        else:
            print(f"  ❌ Erro: {response.text}")
    
    # Atualizar total e fechar a compra
    c.execute('SELECT total FROM purchases WHERE id = ?', (pid,))
    purchase = c.fetchone()
    requests.put(f"{RAILWAY_URL}/purchases/{pid}", headers=headers, 
                json={"status": "completed", "total": purchase['total']})
    print(f"  Compra marcada como completed com total {purchase['total']}")

conn.close()
print('\n=== CONCLUÍDO ===')
