const stack = [
  {
    name: 'Electron',
    description: '桌面壳层、窗口管理与原生能力入口'
  },
  {
    name: 'React',
    description: '渲染进程 UI 组件系统'
  },
  {
    name: 'Vite',
    description: '前端开发服务器、HMR 与打包工具'
  },
  {
    name: 'TypeScript',
    description: '主进程、预加载与前端代码的类型系统'
  },
  {
    name: 'Preload + ContextBridge',
    description: '安全暴露 Electron 与 Node 能力'
  }
];

const commands = [
  'npm run dev',
  'npm run build',
  'npm run typecheck',
  'npm start'
];

export default function App() {
  const { electronInfo } = window;

  return (
    <main className="app-shell">
      <section className="hero-card">
        <span className="hero-badge">TextBridge Cross-Platform Client</span>
        <h1>TextBridge 原型工程已就绪</h1>
        <p className="hero-copy">
          这是一个面向多端扩展的文本翻译客户端原型，当前首版以 Windows 系统级文本翻译闭环为落地方向。
          Electron 主进程负责快捷键、托盘和系统交互，Vite + React 负责配置界面，TypeScript 统一约束跨层类型与业务边界。
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
          <h2>当前开发组件</h2>
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
          <h2>常用命令</h2>
          <ul className="command-list">
            {commands.map((command) => (
              <li key={command}>
                <code>{command}</code>
              </li>
            ))}
          </ul>
          <p className="command-tip">
            开发时优先使用 <code>npm run dev</code>，它会启动 Vite 开发服务器、监听 Electron TypeScript 编译，并在主进程变化后自动重启 TextBridge。
          </p>
        </article>
      </section>
    </main>
  );
}
