export const LINGSHI_COSTS = {
  // 排卦消耗灵石的优先级：
  // 1. 优先免费配额
  // 2. 快用完时，扣减免费次数对应的灵石（100灵石一次）
  // 3. 赠送配额用完，扣减赠送配额对应的灵石（100灵石一次）
  divineFreeCost: 100,      // 每次免费排卦对应的灵石成本
  divineBonus: 100,         // 每次赠送排卦对应的灵石成本
  
  aiChat: 100,
  exchange: {
    weekly: 3000,
    monthly: 20000,
    ticket: 100
  }
};

export const LINGSHI_REWARDS = {
  referral: 100,
  profileComplete: 500
};
