#!/usr/bin/env pwsh
# Script de verificação e inicialização do backend BarManager Pro

Write-Host "`n🔍 BarManager Pro - Verificação de Rede`n" -ForegroundColor Cyan

# 1. Verificar se porta 3000 está disponível
Write-Host "📡 Verificando porta 3000..." -ForegroundColor Yellow
$port = 3000
$portInUse = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue

if ($portInUse) {
    Write-Host "⚠️  Porta $port já está em uso!" -ForegroundColor Red
    Write-Host "   Processo usando a porta:" -ForegroundColor Red
    Get-Process -Id $portInUse.OwningProcess | Select-Object ProcessName, Id, StartTime
    Write-Host "`n   Deseja encerrar o processo? (S/N)" -ForegroundColor Yellow
    $response = Read-Host
    if ($response -eq 'S' -or $response -eq 's') {
        Stop-Process -Id $portInUse.OwningProcess -Force
        Write-Host "✅ Processo encerrado" -ForegroundColor Green
    } else {
        Write-Host "❌ Não é possível iniciar o backend" -ForegroundColor Red
        exit 1
    }
}

# 2. Detectar IPs da rede local
Write-Host "`n🌐 Detectando IPs da rede local..." -ForegroundColor Yellow
$networkInterfaces = Get-NetIPAddress -AddressFamily IPv4 | Where-Object {
    $_.InterfaceAlias -notlike "*Loopback*" -and 
    $_.IPAddress -ne "127.0.0.1"
}

if ($networkInterfaces.Count -eq 0) {
    Write-Host "⚠️  Nenhuma interface de rede ativa detectada" -ForegroundColor Red
    Write-Host "   Conecte-se a uma rede Wi-Fi ou Ethernet" -ForegroundColor Yellow
} else {
    Write-Host "✅ Interfaces de rede encontradas:" -ForegroundColor Green
    foreach ($interface in $networkInterfaces) {
        $alias = $interface.InterfaceAlias
        $ip = $interface.IPAddress
        Write-Host "   - $alias : $ip" -ForegroundColor White
    }
}

# 3. Verificar firewall
Write-Host "`n🛡️  Verificando regras de firewall..." -ForegroundColor Yellow
$firewallRule = Get-NetFirewallRule -DisplayName "BarManager Backend" -ErrorAction SilentlyContinue

if ($firewallRule) {
    Write-Host "✅ Regra de firewall encontrada" -ForegroundColor Green
} else {
    Write-Host "⚠️  Regra de firewall não encontrada" -ForegroundColor Yellow
    Write-Host "   Deseja criar uma regra para permitir conexões na porta $port? (S/N)" -ForegroundColor Yellow
    $response = Read-Host
    if ($response -eq 'S' -or $response -eq 's') {
        try {
            New-NetFirewallRule -DisplayName "BarManager Backend" `
                -Direction Inbound `
                -LocalPort $port `
                -Protocol TCP `
                -Action Allow `
                -ErrorAction Stop
            Write-Host "✅ Regra de firewall criada com sucesso" -ForegroundColor Green
        } catch {
            Write-Host "❌ Erro ao criar regra (execute como Administrador)" -ForegroundColor Red
        }
    }
}

# 4. Verificar arquivo .env
Write-Host "`n📋 Verificando configuração (.env)..." -ForegroundColor Yellow
$envFile = Join-Path $PSScriptRoot ".env"

if (Test-Path $envFile) {
    Write-Host "✅ Arquivo .env encontrado" -ForegroundColor Green
    
    # Verificar variáveis críticas
    $envContent = Get-Content $envFile
    $criticalVars = @("DATABASE_URL", "JWT_SECRET", "PORT")
    
    foreach ($var in $criticalVars) {
        $found = $envContent | Where-Object { $_ -match "^$var=" }
        if ($found) {
            Write-Host "   ✅ $var configurado" -ForegroundColor Green
        } else {
            Write-Host "   ⚠️  $var não encontrado" -ForegroundColor Yellow
        }
    }
} else {
    Write-Host "⚠️  Arquivo .env não encontrado" -ForegroundColor Yellow
    Write-Host "   Copie .env.example para .env e configure" -ForegroundColor Yellow
}

# 5. Verificar dependências
Write-Host "`n📦 Verificando dependências..." -ForegroundColor Yellow
$nodeModules = Join-Path $PSScriptRoot "node_modules"

if (Test-Path $nodeModules) {
    Write-Host "✅ node_modules encontrado" -ForegroundColor Green
} else {
    Write-Host "⚠️  node_modules não encontrado" -ForegroundColor Yellow
    Write-Host "   Execute: pnpm install" -ForegroundColor Yellow
    exit 1
}

# 6. Resumo
Write-Host "`n" + "="*60 -ForegroundColor Cyan
Write-Host "📊 RESUMO DA VERIFICAÇÃO" -ForegroundColor Cyan
Write-Host "="*60 -ForegroundColor Cyan

$primaryIP = ($networkInterfaces | Select-Object -First 1).IPAddress

Write-Host "`n✅ Backend pode ser iniciado!" -ForegroundColor Green
Write-Host "`n🌐 URLs de acesso:" -ForegroundColor Cyan
Write-Host "   - Local:      http://127.0.0.1:$port/api/v1" -ForegroundColor White
Write-Host "   - Localhost:  http://localhost:$port/api/v1" -ForegroundColor White
if ($primaryIP) {
    Write-Host "   - Rede Local: http://${primaryIP}:$port/api/v1" -ForegroundColor White
}

Write-Host "`n💡 Para conectar desktops na rede Wi-Fi:" -ForegroundColor Yellow
if ($primaryIP) {
    Write-Host "   Configure a URL no desktop: http://${primaryIP}:$port/api/v1" -ForegroundColor White
}

Write-Host "`n🚀 Iniciar backend agora? (S/N)" -ForegroundColor Green
$response = Read-Host

if ($response -eq 'S' -or $response -eq 's') {
    Write-Host "`n🔄 Iniciando backend..." -ForegroundColor Cyan
    pnpm run dev
} else {
    Write-Host "`n📝 Para iniciar manualmente, execute: pnpm run dev`n" -ForegroundColor Yellow
}
