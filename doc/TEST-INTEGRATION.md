# 灵枢 App 后端 API 集成测试脚本
# 测试场景：注册→绑定phone→推荐奖励→配额扣减→灵石兑换→排卦去重

## 环境配置
```bash
# 本地开发环境
BASE_URL="http://localhost:8787"

# 测试数据
TEST_USERNAME="testuser_$(date +%s)"
TEST_PASSWORD="Test@123456"
TEST_PHONE="18900001234"
TEST_PHONE_NEW="18900005678"

# 存放 token 的变量
TOKEN=""
USER_ID=""
REFERRER_ID=""
```

---

## 1️⃣ 测试场景 A：新用户登录注册（自动创建账户）

### 请求：POST /auth/login
```bash
curl -X POST "${BASE_URL}/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "'${TEST_USERNAME}'",
    "password": "'${TEST_PASSWORD}'",
    "phone": "'${TEST_PHONE}'",
    "deviceId": "device_iphone_12345"
  }' | jq .
```

### 预期响应：
```json
{
  "code": 200,
  "message": "登录成功",
  "data": {
    "token": "eyJhbGc...",
    "user": {
      "id": 1,
      "username": "testuser_1707000001",
      "phone": "189****1234",
      "memberLevel": 0,
      "memberExpireAt": 0,
      "lingshi": 0,
      "dailyFreeQuota": 1,
      "bonusQuota": 2
    }
  }
}
```

### 提取 token 和 user_id：
```bash
# 假设上面的响应保存在 login_response.json
TOKEN=$(cat login_response.json | jq -r '.data.token')
USER_ID=$(cat login_response.json | jq -r '.data.user.id')
echo "Token: ${TOKEN}"
echo "User ID: ${USER_ID}"
```

---

## 2️⃣ 测试场景 B：绑定手机号（无须使用推荐链接此步）

### 请求：POST /auth/bind-phone
```bash
curl -X POST "${BASE_URL}/auth/bind-phone" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${TOKEN}" \
  -d '{
    "phone": "'${TEST_PHONE_NEW}'"
  }' | jq .
```

### 预期响应：
```json
{
  "code": 200,
  "message": "手机号绑定成功",
  "data": {
    "phone": "189****5678"
  }
}
```

---

## 3️⃣ 测试场景 C：查询会员与配额状态

### 请求：GET /api/member/status
```bash
curl -X GET "${BASE_URL}/api/member/status" \
  -H "Authorization: Bearer ${TOKEN}" | jq .
```

### 预期响应（新用户）：
```json
{
  "code": 200,
  "message": "操作成功",
  "data": {
    "memberLevel": 0,
    "memberExpireAt": 0,
    "isMember": false,
    "dailyFreeQuota": 1,
    "bonusQuota": 2,
    "lingshi": 0,
    "canDivine": true,
    "reason": "当日免费配额充足或使用赠送配额",
    "quotaRemaining": 0
  }
}
```

---

## 4️⃣ 测试场景 D：排卦前配额检查（5分钟去重）

### 请求：POST /api/divination/check-quota
```bash
curl -X POST "${BASE_URL}/api/divination/check-quota" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${TOKEN}" \
  -d '{
    "subject": "最近财运如何",
    "category": "财运"
  }' | jq .
```

### 预期响应（首次排卦）：
```json
{
  "code": 200,
  "message": "操作成功",
  "data": {
    "canDivine": true,
    "reason": "当日免费配额充足",
    "isDuplicate": false,
    "quotaRemaining": 0
  }
}
```

### 预期响应（5分钟内重复排卦）：
```json
{
  "code": 200,
  "message": "操作成功",
  "data": {
    "canDivine": false,
    "reason": "5分钟内已排过相同问题，请稍后再试",
    "isDuplicate": true,
    "quotaRemaining": 0
  }
}
```

---

## 5️⃣ 测试场景 E：执行排卦（消耗配额）

### 请求：POST /api/divination/divine
```bash
curl -X POST "${BASE_URL}/api/divination/divine" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${TOKEN}" \
  -d '{
    "subject": "最近财运如何",
    "category": "财运",
    "inputData": {
      "shakingMethod": "摇卦",
      "lines": [2, 3, 4, 5, 6, 1]
    }
  }' | jq .
```

