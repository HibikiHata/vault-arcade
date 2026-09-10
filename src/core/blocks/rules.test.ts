import { describe, expect, it } from 'vitest';
import type { HostAction } from '../host/types';
import { GRAVITY_TICKS, LOCK_DELAY_TICKS, SPAWN_X, SPAWN_Y, gravityTicks } from './constants';
import { clearLines, fits, init, input, landingY, nextPiece, step } from './rules';
import { bottomRows, EMPTY_ROW, lcg, seq, wellBottom } from './testing';
import type { BlocksState } from './types';

// 乱数 0 固定: bag は ['O','T','S','Z','J','L','I']（bag.test の手計算）→ 最初のピースは O、残り 6 個
const zero = seq([0]);

const running = (over: Partial<BlocksState> = {}): BlocksState => ({
	...input(init(zero), { type: 'start' }, zero),
	...over,
});

const turn = (dir: 'up' | 'down' | 'left' | 'right'): HostAction => ({ type: 'turn', dir });

describe('init', () => {
	it('空の井戸・idle・level 1・スポーン位置のピースと残り 6 個の bag（乱数を 6 回消費）', () => {
		let calls = 0;
		const s = init(() => {
			calls += 1;
			return 0;
		});
		expect(calls).toBe(6);
		expect(s.phase).toBe('idle');
		expect(s.well).toHaveLength(200);
		expect(s.well.every((c) => c === 0)).toBe(true);
		expect(s.piece).toBe('O');
		expect(s.bag).toEqual(['T', 'S', 'Z', 'J', 'L', 'I']);
		expect(s.rotation).toBe(0);
		expect(s.x).toBe(SPAWN_X);
		expect(s.y).toBe(SPAWN_Y);
		expect(s.score).toBe(0);
		expect(s.lines).toBe(0);
		expect(s.level).toBe(1);
		expect(s.gravity).toBe(0);
		expect(s.lock).toBe(0);
	});
});

describe('重力（step）', () => {
	it('level 1 では GRAVITY_TICKS[0] = 16 tick ごとに 1 マス落ちる', () => {
		let s = running();
		for (let i = 1; i <= 15; i += 1) {
			s = step(s, zero);
			expect(s.y).toBe(0);
			expect(s.gravity).toBe(i);
		}
		s = step(s, zero);
		expect(s.y).toBe(1);
		expect(s.gravity).toBe(0);
	});

	it('gravityTicks は level で表を引き、末尾でクランプする（AC-039）', () => {
		expect(gravityTicks(1)).toBe(16);
		expect(gravityTicks(2)).toBe(14);
		expect(gravityTicks(GRAVITY_TICKS.length)).toBe(1);
		expect(gravityTicks(50)).toBe(1);
	});

	it('level 11 以上では毎 tick 落ちる', () => {
		const s = step(running({ level: 11 }), zero);
		expect(s.y).toBe(1);
	});

	it('running 以外では同じオブジェクトを返す', () => {
		const idle = init(zero);
		expect(step(idle, zero)).toBe(idle);
		const paused = input(running(), { type: 'pause' }, zero);
		expect(step(paused, zero)).toBe(paused);
	});
});

