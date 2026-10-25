# Antigravity API Manager (AAM)

<p align="center">
  <strong>专为 Google Antigravity 打造的第三方 API 中转调度、多账号管理与全量汉化增强套件</strong>
  <br />
  全面支持 macOS 与 Windows · 原生全套工具无损调用 · 零后台常驻 · 适配 Antigravity v2.22 ~ v2.26+
</p>

<p align="center">
  <img src="https://img.shields.io/badge/%E7%89%88%E6%9C%AC-v2.4.1-blue?style=flat-square" alt="Version v2.4.1" />
  <img src="https://img.shields.io/badge/%E9%80%82%E7%94%A8%E7%89%88%E6%9C%AC-Antigravity%20v2.22%20~%20v2.26%2B-D97757?style=flat-square" alt="适用版本" />
  <img src="https://img.shields.io/badge/%E6%94%AF%E6%8C%81%E7%B3%BB%E7%BB%9F-macOS%20%7C%20Windows%2010%2F11-0078D6?style=flat-square" alt="平台" />
  <img src="https://img.shields.io/badge/%E6%B1%89%E5%8C%96%E8%AF%8D%E5%BA%93-2100%2B%20%E8%AF%8D%E6%9D%A1%E6%B7%B1%E5%BA%A6%E6%9C%AC%E5%9C%B0%E5%8C%96-2E7D47?style=flat-square" alt="汉化数据" />
  <a href="./LICENSE"><img src="https://img.shields.io/badge/License-MIT-5C5A55?style=flat-square" alt="协议" /></a>
</p>

---

## 📦 最新版本下载 (Release v2.4.1)

本项目已支持 **macOS（Apple Silicon M系列及 Intel 架构）** 与 **Windows** 双平台。您可以直接下载开箱即用的离线压缩包：

| 操作系统 | 架构 / 环境要求 | 压缩包下载链接 | 安装方式 |
| :--- | :--- | :--- | :--- |
| 🍏 **macOS** | Apple Silicon (M1/M2/M3/M4) / Intel (Node.js ≥ 20) | [📥 **antigravity-api-manager-v2.4.1-mac.zip**](./releases/antigravity-api-manager-v2.4.1-mac.zip) | 解压后终端运行 `./install.sh` |
| 🪟 **Windows** | Windows 10 / 11 64-bit (Node.js ≥ 20) | [📥 **antigravity-api-manager-v2.4.1-win.zip**](./releases/antigravity-api-manager-v2.4.1-win.zip) | 解压后双击运行 `双击一键安装.cmd` |

