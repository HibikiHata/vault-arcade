import { describe, expect, it } from 'vitest';
import { parseSavedState, toSavedState } from './persist';
import { init, input } from './rules';

// Obsidian は非表示のタブのビューを破棄して後で作り直す（deferred view）。
// 進行中のゲームを View の state として退避・復元するための純関数を検証する
const zero = () => 0;

describe('toSavedState', () => {
	it('running は paused に変換し、他の phase はそのまま保存する', () => {
		const running = input(init(20, 20, zero), { type: 'start' }, zero);
		expect(toSavedState(running).phase).toBe('paused');
		const idle = init(20, 20, zero);
		expect(toSavedState(idle).phase).toBe('idle');
	});

	it('JSON を往復しても同じ内容になる', () => {
		const s = input(init(20, 20, zero), { type: 'start' }, zero);
		const saved = toSavedState(s);
		expect(JSON.parse(JSON.stringify(saved))).toEqual(saved);
	});
});

describe('parseSavedState', () => {
	it('保存した状態を復元できる', () => {
		const s = input(init(20, 20, zero), { type: 'start' }, zero);
		const back = parseSavedState(JSON.parse(JSON.stringify(toSavedState(s))));
		expect(back).toEqual({ ...s, phase: 'paused' });
	});

	it('null・非オブジェクト・欠損・型違いは null', () => {
		expect(parseSavedState(null)).toBeNull();
		expect(parseSavedState('x')).toBeNull();
		expect(parseSavedState({})).toBeNull();
		expect(parseSavedState({ ...toSavedState(init(20, 20, zero)), phase: 'flying' })).toBeNull();
		expect(parseSavedState({ ...toSavedState(init(20, 20, zero)), body: 'no' })).toBeNull();
		expect(parseSavedState({ ...toSavedState(init(20, 20, zero)), body: [{ x: 1 }] })).toBeNull();
	});

	it('盤面の外や重複した体、体の上の餌は拒否する（不正な保存データで落ちない）', () => {
		const base = toSavedState(init(20, 20, zero));
		expect(parseSavedState({ ...base, body: [{ x: 25, y: 0 }, { x: 24, y: 0 }, { x: 23, y: 0 }] })).toBeNull();
		expect(parseSavedState({ ...base, body: [{ x: 1, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 }] })).toBeNull();
		expect(parseSavedState({ ...base, food: { x: 10, y: 10 } })).toBeNull();
	});

	it('復元しても running にはならない', () => {
		const base = { ...toSavedState(init(20, 20, zero)), phase: 'running' };
		expect(parseSavedState(base)?.phase).toBe('paused');
	});
});
