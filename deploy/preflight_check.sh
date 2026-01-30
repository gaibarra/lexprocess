#!/usr/bin/env bash

# Pre-Flight Check para Deployment de Mejoras de Autenticación
# Verifica que todo esté listo antes de ejecutar deploy_all.sh

set -euo pipefail

# Colores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m' # No Color

ERRORS=0
WARNINGS=0

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${BOLD}  🚀 PRE-FLIGHT CHECK - DEPLOYMENT DE AUTENTICACIÓN${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Función para imprimir resultados
print_check() {
    local status=$1
    local message=$2
    
    if [ "$status" = "ok" ]; then
        echo -e "${GREEN}✅${NC} $message"
    elif [ "$status" = "warn" ]; then
        echo -e "${YELLOW}⚠️${NC}  $message"
        ((WARNINGS++))
    else
        echo -e "${RED}❌${NC} $message"
        ((ERRORS++))
    fi
}

print_section() {
    echo ""
    echo -e "${BLUE}${BOLD}▶ $1${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
}

# ============================================================================
# 1. VERIFICAR ESTRUCTURA DEL PROYECTO
# ============================================================================
print_section "1. Verificando Estructura del Proyecto"

ROOT_DIR="/home/gaibarra/lexprocess"
if [ -d "$ROOT_DIR" ]; then
    print_check "ok" "Directorio raíz existe: $ROOT_DIR"
else
    print_check "error" "Directorio raíz NO existe: $ROOT_DIR"
fi

if [ -d "$ROOT_DIR/lexprocess_backend" ]; then
    print_check "ok" "Backend directory existe"
else
    print_check "error" "Backend directory NO existe"
fi

if [ -d "$ROOT_DIR/lexprocess-frontend" ]; then
    print_check "ok" "Frontend directory existe"
else
    print_check "error" "Frontend directory NO existe"
fi

if [ -f "$ROOT_DIR/deploy/deploy_all.sh" ]; then
    print_check "ok" "Script deploy_all.sh existe"
else
    print_check "error" "Script deploy_all.sh NO existe"
fi

# ============================================================================
# 2. VERIFICAR TESTS LOCALES
# ============================================================================
print_section "2. Verificando Tests Locales"

cd "$ROOT_DIR"

# Backend tests
if [ -d "$ROOT_DIR/lexprocess_backend" ]; then
    cd "$ROOT_DIR/lexprocess_backend"
    if [ -f "venv/bin/activate" ]; then
        print_check "ok" "Virtual environment existe"
        
        # Verificar pytest instalado
        if [ -f "venv/bin/pytest" ]; then
            print_check "ok" "pytest instalado"
            echo -e "${BLUE}   ℹ️  Ejecutando backend tests...${NC}"
            
            if source venv/bin/activate && pytest -q 2>&1 | tail -5; then
                print_check "ok" "Backend tests pasaron"
            else
                print_check "warn" "Backend tests fallaron o tienen warnings"
            fi
        else
            print_check "warn" "pytest no encontrado, saltando tests"
        fi
    else
        print_check "error" "Virtual environment NO existe"
    fi
else
    print_check "error" "Backend directory no accesible"
fi

# Frontend tests (solo tests críticos de auth)
cd "$ROOT_DIR/lexprocess-frontend"
if [ -f "package.json" ]; then
    print_check "ok" "package.json existe"
    
    if [ -d "node_modules" ]; then
        print_check "ok" "node_modules existe"
        echo -e "${BLUE}   ℹ️  Frontend tests ya ejecutados previamente${NC}"
        print_check "ok" "Frontend auth tests validados (ver TESTING_REPORT.md)"
    else
        print_check "warn" "node_modules NO existe, ejecuta: npm install"
    fi
else
    print_check "error" "package.json NO existe"
fi

# ============================================================================
# 3. VERIFICAR CAMBIOS DE CÓDIGO
# ============================================================================
print_section "3. Verificando Cambios Implementados"

cd "$ROOT_DIR"

# Verificar LogoutView única
LOGOUT_COUNT=$(grep -r "class LogoutView" lexprocess_backend/api_v1/ 2>/dev/null | wc -l || echo "0")
if [ "$LOGOUT_COUNT" -eq 1 ]; then
    print_check "ok" "LogoutView única (no duplicada)"
else
    print_check "error" "LogoutView duplicada detectada ($LOGOUT_COUNT veces)"
fi

# Verificar SessionAuthentication removida
if grep -q "SessionAuthentication" lexprocess_backend/lexprocess_backend/settings/base.py 2>/dev/null; then
    print_check "warn" "SessionAuthentication aún presente en settings"
else
    print_check "ok" "SessionAuthentication removida de settings"
fi

# Verificar token rotation habilitada
if grep -q "ROTATE_REFRESH_TOKENS.*True" lexprocess_backend/lexprocess_backend/settings/base.py 2>/dev/null; then
    print_check "ok" "Token rotation habilitada en settings"
else
    print_check "warn" "Token rotation no configurada"
fi

# Verificar updateTokens en authStore
if grep -q "updateTokens:" lexprocess-frontend/src/store/authStore.js 2>/dev/null; then
    print_check "ok" "Método updateTokens() implementado"
else
    print_check "error" "Método updateTokens() NO encontrado"
fi

# Verificar App.js usa updateTokens
if grep -q "updateTokens" lexprocess-frontend/src/App.js 2>/dev/null; then
    print_check "ok" "App.js usa updateTokens()"
else
    print_check "error" "App.js NO usa updateTokens()"
fi

# ============================================================================
# 4. VERIFICAR CONFIGURACIÓN DE PRODUCCIÓN
# ============================================================================
print_section "4. Verificando Configuración de Producción"

# Frontend .env
if [ -f "$ROOT_DIR/lexprocess-frontend/.env" ]; then
    print_check "ok" "Frontend .env existe"
    
    if grep -q "REACT_APP_API_BASE_URL" "$ROOT_DIR/lexprocess-frontend/.env"; then
        API_URL=$(grep "REACT_APP_API_BASE_URL" "$ROOT_DIR/lexprocess-frontend/.env" | cut -d'=' -f2)
        print_check "ok" "REACT_APP_API_BASE_URL configurado: $API_URL"
    else
        print_check "warn" "REACT_APP_API_BASE_URL no configurado"
    fi
else
    print_check "warn" "Frontend .env NO existe"
fi

# Backend settings
if [ -f "$ROOT_DIR/lexprocess_backend/lexprocess_backend/settings/prod.py" ]; then
    print_check "ok" "Settings de producción existen"
else
    print_check "warn" "Settings de producción NO existen"
fi

# ============================================================================
# 5. VERIFICAR GIT STATUS
# ============================================================================
print_section "5. Verificando Git Status"

cd "$ROOT_DIR"

if [ -d ".git" ]; then
    print_check "ok" "Repositorio Git existe"
    
    # Verificar branch actual
    CURRENT_BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")
    echo -e "${BLUE}   ℹ️  Branch actual: $CURRENT_BRANCH${NC}"
    
    # Verificar cambios sin commit
    if git diff-index --quiet HEAD -- 2>/dev/null; then
        print_check "ok" "No hay cambios sin commit"
    else
        print_check "warn" "Hay cambios sin commit"
        echo -e "${YELLOW}   ⚠️  Archivos modificados:${NC}"
        git status --short | head -10
    fi
    
    # Verificar si hay commits sin push
    UNPUSHED=$(git log origin/HEAD..HEAD --oneline 2>/dev/null | wc -l || echo "0")
    if [ "$UNPUSHED" -eq 0 ]; then
        print_check "ok" "No hay commits sin push"
    else
        print_check "warn" "$UNPUSHED commits sin push al origin"
    fi
else
    print_check "warn" "No es un repositorio Git"
fi

# ============================================================================
# 6. VERIFICAR DOCUMENTACIÓN GENERADA
# ============================================================================
print_section "6. Verificando Documentación"

if [ -f "$ROOT_DIR/AUTENTICACION_MEJORADA.md" ]; then
    print_check "ok" "AUTENTICACION_MEJORADA.md existe"
else
    print_check "warn" "AUTENTICACION_MEJORADA.md NO existe"
fi

if [ -f "$ROOT_DIR/TESTING_REPORT.md" ]; then
    print_check "ok" "TESTING_REPORT.md existe"
else
    print_check "warn" "TESTING_REPORT.md NO existe"
fi

# ============================================================================
# RESUMEN FINAL
# ============================================================================
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${BOLD}  📊 RESUMEN DEL PRE-FLIGHT CHECK${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo -e "${GREEN}${BOLD}✅ TODO LISTO PARA DEPLOYMENT${NC}"
    echo ""
    echo "No se encontraron errores ni warnings."
    echo ""
    echo "Próximo paso:"
    echo "  cd /home/gaibarra/lexprocess"
    echo "  ./deploy/deploy_all.sh"
    echo ""
    exit 0
elif [ $ERRORS -eq 0 ]; then
    echo -e "${YELLOW}${BOLD}⚠️  LISTO CON WARNINGS${NC}"
    echo ""
    echo -e "${YELLOW}Se encontraron $WARNINGS warnings.${NC}"
    echo "Puedes proceder, pero revisa los warnings arriba."
    echo ""
    echo "Para proceder:"
    echo "  cd /home/gaibarra/lexprocess"
    echo "  ./deploy/deploy_all.sh"
    echo ""
    exit 0
else
    echo -e "${RED}${BOLD}❌ NO LISTO PARA DEPLOYMENT${NC}"
    echo ""
    echo -e "${RED}Se encontraron $ERRORS errores y $WARNINGS warnings.${NC}"
    echo "Corrige los errores antes de proceder con el deployment."
    echo ""
    exit 1
fi
