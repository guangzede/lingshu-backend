# 🐛 Cloudflare Workers 调试完整指南

## 重要说明 ⚠️

**为什么 9229 端口返回 404？**

Cloudflare Workers 使用 **Workerd 运行时**（不是标准 Node.js），所以传统的 Node.js 调试方式（如 --inspect）**不直接适用**。你访问的 9229 端口是 wrangler 启动的，但它不提供 HTTP 接口。

---

## 📋 调试方案对比

| 方案 | 难度 | 推荐度 | 适用场景 |
|------|------|--------|---------|
| 1. Console.log | ⭐ 最简单 | ⭐⭐⭐⭐⭐ | 日常开发（推荐） |
| 2. Chrome DevTools | ⭐⭐ 简单 | ⭐⭐⭐⭐ | 查看请求详情 |
| 3. VS Code 断点调试 | ⭐⭐⭐ 中等 | ⭐⭐⭐ | 复杂逻辑调试 |

---

## 🎯 方案 1: Console.log 调试（最推荐给新手）

### 步骤 1: 在代码中添加 console.log

打开 `src/auth/index.ts`，在你想调试的地方添加日志：

```typescript
authRouter.post('/login', async (c) => {
  console.log('===== 登录接口被调用 =====');
  
  const db = drizzle(c.env.lingshu_db);
  let body;

  try {
    body = await c.req.json().catch(() => null);
    console.log('📦 收到的请求体:', JSON.stringify(body, null, 2));
  } catch (parseError: any) {
    console.error('❌ JSON 解析失败:', parseError);
    return c.json(errorResponse('请求体格式错误'), 400);
  }

  if (!body || !body.username || !body.password) {
    console.log('⚠️  参数验证失败');
    return c.json(errorResponse('缺少必要参数：username、password'), 400);
  }

  const { username, password } = body;
  console.log('👤 尝试登录用户:', username);

  try {
    // 查询用户
    let user;
    try {
      console.log('🔍 查询数据库...');
      user = await db
        .select()
        .from(users)
        .where(eq(users.username, username))
        .get();
      
      console.log('📊 查询结果:', user ? `找到用户 ID: ${user.id}` : '用户不存在');
    } catch (dbError: any) {
      console.error('❌ 数据库查询失败:', dbError);
      return c.json(errorResponse('数据库连接失败，请稍后重试'), 500);
    }

    // 验证密码
    if (!user) {
      console.warn('⚠️  用户不存在:', username);
      return c.json(errorResponse('用户名或密码错误'), 401);
    }

    console.log('🔐 验证密码...');
    if (!compareSync(password, user.password)) {
      console.warn('❌ 密码验证失败:', username);
      return c.json(errorResponse('用户名或密码错误'), 401);
    }

    console.log('✅ 登录成功! 用户ID:', user.id);
    
    // ... 后续代码
  } catch (error: any) {
    console.error('💥 未知错误:', error);
    return c.json(errorResponse('登录失败，请稍后重试'), 500);
  }
});
```

### 步骤 2: 启动服务器

```bash
npm run dev
```

### 步骤 3: 发送请求（用 APIFox）

发送请求到 `http://localhost:8788/auth/login`

### 步骤 4: 查看日志

在 **VS Code 终端** 中会实时看到所有 console.log 输出：

```
===== 登录接口被调用 =====
📦 收到的请求体: {
  "username": "testuser",
  "password": "123456"
}
👤 尝试登录用户: testuser
🔍 查询数据库...
📊 查询结果: 找到用户 ID: 6
🔐 验证密码...
✅ 登录成功! 用户ID: 6
```

---

## 🌐 方案 2: Chrome DevTools 调试

### 步骤 1: 启动开发服务器（带调试模式）

```bash
npm run dev
```

### 步骤 2: 查看启动日志

你会看到类似这样的信息：

```
⎔ Starting local server...
[wrangler:info] Ready on http://localhost:8788
🪵  Logs:
  - http://localhost:8788/__logs
```

### 步骤 3: 打开 Chrome DevTools

**方法 A: 通过 chrome://inspect**

1. 打开 Chrome 浏览器
2. 地址栏输入：`chrome://inspect`
3. 点击 "Open dedicated DevTools for Node"
4. 在 Sources 标签中找到你的代码文件
5. 设置断点
6. 用 APIFox 发送请求

**方法 B: 通过日志页面**

1. 浏览器访问：`http://localhost:8788/__logs`
2. 查看实时日志

---

## 🔧 方案 3: VS Code 断点调试（高级）

⚠️ **注意**：Cloudflare Workers 的断点调试比较复杂，不如 console.log 直观。

### 配置文件已创建

我已经为你准备好了 `.vscode/launch.json`，但是要注意：

**这个配置主要用于调试 wrangler 本身**，不是调试你的 Worker 代码。

### 如果要在 VS Code 中调试 Worker 代码

1. 安装 Chrome 插件后，使用方案 2
2. 或者使用 VS Code 的 "JavaScript Debug Terminal"

---

## 📝 实用调试技巧

### 技巧 1: 结构化日志

```typescript
// 好的做法
console.log('🔍 [AUTH LOGIN] 开始处理', { 
  username, 
  timestamp: Date.now() 
});

// 不好的做法
console.log('login', username);
```

