# Script para build do Flutter mobile
Write-Host "🚀 Iniciando build do BarManager Mobile..." -ForegroundColor Green
Write-Host ""
Write-Host "⏱️ IMPORTANTE: O primeiro build pode demorar 10-20 minutos" -ForegroundColor Yellow
Write-Host "   - Gradle está baixando dependências (~500MB)" -ForegroundColor Yellow  
Write-Host "   - Compilando código Kotlin/Java" -ForegroundColor Yellow
Write-Host "   - NÃO INTERROMPA o processo!" -ForegroundColor Red
Write-Host ""

$startTime = Get-Date

Set-Location "C:\BarManagerPro\apps\mobile"

Write-Host "📦 Etapa 1/3: Limpando cache..." -ForegroundColor Cyan
flutter clean | Out-Null

Write-Host "📥 Etapa 2/3: Baixando dependências Flutter..." -ForegroundColor Cyan
flutter pub get

Write-Host "🔨 Etapa 3/3: Compilando aplicativo..." -ForegroundColor Cyan
Write-Host "   (Aguarde pacientemente, pode demorar!)" -ForegroundColor Yellow
Write-Host ""

flutter run --verbose

$endTime = Get-Date
$duration = $endTime - $startTime

Write-Host ""
Write-Host "✅ Build concluído em $($duration.TotalMinutes.ToString('0.0')) minutos!" -ForegroundColor Green
