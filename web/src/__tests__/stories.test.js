import { describe, expect, it } from 'vitest';
import { fill, fillAll, tokensIn } from '../story/fill.js';
import { DEFAULT_VERTICAL, STORIES, VERTICALS, storyForAttack, verticalById } from '../story/stories.js';
import { validateStory, validateVertical } from '../story/storySchema.js';
import { ATTACKS } from '../../../server/src/catalog.js';

const ids = ATTACKS.map((a) => a.id);
describe('story data', () => {
  it('has two stories and the generic, airlines and banking packs; AirGuard Airlines (airlines) is the default', () => {
    expect(STORIES.map((s) => s.id)).toEqual(['G1', 'G2']);
    expect(VERTICALS.map((v) => v.id).sort()).toEqual(['airlines', 'banking', 'generic']);
    expect(verticalById('nope').id).toBe(DEFAULT_VERTICAL);
  });
  it('AirGuard Airlines (the airlines pack) is the default: unknown and missing ids fall back to it, and generic stays selectable', () => {
    expect(DEFAULT_VERTICAL).toBe('airlines');
    expect(verticalById('nope').id).toBe('airlines'); expect(verticalById(undefined).id).toBe('airlines'); expect(verticalById(null).id).toBe('airlines');
    expect(verticalById('generic').id).toBe('generic'); expect(verticalById('banking').id).toBe('banking');
    expect(verticalById('airlines').displayName).toBe('AirGuard Airlines');
  });
  it('the default story reads as AirGuard Airlines with no other brand, bank wording or old cast name; every airlines token resolves', () => {
    const v = verticalById(DEFAULT_VERTICAL); const text = JSON.stringify([v.displayName, v.tagline, v.vocab, Object.values(v.cast), ...STORIES.map((s) => fillAll(s, v))]);
    expect(text).toContain('AirGuard Airlines'); expect(text).toContain('SkyMiles'); expect(text).toContain('Emma');
    expect(text).not.toContain('⟨missing'); expect(text).not.toMatch(/\{\{/);
    expect(text).not.toMatch(/bank|checking|savings|payee|funds|money|crew-payroll|\bMark\b|\bMary\b|Fabrikam|Northwind|Contoso|Harbor|Vellum|Skyline|Tessera/i);
  });
  it('a story that names a token the airlines pack does not define shows the gap instead of hiding it', () => {
    const v = verticalById('airlines');
    expect(fill('{{vocab.nope}}', v)).toContain('⟨missing: vocab.nope⟩'); expect(fill('{{nobody}}', v)).toContain('⟨missing: nobody⟩');
    for (const story of STORIES) for (const t of tokensIn(story)) expect(fill(`{{${t}}}`, v), `${story.id} ${t}`).not.toContain('⟨missing');
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
