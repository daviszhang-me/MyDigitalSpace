#!/bin/bash
exec > >(tee /var/log/user-data.log|logger -t user-data -s 2>/dev/console) 2>&1

echo "Starting user data script..."

# Update system
yum update -y

# Install Docker
yum install -y docker
systemctl start docker
systemctl enable docker

# Install AWS CLI v2
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
./aws/install

# Create simple test page first
echo "<h1>KnowledgeHub - Coming Soon</h1><p>Setting up Docker container...</p>" > /var/www/index.html
python3 -m http.server 80 --directory /var/www &

# Wait a bit then try Docker
sleep 30

echo "Starting Docker setup..."

# Login to ECR
aws ecr get-login-password --region ap-southeast-1 | docker login --username AWS --password-stdin 801532171791.dkr.ecr.ap-southeast-1.amazonaws.com

if [ $? -eq 0 ]; then
    echo "ECR login successful"
    # Pull and run container
    docker pull 801532171791.dkr.ecr.ap-southeast-1.amazonaws.com/knowledgehub:latest
    if [ $? -eq 0 ]; then
        echo "Docker pull successful"
        # Stop simple server
        pkill -f "python3 -m http.server"
        # Run container
        docker run -d --restart unless-stopped -p 80:3001 --name knowledgehub 801532171791.dkr.ecr.ap-southeast-1.amazonaws.com/knowledgehub:latest
        echo "Container started"
    else
        echo "Docker pull failed"
    fi
else
    echo "ECR login failed"
fi

echo "User data script completed"