### 技巧 2: 使用不同的日志级别

```typescript
console.log('ℹ️  信息日志');      // 普通信息
console.warn('⚠️  警告日志');     // 警告
console.error('❌ 错误日志');     // 错误
console.debug('🔍 调试日志');     // 调试信息（需要设置日志级别）
```

### 技巧 3: 捕获完整错误信息

```typescript
catch (error: any) {
  console.error('❌ 错误详情:', {
    message: error?.message,
    stack: error?.stack,
    name: error?.name,
    cause: error?.cause
  });
}
```

### 技巧 4: 计时器

```typescript
console.time('database-query');
const user = await db.select()...
console.timeEnd('database-query'); // 输出: database-query: 45ms
```

### 技巧 5: 条件断点（用代码实现）

```typescript
if (username === 'debug_user') {
  console.log('🐛 调试模式激活', { 
    user, 
    password: '***', 
    headers: c.req.headers 
  });
}
```

---

## 🎬 快速开始：3 分钟上手调试

### 1. 添加基础日志（30秒）

在 `src/auth/index.ts` 的登录接口开头添加：

```typescript
authRouter.post('/login', async (c) => {
  console.log('🚀 [LOGIN] 收到登录请求');
  const body = await c.req.json();
  console.log('📦 [LOGIN] 请求数据:', body);
  
  // ... 你的代码
  
  console.log('✅ [LOGIN] 登录成功');
  return c.json(...);
});
```

### 2. 启动服务器（10秒）

```bash
npm run dev
```

### 3. 发送请求并查看日志（1分钟）

- 用 APIFox 发送请求
- 立即在 VS Code 终端看到日志输出

### 4. 根据日志定位问题（1分钟）

看日志找到问题出现在哪一步，然后在那附近添加更详细的日志。

---

## 🆘 常见问题

### Q1: 为什么我的 console.log 没有显示？

**A:** 确保：

1. 服务器正在运行（`npm run dev`）
2. 查看的是正确的终端窗口
3. 代码已经保存（Wrangler 会自动重载）

### Q2: 如何只看我关心的日志？

**A:** 使用特殊前缀：

```typescript
console.log('[MY-DEBUG]', '这是我的调试信息');
```

然后在终端用 `Ctrl+F` 搜索 `[MY-DEBUG]`

### Q3: 日志太多了怎么办？

**A:** 使用环境变量控制：

```typescript
const DEBUG = process.env.DEBUG === 'true';

if (DEBUG) {
  console.log('🐛 调试信息');
}
```

启动时：`DEBUG=true npm run dev`

### Q4: 能不能像 Node.js 一样用断点？

**A:** Cloudflare Workers 不能像普通 Node.js 那样用 VS Code 断点。最佳实践是：

- 开发阶段：使用 console.log
- 复杂问题：使用 Chrome DevTools
- 生产环境：使用 Cloudflare 的日志服务

---

## 📚 推荐学习路径

1. **先掌握 console.log 调试**（1-2 天）
2. **学习 Chrome DevTools**（3-5 天）
3. **探索 Wrangler 日志工具**（1 周后）
4. **生产环境监控**（项目上线后）

---

## 💡 最佳实践

### ✅ 推荐做法

```typescript
// 1. 使用表情符号区分日志级别
console.log('✅ 成功');
console.warn('⚠️  警告');
console.error('❌ 错误');

// 2. 包含上下文信息
console.log('[AUTH LOGIN]', { username, timestamp: Date.now() });

// 3. 结构化输出
console.log('用户信息:', JSON.stringify(user, null, 2));

// 4. 使用分组
console.group('登录流程');
console.log('1. 验证参数');
console.log('2. 查询数据库');
console.log('3. 验证密码');
console.groupEnd();
```

### ❌ 不推荐做法

```typescript
// 1. 没有上下文
console.log('ok');

// 2. 输出敏感信息
console.log('密码:', password); // ❌ 危险！

// 3. 日志太多
for (let i = 0; i < 1000; i++) {
  console.log(i); // ❌ 日志爆炸
}
```

---

## 🎯 实战练习

### 练习 1: 添加登录流程日志

1. 在登录接口的每个关键步骤添加 console.log
2. 发送正确的请求，观察完整流程
3. 发送错误的请求，看哪一步失败

### 练习 2: 调试密码验证

```typescript
console.log('🔐 密码验证开始');
console.log('输入的密码长度:', password.length);
console.log('数据库密码哈希:', user.password.substring(0, 20) + '...');

const isValid = compareSync(password, user.password);
console.log('验证结果:', isValid ? '✅ 通过' : '❌ 失败');
```

### 练习 3: 性能监控

```typescript
console.time('complete-login');

console.time('database-query');
const user = await db.select()...
console.timeEnd('database-query');

console.time('password-verify');
const isValid = compareSync(password, user.password);
console.timeEnd('password-verify');

console.timeEnd('complete-login');
```

---

## 📞 需要帮助？

如果你遇到问题：

1. 先检查 console.log 是否正确添加
2. 确认服务器是否运行
3. 查看终端是否有错误信息
4. 在项目中搜索类似的日志代码作为参考

祝你调试顺利！🎉
