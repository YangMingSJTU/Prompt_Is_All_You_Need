import type { BundledSkillKey } from '../../shared/skillTypes';
import promptRefinerSkill from '../bundled-skills/prompt-refiner/SKILL.md?raw';
import promptRefinerExample from '../bundled-skills/prompt-refiner/references/example.md?raw';
import taskPlannerSkill from '../bundled-skills/task-planner/SKILL.md?raw';
import taskPlannerExample from '../bundled-skills/task-planner/references/example.md?raw';

export interface BundledSkillDefinition {
  id: `bundled:${BundledSkillKey}`;
  key: BundledSkillKey;
  directoryName: string;
  name: string;
  description: string;
  files: Readonly<Record<string, string>>;
}

const BUNDLED_SKILLS: readonly BundledSkillDefinition[] = [
  {
    id: 'bundled:prompt-refiner',
    key: 'prompt-refiner',
    directoryName: 'prompt-refiner',
    name: 'Prompt Refiner',
    description:
      'Turn a vague request into a clear prompt with goals, context, constraints, and an output format.',
    files: {
      'SKILL.md': promptRefinerSkill,
      'references/example.md': promptRefinerExample
    }
  },
  {
    id: 'bundled:task-planner',
    key: 'task-planner',
    directoryName: 'task-planner',
    name: 'Task Planner',
    description: 'Break a complex goal into an ordered, verifiable action plan.',
    files: {
      'SKILL.md': taskPlannerSkill,
      'references/example.md': taskPlannerExample
    }
  }
] as const;

export function listBundledSkills(): readonly BundledSkillDefinition[] {
  return BUNDLED_SKILLS;
}

export function getBundledSkill(id: string): BundledSkillDefinition | null {
  return BUNDLED_SKILLS.find((skill) => skill.id === id) ?? null;
}
