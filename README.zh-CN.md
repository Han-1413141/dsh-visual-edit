# DSH Visual Edit · 网页点选修改

**在 DSH 右侧预览中选元素、画箭头或框选区域，提交意见后自动查看前后效果。**

[English](README.md) · [下载 v0.5.1](https://github.com/Han-1413141/dsh-visual-edit/releases/tag/v0.5.1) · [反馈问题](https://github.com/Han-1413141/dsh-visual-edit/issues)

[![CI](https://github.com/Han-1413141/dsh-visual-edit/actions/workflows/ci.yml/badge.svg)](https://github.com/Han-1413141/dsh-visual-edit/actions/workflows/ci.yml)

[DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 的网页反馈插件。直接使用已经打开的 HTML 预览或桌面端浏览器，界面沿用 DSH 的字体、颜色、圆角和深浅色设置。入口位于右侧预览工具栏，会话标题栏不再添加按钮。

<img src="docs/images/native-modes.png" alt="真实 DSH HTML 预览中的元素、箭头和框选工具栏" width="1100" />

## 使用流程

1. 在 DSH 右侧打开 HTML 文件，或在桌面端“浏览器”中打开网页。
2. 点击预览工具栏的“点选修改”，选择一种标注方式。
3. 写下修改要求，点击“加入对话并自动对比”。意见会插入当前输入框，已有草稿保留。
4. 在 DSH 中发送意见。Agent 修改文件、预览刷新后，插件自动获取结果并显示两张快照。
5. 查看前后变化；点击快照可放大或叠加比较，满意后点“确认结果”。

| 标注方式 | 操作 | 记录内容 |
|---|---|---|
| 元素 | 点击标题、按钮等元素 | 元素定位、文字、样式、源码位置和画面 |
| 箭头 | 从起点拖向目标 | 箭头、目标元素及周边区域 |
| 框选 | 拖出任意矩形 | 矩形内的页面内容和区域坐标 |

`Ctrl / ⌘ + Enter` 执行意见框的主要操作，`Esc` 取消选取。“保存意见”可以先保存草稿；“保存并继续点选”适合连续记录，再把多条意见合并加入对话。

自动对比针对已加入输入框、尚未确认的意见。它监测标注区域的文字、布局和样式变化，支持 HTML 预览重载与浏览器 DOM 更新。区域外的时钟更新不会重复生成元素快照。关闭标注浮层后仍可继续捕获；切到其他预览标签时暂停，返回后继续。确认完成后停止自动更新该条记录。

“已加入输入框”表示草稿已插入；页面变化也不等于模型已经正确完成任务，结果仍由你确认。

<img src="docs/images/native-auto-compare.png" alt="真实 DSH 中修改文件后自动显示的前后对比" width="1100" />

## 安装

支持 DSH **0.2.0-rc.2**。安装包已经包含预览接入脚本与客户端依赖；原生 HTML 预览和桌面端浏览器无需修改网页项目配置。安装由 DSH 插件管理器及其包管理器处理依赖。

从 GitHub Releases 使用完整包地址安装。桌面端应先通过“应用 → 退出”完整退出，再使用桌面应用附带的 `dsh` 命令：

```sh
dsh plugin --profile desktop add https://github.com/Han-1413141/dsh-visual-edit/releases/download/v0.5.1/dsh-visual-edit-0.5.1.tgz
```

重新打开桌面端。Windows 的附带命令位于安装目录的 `resources/runtime/cli/bin/dsh.cmd`。DSH Web 改用 `--profile web`，然后重启服务并刷新页面。

插件通过 **GitHub Releases** 分发，没有把裸命令 `npm install dsh-visual-edit` 作为安装方式。安装不会改动桌面应用程序文件。卸载后宿主原来的预览组件继续工作。

### 从旧版升级

用新包地址重新安装插件并重启 DSH。已有意见和快照沿用原来的 IndexedDB 格式。请使用相同浏览器或桌面配置、DSH 地址和会话访问原记录。旧版备份仍可恢复；已加入输入框的备份记录恢复为草稿，避免误认为目标会话已经发送过意见。

v0.5.1 修复了页面中含有 `<!-- ---------- -->` 等分隔注释时无法生成快照的问题。重新加载预览后，尚未确认且生成失败的“修改后”图片会自动重试一次。当时未保存的“修改前”图片无法从当前页面补回，界面会明确说明；重新点选即可开始新的对比。图片不完整时不再提示完整的效果对比已成功。

### 可选：Vite / React 源码定位

原生 HTML 预览会标注原 HTML 文件行列。桌面端浏览器可以直接标注任意已加载的 HTTP(S) 网页；若需要 React JSX/TSX 源码位置，在网页项目中接入开发插件：

```sh
npm install -D https://github.com/Han-1413141/dsh-visual-edit/releases/download/v0.5.1/dsh-visual-edit-0.5.1.tgz
```

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { visualEdit } from 'dsh-visual-edit/vite';

export default defineConfig({
  plugins: [visualEdit(), react()],
});
```

修改后重启 Vite。只在开发模式注入，生产构建不带接入脚本或源码标记。

DSH Web 中的独立“网页点选修改”标签仍保留，适用于本地 Vite 项目。该兼容入口使用原来的元素选择和手动获取结果流程，要求网页与 DSH 不同源；默认允许 DSH 的本地 `3080` 端口。其他端口配置 `visualEdit({ allowedOrigins: ['http://127.0.0.1:3086'] })`。三种标注与自动对比在原生预览工具栏中使用。

## 对比与记录

- 自动保留最初的画面；后续更新替换“修改后”快照，确认后固定记录。
- 原元素删除或定位信息不再匹配时，原生预览显示原位置的区域快照并注明原因。预览尺寸变化也会明确标注。
- “获取修改结果”保留为手动刷新入口，可在页面已更新时立即获取。
- 支持搜索、状态筛选、多条意见合并、JSON 导出与恢复、多个窗口间的修改冲突检测。
- 每个会话最多 50 条；备份文件上限 70 MB。恢复前预览内容，已有编号跳过。

## 数据与范围

快照和意见保存在当前 DSH 客户端的 IndexedDB 中。加入 Agent 草稿的是意见、源码位置、选择器、文字、样式和标注坐标，不包含 PNG 图片。发送仍使用 DSH 已配置的模型。

表单输入、可编辑内容及 `data-private` / `data-visual-edit-private` 元素会从文字和截图中排除。URL 查询参数和片段不进入意见文本。原生 HTML 保持 DSH 的文件权限和预览设置；静态预览只运行插件的接入脚本，页面自己的脚本仍被阻止。

| 项目 | 范围 |
|---|---|
| 原生 HTML | DSH 0.2.0-rc.2 HTML 预览；接入、源码行列、真实文件刷新与自动对比已在真实 DSH Web 验证 |
| 桌面浏览器 | 通过 Electron webview 在当前页面接入；桌面端实机验证范围见[验证记录](docs/validation.md) |
| 图片 | DOM 生成的 PNG，最多 1600 × 1600，data URL 上限 650,000 字符 |
| 区域 | 文档坐标；箭头、框选在修改前后使用相同区域 |
| 旧版 Vite 标签 | 本地 Vite 6.4 / React；手动获取结果需要相同地址、视口及有效元素定位 |

跨域子 iframe、Shadow DOM、canvas/WebGL、外部字体等不能保证完整还原。远程资源或页面 CSP 可能阻止图片生成，此时显示原因并保留可用的文字和位置。快照用于反馈与人工比较，不是浏览器逐像素截图测试。列表重排建议给元素设置稳定 ID 或 `data-testid`。

## 开发

```sh
npm ci
npm run build
npm run typecheck
npm test
npx playwright install chromium
npm run test:browser
npm run demo:build
```

`npm run demo` 启动示例页面，地址为 `http://127.0.0.1:5179`。Linux 浏览器安装可用 `npx playwright install --with-deps chromium`。

- [验证记录](docs/validation.md)
- [架构与数据流](docs/architecture.md)
- [故障处理](docs/troubleshooting.md)
- [界面设计](docs/ui-design.zh-CN.md)
- [选题调研](docs/research.zh-CN.md)

MIT；依赖许可见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
