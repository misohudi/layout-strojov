import { multiText, peopleCount } from './stats';

test('viacobsluha in words with Slovak plurals instead of "ľ / str"', () => {
  expect(multiText(0, 0)).toBe('nikto');
  expect(multiText(1, 2)).toBe('1 človek na 2 strojoch');
  expect(multiText(2, 5)).toBe('2 ľudia na 5 strojoch');
  expect(multiText(5, 11)).toBe('5 ľudí na 11 strojoch');
  expect(multiText(null, null)).toBe('–'); // old records without the figure
  expect([1, 3, 4, 5, 0].map(peopleCount)).toEqual(['1 človek', '3 ľudia', '4 ľudia', '5 ľudí', '0 ľudí']);
});
