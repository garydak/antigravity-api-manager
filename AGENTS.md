# Antigravity API Manager (AAM) - Agent 协同与安全开发规范

本文件为本项目所有 AI Coding Agent（包括 Antigravity、Claude Code、Cursor 等）的最高优先级行为准则。在对本项目进行任何修改、更新、打包或提交时，**必须严格遵守以下安全脱敏铁律**。

---

## 🔒 核心安全脱敏铁律 (Security & Desensitization Redlines)

> [!CAUTION]
> **绝对禁止在本项目源码、文档、测试用例或 Release 压缩归档中包含任何真实的个人凭据、私人 API 密钥或会话记录！**

### 1. 账号管理器 (Account Switcher) 脱敏要求
- **严禁提交真实账号**：`antigravity-account-switcher/data/accounts.json` 包含 Google 登录凭据（`email`、`access_token`、`refresh_token`、`id_token` 等），**绝对禁止提交到 Git 仓库或打包到 Release 压缩包中**。
- **模板优先**：仅允许提交脱敏占位模板 `antigravity-account-switcher/data/accounts.example.json`。
- **运行时日志隔离**：所有 `*.log` 文件（如 `daemon.log`）必须排除在版本控制与发布包之外。

### 2. 模型调度器 (Model Switcher) 脱敏要求
- **严禁提交私人 API 密钥**：`antigravity-model-switcher/data/models.json` 包含私人中转站 Base URL、API Key（`sk-...`）以及自定义模型配置，**绝对禁止提交到 Git 或打包到 Release**。
- **严禁包含会话桥接记录**：`antigravity-model-switcher/data/bridges/` 与 `session-selections.json` 包含历史对话上下文、截图媒体与会话映射，必须绝对隔离。
- **模板优先**：仅允许提交脱敏占位模板 `antigravity-model-switcher/data/models.example.json`。

### 3. 发布归档打包必须经由沙盒审计
- 构建新版本压缩包必须通过 `npm run build:release`（即 `node tools/build-release.cjs`）进行，不得随意直接使用系统压缩工具全量压缩项目根目录。
- 构建引擎自带沙盒隔离机制与双重后置审计：
  - 自动排除所有 `data/*.json`（除 `*.example.json` 外）；
  - 自动排除 `bridges/`、`backup/`、`inspect/`、`i18n-repo/` 以及所有 `*.log`、`*.tmp`；
  - 压缩完成后自动校验归档内条目，一旦存在敏感文件立即熔断报错。

### 4. 每次更新前后的自检清单
在执行 `git commit` 或 `git push` 前，必须运行：
```bash
npm run audit:security
```
确保全项目源码与发布包中敏感字符串匹配数为 **0**。
