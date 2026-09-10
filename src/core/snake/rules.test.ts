import { describe, expect, it } from 'vitest';
import type { Point } from '../host/types';
import { init, input, step } from './rules';
import type { SnakeState } from './types';

// 固定列を返す乱数。placeFood は floor(rng() * 空きセル数) 番目の空きセル（行優先）を選ぶ
const seq = (values: number[]) => {
	let i = 0;
	return () => {
		const v = values[i % values.length] ?? 0;
		i += 1;
		return v;
	};
};
const zero = seq([0]);

// 線形合同法。AC-008 のファズ用に決定的な乱数列を作る
const lcg = (seed: number) => {
	let s = seed >>> 0;
	return () => {
		s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
		return s / 4294967296;
	};
};

const running = (over: Partial<SnakeState> = {}): SnakeState => ({
	...input(init(20, 20, zero), { type: 'start' }, zero),
	...over,
});

const p = (x: number, y: number): Point => ({ x, y });

describe('init', () => {
	it('20x20・長さ3で中央から右向き・idle・score 0（AC-005 の前提）', () => {
		const s = init(20, 20, zero);
		expect(s.phase).toBe('idle');
		expect(s.cols).toBe(20);
		expect(s.rows).toBe(20);
		expect(s.body).toEqual([p(10, 10), p(9, 10), p(8, 10)]);
		expect(s.dir).toBe('right');
		expect(s.queue).toEqual([]);
		expect(s.score).toBe(0);
	});

	it('餌は rng で選んだ空きセルに置かれ、体の上には来ない', () => {
		expect(init(20, 20, zero).food).toEqual(p(0, 0));
		// 空きセル 397 個のうち、行優先で (8,10)(9,10)(10,10) を飛ばした直後を狙う: index 208 = (11,10)
		const s = init(20, 20, seq([208.5 / 397]));
		expect(s.food).toEqual(p(11, 10));
	});
});

describe('step: 移動と成長', () => {
	it('頭が1マス進み、尾が1マス消える', () => {
		const s = step(running(), zero);
		expect(s.body).toEqual([p(11, 10), p(10, 10), p(9, 10)]);
		expect(s.score).toBe(0);
		expect(s.phase).toBe('running');
	});

	it('AC-005: 餌を食べると長さ+1・score+1・新しい餌が空きセルに置かれる', () => {
		const s = step(running({ food: p(11, 10) }), zero);
		expect(s.body).toEqual([p(11, 10), p(10, 10), p(9, 10), p(8, 10)]);
		expect(s.score).toBe(1);
		expect(s.food).toEqual(p(0, 0));
		expect(s.body).not.toContainEqual(s.food);
	});

	it('入力状態を変更しない（純関数）', () => {
		const before = running();
		const snapshot = JSON.stringify(before);
		step(before, zero);
		expect(JSON.stringify(before)).toBe(snapshot);
	});
});

describe('step: 終了条件', () => {
	it('AC-006: 右端で右へ進むと over になり、体は変わらない', () => {
		const s0 = running({ body: [p(19, 10), p(18, 10), p(17, 10)], food: p(0, 0) });
		const s = step(s0, zero);
		expect(s.phase).toBe('over');
		expect(s.body).toEqual(s0.body);
	});

	it('AC-006: 上端で上へ進むと over', () => {
		const s0 = running({ body: [p(5, 0), p(5, 1), p(5, 2)], dir: 'up', food: p(0, 0) });
		expect(step(s0, zero).phase).toBe('over');
	});

	it('AC-008: 移動後も残る体のセルに頭が入ると over', () => {
		// 鉤形。頭 (2,2) が左へ進むと (1,2) = body[3]（尾ではない）に当たる
		const s0 = running({
			body: [p(2, 2), p(2, 1), p(1, 1), p(1, 2), p(1, 3)],
			dir: 'left',
			food: p(0, 0),
		});
		expect(step(s0, zero).phase).toBe('over');
	});

	it('尾のセルには入れる（尾は同じ tick で動くため）', () => {
		const s0 = running({ body: [p(1, 1), p(0, 1), p(0, 0), p(1, 0)], dir: 'right', food: p(5, 5) });
		const s1 = input(s0, { type: 'turn', dir: 'up' }, zero);
		const s = step(s1, zero);
		expect(s.phase).toBe('running');
		expect(s.body).toEqual([p(1, 0), p(1, 1), p(0, 1), p(0, 0)]);
	});

	it('AC-009: 最後の空きセルの餌を食べると won・score 397・food null', () => {
		// 蛇行経路で 400 セルを順に並べ、先頭 399 セルを体（頭は 399 番目）にする
		const path: Point[] = [];
		for (let y = 0; y < 20; y += 1) {
			for (let i = 0; i < 20; i += 1) {
				path.push(p(y % 2 === 0 ? i : 19 - i, y));
			}
		}
		const body = path.slice(0, 399).reverse(); // 頭 = path[398] = (1,19)
		const s0 = running({ body, dir: 'left', food: path[399] ?? null, score: 396 });
		const s = step(s0, zero);
		expect(s.phase).toBe('won');
		expect(s.score).toBe(397);
		expect(s.body).toHaveLength(400);
		expect(s.food).toBeNull();
	});
});

