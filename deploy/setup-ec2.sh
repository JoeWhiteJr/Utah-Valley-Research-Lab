#!/bin/bash
# Stats Lab Manager - EC2 Setup Script
# Run this on a fresh Amazon Linux 2023 or Ubuntu 22.04 EC2 instance

set -e

echo "=========================================="
echo "Stats Lab Manager - EC2 Setup"
echo "=========================================="

# Detect OS
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$ID
else
    echo "Cannot detect OS. Exiting."
    exit 1
fi

echo "Detected OS: $OS"

# Install Docker based on OS
install_docker() {
    if command -v docker &> /dev/null; then
        echo "Docker already installed"
        return
    fi

    echo "Installing Docker..."

    if [ "$OS" = "amzn" ]; then
        # Amazon Linux 2023
        sudo dnf update -y
        sudo dnf install -y docker
        sudo systemctl start docker
        sudo systemctl enable docker
    elif [ "$OS" = "ubuntu" ]; then
        # Ubuntu
        sudo apt-get update
        sudo apt-get install -y ca-certificates curl gnupg
        sudo install -m 0755 -d /etc/apt/keyrings
        curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
        sudo chmod a+r /etc/apt/keyrings/docker.gpg
        echo \
          "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
          $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
          sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
        sudo apt-get update
        sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    else
        echo "Unsupported OS: $OS"
        exit 1
    fi

    # Add current user to docker group
    sudo usermod -aG docker $USER
    echo "Docker installed. You may need to log out and back in for group changes."
}

# Install Docker Compose
install_docker_compose() {
    if command -v docker-compose &> /dev/null; then
        echo "Docker Compose already installed"
        return
    fi

    echo "Installing Docker Compose..."

    sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose

    echo "Docker Compose installed: $(docker-compose --version)"
}

# Install git if needed
install_git() {
    if command -v git &> /dev/null; then
        echo "Git already installed"
        return
    fi

    echo "Installing Git..."
    if [ "$OS" = "amzn" ]; then
        sudo dnf install -y git
    elif [ "$OS" = "ubuntu" ]; then
        sudo apt-get install -y git
    fi
}

# Run installations
install_docker
install_docker_compose
install_git

echo ""
echo "=========================================="
echo "Setup Complete!"
echo "=========================================="
echo ""
echo "Next steps:"
echo "1. Log out and back in (for docker group)"
echo "2. Clone the repository:"
echo "   git clone https://github.com/JoeWhiteJr/stats-lab-manager.git"
echo "   cd stats-lab-manager"
echo ""
echo "3. Create your .env file:"
echo "   cp deploy/.env.example .env"
echo "   nano .env  # Edit with your values"
echo ""
echo "4. Start the application:"
echo "   docker-compose -f docker-compose.ec2.yml up -d --build"
echo ""
echo "5. Run database migrations:"
echo "   ./deploy/migrate.sh"
echo ""
echo "6. Access the app at: http://YOUR_ELASTIC_IP"
echo ""
