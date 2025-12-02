import sqlite3
import json
import uuid
from datetime import datetime

db_path = r'C:\Users\HP\AppData\Roaming\@barmanager\desktop\barmanager.db'
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row

print('=== CORREÇÃO DE SINCRONIZAÇÃO ===\n')

# 1. Encontrar clientes que precisam ser ressincronizados
print('1. Identificando clientes que precisam ser ressincronizados...')
cursor = conn.execute('''
    SELECT sq.entity_id, sq.data 
    FROM sync_queue sq
    WHERE sq.entity = 'customer' 
    AND sq.operation = 'create'
    AND sq.status = 'completed'
''')

customers_to_resync = []
for row in cursor:
    data = json.loads(row['data']) if row['data'] else {}
    if 'id' not in data:
        customers_to_resync.append({
            'entity_id': row['entity_id'],
            'data': data
        })

print(f'   Encontrados {len(customers_to_resync)} clientes para ressincronizar\n')

# 2. Criar novos registros de sync para esses clientes COM o ID
print('2. Criando novos registros de sync com ID correto...')
for cust in customers_to_resync:
    # Buscar dados completos do cliente
    c = conn.execute('SELECT * FROM customers WHERE id = ?', (cust['entity_id'],)).fetchone()
    if c:
        new_data = {
            'id': cust['entity_id'],  # IMPORTANTE: Incluir o ID!
            'name': c['full_name'],
            'phone': c['phone'],
            'email': c['email'],
            'creditLimit': c['credit_limit'] or 0,
            'code': c['code']
        }
        
        # Criar novo registro de sync
        new_id = str(uuid.uuid4())
        conn.execute('''
            INSERT INTO sync_queue (id, operation, entity, entity_id, data, priority, status, retry_count, created_at)
            VALUES (?, 'create', 'customer', ?, ?, 0, 'pending', 0, ?)
        ''', (new_id, cust['entity_id'], json.dumps(new_data), datetime.now().isoformat()))
        
        print(f'   ✅ Cliente {c["full_name"]} ({cust["entity_id"]}) adicionado para ressync')

conn.commit()

# 3. Resetar vendas falhadas
print('\n3. Resetando vendas falhadas para pending...')
cursor = conn.execute('''
    UPDATE sync_queue 
    SET status = 'pending', retry_count = 0, last_error = NULL
    WHERE status = 'failed' AND entity IN ('sale', 'sale_item', 'payment')
''')
conn.commit()
print(f'   ✅ {cursor.rowcount} itens resetados')

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
print('\n5. Itens pendentes por entidade:')
cursor = conn.execute('''
    SELECT entity, operation, COUNT(*) as count 
    FROM sync_queue 
    WHERE status = 'pending'
    GROUP BY entity, operation
    ORDER BY count DESC
''')
for row in cursor:
    print(f'   {row["entity"]} ({row["operation"]}): {row["count"]}')

conn.close()

print('\n=== CORREÇÃO CONCLUÍDA ===')
print('Reinicie o Electron para que a sincronização processe os itens corrigidos.')
