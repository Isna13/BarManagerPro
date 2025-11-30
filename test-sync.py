# -*- coding: utf-8 -*-
import sqlite3
import requests
import json

# Configuracao
SQLITE_PATH = r"C:\Users\HP\AppData\Roaming\@barmanager\desktop\barmanager.db"
API_URL = "https://barmanagerbackend-production.up.railway.app/api/v1"

def login():
    response = requests.post(f"{API_URL}/auth/login", json={
        "email": "admin@barmanager.com",
        "password": "Admin@123456"
    })
    print(f"Login status: {response.status_code}")
    print(f"Login response: {response.text}")
    data = response.json()
    if "accessToken" in data:
        return data["accessToken"]
    elif "access_token" in data:
        return data["access_token"]
    else:
        print(f"Erro login: sem token na resposta")
        return None

def get_local_sales():
    conn = sqlite3.connect(SQLITE_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    cursor.execute("SELECT * FROM sales ORDER BY created_at LIMIT 3")
    sales = [dict(row) for row in cursor.fetchall()]
    
    conn.close()
    return sales

def sync_sale(token, sale):
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    payload = {
        "branchId": sale.get("branch_id", "main-branch"),
        "type": sale.get("type", "counter"),
        "status": sale.get("status", "completed"),
        "subtotal": float(sale.get("subtotal", 0)),
        "discount": float(sale.get("discount", 0)),
        "tax": float(sale.get("tax", 0)),
        "total": float(sale.get("total", 0)),
        "paymentMethod": sale.get("payment_method", "cash"),
        "paymentStatus": sale.get("payment_status", "paid"),
        "notes": sale.get("notes", "")
    }
    
    if sale.get("customer_id"):
        payload["customerId"] = sale["customer_id"]
    
    print(f"\n[ENVIANDO] Venda: {sale.get('sale_number', 'N/A')}")
    print(f"  Payload: {json.dumps(payload, indent=2)}")
    
    response = requests.post(f"{API_URL}/sales", headers=headers, json=payload)
    
    print(f"  Status: {response.status_code}")
    print(f"  Resposta: {response.text[:500]}")
    
    return response.status_code == 201

def get_branches(token):
    headers = {"Authorization": f"Bearer {token}"}
    response = requests.get(f"{API_URL}/branches", headers=headers)
    print(f"\n[BRANCHES] Status: {response.status_code}")
    print(f"  Resposta: {response.text[:1000]}")
    return response.json() if response.status_code == 200 else []

def main():
    print("=== TESTE DE SINCRONIZACAO ===\n")
    
    token = login()
    if not token:
        return
    
    print(f"Token obtido: {token[:50]}...")
    
    # Primeiro verificar branches
    branches = get_branches(token)
    
    sales = get_local_sales()
    print(f"\nVendas locais encontradas: {len(sales)}")
    
    for sale in sales[:1]:  # Testar apenas 1 venda
        sync_sale(token, sale)

if __name__ == "__main__":
    main()
