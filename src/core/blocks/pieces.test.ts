import { describe, expect, it } from 'vitest';
import { COLS, SPAWN_X, SPAWN_Y } from './constants';
import { cellsOf, orientationCount, PIECES } from './pieces';
import { PIECE_IDS, type Cell } from './types';

const sorted = (cells: readonly Cell[]): string =>
	cells
		.map(([c, r]) => `${c},${r}`)
		.sort()
		.join(' ');

describe('pieces: 回転状態', () => {
	it('7 形すべて、各回転状態は 4 セル', () => {
		for (const id of PIECE_IDS) {
			for (const orientation of PIECES[id]) expect(orientation).toHaveLength(4);
		}
	});

	it('状態数: O は 1（2×2 の箱は回しても同じセル）、他の 6 形は箱を時計回りに回した 4 状態', () => {
		expect(orientationCount('O')).toBe(1);
		for (const id of ['I', 'S', 'Z', 'T', 'J', 'L'] as const) expect(orientationCount(id)).toBe(4);
	});

	it('T は 上 → 右 → 下 → 左 の順（時計回り）', () => {
		const [up, right, down, left] = PIECES.T;
		expect(sorted(up ?? [])).toBe(sorted([[1, 0], [0, 1], [1, 1], [2, 1]]));
		expect(sorted(right ?? [])).toBe(sorted([[1, 0], [1, 1], [2, 1], [1, 2]]));
		expect(sorted(down ?? [])).toBe(sorted([[0, 1], [1, 1], [2, 1], [1, 2]]));
		expect(sorted(left ?? [])).toBe(sorted([[1, 0], [0, 1], [1, 1], [1, 2]]));
	});

	it('I は 横（上端）→ 縦（右端）→ 横（下端）→ 縦（左端）と箱の中心を軸に回る（位置が跳ばない）', () => {
		const [h0, v1, h2, v3] = PIECES.I;
		expect(sorted(h0 ?? [])).toBe(sorted([[0, 0], [1, 0], [2, 0], [3, 0]]));
		expect(sorted(v1 ?? [])).toBe(sorted([[3, 0], [3, 1], [3, 2], [3, 3]]));
		expect(sorted(h2 ?? [])).toBe(sorted([[0, 3], [1, 3], [2, 3], [3, 3]]));
		expect(sorted(v3 ?? [])).toBe(sorted([[0, 0], [0, 1], [0, 2], [0, 3]]));
	});

	it('状態 0 はどの形も row 0 を含み、スポーン位置では列 3〜6・行 0〜1 に収まる', () => {
		for (const id of PIECE_IDS) {
			const cells = cellsOf(id, 0, SPAWN_X, SPAWN_Y);
			expect(cells.some(([, r]) => r === SPAWN_Y)).toBe(true);
			for (const [c, r] of cells) {
				expect(c).toBeGreaterThanOrEqual(3);
				expect(c).toBeLessThanOrEqual(6);
				expect(c).toBeLessThan(COLS);
				expect(r).toBeGreaterThanOrEqual(0);
				expect(r).toBeLessThanOrEqual(1);
			}
		}
		expect(sorted(cellsOf('O', 0, SPAWN_X, SPAWN_Y))).toBe(sorted([[3, 0], [4, 0], [3, 1], [4, 1]]));
	});

	it('cellsOf は原点 (x, y) を足した絶対座標を返す', () => {
		expect(sorted(cellsOf('T', 0, 2, 5))).toBe(sorted([[3, 5], [2, 6], [3, 6], [4, 6]]));
	});
});
