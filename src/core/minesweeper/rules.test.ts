import { describe, expect, it } from 'vitest';
import type { HostAction } from '../host/types';
import { PRESETS, adjacentCount, init, input, neighbors, placeMines } from './rules';
import { cellsFrom, lcg, seq } from './testing';
import type { MinesweeperState } from './types';

const zero = seq([0]);
const idx = (x: number, y: number, cols = 9) => y * cols + x;

/** small（9×9）を running にし、任意のフィールドを上書きする */
const running = (over: Partial<MinesweeperState> = {}): MinesweeperState => ({
	...input(init(zero, 'small'), { type: 'start' }, zero),
	...over,
});

/** 地雷を手で置いた running 状態（配置済み） */
const withMines = (rows: readonly string[], over: Partial<MinesweeperState> = {}): MinesweeperState => {
	const mines = cellsFrom(rows, '*');
	return running({ mines, placed: true, mineCount: mines.reduce((a, b) => a + b, 0), ...over });
};

// 列 4 が全部地雷の「壁」。左（列 0〜3）と右（列 5〜8）が分かれる
const WALL = ['....*....', '....*....', '....*....', '....*....', '....*....', '....*....', '....*....', '....*....', '....*....'];

const reveal = (x: number, y: number): HostAction => ({ type: 'cell', alt: false, x, y });
const flag = (x: number, y: number): HostAction => ({ type: 'cell', alt: true, x, y });
const turn = (dir: 'up' | 'down' | 'left' | 'right'): HostAction => ({ type: 'turn', dir });

describe('PRESETS と init', () => {
	it('プリセットは small 9×9/10・medium 11×11/18・large 16×16/40', () => {
		expect(PRESETS.small).toEqual({ cols: 9, rows: 9, mines: 10 });
		expect(PRESETS.medium).toEqual({ cols: 11, rows: 11, mines: 18 });
		expect(PRESETS.large).toEqual({ cols: 16, rows: 16, mines: 40 });
	});

	it('init は地雷なし・idle・カーソル中央・score 0 で、乱数を消費しない', () => {
		let calls = 0;
		const s = init(() => {
			calls += 1;
			return 0;
		}, 'medium');
		expect(calls).toBe(0);
		expect(s.phase).toBe('idle');
		expect(s.preset).toBe('medium');
		expect(s.cols).toBe(11);
		expect(s.rows).toBe(11);
		expect(s.mineCount).toBe(18);
		expect(s.mines).toHaveLength(121);
		expect(s.mines.every((c) => c === 0)).toBe(true);
		expect(s.open.every((c) => c === 0)).toBe(true);
		expect(s.flags.every((c) => c === 0)).toBe(true);
		expect(s.placed).toBe(false);
		expect(s.exploded).toBeNull();
		expect(s.cursor).toEqual({ x: 5, y: 5 });
		expect(s.score).toBe(0);
	});

	it('未知の variant と省略は small（AC-056）', () => {
		expect(init(zero, 'huge').preset).toBe('small');
		expect(init(zero).preset).toBe('small');
		expect(init(zero).cursor).toEqual({ x: 4, y: 4 });
	});
});

describe('neighbors / adjacentCount', () => {
	it('角は 3・辺は 5・内側は 8 の近傍', () => {
		expect(neighbors(idx(0, 0), 9, 9).sort((a, b) => a - b)).toEqual([1, 9, 10]);
		expect(neighbors(idx(4, 0), 9, 9)).toHaveLength(5);
		expect(neighbors(idx(4, 4), 9, 9)).toHaveLength(8);
		expect(neighbors(idx(8, 8), 9, 9).sort((a, b) => a - b)).toEqual([70, 71, 79]);
	});

	it('隣接する地雷の数', () => {
		const mines = cellsFrom(['*.*', '...', '..*'], '*');
		expect(adjacentCount(mines, idx(1, 1, 3), 3, 3)).toBe(3);
		expect(adjacentCount(mines, idx(0, 2, 3), 3, 3)).toBe(0);
		expect(adjacentCount(mines, idx(1, 0, 3), 3, 3)).toBe(2);
	});
});

