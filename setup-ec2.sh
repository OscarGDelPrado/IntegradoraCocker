#!/bin/bash
# Script de instalación para EC2 Amazon Linux 2
# Este script instala Docker, Docker Compose, Git y Jenkins

set -e

echo "=========================================="
echo "Instalando dependencias del sistema..."
echo "=========================================="
sudo yum update -y

# Instalar Git
echo "Instalando Git..."
sudo yum install -y git

# Instalar Docker
echo "Instalando Docker..."
sudo yum install -y docker
sudo systemctl start docker
sudo systemctl enable docker
sudo usermod -aG docker ec2-user

# Instalar Docker Compose
echo "Instalando Docker Compose..."
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Instalar Java (requerido para Jenkins)
echo "Instalando Java..."
sudo yum install -y java-17-amazon-corretto-headless

# Instalar Jenkins
echo "Instalando Jenkins..."
sudo wget -O /etc/yum.repos.d/jenkins.repo https://pkg.jenkins.io/redhat-stable/jenkins.repo
sudo rpm --import https://pkg.jenkins.io/redhat-stable/jenkins.io-2023.key
sudo yum install -y jenkins
sudo systemctl start jenkins
sudo systemctl enable jenkins

# Agregar usuario jenkins al grupo docker
sudo usermod -aG docker jenkins
sudo systemctl restart jenkins

# Configurar firewall (si firewalld está activo)
if sudo systemctl is-active --quiet firewalld; then
    echo "Configurando firewall..."
    sudo firewall-cmd --permanent --add-port=8080/tcp
    sudo firewall-cmd --permanent --add-port=3000/tcp
    sudo firewall-cmd --permanent --add-port=8081/tcp
    sudo firewall-cmd --reload
fi

echo "=========================================="
echo "Instalación completada!"
echo "=========================================="
echo ""
echo "Jenkins está corriendo en: http://<TU-IP-PUBLICA>:8080"
echo "Para obtener la contraseña inicial de Jenkins ejecuta:"
echo "sudo cat /var/lib/jenkins/secrets/initialAdminPassword"
echo ""
echo "IMPORTANTE: Cierra sesión y vuelve a iniciarla para que los cambios de grupo tomen efecto:"
echo "exit"
echo "ssh -i tu-llave.pem ec2-user@tu-ip"
echo ""
echo "Puertos necesarios en Security Group de AWS:"
echo "  - 22 (SSH)"
echo "  - 8080 (Jenkins)"
echo "  - 3000 (Frontend)"
echo "  - 8081 (Backend API)"
