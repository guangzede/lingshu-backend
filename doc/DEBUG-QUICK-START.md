# 🎯 调试实战演示

## 现在就开始调试！（5分钟快速上手）

你的项目已经配置好了日志系统，让我教你如何使用。

---

## 第一步：启动服务器（10秒）

打开 VS Code 终端（Terminal → New Terminal），运行：

```bash
npm run dev
```

你会看到：

```
⎔ Starting local server...
[wrangler:info] Ready on http://localhost:8788
```

✅ **看到这个就说明服务器启动成功了！**

---

## 第二步：用 APIFox 发送测试请求（30秒）

### 测试 1: 注册新用户

**请求配置：**

- 方法：`POST`
- URL：`http://localhost:8788/auth/register`
- Headers：`Content-Type: application/json`
- Body (JSON)：

```json
{
  "username": "testuser123",
  "password": "MyPassword123",
  "phone": "13900139999"
}
```

**点击发送后，立即回到 VS Code 终端！**

---

## 第三步：查看实时日志（1分钟）

你会在 VS Code 终端看到类似这样的输出：

```
[AUTH REGISTER] 开始注册: { username: 'testuser123', phone: '13900139999' }
[AUTH REGISTER] 用户注册成功: { userId: 7, username: 'testuser123', createdAt: 1770275123456 }
[wrangler:info] POST /auth/register 200 OK (85ms)
```

🎉 **恭喜！你已经成功看到调试日志了！**

---

## 第四步：测试登录（再1分钟）

**请求配置：**

- 方法：`POST`
- URL：`http://localhost:8788/auth/login`
- Headers：`Content-Type: application/json`
- Body (JSON)：

```json
{
  "username": "testuser123",
  "password": "MyPassword123"
}
```

**终端会显示：**

```
[AUTH LOGIN] 尝试登录: { username: 'testuser123' }
[AUTH LOGIN] 用户登录成功: { userId: 7, username: 'testuser123' }
[wrangler:info] POST /auth/login 200 OK (62ms)
```

---

## 第五步：测试错误情况（再1分钟）

### 测试错误密码

发送登录请求，但密码改成 `WrongPassword`

**终端会显示：**

```
[AUTH LOGIN] 尝试登录: { username: 'testuser123' }
▲ [WARNING] [AUTH LOGIN] 密码验证失败: { username: 'testuser123' }
[wrangler:info] POST /auth/login 401 Unauthorized (58ms)
```

看到了吗？日志清楚地告诉你：

- ✅ 用户存在
- ❌ 密码验证失败

---

## 🔍 如何添加自己的调试日志？

### 示例：我想知道密码哈希的长度

打开 `src/auth/index.ts`，找到登录接口中的密码验证部分，添加日志：

```typescript
// 验证密码
console.log('🔐 [DEBUG] 开始验证密码');
console.log('🔐 [DEBUG] 输入密码长度:', password.length);
console.log('🔐 [DEBUG] 数据库哈希长度:', user.password.length);

if (!compareSync(password, user.password)) {
  console.warn('❌ [AUTH LOGIN] 密码验证失败:', { username });
  return c.json(
    errorResponse('用户名或密码错误'),
    401
  );
}

console.log('✅ [DEBUG] 密码验证通过！');
```

**保存文件后**，Wrangler 会自动重启：

```
⎔ Reloading local server...
⎔ Local server updated and ready
```

再发送请求，你就会看到新增的调试信息：

```
🔐 [DEBUG] 开始验证密码
🔐 [DEBUG] 输入密码长度: 13
🔐 [DEBUG] 数据库哈希长度: 60
✅ [DEBUG] 密码验证通过！
```

---

## 🎯 常用调试场景

### 场景 1: 查看收到的完整请求数据

```typescript
authRouter.post('/login', async (c) => {
  console.log('═══════════════════════════════');
  console.log('📥 收到新的登录请求');
  console.log('时间:', new Date().toLocaleString('zh-CN'));
  console.log('═══════════════════════════════');
  
  const body = await c.req.json();
  console.log('📦 请求体:', JSON.stringify(body, null, 2));
  
  // 查看所有请求头
  console.log('📋 请求头:');
  c.req.headers.forEach((value, key) => {
    console.log(`  ${key}: ${value}`);
  });
  
  // ... 继续你的代码
});
```

### 场景 2: 调试数据库查询

```typescript
try {
  console.log('🔍 [DB] 开始查询用户:', username);
  console.time('database-query'); // 开始计时
  
  user = await db
    .select()
    .from(users)
    .where(eq(users.username, username))
    .get();
  
  console.timeEnd('database-query'); // 结束计时，自动显示用时
  console.log('📊 [DB] 查询结果:', user ? `✅ 找到用户 ID: ${user.id}` : '❌ 用户不存在');
} catch (dbError: any) {
  console.error('💥 [DB] 查询失败:', dbError);
  // ...
}
```

### 场景 3: 追踪整个请求流程

