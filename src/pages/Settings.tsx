// 设置：账号与角色 / 数据策略 / 部署与关于
import { ACCOUNT } from '../store';
import { Card, Section, Tag } from '../components/ui';

function Rows({ rows }: { rows: [string, React.ReactNode][] }) {
  return (
    <Card pad={0} style={{ overflow: 'hidden' }}>
      {rows.map(([k, v], i) => (
        <div key={k} className="flex items-center gap-4" style={{ padding: '11px 16px', borderTop: i > 0 ? '1px solid var(--border-subtle)' : 'none' }}>
          <span style={{ width: 150, fontSize: 13, color: 'var(--text-secondary)' }}>{k}</span>
          <span style={{ fontSize: 13 }} className="flex-1">{v}</span>
        </div>
      ))}
    </Card>
  );
}

export function Settings() {
  return (
    <div className="grid" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 24 }}>
      <div className="flex flex-col gap-6">
        <Section title="账号与角色">
          <Rows rows={[
            ['当前账号', <span className="inline-flex items-center gap-2">{ACCOUNT.org} · {ACCOUNT.name}<Tag tone="info">{ACCOUNT.role}</Tag></span>],
            ['管理员', '接入同步码、下载全部附件、删除任务、管理成员'],
            ['查看者', '检索与查看任务，下载报告 PDF；不可下载原始点云与视频'],
            ['登录方式', '账号密码；私有化部署可对接企业统一身份认证'],
          ]} />
        </Section>
        <Section title="数据策略">
          <Rows rows={[
            ['同步码有效期', <span className="mono">7 天</span>],
            ['网页端归档', <span className="mono">90 天</span>],
            ['下载记录保留', <span className="mono">180 天</span>],
            ['完整性校验', '按附件清单逐项校验 MD5；缺失项在任务详情标出，可在手机端重新生成同步码补传'],
            ['容重（折算重量）', <span className="mono">0.75 t/m³</span>],
          ]} />
        </Section>
      </div>
      <div className="flex flex-col gap-6">
        <Section title="部署与集成">
          <Rows rows={[
            ['部署形态', '私有化部署（当前）；软件组件同时支持 SaaS 化部署'],
            ['与手机端关系', '手机端在局域网离线完成飞行控制、设备连接与数据回传；网页端负责跨网归档、检索与分发'],
            ['数据接口', '任务 / 附件清单 / 报告可经 REST 接口对接仓储管理系统（WMS）'],
            ['导出格式', '三维模型 PCD · 体积结果 JSON · 盘点汇总 JSON · 巡检报告 PDF · 遥测 CSV'],
          ]} />
        </Section>
        <Section title="关于">
          <Rows rows={[
            ['网页端版本', <span className="mono">1.0.0</span>],
            ['适配手机端', <span className="mono">1.0.0 · Android 13 及以上</span>],
            ['浏览器要求', 'Chrome / Edge 110 及以上（三维成果查看需 WebGL 2）'],
          ]} />
        </Section>
      </div>
    </div>
  );
}
