import sqlite3
import json

db_path = r'C:\Users\HP\AppData\Roaming\@barmanager\desktop\barmanager.db'
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
cur = conn.cursor()

print("=== ESTOQUE LOCAL (Electron SQLite) ===\n")

cur.execute('''
    SELECT 
        i.id,
        i.product_id,
        p.name as product_name,
        i.qty_units,
        i.closed_boxes,
        i.open_box_units,
        p.units_per_box,
        i.synced
    FROM inventory_items i
    LEFT JOIN products p ON i.product_id = p.id
    ORDER BY p.name
''')

rows = cur.fetchall()
for row in rows:
    r = dict(row)
    units_per_box = r['units_per_box'] or 24
    boxes = r['qty_units'] // units_per_box if units_per_box else 0
    loose = r['qty_units'] % units_per_box if units_per_box else 0
    print(f"📦 {r['product_name'] or 'Unknown'}")
    print(f"   Unidades: {r['qty_units']} | Caixas: {r['closed_boxes']} | Abertas: {r['open_box_units']}")
    print(f"   Calculado: {boxes} caixas + {loose} unidades soltas")
    print(f"   Synced: {'✅' if r['synced'] else '❌'}")
    print()

# Verificar fila de sync para inventory
print("\n=== FILA DE SYNC (inventory) ===\n")
cur.execute('''
    SELECT * FROM sync_queue 
    WHERE entity_type IN ('inventory', 'inventory_item')
    ORDER BY created_at DESC
    LIMIT 10
''')

sync_items = cur.fetchall()
if sync_items:
    for item in sync_items:
        i = dict(item)
        print(f"ID: {i['id'][:8]}... | Op: {i['operation']} | Entity: {i['entity_type']}")
        print(f"   Status: {i['status']} | Attempts: {i['attempts']}")
        data = json.loads(i['data']) if i['data'] else {}
        print(f"   Data: {json.dumps(data, indent=6)}")
        print()
else:
    print("Nenhum item de inventário na fila de sync.")

conn.close()