describe('input: 方向キュー（AC-007）', () => {
	it('現在方向と同じ・逆の入力は無視される', () => {
		const s = running();
		expect(input(s, { type: 'turn', dir: 'right' }, zero).queue).toEqual([]);
		expect(input(s, { type: 'turn', dir: 'left' }, zero).queue).toEqual([]);
	});

	it('同一 tick 内の up→left は順に適用され、反転は起きない', () => {
		let s = running();
		s = input(s, { type: 'turn', dir: 'up' }, zero);
		s = input(s, { type: 'turn', dir: 'left' }, zero);
		expect(s.queue).toEqual(['up', 'left']);
		s = step(s, zero);
		expect(s.dir).toBe('up');
		expect(s.body[0]).toEqual(p(10, 9));
		expect(s.queue).toEqual(['left']);
		s = step(s, zero);
		expect(s.dir).toBe('left');
		expect(s.body[0]).toEqual(p(9, 9));
	});

	it('キュー末尾の逆方向は無視され、3件目は捨てられる', () => {
		let s = running();
		s = input(s, { type: 'turn', dir: 'up' }, zero);
		expect(input(s, { type: 'turn', dir: 'down' }, zero).queue).toEqual(['up']);
		s = input(s, { type: 'turn', dir: 'left' }, zero);
		s = input(s, { type: 'turn', dir: 'down' }, zero);
		expect(s.queue).toEqual(['up', 'left']);
	});

	it('running 以外では turn を受け付けない', () => {
		const idle = init(20, 20, zero);
		expect(input(idle, { type: 'turn', dir: 'up' }, zero).queue).toEqual([]);
		const paused = input(running(), { type: 'pause' }, zero);
		expect(input(paused, { type: 'turn', dir: 'up' }, zero).queue).toEqual([]);
	});
});

describe('phase 遷移', () => {
	it('idle → start → running', () => {
		expect(input(init(20, 20, zero), { type: 'start' }, zero).phase).toBe('running');
	});

	it('running → pause → paused、step は同じオブジェクトを返す', () => {
		const paused = input(running(), { type: 'pause' }, zero);
		expect(paused.phase).toBe('paused');
		expect(step(paused, zero)).toBe(paused);
	});

	it('paused → resume → running、toggle-pause は往復する', () => {
		const paused = input(running(), { type: 'pause' }, zero);
		expect(input(paused, { type: 'resume' }, zero).phase).toBe('running');
		expect(input(paused, { type: 'toggle-pause' }, zero).phase).toBe('running');
		expect(input(running(), { type: 'toggle-pause' }, zero).phase).toBe('paused');
	});

	it('over → restart は初期化された running を返す', () => {
		const over = running({ body: [p(19, 10), p(18, 10), p(17, 10)], food: p(0, 0), score: 40 });
		const s = input(step(over, zero), { type: 'restart' }, zero);
		expect(s.phase).toBe('running');
		expect(s.body).toEqual([p(10, 10), p(9, 10), p(8, 10)]);
		expect(s.score).toBe(0);
	});

	it('over → start も再初期化して running（Enter キー）', () => {
		const over = step(running({ body: [p(19, 10), p(18, 10), p(17, 10)], food: p(0, 0) }), zero);
		const s = input(over, { type: 'start' }, zero);
		expect(s.phase).toBe('running');
		expect(s.body).toHaveLength(3);
	});

	it('paused → quit は初期化された idle を返す', () => {
		const paused = input(running({ score: 5 }), { type: 'pause' }, zero);
		const s = input(paused, { type: 'quit' }, zero);
		expect(s.phase).toBe('idle');
		expect(s.score).toBe(0);
	});

	it('idle の step と、over の step は同じオブジェクトを返す', () => {
		const idle = init(20, 20, zero);
		expect(step(idle, zero)).toBe(idle);
		const over = step(running({ body: [p(19, 10), p(18, 10), p(17, 10)], food: p(0, 0) }), zero);
		expect(step(over, zero)).toBe(over);
	});
});

describe('host 共通アクション', () => {
	it('continue（2048 の Keep playing）は Snake では無視され、同じオブジェクトを返す', () => {
		const s = running();
		expect(input(s, { type: 'continue' }, zero)).toBe(s);
		const idle = init(20, 20, zero);
		expect(input(idle, { type: 'continue' }, zero)).toBe(idle);
	});

	it('rotate / drop（Blocks 用）は Snake では無視され、同じオブジェクトを返す（AC-045）', () => {
		const s = running();
		expect(input(s, { type: 'rotate' }, zero)).toBe(s);
		expect(input(s, { type: 'drop' }, zero)).toBe(s);
	});

	it('cell（Minesweeper 用）は Snake では無視され、同じオブジェクトを返す（AC-061）', () => {
		const s = running();
		expect(input(s, { type: 'cell', alt: false, x: 1, y: 1 }, zero)).toBe(s);
		expect(input(s, { type: 'cell', alt: true }, zero)).toBe(s);
	});
});

describe('AC-008: 1,000 tick のファズ', () => {
	it('例外なし・running 中は体のセルが重複しない・score = 長さ-3', () => {
		const rng = lcg(20260908);
		const dirs = ['up', 'down', 'left', 'right'] as const;
		let s = input(init(20, 20, rng), { type: 'start' }, rng);
		for (let t = 0; t < 1000 && s.phase === 'running'; t += 1) {
			const d = dirs[Math.floor(rng() * 4)] ?? 'up';
			s = input(s, { type: 'turn', dir: d }, rng);
			s = step(s, rng);
			const keys = new Set(s.body.map((c) => `${c.x},${c.y}`));
			expect(keys.size).toBe(s.body.length);
			expect(s.score).toBe(s.body.length - 3);
			if (s.food) expect(s.body).not.toContainEqual(s.food);
		}
		expect(['running', 'over', 'won']).toContain(s.phase);
	});
});
