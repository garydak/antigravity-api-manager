# Antigravity API Manager (AAM)

<p align="center">
  <strong>专为 Google Antigravity 打造的第三方 API 中转调度、多账号管理与全量汉化增强套件</strong>
  <br />
  全面支持 macOS 与 Windows · 原生全套工具无损调用 · 零后台常驻 · 适配 Antigravity v2.22 ~ v2.27+ 最新版
</p>

<p align="center">
  <img src="https://img.shields.io/badge/%E7%89%88%E6%9C%AC-v2.4.6-blue?style=flat-square" alt="Version v2.4.6" />
  <img src="https://img.shields.io/badge/%E9%80%82%E7%94%A8%E7%89%88%E6%9C%AC-Antigravity%20v2.22%20~%20v2.27%2B-D97757?style=flat-square" alt="适用版本" />
  <img src="https://img.shields.io/badge/%E6%94%AF%E6%8C%81%E7%B3%BB%E7%BB%9F-macOS%20%7C%20Windows%2010%2F11-0078D6?style=flat-square" alt="平台" />
  <img src="https://img.shields.io/badge/%E6%B1%89%E5%8C%96%E8%AF%8D%E5%BA%93-2100%2B%20%E8%AF%8D%E6%9D%A1%E6%B7%B1%E5%BA%A6%E6%9C%AC%E5%9C%B0%E5%8C%96-2E7D47?style=flat-square" alt="汉化数据" />
  <a href="./LICENSE"><img src="https://img.shields.io/badge/License-MIT-5C5A55?style=flat-square" alt="协议" /></a>
</p>

---

## 📦 最新版本下载 (Release v2.4.6)

本项目已支持 **macOS（Apple Silicon M系列及 Intel 架构）** 与 **Windows** 双平台。您可以直接下载开箱即用的离线压缩包：

| 操作系统 | 架构 / 环境要求 | 压缩包下载链接 | 安装方式 |
| :--- | :--- | :--- | :--- |
| 🍏 **macOS** | Apple Silicon (M1/M2/M3/M4) / Intel (Node.js ≥ 20) | [📥 **antigravity-api-manager-v2.4.6-mac.zip**](./releases/antigravity-api-manager-v2.4.6-mac.zip) | 解压后终端运行 `./install.sh` |
| 🪟 **Windows** | Windows 10 / 11 64-bit (Node.js ≥ 20) | [📥 **antigravity-api-manager-v2.4.6-win.zip**](./releases/antigravity-api-manager-v2.4.6-win.zip) | 解压后双击运行 `双击一键安装.cmd` |

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

### 3. 🔀 双轨智能分流机制
- **选用官方原生模型**：自动走 Google 官方直连通道，不经过任何中转转译，保证官方模型原生速度与特性。
- **选用第三方中转模型**：通过底层无损适配层，透明转译为 Antigravity 官方语言服务，实现无缝工具闭环。

### 4. 👥 Google 多账号平滑热切换
- 原生设置面板与侧边栏深度内嵌多账号切换组件。
- 支持保存多个 Google 账号凭据，一键秒级切换活跃账号，并实时展示账号额度与配额低水位预警。

### 5. 🇨🇳 深度汉化与代码语义严格保护
- 内置 2100+ 词条词典，全量汉化菜单、侧边栏、Agent 工作区、知识库与设置面板。
- 拥有多层智能隔离技术（`isInBlockedZone`），**绝对不触碰代码编辑器、终端控制台、代码块、用户输入框及大模型代码输出**，确保代码语义绝对准确。

### 6. ⚡ 纯净化与零后台常驻（Zero-Task UI & Zero-Pollution）
- **纯静默独立后台，聊天面板 0 任务占用**：守护后台采用操作系统独立进程机制脱离会话终端，聊天界面的“后台任务”栏不会出现任何多余的转圈常驻任务项，界面始终保持极致纯净。
- **0 计划任务、0 流氓守护**：彻底剔除开机驻留进程与高频循环扫描，内置生命周期探测器，在检测到 Antigravity 应用关闭 2 分钟后自动自杀退出并释放系统内存。
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
   - **中转站接口地址 (Base URL)**：填入中转商提供的地址，如 `https://api.moremark.app/v1`、`https://api.deepseek.com/v1` 或自定义域名（注意标准接口通常包含 `/v1`）。
   - **API Key**：填入您的中转 API 密钥（前端自动脱敏存储，绝不泄露）。
   - **模型标识 (Model ID)**：可手动输入（如 `gpt-4o`、`claude-3-7-sonnet-20250219`、`deepseek-chat`），或点击右侧 **「🔍 从接口获取列表」** 自动拉取中转站可用模型。
   - **一键直选与全选批量导入（v2.4.6 新增）**：
     * **点击即填入**：拉取到模型列表后，直接鼠标点击下方任意模型的名称，自动一键填入上方【模型标识】，无需繁琐清空；
     * **全选批量导入**：支持点击「全选」一秒勾选所有模型，底部按钮实时显示已勾选数量（如 `批量导入已选模型 (11)`），点击即可一键全部保存。
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

