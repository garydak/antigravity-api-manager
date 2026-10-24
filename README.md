# Antigravity API Manager (AAM)

<p align="center">
  <strong>专为 Google Antigravity 打造的第三方 API 中转调度与多账号管理套件</strong>
  <br />
  零后台常驻 · 原生无损体验 · 动态汉化同步 · 完美适配 Antigravity v2.26
</p>

<p align="center">
  <img src="https://img.shields.io/badge/%E9%80%82%E7%94%A8%E7%89%88%E6%9C%AC-Antigravity%20v2.22%20~%20v2.26%2B-D97757?style=flat-square" alt="适用版本" />
  <img src="https://img.shields.io/badge/%E5%B9%B3%E5%8F%B0-Windows%2010%2F11%20x64-0078D6?style=flat-square" alt="平台" />
  <img src="https://img.shields.io/badge/%E6%B1%89%E5%8C%96%E6%95%B0%E6%8D%AE-Silas--02%20%E5%AE%98%E6%96%B9%E8%AF%8D%E5%BA%93%E8%BF%BD%E8%B8%AA-2E7D47?style=flat-square" alt="汉化数据" />
  <a href="./LICENSE"><img src="https://img.shields.io/badge/License-MIT-5C5A55?style=flat-square" alt="协议" /></a>
</p>

---

## 💡 为什么重构：核心改进点

**Antigravity API Manager (AAM)** 是在原有增强套件基础上进行的全面安全重构与体验升级版本。原有项目虽然提供了便利功能，但在系统稳定性、代码行为和安全规范上存在较大问题。本项目进行了如下核心重构：

### 1. ⚡ 启动时惰性自愈（彻底根除流氓守护任务）
- **原版痛点**：原版会在 Windows 任务计划程序中注册“每 1 分钟执行一次”的高频循环守护任务，并在注册表添加开机启动项，甚至忽略系统正常退出信号。这种做法极度浪费资源，且行为特征与流氓恶意软件无异，极易被杀毒软件误杀。
- **AAM 改进**：**彻底删除了计划任务、自启注册表项与 VBS 脚本**。采用**启动器级惰性自愈机制**——仅在用户双击打开 Antigravity 时，耗时 < 10ms 快速校验引导钩子，若遇官方自动更新覆盖则就地静默修复并拉起应用。**平时 0 计划任务、0 常驻后台占用、0 杀软误报**。

### 2. 🎨 剥离臃肿皮肤，回归纯粹的原生质感
- **原版痛点**：原版强行注入了 370KB 的外置 CSS（仿 Claude 羊皮纸色）和数百 KB 的外置衬线字体，破坏了 Antigravity 本身现代干练的设计语言，且常引起输入框重叠错位。
- **AAM 改进**：**完全剔除外置 Claude 皮肤与衬线字体**。100% 对齐 Antigravity 原生界面设计规范（Geist / Google Sans Flex 现代字体体系与原生深/浅色层级），界面轻盈、反应极速。

### 3. 🐛 深度修复原生 `/` 技能与 `@` 文件引用失效问题
- **原版痛点**：原版的回车拦截逻辑极其粗暴，只要按下 Enter 就会拦截消息发送，导致在 Antigravity 2.26 中呼出 `/`（调用工具/模式）或 `@`（引用上下文/代码库）时，按下回车无法选中候选项，反而把未输入完的内容当成消息发送。
- **AAM 改进**：深度重构了输入框按键拦截监听器，新增 `isTypeaheadOrMentionMenuOpen()` 侦测，精准识别 2.26 中的 Mention 联想浮层、Popover 菜单与 `aria-expanded` 状态。**在选词、选命令时严格放行原生交互，彻底修复该严重缺陷**。

