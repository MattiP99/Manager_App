import { splitByHalfDay } from './dayHalves';

interface Item {
  id: string;
  start_time: string | null;
}

function item(id: string, start_time: string | null): Item {
  return { id, start_time };
}

describe('splitByHalfDay', () => {
  it('puts a morning time before 13:00 into morning', () => {
    const { morning, afternoon } = splitByHalfDay([item('a', '09:00')]);
    expect(morning.map((i) => i.id)).toEqual(['a']);
    expect(afternoon).toEqual([]);
  });

  it('puts exactly 13:00 into afternoon (boundary is exclusive on morning side)', () => {
    const { morning, afternoon } = splitByHalfDay([item('a', '13:00')]);
    expect(morning).toEqual([]);
    expect(afternoon.map((i) => i.id)).toEqual(['a']);
  });

  it('puts an item with no start_time into morning as a fallback', () => {
    const { morning, afternoon } = splitByHalfDay([item('a', null)]);
    expect(morning.map((i) => i.id)).toEqual(['a']);
    expect(afternoon).toEqual([]);
  });

  it('sorts each group by start_time, items without a time first within morning', () => {
    const { morning } = splitByHalfDay([item('late', '11:00'), item('none', null), item('early', '08:00')]);
    expect(morning.map((i) => i.id)).toEqual(['none', 'early', 'late']);
  });

  it('sorts the afternoon group by start_time', () => {
    const { afternoon } = splitByHalfDay([item('late', '18:00'), item('early', '14:00')]);
    expect(afternoon.map((i) => i.id)).toEqual(['early', 'late']);
  });
});
