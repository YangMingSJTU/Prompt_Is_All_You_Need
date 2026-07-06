import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { ExportablePrompt, ExportPreview, ExportTarget } from '../../shared/types';

export function previewExport(
  prompt: ExportablePrompt,
  target: ExportTarget,
  baseDirectory: string
): ExportPreview {
  const path = exportPath(prompt.slug, target, baseDirectory);
  return {
    path,
    content: exportContent(prompt, target)
  };
}

export async function writeExport(
  prompt: ExportablePrompt,
  target: ExportTarget,
  baseDirectory: string
): Promise<ExportPreview> {
  const preview = previewExport(prompt, target, baseDirectory);
  await mkdir(dirname(preview.path), { recursive: true });
  await writeFile(preview.path, preview.content, 'utf8');
  return preview;
}

function exportPath(slug: string, target: ExportTarget, baseDirectory: string): string {
  if (target === 'snippet') {
    return join(baseDirectory, `${slug}.md`);
  }
  return join(baseDirectory, slug, 'SKILL.md');
}

function exportContent(prompt: ExportablePrompt, target: ExportTarget): string {
  if (target === 'snippet') {
    return [
      '---',
      `slug: ${prompt.slug}`,
      `title: ${prompt.title}`,
      'created_by: apm',
      '---',
      '',
      prompt.body,
      ''
    ].join('\n');
  }

  if (target === 'claude-skill') {
    return [
      '---',
      `description: ${prompt.description}`,
      '---',
      '',
      '## Task',
      '',
      prompt.title,
      '',
      '## Instructions',
      '',
      prompt.body,
      '',
      '## Output',
      '',
      'Return a concise, actionable result.',
      ''
    ].join('\n');
  }

  return [
    '---',
    `name: ${prompt.slug}`,
    `description: ${prompt.description}`,
    '---',
    '',
    '## Goal',
    '',
    prompt.title,
    '',
    '## Steps',
    '',
    prompt.body,
    '',
    '## Output',
    '',
    'Return a concise, actionable result.',
    ''
  ].join('\n');
}
