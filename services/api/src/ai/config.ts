import type { AiTask } from '@fitbay/shared';
import type { Repo } from '../lib/repo';

/** Модель по умолчанию (спека 4.3). Меняется без релиза: запись CONFIG / AI { models: { task: model } } в fitbay-main или AI_MODEL. */
export const DEFAULT_MODEL = process.env.AI_MODEL ?? 'gpt-5.6-luna';
export const JSON_TASKS = new Set<AiTask>(['food_photo', 'food_text', 'food_items', 'food_portion', 'food_mod', 'day_story', 'recipe', 'activity', 'workout_ai', 'plan_ai', 'label_ocr']);

export async function modelFor(repo: Repo, task: AiTask): Promise<string> {
  const cfg = await repo.get('CONFIG', 'AI');
  const models = (cfg?.models ?? {}) as Partial<Record<AiTask, string>>;
  return models[task] ?? (cfg?.default as string | undefined) ?? DEFAULT_MODEL;
}