## ❓ 常见问题：Antigravity 升级更新后对本项目是否有影响？

> **答：绝大多数官方更新完全不受影响。即使遇到更新重置，也能在 3 秒内全自动恢复。**

本项目采用了工业级的**抗更新与高可用自愈架构**，具体原理与保障机制如下：

### 1. 📂 数据 100% 独立安全（配置与 API Key 永不丢失）
* 所有的服务商配置、模型列表、API Key 以及多账号凭据，均独立存放在操作系统当前用户的个人家目录中（`~/.gemini/antigravity-suite/` 与 `~/.gemini/config/`）。
* **Antigravity 官方客户端更新升级时，只会替换其自身的安装目录（`AppData/Local/...`），绝不会触碰或覆盖您的个人数据目录**。因此无论版本如何迭代，数据绝对 100% 安全。

### 2. 🛡️ 内存动态热注入与启动器自愈机制（零篡改 asar 文件）
* 本项目**完全没有修改官方核心只读的 `app.asar` 归档包**，而是通过 Chrome DevTools Protocol (CDP) 在渲染层进行纯内存动态热挂载。
* 这样设计杜绝了因官方版本升级文件哈希不一致导致的软件崩溃、白屏报错或更新失败。
* 桌面快捷方式内置了自愈逻辑，每次启动应用都会自动拉起本地服务并完成热挂载。

### 3. ⚡ 更新后如果中转面板未响应，如何一键快速自愈？
如果官方更新重置了桌面快捷方式，或者更新重启后本地守护尚未唤醒，您无需重新安装，只需在 Antigravity 对话框中直接发送一句：
> **`更新后中转未响应，帮我重新激活一下`**

智能助手会自动探测快捷方式、在系统底层静默拉起守护进程（`127.0.0.1:19823`）并通过 CDP 重新注入前端交互组件，**3 秒内全自动恢复**。

### 4. 🔍 版本自适应动态检测（已全面支持 Antigravity 2.27+ 最新版）
* 本项目内置了 Antigravity 真实版本动态探测模块（`detect-version`）。
* 无论运行在 Windows 还是 macOS，套件每次变更与打包时都会自动探测当前系统安装的 Antigravity 实际版本号（当前已实测支持至 **v2.27+** 最新版本），并自适应完成版本协议对齐。

---

## 💻 详细安装指引

### 🍎 macOS 用户安装

#### 方式 A：离线压缩包安装（推荐）
1. 下载 [**antigravity-api-manager-v2.4.6-mac.zip**](./releases/antigravity-api-manager-v2.4.6-mac.zip) 并解压。
2. 打开「终端（Terminal）」，进入解压后的文件夹目录：
   ```bash
   cd ~/Downloads/antigravity-api-manager-v2.4.6-mac
   ```
3. 执行安装脚本：
   ```bash
   chmod +x install.sh
   ./install.sh
   ```
4. 提示安装成功后，打开 Antigravity 应用即可。

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
1. 下载 [**antigravity-api-manager-v2.4.6-win.zip**](./releases/antigravity-api-manager-v2.4.6-win.zip) 并解压。
2. 鼠标双击运行解压目录中的 **`双击一键安装.cmd`**（无需管理员权限）。
3. 勾选需要启用的模块（汉化、多账号、API 中转），点击确定完成安装。
4. 双击桌面的 **Antigravity** 快捷方式启动应用即可。

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