describe('移動と回転', () => {
	it('左右に 1 マス動く。壁にぶつかる移動は同じオブジェクト', () => {
		expect(input(running(), turn('left'), zero).x).toBe(2);
		expect(input(running(), turn('right'), zero).x).toBe(4);
		// O は 2×2 の箱（列 0〜1）なので x = 0 で左端、x = 8 で右端
		const atLeft = running({ x: 0 });
		expect(input(atLeft, turn('left'), zero)).toBe(atLeft);
		const atRight = running({ x: 8 });
		expect(input(atRight, turn('right'), zero)).toBe(atRight);
	});

	it('AC-037: ソフトドロップは 1 マス下げてカウンタを戻す。床の上では同じオブジェクト', () => {
		const s = input(running({ gravity: 7, lock: 2 }), turn('down'), zero);
		expect(s.y).toBe(1);
		expect(s.gravity).toBe(0);
		expect(s.lock).toBe(0);
		const floor = running({ y: 18 });
		expect(input(floor, turn('down'), zero)).toBe(floor);
	});

	it('turn up は無視される（回転は rotate）', () => {
		const s = running({ piece: 'T' });
		expect(input(s, turn('up'), zero)).toBe(s);
	});

	it('空いていれば時計回りに 1 状態進む。O は同じオブジェクト', () => {
		const t = input(running({ piece: 'T' }), { type: 'rotate' }, zero);
		expect(t.rotation).toBe(1);
		expect(t.x).toBe(3);
		const o = running();
		expect(input(o, { type: 'rotate' }, zero)).toBe(o);
	});

	it('AC-035: 左壁に接した T（右向き）を回すと 1 列右にずれて成立する', () => {
		// 右向き T は箱の列 1〜2 → x = -1 で列 0〜1。下向きは列 0〜2 を使うので x = 0 へ蹴る
		const s = input(running({ piece: 'T', rotation: 1, x: -1, y: 5 }), { type: 'rotate' }, zero);
		expect(s.rotation).toBe(2);
		expect(s.x).toBe(0);
	});

	it('I は最大 3 列蹴る（縦の I が左端にあるとき）', () => {
		// 縦（右端）の I は箱の列 3 → x = -3 で列 0。次の横（下端）は列 0〜3 を使うので x = 0 まで蹴る
		const s = input(running({ piece: 'I', rotation: 1, x: -3, y: 5 }), { type: 'rotate' }, zero);
		expect(s.rotation).toBe(2);
		expect(s.x).toBe(0);
	});

	it('蹴りは 0 → -1 → +1 の順に試し、両側が空いていれば -1 を選ぶ', () => {
		// 上向き T (4,5),(3,6),(4,6),(5,6) を右向きに回すと (4,5),(4,6),(5,6),(4,7) が要る。
		// (4,7) だけ塞ぐと dx=0 は不可、dx=-1 と dx=+1 は両方可 → -1 が先
		const well = new Array<number>(200).fill(0);
		well[7 * 10 + 4] = 1;
		const s = input(running({ piece: 'T', rotation: 0, x: 3, y: 5, well }), { type: 'rotate' }, zero);
		expect(s.rotation).toBe(1);
		expect(s.x).toBe(2);
	});

	it('どの蹴りでも入らなければ同じオブジェクト（床際で縦にできない T）', () => {
		const s = running({ piece: 'T', rotation: 0, y: 18 });
		expect(input(s, { type: 'rotate' }, zero)).toBe(s);
	});

	it('回転と横移動はロック遅延を戻さない', () => {
		const s = running({ piece: 'T', lock: 4, gravity: 3 });
		expect(input(s, { type: 'rotate' }, zero).lock).toBe(4);
		expect(input(s, turn('left'), zero).lock).toBe(4);
		expect(input(s, turn('left'), zero).gravity).toBe(3);
	});
});

describe('ロックとハードドロップ', () => {
	it('AC-036: ハードドロップは最下段へ落として即ロックし、次のピースを出す', () => {
		const s = input(running(), { type: 'drop' }, zero);
		expect(bottomRows(s.well, 2)).toEqual(['...##.....', '...##.....']);
		expect(s.piece).toBe('T');
		expect(s.bag).toEqual(['S', 'Z', 'J', 'L', 'I']);
		expect(s.rotation).toBe(0);
		expect(s.x).toBe(SPAWN_X);
		expect(s.y).toBe(SPAWN_Y);
		expect(s.gravity).toBe(0);
		expect(s.lock).toBe(0);
		expect(s.phase).toBe('running');
		expect(s.score).toBe(0);
	});

	it('AC-038: 床に接したピースは LOCK_DELAY_TICKS 回の tick でロックする', () => {
		let s = running({ y: 18 });
		for (let i = 1; i < LOCK_DELAY_TICKS; i += 1) {
			s = step(s, zero);
			expect(s.lock).toBe(i);
			expect(s.piece).toBe('O');
			expect(s.well.every((c) => c === 0)).toBe(true);
		}
		s = step(s, zero);
		expect(s.piece).toBe('T');
		expect(s.lock).toBe(0);
		expect(bottomRows(s.well, 2)).toEqual(['...##.....', '...##.....']);
	});

	it('AC-038: 横に動いて再び落ちるとロック遅延が 0 に戻る（横移動自体は戻さない）', () => {
		// 列 4 の 1 ブロックに O（列 3〜4）が乗っている。左へ 1 マス動くと列 2〜3 になり、下が空く
		let s = running({ x: 3, y: 17, well: wellBottom(['....#.....']), gravity: 15 });
		for (let i = 1; i <= 3; i += 1) s = step(s, zero);
		expect(s.lock).toBe(3);
		expect(s.y).toBe(17);
		s = input(s, turn('left'), zero);
		expect(s.lock).toBe(3);
		s = step(s, zero);
		expect(s.y).toBe(18);
		expect(s.lock).toBe(0);
		expect(s.gravity).toBe(0);
	});
});

