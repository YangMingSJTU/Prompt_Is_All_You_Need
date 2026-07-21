/* eslint-disable @next/next/no-img-element -- Raw public assets support both Worker and GitHub Pages builds. */

const repositoryUrl = "https://github.com/YangMingSJTU/Prompt_Is_All_You_Need";

const spells = [
  ["代码审查", "检查边界、回归风险与测试缺口", "⌘ 1"],
  ["需求澄清", "把模糊想法变成可执行清单", "⌘ 2"],
  ["发布检查", "验证构建、差异与交付状态", "⌘ 3"],
];

const workflow = [
  {
    index: "01",
    title: "从本地记录里发现",
    body: "扫描 Codex 与 Claude 历史，只提取你的输入，自动汇成待整理的候选咒语。",
    meta: "SCAN HISTORY",
  },
  {
    index: "02",
    title: "把好提示沉淀下来",
    body: "保留原始正文，整理重复出现的工作方法；复制时不增加任何多余包装。",
    meta: "KEEP THE SOURCE",
  },
  {
    index: "03",
    title: "让能力随手可取",
    body: "用全局快捷键唤起闪念施法，或将多文件技能打包并安装到目标平台。",
    meta: "CAST ANYWHERE",
  },
];

const safeguards = [
  ["提示词", "留在本机 SQLite 数据库"],
  ["历史扫描", "只读取用户输入内容"],
  ["技能安装", "目标已存在时拒绝覆盖"],
  ["远程服务", "默认不上传、不调用远程模型"],
];

function Arrow() {
  return <span aria-hidden="true">↗</span>;
}