describe('AC-050: 初手の地雷配置', () => {
	it('乱数 0 なら、先頭セルと近傍 8 を除いた候補の先頭から順に地雷が置かれ、乱数の消費は地雷数ちょうど', () => {
		let calls = 0;
		const rng = () => {
			calls += 1;
			return 0;
		};
		const mines = placeMines(9, 9, 10, idx(4, 4), rng);
		expect(calls).toBe(10);
		const placed = mines.map((m, i) => (m ? i : -1)).filter((i) => i >= 0);
		// 候補（0〜80 から 30,31,32,39,40,41,48,49,50 を除く）の先頭 10 個
		expect(placed).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
	});

	it('乱数 0.999 なら手計算どおり {80, 0, 1, …, 8} に置かれる（部分 Fisher–Yates の順序が契約）', () => {
		const mines = placeMines(9, 9, 10, idx(4, 4), seq([0.999]));
		const placed = mines.map((m, i) => (m ? i : -1)).filter((i) => i >= 0);
		expect(placed).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 80]);
	});

	it('候補が足りなければ先頭セルだけを除く（3×3 に 5 個）', () => {
		const mines = placeMines(3, 3, 5, idx(1, 1, 3), lcg(1));
		expect(mines.reduce((a, b) => a + b, 0)).toBe(5);
		expect(mines[idx(1, 1, 3)]).toBe(0);
	});

	it('seeded fuzz: 地雷数はちょうど、先頭セルと近傍には無い', () => {
		const rng = lcg(11);
		for (let t = 0; t < 50; t += 1) {
			const first = Math.floor(rng() * 81);
			const mines = placeMines(9, 9, 10, first, rng);
			expect(mines.reduce((a, b) => a + b, 0)).toBe(10);
			expect(mines[first]).toBe(0);
			for (const n of neighbors(first, 9, 9)) expect(mines[n]).toBe(0);
		}
	});

	it('初手の reveal で配置され、初手は必ず安全で開く', () => {
		const s = input(running(), reveal(4, 4), zero);
		expect(s.placed).toBe(true);
		expect(s.mines.reduce((a, b) => a + b, 0)).toBe(10);
		expect(s.open[idx(4, 4)]).toBe(1);
		expect(s.phase === 'running' || s.phase === 'won').toBe(true);
	});
});

describe('AC-051: 開封と連鎖', () => {
	it('地雷に隣接しないセルを開くと、連鎖して境界の数字まで開く（壁の左側 36 マス）', () => {
		const s = input(withMines(WALL), reveal(0, 0), zero);
		expect(s.score).toBe(36);
		expect(s.phase).toBe('running');
		for (let y = 0; y < 9; y += 1) {
			for (let x = 0; x < 9; x += 1) expect(s.open[idx(x, y)]).toBe(x <= 3 ? 1 : 0);
		}
	});

	it('数字のセルを開いても連鎖しない', () => {
		const s = input(withMines(WALL), reveal(3, 0), zero);
		expect(s.score).toBe(1);
		expect(s.open[idx(3, 0)]).toBe(1);
		expect(s.open[idx(2, 0)]).toBe(0);
	});

	it('開いたセル・旗のセルを開いても同じオブジェクト', () => {
		const s = input(withMines(WALL), reveal(0, 0), zero);
		expect(input(s, reveal(0, 0), zero)).toBe(s);
		const flagged = input(withMines(WALL), flag(8, 8), zero);
		expect(input(flagged, reveal(8, 8), zero)).toBe(flagged);
	});

	it('盤外の座標は同じオブジェクト', () => {
		const s = withMines(WALL);
		expect(input(s, reveal(9, 0), zero)).toBe(s);
		expect(input(s, reveal(0, -1), zero)).toBe(s);
		expect(input(s, flag(0, 9), zero)).toBe(s);
	});

	it('座標が片方だけの cell は無効（カーソルには落とさず同じオブジェクト）', () => {
		const s = withMines(WALL);
		expect(input(s, { type: 'cell', alt: false, x: 0 }, zero)).toBe(s);
		expect(input(s, { type: 'cell', alt: true, y: 0 }, zero)).toBe(s);
	});
});

