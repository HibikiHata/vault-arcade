import { describe, expect, it } from 'vitest';
import { advance } from './loop';

// 固定タイムステップの累積器。tick 間隔 120ms を基準に検証する
describe('advance', () => {
	it('dt 0 では進まない', () => {
		expect(advance(0, 0, 120)).toEqual({ acc: 0, ticks: 0 });
	});

	it('間隔未満は繰り越す', () => {
		expect(advance(0, 100, 120)).toEqual({ acc: 100, ticks: 0 });
	});

	it('繰り越しと合わせて間隔を超えたら 1 tick', () => {
		expect(advance(100, 40, 120)).toEqual({ acc: 20, ticks: 1 });
	});

	it('ちょうど間隔なら 1 tick・余り 0', () => {
		expect(advance(0, 120, 120)).toEqual({ acc: 0, ticks: 1 });
	});

	it('dt は maxDt（既定 250ms）でクランプされる: 300ms → 250ms → 2 tick 余り 10', () => {
		expect(advance(0, 300, 120)).toEqual({ acc: 10, ticks: 2 });
	});

	it('maxDt を大きくすればクランプされない: 300ms → 2 tick 余り 60', () => {
		expect(advance(0, 300, 120, 1000)).toEqual({ acc: 60, ticks: 2 });
	});

	it('負の dt は 0 として扱う', () => {
		expect(advance(50, -30, 120)).toEqual({ acc: 50, ticks: 0 });
	});
});