describe('ライン消去と得点（AC-022）', () => {
	// 縦の I（rotation 1 は箱の列 3）を x = 1 に置くと列 4。列 4 だけ空いた行を埋める
	const verticalI = (well: number[], over: Partial<BlocksState> = {}): BlocksState =>
		running({ piece: 'I', rotation: 1, x: 1, y: 0, well, ...over });

	it('1 行消える: 上の行が下がり、得点は 100 × level', () => {
		const s = input(verticalI(wellBottom(['####.#####'])), { type: 'drop' }, zero);
		expect(s.score).toBe(100);
		expect(s.lines).toBe(1);
		expect(s.level).toBe(1);
		expect(bottomRows(s.well, 4)).toEqual([EMPTY_ROW, '....#.....', '....#.....', '....#.....']);
	});

	it('隣接しない 2 行が同時に消え、間の行は詰まる（300 点）', () => {
		const s = input(verticalI(wellBottom(['####.#####', EMPTY_ROW, '####.#####'])), { type: 'drop' }, zero);
		expect(s.score).toBe(300);
		expect(s.lines).toBe(2);
		expect(bottomRows(s.well, 3)).toEqual([EMPTY_ROW, '....#.....', '....#.....']);
	});

	it('3 行同時消しは 500 点', () => {
		const rows = ['####.#####', '####.#####', '####.#####'];
		const s = input(verticalI(wellBottom(rows)), { type: 'drop' }, zero);
		expect(s.score).toBe(500);
		expect(s.lines).toBe(3);
	});

	it('4 行同時消しは 800 点で井戸が空になる', () => {
		const rows = ['####.#####', '####.#####', '####.#####', '####.#####'];
		const s = input(verticalI(wellBottom(rows)), { type: 'drop' }, zero);
		expect(s.score).toBe(800);
		expect(s.lines).toBe(4);
		expect(s.well.every((c) => c === 0)).toBe(true);
	});

	it('得点は消去前の level を掛ける', () => {
		const s = input(verticalI(wellBottom(['####.#####']), { level: 3, lines: 25 }), { type: 'drop' }, zero);
		expect(s.score).toBe(300);
	});

	it('AC-039: 10 ライン目で level 2 になる', () => {
		const s = input(verticalI(wellBottom(['####.#####']), { lines: 9 }), { type: 'drop' }, zero);
		expect(s.lines).toBe(10);
		expect(s.level).toBe(2);
	});

	it('clearLines は満杯の行だけ取り除き、上の行を下へ詰める', () => {
		const { well, cleared } = clearLines(wellBottom(['#.........', '##########', '.#........']));
		expect(cleared).toBe(1);
		expect(bottomRows(well, 3)).toEqual([EMPTY_ROW, '#.........', '.#........']);
	});
});

