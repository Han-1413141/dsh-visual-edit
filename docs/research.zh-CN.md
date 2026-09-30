# 选题依据：在 DSH 中完成网页反馈与结果确认

调研日期：2026-09-30。调研比较了官方接口、四份社区目录、GitHub 仓库元数据与直接竞品的 README。下面区分可核对的现状和产品判断；Star 是当日快照，不能用来预测新项目的增长。

## 结论

选择“点选元素 → 关联源码的修改意见 → 当前 Agent 修改 → 同一元素前后比较 → 用户确认”。先把本地 Vite + React 的一条流程做完整，再根据实际使用反馈扩展框架和宿主版本。

这不是无人涉足的方向。网页预览、元素定位、批注与自动验收都有现有项目；新项目的切入点是把源码、意见和结果确认放进同一个 DSH 侧栏，并把这些步骤做得容易安装、演示和复现。

## 最接近的项目

以下功能来自项目公开描述；“未看到”不等于已确认项目不支持。

| 项目 | 当日 Star | 已有能力与本项目的切入点 |
|---|---:|---|
| [react-grab](https://github.com/aidenybai/react-grab) | 7,645 | 网页元素与源码上下文。它证明这类交互有受众，但总 Star 不能归因于 DSH。 |
| [agentation](https://github.com/benjitaylor/agentation) | 4,820 | 可视化标注与 Agent/MCP 协作，是直接相邻产品。不能把“批注交给 Agent”声称为独创。 |
| [dsh-annotate](https://github.com/BrambleXu/dsh-annotate) | 12 | Chrome 扩展、元素上下文和截图。其 README 把编辑记录列为后续事项。 |
| [DSH-element-source](https://github.com/GULI-lab/DSH-element-source) | 7 | 元素源码定位，并说明代理与相对 API 请求的限制。首版因此直接嵌入本地开发源站。 |
| [dsh-browser](https://github.com/Nono-neko/dsh-browser) | 11 | 浏览器预览和区域批注；公开说明中的页面状态限制说明持续页面状态值得关注。 |
| [dsh-web-preview](https://github.com/zoumutou/dsh-web-preview) | 4 | 启动、预览和批注。仅再做一个网页预览入口很难形成区别。 |
| [dsh-sidebar-annotations](https://github.com/zhxnix/dsh-sidebar-annotations) | 0 | 预览、意见与日志工具，已有高度相关的交互。 |
| [dsh-verify](https://github.com/263311487-ux/dsh-verify) | 2 | 自动验证、视觉差异与报告。自动验收也不能当成空白领域。 |

本项目独立编写，没有复制上述项目代码。`agentation` 的 PolyForm Shield 许可与 MIT 不同，不应直接当作可复制的 MIT 依赖。

## 为什么没有选其他方向

插件急救、兼容检测、会话回滚、费用面板和市场导航已经出现多个实现。例如 [dsh-plugins-fix](https://github.com/SherlockGougou/dsh-plugins-fix)、[DSH-Plugin-Doctor](https://github.com/Xrainsmile/DSH-Plugin-Doctor)、[dsh-turn-rewind](https://github.com/Anionex/dsh-turn-rewind)。继续做同名通用功能，需要先证明更具体的使用优势。

官方文档也已包含浏览器侧栏、浏览器工具提供方和文档预览能力。用户预览页面与模型控制的浏览器不是统一的操作接口，因此首版没有假定可以直接接管所有官方浏览器页签，而是使用明确的 Vite 接入和正式侧栏、输入框接口。

## 对 Star 增长的判断

这个方向适合用一张图解释，也容易用真实前后对比展示。React/Vite 用户群体能够理解它的用途；英文首页、可运行演示和清晰的安装路径有助于别人试用和转发。

但直接 DSH 竞品的 Star 普遍不高。这也可能说明需求规模有限、用户安装成本较高，或社区尚未形成稳定习惯。相邻大型项目的历史积累不能直接迁移成新插件的增长预期。因此，先验证真实复用，再决定是否扩大投入。

首版发布后的建议：

1. 用 README 首屏和真实演示回答“点击后能省哪一步”，把安装错误作为优先修复项。
2. 收集实际项目中的首次连接、完成一次结果确认、再次使用等反馈。首版不加入遥测，通过用户自愿提交的问题和案例了解使用情况。
3. 根据重复出现的需求，选择一个扩展方向：更多框架、桌面版兼容或更稳定的元素匹配。不要同时增加模型路由、工作流编排和自动回滚。
4. 完成实际使用案例后，再考虑向社区目录提交收录请求。发布仓库本身不代表已被官方或社区收录。

## 检索入口

- [DeepSeek Harness 官方仓库](https://github.com/deepseek-ai/deepseek-harness)
- [官方插件交流讨论](https://github.com/deepseek-ai/deepseek-harness/discussions/5120)
- [awesome-dsh-plugin](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin)
- [HackSing/dsh-plugins](https://github.com/HackSing/dsh-plugins)
- [SihanTeng/awesome-deepseek-harness-plugins](https://github.com/SihanTeng/awesome-deepseek-harness-plugins)
- [dshplugin-app/deepseek-harness-plugins](https://github.com/dshplugin-app/deepseek-harness-plugins)

目录检索得到的是候选项目，不是逐个安装后验证过的可用插件清单。选题结论属于基于上述证据作出的产品判断。
