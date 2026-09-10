import { describe, expect, it } from 'vitest';
import { canMove, init, input, move, slideRowLeft, spawn } from './rules';
import type { Board2048State } from './types';

// 乱数の引き順: 1回目 = 空きセルの選択 floor(r1 * 空き数)（行優先）、2回目 = 値（r2 < 0.9 → 2、それ以外 4）
const seq = (values: number[]) => {
	let i = 0;
	return () => {
		const v = values[i % values.length] ?? 0;
		i += 1;
		return v;
	};
};
const zero = seq([0]);

const lcg = (seed: number) => {
	let s = seed >>> 0;
	return () => {
		s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
		return s / 4294967296;
	};
};

const grid = (...rows: number[][]): number[] => rows.flat();
const running = (g: number[], over: Partial<Board2048State> = {}): Board2048State => ({
	phase: 'running',
	grid: g,
	score: 0,
	keepPlaying: false,
	lastMove: null,
	...over,
});
const E = [0, 0, 0, 0];

describe('slideRowLeft（1行を左へ寄せて合体）', () => {
	it('AC-023: [2,2,4,0] → [4,4,0,0]、得点 4（合体した 4 は再合体しない）', () => {
		expect(slideRowLeft([2, 2, 4, 0])).toMatchObject({ row: [4, 4, 0, 0], gained: 4 });
	});
	it('AC-028: [2,2,2,2] → [4,4,0,0]、得点 8（各タイルは1回だけ合体）', () => {
		expect(slideRowLeft([2, 2, 2, 2])).toMatchObject({ row: [4, 4, 0, 0], gained: 8 });
	});
	it('AC-033: [2,2,2,0] → [4,2,0,0]、得点 4（進行方向の壁側から合体する）', () => {
		expect(slideRowLeft([2, 2, 2, 0])).toMatchObject({ row: [4, 2, 0, 0], gained: 4 });
	});
	it('間の空きを詰めてから合体する: [0,2,0,2] → [4,0,0,0]、[2,0,2,4] → [4,4,0,0]', () => {
		expect(slideRowLeft([0, 2, 0, 2])).toMatchObject({ row: [4, 0, 0, 0], gained: 4 });
		expect(slideRowLeft([2, 0, 2, 4])).toMatchObject({ row: [4, 4, 0, 0], gained: 4 });
	});
	it('moves: 各タイルの出発位置・到達位置・合体の有無を返す（アニメーション用）', () => {
		expect(slideRowLeft([2, 2, 4, 0]).moves).toEqual([
			{ from: 0, to: 0, merged: true },
			{ from: 1, to: 0, merged: true },
			{ from: 2, to: 1, merged: false },
		]);
		expect(slideRowLeft([0, 2, 0, 2]).moves).toEqual([
			{ from: 1, to: 0, merged: true },
			{ from: 3, to: 0, merged: true },
		]);
		expect(slideRowLeft([2, 4, 8, 16]).moves).toEqual([
			{ from: 0, to: 0, merged: false },
			{ from: 1, to: 1, merged: false },
			{ from: 2, to: 2, merged: false },
			{ from: 3, to: 3, merged: false },
		]);
		expect(slideRowLeft([0, 0, 0, 0]).moves).toEqual([]);
	});

	it('動かない行はそのまま: [2,4,8,16]、[0,0,0,0]', () => {
		expect(slideRowLeft([2, 4, 8, 16])).toMatchObject({ row: [2, 4, 8, 16], gained: 0 });
		expect(slideRowLeft([0, 0, 0, 0])).toMatchObject({ row: [0, 0, 0, 0], gained: 0 });
	});
});