export default function Home() {
  return (
    <main id="top">
      <a className="skip-link" href="#content">
        跳到主要内容
      </a>

      <nav className="site-nav" aria-label="主导航">
        <a className="brand-lockup" href="#top" aria-label="Spellbook 魔法书首页">
          <span className="brand-mark">
            <img src="/app-icon.png" alt="" />
          </span>
          <span className="brand-name">
            <strong>Spellbook</strong>
            <small>魔法书</small>
          </span>
        </a>

        <div className="nav-links">
          <a href="#features">能力</a>
          <a href="#workflow">工作流</a>
          <a href="#local-first">本地优先</a>
        </div>

        <a className="nav-action" href={repositoryUrl} target="_blank" rel="noreferrer">
          GitHub <Arrow />
        </a>
      </nav>

      <div id="content">
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero-aura hero-aura-one" aria-hidden="true" />
          <div className="hero-aura hero-aura-two" aria-hidden="true" />

          <div className="hero-copy">
            <p className="hero-kicker">
              <span /> Local-first · Desktop · Open source
            </p>
            <h1 id="hero-title">
              让每一次好提示，
              <em>沉淀成你的能力。</em>
            </h1>
            <p className="hero-lede">
              Spellbook 魔法书，把可复制的提示词与可迁移的 Agent 技能，整理进一个安静、快速、只属于你的本地工作台。
            </p>
            <div className="hero-actions">
              <a className="button button-primary" href={repositoryUrl} target="_blank" rel="noreferrer">
                查看开源项目 <Arrow />
              </a>
              <a className="button button-secondary" href="#workflow">
                看它如何工作 <span aria-hidden="true">↓</span>
              </a>
            </div>
            <p className="hero-note">
              <span aria-hidden="true">✦</span> 为重度使用 Codex 与 Claude Code 的开发者而做
            </p>
          </div>

          <div className="hero-visual" aria-label="Spellbook 桌面应用界面示意">
            <div className="orbit orbit-one" aria-hidden="true" />
            <div className="orbit orbit-two" aria-hidden="true" />
            <div className="floating-note note-top" aria-hidden="true">
              <span>SKILL.md</span>
              <b>12 files</b>
            </div>
            <div className="floating-note note-bottom" aria-hidden="true">
              <span>LOCAL ONLY</span>
              <b>✓ Protected</b>
            </div>

            <div className="app-shell">
              <div className="app-topbar">
                <div className="window-dots" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                </div>
                <span>Spellbook</span>
                <kbd>Ctrl ⇧ Space</kbd>
              </div>

              <div className="app-body">
                <aside className="app-sidebar" aria-hidden="true">
                  <div className="app-logo">
                    <img src="/app-icon.png" alt="" />
                  </div>
                  <span className="sidebar-item active">✦</span>
                  <span className="sidebar-item">⌁</span>
                  <span className="sidebar-item">◇</span>
                  <span className="sidebar-item">⌘</span>
                  <span className="sidebar-item sidebar-bottom">•••</span>
                </aside>

                <section className="command-panel">
                  <div className="command-heading">
                    <div>
                      <small>QUICK CAST</small>
                      <strong>闪念施法</strong>
                    </div>
                    <span>24 个咒语</span>
                  </div>

                  <div className="command-search">
                    <span aria-hidden="true">⌕</span>
                    <b>搜索你的咒语…</b>
                    <kbd>ESC</kbd>
                  </div>

                  <div className="spell-list">
                    {spells.map(([title, description, shortcut], index) => (
                      <div className={`spell-item${index === 0 ? " selected" : ""}`} key={title}>
                        <span className="spell-glyph" aria-hidden="true">
                          {index === 0 ? "✦" : index === 1 ? "⌁" : "◇"}
                        </span>
                        <span className="spell-copy">
                          <b>{title}</b>
                          <small>{description}</small>
                        </span>
                        <kbd>{shortcut}</kbd>
                      </div>
                    ))}
                  </div>

                  <div className="command-footer">
                    <span>
                      <kbd>↑↓</kbd> 选择
                    </span>
                    <span>
                      <kbd>↵</kbd> 复制正文
                    </span>
                    <b>仅保存在本机</b>
                  </div>
                </section>
              </div>
            </div>
          </div>

          <div className="hero-scroll" aria-hidden="true">
            <span>SCROLL TO DISCOVER</span>
            <i />
          </div>
        </section>

        <section className="principle-rail" aria-label="产品原则">
          <p>Built for focused makers</p>
          <div>
            <span>本地优先</span>
            <i>✦</i>
            <span>原文复制</span>
            <i>✦</i>
            <span>技能可迁移</span>
            <i>✦</i>
            <span>Windows / macOS</span>
          </div>
        </section>

        <section className="manifesto section-shell" aria-labelledby="manifesto-title">
          <p className="section-index">01 / WHY SPELLBOOK</p>
          <div>
            <h2 id="manifesto-title">
              真正有价值的，不是又一次对话。
              <span>是你在对话中形成的方法。</span>
            </h2>
            <p>
              好提示散落在聊天记录里，技能埋在不同目录中，下一次又从空白开始。Spellbook 把这些可复用资产从历史里找回来，放进一个能搜索、能复制、能迁移的本地系统。
            </p>
          </div>
        </section>

        <section className="features section-shell" id="features" aria-labelledby="features-title">
          <div className="section-heading">
            <div>
              <p className="section-index">02 / CORE EXPERIENCE</p>
              <h2 id="features-title">两类资产，一套清晰工作流。</h2>
            </div>
            <p>咒语保持纯文本，技能保留完整目录。语义不混淆，操作才会简单直接。</p>
          </div>

          <div className="bento-grid">
            <article className="bento-card spell-card">
              <div className="card-number">01</div>
              <div className="card-copy">
                <p className="card-label">SPELL LIBRARY · 咒语库</p>
                <h3>每一句好提示，都能被再次找到。</h3>
                <p>搜索正文、描述与标签，从快捷面板一键复制纯文本，不添加标题或包装。</p>
              </div>
              <div className="spell-stack" aria-hidden="true">
                <div className="paper-card paper-back">
                  <span># Release</span>
                </div>
                <div className="paper-card paper-middle">
                  <span># Review</span>
                </div>
                <div className="paper-card paper-front">
                  <div>
                    <span>CODE REVIEW</span>
                    <b>先检查边界条件与回归风险，再给出修复建议。</b>
                  </div>
                  <small>Copied as plain text</small>
                </div>
              </div>
            </article>

            <article className="bento-card skill-card">
              <div className="card-number">02</div>
              <div className="card-copy">
                <p className="card-label">SKILL LIBRARY · 技能库</p>
                <h3>让技能带着完整上下文迁移。</h3>
                <p>扫描、查看、打包、安装多文件 Agent Skill，相对目录始终保持原样。</p>
              </div>
              <div className="file-browser" aria-hidden="true">
                <div className="file-title">
                  <span>⌄</span>
                  <b>code-review</b>
                  <small>8 files</small>
                </div>
                <div className="file-row active">
                  <span>◇</span> SKILL.md <i>4.2 KB</i>
                </div>
                <div className="file-row">
                  <span>⌄</span> scripts <i>3</i>
                </div>
                <div className="file-row nested">
                  <span>⌘</span> analyze.ts
                </div>
                <div className="file-row">
                  <span>›</span> templates <i>2</i>
                </div>
                <div className="file-action">
                  <span>Claude</span>
                  <b>打包技能 ↗</b>
                </div>
              </div>
            </article>

            <article className="bento-card scanner-card">
              <div className="card-number">03</div>
              <div className="scanner-visual" aria-hidden="true">
                <div className="scan-orbit">
                  <div className="scan-core">✦</div>
                </div>
                <div className="scan-source source-one">Codex</div>
                <div className="scan-source source-two">Claude</div>
                <div className="scan-result">12 个候选咒语</div>
              </div>
              <div className="card-copy">
                <p className="card-label">LOCAL SCANNER</p>
                <h3>从历史里找回你的高频方法。</h3>
                <p>只提取用户输入，不把助手回复或工具结果混进候选正文。</p>
              </div>
            </article>

            <article className="bento-card analytics-card">
              <div className="card-number">04</div>
              <div className="card-copy">
                <p className="card-label">CAST ANALYTICS</p>
                <h3>看见真正有用的工作资产。</h3>
                <p>复制次数与常用咒语只记录在本地，让高频方法自然浮出水面。</p>
              </div>
              <div className="usage-chart" aria-hidden="true">
                <div className="chart-head">
                  <span>本周施法</span>
                  <b>仅本机</b>
                </div>
                <div className="bars">
                  {[38, 56, 44, 74, 62, 91, 78].map((height, index) => (
                    <i key={index} style={{ "--bar-height": `${height}%` } as React.CSSProperties} />
                  ))}
                </div>
                <div className="chart-days">
                  <span>M</span><span>T</span><span>W</span><span>T</span><span>F</span><span>S</span><span>S</span>
                </div>
              </div>
            </article>
          </div>
        </section>

        <section className="workflow-section" id="workflow" aria-labelledby="workflow-title">
          <div className="workflow-glow" aria-hidden="true" />
          <div className="section-shell">
            <div className="section-heading light-heading">
              <div>
                <p className="section-index">03 / YOUR FLOW</p>
                <h2 id="workflow-title">从一次好对话，到随手可用的能力。</h2>
              </div>
              <p>没有复杂知识库，也没有强迫你改变习惯。Spellbook 只在最需要的时候出现。</p>
            </div>

            <div className="workflow-list">
              {workflow.map((step) => (
                <article key={step.index}>
                  <span className="workflow-index">{step.index}</span>
                  <div>
                    <small>{step.meta}</small>
                    <h3>{step.title}</h3>
                    <p>{step.body}</p>
                  </div>
                  <span className="workflow-arrow" aria-hidden="true">↘</span>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="local-section section-shell" id="local-first" aria-labelledby="local-title">
          <div className="local-copy">
            <p className="section-index">04 / LOCAL FIRST</p>
            <h2 id="local-title">
              你的方法论，
              <span>不需要离开这台电脑。</span>
            </h2>
            <p>
              Spellbook 从一开始就按本地优先设计。没有账号墙，没有云端同步依赖，也不会为了“智能”把你的工作记录发送给远程模型。
            </p>
            <div className="privacy-badge">
              <span aria-hidden="true">✓</span>
              <div>
                <b>Local-first by default</b>
                <small>数据边界清晰，可随时检查</small>
              </div>
            </div>
          </div>

          <div className="terminal-card" aria-label="本地数据边界说明">
            <div className="terminal-top">
              <span className="terminal-dots"><i /><i /><i /></span>
              <b>privacy-check</b>
              <small>LOCAL</small>
            </div>
            <div className="terminal-body">
              <p><span>$</span> spellbook inspect --privacy</p>
              <div className="terminal-rule" />
              {safeguards.map(([label, value]) => (
                <div className="terminal-row" key={label}>
                  <span>✓</span>
                  <b>{label}</b>
                  <small>{value}</small>
                </div>
              ))}
              <div className="terminal-path">
                <span>DATABASE</span>
                <code>~/.spellbook/index.sqlite</code>
              </div>
            </div>
          </div>
        </section>

        <section className="closing-section section-shell" aria-labelledby="closing-title">
          <div className="closing-symbol" aria-hidden="true">
            <img src="/app-icon.png" alt="" />
            <i />
            <i />
          </div>
          <p className="section-index">THE BOOK IS OPEN</p>
          <h2 id="closing-title">
            下一次，不必从空白开始。
            <span>把好方法，留在魔法书里。</span>
          </h2>
          <p>开源、本地优先，为 Windows 与 macOS 桌面工作流而设计。</p>
          <a className="button button-primary closing-action" href={repositoryUrl} target="_blank" rel="noreferrer">
            在 GitHub 查看 Spellbook <Arrow />
          </a>
        </section>
      </div>

      <footer className="site-footer">
        <a className="brand-lockup footer-brand" href="#top">
          <span className="brand-mark"><img src="/app-icon.png" alt="" /></span>
          <span className="brand-name"><strong>Spellbook</strong><small>魔法书</small></span>
        </a>
        <p>把可复制的提示词与可迁移的 Agent 技能，整理进一本本地魔法书。</p>
        <div>
          <a href="#features">能力</a>
          <a href="#local-first">隐私</a>
          <a href={repositoryUrl} target="_blank" rel="noreferrer">GitHub ↗</a>
        </div>
      </footer>
    </main>
  );
}
