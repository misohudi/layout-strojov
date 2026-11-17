import { autoNick, nickOf, NICK_MAX } from './nick';
import { seedMachines } from './seed';

test('automatic nicks of the hall machines are short and unique', () => {
  const nicks = seedMachines('frezy').map((m) => autoNick(m.name));
  for (const n of nicks) expect(n.length).toBeLessThanOrEqual(NICK_MAX);
  expect(new Set(nicks).size).toBe(nicks.length);
});

test.each([
  ['HERMLE C60', 'C60'],
  ['HERMLE C42 / 4', 'C42/4'],
  ['HERMLE C40 U / 1', 'C40 U/1'],
  ['DMU 80P DUO BLOCK / 1', '80P DB/1'],
  ['DMU 80P HI-DYN', '80P HD'],
  ['DMU 125', 'DMU 125'],
  ['DMC 1150 / 2', '1150/2'],
  ['CHIRON 800', 'CHI 800'],
  ['UNIPORT 4000', 'UNI 4000'],
  ['DMF 220 LINEAR', '220 L'],
  ['SHW', 'SHW'],
  ['Nový stroj', 'Nový stroj'],
])('%s → %s', (name, nick) => expect(autoNick(name)).toBe(nick));

test('a nick set in Settings wins over the automatic one', () => {
  expect(nickOf({ name: 'HERMLE C60', nick: ' Šesťdesiatka ' })).toBe('Šesťdesiatka');
  expect(nickOf({ name: 'HERMLE C60', nick: '  ' })).toBe('C60');
});
