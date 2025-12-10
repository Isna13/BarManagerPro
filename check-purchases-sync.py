import sqlite3
import json
import os

db_path = os.path.join(os.environ['APPDATA'], '@barmanager', 'desktop', 'barmanager.db')
print(f'Database path: {db_path}')

conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
c = conn.cursor()

print('\n=== ÚLTIMAS COMPRAS NO BANCO LOCAL ===')
c.execute('SELECT * FROM purchases ORDER BY created_at DESC LIMIT 5')
purchases = c.fetchall()
for p in purchases:
    print({
        'id': p['id'],
        'number': p['purchase_number'],
        'status': p['status'],
        'total': p['total'],
        'supplierId': p['supplier_id'],
        'created': p['created_at']
    })

print('\n=== ITENS DE COMPRAS NO BANCO LOCAL ===')
c.execute('''
    SELECT pi.*, p.purchase_number 
    FROM purchase_items pi 
    JOIN purchases p ON pi.purchase_id = p.id 
    ORDER BY pi.created_at DESC 
    LIMIT 15
''')
items = c.fetchall()
for i in items:
    print({
        'id': i['id'],
        'purchaseId': i['purchase_id'],
        'purchaseNumber': i['purchase_number'],
        'productId': i['product_id'],
        'qtyUnits': i['qty_units'],
        'unitCost': i['unit_cost'],
        'total': i['total']
    })

print('\n=== SYNC_QUEUE PARA PURCHASE E PURCHASE_ITEM ===')
c.execute('''
    SELECT id, entity, entity_id, operation, status, data, last_error, retry_count, created_at
    FROM sync_queue 
    WHERE entity IN ('purchase', 'purchase_item') 
    ORDER BY created_at DESC 
    LIMIT 20
''')
sync_queue = c.fetchall()

if len(sync_queue) == 0:
    print('Nenhum item de purchase/purchase_item na sync_queue')
else:
    for s in sync_queue:
        data = json.loads(s['data'] or '{}')
        print({
            'entity': s['entity'],
            'entityId': s['entity_id'],
            'operation': s['operation'],
            'status': s['status'],
            'retryCount': s['retry_count'],
            'lastError': (s['last_error'] or '')[:100],
            'created': s['created_at'],
            'data': data
        })

print('\n=== VERIFICANDO COMPRA MAIS RECENTE EM DETALHES ===')
if len(purchases) > 0:
    last_purchase = purchases[0]
    print('Compra mais recente:')
    print(dict(last_purchase))
    
    c.execute('SELECT * FROM purchase_items WHERE purchase_id = ?', (last_purchase['id'],))
    last_items = c.fetchall()
    print(f'\nItens desta compra no local: {len(last_items)}')
    for item in last_items:
        print({
            'id': item['id'],
            'productId': item['product_id'],
            'qtyUnits': item['qty_units'],
            'unitCost': item['unit_cost'],
            'total': item['total']
        })
    
    # Verificar sync_queue para esta compra
    print('\nSync queue para esta compra:')
    c.execute('''
        SELECT * FROM sync_queue 
        WHERE entity = 'purchase' AND entity_id = ?
        ORDER BY created_at
    ''', (last_purchase['id'],))
    sync_for_purchase = c.fetchall()
    
    if len(sync_for_purchase) == 0:
        print('PROBLEMA: Nenhum registro na sync_queue para esta compra!')
    else:
        for s in sync_for_purchase:
            print({
                'entity': s['entity'],
                'operation': s['operation'],
                'status': s['status'],
                'data': json.loads(s['data'] or '{}')
            })
    
    # Verificar sync_queue para itens desta compra
    print('\nSync queue para itens desta compra:')
    c.execute('''
        SELECT * FROM sync_queue 
        WHERE entity = 'purchase_item'
        ORDER BY created_at DESC
        LIMIT 10
    ''')
    item_syncs = c.fetchall()
    
    for s in item_syncs:
        data = json.loads(s['data'] or '{}')
        if data.get('purchaseId') == last_purchase['id'] or s['entity_id'] in [i['id'] for i in last_items]:
            print({
                'entity': s['entity'],
                'entityId': s['entity_id'],
                'operation': s['operation'],
                'status': s['status'],
                'data': data
            })

conn.close()
