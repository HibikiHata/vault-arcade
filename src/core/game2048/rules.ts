import type { Direction, HostAction, Rng } from '../host/types';
import { CELLS, SIZE, SPAWN_TWO_PROBABILITY, TARGET, type Board2048State, type TileMove } from './types';

// 2048 のルール。純関数のみで、時間・DOM・乱数（rng 以外）に依存しない。
// 手番駆動なので step は無く、turn 入力だけで盤面が進む

/**
 * 1行を左（進行方向の壁側）へ寄せる。空きを詰め、壁側から隣接する同値を1回ずつ合体し、再び詰める。
 * [2,2,2,0] → [4,2,0,0]（AC-033）、[2,2,2,2] → [4,4,0,0]（AC-028）
 */
export function slideRowLeft(row: readonly number[]): { row: number[]; gained: number; moves: TileMove[] } {
	// 空きを除いた値と、その元の位置
	const packed: { value: number; from: number }[] = [];
	row.forEach((v, i) => {
		if (v !== 0) packed.push({ value: v, from: i });
	});
	const out: number[] = [];
	const moves: TileMove[] = [];
	let gained = 0;
	for (let i = 0; i < packed.length; i += 1) {
		const cur = packed[i];
		if (!cur) continue;
		const next = packed[i + 1];
		const to = out.length;
		if (next && next.value === cur.value) {
			out.push(cur.value * 2);
			gained += cur.value * 2;
			moves.push({ from: cur.from, to, merged: true }, { from: next.from, to, merged: true });
			i += 1;
		} else {
			out.push(cur.value);
			moves.push({ from: cur.from, to, merged: false });
		}
	}
	while (out.length < SIZE) out.push(0);
	return { row: out, gained, moves };
}

/** 各方向について、壁側から順に並べたセル index の列を返す */
function lineIndices(dir: Direction): number[][] {
	const lines: number[][] = [];
	const horizontal = dir === 'left' || dir === 'right';
	for (let k = 0; k < SIZE; k += 1) {
		const idx: number[] = [];
		for (let j = 0; j < SIZE; j += 1) idx.push(horizontal ? k * SIZE + j : j * SIZE + k);
		if (dir === 'right' || dir === 'down') idx.reverse();
		lines.push(idx);
	}
	return lines;
}

/** 盤面全体を dir へ寄せる。変化の有無・得点・各タイルの移動（盤面 index）も返す */
export function move(
	grid: readonly number[],
	dir: Direction,
): { grid: number[]; gained: number; changed: boolean; moves: TileMove[] } {
	const next = [...grid];
	const moves: TileMove[] = [];
	let gained = 0;
	let changed = false;
	for (const idx of lineIndices(dir)) {
		const values = idx.map((i) => grid[i] ?? 0);
		const r = slideRowLeft(values);
		gained += r.gained;
		idx.forEach((i, j) => {
			const v = r.row[j] ?? 0;
			if (next[i] !== v) changed = true;
			next[i] = v;
		});
		for (const m of r.moves) {
			const from = idx[m.from];
			const to = idx[m.to];
			if (from !== undefined && to !== undefined) moves.push({ from, to, merged: m.merged });
		}
	}
	return { grid: next, gained, changed, moves };
}

/**
 * 空きセルに新しいタイルを1つ置く。乱数の引き順は「位置 → 値」。
 * 位置 = floor(r1 * 空き数) 番目の空き（行優先）、値 = r2 < 0.9 なら 2、それ以外 4
 */
export function spawn(grid: readonly number[], rng: Rng): { grid: number[]; at: number | null } {
	const empties: number[] = [];
	grid.forEach((v, i) => {
		if (v === 0) empties.push(i);
	});
	const next = [...grid];
	if (empties.length === 0) return { grid: next, at: null };
	const pick = Math.min(empties.length - 1, Math.max(0, Math.floor(rng() * empties.length)));
	const at = empties[pick] ?? null;
	const value = rng() < SPAWN_TWO_PROBABILITY ? 2 : 4;
	if (at !== null) next[at] = value;
	return { grid: next, at };
}

/** 空きがあるか、隣接する同値があれば動ける */
export function canMove(grid: readonly number[]): boolean {
	for (let y = 0; y < SIZE; y += 1) {
		for (let x = 0; x < SIZE; x += 1) {
			const v = grid[y * SIZE + x] ?? 0;
			if (v === 0) return true;
			if (x < SIZE - 1 && grid[y * SIZE + x + 1] === v) return true;
			if (y < SIZE - 1 && grid[(y + 1) * SIZE + x] === v) return true;
		}
	}
	return false;
}

/** タイル2つを置いた idle の盤面 */
export function init(rng: Rng): Board2048State {
	let grid: number[] = new Array<number>(CELLS).fill(0);
	grid = spawn(grid, rng).grid;
	grid = spawn(grid, rng).grid;
	return { phase: 'idle', grid, score: 0, keepPlaying: false, lastMove: null };
}

function fresh(rng: Rng): Board2048State {
	return { ...init(rng), phase: 'running' };
}

/** 入力を状態に適用する。phase に合わない入力は無視して同じ状態を返す */
export function input(state: Board2048State, action: HostAction, rng: Rng): Board2048State {
	switch (action.type) {
		case 'start':
		case 'restart':
			if (state.phase === 'idle') return { ...state, phase: 'running', lastMove: null };
			// 結果画面からの Enter / Restart は新しいゲーム（AC-034）
			if (state.phase === 'over' || state.phase === 'won') return fresh(rng);
			return action.type === 'restart' ? fresh(rng) : state;
		case 'quit':
			return state.phase === 'idle' ? state : init(rng);
		case 'continue': {
			if (state.phase !== 'won') return state;
			// 勝利と手詰まりが同時なら、続行しても動けないので over にする（動けない running に落とさない）
			const phase: Board2048State['phase'] = canMove(state.grid) ? 'running' : 'over';
			return { ...state, phase, keepPlaying: true, lastMove: null };
		}
		case 'pause':
		case 'resume':
		case 'toggle-pause':
			// 手番駆動に一時停止は無い
			return state;
		case 'rotate':
		case 'drop':
			// Blocks 用。2048 には無い
			return state;
		case 'cell':
			// Minesweeper 用
			return state;
		case 'turn': {
			if (state.phase !== 'running') return state;
			const moved = move(state.grid, action.dir);
			if (!moved.changed) return state;
			const spawned = spawn(moved.grid, rng);
			const grid = spawned.grid;
			const score = state.score + moved.gained;
			// 判定はスポーン後。won が over に優先する（AC-031）
			let phase: Board2048State['phase'] = 'running';
			if (!state.keepPlaying && grid.includes(TARGET)) phase = 'won';
			else if (!canMove(grid)) phase = 'over';
			return { ...state, grid, score, phase, lastMove: { moves: moved.moves, spawned: spawned.at } };
		}
	}
}
