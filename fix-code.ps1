# Script PowerShell para corrigir automaticamente erros comuns no código

Write-Host "🔧 Corrigindo código TypeScript..." -ForegroundColor Cyan

# 1. Customer: name → fullName
Write-Host "`n📝 Corrigindo Customer.name → Customer.fullName..." -ForegroundColor Yellow
Get-ChildItem -Path "apps\backend\src" -Filter "*.ts" -Recurse | ForEach-Object {
    $content = Get-Content $_.FullName -Raw
    if ($content -match 'customer.*select.*name:') {
        $newContent = $content -replace '(\bcustomer.*select.*\{[^}]*)\bname:', '$1fullName:'
        Set-Content -Path $_.FullName -Value $newContent -NoNewline
        Write-Host "  ✓ $($_.Name)" -ForegroundColor Green
    }
}

# 2. Purchase/Sale: user → createdByUser
Write-Host "`n📝 Corrigindo user → createdByUser..." -ForegroundColor Yellow
Get-ChildItem -Path "apps\backend\src\purchases","apps\backend\src\sales" -Filter "*.service.ts" -ErrorAction SilentlyContinue | ForEach-Object {
    $content = Get-Content $_.FullName -Raw
    if ($content -match 'include.*user:\s*true') {
        $newContent = $content -replace 'user:\s*true', 'createdByUser: true'
        Set-Content -Path $_.FullName -Value $newContent -NoNewline
        Write-Host "  ✓ $($_.Name)" -ForegroundColor Green
    }
}

# 3. Product: unitCost → costUnit
Write-Host "`n📝 Corrigindo product.unitCost → product.costUnit..." -ForegroundColor Yellow
Get-ChildItem -Path "apps\backend\src" -Filter "*.ts" -Recurse | ForEach-Object {
    $content = Get-Content $_.FullName -Raw
    if ($content -match 'product\??\.\bunitCost\b') {
        $newContent = $content -replace 'product(\??)\.\bunitCost\b', 'product$1.costUnit'
        Set-Content -Path $_.FullName -Value $newContent -NoNewline
        Write-Host "  ✓ $($_.Name)" -ForegroundColor Green
    }
}

# 4. SyncQueue: entityType → entity
Write-Host "`n📝 Corrigindo entityType → entity..." -ForegroundColor Yellow
$syncFile = "apps\backend\src\sync\sync.service.ts"
if (Test-Path $syncFile) {
    $content = Get-Content $syncFile -Raw
    $newContent = $content -replace '\bentityType:', 'entity:'
    Set-Content -Path $syncFile -Value $newContent -NoNewline
    Write-Host "  ✓ sync.service.ts" -ForegroundColor Green
}

# 5. SyncQueue: syncedAt → processedAt
Write-Host "`n📝 Corrigindo syncedAt → processedAt..." -ForegroundColor Yellow
if (Test-Path $syncFile) {
    $content = Get-Content $syncFile -Raw
    $newContent = $content -replace '\bsyncedAt\b', 'processedAt'
    Set-Content -Path $syncFile -Value $newContent -NoNewline
    Write-Host "  ✓ sync.service.ts" -ForegroundColor Green
}

# 6. Payment: reference → referenceNumber
Write-Host "`n📝 Corrigindo reference → referenceNumber..." -ForegroundColor Yellow
$salesFile = "apps\backend\src\sales\sales.service.ts"
if (Test-Path $salesFile) {
    $content = Get-Content $salesFile -Raw
    $newContent = $content -replace '(\s+)reference:', '$1referenceNumber:'
    Set-Content -Path $salesFile -Value $newContent -NoNewline
    Write-Host "  ✓ sales.service.ts" -ForegroundColor Green
}

# 7. PurchaseItem: costPerUnit → unitCost
Write-Host "`n📝 Corrigindo costPerUnit → unitCost..." -ForegroundColor Yellow
$purchaseFile = "apps\backend\src\purchases\purchases.service.ts"
if (Test-Path $purchaseFile) {
    $content = Get-Content $purchaseFile -Raw
    $newContent = $content -replace '\bcostPerUnit:', 'unitCost:'
    Set-Content -Path $purchaseFile -Value $newContent -NoNewline
    Write-Host "  ✓ purchases.service.ts" -ForegroundColor Green
}

# 8. ProductPriceHistory: changedAt → createdAt
Write-Host "`n📝 Corrigindo changedAt → createdAt..." -ForegroundColor Yellow
$productsFile = "apps\backend\src\products\products.service.ts"
if (Test-Path $productsFile) {
    $content = Get-Content $productsFile -Raw
    $newContent = $content -replace 'changedAt:', 'createdAt:'
    Set-Content -Path $productsFile -Value $newContent -NoNewline
    Write-Host "  ✓ products.service.ts" -ForegroundColor Green
}

# 9. LoyaltyTransaction: reason → notes
Write-Host "`n📝 Corrigindo LoyaltyTransaction reason → notes..." -ForegroundColor Yellow
$loyaltyFile = "apps\backend\src\loyalty\loyalty.service.ts"
if (Test-Path $loyaltyFile) {
    $content = Get-Content $loyaltyFile -Raw
    $newContent = $content -replace '(\s+)reason:', '$1notes:'
    Set-Content -Path $loyaltyFile -Value $newContent -NoNewline
    Write-Host "  ✓ loyalty.service.ts" -ForegroundColor Green
}

# 10. Notification: isRead → read
Write-Host "`n📝 Corrigindo Notification isRead → read..." -ForegroundColor Yellow
$notifFile = "apps\backend\src\notifications\notifications.service.ts"
if (Test-Path $notifFile) {
    $content = Get-Content $notifFile -Raw
    $newContent = $content -replace '\bisRead\b', 'read'
    Set-Content -Path $notifFile -Value $newContent -NoNewline
    Write-Host "  ✓ notifications.service.ts" -ForegroundColor Green
}

Write-Host "`n✅ Correções aplicadas!" -ForegroundColor Green
Write-Host "`nPróximos passos:" -ForegroundColor Cyan
Write-Host "  1. pnpm build  (testar compilacao)" -ForegroundColor White
Write-Host "  2. git add ." -ForegroundColor White
Write-Host "  3. git commit -m fix: schema and code compatibility" -ForegroundColor White
Write-Host "  4. git push" -ForegroundColor White
