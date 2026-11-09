# 白桃电竞 - Cloudflare Pages 迁移版

本项目将原 Netlify Functions 迁移为 Cloudflare Pages Functions。Supabase 数据库、管理员认证、PushPlus 通知及二维码图片继续沿用。

## 项目结构

- `index.html`：原站点前端，保留原有页面和业务逻辑；接口地址改为 `/api/`。
- `functions/api/create-order.js`：下单接口，对应 `POST /api/create-order`。
- `functions/api/mark-order-paid.js`：付款申请及 PushPlus 通知，对应 `POST /api/mark-order-paid`。
- `IMG_4063.jpeg`、`IMG_4064.jpeg`：原微信/支付宝收款二维码。

## Cloudflare Pages 构建设置

- Framework preset：None
- Build command：留空
- Build output directory：`.`
- Root directory：留空（仓库根目录）

## 必须配置的环境变量（Pages 项目 Settings -> Variables and Secrets）

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY`（Secret）
- `PUSHPLUS_TOKEN`（Secret）

不要把 `SUPABASE_SECRET_KEY` 或 `PUSHPLUS_TOKEN` 写入前端文件或提交到 GitHub。

## 注意

1. 前端管理员后台仍通过 Supabase 客户端直接访问 `orders` 表；管理员读写能力仍依赖 Supabase Auth 和现有 RLS/授权策略。
2. `mark-order-paid` 中付款申请成功后才发送 PushPlus 通知；通知失败不会把付款申请判定为失败。
3. `payment_status = 待核实` 仅表示用户提交了付款申请，不代表已经实际到账。管理员仍需核实到账后手动确认。
4. 此迁移包尚未部署，也未连接生产环境做端到端验证。请先在 Cloudflare 预览网址测试，原 Netlify 网站先保留。
