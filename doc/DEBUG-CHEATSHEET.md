# 🎯 调试快速参考卡

## 启动服务器

```bash
npm run dev
```

看到 `Ready on http://localhost:8788` 就成功了！

## 查看日志的位置

👉 **VS Code 底部的终端窗口**

## 发送测试请求

**APIFox 配置：**

- URL: `http://localhost:8788/auth/login`
- 方法: `POST`
- Header: `Content-Type: application/json`
- Body:

```json
{
  "username": "testuser",
  "password": "password123"
}
```

## 添加调试日志（最常用）

### 基础日志

```typescript
console.log('✅ 成功信息');
console.warn('⚠️  警告信息');
console.error('❌ 错误信息');
```

### 查看变量

```typescript
console.log('用户名:', username);
console.log('完整数据:', JSON.stringify(user, null, 2));
```

### 性能计时

```typescript
console.time('操作名称');
// ... 你的代码
console.timeEnd('操作名称'); // 自动显示耗时
```

### 追踪流程

```typescript
console.log('🔍 步骤 1: 解析参数');
console.log('🔍 步骤 2: 查询数据库');
console.log('🔍 步骤 3: 验证密码');
console.log('✅ 完成！');
```

## 常用图标

```
✅ 成功    ❌ 失败    ⚠️  警告
🔍 查询    📦 数据    🔐 密码
💾 数据库  🚀 启动    💥 错误
📝 注册    👤 用户    🎯 目标
```

## 日志搜索技巧

**在 VS Code 终端中：**

1. 按 `Ctrl+F` (Mac: `Cmd+F`)
2. 输入关键词（如 `[AUTH LOGIN]`）
3. 用上下箭头跳转

## 自动重载

保存代码后，会看到：

```
⎔ Reloading local server...
⎔ Local server updated and ready
```

## 测试脚本

快速测试所有功能：

```bash
./test-debug.sh
```

## 为什么 9229 返回 404？

**简单回答：** Cloudflare Workers 不用传统的 Node.js 调试方式。

**正确做法：**

1. 用 `console.log` 查看日志（推荐）
2. 用 Chrome DevTools（高级）
3. 查看 `http://localhost:8788/__logs`

## 最常见的 3 个问题

### 1. 看不到日志？

✅ 检查代码是否保存
✅ 检查服务器是否运行
✅ 检查是否在正确的终端窗口

### 2. 日志太多？

✅ 使用 `[标签]` 前缀
✅ 使用搜索功能 (Ctrl+F)
✅ 使用条件日志（只在特定情况打印）

### 3. 想看详细数据？

✅ 用 `JSON.stringify(data, null, 2)`
✅ 用 `console.table(array)` 显示表格
✅ 用 `console.dir(object, {depth: null})` 显示深层对象

## 实战示例

### 调试登录失败

```typescript
authRouter.post('/login', async (c) => {
  console.log('🚀 [LOGIN] 开始处理登录请求');
  
  const body = await c.req.json();
  console.log('📦 [LOGIN] 收到数据:', body);
  
  // 查询用户
  console.log('🔍 [LOGIN] 查询用户:', body.username);
  const user = await db.select()...
  console.log('👤 [LOGIN] 查询结果:', user ? '✅ 找到' : '❌ 不存在');
  
  if (!user) {
    console.warn('⚠️  [LOGIN] 用户不存在');
    return c.json({ error: '用户不存在' }, 404);
  }
  
  // 验证密码
  console.log('🔐 [LOGIN] 验证密码...');
  const valid = compareSync(body.password, user.password);
  console.log('🔐 [LOGIN] 密码验证:', valid ? '✅ 正确' : '❌ 错误');
  
  if (!valid) {
    console.warn('⚠️  [LOGIN] 密码错误');
    return c.json({ error: '密码错误' }, 401);
  }
  
  console.log('✅ [LOGIN] 登录成功! User ID:', user.id);
  return c.json({ success: true });
});
```

### 调试性能问题

```typescript
console.time('总耗时');

console.time('查询用户');
const user = await db.select()...
console.timeEnd('查询用户'); // 查询用户: 45ms

console.time('密码验证');
const valid = compareSync(password, user.password);
console.timeEnd('密码验证'); // 密码验证: 12ms

console.time('生成Token');
const token = await sign(...);
console.timeEnd('生成Token'); // 生成Token: 8ms

console.timeEnd('总耗时'); // 总耗时: 65ms
```

## 记住这 3 点

1. **console.log 是你最好的朋友** 🎉
2. **保存代码后自动重载** ⚡
3. **终端在 VS Code 底部** 👇

---

需要更多帮助？查看：

- 📖 [DEBUG-GUIDE.md](DEBUG-GUIDE.md) - 完整指南
- 🚀 [DEBUG-QUICK-START.md](DEBUG-QUICK-START.md) - 5分钟上手

开始调试吧！💪
