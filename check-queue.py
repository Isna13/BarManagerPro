import sqlite3
import json

DB_PATH = r'C:\Users\HP\AppData\Roaming\@barmanager\desktop\barmanager.db'
conn = sqlite3.connect(DB_PATH)
conn.row_factory = sqlite3.Row
cur = conn.cursor()

# Verificar sync_queue para inventory
print("=== SYNC QUEUE (últimos 15) ===")
cur.execute('SELECT * FROM sync_queue ORDER BY created_at DESC LIMIT 15')
rows = cur.fetchall()
for r in rows:
    rd = dict(r)
    print(f"\n{rd['id'][:8]}... | {rd['operation']} | {rd['entity']} | status: {rd['status']}")
    if rd['data']:
        try:
            data = json.loads(rd['data'])
            print(f"   Data: {data}")
        except:
            print(f"   Data: {rd['data']}")

# Verificar estoque atual
print("\n\n=== ESTOQUE ELECTRON ===")
cur.execute('''
    SELECT p.name, i.qty_units, i.closed_boxes, i.open_box_units, p.units_per_box
    FROM inventory_items i 
    JOIN products p ON i.product_id = p.id
    ORDER BY p.name
''')
for r in cur.fetchall():
    print(f"{r[0]}: {r[1]} unidades ({r[2]} caixas fechadas + {r[3]} soltas)")

conn.close()