### 预期响应：
```json
{
  "code": 200,
  "message": "排卦成功，配额已扣减",
  "data": {
    "success": true,
    "quotaDeducted": {
      "source": "daily_free",
      "reason": "每日免费配额扣减"
    },
    "guaData": {
      "status": "pending",
      "message": "排卦中..."
    }
  }
}
```

### 检查配额变化：
```bash
# 重新查询会员与配额状态
curl -X GET "${BASE_URL}/api/member/status" \
  -H "Authorization: Bearer ${TOKEN}" | jq .
# dailyFreeQuota 应该从 1 变成 0
# 或 bonusQuota 从 2 变成 1
```

---

## 6️⃣ 测试场景 F：灵石兑换会员

### 场景前置：先给用户加灵石（模拟系统操作）
```sql
-- 使用数据库工具直接执行
UPDATE users SET lingshi = 700 WHERE id = 1;
```

### 请求：POST /api/member/exchange
```bash
curl -X POST "${BASE_URL}/api/member/exchange" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${TOKEN}" \
  -d '{
    "type": "weekly"
  }' | jq .
```

### 预期响应：
```json
{
  "code": 200,
  "message": "成功兑换周会员",
  "data": {
    "type": "weekly",
    "lingshiDeducted": 700,
    "newLingshi": 0,
    "memberExpireAt": 1707086400000,
    "daysAdded": 7
  }
}
```

### 验证会员状态更新：
```bash
curl -X GET "${BASE_URL}/api/member/status" \
  -H "Authorization: Bearer ${TOKEN}" | jq .
# isMember 应该为 true
# memberLevel 应该为 1
# canDivine 应该为 true（无需扣费）
```

---

## 7️⃣ 测试场景 G：分享推荐奖励（双向奖励）

### 1. 创建推荐人账户（模拟老用户）
```bash
# 登录或创建推荐人
curl -X POST "${BASE_URL}/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "referrer_user",
    "password": "'${TEST_PASSWORD}'",
    "phone": "18900009999",
    "deviceId": "device_iphone_99999"
  }' | jq .
# 提取推荐人 ID，假设为 5
REFERRER_ID=5
```

### 2. 创建新用户时，携带推荐人 ID
```bash
curl -X POST "${BASE_URL}/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "invitee_user_'$(date +%s)'",
    "password": "'${TEST_PASSWORD}'",
    "phone": "18900008888",
    "referrerId": '${REFERRER_ID}',
    "deviceId": "device_iphone_88888"
  }' | jq .
# 提取新用户 ID 和 token
INVITEE_ID=6
INVITEE_TOKEN="..."
```

### 3. 新用户绑定 phone（触发分享闭环）
```bash
curl -X POST "${BASE_URL}/auth/bind-phone" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${INVITEE_TOKEN}" \
  -d '{
    "phone": "18900008888"
  }' | jq .
```

### 4. 查看推荐人的奖励记录
```bash
# 推荐人登录并查询奖励
curl -X GET "${BASE_URL}/api/referral/rewards" \
  -H "Authorization: Bearer [推荐人token]" | jq .
```

### 预期响应：
```json
{
  "code": 200,
  "message": "操作成功",
  "data": {
    "stats": {
      "totalInvitees": 1,
      "totalLingshiAwarded": 100,
      "totalBonusQuotaAwarded": 1
    },
    "records": [
      {
        "id": 1,
        "referrerId": 5,
        "inviteeId": 6,
        "rewardType": "lingshi",
        "lingshiAwarded": 100,
        "bonusQuotaAwarded": 0,
        "createdAt": 1707000000000
      },
      {
        "id": 2,
        "referrerId": 5,
        "inviteeId": 6,
        "rewardType": "bonus_quota",
        "lingshiAwarded": 0,
        "bonusQuotaAwarded": 1,
        "createdAt": 1707000000000
      }
    ]
  }
}
```

---

## 8️⃣ 测试场景 H：排卦历史查询

### 请求：GET /api/divination/history
```bash
curl -X GET "${BASE_URL}/api/divination/history?limit=10&offset=0" \
  -H "Authorization: Bearer ${TOKEN}" | jq .
```

### 预期响应：
```json
{
  "code": 200,
  "message": "操作成功",
  "data": {
    "count": 1,
    "limit": 10,
    "offset": 0,
    "records": [
      {
        "id": 1,
        "userId": 1,
        "subjectHash": "abc123def456...",
        "inputData": "{\"shakingMethod\":\"摇卦\"}",
        "lastUsedAt": 1707000000000,
        "createdAt": 1707000000000
      }
    ]
  }
}
```

