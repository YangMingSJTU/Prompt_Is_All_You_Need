# Spellbook 魔法书

Spellbook 魔法书是一个本地优先的桌面端 AI 提示词与技能管理器。

它管理两类资产：

- **咒语 Spell**：用户会直接复制到模型输入框的一段纯文本。内容可以包含 Markdown 符号，但系统不包装、不加 frontmatter、不默认导出为文件。
- **技能 Skill**：Claude/Codex 可安装调用的本地多文件能力包，通常包含 `SKILL.md`、脚本、模板和资源文件。

## Desktop MVP

当前第一版提供：

- Electron + React 桌面工作台。
- 全局快捷键打开快捷施法浮窗，默认 `Ctrl+Shift+Space`。
- 咒语库：搜索、预览、复制、保存候选咒语。
- 技能库：扫描本地 Claude/Codex 技能、查看文件结构、打包 zip、安装到目标平台。
- 本地扫描：从 Claude/Codex 历史记录中提取用户输入，生成候选咒语。
- 施法统计：记录本地复制次数和常用咒语。
- 设置页：中英文切换、快捷键修改、快捷施法位置、本地数据路径展示。

## Local Data

- 数据库：`~/.spellbook/index.sqlite`
- 技能打包输出：`~/.spellbook/packages/`
- Claude 技能目录：`~/.claude/skills`
- Codex 用户级技能目录：`$HOME/.agents/skills`

Codex 技能目录遵循官方 Agent Skills 文档：[Agent Skills](https://developers.openai.com/codex/skills)。

## Development

```bash
npm install
npm test
npm run typecheck
npm run build
npm run dev
```

默认不上传数据、不调用远程 LLM、不读取 assistant/tool-result 内容。
