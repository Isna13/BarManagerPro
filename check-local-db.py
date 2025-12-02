import sqlite3

conn = sqlite3.connect('C:/Users/HP/AppData/Roaming/@barmanager/desktop/barmanager.db')
c = conn.cursor()

print('=== VENDAS RECENTES ===')
c.execute('''
    SELECT s.id, s.customer_id, s.total, s.status, s.synced, s.created_at, c.full_name
    FROM sales s
    LEFT JOIN customers c ON s.customer_id = c.id
    ORDER BY s.created_at DESC LIMIT 10
''')
for row in c.fetchall():
    cliente = row[6] if row[6] else 'Sem cliente'
    print(f'ID: {str(row[0])[:20]}... | Total: {row[2]} | Status: {row[3]} | Synced: {row[4]} | Cliente: {cliente}')

print()
print('=== ITENS DE VENDA (sale_items) ===')
c.execute('''
    SELECT si.sale_id, p.name, si.qty_units, si.unit_price, si.total, si.synced
    FROM sale_items si 
    LEFT JOIN products p ON si.product_id = p.id 
    ORDER BY si.id DESC LIMIT 15
''')
for row in c.fetchall():
    prod = row[1][:20] if row[1] else 'None'
    print(f'Venda: {str(row[0])[:20]}... | Prod: {prod} | Qtd: {row[2]} | Preco: {row[3]} | Total: {row[4]} | Synced: {row[5]}')

print()
print('=== PAYMENTS ===')
c.execute('SELECT sale_id, method, amount, status, synced FROM payments ORDER BY created_at DESC LIMIT 10')
for row in c.fetchall():
    print(f'Venda: {str(row[0])[:20]}... | Metodo: {row[1]} | Valor: {row[2]} | Status: {row[3]} | Synced: {row[4]}')

print()
print('=== SYNC QUEUE (pendentes) ===')
c.execute("SELECT entity, operation, status, data FROM sync_queue WHERE status != 'completed' ORDER BY created_at DESC LIMIT 10")
for row in c.fetchall():
    data_preview = row[3][:60] if row[3] else 'None'
    print(f'{row[0]} | {row[1]} | {row[2]} | {data_preview}...')

print()
print('=== CLIENTES ===')
c.execute('SELECT id, code, full_name, synced FROM customers ORDER BY created_at DESC LIMIT 10')
for row in c.fetchall():
    print(f'{row[1]} | {row[2]} | Synced: {row[3]}')

conn.close()
