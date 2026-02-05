# 灵枢 App 后端文档索引

## 文档目录

### 📁 项目结构文档
- [`project-structure.md`](./project-structure.md) - 详细的项目文件结构说明，包含每个文件夹和文件的功能介绍

### 📁 业务逻辑文档
- [`index.md`](./index.md) - 当前文件，包含核心业务逻辑设计

---

## 核心业务逻辑设计 (v2.1)

### 1. 账户与身份模块 (Account & Identity)

功能描述：实现"用户名登录"与"手机号找回"分离的账户体系，降低操作门槛。

登录即注册：接口接收 username。若数据库无记录则自动创建新用户，若有记录则返回用户信息。

字段分离：

username：作为唯一的登录标识（可以是用户自定义，也可以是系统自动生成的 ID）。

phone：作为辅助字段，用于后期找回密码或身份核验，不直接作为登录账号。

静默注册：支持在未注册状态下分配临时会话 ID（Session），允许进行一次试用。

新用户初始化：

每日基础配额 (daily_free_quota) = 1。

注册当天额外赠送次数 (bonus_quota) = 2（确保首日 3 次）。

初始灵石 (ling_shi) = 0。

### 2. 会员与配额管理模块 (Membership & Quota)

功能描述：管理用户的权限分级、次数扣减以及灵石与会员的转换逻辑。

会员身份判定：

周/月/年会员：根据购买或兑换记录，更新 member_level 为 1，并顺延设置 member_expire_at。

权限越级：若当前时间在会员有效期内，起卦请求不扣减次数，直接放行。

配额扣减优先级：

会员权益 (直接放行)。

每日免费次数 (检查 last_used_date 是否为今天，若不是则重置并允许使用)。

额外奖励次数 (bonus_quota)。

灵石系统与兑换机制：

获取：每完成一个分享闭环奖励 100 灵石。

兑换周会员：支持用户消耗灵石（如 700 灵石）兑换 7 天会员有效期。

兑换次数：100 灵石 = 1 次可用次数。

次数上限控制：

通过分享获得的 bonus_quota 累计上限为 5。达到上限后，新的分享成功记录仅增加灵石，不再增加可用次数。

### 3. 裂变分享系统模块 (Fission & Referral)

功能描述：处理基于推荐链接的闭环逻辑。

追踪机制：通过 URL 捕获 referrer_id。

闭环触发 (Reward Trigger)：

条件：被推荐人（新用户）完成 username 注册并绑定 phone（可选）。

双向奖励：

新用户奖励：注册成功后，立即获得首日共 3 次体验额度。

老用户奖励：增加 100 灵石。若此时老用户 bonus_quota < 5，则 bonus_quota 加 1。

### 4. 六爻排盘业务逻辑模块 (Divination Control)

功能描述：针对六爻业务场景的特定拦截。

深度解卦锁：起卦允许免费查看卦象，获取深度断语（神煞、动爻、流年等）接口必须调用配额检查。

重复操作保护：同一用户在 5 分钟内针对同一事由排出的相同卦象，后端记录 Hash 值，不重复扣费。

### 5. 核心 API 行为定义 (供编辑器参考)

A. POST /api/auth/login

输入：username, referrer_id (可选)。

内部逻辑：包含用户创建、推荐关系判定、首日 3 次权限发放。

B. POST /api/auth/bind-phone

输入：user_id, phone。

功能：将手机号作为"辅助钥匙"绑定到已有账号。

C. POST /api/member/exchange

输入：user_id, type (值为 'weekly' 或 'quota')。

内部逻辑：判定灵石余额，扣减灵石，更新 member_expire_at 或 bonus_quota。

D. POST /api/divination/check-quota

输入：user_id。

输出：can_divine: boolean, reason: string。