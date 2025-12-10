import sqlite3
import os

db_path = os.path.join(os.environ['APPDATA'], '@barmanager', 'desktop', 'barmanager.db')
conn = sqlite3.connect(db_path)
conn.execute("UPDATE sync_queue SET status = 'pending', retry_count = 0, last_error = NULL WHERE entity IN ('purchase', 'purchase_item') AND status = 'failed'")
print(f'Resetados: {conn.total_changes} itens')
conn.commit()
conn.close()
