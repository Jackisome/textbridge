import type { ReactNode } from 'react';
import type { ElectronInfo } from '../../shared/types/ipc';

const stack = [
  {
    name: 'Tray Runtime',
    description: '托盘常驻、窗口打开/隐藏与桌面壳层编排。'
  },
  {
    name: 'Global Shortcuts',
    description: '快速翻译与增强翻译两条全局触发路径。'
  },
  {
    name: 'Provider Boundary',
    description: '统一 mock / HTTP provider 请求与错误归一化。'
  },
  {
    name: 'Win32 Adapter',
    description: '辅助进程协议、捕获与回写标准结果边界。'
  }
];

const commands = ['npm run dev', 'npm run build', 'npm run typecheck', 'npm test'];

export interface SettingsPageProps {
  electronInfo: ElectronInfo;
  runtimePanel?: ReactNode;
}

export function SettingsPage({ electronInfo, runtimePanel }: SettingsPageProps) {
  return (
    <main className="app-shell settings-shell">
      <section className="hero-card">
        <span className="hero-badge">Windows Text Translation MVP</span>
        <h1>TextBridge 控制台</h1>
        <p className="hero-copy">
          当前页面聚焦于 Windows 首版闭环：常驻托盘、快捷键触发、辅助进程捕获与回写，以及失败后的弹窗兜底。
        </p>

        <div className="version-grid">
          <article>
            <strong>Electron</strong>
            <span>{electronInfo.electron}</span>
          </article>
          <article>
            <strong>Node.js</strong>
            <span>{electronInfo.node}</span>
          </article>
          <article>
            <strong>Chromium</strong>
            <span>{electronInfo.chrome}</span>
          </article>
          <article>
            <strong>Platform</strong>
            <span>{electronInfo.platform}</span>
          </article>
        </div>
      </section>

      <section className="content-grid">
        <article className="panel">
          <h2>当前能力</h2>
          <div className="stack-list">
            {stack.map((item) => (
              <div className="stack-item" key={item.name}>
                <h3>{item.name}</h3>
                <p>{item.description}</p>
              </div>
            ))}
          </div>
        </article>

        <article className="panel">
          <h2>开发命令</h2>
          <ul className="command-list">
            {commands.map((command) => (
              <li key={command}>
                <code>{command}</code>
              </li>
            ))}
          </ul>
          <p className="command-tip">
            默认界面承担设置和诊断入口；上下文弹窗与 fallback 结果窗口由独立页面形态承载。
          </p>
        </article>
      </section>

      {runtimePanel ? <section className="runtime-slot">{runtimePanel}</section> : null}
    </main>
  );
}
