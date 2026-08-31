# 仓储无人机巡检 · 数据中心（网页端原型）

手机端在局域网内离线完成巡检；网页端负责过往数据的归档、检索、查看与下载。
用户在手机端复制任务的**同步码**，粘贴到网页端即可接入该次巡检的过程数据、成果与报告。

- 线上：https://badbotai.github.io/uav-inspection-web/
- 手机端：https://badbotai.github.io/uav-inspection/
- 能力清单与设计说明：`docs/网页端能力清单.md`

## 本地运行

```bash
npm install
npm run dev      # http://localhost:5181
npm run build    # 产物在 dist/
```

## 结构

```
src/
  data/sync.ts        同步码算法（与手机端一致）
  data/process.ts     过程数据 / 附件清单（由任务确定性生成）
  mock/history.ts     任务目录（手机端 4 条 + 按航线生成的历史巡检）
  three/              三维引擎（与手机端同一份）
  components/         外壳、三维查看器、图表、基础组件
  pages/              同步数据 / 任务数据 / 任务详情 / 数据分析 / 下载导出
```

演示闭环：手机端「巡检结果 → 结果报告 → 同步到网页端」复制同步码 → 网页端「同步数据」粘贴 → 任务详情。
今天的任务 `T-20260727-01` 初始未同步，可用于演示该闭环；「同步全部数据」演示后端全量同步能力。