describe('AC-052: 旗', () => {
	it('隠れたセルの旗はトグルし、開いたセルには立たない', () => {
		const s1 = input(withMines(WALL), flag(4, 0), zero);
		expect(s1.flags[idx(4, 0)]).toBe(1);
		const s2 = input(s1, flag(4, 0), zero);
		expect(s2.flags[idx(4, 0)]).toBe(0);
		const opened = input(withMines(WALL), reveal(0, 0), zero);
		expect(input(opened, flag(0, 0), zero)).toBe(opened);
	});

	it('座標付きの操作はカーソルもそのセルへ動かす', () => {
		const s = input(withMines(WALL), flag(7, 2), zero);
		expect(s.cursor).toEqual({ x: 7, y: 2 });
		const t = input(withMines(WALL), reveal(1, 1), zero);
		expect(t.cursor).toEqual({ x: 1, y: 1 });
	});
});

describe('AC-053 / AC-054: 敗北と勝利', () => {
	it('地雷を開くと over。旗の無い地雷は全部開き、正しい旗は残り、爆発位置と得点が保たれる', () => {
		const flagged = input(input(withMines(WALL), reveal(0, 0), zero), flag(4, 0), zero);
		const s = input(flagged, reveal(4, 1), zero);
		expect(s.phase).toBe('over');
		expect(s.exploded).toBe(idx(4, 1));
		expect(s.score).toBe(36);
		expect(s.open[idx(4, 0)]).toBe(0);
		expect(s.flags[idx(4, 0)]).toBe(1);
		for (let y = 1; y < 9; y += 1) expect(s.open[idx(4, y)]).toBe(1);
		// 開いていた左側はそのまま、開いていない右側は開かない
		expect(s.open[idx(0, 0)]).toBe(1);
		expect(s.open[idx(8, 8)]).toBe(0);
	});

	it('誤った旗（地雷でないセル）は敗北後も旗のまま（レンダラが wrong と表示する）', () => {
		const wrong = input(withMines(WALL), flag(8, 8), zero);
		const s = input(wrong, reveal(4, 4), zero);
		expect(s.phase).toBe('over');
		expect(s.flags[idx(8, 8)]).toBe(1);
		expect(s.open[idx(8, 8)]).toBe(0);
	});

	it('最後の安全セルを開くと won（旗の有無は関係ない）', () => {
		const left = input(withMines(WALL), reveal(0, 0), zero);
		const flagged = input(left, flag(4, 4), zero);
		const s = input(flagged, reveal(8, 8), zero);
		expect(s.phase).toBe('won');
		expect(s.score).toBe(72);
	});

	it('over / won では開封も旗もカーソルも同じオブジェクト', () => {
		const over = input(withMines(WALL), reveal(4, 4), zero);
		expect(over.phase).toBe('over');
		expect(input(over, reveal(0, 0), zero)).toBe(over);
		expect(input(over, flag(0, 0), zero)).toBe(over);
		expect(input(over, turn('left'), zero)).toBe(over);
	});
});

describe('AC-057: カーソル', () => {
	it('矢印で 1 マス動き、端では同じオブジェクト', () => {
		const s = running();
		expect(input(s, turn('left'), zero).cursor).toEqual({ x: 3, y: 4 });
		expect(input(s, turn('up'), zero).cursor).toEqual({ x: 4, y: 3 });
		const corner = running({ cursor: { x: 0, y: 0 } });
		expect(input(corner, turn('left'), zero)).toBe(corner);
		expect(input(corner, turn('up'), zero)).toBe(corner);
		const far = running({ cursor: { x: 8, y: 8 } });
		expect(input(far, turn('right'), zero)).toBe(far);
		expect(input(far, turn('down'), zero)).toBe(far);
	});

	it('座標の無い cell はカーソル位置に効く', () => {
		const s = withMines(WALL, { cursor: { x: 0, y: 0 } });
		const opened = input(s, { type: 'cell', alt: false }, zero);
		expect(opened.open[idx(0, 0)]).toBe(1);
		const flagged = input(withMines(WALL, { cursor: { x: 4, y: 4 } }), { type: 'cell', alt: true }, zero);
		expect(flagged.flags[idx(4, 4)]).toBe(1);
	});
});

