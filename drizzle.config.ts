import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/schema.ts",  // 告诉它你的表结构文件在哪
  out: "./drizzle",           // 生成的 SQL 文件存到哪
  dialect: "sqlite",          // 核心！这里指定了是 sqlite
  driver: "d1-http",          // 针对 Cloudflare D1 的优化
});