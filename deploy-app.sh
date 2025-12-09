#!/bin/bash
# Script de despliegue inicial de la aplicación
# Ejecutar después de instalar Docker, Docker Compose y Jenkins

set -e

# Colores para output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=========================================="
echo "Desplegando aplicación Hotel Management"
echo -e "==========================================${NC}"

# Crear directorio para la aplicación
APP_DIR="/home/ec2-user/integradora"

if [ -d "$APP_DIR" ]; then
    echo -e "${BLUE}El directorio ya existe. Actualizando...${NC}"
    cd "$APP_DIR"
    git pull
else
    echo -e "${BLUE}Clonando repositorio...${NC}"
    cd /home/ec2-user
    git clone https://github.com/OscarGDelPrado/IntegradoraCocker.git integradora
    cd "$APP_DIR"
fi

echo -e "${BLUE}Construyendo y levantando servicios...${NC}"
docker-compose up --build -d

echo -e "${GREEN}=========================================="
echo "¡Despliegue completado!"
echo -e "==========================================${NC}"
echo ""
echo "Servicios corriendo:"
echo "  - Frontend: http://$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4):3000"
echo "  - Backend API: http://$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4):8081"
echo "  - MySQL: puerto 3307"
echo ""
echo "Para ver los logs:"
echo "  docker compose logs -f"
echo ""
echo "Para detener los servicios:"
echo "  docker compose down"
