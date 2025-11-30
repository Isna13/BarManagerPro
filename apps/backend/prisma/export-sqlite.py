import sqlite3
import json
import os

# Caminho do banco SQLite
sqlite_path = os.path.join(
    os.path.expanduser('~'),
    'AppData',
    'Roaming',
    '@barmanager',
    'desktop',
    'barmanager.db'
)

print(f'📂 Lendo banco SQLite de: {sqlite_path}')

conn = sqlite3.connect(sqlite_path)
conn.row_factory = sqlite3.Row
cursor = conn.cursor()

data = {}

# Tabelas para exportar
tables = [
    'products',
    'customers',
    'categories',
    'inventory_items',
    'sales',
    'sale_items',
    'cash_boxes',
    'debts',
    'branches'
]

for table in tables:
    try:
        cursor.execute(f'SELECT * FROM {table}')
        rows = cursor.fetchall()
        data[table] = [dict(row) for row in rows]
        print(f'✅ {table}: {len(rows)} registros')
    except sqlite3.OperationalError as e:
        print(f'⚠️  {table}: tabela não existe')
        data[table] = []

# Salvar em JSON
output_file = 'prisma/sqlite-data.json'
with open(output_file, 'w', encoding='utf-8') as f:
    json.dump(data, f, indent=2, ensure_ascii=False)

conn.close()

print(f'\n✨ Dados exportados para: {output_file}')
print(f'\n📊 Resumo:')
for table, records in data.items():
    if records:
        print(f'   {table}: {len(records)} registros')
