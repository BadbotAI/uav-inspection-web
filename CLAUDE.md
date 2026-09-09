# uav-inspection-web（仓储无人机巡检 · 网页端数据中心原型）

完整开发指南：`../../项目文档/00_项目记忆-AI开发指南.md`（目录结构、代码地图、产品口径、坑清单都在那里，先读它）。

本仓库速则：

- 改动后 `npx tsc -b && npm run build` → push main 自动 Pages 部署（无桌面包同步）。
- 导航固定三项：同步数据 /sync、任务数据 /tasks、数据分析 /analysis（HashRouter，GH Pages 需要）。
- 禁用 emoji 与装饰性 unicode；下拉框用自绘 Select（ui.tsx），不用系统控件；颜色走 tokens.css 变量。
- `types.ts`、`data/sync.ts`（同步码算法）、`mock/shift.ts`（时间平移）与 uav-inspection-app 必须一致；`mock/history.ts` 合成任务 id 永远用原始日期（否则同步码天天变）。
- `T-20260727-01` 故意不在初始任务库：留给"手机端复制同步码 → 网页端同步"演示闭环，别加进 INITIAL_LIBRARY。
- 不要把大视频文件拷入 public/photos（push 会被网络重置）。
- 研究员已判死的能力不许加回：置信度/遮挡说明/逐次精度与误差列、扫描方式标签等。
