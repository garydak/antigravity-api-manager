# Antigravity API Manager (AAM) - Agent 协同与安全开发规范

本文件为本项目所有 AI Coding Agent（包括 Antigravity、Claude Code、Cursor 等）的最高优先级行为准则。在对本项目进行任何修改、更新、打包或提交时，**必须严格遵守以下安全脱敏铁律**。

---

## 🎯 核心指导原则：本地保留设置，上传严格脱敏

> [!IMPORTANT]
> **本地运行时环境**：允许并完整保留用户的个性化配置、Google 登录凭据（`accounts.json`）与私人中转 API 密钥（`models.json`），以便用户在本地正常调试与日常使用。<br />
> **GitHub 上传与发布包**：必须通过 `.gitignore`、沙盒构建与自动化审计实现 **100% 隔离与脱敏**，严禁将包含真实私密信息的配置上传至 GitHub 或打包进 Release 归档！

---

## 🔒 核心安全脱敏铁律 (Security & Desensitization Redlines)

### 1. 账号管理器 (Account Switcher)
- **本地环境**：用户的本地登录账号信息保存在 `antigravity-account-switcher/data/accounts.json`，由守护进程读写，**予以保留供本地使用**。
- **上传脱敏**：`.gitignore` 严格忽略 `accounts.json` 与 `daemon.log`。Git 仓库及发布包中**仅允许包含脱敏示例模板 `accounts.example.json`**。

### 2. 模型调度器 (Model Switcher)
- **本地环境**：用户的私有中转站 Base URL、API Key 与自定义模型保存在 `antigravity-model-switcher/data/models.json`，**予以保留供本地使用**。
- **上传脱敏**：`.gitignore` 严格忽略 `models.json`、`session-selections.json`、`bridges/` 及 `lifecycle-backups/`。Git 仓库及发布包中**仅允许包含脱敏示例模板 `models.example.json`**。

### 3. 发布归档打包必须经由沙盒审计
- 构建新版本压缩包必须通过 `npm run build:release` 进行，打包程序会在独立的临时沙盒中仅复制受允许的源码与脱敏模板。
- 自动剔除任何 `accounts.json`、`models.json`、`session-selections.json`、`*.log` 及会话桥接记录。
- 压缩包构建完成后自动执行物理双重审计，存在违规文件立即熔断报错。

### 4. 每次更新前后的自检清单
在执行 `git commit` 或 `git push` 前，运行：
```bash
npm run audit:security
```
该工具会自动审查当前 Git 追踪状态与待发布的 ZIP 包，确保本地配置安全隔离、上传远端内容 100% 脱敏。
