import { describe, expect, it } from 'vitest';
import { GRAVITY_TICKS, LOCK_DELAY_TICKS } from './constants';
import { parseSaved, toSaved } from './persist';
import { init, input } from './rules';
import { EMPTY_ROW, seq, wellBottom } from './testing';
import type { BlocksState } from './types';

const zero = seq([0]);
const running = (over: Partial<BlocksState> = {}): BlocksState => ({
	...input(init(zero), { type: 'start' }, zero),
	...over,
});

describe('toSaved', () => {
	it('running は paused として保存し、それ以外の phase とフィールドはそのまま', () => {
		const s = running({ score: 300, lines: 3, y: 4 });
		const saved = toSaved(s);
		expect(saved.phase).toBe('paused');
		expect(saved).toEqual({ ...s, phase: 'paused' });
		expect(toSaved(init(zero)).phase).toBe('idle');
	});
});

describe('parseSaved', () => {
	it('保存した状態を復元できる（bag が途中でも）', () => {
		const s = running({ bag: ['J', 'L', 'I'], score: 100, lines: 1, gravity: 5, lock: 2, y: 3 });
		expect(parseSaved(toSaved(s))).toEqual({ ...s, phase: 'paused' });
		const paused = input(running(), { type: 'pause' }, zero);
		expect(parseSaved(toSaved(paused))).toEqual(paused);
	});

	it('running は paused に戻す（復元で勝手に動き出さない）', () => {
		const raw = { ...running(), phase: 'running' };
		expect(parseSaved(raw)?.phase).toBe('paused');
	});

	it('over は、スポーンで重なったピースをそのまま受け入れる（凍結表示のため）', () => {
		const well = wellBottom(['....##....', ...new Array<string>(19).fill(EMPTY_ROW)]);
		const over = { ...running({ well }), phase: 'over' };
		expect(parseSaved(over)).not.toBeNull();
	});

	it('井戸: 200 セル・各セル 0/1 でなければ null', () => {
		const base = toSaved(running());
		expect(parseSaved({ ...base, well: new Array<number>(199).fill(0) })).toBeNull();
		expect(parseSaved({ ...base, well: [2, ...new Array<number>(199).fill(0)] })).toBeNull();
		expect(parseSaved({ ...base, well: 'x' })).toBeNull();
	});

	it('ピース: 未知の id、範囲外の回転、非整数の座標、井戸と重なる位置は null', () => {
		const base = toSaved(running({ piece: 'T' }));
		expect(parseSaved({ ...base, piece: 'X' })).toBeNull();
		expect(parseSaved({ ...base, rotation: 4 })).toBeNull();
		expect(parseSaved({ ...base, rotation: -1 })).toBeNull();
		expect(parseSaved({ ...toSaved(running()), rotation: 1 })).toBeNull(); // O は状態 1 つ
		expect(parseSaved({ ...base, x: 1.5 })).toBeNull();
		expect(parseSaved({ ...base, y: -1 })).toBeNull();
		const blocked = wellBottom(['....##....', ...new Array<string>(19).fill(EMPTY_ROW)]);
		expect(parseSaved({ ...base, well: blocked })).toBeNull();
	});

	it('bag: 重複・未知の id・空・8 個以上は null（先回り補充で 1〜7 個）', () => {
		const base = toSaved(running());
		expect(parseSaved({ ...base, bag: ['T', 'T'] })).toBeNull();
		expect(parseSaved({ ...base, bag: ['T', 'Q'] })).toBeNull();
		expect(parseSaved({ ...base, bag: [] })).toBeNull();
		expect(parseSaved({ ...base, bag: ['I', 'O', 'T', 'S', 'Z', 'J', 'L', 'I'] })).toBeNull();
		expect(parseSaved({ ...base, bag: ['I', 'O', 'T', 'S', 'Z', 'J', 'L'] })).not.toBeNull();
		expect(parseSaved({ ...base, bag: ['T'] })).not.toBeNull();
	});

	it('得点・ライン・レベル・カウンタの整合が取れていなければ null', () => {
		const base = toSaved(running());
		expect(parseSaved({ ...base, score: -1 })).toBeNull();
		expect(parseSaved({ ...base, score: 1.5 })).toBeNull();
		expect(parseSaved({ ...base, lines: 5, level: 3 })).toBeNull();
		expect(parseSaved({ ...base, lines: 25, level: 3 })).not.toBeNull();
		expect(parseSaved({ ...base, gravity: GRAVITY_TICKS[0] })).toBeNull();
		expect(parseSaved({ ...base, gravity: (GRAVITY_TICKS[0] ?? 16) - 1 })).not.toBeNull();
		// 上限は level に応じた落下 tick 数。level 11 では 1 なので gravity は 0 しか取れない
		expect(parseSaved({ ...base, lines: 100, level: 11, gravity: 1 })).toBeNull();
		expect(parseSaved({ ...base, lines: 100, level: 11, gravity: 0 })).not.toBeNull();
		expect(parseSaved({ ...base, lock: LOCK_DELAY_TICKS })).toBeNull();
		expect(parseSaved({ ...base, lock: LOCK_DELAY_TICKS - 1 })).not.toBeNull();
	});

	it('lastClear は一時情報なので復元では常に null', () => {
		const raw = { ...toSaved(running()), lastClear: { rows: [19], cells: [[4, 19]] } };
		expect(parseSaved(raw)?.lastClear).toBeNull();
	});

	it('phase が語彙外（won 含む）、または入力がオブジェクトでなければ null', () => {
		const base = toSaved(running());
		expect(parseSaved({ ...base, phase: 'won' })).toBeNull();
		expect(parseSaved({ ...base, phase: 'flying' })).toBeNull();
		expect(parseSaved(null)).toBeNull();
		expect(parseSaved('x')).toBeNull();
	});
});
