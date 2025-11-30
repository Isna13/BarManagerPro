import sqlite3
import os
import json
from datetime import datetime

db_path = os.path.join(os.path.expanduser('~'), 'AppData', 'Roaming', '@barmanager', 'desktop', 'barmanager.db')
output_path = os.path.join(os.path.dirname(__file__), 'sqlite-full-export.json')

print(f'📂 Lendo banco SQLite de: {db_path}')

conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
cursor = conn.cursor()

data = {}

# Tabelas a exportar (na ordem correta para respeitar dependências)
tables_to_export = [
    'branches',
    'users',
    'categories', 
    'products',
    'customers',
    'suppliers',
    'inventory_items',
    'inventory',
    'purchases',
    'purchase_items',
    'sales',
    'sale_items',
    'payments',
    'cash_boxes',
    'debts',
    'debt_payments',
    'tables',
    'table_sessions',
    'table_orders',
    'table_customers',
    'table_payments',
    'table_actions',
    'stock_movements',
    'settings',
]

for table in tables_to_export:
    try:
        cursor.execute(f'SELECT * FROM {table}')
        rows = cursor.fetchall()
        
        # Converter para lista de dicionários
        records = []
        for row in rows:
            record = {}
            for key in row.keys():
                value = row[key]
                # Converter tipos especiais para JSON
                if isinstance(value, bytes):
                    value = value.decode('utf-8', errors='ignore')
                record[key] = value
            records.append(record)
        
        data[table] = records
        if len(records) > 0:
            print(f'✅ {table}: {len(records)} registros')
    except Exception as e:
        print(f'⚠️ {table}: {e}')
        data[table] = []

conn.close()

# Salvar como JSON
with open(output_path, 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent=2, default=str)

# Calcular totais
total = sum(len(v) for v in data.values())
print(f'\n✨ Total: {total} registros exportados')
print(f'📄 Arquivo salvo em: {output_path}')
