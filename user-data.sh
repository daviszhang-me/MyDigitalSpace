#!/bin/bash
yum update -y
yum install -y docker
systemctl start docker
systemctl enable docker

# Install AWS CLI v2
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
./aws/install

# Login to ECR and run container
aws ecr get-login-password --region ap-southeast-1 | docker login --username AWS --password-stdin 801532171791.dkr.ecr.ap-southeast-1.amazonaws.com
docker pull 801532171791.dkr.ecr.ap-southeast-1.amazonaws.com/knowledgehub:latest
docker run -d --restart unless-stopped -p 80:3001 --name knowledgehub 801532171791.dkr.ecr.ap-southeast-1.amazonaws.com/knowledgehub:latest