describe('init', () => {
	it('タイル2つ・idle・score 0。rng [0,0,0,0] なら index 0 と 1 に 2 が置かれる', () => {
		const s = init(zero);
		expect(s.phase).toBe('idle');
		expect(s.score).toBe(0);
		expect(s.keepPlaying).toBe(false);
		expect(s.grid).toEqual(grid([2, 2, 0, 0], E, E, E));
	});
	it('1回目の rng で位置、2回目で値（0.95 → 4）を決める。2つ目は残りの空きから選ぶ', () => {
		const s = init(seq([0.5, 0.95, 0, 0]));
		// 1つ目: floor(0.5*16)=8 に 4。2つ目: 残り15の先頭（index 0）に 2
		expect(s.grid).toEqual(grid([2, 0, 0, 0], E, [4, 0, 0, 0], E));
	});
});

describe('input: turn（4方向・スポーン・得点）', () => {
	it('AC-030: 動いた手の後に新しいタイルが1つだけ、rng で選んだ空きセルに現れる', () => {
		const s0 = running(grid([2, 2, 0, 0], E, E, E));
		const s = input(s0, { type: 'turn', dir: 'left' }, seq([0, 0]));
		expect(s.grid).toEqual(grid([4, 2, 0, 0], E, E, E));
		expect(s.score).toBe(4);
		const s4 = input(s0, { type: 'turn', dir: 'left' }, seq([0, 0.95]));
		expect(s4.grid).toEqual(grid([4, 4, 0, 0], E, E, E));
	});
	it('right: 行を右へ寄せる。スポーンは最後の空き（rng 0.999）', () => {
		const s = input(running(grid([2, 2, 4, 0], E, E, E)), { type: 'turn', dir: 'right' }, seq([0.999, 0]));
		expect(s.grid).toEqual(grid([0, 0, 4, 4], E, E, E, ).map((v, i) => (i === 15 ? 2 : v)));
		expect(s.score).toBe(4);
	});
	it('up: 列を上へ寄せる', () => {
		const s = input(running(grid([2, 0, 0, 0], E, [2, 0, 0, 0], E)), { type: 'turn', dir: 'up' }, seq([0.999, 0]));
		expect(s.grid).toEqual(grid([4, 0, 0, 0], E, E, [0, 0, 0, 2]));
		expect(s.score).toBe(4);
	});
	it('down: 列を下へ寄せる', () => {
		const s = input(running(grid([2, 0, 0, 0], E, [2, 0, 0, 0], E)), { type: 'turn', dir: 'down' }, seq([0, 0]));
		// 合体した 4 は index 12。スポーンは先頭の空き index 0
		expect(s.grid).toEqual(grid([2, 0, 0, 0], E, E, [4, 0, 0, 0]));
	});
	it('AC-029: 盤面が変わらない手は同じオブジェクトを返し、スポーンも得点もない', () => {
		const s0 = running(grid([2, 4, 8, 16], E, E, E));
		expect(input(s0, { type: 'turn', dir: 'left' }, zero)).toBe(s0);
	});
	it('入力状態を変更しない（純関数）', () => {
		const s0 = running(grid([2, 2, 0, 0], E, E, E));
		const snapshot = JSON.stringify(s0);
		input(s0, { type: 'turn', dir: 'left' }, zero);
		expect(JSON.stringify(s0)).toBe(snapshot);
	});
	it('running 以外では turn を無視する', () => {
		const idle = init(zero);
		expect(input(idle, { type: 'turn', dir: 'left' }, zero)).toBe(idle);
	});
});