### v2.4.6 (2026-10-28)
* 🎯 **模型管理与批量导入交互大幅增强**：
  * **点击标签直接填入**：拉取到模型列表后，鼠标直接点击任意模型标签名称即可一键填入上方【模型标识 (Model ID)】输入框，彻底解决 HTML5 datalist 输入框有文本时自动隐藏其他拉取模型的浏览体验缺陷；
  * **一键全选 / 取消全选**：发现模型列表右上角增加快捷操作链接，支持一键批量全选所有已发现模型；
  * **批量导入动态计数指示**：底部导入按钮动态显示当前已勾选的模型数量（如 `批量导入已选模型 (11)`），交互反馈更明确；
  * **输入框聚焦自动全选**：点击【模型标识】输入框时自动选中全文，按退格或 Delete 即可秒级清空展开浏览器原生完整候选菜单。
* 🪟 **Windows 纯静默底层守护（Zero Task-UI Overhead）**：
  * 守护进程（19823）在 Windows 平台采用 WMI 机制完全脱离会话终端与进程树独立运行，彻底杜绝聊天面板侧边栏出现转圈常驻的「后台任务 (Start daemon process)」项；
  * 保留精准生命周期心跳：每 20 秒检测客户端状态，在 Antigravity 软件完全关闭 2 分钟后自动优雅退出释放内存，绝不残留死锁后台垃圾。
* 🔄 **全面适配 Antigravity v2.27+ 最新版 & 自动版本检测体系**：
  * 实测全面兼容 Google Antigravity v2.27.0 最新发布版；
  * 新增 `tools/detect-version.cjs` 引擎，每次项目变更与部署自动检测系统已安装 Antigravity 真实版本号并自适应同步版本范围声明。
* 📖 **深度完善抗更新官方文档与一键自愈指南**：
  * 在 README 中新增《Antigravity 升级更新后对本项目是否有影响？》专章，系统性阐述数据独立存储、内存热注入架构以及万一遇到覆盖时的一秒自愈唤醒词。

### v2.4.5 (2026-10-28)
* 📊 **智能双周期配额比例联动**：
  * 针对官方模型（Gemini / Claude / GPT），右下角配额指示胶囊优化为 **优先显示 5 小时比例，同时展示周剩余比例**（如 `账号名 · 5h 80% / 周 68%`）；
  * 智能自适应周期支持：当所选模型（如特定专属模型）官方仅分配单周期配额时，自动自适应展示单周期比例（如 `账号名 · 周 9%`）；
  * 配额状态灯智能预警：当 5 小时或周额度任一项低于 10% 时，状态点自动呈现橙红灯预警，健康时保持绿灯。
* 🌐 **自定义中转模型服务商名称直显**：
  * 当选用第三方中转 API 模型时，胶囊动态提取并直显当前模型所属的平台服务商名称（如站点域名或自定义服务商名称），不显示虚假的官方百分比；
  * 悬浮提示框直观展示当前模型名称、服务商名称及通信协议模式。

### v2.4.4 (2026-10-27)
* 🔄 **浏览器级事件看门狗（Browser-level CDP Watchdog）**：
  * 适配 Antigravity Electron 架构，建立持久事件监听通道；
  * 在窗口刷新（Ctrl+R）或账号切换后毫秒级自动重载汉化与增强组件，彻底解决页面重载后语言或增强套件失效的问题。
* ⚡ **多账号平滑无感热切换与语言服务协同**：
  * 优化切换流程，消除旧端口访问冲突与页面空白，实现多账号秒级平滑过渡。

### v2.4.3 (2026-10-26)
* ⚡ **根除 React 19 崩溃黑屏问题（Zero-Crash / Zero-BlackScreen）**：
  * 彻底禁用了对 React Fiber / Provider `setState` 内部状态的侵入式猴子补丁；
  * 全面采用隔离安全的纯 DOM 流式气泡渲染，绝不触碰 Antigravity 官方 React 协调树，彻底根除页面加载或点击时白屏/黑屏问题。

### v2.4.2 (2026-10-26)
* 🛡️ **修复 Chrome 浏览器授权卡片挂载位置与超时卡死问题**：
  * 将权限确认卡片直接锚定在输入框顶部（Composer）显眼位置，解决在 React 投影模式下卡片未被可见 DOM 渲染导致无法点击授权的问题；
  * 授权选项默认勾选「记住本次会话」，一次授权全场畅通；
  * 超时时间由 120 秒优化为 45 秒，超时或取消后自动释放状态，杜绝会话卡死。

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
