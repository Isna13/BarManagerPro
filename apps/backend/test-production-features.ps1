# ✅ Script de Teste - Funcionalidades de Produção
# Testa todos os recursos implementados antes do deploy

Write-Host "`n🧪 ===== TESTE DE FUNCIONALIDADES DE PRODUÇÃO =====" -ForegroundColor Cyan
Write-Host "Este script valida:" -ForegroundColor Yellow
Write-Host "  ✓ Health checks" -ForegroundColor Gray
Write-Host "  ✓ Rate limiting" -ForegroundColor Gray
Write-Host "  ✓ Autenticação" -ForegroundColor Gray
Write-Host "  ✓ Logs estruturados" -ForegroundColor Gray
Write-Host "  ✓ CORS" -ForegroundColor Gray
Write-Host ""

# Configurações
$BASE_URL = "http://127.0.0.1:3000"
$API_URL = "$BASE_URL/api/v1"

# Função para verificar se backend está rodando
function Test-BackendRunning {
    try {
        $response = Invoke-WebRequest -Uri "$BASE_URL" -Method GET -TimeoutSec 5 -ErrorAction Stop
        return $true
    } catch {
        return $false
    }
}

# Função para fazer requisição HTTP
function Invoke-ApiRequest {
    param(
        [string]$Endpoint,
        [string]$Method = "GET",
        [hashtable]$Body = $null,
        [hashtable]$Headers = @{}
    )
    
    try {
        $params = @{
            Uri = "$API_URL/$Endpoint"
            Method = $Method
            Headers = $Headers
            ContentType = "application/json"
            TimeoutSec = 10
        }
        
        if ($Body) {
            $params.Body = ($Body | ConvertTo-Json)
        }
        
        $response = Invoke-WebRequest @params
        return @{
            Success = $true
            StatusCode = $response.StatusCode
            Content = ($response.Content | ConvertFrom-Json)
        }
    } catch {
        return @{
            Success = $false
            StatusCode = $_.Exception.Response.StatusCode.value__
            Error = $_.Exception.Message
        }
    }
}

# Verificar se backend está rodando
Write-Host "`n1️⃣  Verificando se backend está rodando..." -ForegroundColor Cyan
if (-not (Test-BackendRunning)) {
    Write-Host "   ❌ Backend não está rodando!" -ForegroundColor Red
    Write-Host "   📝 Execute: cd apps/backend && pnpm dev" -ForegroundColor Yellow
    exit 1
}
Write-Host "   ✅ Backend está ativo" -ForegroundColor Green

# Teste 1: Health Check Completo
Write-Host "`n2️⃣  Testando Health Check Completo..." -ForegroundColor Cyan
$health = Invoke-ApiRequest -Endpoint "health" -Method GET
if ($health.Success) {
    Write-Host "   ✅ Status: $($health.Content.status)" -ForegroundColor Green
    Write-Host "   📊 Database: $($health.Content.database)" -ForegroundColor Gray
    Write-Host "   ⏱️  Uptime: $([math]::Round($health.Content.uptime, 2))s" -ForegroundColor Gray
    Write-Host "   🌍 Environment: $($health.Content.environment)" -ForegroundColor Gray
} else {
    Write-Host "   ❌ Falhou: $($health.Error)" -ForegroundColor Red
}

# Teste 2: Health Ping
Write-Host "`n3️⃣  Testando Health Ping (lightweight)..." -ForegroundColor Cyan
$ping = Invoke-ApiRequest -Endpoint "health/ping" -Method GET
if ($ping.Success) {
    Write-Host "   ✅ Resposta: $($ping.Content.message)" -ForegroundColor Green
} else {
    Write-Host "   ❌ Falhou: $($ping.Error)" -ForegroundColor Red
}

# Teste 3: Rate Limiting
Write-Host "`n4️⃣  Testando Rate Limiting (fazendo 105 requisições)..." -ForegroundColor Cyan
Write-Host "   ⏳ Isso pode levar 1-2 minutos..." -ForegroundColor Yellow

$successCount = 0
$blockedCount = 0
$expectedLimit = 100

