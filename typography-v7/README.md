# 多模态排版分层 V7

## 部署 Worker

1. 安装 Wrangler：`npm install -g wrangler`
2. 登录：`wrangler login`
3. 设置密钥：`wrangler secret put OPENAI_API_KEY`
4. 设置访问密码：`wrangler secret put APP_PASSWORD`
5. 部署：`wrangler deploy`
6. 打开返回的 `workers.dev` 地址。前端与 API 同域运行。

OpenAI Key 与访问密码只保存在 Cloudflare 加密环境变量中，不要写进 HTML、GitHub 或 `wrangler.toml`。每次打开编辑器后，浏览器仅在当前标签页内保存访问密码。

## 处理链

图片 → OpenAI 语义理解 → 结构化对象/多边形 → 互斥像素分配 → 残差补偿层 → 1:1 合成验证 → 可编辑画布。

OpenAI 负责语义、层级、OCR 与对象边界；浏览器负责像素蒙版、透明图层和画布交互。