describe('ゲームオーバー（AC-040）', () => {
	it('次のピースがスポーン位置に置けなければ over になり、得点は保たれる', () => {
		// 上 2 行に列 4〜5 のブロック。O（列 3〜4）を落として 1 行消しても、次の T のスポーン位置（行 0〜1）は塞がったまま
		const well = wellBottom([
			'....##....',
			'....##....',
			...new Array<string>(17).fill(EMPTY_ROW),
			'###..#####',
		]);
		const s = input(running({ y: 17, well }), { type: 'drop' }, zero);
		expect(s.phase).toBe('over');
		expect(s.score).toBe(100);
		expect(s.piece).toBe('T');
	});

	it('over では step も操作も同じオブジェクトを返す', () => {
		const well = wellBottom(['....##....', '....##....', ...new Array<string>(18).fill(EMPTY_ROW)]);
		const over = input(running({ y: 17, well }), { type: 'drop' }, zero);
		expect(over.phase).toBe('over');
		expect(step(over, zero)).toBe(over);
		expect(input(over, turn('left'), zero)).toBe(over);
		expect(input(over, { type: 'rotate' }, zero)).toBe(over);
		expect(input(over, { type: 'drop' }, zero)).toBe(over);
	});
});

describe('phase 遷移', () => {
	it('start: idle → running（同じ井戸とピース）。running / paused では無視', () => {
		const idle = init(zero);
		const s = input(idle, { type: 'start' }, zero);
		expect(s.phase).toBe('running');
		expect(s.piece).toBe(idle.piece);
		expect(input(s, { type: 'start' }, zero)).toBe(s);
		const paused = input(s, { type: 'pause' }, zero);
		expect(input(paused, { type: 'start' }, zero)).toBe(paused);
	});

	it('restart: idle → running（再初期化なし）、それ以外は新しいゲーム', () => {
		const idle = init(zero);
		const fromIdle = input(idle, { type: 'restart' }, zero);
		expect(fromIdle.phase).toBe('running');
		expect(fromIdle.piece).toBe(idle.piece);
		const s = input(running({ score: 500, lines: 12, level: 2, y: 9 }), { type: 'restart' }, zero);
		expect(s.phase).toBe('running');
		expect(s.score).toBe(0);
		expect(s.level).toBe(1);
		expect(s.y).toBe(SPAWN_Y);
	});

	it('quit: idle では同じオブジェクト、それ以外は idle の新しいゲーム', () => {
		const idle = init(zero);
		expect(input(idle, { type: 'quit' }, zero)).toBe(idle);
		const s = input(running({ score: 300 }), { type: 'quit' }, zero);
		expect(s.phase).toBe('idle');
		expect(s.score).toBe(0);
	});

	it('over から start は新しいゲーム（Enter = Restart）', () => {
		const well = wellBottom(['....##....', '....##....', ...new Array<string>(18).fill(EMPTY_ROW)]);
		const over = input(running({ y: 17, well, score: 40 }), { type: 'drop' }, zero);
		const s = input(over, { type: 'start' }, zero);
		expect(s.phase).toBe('running');
		expect(s.score).toBe(0);
		expect(s.well.every((c) => c === 0)).toBe(true);
	});

	it('pause / resume / toggle-pause は running と paused の間だけ', () => {
		const s = running();
		const paused = input(s, { type: 'pause' }, zero);
		expect(paused.phase).toBe('paused');
		expect(input(paused, { type: 'pause' }, zero)).toBe(paused);
		expect(input(paused, { type: 'resume' }, zero).phase).toBe('running');
		expect(input(s, { type: 'resume' }, zero)).toBe(s);
		expect(input(s, { type: 'toggle-pause' }, zero).phase).toBe('paused');
		expect(input(paused, { type: 'toggle-pause' }, zero).phase).toBe('running');
		const idle = init(zero);
		expect(input(idle, { type: 'toggle-pause' }, zero)).toBe(idle);
	});

	it('cell（Minesweeper 用）は Blocks では無視され、同じオブジェクトを返す（AC-061）', () => {
		const s = running();
		expect(input(s, { type: 'cell', alt: false, x: 3, y: 3 }, zero)).toBe(s);
		expect(input(s, { type: 'cell', alt: true }, zero)).toBe(s);
	});

	it('paused 中の移動・回転・ドロップ、continue は同じオブジェクト', () => {
		const paused = input(running(), { type: 'pause' }, zero);
		expect(input(paused, turn('left'), zero)).toBe(paused);
		expect(input(paused, { type: 'rotate' }, zero)).toBe(paused);
		expect(input(paused, { type: 'drop' }, zero)).toBe(paused);
		const s = running();
		expect(input(s, { type: 'continue' }, zero)).toBe(s);
	});
});

