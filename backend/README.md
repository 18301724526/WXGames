# 《文明火种》后端服务

Node.js + Express + SQLite 后端骨架，全服务端计算架构。

## 技术栈

- **API服务**: Node.js + Express
- **数据库**: SQLite (better-sqlite3)
- **认证**: JWT
- **进程管理**: PM2

## 目录结构

```
backend/
├── server.js          # 主入口
├── package.json       # 依赖配置
├── .env.example       # 环境变量模板
├── .gitignore         # Git忽略规则
├── deploy.sh          # 部署脚本
├── data/              # 数据库目录（运行时创建）
└── node_modules/      # 依赖（npm install后）
```

## API接口

### 玩家认证

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/player/register | 注册新玩家 {deviceId} |
| POST | /api/player/login | 登录 {deviceId} |

### 游戏状态

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/game/state | 获取游戏状态（心跳，含离线收益计算） |
| POST | /api/game/action | 玩家操作（建造/分配/研发/进阶/招募/事件选择） |
| POST | /api/game/offline | 离线上报，记录快照 |

### 事件

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/game/events | 获取事件列表 |
| POST | /api/game/event/choose | 选择事件选项 |

### 系统

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/health | 健康检查 |

## 操作类型

```javascript
// 建造
{ action: "build", target: "farm" }

// 分配人口
{ action: "assign", profession: "farmer", count: 1 }

// 研发科技
{ action: "research", tech: "钻木取火" }

// 时代进阶
{ action: "advanceEra" }

// 手动招募
{ action: "recruit" }

// 选择事件选项
{ action: "chooseEvent", eventId: "xxx" }
```

## 本地开发

```bash
npm install
npm run dev
```

## 部署到服务器

```bash
# 需要配置SSH密钥访问 47.116.32.216
bash deploy.sh
```

或手动部署：

```bash
# 在服务器上
mkdir -p /opt/wxgame-workspace/backend
cd /opt/wxgame-workspace/backend
npm install
npm start
```

## Nginx 反向代理配置

```nginx
location /api/ {
    proxy_pass http://localhost:3000/api/;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_cache_bypass $http_upgrade;
}
```
