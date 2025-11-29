# BarManager Pro - Mobile Build & Run Script
# PowerShell script para compilar e executar o app Flutter

param(
    [Parameter(Mandatory=$false)]
    [ValidateSet("run", "build", "clean", "test", "doctor", "devices")]
    [string]$Action = "run",
    
    [Parameter(Mandatory=$false)]
    [ValidateSet("debug", "release", "profile")]
    [string]$Mode = "debug"
)

$ErrorActionPreference = "Stop"
$MobilePath = "apps\mobile"

Write-Host "🚀 BarManager Pro - Mobile Flutter" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor DarkGray
Write-Host ""

# Verificar se está na raiz do projeto
if (-not (Test-Path $MobilePath)) {
    Write-Host "❌ Erro: Execute este script da raiz do projeto BarManagerPro" -ForegroundColor Red
    exit 1
}

# Navegar para a pasta mobile
Set-Location $MobilePath

switch ($Action) {
    "run" {
        Write-Host "▶️  Executando aplicativo em modo $Mode..." -ForegroundColor Green
        Write-Host ""
        
        if ($Mode -eq "release") {
            flutter run --release
        } elseif ($Mode -eq "profile") {
            flutter run --profile
        } else {
            flutter run
        }
    }
    
    "build" {
        Write-Host "🔨 Compilando APK em modo $Mode..." -ForegroundColor Green
        Write-Host ""
        
        # Limpar builds anteriores
        Write-Host "🧹 Limpando builds anteriores..." -ForegroundColor Yellow
        flutter clean
        flutter pub get
        
        if ($Mode -eq "release") {
            Write-Host "📦 Gerando APK universal..." -ForegroundColor Cyan
            flutter build apk --release
            
            Write-Host ""
            Write-Host "✅ APK gerado com sucesso!" -ForegroundColor Green
            Write-Host ""
            Write-Host "📁 Localização:" -ForegroundColor Yellow
            Write-Host "   build\app\outputs\flutter-apk\app-release.apk" -ForegroundColor White
            Write-Host ""
            Write-Host "📱 Para instalar no dispositivo:" -ForegroundColor Yellow
            Write-Host "   adb install build\app\outputs\flutter-apk\app-release.apk" -ForegroundColor White
            
        } elseif ($Mode -eq "debug") {
            flutter build apk --debug
            Write-Host ""
            Write-Host "✅ APK Debug gerado!" -ForegroundColor Green
            Write-Host "   build\app\outputs\flutter-apk\app-debug.apk" -ForegroundColor White
        }
        
        # Abrir pasta de saída
        $OutputPath = "build\app\outputs\flutter-apk"
        if (Test-Path $OutputPath) {
            Write-Host ""
            Write-Host "📂 Abrindo pasta de saída..." -ForegroundColor Cyan
            Start-Process $OutputPath
        }
    }
    
    "clean" {
        Write-Host "🧹 Limpando projeto Flutter..." -ForegroundColor Yellow
        flutter clean
        
        Write-Host "📦 Instalando dependências..." -ForegroundColor Cyan
        flutter pub get
        
        Write-Host ""
        Write-Host "✅ Projeto limpo e dependências instaladas!" -ForegroundColor Green
    }
    
    "test" {
        Write-Host "🧪 Executando testes..." -ForegroundColor Cyan
        flutter test
    }
    
    "doctor" {
        Write-Host "🔍 Verificando ambiente Flutter..." -ForegroundColor Cyan
        Write-Host ""
        flutter doctor -v
    }
    
    "devices" {
        Write-Host "📱 Dispositivos conectados:" -ForegroundColor Cyan
        Write-Host ""
        flutter devices
    }
}

Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor DarkGray
Write-Host "✅ Operação concluída!" -ForegroundColor Green
Write-Host ""

# Voltar para a raiz
Set-Location ..\..