describe('move / spawn / lastMove（アニメーション用の記録）', () => {
	it('move は盤面 index で移動を返す: 右寄せは行の右端へ、下寄せは列の下端へ', () => {
		const right = move(grid([2, 2, 4, 0], E, E, E), 'right');
		expect(right.moves).toEqual([
			{ from: 2, to: 3, merged: false },
			{ from: 1, to: 2, merged: true },
			{ from: 0, to: 2, merged: true },
		]);
		const down = move(grid([2, 0, 0, 0], E, [2, 0, 0, 0], E), 'down');
		expect(down.moves).toEqual([
			{ from: 8, to: 12, merged: true },
			{ from: 0, to: 12, merged: true },
		]);
	});

	it('spawn は置いた位置も返す', () => {
		const r = spawn(grid([4, 4, 0, 0], E, E, E), seq([0, 0]));
		expect(r.at).toBe(2);
		expect(r.grid[2]).toBe(2);
		const full = spawn(new Array<number>(16).fill(2), zero);
		expect(full.at).toBeNull();
	});

	it('turn の後の状態は lastMove（移動記録と新タイルの位置）を持ち、他の操作では null', () => {
		const s0 = running(grid([2, 2, 0, 0], E, E, E));
		const s = input(s0, { type: 'turn', dir: 'left' }, seq([0, 0]));
		expect(s.lastMove).toEqual({
			moves: [
				{ from: 0, to: 0, merged: true },
				{ from: 1, to: 0, merged: true },
			],
			spawned: 1,
		});
		expect(init(zero).lastMove).toBeNull();
		expect(input(s, { type: 'restart' }, zero).lastMove).toBeNull();
	});
});

describe('input: 終了条件（AC-031）', () => {
	it('動ける手が無くなると over', () => {
		// 左へ寄せると index 15 だけが空き、そこに 2 が入って市松模様（合体不可）になる
		const s0 = running(grid([2, 4, 2, 4], [4, 2, 4, 2], [2, 4, 2, 4], [4, 2, 0, 4]));
		const s = input(s0, { type: 'turn', dir: 'left' }, seq([0, 0]));
		expect(s.grid).toEqual(grid([2, 4, 2, 4], [4, 2, 4, 2], [2, 4, 2, 4], [4, 2, 4, 2]));
		expect(s.phase).toBe('over');
		expect(s.score).toBe(0);
	});
	it('2048 ができると won（keepPlaying が false のとき）', () => {
		const s = input(running(grid([1024, 1024, 0, 0], E, E, E)), { type: 'turn', dir: 'left' }, seq([0.999, 0]));
		expect(s.phase).toBe('won');
		expect(s.score).toBe(2048);
		expect(s.grid[0]).toBe(2048);
	});
	it('won と over が同時に成立するときは won', () => {
		const s0 = running(grid([1024, 1024, 2, 4], [4, 8, 2, 4], [2, 4, 8, 2], [8, 2, 4, 8]));
		const s = input(s0, { type: 'turn', dir: 'left' }, seq([0, 0]));
		expect(s.grid).toEqual(grid([2048, 2, 4, 2], [4, 8, 2, 4], [2, 4, 8, 2], [8, 2, 4, 8]));
		expect(canMove(s.grid)).toBe(false);
		expect(s.phase).toBe('won');
	});
	it('continue で running に戻り、以後 2048 があっても won にならない', () => {
		const won = input(running(grid([1024, 1024, 0, 0], E, E, E)), { type: 'turn', dir: 'left' }, seq([0.999, 0]));
		const cont = input(won, { type: 'continue' }, zero);
		expect(cont.phase).toBe('running');
		expect(cont.keepPlaying).toBe(true);
		expect(cont.grid).toEqual(won.grid);
		const next = input(running(grid([2048, 2, 2, 0], E, E, E), { keepPlaying: true }), { type: 'turn', dir: 'left' }, seq([0.999, 0]));
		expect(next.phase).toBe('running');
	});
	it('won かつ手詰まりの盤面で continue すると over になる（動けない running に落ちない）', () => {
		// 2048 を含み、空きも隣接同値も無い盤面
		const dead = running(grid([2048, 2, 4, 2], [4, 8, 2, 4], [2, 4, 8, 2], [8, 2, 4, 8]), { phase: 'won' });
		expect(canMove(dead.grid)).toBe(false);
		const s = input(dead, { type: 'continue' }, zero);
		expect(s.phase).toBe('over');
		expect(s.keepPlaying).toBe(true);
	});

	it('continue は won 以外では無視される', () => {
		const s = running(grid([2, 2, 0, 0], E, E, E));
		expect(input(s, { type: 'continue' }, zero)).toBe(s);
	});
});

