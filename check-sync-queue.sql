-- Script para examinar a fila de sync
-- Executar com: sqlite3 "$env:APPDATA\@barmanager\desktop\barmanager.db" < check-sync-queue.sql

.headers on
.mode column

-- Todas as vendas na fila de sync
SELECT 'VENDAS NA SYNC QUEUE:' as info;
SELECT id, entity, entity_id, operation, status, priority, retry_count, last_error, created_at 
FROM sync_queue 
WHERE entity = 'sale'
ORDER BY created_at DESC
LIMIT 20;

-- Verificar dados das vendas
SELECT '';
SELECT 'DADOS DAS VENDAS NA SYNC QUEUE:' as info;
SELECT sq.entity_id, sq.status, json_extract(sq.data, '$.type') as sale_type, json_extract(sq.data, '$.total') as total
FROM sync_queue sq
WHERE entity = 'sale'
LIMIT 20;

-- Vendas tipo table na fila
SELECT '';
SELECT 'VENDAS TIPO TABLE NA SYNC QUEUE:' as info;
SELECT sq.entity_id, sq.status, sq.last_error, json_extract(sq.data, '$.type') as sale_type
FROM sync_queue sq
WHERE entity = 'sale' AND json_extract(sq.data, '$.type') = 'table'
LIMIT 20;

-- Items de vendas pendentes
SELECT '';
SELECT 'ITEMS DE VENDAS PENDENTES:' as info;
SELECT id, entity, entity_id, operation, status, last_error
FROM sync_queue 
WHERE entity = 'sale_item' AND status != 'completed'
ORDER BY created_at DESC
LIMIT 10;

-- Pagamentos pendentes
SELECT '';
SELECT 'PAGAMENTOS PENDENTES:' as info;
SELECT id, entity, entity_id, operation, status, last_error
FROM sync_queue 
WHERE entity = 'payment' AND status != 'completed'
ORDER BY created_at DESC
LIMIT 10;

-- Estatísticas gerais
SELECT '';
SELECT 'ESTATÍSTICAS DA SYNC QUEUE:' as info;
SELECT entity, status, COUNT(*) as count
FROM sync_queue
GROUP BY entity, status
ORDER BY entity, status;