> [!TIP]
> 也可以通过 GitHub Release 页面下载历史版本与最新归档：[Releases · garydak/antigravity-api-manager](https://github.com/garydak/antigravity-api-manager/releases)

---

## 🌟 核心功能特性

### 1. 🌐 中转模型直接控制真实 Google Chrome 浏览器 (方案 A 深度集成)
新版实现第三方中转模型与本地真实桌面 **Google Chrome** 的无缝连接：
- 🛡️ **操作前原生授权确认卡片**：中转模型每次请求连接浏览器时，聊天气泡会实时弹出权限确认模态卡片（支持点击 **「✓ 允许连接」**、**「✕ 拒绝」** 与 **「记住本次会话」**），保证桌面操作绝对受控安全。
- ⚡ **Chrome DevTools Protocol (CDP) 驱动**：支持真实打开网页 (`open`)、点击按钮与链接 (`click`)、输入搜索内容与表单 (`type`)、平滑滚动 (`scroll`)、页面正文提取与网页实时截屏 (`screenshot`)。
- 🪄 **无缝支持 `/browser` 快捷指令**：在输入框直接输入 `/browser https://...` 或 `/browser 请帮我搜索...`，中转模型能立即自动识别并调起浏览器控制流程！

### 2. 🛠️ 中转模型全套本地 Agent 工具链
无论使用 **DeepSeek-R1/V3**、**Claude 3.5/3.7 Sonnet** 还是 **GPT-4o/o3** 等第三方中转模型，均可驱动核心本地工具：
- 💻 **终端命令行执行（`run_command`）**：在系统终端执行 PowerShell / Bash 命令、运行单元测试及自动化构建。
- 📝 **代码编辑与 Diff 审查（`edit_file` / `write_file`）**：精准替换工程代码，并在 Antigravity 原生界面呈现代码 Diff 审查与一键撤销。
- 🧩 **MCP（Model Context Protocol）扩展**：完全透传调用 Antigravity 已加载的各类 MCP Server 本地工具。
- 💭 **原生思维链折叠展示**：支持推理模型（如 DeepSeek-R1、OpenAI o 系列）的思考过程输出，以原生的「💭 思考过程」折叠框优雅呈现。

### 2. 🔀 双轨智能分流机制
- **选用官方原生模型**：自动走 Google 官方直连通道，不经过任何中转转译，保证官方模型原生速度与特性。
- **选用第三方中转模型**：通过底层无损适配层，透明转译为 Antigravity 官方语言服务，实现无缝工具闭环。

### 3. 👥 Google 多账号平滑热切换
- 原生设置面板与侧边栏深度内嵌多账号切换组件。
- 支持保存多个 Google 账号凭据，一键秒级切换活跃账号，并实时展示账号额度与配额低水位预警。

### 4. 🇨🇳 深度汉化与代码语义严格保护
- 内置 2100+ 词条词典，全量汉化菜单、侧边栏、Agent 工作区、知识库与设置面板。
- 拥有多层智能隔离技术（`isInBlockedZone`），**绝对不触碰代码编辑器、终端控制台、代码块、用户输入框及大模型代码输出**，确保代码语义绝对准确。

### 5. ⚡ 纯净化与零后台常驻
- **0 计划任务、0 流氓守护**：彻底剔除开机驻留进程与高频循环扫描，应用关闭后后台自动休眠退出。
- **0 污染原生设计**：剔除臃肿冗余的外置主题与外置字体，完全对齐 Antigravity 原生现代化 UI。

---

## 📖 详细使用指南 (Usage Guide)

### 步骤一：添加与配置中转模型

1. 启动 Antigravity 客户端后，点击左侧边栏的 **「接入中转 API」** 按钮，或点击聊天输入框左下角模型选择按钮呼出管理面板：

   <p align="center">
     <img src="./assets/api-model-manager.png" width="550" alt="中转模型管理面板" />
   </p>

2. 在弹出的配置窗口中填写服务商信息：
   - **服务商预设**：可从下拉菜单快速选择 `MoreMark AI`、`DeepSeek 官方`、`OpenRouter` 或 `OneAPI / NewAPI / 自定义`。
   - **中转站接口地址 (Base URL)**：填入中转商提供的地址，如 `https://api.moremark.app/v1`、`https://api.deepseek.com/v1` 或自定义域名。
   - **API Key**：填入您的中转 API 密钥（前端自动脱敏存储，绝不泄露）。
   - **模型标识 (Model ID)**：可手动输入（如 `gpt-4o`、`claude-3-7-sonnet-20250219`、`deepseek-chat`），或点击右侧 **「🔍 从接口获取列表」** 自动拉取中转站可用模型并批量导入。
3. 点击 **「🧪 测试连接」**，验证延迟与模型可用性，最后点击 **「➕ 添加到模型选择列表」** 即可。

---

### 步骤二：切换模型并开展对话

1. 在对话输入框左下角点击模型选择器，您添加的所有自定义中转模型将整齐排列在官方模型正下方：

   <p align="center">
     <img src="./assets/model-reasoning-menu.png" width="480" alt="模型选择列表" />
   </p>

2. 直接点击即可无缝切换。对于支持推理的模型，支持在二级菜单中直接调节 **思考强度（Reasoning Effort）**。
3. 可以在**同一个对话**中随时在官方 Gemini 与中转第三方模型之间切换，上下文自动平滑衔接。

---

### 步骤三：使用中转模型联网阅读网页与执行终端命令

切换至中转模型后，可直接让大模型调用本地工具能力：

#### 🌐 网页阅读与联网抓取（重要区别说明）

> [!IMPORTANT]
> **关于官方浏览器与中转模型联网的区别（避免误解）**：
> - **官方 Gemini 原生模型**：直接绑定 Google 内部语言服务，输入 `/browser https://...` 宏指令时会在右侧弹出**真实的 Chrome/Puppeteer 交互式浏览器窗口**（支持模拟点击、账号登录、动态滚动与截图）。
> - **第三方中转模型（当前方案）**：采用本地高效的**无头网页抓取引擎**（基于 Node.js 直接抓取页面并提取核心纯文本），具有毫秒级极速响应、零内存占用的优势。**但中转模型不支持官方专有的 `/browser` 斜杠宏指令**（若直接输入 `/browser` 会被中转模型当作未知指令报错或普通文本处理）。

**中转模型正确使用方式**：**直接使用自然语言对话！**

- ❌ **无效方式（避免使用）**：
  ```text
  /browser https://github.com/garydak/antigravity-api-manager
  ```
- ✅ **正确有效方式（推荐）**：
  ```text
  访问这个网页并总结它的核心功能：https://github.com/garydak/antigravity-api-manager
  ```
  或
  ```text
  帮我读取 https://docs.github.com/rest 并告诉我最新的接口变更
  ```
  模型会自动在界面唤起 **🌐 浏览网页** 本地工具卡片，静默读取网页纯净文本后输出详细回答。
  *（注：如果您必须使用带界面渲染、需要点击登录按钮的真实浏览器窗口，请在输入框左下角切换回官方 Gemini 原生模型。）*

#### 💻 执行终端命令与代码重构
直接向中转模型提出工程需求，例如：
```text
请搜索当前工作区下的 package.json，并在终端运行 npm test 测试是否通过。
```
模型会自动发起 `run_command` 终端执行与 `edit_file` 代码 Diff 审查卡片，您可以实时点击接受或拒绝修改。

---

### 步骤四：多账号管理与切换

1. 点击界面左侧的 **「个性化定制」** 或打开控制面板；
2. 在多账号卡片中直接添加或保存多个 Google 账号；
3. 点击目标账号头像即可秒级完成主账号热切换，额度指示角标将实时刷新当前账号的配额状态。

---

## 💻 详细安装指引

### 🍎 macOS 用户安装

#### 方式 A：离线压缩包安装（推荐）
1. 下载 [**antigravity-api-manager-v2.4.1-mac.zip**](./releases/antigravity-api-manager-v2.4.1-mac.zip) 并解压。
2. 打开「终端（Terminal）」，进入解压后的文件夹目录：
   ```bash
   cd ~/Downloads/antigravity-api-manager
   ```
3. 执行一键安装脚本：
   ```bash
   chmod +x install.sh
   ./install.sh
   ```
4. 提示安装成功后，打开 Antigravity 应用即可！

#### 方式 B：终端 Git Clone 安装
```bash
git clone https://github.com/garydak/antigravity-api-manager.git
cd antigravity-api-manager
chmod +x install.sh
./install.sh
```

---

### 🪟 Windows 用户安装

#### 方式 A：离线压缩包安装（推荐）
1. 下载 [**antigravity-api-manager-v2.4.1-win.zip**](./releases/antigravity-api-manager-v2.4.1-win.zip) 并解压。
2. 鼠标双击运行解压目录中的 **`双击一键安装.cmd`**（无需管理员权限）。
3. 勾选需要启用的模块（汉化、多账号、API 中转），点击确定完成安装。
4. 双击桌面的 **Antigravity** 快捷方式启动应用即可！

#### 方式 B：PowerShell 在线一键安装
在 PowerShell 中直接粘贴执行：
```powershell
& { $installer = Join-Path $env:TEMP 'agy-suite-install.ps1'; Invoke-WebRequest 'https://raw.githubusercontent.com/garydak/antigravity-api-manager/main/install-online.ps1' -OutFile $installer; powershell -NoProfile -ExecutionPolicy Bypass -File $installer }
```

---

## 🗑️ 一键完整卸载与还原官方原版

如果您需要将 Antigravity 彻底恢复到未经修改的官方状态：

- **macOS 用户**：在解压目录终端运行 `./uninstall.sh`。
- **Windows 用户**：直接双击运行 **`双击一键卸载.cmd`**，或在 PowerShell 执行 `.\uninstall-all.ps1`。

卸载程序会自动清除所有钩子与注入文件，100% 完整无损还原官方初始状态。

---

## 📝 版本更新日志 (Changelog)

### v2.4.1 (2026-10-26)
* 🎯 **会话级模型选择独立隔离（Session Isolation）**：
  * 修复了在一个会话选择中转模型后全局所有会话都被动切换的问题；
  * 每个会话（Conversation）独立记忆当前选择的模型与思考强度，切换会话时界面按钮与底层调度秒级自动对齐；
  * 新建会话默认保持官方原生模型，避免被历史会话选择污染。

### v2.4.0 (2026-10-26)
* 🚀 **全套原生工具链无损代理集成**：
  * 中转模型（OpenAI/Claude 协议）现已完美支持 Antigravity 原生全套工具，包括 `/browser` 浏览器自动化控制、终端命令执行、代码 Diff 精准替换以及 MCP 工具扩展；
  * 原生推理思考链支持：支持 DeepSeek-R1 等模型的思考过程以官方「💭 思考过程」原生折叠组件展现。
* 🍏 **正式新增 macOS 全面适配**：
  * 新增 macOS 一键安装脚本 `install.sh` 与卸载脚本 `uninstall.sh`；
  * 提供独立的 macOS 与 Windows 离线压缩包发布；
  * 自动探测 macOS 标准应用路径（`/Applications/Antigravity.app`）与系统 Node 运行时。
* 🛡️ **彻底根除黑屏闪退与守护误退隐患**：
  * 修复原生代理模式下输入框失焦/聚焦时意外触碰 React Fiber 导致 DOM 卸载黑屏的问题；
  * 彻底重构后台守护进程的生命周期监听机制，加入容错检测，杜绝界面重载或重启时守护服务意外退出。
* 🧹 **侧边栏与项目列表深度净化**：
  * 彻底移除向侧边栏项目树强行注入本地会话历史的遗留代码，项目树恢复 100% 官方纯净结构。

---

## 📄 开源许可证

- 本项目采用 [MIT License](./LICENSE) 开源协议。
- 基础汉化词典追踪自社区项目 [Silas-02/antigravity-desktop-cn](https://github.com/Silas-02/antigravity-desktop-cn)，向开源贡献者们致谢！
