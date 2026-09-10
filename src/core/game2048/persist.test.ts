import { describe, expect, it } from 'vitest';
import { parseSaved, toSaved } from './persist';
import { init, input } from './rules';

// 手番駆動なので running のまま保存・復元する（deferred view の復元で盤面を続ける）
const zero = () => 0;

describe('toSaved / parseSaved', () => {
	it('running のまま JSON を往復して復元できる', () => {
		const s = input(init(zero), { type: 'start' }, zero);
		const back = parseSaved(JSON.parse(JSON.stringify(toSaved(s))));
		expect(back).toEqual(s);
		expect(back?.phase).toBe('running');
	});

	it('paused は手番駆動には存在しないので running として復元する', () => {
		const base = toSaved(init(zero));
		expect(parseSaved({ ...base, phase: 'paused' })?.phase).toBe('running');
	});

	it('null・非オブジェクト・欠損・型違いは null', () => {
		const base = toSaved(init(zero));
		expect(parseSaved(null)).toBeNull();
		expect(parseSaved('x')).toBeNull();
		expect(parseSaved({})).toBeNull();
		expect(parseSaved({ ...base, phase: 'flying' })).toBeNull();
		expect(parseSaved({ ...base, grid: 'no' })).toBeNull();
		expect(parseSaved({ ...base, keepPlaying: 'yes' })).toBeNull();
	});

	it('盤面は 16 セル・各セルは 0 か 2 以上の 2 の冪、score は 0 以上の整数', () => {
		const base = toSaved(init(zero));
		expect(parseSaved({ ...base, grid: new Array<number>(15).fill(0) })).toBeNull();
		expect(parseSaved({ ...base, grid: [3, ...new Array<number>(15).fill(0)] })).toBeNull();
		expect(parseSaved({ ...base, grid: [1, ...new Array<number>(15).fill(0)] })).toBeNull();
		expect(parseSaved({ ...base, grid: [-2, ...new Array<number>(15).fill(0)] })).toBeNull();
		expect(parseSaved({ ...base, score: -1 })).toBeNull();
		expect(parseSaved({ ...base, score: 1.5 })).toBeNull();
		expect(parseSaved({ ...base, grid: [2048, 4, ...new Array<number>(14).fill(0)], score: 4096 })).not.toBeNull();
	});
});