```typescript
const requestId = Math.random().toString(36).substr(2, 9);
console.log(`🆔 [${requestId}] 新请求开始`);

try {
  console.log(`🔍 [${requestId}] 步骤 1: 解析请求体`);
  const body = await c.req.json();
  
  console.log(`🔍 [${requestId}] 步骤 2: 查询用户`);
  const user = await db.select()...
  
  console.log(`🔍 [${requestId}] 步骤 3: 验证密码`);
  if (!compareSync(password, user.password)) {
    console.log(`❌ [${requestId}] 密码错误`);
    return ...
  }
  
  console.log(`🔍 [${requestId}] 步骤 4: 生成 Token`);
  const token = await sign(...);
  
  console.log(`✅ [${requestId}] 请求成功完成`);
  return c.json(...);
} catch (error) {
  console.error(`💥 [${requestId}] 请求失败:`, error);
}
```

---

## 🛠️ 实用技巧

### 技巧 1: 使用颜色和图标区分日志

```typescript
console.log('✅ 成功');      // 绿色对勾
console.log('❌ 失败');      // 红色叉
console.log('⚠️  警告');     // 黄色感叹号
console.log('🔍 调试');      // 放大镜
console.log('📦 数据');      // 包裹
console.log('🔐 安全');      // 锁
console.log('💾 数据库');    // 磁盘
console.log('🚀 启动');      // 火箭
console.log('💥 错误');      // 爆炸
```

### 技巧 2: 条件调试

只在特定用户时输出详细日志：

```typescript
const DEBUG_USER = 'testuser123';

if (username === DEBUG_USER) {
  console.log('🐛 [DEBUG MODE] 完整用户数据:', {
    id: user.id,
    username: user.username,
    phone: user.phone,
    memberLevel: user.memberLevel,
    createdAt: new Date(user.createdAt).toLocaleString('zh-CN')
  });
}
```

### 技巧 3: 对象美化输出

```typescript
// 不好的做法
console.log('用户:', user); // 输出: 用户: [Object]

// 好的做法
console.log('用户:', JSON.stringify(user, null, 2));
// 输出:
// 用户: {
//   "id": 6,
//   "username": "testuser",
//   ...
// }
```

### 技巧 4: 性能监控

```typescript
console.time('登录总耗时');
console.time('数据库查询');
const user = await db.select()...
console.timeEnd('数据库查询'); // 输出: 数据库查询: 45ms

console.time('密码验证');
const valid = compareSync(password, user.password);
console.timeEnd('密码验证'); // 输出: 密码验证: 12ms

console.timeEnd('登录总耗时'); // 输出: 登录总耗时: 67ms
```

---

## 📝 练习任务

### 任务 1: 添加注册流程完整日志（5分钟）

在注册接口中添加：

1. 收到请求的日志
2. 每个验证步骤的日志
3. 数据库操作的日志
4. 成功/失败的日志

### 任务 2: 找出密码验证慢的原因（10分钟）

1. 在密码验证前后添加 `console.time()` 和 `console.timeEnd()`
2. 发送 10 次登录请求
3. 观察每次的耗时
4. 分析哪个步骤最慢

### 任务 3: 调试一个 Bug（15分钟）

模拟场景：用户反馈"登录失败但不知道原因"

1. 在登录接口的每个可能失败的地方添加详细日志
2. 故意用错误数据测试（错误用户名、错误密码、缺少参数）
3. 通过日志快速定位问题

---

## ❓ 常见问题解答

### Q: 日志太多了，怎么只看我关心的？

**A:** 在 VS Code 终端使用搜索功能：

1. 按 `Ctrl+F` (Mac: `Cmd+F`)
2. 输入你的日志前缀，比如 `[DEBUG]`
3. 使用上下箭头跳转

### Q: 能不能把日志保存到文件？

**A:** 可以！启动时重定向：

```bash
npm run dev 2>&1 | tee debug.log
```

所有日志会同时显示在终端和保存到 `debug.log` 文件。

### Q: 生产环境也会打印这些日志吗？

**A:** 是的，但在 Cloudflare 上你需要在 Dashboard 查看。开发时建议用环境变量控制：

```typescript
const isDev = process.env.NODE_ENV !== 'production';

if (isDev) {
  console.log('🐛 [DEV] 调试信息');
}
```

### Q: 为什么有些日志看不到？

**A:** 检查：

1. 代码是否保存了？
2. 服务器是否重新加载了？（看到 `⎔ Reloading local server...`）
3. 请求是否真的发送到了正确的接口？

---

## 🎉 恭喜

你现在已经掌握了：

- ✅ 如何启动开发服务器
- ✅ 如何查看实时日志
- ✅ 如何添加自己的调试日志
- ✅ 如何使用日志定位问题

**下一步建议：**

1. 在你的代码中多添加日志
2. 发送各种测试请求
3. 观察日志输出
4. 逐步掌握调试技巧

记住：**console.log 是最简单、最直接、最有效的调试方法！** 🚀