---

## 9️⃣ 测试场景 I：错误处理与边界条件

### 测试：无 Token 访问受保护路由
```bash
curl -X GET "${BASE_URL}/api/member/status" | jq .
```

### 预期响应：
```json
{
  "code": 401,
  "message": "未授权：请先登录"
}
```

### 测试：灵石不足时兑换会员
```bash
curl -X POST "${BASE_URL}/api/member/exchange" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${TOKEN}" \
  -d '{"type": "weekly"}' | jq .
```

### 预期响应：
```json
{
  "code": 400,
  "message": "灵石不足，需要 700 灵石，当前 0 灵石"
}
```

### 测试：配额不足时排卦
```bash
# 假设已扣减所有配额
curl -X POST "${BASE_URL}/api/divination/divine" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${TOKEN}" \
  -d '{"subject":"测试","category":"测试"}' | jq .
```

### 预期响应：
```json
{
  "code": 400,
  "message": "配额不足，无法排卦"
}
```

---

## 🔟 完整流程脚本（Bash）

如果想一次性运行完整流程，可以保存为 `test-full-flow.sh`：

```bash
#!/bin/bash
set -e

BASE_URL="http://localhost:8787"

# 颜色输出
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== 灵枢 App 后端完整测试流程 ===${NC}\n"

# 1. 新用户登录注册
echo -e "${BLUE}1️⃣ 新用户登录注册${NC}"
LOGIN_RESPONSE=$(curl -s -X POST "${BASE_URL}/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser_'$(date +%s)'",
    "password": "Test@123456",
    "phone": "18900001234"
  }')

TOKEN=$(echo $LOGIN_RESPONSE | jq -r '.data.token')
USER_ID=$(echo $LOGIN_RESPONSE | jq -r '.data.user.id')
echo -e "${GREEN}✓ 成功获取 Token: ${TOKEN:0:30}...${NC}\n"

# 2. 查询配额状态
echo -e "${BLUE}2️⃣ 查询会员与配额状态${NC}"
curl -s -X GET "${BASE_URL}/api/member/status" \
  -H "Authorization: Bearer ${TOKEN}" | jq '.data | {isMember, canDivine, dailyFreeQuota, bonusQuota, lingshi}'
echo ""

# 3. 排卦前检查
echo -e "${BLUE}3️⃣ 排卦前配额检查${NC}"
curl -s -X POST "${BASE_URL}/api/divination/check-quota" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${TOKEN}" \
  -d '{"subject":"财运如何","category":"财运"}' | jq '.data | {canDivine, isDuplicate}'
echo ""

# 4. 执行排卦
echo -e "${BLUE}4️⃣ 执行排卦${NC}"
curl -s -X POST "${BASE_URL}/api/divination/divine" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${TOKEN}" \
  -d '{"subject":"财运如何","category":"财运"}' | jq '.data.quotaDeducted'
echo ""

# 5. 查看排卦历史
echo -e "${BLUE}5️⃣ 查看排卦历史${NC}"
curl -s -X GET "${BASE_URL}/api/divination/history?limit=5" \
  -H "Authorization: Bearer ${TOKEN}" | jq '.data | {count, records: (.records | length)}'
echo ""

echo -e "${GREEN}=== 测试完成 ===${NC}"
```

运行：
```bash
chmod +x test-full-flow.sh
./test-full-flow.sh
```

---

## 📝 注意事项

1. **时区处理**：后端使用 UTC+8（北京时间）计算每日配额重置
2. **事务安全**：分享奖励和配额扣减都在数据库事务中执行
3. **并发安全**：配额扣减使用 `WHERE bonus_quota > 0` 防止负数
4. **Hash 去重**：5 分钟内相同的「用户 ID + 事由 + 类别」的排卦视为重复
5. **会员有效期堆叠**：重复兑换时使用 `max(now, memberExpireAt) + days` 逻辑

---

## 🚀 生产部署建议

1. 将 JWT_SECRET 改为强随机密钥（环境变量）
2. 实施 HTTPS 加密传输
3. 添加请求限流 (Rate Limit) 中间件
4. 定期备份 SQLite 数据库
5. 监控异常登录和设备指纹（deviceId）
