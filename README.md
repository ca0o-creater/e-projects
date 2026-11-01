# 嫦娥奔月 · 舞台测试

Vite + TypeScript + PixiJS v8 展位全屏舞台。初始显示深棕色幕布与“进入体验”按钮，点击后进入全屏并启动舞台；按 Esc 退出后隐藏舞台、暂停 PixiJS ticker，恢复进入按钮。

舞台逻辑尺寸固定为 1920×1080，按 `Math.min(窗口宽 / 1920, 窗口高 / 1080)` 等比缩放并居中，空余区域保持深棕色。保留中央白色标题和左上角实时视口宽高。全屏被拒绝时显示提示，允许再次尝试。

在 PowerShell 中启动：

```powershell
Set-Location -LiteralPath 'C:\Users\曹钰瑄\Desktop\e-projects'
npm.cmd run dev
```

打开 http://127.0.0.1:5173/ 。按 Ctrl+C 停止服务。

PowerShell 中使用 `npm.cmd`，避免系统执行策略拦截 `npm.ps1`；无需修改执行策略。

重新安装锁定的依赖：`npm.cmd ci`。

类型检查并构建：`npm.cmd run build`。生成文件位于 `dist/`。
