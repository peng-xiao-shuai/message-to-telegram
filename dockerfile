# 使用官方的 Node.js 镜像作为基础镜像
FROM node:18

# 创建和设置工作目录
WORKDIR /usr/src/app

# 复制 package.json 和 package-lock.json
COPY package*.json ./

# 安装依赖
RUN npm install

# 复制项目文件
COPY . .

# 构建项目
RUN npm run build

# 暴露端口
# EXPOSE 3000

# 启动应用
CMD ["npm", "start"]