describe('phase 遷移（AC-061）', () => {
	it('start: idle → running、over / won からは同じプリセットの新しい盤面', () => {
		const idle = init(zero, 'medium');
		const s = input(idle, { type: 'start' }, zero);
		expect(s.phase).toBe('running');
		const over = input(withMines(WALL), reveal(4, 4), zero);
		const fresh = input(over, { type: 'start' }, zero);
		expect(fresh.phase).toBe('running');
		expect(fresh.preset).toBe('small');
		expect(fresh.placed).toBe(false);
		expect(fresh.score).toBe(0);
		expect(input(s, { type: 'start' }, zero)).toBe(s);
	});

	it('restart は新しい盤面、quit は idle（idle では同じオブジェクト）', () => {
		const s = input(withMines(WALL), reveal(0, 0), zero);
		const r = input(s, { type: 'restart' }, zero);
		expect(r.phase).toBe('running');
		expect(r.score).toBe(0);
		const q = input(s, { type: 'quit' }, zero);
		expect(q.phase).toBe('idle');
		const idle = init(zero);
		expect(input(idle, { type: 'quit' }, zero)).toBe(idle);
	});

	it('pause / resume / toggle-pause / continue / rotate / drop は同じオブジェクト（手番駆動）', () => {
		const s = running();
		for (const a of ['pause', 'resume', 'toggle-pause', 'continue', 'rotate', 'drop'] as const) {
			expect(input(s, { type: a }, zero)).toBe(s);
		}
	});

	it('running 以外では cell と turn は同じオブジェクト', () => {
		const idle = init(zero);
		expect(input(idle, reveal(0, 0), zero)).toBe(idle);
		expect(input(idle, turn('left'), zero)).toBe(idle);
	});
});

describe('ファズ: 全プリセットで乱数操作', () => {
	// 3 プリセット × 700 手で既定の 5 秒に掛かることがある（負荷時に実測）。内容ではなく時間の問題なので上限だけ広げる
	it('例外なし・開封と旗は排他・running 中に開いた地雷は無い・score は開いた安全セル数・地雷数は 0 か規定数', { timeout: 30_000 }, () => {
		const rng = lcg(3);
		for (const preset of ['small', 'medium', 'large'] as const) {
			let s = input(init(rng, preset), { type: 'start' }, rng);
			for (let i = 0; i < 700; i += 1) {
				if (s.phase !== 'running') s = input(s, { type: 'restart' }, rng);
				const x = Math.floor(rng() * s.cols);
				const y = Math.floor(rng() * s.rows);
				const pick = rng();
				const action: HostAction =
					pick < 0.6 ? reveal(x, y) : pick < 0.85 ? flag(x, y) : turn((['up', 'down', 'left', 'right'] as const)[Math.floor(rng() * 4)] ?? 'up');
				s = input(s, action, rng);
				const total = s.cols * s.rows;
				expect(s.mines).toHaveLength(total);
				const mineSum = s.mines.reduce((a, b) => a + b, 0);
				expect(mineSum === 0 || mineSum === s.mineCount).toBe(true);
				let openSafe = 0;
				for (let c = 0; c < total; c += 1) {
					expect((s.open[c] ?? 0) + (s.flags[c] ?? 0)).toBeLessThanOrEqual(1);
					if (s.open[c] && !s.mines[c]) openSafe += 1;
					if (s.phase === 'running') expect(s.open[c] === 1 && s.mines[c] === 1).toBe(false);
				}
				expect(s.score).toBe(openSafe);
				if (s.phase === 'over') {
					expect(s.exploded).not.toBeNull();
					expect(s.mines[s.exploded ?? -1]).toBe(1);
					expect(s.open[s.exploded ?? -1]).toBe(1);
				}
				if (s.phase === 'won') expect(s.score).toBe(total - s.mineCount);
			}
		}
	});
});
