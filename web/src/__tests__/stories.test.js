import { describe, expect, it } from 'vitest';
import { fill, fillAll, tokensIn } from '../story/fill.js';
import { DEFAULT_VERTICAL, STORIES, VERTICALS, storyForAttack, verticalById } from '../story/stories.js';
import { validateStory, validateVertical } from '../story/storySchema.js';
import { ATTACKS } from '../../../server/src/catalog.js';

const ids = ATTACKS.map((a) => a.id);
describe('story data', () => {
  it('has two stories and the generic, airlines and banking packs', () => {
    expect(STORIES.map((s) => s.id)).toEqual(['G1', 'G2']);
    expect(VERTICALS.map((v) => v.id).sort()).toEqual(['airlines', 'banking', 'generic']);
    expect(verticalById('nope').id).toBe(DEFAULT_VERTICAL);
  });
  it.each(STORIES.map((s) => [s.id, s]))('story %s is valid and names real attacks', (_i, s) => expect(validateStory(s, { modes: ids })).toEqual([]));
  it.each(VERTICALS.map((v) => [v.id, v]))('vertical %s is valid', (_i, v) => expect(validateVertical(v)).toEqual([]));
  it('every token in every story resolves in every vertical', () => {
    for (const s of STORIES) for (const v of VERTICALS) expect(JSON.stringify(fillAll(s, v)), `${s.id} in ${v.id}`).not.toContain('⟨missing');
  });
  it('the two stories cover the audience-confusion and issuer-mixup attacks', () => {
    expect(storyForAttack('audience-confusion').id).toBe('G1'); expect(storyForAttack('issuer-mixup').id).toBe('G2'); expect(storyForAttack('wrong-scope')).toBeNull();
  });
  it('the validator reports problems instead of throwing', () => {
    expect(validateStory({ id: 'x' }).length).toBeGreaterThan(3);
    expect(validateStory({ ...STORIES[0], steps: [{ ...STORIES[0].steps[0], n: 9 }] }).join()).toMatch(/n must be/);
  });
  it('fill leaves a visible marker for an unknown token and finds tokens', () => {
    expect(fill('{{nobody}}', verticalById('generic'))).toContain('⟨missing'); expect([...tokensIn(STORIES[0])]).toContain('mark');
  });
});
