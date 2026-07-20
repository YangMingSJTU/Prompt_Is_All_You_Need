# PRD：Spellbook 魔法书 Desktop MVP

## 1. 产品概述

- 产品名：`Spellbook 魔法书`
- 副标题：`AI 提示词与技能管理器`
- 版本：`v0.1`
- 形态：Electron + React + SQLite 本地桌面应用
- 目标用户：重度使用 Codex、Claude Code 等 coding agent 的开发者

Spellbook 聚焦两类核心资产：

- `Spell / 咒语`：用户会直接复制给模型的一段纯文本。
- `Skill / 技能`：Claude/Codex 可安装调用的本地多文件能力包。

第一版不考虑历史兼容，直接使用新的本地数据库和语义模型。

## 2. 产品原则

- 本地优先：默认不上传数据、不调用远程 LLM。
- 资产语义清晰：咒语是纯文本，技能是目录包，两者分开管理。
- 来源不等于资产类型：Claude/Codex 历史、技能目录都只是来源。
- 操作文案直接：复制、扫描、打包、安装，不使用夸张魔法词。
- UI 克制：允许少量书本和低饱和金色 accent，不影响工具效率。

## 3. MVP 功能

### 3.1 闪念施法

- 只服务咒语。
- 支持搜索、键盘选择、复制到剪贴板。
- 默认快捷键 `Ctrl+Shift+Space`，用户可在设置中修改。
- 闪念施法位置支持屏幕居中和跟随鼠标。

### 3.2 咒语库

- 展示已保存咒语。
- 搜索标题、标签、描述和正文。
- 复制时只写入 `body` 原文。
- 展示候选咒语，并允许保存为正式咒语。
- 第一版不提供咒语文件导出，也不从咒语生成技能。

### 3.3 技能库

- 扫描本地 Claude/Codex 技能目录。
- 展示技能名称、描述、平台、根目录和文件结构。
- 支持将技能目录打包为 zip，保留相对路径。
- 支持安装到 Claude 或 Codex 技能目录。
- 目标已存在时不覆盖，返回冲突提示。

默认目录：

- Claude：`~/.claude/skills`
- Codex：`$HOME/.agents/skills`

Codex 路径遵循官方 Agent Skills 文档：[Agent Skills](https://developers.openai.com/codex/skills)。

### 3.4 本地扫描

- 扫描 Claude/Codex 本地历史。
- 只提取用户输入内容。
- 根据常见任务模式生成候选咒语。
- 不读取 assistant/tool-result 内容作为候选正文。

### 3.5 施法统计

- 统计咒语数量、技能数量、候选数量、复制次数。
- 展示常用咒语。
- 数据仅保存在本地 SQLite。

### 3.6 设置

- 中英文切换：跟随系统、中文、English。
- 快捷键设置：用户可录入自定义快捷键，并检测系统注册冲突。
- 闪念施法位置：屏幕居中、跟随鼠标。
- 本地数据：展示数据库、历史目录、技能目录。

## 4. 数据模型

### Spell

```ts
type Spell = {
  id: string;
  body: string;
  source: string;
  createdAt: string;
  updatedAt: string;
};
```

### SkillRecord

```ts
type SkillRecord = {
  id: string;
  platform: 'claude' | 'codex';
  name: string;
  description: string;
  rootPath: string;
  entryFilePath: string;
  fileCount: number;
  files: string[];
  updatedAt: string;
  packageable: boolean;
  installState: 'installed' | 'missing';
};
```

## 5. 本地存储

- 数据目录：Electron `userData/data/`
- SQLite：Electron `userData/data/index.sqlite`
- 技能包输出：Electron `userData/data/packages/`

SQLite 表：

- `spells`
- `candidates`
- `usage_events`
- `source_files`
- `skills`
- `app_settings`

`spells` 只保存咒语原文 `body` 和必要系统字段；不保存标题、描述、标签或文件化元数据。

`usage_events` 使用 `spell_id` 关联咒语复制事件。

## 6. IPC / Preload

Renderer bridge：`window.spellbook`

- `spells:search/list/popular/copy`
- `candidates:list/promote`
- `scanner:run`
- `analytics:get`
- `skills:list/scan/package/install`
- `settings:get/update/info`

## 7. 验收标准

- UI 品牌显示为 `Spellbook 魔法书`。
- 导航为闪念施法、咒语库、技能库、本地扫描、施法统计、设置。
- 用户可见文案不再使用旧产品名和旧资产名。
- 咒语复制只复制 `body`。
- Codex 技能默认目录为 `$HOME/.agents/skills`。
- 数据库存放在 Electron `userData/data/index.sqlite`。
- `npm test`、`npm run typecheck`、`npm run build` 通过。
- Windows/macOS 原生目录包可启动，并分别产出通过的 packaged smoke JSON。
- 详细跨平台契约以 [`cross-platform-compatibility.md`](cross-platform-compatibility.md) 为准。
