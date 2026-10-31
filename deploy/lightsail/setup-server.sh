#!/bin/sh
# Lightsail 主機首次開機時執行（建立主機時當作 launch script 傳入，以 root 身分跑一次）。
# Lightsail 會把它接在自己的 /bin/sh 初始化腳本後面執行，所以只能用 POSIX sh 語法。
# 安裝 Docker、加 2 GB swap（2 GB 記憶體主機在 build 前端時才不會不夠用）、建立部署目錄。
set -eu

apt-get update
DEBIAN_FRONTEND=noninteractive apt-get install -y docker.io docker-compose-v2 git
systemctl enable --now docker
usermod -aG docker ubuntu

if [ ! -f /swapfile ]; then
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

mkdir -p /opt/gym-system
chown ubuntu:ubuntu /opt/gym-system
