import sqlite3
import os
import json
import requests
from datetime import datetime

# Configurações
RAILWAY_URL = "https://barmanagerbackend-production.up.railway.app/api/v1"
db_path = os.path.join(os.environ['APPDATA'], '@barmanager', 'desktop', 'barmanager.db')

def login():
    """Login e retorna o token"""
    email = input("Email: ").strip() or "isnatchuda1@gmail.com"
    password = input("Password: ").strip() or "isna123"
    
    response = requests.post(f"{RAILWAY_URL}/auth/login", json={
        "email": email,
        "password": password
    })
    
    if response.status_code != 200 and response.status_code != 201:
        print(f"Erro no login: {response.text}")
        return None
    
    data = response.json()
    return data.get('accessToken') or data.get('token')

def sync_purchase(token, entity_id, data, operation):
    """Sincroniza uma compra"""
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    
    if operation == 'create':
        # Verificar se já existe
        check = requests.get(f"{RAILWAY_URL}/purchases/{entity_id}", headers=headers)
        if check.status_code == 200:
            print(f"  ⚠️ Compra {entity_id} já existe")
            return True
        
        # Criar compra
        payload = {
            "id": entity_id,
            "purchaseNumber": data.get('purchaseNumber', f"PUR-{datetime.now().timestamp()}"),
            "branchId": data.get('branchId', 'main-branch'),
            "supplierId": data.get('supplierId'),
            "status": "pending",
            "total": data.get('total', 0),
            "notes": data.get('notes', '')
        }
        
        response = requests.post(f"{RAILWAY_URL}/purchases", headers=headers, json=payload)
        if response.status_code in [200, 201]:
            print(f"  ✅ Compra criada: {entity_id}")
            return True
        else:
            print(f"  ❌ Erro ao criar compra: {response.text}")
            return False
    
    elif operation == 'update':
        payload = {}
        
        if data.get('status'):
            payload['status'] = data.get('status')
        if data.get('notes') is not None:
            payload['notes'] = data.get('notes')
        if data.get('total') is not None:
            payload['total'] = int(data.get('total'))
        
        if not payload:
            print(f"  ⚠️ Nada para atualizar")
            return True
        
        response = requests.put(f"{RAILWAY_URL}/purchases/{entity_id}", headers=headers, json=payload)
        if response.status_code == 200:
            print(f"  ✅ Compra atualizada: {entity_id} - Status: {data.get('status')}")
            return True
        else:
            print(f"  ❌ Erro ao atualizar compra ({response.status_code}): {response.text}")
            return False
    
    return False

def sync_purchase_item(token, entity_id, data, operation):
    """Sincroniza um item de compra"""
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    
    purchase_id = data.get('purchaseId')
    if not purchase_id:
        print(f"  ⚠️ Item {entity_id} sem purchaseId")
        return False
    
    if operation == 'create':
        # Verificar se a compra existe
        check = requests.get(f"{RAILWAY_URL}/purchases/{purchase_id}", headers=headers)
        if check.status_code == 404:
            print(f"  ⏳ Compra {purchase_id} não existe ainda, item pendente")
            return False
        
        # Verificar se a compra está completed - reabrir se necessário
        purchase = check.json()
        if purchase.get('status') == 'completed':
            print(f"  ⚠️ Reabrindo compra {purchase_id}...")
            requests.put(f"{RAILWAY_URL}/purchases/{purchase_id}", headers=headers, 
                        json={"status": "pending"})
        
        payload = {
            "productId": data.get('productId'),
            "qtyUnits": data.get('qtyUnits', 0),
            "qtyBoxes": data.get('qtyBoxes', 0),
            "unitCost": data.get('unitCost', 0)
        }
        
        response = requests.post(f"{RAILWAY_URL}/purchases/{purchase_id}/items", 
                                headers=headers, json=payload)
        if response.status_code in [200, 201]:
            print(f"  ✅ Item adicionado à compra {purchase_id}")
            return True
        else:
            print(f"  ❌ Erro ao adicionar item: {response.text}")
            return False
    
    return False

def mark_completed(conn, sync_id):
    """Marca item como completado na sync_queue"""
    conn.execute("UPDATE sync_queue SET status = 'completed', processed_at = datetime('now') WHERE id = ?", (sync_id,))

def mark_failed(conn, sync_id, error):
    """Marca item como falho na sync_queue"""
    conn.execute("UPDATE sync_queue SET status = 'failed', retry_count = retry_count + 1, last_error = ? WHERE id = ?", 
                (error, sync_id))

def main():
    print("=== SINCRONIZAÇÃO MANUAL DE COMPRAS ===\n")
    
    # Login
    token = login()
    if not token:
        return
    
    print(f"\n✅ Login OK\n")
    
    # Conectar ao banco
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    
    # Buscar itens pendentes - primeiro purchases (create), depois purchase_items, depois purchases (update)
    c.execute("""
        SELECT * FROM sync_queue 
        WHERE entity IN ('purchase', 'purchase_item') AND status = 'pending'
        ORDER BY 
            CASE 
                WHEN entity = 'purchase' AND operation = 'create' THEN 1
                WHEN entity = 'purchase_item' THEN 2
                WHEN entity = 'purchase' AND operation = 'update' THEN 3
                ELSE 4
            END,
            created_at
    """)
    pending = c.fetchall()
    
    print(f"Encontrados {len(pending)} itens pendentes\n")
    
    for row in pending:
        entity = row['entity']
        entity_id = row['entity_id']
        operation = row['operation']
        data = json.loads(row['data'] or '{}')
        
        print(f"Processando {entity} ({operation}): {entity_id}")
        
        try:
            if entity == 'purchase':
                success = sync_purchase(token, entity_id, data, operation)
            elif entity == 'purchase_item':
                success = sync_purchase_item(token, entity_id, data, operation)
            else:
                success = False
            
            if success:
                mark_completed(conn, row['id'])
            else:
                mark_failed(conn, row['id'], "Sync manual falhou")
        except Exception as e:
            print(f"  ❌ Erro: {e}")
            mark_failed(conn, row['id'], str(e))
    
    conn.commit()
    conn.close()
    
    print("\n=== SINCRONIZAÇÃO CONCLUÍDA ===")

if __name__ == "__main__":
    main()