describe('landingY と lastClear（ゴースト表示と消去演出のための派生情報）', () => {
	const verticalI = (well: number[]): BlocksState => running({ piece: 'I', rotation: 1, x: 1, y: 0, well });

	it('landingY は現在の x と回転で落ちきる行。空の井戸の O は 18、床の上なら今の y、下に積みがあればその上', () => {
		expect(landingY(running())).toBe(18);
		expect(landingY(running({ y: 18 }))).toBe(18);
		// O は列 3〜4。(4,19) が埋まっているので行 17 で止まる
		expect(landingY(running({ well: wellBottom(['....#.....']) }))).toBe(17);
		// 縦の I（4 行）は行 16 で止まる
		expect(landingY(running({ piece: 'I', rotation: 1, x: 1 }))).toBe(16);
	});

	it('init と、行が消えないロックでは lastClear は null', () => {
		expect(init(zero).lastClear).toBeNull();
		expect(input(running(), { type: 'drop' }, zero).lastClear).toBeNull();
	});

	it('行が消えたロックでは、消えた行番号（消去前の井戸での行）と固定したピースのセルを lastClear に載せる', () => {
		const s = input(verticalI(wellBottom(['####.#####', EMPTY_ROW, '####.#####'])), { type: 'drop' }, zero);
		expect(s.lastClear?.rows).toEqual([17, 19]);
		expect(s.lastClear?.cells.map(([c, r]) => `${c},${r}`).sort()).toEqual(['4,16', '4,17', '4,18', '4,19']);
	});

	it('nextPiece は bag の先頭で、次にスポーンするピースと一致する（AC-048）', () => {
		const empty = new Array<number>(200).fill(0);
		let s = running();
		for (let i = 0; i < 14; i += 1) {
			// 井戸を空に戻して 2 巡分（14 個）を続けて確認する（積み上げてゲームオーバーにならないように）
			s = { ...s, well: empty };
			const expected = nextPiece(s);
			s = input(s, { type: 'drop' }, zero);
			expect(s.phase).toBe('running');
			expect(s.piece).toBe(expected);
			expect(s.bag.length).toBeGreaterThanOrEqual(1);
		}
	});

	it('lastClear は次にロックして行が消えなければ null に戻る', () => {
		const cleared = input(verticalI(wellBottom(['####.#####'])), { type: 'drop' }, zero);
		expect(cleared.lastClear).not.toBeNull();
		expect(input(cleared, { type: 'drop' }, zero).lastClear).toBeNull();
	});
});

describe('ファズ: 2,000 回の tick と乱数操作', () => {
	it('例外なし・井戸は 0/1・running 中のピースは必ず置ける・得点は単調・level = 1 + floor(lines / 10)', () => {
		const rng = lcg(7);
		const actions: HostAction[] = [turn('left'), turn('right'), turn('down'), { type: 'rotate' }, { type: 'drop' }];
		let s = running();
		let lastScore = 0;
		for (let i = 0; i < 2000; i += 1) {
			if (s.phase === 'over') {
				s = input(s, { type: 'restart' }, rng);
				lastScore = 0;
			}
			const pick = Math.floor(rng() * 8);
			const action = actions[pick];
			s = action ? input(s, action, rng) : step(s, rng);
			expect(s.well).toHaveLength(200);
			expect(s.well.every((c) => c === 0 || c === 1)).toBe(true);
			if (s.phase === 'running') expect(fits(s.well, s.piece, s.rotation, s.x, s.y)).toBe(true);
			expect(s.score).toBeGreaterThanOrEqual(lastScore);
			lastScore = s.score;
			expect(s.level).toBe(1 + Math.floor(s.lines / 10));
			expect(s.bag.length).toBeGreaterThanOrEqual(1);
			expect(s.bag.length).toBeLessThanOrEqual(7);
			expect(new Set(s.bag).size).toBe(s.bag.length);
		}
	});
});
