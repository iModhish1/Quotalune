import {expect,it} from 'vitest';
import {resetLabel} from './resetLabel';
it('distinguishes a status, countdown, date and missing reset',()=>{
  expect(resetLabel('No active 5h session')).toBe('No active 5h session');
  expect(resetLabel('51 min')).toBe('Resets in 51 min');
  expect(resetLabel('4d')).toBe('Resets in 4d');
  expect(resetLabel('Thu 12:00 AM')).toBe('Reset: Thu 12:00 AM');
  expect(resetLabel('—')).toBe('Reset unavailable');
});
it('uses localized reset chrome without rewriting provider status text',()=>{
  const ar={unavailable:'غير متاح',resetsIn:'إعادة التعيين خلال',reset:'إعادة التعيين'};
  expect(resetLabel('51 min',ar)).toBe('إعادة التعيين خلال 51 min');
  expect(resetLabel('Thu 12:00 AM',ar)).toBe('إعادة التعيين: Thu 12:00 AM');
  expect(resetLabel('No active 5h session',ar)).toBe('No active 5h session');
});
