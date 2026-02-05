# 灵枢后端项目结构说明

## 项目概述

灵枢后端是一个基于 Cloudflare Workers 构建的轻量级后端服务，使用 Hono 框架实现高效的 RESTful API 服务。项目采用 TypeScript 编写，具有完整的类型安全性和现代化的开发体验。

## 目录结构详解

### 根目录文件

```
lingshu-backend/
├── .git/                    # Git 版本控制目录
├── .vscode/                 # VS Code 编辑器配置
├── .wrangler/              # Wrangler 工具缓存目录
├── doc/                    # 文档目录
├── drizzle/                # 数据库迁移文件目录
├── src/                    # 源代码主目录
├── node_modules/           # NPM 依赖包目录
├── .gitignore             # Git 忽略文件配置
├── package.json           # 项目依赖和脚本配置
├── package-lock.json      # NPM 锁定文件
├── tsconfig.json          # TypeScript 配置文件
├── wrangler.toml          # Wrangler 部署配置文件
├── wrangler.jsonc         # Wrangler 配置文件（备用）
├── drizzle.config.ts      # Drizzle ORM 配置文件
├── worker-configuration.d.ts # Cloudflare Workers 类型定义文件
├── README.md              # 项目简介
├── QUICKSTART.md          # 快速开始指南
├── SYSTEM-GUIDE.md        # 系统使用指南
├── IMPLEMENTATION-SUMMARY.md # 实现总结
├── COMPLETION-REPORT.md   # 完成报告
└── TEST-INTEGRATION.md    # 测试集成文档
```

### 核心配置文件说明

#### `package.json`
项目的核心配置文件，定义了：
- **项目信息**: 名称、模块类型等基础信息
- **脚本命令**: 
  - `dev`: 本地开发模式启动
  - `deploy`: 部署到 Cloudflare
  - `cf-typegen`: 生成 Cloudflare 绑定类型
- **依赖包**: 
  - `hono`: Web 框架
  - `drizzle-orm`: 数据库 ORM
  - `bcryptjs`: 密码加密
  - `wrangler`: Cloudflare 部署工具

#### `wrangler.toml`
Cloudflare Workers 部署配置文件：
- **基础配置**: 应用名称、入口文件、兼容性日期
- **环境变量**: JWT 密钥配置
- **数据库绑定**: D1 数据库连接配置
- **开发设置**: 本地开发服务器配置

#### `tsconfig.json`
TypeScript 编译配置：
- 启用严格模式
- ESModule 模块系统
- 目标环境配置

#### `drizzle.config.ts`
Drizzle ORM 数据库配置：
- 数据库连接设置
- 迁移文件目录配置

## 源代码结构 (`src/`)

### 主入口文件

#### `src/index.ts`
应用的主入口文件，负责：
- 初始化 Hono 应用实例
- 配置全局中间件（CORS、JWT 认证）
- 注册所有路由模块
- 提供健康检查和根路径接口

**主要功能**:
- 跨域支持配置
- JWT 认证中间件（保护 `/api/*` 路由）
- 路由模块注册
- 健康检查端点 (`/health`)
- API 文档端点 (`/`)

### 数据库层

#### `src/schema.ts`
数据库表结构定义文件，包含以下表：

1. **users 表**: 用户信息表
   - 基础认证字段（用户名、手机号、密码）
   - 配额管理系统（每日免费次数、额外配额）
   - 会员等级系统（会员级别、过期时间）
   - 推荐系统（推荐人ID）
   - 风控字段（设备指纹）

2. **cases 表**: 卦例存储表
   - 用户关联的排卦案例
   - 卦象数据存储（JSON格式）
   - 标题和笔记字段

3. **divinationRecords 表**: 排卦记录表
   - 用于5分钟内重复请求去重
   - 存储脱敏后的起卦参数
   - 时间戳记录

4. **referralRewards 表**: 推荐奖励日志表
   - 记录推荐关系
   - 奖励类型和数量统计

### 业务模块

#### `src/auth/` - 认证模块
**文件**: `index.ts`

**功能职责**:
- 用户登录认证
- 手机号绑定
- JWT Token 生成和验证
- 密码加密处理

**API 端点**:
- `POST /auth/login`: 用户登录
- `POST /auth/bind-phone`: 手机号绑定

#### `src/member/` - 会员与配额模块

##### `quota.ts`
**功能职责**:
- 会员配额管理
- 积分兑换系统
- 配额使用记录查询

**API 端点**:
- `POST /api/member/exchange`: 积分兑换配额
- `GET /api/member/status`: 查询会员状态

##### `referral.ts`
**功能职责**:
- 用户推荐系统
- 推荐奖励发放
- 推荐关系管理

**API 端点**:
- `GET /api/referral/rewards`: 查询推荐奖励

#### `src/divination/` - 排卦业务模块

##### `quota-check.ts`
**功能职责**:
- 排卦配额检查
- 重复请求去重
- 排卦历史记录

**API 端点**:
- `POST /api/divination/check-quota`: 检查配额
- `POST /api/divination/divine`: 执行排卦
- `GET /api/divination/history`: 查询排卦历史

#### `src/utils/` - 工具模块

##### `response.ts`
**功能职责**:
- 统一响应格式封装
- 成功/失败响应构造函数
- 错误码标准化

##### `types.ts`
**功能职责**:
- 公共类型定义
- 接口类型声明
- 枚举类型定义

## 数据库迁移目录 (`drizzle/`)

### SQL 迁移文件
- `0000_moaning_susan_delgado.sql`: 初始数据库结构
- `0001_adorable_sally_floyd.sql`: 第一次数据结构调整
- `0001_extended_schema.sql`: 扩展的表结构定义
- `init.sql`: 数据库初始化脚本

### 元数据目录 (`meta/`)
- 存储迁移历史记录
- 快照文件管理
- 迁移版本追踪

## 文档目录 (`doc/`)

### 现有文档
- `index.md`: 现有的文档索引文件

### 新增文档（本文档）
- `project-structure.md`: 项目结构详细说明（当前文件）

## 开发工具配置

### `.vscode/`
VS Code 编辑器配置目录，包含：
- 推荐扩展配置
- 调试配置
- 代码格式化设置

### `.wrangler/`
Wrangler 工具运行时缓存目录，包含：
- 本地开发环境缓存
- 构建产物临时文件

## 部署相关

### 环境配置
项目支持多种环境部署：
- **本地开发**: 使用 `wrangler dev --local`
- **远程开发**: 使用 `wrangler dev --remote`  
- **生产部署**: 使用 `wrangler deploy`

### 数据库配置
- **开发环境**: 使用本地模拟数据库
- **生产环境**: 连接真实的 Cloudflare D1 数据库

## 项目特点

1. **边缘计算架构**: 基于 Cloudflare Workers，全球就近访问
2. **类型安全**: 完整的 TypeScript 类型系统
3. **模块化设计**: 功能模块清晰分离
4. **现代化工具链**: 使用最新的开发工具和框架
5. **安全性**: JWT 认证、密码加密、风控机制
6. **可观测性**: 健康检查端点、详细的日志记录

## 开发流程

1. **环境准备**: 安装依赖 `npm install`
2. **本地开发**: 运行 `npm run dev`
3. **类型生成**: 运行 `npm run cf-typegen`
4. **部署上线**: 运行 `npm run deploy`

这个项目结构体现了现代 Serverless 应用的最佳实践，具有良好的可维护性和扩展性。