describe('input: phase 遷移', () => {
	it('idle → start → running（盤面はそのまま）', () => {
		const idle = init(zero);
		const s = input(idle, { type: 'start' }, zero);
		expect(s.phase).toBe('running');
		expect(s.grid).toEqual(idle.grid);
	});
	it('AC-034: over / won で start は restart と同じく新しいゲームを始める', () => {
		const over = running(grid([2, 4, 2, 4], [4, 2, 4, 2], [2, 4, 2, 4], [4, 2, 4, 2]), { phase: 'over', score: 99 });
		const s = input(over, { type: 'start' }, zero);
		expect(s.phase).toBe('running');
		expect(s.score).toBe(0);
		expect(s.grid).toEqual(grid([2, 2, 0, 0], E, E, E));
		const r = input(over, { type: 'restart' }, zero);
		expect(r.phase).toBe('running');
		expect(r.score).toBe(0);
	});
	it('quit は idle の新しい盤面に戻す', () => {
		const s = input(running(grid([2, 2, 0, 0], E, E, E), { score: 8 }), { type: 'quit' }, zero);
		expect(s.phase).toBe('idle');
		expect(s.score).toBe(0);
	});
	it('pause / resume / toggle-pause は無視される（手番駆動）', () => {
		const s = running(grid([2, 2, 0, 0], E, E, E));
		expect(input(s, { type: 'pause' }, zero)).toBe(s);
		expect(input(s, { type: 'resume' }, zero)).toBe(s);
		expect(input(s, { type: 'toggle-pause' }, zero)).toBe(s);
	});
	it('rotate / drop（Blocks 用）は無視され、同じオブジェクトを返す（AC-045）', () => {
		const s = running(grid([2, 2, 0, 0], E, E, E));
		expect(input(s, { type: 'rotate' }, zero)).toBe(s);
		expect(input(s, { type: 'drop' }, zero)).toBe(s);
	});
	it('cell（Minesweeper 用）は無視され、同じオブジェクトを返す（AC-061）', () => {
		const s = running(grid([2, 2, 0, 0], E, E, E));
		expect(input(s, { type: 'cell', alt: false, x: 0, y: 0 }, zero)).toBe(s);
	});
});

describe('canMove', () => {
	it('空きがあれば true、隣接する同値があれば true、どちらも無ければ false', () => {
		expect(canMove(grid([2, 4, 2, 4], [4, 2, 4, 2], [2, 4, 2, 4], [4, 2, 4, 0]))).toBe(true);
		expect(canMove(grid([2, 4, 2, 4], [4, 2, 4, 2], [2, 4, 2, 4], [4, 2, 2, 8]))).toBe(true);
		expect(canMove(grid([2, 4, 2, 4], [4, 2, 4, 2], [2, 4, 2, 4], [4, 2, 4, 2]))).toBe(false);
	});
});

describe('1,000 手のファズ', () => {
	it('例外なし・セルは 0 か 2 以上の 2 の冪・得点は単調増加・変化しない手は同じオブジェクト', () => {
		const rng = lcg(2048);
		const dirs = ['up', 'down', 'left', 'right'] as const;
		let s = input(init(rng), { type: 'start' }, rng);
		let lastScore = 0;
		for (let t = 0; t < 1000 && s.phase === 'running'; t += 1) {
			const d = dirs[Math.floor(rng() * 4)] ?? 'up';
			const next = input(s, { type: 'turn', dir: d }, rng);
			if (next === s) continue;
			expect(next.score).toBeGreaterThanOrEqual(lastScore);
			lastScore = next.score;
			for (const v of next.grid) {
				expect(v === 0 || (v >= 2 && (v & (v - 1)) === 0)).toBe(true);
			}
			s = next;
		}
		expect(['running', 'over', 'won']).toContain(s.phase);
	});
});
