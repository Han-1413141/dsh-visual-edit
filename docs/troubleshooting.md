# Troubleshooting / 故障处理

| Symptom / 现象 | Action / 处理 |
|---|---|
| Visual Edit is absent / 找不到入口 | Install into the profile you actually run, restart DSH, and refresh the browser. This release targets DSH 0.2.0-rc.2 Web. 确认安装的是当前启动的 profile。 |
| Page is visible but not connected / 页面能显示，仍未连接 | Add `visualEdit()` to the app's Vite config and restart Vite. Check that `allowedOrigins` contains the exact DSH origin, including its port. `localhost` and `127.0.0.1` are different origins. 修改后点击“刷新页面”。 |
| Page cannot be embedded / 页面无法嵌入 | Check the app's CSP `frame-ancestors`, `X-Frame-Options`, and HTTPS/mixed-content policy. Configure a development-only exception for the exact local DSH origin if the app permits it. Do not broadly relax production headers. |
| Source is unavailable / 没有源码位置 | Use a local `.jsx` or `.tsx` file within Vite's root. Runtime-created DOM, other frameworks, and dependency components can lack a direct source location. Agent 可以先使用选择器和元素文字定位。 |
| Source points to a parent / 指向父元素 | This is the nearest annotated JSX DOM ancestor. Inspect the element and its styles before editing. 样式定义的位置不一定与 JSX 相同。 |
| Result capture rejects a page / 无法获取结果 | Restore the original URL, including query/hash, and the original Desktop/Mobile viewport. If the source moved without a stable element ID, create new feedback. |
| Wrong item after list reorder / 列表重排后对象不一致 | Use stable IDs or `data-testid` on list items. A unique positional selector alone cannot prove item identity. 重新点选并建立新意见。 |
| No image / 没有外观图片 | Private inputs, elements over 1600 × 1600, cross-origin assets, canvas, web fonts, or CSP can prevent capture. Source/text/style facts still work. These are DOM-rendered snapshots. |
| Composer changed / 输入框冲突 | Try Add to chat again once the composer is idle. Existing draft content is preserved; the plugin does not submit it automatically. |
| Another tab changed a note / 其他标签页已修改 | Unsaved text stays in the editor and saving is blocked. Copy your text if needed, then use Load latest note before editing again. “读取最新意见”会替换编辑框中的文字，不会静默覆盖另一页的记录。 |
| Text was added but status could not be saved / 已加入输入框但保存状态失败 | Check the native draft before clicking Add to chat again; the inserted text is already there. 先查看输入框，避免重复添加。 |
| Text or controls are small / 预览中的元素太小 | Use Actual size to keep the original viewport scale, or enlarge a saved snapshot. “实际大小”只改变显示缩放，不改变桌面或手机视口。 |
| Appearance differs from the OS / 与系统深浅色不一致 | Visual Edit follows DSH's Settings → General → Appearance preference, including explicit Light or Dark. 请检查 DSH 的“通用设置 → 外观”。 |
| Storage unavailable / 存储不可用或已满 | Export visible notes, remove old notes, and check browser storage permissions. Private browsing may have restrictive quotas. |
| Notes disappeared / 看不到旧意见 | Use the same browser profile, DSH origin, and DSH session. Changing `localhost` to `127.0.0.1` creates a different browser storage origin. |

For a bug report, include the DSH version/profile, Vite/React/browser versions, the action that failed, and a minimal reproduction without API keys or private page data. Screenshots and exported notes can contain your page content; review them before sharing.

## Remove the plugin

```sh
dsh plugin --profile web remove dsh-visual-edit
```

Remove `visualEdit()` and its import from your Vite config, then run `npm uninstall -D dsh-visual-edit` in that project. Restart both services. Local feedback remains in that DSH origin's browser storage until you delete the notes or clear its `dsh-visual-edit-v1` IndexedDB database.
