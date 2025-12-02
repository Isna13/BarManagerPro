import sqlite3
import json
import uuid
from datetime import datetime

db_path = r'C:\Users\HP\AppData\Roaming\@barmanager\desktop\barmanager.db'
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row

print('=== CORREÇÃO DE VENDAS SEM ID ===\n')

# 1. Encontrar vendas que foram sincronizadas sem ID
print('1. Identificando vendas sincronizadas sem ID...')
cursor = conn.execute('''
    SELECT entity_id, data 
    FROM sync_queue
    WHERE entity = 'sale' 
    AND operation = 'create'
    AND status = 'completed'
''')

sales_without_id = []
for row in cursor:
    data = json.loads(row['data']) if row['data'] else {}
    if 'id' not in data:
        sales_without_id.append({
            'entity_id': row['entity_id'],
            'data': data
        })

print(f'   Encontradas {len(sales_without_id)} vendas sem ID nos dados\n')

# 2. Para cada venda sem ID, criar novo registro de sync com ID
print('2. Criando novos registros de sync com ID correto...')
for sale in sales_without_id:
    # Buscar dados completos da venda local
    s = conn.execute('''
        SELECT * FROM sales WHERE id = ?
    ''', (sale['entity_id'],)).fetchone()
    
    if s:
        new_data = {
            'id': sale['entity_id'],  # IMPORTANTE: Incluir o ID!
            'saleNumber': s['sale_number'],
            'branchId': s['branch_id'] or 'main-branch',
            'cashierId': s['cashier_id'] or 'offline-admin',
            'customerId': s['customer_id'],
            'type': s['type'] or 'counter',
        }
        
        # Criar novo registro de sync
        new_id = str(uuid.uuid4())
        conn.execute('''
            INSERT INTO sync_queue (id, operation, entity, entity_id, data, priority, status, retry_count, created_at)
            VALUES (?, 'create', 'sale', ?, ?, 1, 'pending', 0, ?)
        ''', (new_id, sale['entity_id'], json.dumps(new_data), datetime.now().isoformat()))
        
        print(f'   ✅ Venda {s["sale_number"]} ({sale["entity_id"][:20]}...) adicionada para ressync')

conn.commit()

# 3. Resetar sale_items e payments falhados
print('\n3. Resetando sale_items e payments pendentes...')
cursor = conn.execute('''
    UPDATE sync_queue 
    SET status = 'pending', retry_count = 0, last_error = NULL
    WHERE status = 'pending' AND entity IN ('sale_item', 'payment')
''')
conn.commit()
# Não muda nada porque já estão pending

# 4. Verificar status final
print('\n4. Status final da sync queue:')
cursor = conn.execute('''
    SELECT status, COUNT(*) as count 
    FROM sync_queue 
    GROUP BY status
''')
for row in cursor:
    print(f'   {row["status"]}: {row["count"]}')

# 5. Mostrar itens pendentes por entidade
print('\n5. Itens pendentes por entidade (em ordem de prioridade):')
cursor = conn.execute('''
    SELECT entity, operation, priority, COUNT(*) as count 
    FROM sync_queue 
    WHERE status = 'pending'
    GROUP BY entity, operation, priority
    ORDER BY priority ASC, entity
''')
for row in cursor:
    print(f'   Priority {row["priority"]}: {row["entity"]} ({row["operation"]}): {row["count"]}')

conn.close()

print('\n=== CORREÇÃO CONCLUÍDA ===')
print('Aguarde o deploy do Railway terminar e reinicie o Electron.')
print('As vendas serão re-criadas com IDs corretos no Railway.')
