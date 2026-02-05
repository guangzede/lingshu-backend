#!/bin/bash

# 调试测试脚本
# 用法: chmod +x test-debug.sh && ./test-debug.sh

echo "🚀 开始测试调试功能..."
echo ""

# 基础 URL
BASE_URL="http://localhost:8788"

# 测试 1: 注册
echo "📝 测试 1: 注册新用户"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
curl -X POST "$BASE_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "debug_test_user",
    "password": "TestPass123",
    "phone": "13912345678"
  }' \
  -w "\n状态码: %{http_code}\n" \
  -s | jq .

echo ""
echo "👆 现在查看 VS Code 终端，应该能看到："
echo "   [AUTH REGISTER] 开始注册: { username: 'debug_test_user', phone: '13912345678' }"
echo ""
read -p "按回车继续..."

# 测试 2: 登录成功
echo ""
echo "✅ 测试 2: 登录（正确密码）"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
curl -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "debug_test_user",
    "password": "TestPass123"
  }' \
  -w "\n状态码: %{http_code}\n" \
  -s | jq .

echo ""
echo "👆 现在查看 VS Code 终端，应该能看到："
echo "   [AUTH LOGIN] 尝试登录: { username: 'debug_test_user' }"
echo "   [AUTH LOGIN] 用户登录成功: { userId: X, username: 'debug_test_user' }"
echo ""
read -p "按回车继续..."

# 测试 3: 登录失败
echo ""
echo "❌ 测试 3: 登录（错误密码）"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
curl -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "debug_test_user",
    "password": "WrongPassword"
  }' \
  -w "\n状态码: %{http_code}\n" \
  -s | jq .

echo ""
echo "👆 现在查看 VS Code 终端，应该能看到："
echo "   [AUTH LOGIN] 尝试登录: { username: 'debug_test_user' }"
echo "   ▲ [WARNING] [AUTH LOGIN] 密码验证失败: { username: 'debug_test_user' }"
echo ""
read -p "按回车继续..."

# 测试 4: 参数缺失
echo ""
echo "⚠️  测试 4: 登录（缺少参数）"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
curl -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "debug_test_user"
  }' \
  -w "\n状态码: %{http_code}\n" \
  -s | jq .

echo ""
echo "👆 现在查看 VS Code 终端，应该能看到参数验证错误"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ 测试完成！"
echo ""
echo "💡 提示："
echo "   1. 所有日志都在 VS Code 终端中"
echo "   2. 使用 Ctrl+F (Mac: Cmd+F) 搜索特定日志"
echo "   3. 尝试修改代码添加更多 console.log"
echo "   4. 保存后 wrangler 会自动重载"
echo ""