### 4. 🔄 Silas-02 汉化词库动态自动化追踪
- **原版痛点**：汉化词条写死在本地，随着 Antigravity 官方每周迭代更新，新版本词条经常缺漏或失效。
- **AAM 改进**：内置了动态同步工具 `suite/tools/sync-i18n.mjs`，一键追踪上游 [`Silas-02/antigravity-desktop-cn`](https://github.com/Silas-02/antigravity-desktop-cn) 的最新 commit 与词典，自动获取最新版本覆盖层（如 `v2.25.0+`），保持汉化随时处于最新状态。

### 5. 🛡️ 安全合规与生命周期管理
- 守护进程（Daemon）移除了吞噬退出信号的暴力代码，完整支持 Windows 正常的 `SIGINT` 与 `SIGTERM` 进程生命周期。
- 全面清理旧作者未固定的外部链路，杜绝供应链投毒与中间人风险。

---

## 🌟 主要功能特性

1. **🔌 第三方 API / 中转站模型一键接入**
   - 完美支持 **OpenAI 兼容协议** 与 **Anthropic Messages 协议**。
   - 内置 DeepSeek、OpenRouter、SiliconFlow 等常见服务商预设，支持一键探测与批量导入模型。
   - **同会话无缝桥接**：支持在官方 Gemini 模型与第三方中转模型之间自由切换，上下文自动衔接。
   - **原生聊天框集成**：直接在输入框模型选择列表调用，支持思考强度调节（Reasoning Effort）。

2. **👥 Google 多账号平滑热切换**
   - 在原生设置面板与侧边栏内嵌多账号管理卡片。
   - 支持多账号秒级热切换与配额（Quota）实时预览，无需重新繁琐登录。

3. **🇨🇳 简体中文全量汉化**
   - 完整汉化 Antigravity 主界面、侧边栏、Agent 工作区、知识库与设置页。
   - 严格保护代码块、终端输出与用户输入的原始语言，绝不误伤技术上下文。

---

## 🚀 快速安装

### 推荐：PowerShell 在线一键安装
在 Windows PowerShell（建议使用普通用户权限即可）中粘贴并运行以下命令：

```powershell
& { $installer = Join-Path $env:TEMP 'agy-suite-install.ps1'; Invoke-WebRequest 'https://raw.githubusercontent.com/garydak/antigravity-api-manager/main/install-online.ps1' -OutFile $installer; powershell -NoProfile -ExecutionPolicy Bypass -File $installer }
```

### 手动安装（Git Clone）
```powershell
git clone https://github.com/garydak/antigravity-api-manager.git
cd antigravity-api-manager
powershell -ExecutionPolicy Bypass -File .\install-all.ps1
```
*提示：安装时会弹出模块选择框，支持按需独立勾选：中文汉化、多账号切换、API 中转模型管理。*

---

## 🤖 自动化汉化同步 (GitHub Actions)

本项目配置了 **每日自动检测同步流**（运行在 GitHub Actions）：
- ⏰ **定时任务**：每天 UTC 02:00（北京时间 10:00）自动请求 `Silas-02/antigravity-desktop-cn` 官方仓库。
- 🔄 **自动合并**：当检测到上游词库有新的 commit，Action 将自动拉取全量字典并重新编译 `claude-cn-i18n.js` 汉化包，生成 commit 自动提交到主分支。

---

## 🔄 本地手动汉化同步

当 Antigravity 发布大版本更新导致部分界面出现英文时，只需执行以下命令即可同步上游最新词库：

```powershell
node suite/tools/sync-i18n.mjs
```
脚本会自动探测上游仓库并重构汉化引擎包，无需重新安装整个套件。

---

## 🗑️ 一键完整卸载

如果需要还原官方原版，只需在项目目录中运行：

```powershell
powershell -ExecutionPolicy Bypass -File .\uninstall-all.ps1
```
或直接双击运行 **`双击一键卸载.cmd`**。卸载程序会安全清理启动拦截器与引导钩子，100% 完整恢复 Antigravity 原生官方启动状态。

---

## 📄 开源许可

- 本项目基于 [MIT License](./LICENSE) 协议开源。
- 汉化基础词库衍生自社区项目 [Silas-02/antigravity-desktop-cn](https://github.com/Silas-02/antigravity-desktop-cn)，在此致以谢意。