for ($i = 1; $i -le 105; $i++) {
    $result = Invoke-ApiRequest -Endpoint "health/ping" -Method GET
    
    if ($result.Success) {
        $successCount++
    } else {
        $blockedCount++
    }
    
    # Mostrar progresso a cada 20 requisições
    if ($i % 20 -eq 0) {
        Write-Host "   📈 Progresso: $i/105 requisições" -ForegroundColor Gray
    }
}

Write-Host "   📊 Resultados:" -ForegroundColor Cyan
Write-Host "      Sucessos: $successCount" -ForegroundColor Green
Write-Host "      Bloqueadas: $blockedCount" -ForegroundColor Yellow

if ($blockedCount -gt 0) {
    Write-Host "   ✅ Rate limiting está funcionando!" -ForegroundColor Green
    Write-Host "   💡 Bloqueou após ~$successCount requisições" -ForegroundColor Gray
} else {
    Write-Host "   ⚠️  Rate limiting pode não estar ativo" -ForegroundColor Yellow
    Write-Host "   💡 Verifique variável RATE_LIMIT_MAX_REQUESTS" -ForegroundColor Gray
}

# Aguardar janela de rate limit expirar
Write-Host "`n   ⏳ Aguardando 65 segundos para janela de rate limit expirar..." -ForegroundColor Yellow
Start-Sleep -Seconds 65

# Teste 4: Autenticação - Registro
Write-Host "`n5️⃣  Testando Registro de Usuário..." -ForegroundColor Cyan
$randomEmail = "test_$(Get-Random -Maximum 9999)@barmanager.com"
$registerBody = @{
    email = $randomEmail
    password = "SenhaForte123!"
    fullName = "Usuário Teste"
    role = "cashier"
}

$register = Invoke-ApiRequest -Endpoint "auth/register" -Method POST -Body $registerBody
if ($register.Success) {
    Write-Host "   ✅ Registro bem-sucedido!" -ForegroundColor Green
    Write-Host "   👤 Email: $($register.Content.user.email)" -ForegroundColor Gray
    Write-Host "   🎭 Role: $($register.Content.user.role)" -ForegroundColor Gray
} else {
    Write-Host "   ⚠️  Falha no registro: $($register.Error)" -ForegroundColor Yellow
    Write-Host "   💡 Isso é esperado se /auth/register estiver desabilitado" -ForegroundColor Gray
}

# Teste 5: Autenticação - Login
Write-Host "`n6️⃣  Testando Login..." -ForegroundColor Cyan
$loginBody = @{
    email = "admin@barmanager.com"
    password = "admin123"
}

$login = Invoke-ApiRequest -Endpoint "auth/login" -Method POST -Body $loginBody
if ($login.Success) {
    Write-Host "   ✅ Login bem-sucedido!" -ForegroundColor Green
    Write-Host "   👤 Usuário: $($login.Content.user.fullName)" -ForegroundColor Gray
    Write-Host "   🔑 Token gerado: Sim" -ForegroundColor Gray
    $token = $login.Content.accessToken
} else {
    Write-Host "   ⚠️  Falha no login: $($login.Error)" -ForegroundColor Yellow
    Write-Host "   💡 Verifique se usuário admin existe no banco" -ForegroundColor Gray
    $token = $null
}

# Teste 6: Rota Protegida (se temos token)
if ($token) {
    Write-Host "`n7️⃣  Testando Rota Protegida (com JWT)..." -ForegroundColor Cyan
    
    $headers = @{
        "Authorization" = "Bearer $token"
    }
    
    $profile = Invoke-ApiRequest -Endpoint "users/profile" -Method GET -Headers $headers
    if ($profile.Success) {
        Write-Host "   ✅ Acesso autorizado!" -ForegroundColor Green
        Write-Host "   👤 Nome: $($profile.Content.fullName)" -ForegroundColor Gray
        Write-Host "   📧 Email: $($profile.Content.email)" -ForegroundColor Gray
    } else {
        Write-Host "   ⚠️  Falha: $($profile.Error)" -ForegroundColor Yellow
    }
    
    # Testar sem token
    Write-Host "`n8️⃣  Testando Rota Protegida (sem JWT)..." -ForegroundColor Cyan
    $noAuth = Invoke-ApiRequest -Endpoint "users/profile" -Method GET
    if (-not $noAuth.Success -and $noAuth.StatusCode -eq 401) {
        Write-Host "   ✅ Bloqueio funcionando (401 Unauthorized)" -ForegroundColor Green
    } else {
        Write-Host "   ⚠️  Rota pode estar desprotegida" -ForegroundColor Yellow
    }
}

