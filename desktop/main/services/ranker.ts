import { randomUUID } from 'node:crypto';
import type { Candidate, CandidateType, ExtractedPrompt } from '../../shared/types';

interface CategoryDefinition {
  slug: string;
  title: string;
  candidateType: CandidateType;
  keywords: RegExp[];
  template: string;
  description: string;
}

const CATEGORIES: CategoryDefinition[] = [
  {
    slug: 'review-diff',
    title: 'Review current diff',
    candidateType: 'skill',
    keywords: [/review/i, /diff/i, /changes?/i, /边界|遗漏|测试|bug/i],
    description: 'Review the current git diff for correctness, edge cases, regressions, and missing tests.',
    template: [
      'Review the current git diff.',
      '',
      'Focus on:',
      '- correctness bugs',
      '- edge cases',
      '- missing tests',
      '- regressions',
      '- unnecessary complexity',
      '- inconsistency with existing code patterns',
      '',
      'Do not modify files yet. Return prioritized findings.'
    ].join('\n')
  },
  {
    slug: 'debug-failing-tests',
    title: 'Debug failing tests',
    candidateType: 'skill',
    keywords: [/failing tests?/i, /test failure/i, /测试.*失败|失败.*测试|修复失败测试/i],
    description: 'Investigate failing tests and identify the smallest safe fix.',
    template: 'Investigate the failing tests, identify the failing behavior, and propose the smallest safe fix.'
  },
  {
    slug: 'write-tests',
    title: 'Write focused tests',
    candidateType: 'skill',
    keywords: [/write tests?/i, /add tests?/i, /补.*测试|写.*测试/i],
    description: 'Add focused tests for the current behavior or change.',
    template: 'Write focused tests for the current behavior. Keep tests minimal, clear, and tied to real behavior.'
  },
  {
    slug: 'refactor-code',
    title: 'Refactor code',
    candidateType: 'skill',
    keywords: [/refactor/i, /重构/i],
    description: 'Refactor code while preserving behavior and existing public contracts.',
    template: 'Refactor the selected code while preserving behavior. Keep the change scoped and run relevant tests.'
  },
  {
    slug: 'explain-code',
    title: 'Explain code',
    candidateType: 'snippet',
    keywords: [/explain/i, /walk.?through/i, /解释|讲解/i],
    description: 'Explain code behavior, architecture, and important terms.',
    template: 'Explain this code in clear language. Cover purpose, flow, dependencies, and edge cases.'
  },
  {
    slug: 'commit-message',
    title: 'Generate commit message',
    candidateType: 'snippet',
    keywords: [/commit message/i, /commit/i, /提交信息|提交.*消息/i],
    description: 'Generate a concise commit message from the current changes.',
    template: 'Generate a concise commit message for the current changes.\n\nFormat:\n<type>: <summary>\n\nBody:\n- What changed\n- Why it changed\n- Testing notes'
  },
  {
    slug: 'implement-feature',
    title: 'Implement feature',
    candidateType: 'skill',
    keywords: [/implement/i, /build/i, /add .*feature/i, /实现|添加.*功能/i],
    description: 'Implement a requested feature with scoped changes and verification.',
    template: 'Implement the requested feature. Keep the change scoped, follow existing patterns, and verify behavior.'
  },
  {
    slug: 'security-review',
    title: 'Security review',
    candidateType: 'skill',
    keywords: [/security/i, /安全/i],
    description: 'Review the current change for security and data-loss risk.',
    template: 'Review the current change for security, privacy, and data-loss risks. Return prioritized findings.'
  }
];

export function generateCandidates(prompts: ExtractedPrompt[]): Candidate[] {
  const groups = new Map<string, ExtractedPrompt[]>();

  for (const prompt of prompts) {
    const category = classifyPrompt(prompt);
    if (!category) {
      continue;
    }
    const existing = groups.get(category.slug) ?? [];
    existing.push(prompt);
    groups.set(category.slug, existing);
  }

  return Array.from(groups.entries())
    .map(([slug, groupedPrompts]) => buildCandidate(slug, groupedPrompts))
    .filter((candidate): candidate is Candidate => Boolean(candidate))
    .sort((left, right) => right.score - left.score || right.sourceCount - left.sourceCount);
}

function classifyPrompt(prompt: ExtractedPrompt): CategoryDefinition | null {
  const text = `${prompt.rawText} ${prompt.normalizedText}`;
  return (
    CATEGORIES.find((category) =>
      category.keywords.some((keyword) => keyword.test(text))
    ) ?? null
  );
}

function buildCandidate(slug: string, prompts: ExtractedPrompt[]): Candidate | null {
  const category = CATEGORIES.find((item) => item.slug === slug);
  if (!category) {
    return null;
  }
  const now = new Date().toISOString();
  const sourceTools = new Set(prompts.map((prompt) => prompt.sourceTool));
  const projects = new Set(prompts.map((prompt) => prompt.projectPath).filter(Boolean));
  const score = Math.min(
    1,
    prompts.length * 0.2 + sourceTools.size * 0.15 + projects.size * 0.1 + 0.35
  );

  return {
    id: randomUUID(),
    slug: category.slug,
    title: category.title,
    description: category.description,
    template: category.template,
    candidateType: category.candidateType,
    sourceCount: prompts.length,
    score: Number(score.toFixed(2)),
    status: 'pending',
    examples: prompts.slice(0, 5).map((prompt) => prompt.rawText),
    createdAt: now,
    updatedAt: now
  };
}
