FROM node:18-alpine

WORKDIR /app

# 複製 package 檔案
COPY package*.json ./

# 安裝依賴
RUN npm ci --only=production

# 複製應用程式程式碼
COPY . .

# 暴露端口
EXPOSE 4000

# 啟動應用程式
CMD ["npm", "start"] 