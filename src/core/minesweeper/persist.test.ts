import { describe, expect, it } from 'vitest';
import { parseSaved, toSaved } from './persist';
import { init, input } from './rules';
import { cellsFrom, seq } from './testing';
import type { MinesweeperState } from './types';

const zero = seq([0]);
// 列 4 の壁 9 個 + (8,8) の 1 個 = small の表どおり 10 個
const WALL = ['....*....', '....*....', '....*....', '....*....', '....*....', '....*....', '....*....', '....*....', '....*...*'];
const running = (over: Partial<MinesweeperState> = {}): MinesweeperState => ({
	...input(init(zero, 'small'), { type: 'start' }, zero),
	...over,
});
const withMines = (over: Partial<MinesweeperState> = {}): MinesweeperState =>
	running({ mines: cellsFrom(WALL, '*'), placed: true, mineCount: 10, ...over });
const opened = () => input(withMines(), { type: 'cell', alt: false, x: 0, y: 0 }, zero);

describe('toSaved / parseSaved', () => {
	it('手番駆動なので running のまま保存し、復元も running（paused は running に戻す）', () => {
		const s = opened();
		expect(toSaved(s)).toEqual(s);
		expect(parseSaved(toSaved(s))).toEqual(s);
		expect(parseSaved({ ...s, phase: 'paused' })?.phase).toBe('running');
	});

	it('配置前（地雷なし）・over・won の盤面も復元できる', () => {
		const fresh = running();
		expect(parseSaved(fresh)).toEqual(fresh);
		const over = input(withMines(), { type: 'cell', alt: false, x: 4, y: 4 }, zero);
		expect(parseSaved(over)).toEqual(over);
		const won = input(opened(), { type: 'cell', alt: false, x: 7, y: 0 }, zero);
		expect(won.phase).toBe('won');
		expect(parseSaved(won)).toEqual(won);
	});

	it('プリセットと寸法・地雷数が表と合わなければ null', () => {
		const s = opened();
		expect(parseSaved({ ...s, preset: 'huge' })).toBeNull();
		expect(parseSaved({ ...s, cols: 10 })).toBeNull();
		expect(parseSaved({ ...s, mineCount: 9 })).toBeNull(); // 表の small は 10
	});

	it('配列の長さ・値、地雷数の合計、開封と旗の排他が崩れていれば null', () => {
		const s = opened();
		expect(parseSaved({ ...s, mines: s.mines.slice(1) })).toBeNull();
		expect(parseSaved({ ...s, open: [2, ...s.open.slice(1)] })).toBeNull();
		expect(parseSaved({ ...s, mines: cellsFrom(WALL, '*').map((m, i) => (i === 79 ? 1 : m)) })).toBeNull();
		expect(parseSaved({ ...s, flags: s.open })).toBeNull();
		expect(parseSaved({ ...s, placed: false })).toBeNull();
	});

	it('running 中に開いた地雷、over の整合、won の整合、score の不一致は null', () => {
		const s = opened();
		expect(parseSaved({ ...s, open: s.open.map((o, i) => (i === 4 ? 1 : o)) })).toBeNull();
		expect(parseSaved({ ...s, phase: 'over' })).toBeNull(); // exploded が無い
		expect(parseSaved({ ...s, phase: 'over', exploded: 0 })).toBeNull(); // 地雷でない
		expect(parseSaved({ ...s, phase: 'won' })).toBeNull(); // 右側が閉じている
		expect(parseSaved({ ...s, score: 35 })).toBeNull();
	});

	it('カーソルの範囲・phase の語彙・入力の型', () => {
		const s = opened();
		expect(parseSaved({ ...s, cursor: { x: 9, y: 0 } })).toBeNull();
		expect(parseSaved({ ...s, cursor: { x: 1.5, y: 0 } })).toBeNull();
		expect(parseSaved({ ...s, phase: 'flying' })).toBeNull();
		expect(parseSaved(null)).toBeNull();
		expect(parseSaved('x')).toBeNull();
	});
});
