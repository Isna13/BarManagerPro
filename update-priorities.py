import sqlite3
db_path = r'C:\Users\HP\AppData\Roaming\@barmanager\desktop\barmanager.db'
conn = sqlite3.connect(db_path)

# Sale_items e payments devem ter prioridade MAIOR que sales (numero maior = processa depois)
# Customers = 0, Sales = 1, Sale_items = 2, Payments = 3
print('Atualizando prioridades...')

conn.execute("UPDATE sync_queue SET priority = 2 WHERE entity = 'sale_item' AND status = 'pending'")
conn.execute("UPDATE sync_queue SET priority = 3 WHERE entity = 'payment' AND status = 'pending'")
conn.commit()

# Verificar
cursor = conn.execute("SELECT entity, priority, COUNT(*) FROM sync_queue WHERE status = 'pending' GROUP BY entity, priority ORDER BY priority")
print('\nOrdem de sincronização:')
for row in cursor:
    print(f'  Priority {row[1]}: {row[0]} ({row[2]} itens)')

conn.close()
print('\nPrioridades atualizadas!')
