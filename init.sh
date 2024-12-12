#!/bin/bash

cd /home/ec2-user/proxy-service
npm install

PM2_PATH=$(which pm2)
PM2_DIR=$(dirname "$PM2_PATH")

# Restart the application using pm2
pm2 stop index.js
pm2 start index.js

# Make pm2 resurrect on reboot
sudo env PATH=$PATH:$PM2_DIR pm2 startup systemd -u ec2-user --hp /home/ec2-user
pm2 save