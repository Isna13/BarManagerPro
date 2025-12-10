import sqlite3
import json

db_path = r'C:\Users\HP\AppData\Roaming\@barmanager\desktop\barmanager.db'
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
cur = conn.cursor()

# Get the latest purchase
cur.execute('SELECT * FROM purchases ORDER BY created_at DESC LIMIT 3')
purchases = cur.fetchall()

for purchase in purchases:
    p = dict(purchase)
    print(f"\n=== Compra: {p['purchase_number']} ===")
    print(f"ID: {p['id']}")
    print(f"Total: {p['total']} centimes = {p['total']/100} FCFA")
    print(f"Subtotal: {p['subtotal']} centimes = {p['subtotal']/100} FCFA")
    
    # Get items for this purchase WITH product units_per_box
    cur.execute('''
        SELECT pi.*, p.name as product_name, p.units_per_box as product_units_per_box
        FROM purchase_items pi 
        LEFT JOIN products p ON pi.product_id = p.id 
        WHERE pi.purchase_id = ?
    ''', (p['id'],))
    items = cur.fetchall()
    
    print(f"\nItens ({len(items)}):")
    for item in items:
        i = dict(item)
        print(f"  - {i.get('product_name', 'N/A')}")
        units_per_box = i.get('product_units_per_box', 1) or 1
        print(f"    qty_units: {i['qty_units']}, units_per_box (from product): {units_per_box}")
        print(f"    unit_cost: {i['unit_cost']} centimes = {i['unit_cost']/100} FCFA")
        print(f"    subtotal: {i.get('subtotal', 'N/A')} centimes = {i.get('subtotal', 0)/100} FCFA")
        print(f"    total: {i.get('total', 'N/A')} centimes = {i.get('total', 0)/100} FCFA")
        
        # Calculate boxes
        boxes = i['qty_units'] / units_per_box
        print(f"    Caixas calculadas: {boxes}")
        print(f"    Valor esperado por caixa (unit_cost): {i['unit_cost']/100} FCFA")
        print(f"    Valor total esperado: {boxes} x {i['unit_cost']/100} FCFA = {boxes * i['unit_cost']/100} FCFA")

conn.close()
