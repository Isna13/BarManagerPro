# Script para limpar dados automaticos do banco de dados
# Execute este script com PowerShell

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Limpeza de Dados Automaticos" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Procurar pelo banco de dados SQLite
$possiblePaths = @(
    ".\apps\desktop\bar-manager.db",
    "$env:APPDATA\BarManagerPro\bar-manager.db",
    "$env:LOCALAPPDATA\BarManagerPro\bar-manager.db",
    ".\apps\desktop\database.db",
    ".\database.db"
)

$dbPath = $null
foreach ($path in $possiblePaths) {
    if (Test-Path $path) {
        $dbPath = $path
        break
    }
}

if (-not $dbPath) {
    Write-Host "Banco de dados nao encontrado!" -ForegroundColor Red
    Write-Host "Locais verificados:" -ForegroundColor Yellow
    foreach ($path in $possiblePaths) {
        Write-Host "  - $path" -ForegroundColor Gray
    }
    Write-Host ""
    Write-Host "Por favor, localize o arquivo database.db manualmente." -ForegroundColor Yellow
    pause
    exit 1
}

Write-Host "Banco de dados encontrado: $dbPath" -ForegroundColor Green
Write-Host ""

# Verificar se sqlite3 esta disponivel
$hasSqlite = $false
$sqliteCmd = $null
try {
    $sqliteCmd = Get-Command sqlite3 -ErrorAction Stop
    $hasSqlite = $true
    Write-Host "sqlite3 encontrado: $($sqliteCmd.Source)" -ForegroundColor Green
} catch {
    Write-Host "sqlite3.exe nao encontrado no PATH" -ForegroundColor Yellow
    Write-Host "As operacoes SQL nao poderao ser executadas automaticamente." -ForegroundColor Yellow
    Write-Host "Voce tera que executar os comandos SQL manualmente." -ForegroundColor Yellow
}

Write-Host "OPCOES DE LIMPEZA:" -ForegroundColor Cyan
Write-Host "1. Limpar apenas ESTOQUE (mantem produtos e compras)" -ForegroundColor White
Write-Host "2. Limpar TUDO exceto compras e categorias" -ForegroundColor White
Write-Host "3. DELETAR banco completo e recomeçar do zero" -ForegroundColor Red
Write-Host "4. Cancelar" -ForegroundColor Gray
Write-Host ""

$choice = Read-Host "Escolha uma opção (1-4)"

switch ($choice) {
    "1" {
        Write-Host ""
        Write-Host "Limpando apenas estoque..." -ForegroundColor Yellow
        
        if ($hasSqlite) {
            sqlite3 $dbPath @"
DELETE FROM inventory_items;
DELETE FROM stock_movements;
SELECT 'Estoque limpo! Total de itens: ' || COUNT(*) FROM inventory_items;
"@
            Write-Host "Estoque limpo com sucesso!" -ForegroundColor Green
        } else {
            Write-Host "Execute manualmente no banco:" -ForegroundColor Yellow
            Write-Host "DELETE FROM inventory_items;" -ForegroundColor White
            Write-Host "DELETE FROM stock_movements;" -ForegroundColor White
        }
    }
    
    "2" {
        Write-Host ""
        Write-Host "Limpando produtos de exemplo e estoque..." -ForegroundColor Yellow
        
        if ($hasSqlite) {
            sqlite3 $dbPath @"
DELETE FROM inventory_items;
DELETE FROM stock_movements;
DELETE FROM products WHERE sku IN ('BEB-001', 'BEB-002', 'BEB-003', 'BEB-004', 'BEB-005');
DELETE FROM categories WHERE name = 'Bebidas';
SELECT 'Dados limpos!';
"@
            Write-Host "Produtos de exemplo e estoque removidos!" -ForegroundColor Green
        } else {
            Write-Host "Execute manualmente no banco:" -ForegroundColor Yellow
            Write-Host "DELETE FROM inventory_items;" -ForegroundColor White
            Write-Host "DELETE FROM stock_movements;" -ForegroundColor White
            Write-Host "DELETE FROM products WHERE sku IN ('BEB-001', 'BEB-002', 'BEB-003', 'BEB-004', 'BEB-005');" -ForegroundColor White
            Write-Host "DELETE FROM categories WHERE name = 'Bebidas';" -ForegroundColor White
        }
    }
    
    "3" {
        Write-Host ""
        Write-Host "ATENCAO: Isso ira DELETAR TODO O BANCO DE DADOS!" -ForegroundColor Red
        Write-Host "Voce perdera TODOS os dados (produtos, compras, vendas, etc.)" -ForegroundColor Red
        Write-Host ""
        $confirm = Read-Host "Digite 'CONFIRMAR' para continuar"
        
        if ($confirm -eq "CONFIRMAR") {
            try {
                Remove-Item $dbPath -Force
                Write-Host "Banco de dados deletado!" -ForegroundColor Green
                Write-Host "Um novo banco sera criado quando voce abrir o aplicativo." -ForegroundColor Cyan
            } catch {
                Write-Host "Erro ao deletar: $_" -ForegroundColor Red
            }
        } else {
            Write-Host "Cancelado." -ForegroundColor Gray
        }
    }
    
    "4" {
        Write-Host "Cancelado." -ForegroundColor Gray
    }
    
    default {
        Write-Host "Opção inválida!" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "PROXIMOS PASSOS:" -ForegroundColor Cyan
Write-Host "1. Abra o aplicativo BarManagerPro" -ForegroundColor White
Write-Host "2. Va para a aba Compras" -ForegroundColor White
Write-Host "3. Complete/Receba suas compras" -ForegroundColor White
Write-Host "4. O estoque sera criado automaticamente" -ForegroundColor White
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

pause