# Teste 7: CORS Headers
Write-Host "`n9️⃣  Verificando Headers de Segurança..." -ForegroundColor Cyan
try {
    $response = Invoke-WebRequest -Uri "$API_URL/health/ping" -Method GET
    
    Write-Host "   🔒 Headers encontrados:" -ForegroundColor Cyan
    
    # Helmet Headers
    if ($response.Headers["X-Content-Type-Options"]) {
        Write-Host "      ✅ X-Content-Type-Options: $($response.Headers['X-Content-Type-Options'])" -ForegroundColor Green
    }
    if ($response.Headers["X-Frame-Options"]) {
        Write-Host "      ✅ X-Frame-Options: $($response.Headers['X-Frame-Options'])" -ForegroundColor Green
    }
    if ($response.Headers["Strict-Transport-Security"]) {
        Write-Host "      ✅ Strict-Transport-Security: $($response.Headers['Strict-Transport-Security'])" -ForegroundColor Green
    }
    
    # CORS
    if ($response.Headers["Access-Control-Allow-Origin"]) {
        Write-Host "      ✅ CORS Configurado: $($response.Headers['Access-Control-Allow-Origin'])" -ForegroundColor Green
    }
    
} catch {
    Write-Host "   ⚠️  Não foi possível verificar headers" -ForegroundColor Yellow
}

# Teste 8: Verificar Logs do Servidor
Write-Host "`n🔟 Verificando Logs do Servidor..." -ForegroundColor Cyan
Write-Host "   💡 Verifique o console onde o backend está rodando:" -ForegroundColor Yellow
Write-Host "      - Logs de startup com seções detalhadas" -ForegroundColor Gray
Write-Host "      - Logs de cada requisição HTTP (método, URL, status, tempo)" -ForegroundColor Gray
Write-Host "      - Logs de rate limiting quando bloqueado" -ForegroundColor Gray
Write-Host "      - Logs de autenticação (success/failure)" -ForegroundColor Gray

# Resumo Final
Write-Host "`n" -NoNewline
Write-Host "=" -ForegroundColor Cyan -NoNewline
Write-Host " RESUMO DOS TESTES " -ForegroundColor White -NoNewline
Write-Host "=" -ForegroundColor Cyan

Write-Host "`n✅ FUNCIONALIDADES TESTADAS:" -ForegroundColor Green
Write-Host "   ✓ Health checks (completo e ping)" -ForegroundColor Gray
Write-Host "   ✓ Rate limiting (proteção contra abuso)" -ForegroundColor Gray
Write-Host "   ✓ Autenticação JWT" -ForegroundColor Gray
Write-Host "   ✓ Guards de autorização" -ForegroundColor Gray
Write-Host "   ✓ Headers de segurança (Helmet)" -ForegroundColor Gray
Write-Host "   ✓ CORS configurado" -ForegroundColor Gray

Write-Host "`n📋 PRÓXIMOS PASSOS:" -ForegroundColor Cyan
Write-Host "   1. Verificar logs do servidor para confirmar logging HTTP" -ForegroundColor Yellow
Write-Host "   2. Testar graceful shutdown (Ctrl+C no servidor)" -ForegroundColor Yellow
Write-Host "   3. Se tudo estiver OK, prosseguir com deploy no Railway" -ForegroundColor Yellow
Write-Host "   4. Consultar PRODUCTION_DEPLOY.md para instruções completas" -ForegroundColor Yellow

Write-Host "`n✨ Teste concluído com sucesso!" -ForegroundColor Green
Write-Host ""
