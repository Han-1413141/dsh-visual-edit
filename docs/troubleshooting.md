# Troubleshooting / 故障处理

| Symptom / 现象 | Action / 处理 |
|---|---|
| Visual Edit is absent / 找不到入口 | Install into the profile you actually run, restart DSH, and refresh the browser. Use DSH 0.2.0-rc.2 and the right-side preview toolbar; the conversation-header shortcut was removed. 确认安装的是当前启动的 profile。 |
| Page is visible but not connected / 页面能显示，仍未连接 | Native HTML/desktop Browser: reload the page, then toggle Visual Edit. For the standalone compatibility tab, add `visualEdit()` to the app's Vite config and restart Vite. Check that `allowedOrigins` contains the exact DSH origin, including its port. `localhost` and `127.0.0.1` are different origins. 修改后点击“刷新页面”。 |
| Page cannot be embedded / 页面无法嵌入 | Check the app's CSP `frame-ancestors`, `X-Frame-Options`, and HTTPS/mixed-content policy. Configure a development-only exception for the exact local DSH origin if the app permits it. Do not broadly relax production headers. |
| Source is unavailable / 没有源码位置 | Native HTML provides original file coordinates. For Browser JSX/TSX locations, use the optional Vite bridge on files within its root. Runtime-created DOM, other frameworks, and dependency components can lack a direct source location. Agent 可以先使用选择器和元素文字定位。 |
| Source points to a parent / 指向父元素 | This is the nearest annotated JSX DOM ancestor. Inspect the element and its styles before editing. 样式定义的位置不一定与 JSX 相同。 |
| Result capture rejects a page / 无法获取结果 | Native preview: keep the same page open; deleted or changed elements fall back to their original area and viewport changes are labeled. Standalone Vite: restore the original URL and viewport or create a fresh baseline. |
| Automatic comparison is waiting / 一直等待更新 | Send the inserted DSH draft and keep the corresponding preview visible. Save alone leaves a draft. The selected area must actually change; unrelated changes do not recapture it. Confirmed notes stop monitoring. 已加入输入框不代表已经发送。 |
| Page changes but comparison fails / 页面变化后仍未对比 | Check the message above Feedback. Reload the same preview or use Capture result to retry. Keep the native HTML auto-refresh enabled; web development servers must refresh/HMR their page. 自动获取期间不要切走预览标签。 |
| Wrong item after list reorder / 列表重排后对象不一致 | Use stable IDs or `data-testid` on list items. A unique positional selector alone cannot prove item identity. 重新点选并建立新意见。 |
| No image / 没有外观图片 | Upgrade to 0.5.2 if the page contains HTML divider comments (`<!-- ---------- -->`). Reload the preview to retry a failed pending result image once. Private inputs, large elements, cross-origin assets, canvas, web fonts, or CSP can still prevent capture. Source/text/style facts remain available. |
| Before image is still missing / 修改前图片仍缺失 | Use Restore from original HTML with the real earlier file (up to 2 MB). Mismatched text or targets are rejected. Original facts and dates remain; the image is labeled as re-rendered from historical HTML. Without an earlier file or image, start a new comparison. |
| Rectangle clips the heading / 框选切掉标题 | Upgrade to 0.5.2. The crop expands to complete content elements and follows saved targets after layout changes. For old pending notes, reopening the preview refreshes the result automatically. |
| Composer changed / 输入框冲突 | Try Add to chat again once the composer is idle. Existing draft content is preserved; the plugin does not submit it automatically. |
| Another tab changed a note / 其他标签页已修改 | Unsaved text stays in the editor and saving is blocked. Copy your text if needed, then use Load latest note before editing again. “读取最新意见”会替换编辑框中的文字，不会静默覆盖另一页的记录。 |
| A selected batch changed / 批量选择发生冲突 | Clear the selection, review the updated notes and select them again. 合并加入对话使用勾选时的内容版本。 |
| Restore finds no new notes / 恢复时没有新意见 | The destination session already contains those IDs. Existing notes are kept rather than replaced. 可在另一个会话恢复，或继续使用当前记录。 |
| Backup rejected / 无法读取备份 | Use the original exported JSON. Check the 70 MB file limit and 50-note session capacity. Invalid metadata and unsupported or oversized PNGs are rejected. 不需要手动修改会话编号。 |
| Restore fails during saving / 保存恢复结果失败 | The error stays inside the restore dialog. Free browser storage or retry in a suitable browser profile. Failed transactions leave existing notes intact and add no partial records. |
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
