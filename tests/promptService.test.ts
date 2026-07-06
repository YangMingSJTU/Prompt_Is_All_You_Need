import { describe, expect, it } from 'vitest';
import { createPromptService } from '../desktop/main/services/promptService';
import { createTestDatabase } from '../desktop/main/services/database';

describe('prompt service', () => {
  it('seeds starter prompts and searches by tag and body', async () => {
    const db = await createTestDatabase();
    const service = createPromptService(db);
    await service.seedStarterPrompts();

    const results = await service.searchPrompts('review');

    expect(results.some((prompt) => prompt.slug === 'review-diff')).toBe(true);
  });

  it('records usage and returns analytics', async () => {
    const db = await createTestDatabase();
    const service = createPromptService(db);
    await service.seedStarterPrompts();
    const [prompt] = await service.searchPrompts('commit');

    await service.copyPrompt(prompt.id);
    const analytics = await service.getAnalytics();

    expect(analytics.totalCopies).toBe(1);
  });
});
