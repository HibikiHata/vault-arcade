import type { Direction, HostAction, Rng } from '../host/types';
import { isMinesweeperPreset, type MinesweeperPreset } from '../settings';
import type { MinesweeperState, Preset } from './types';

// Minesweeper のルール（純関数）。乱数は初手の地雷配置でだけ消費する。
// 変化が無い操作は同じオブジェクトを返す（ビューはそれで再描画を省く）

/** プリセット表。スマホ縦（盤面 ≈ 358 px）で small と medium が 32 px 以上になる */
export const PRESETS: Readonly<Record<MinesweeperPreset, Preset>> = {
	small: { cols: 9, rows: 9, mines: 10 },
	medium: { cols: 11, rows: 11, mines: 18 },
	large: { cols: 16, rows: 16, mines: 40 },
};

/** 盤内の近傍（最大 8）の index */
export function neighbors(index: number, cols: number, rows: number): number[] {
	const x = index % cols;
	const y = Math.floor(index / cols);
	const out: number[] = [];
	for (let dy = -1; dy <= 1; dy += 1) {
		for (let dx = -1; dx <= 1; dx += 1) {
			if (dx === 0 && dy === 0) continue;
			const nx = x + dx;
			const ny = y + dy;
			if (nx < 0 || nx >= cols || ny < 0 || ny >= rows) continue;
			out.push(ny * cols + nx);
		}
	}
	return out;
}

/** 隣接する地雷の数 */
export function adjacentCount(mines: readonly number[], index: number, cols: number, rows: number): number {
	let n = 0;
	for (const i of neighbors(index, cols, rows)) if (mines[i]) n += 1;
	return n;
}

/**
 * 初手のセル first を安全にして地雷を置く（AC-050）。候補は first とその近傍を除いた全セル、
 * 候補が足りなければ first だけを除く。部分 Fisher–Yates: i = 0..mines-1 で j = i + floor(rng() * (n - i))、
 * 乱数の消費は地雷数ちょうど（テストで固定列から手計算できる契約）
 */
export function placeMines(cols: number, rows: number, mineCount: number, first: number, rng: Rng): number[] {
	const total = cols * rows;
	const excluded = new Set<number>([first, ...neighbors(first, cols, rows)]);
	let eligible: number[] = [];
	for (let i = 0; i < total; i += 1) if (!excluded.has(i)) eligible.push(i);
	if (eligible.length < mineCount) {
		eligible = [];
		for (let i = 0; i < total; i += 1) if (i !== first) eligible.push(i);
	}
	for (let i = 0; i < mineCount; i += 1) {
		const j = i + Math.floor(rng() * (eligible.length - i));
		const a = eligible[i];
		const b = eligible[j];
		if (a !== undefined && b !== undefined) {
			eligible[i] = b;
			eligible[j] = a;
		}
	}
	const mines = new Array<number>(total).fill(0);
	for (let i = 0; i < mineCount; i += 1) {
		const at = eligible[i];
		if (at !== undefined) mines[at] = 1;
	}
	return mines;
}

/** 未知の variant は small（AC-056）。乱数は消費しない */
export function init(rng: Rng, variant?: string): MinesweeperState {
	void rng;
	const preset: MinesweeperPreset = isMinesweeperPreset(variant) ? variant : 'small';
	const { cols, rows, mines } = PRESETS[preset];
	const total = cols * rows;
	return {
		phase: 'idle',
		preset,
		cols,
		rows,
		mineCount: mines,
		mines: new Array<number>(total).fill(0),
		open: new Array<number>(total).fill(0),
		flags: new Array<number>(total).fill(0),
		placed: false,
		exploded: null,
		cursor: { x: Math.floor(cols / 2), y: Math.floor(rows / 2) },
		score: 0,
	};
}

function fresh(rng: Rng, preset: MinesweeperPreset, running: boolean): MinesweeperState {
	const s = init(rng, preset);
	return running ? { ...s, phase: 'running' } : s;
}

function inBoard(state: MinesweeperState, x: number, y: number): boolean {
	return Number.isInteger(x) && Number.isInteger(y) && x >= 0 && x < state.cols && y >= 0 && y < state.rows;
}

/** 座標付きなら盤内チェックの上そのセル、無ければカーソル。盤外は null */
function targetOf(state: MinesweeperState, action: { x?: number; y?: number }): { index: number; cursor: MinesweeperState['cursor'] } | null {
	if (action.x === undefined && action.y === undefined) {
		return { index: state.cursor.y * state.cols + state.cursor.x, cursor: state.cursor };
	}
	// 片方だけの座標は無効（カーソルには落とさない）
	if (action.x === undefined || action.y === undefined) return null;
	if (!inBoard(state, action.x, action.y)) return null;
	return { index: action.y * state.cols + action.x, cursor: { x: action.x, y: action.y } };
}

function countOpenSafe(open: readonly number[], mines: readonly number[]): number {
	let n = 0;
	for (let i = 0; i < open.length; i += 1) if (open[i] && !mines[i]) n += 1;
	return n;
}

/** 開封（AC-050〜054）。開いたセル・旗のセルは同じオブジェクト */
function reveal(state: MinesweeperState, index: number, cursor: MinesweeperState['cursor'], rng: Rng): MinesweeperState {
	if (state.open[index] || state.flags[index]) return state;
	const mines = state.placed ? state.mines : placeMines(state.cols, state.rows, state.mineCount, index, rng);
	if (mines[index]) {
		// 敗北: 旗の無い地雷を全部開く。正しい旗はそのまま残す（レンダラは地雷でない旗を wrong と表示する）
		const open = state.open.slice();
		for (let i = 0; i < open.length; i += 1) if (mines[i] && !state.flags[i]) open[i] = 1;
		return { ...state, mines, placed: true, open, exploded: index, phase: 'over', cursor };
	}
	// 連鎖開封（反復）。隣接地雷 0 のセルは近傍も開く。旗のセルは開かない
	const open = state.open.slice();
	const stack = [index];
	while (stack.length > 0) {
		const i = stack.pop();
		if (i === undefined || open[i]) continue;
		open[i] = 1;
		if (adjacentCount(mines, i, state.cols, state.rows) === 0) {
			for (const n of neighbors(i, state.cols, state.rows)) if (!open[n] && !state.flags[n]) stack.push(n);
		}
	}
	const score = countOpenSafe(open, mines);
	const won = score === state.cols * state.rows - state.mineCount;
	return { ...state, mines, placed: true, open, score, cursor, phase: won ? 'won' : 'running' };
}

/** 旗のトグル（AC-052）。開いたセルは同じオブジェクト */
function toggleFlag(state: MinesweeperState, index: number, cursor: MinesweeperState['cursor']): MinesweeperState {
	if (state.open[index]) return state;
	const flags = state.flags.slice();
	flags[index] = flags[index] ? 0 : 1;
	return { ...state, flags, cursor };
}

const DELTA: Readonly<Record<Direction, readonly [number, number]>> = {
	up: [0, -1],
	down: [0, 1],
	left: [-1, 0],
	right: [1, 0],
};

/** カーソル移動（AC-057）。端では同じオブジェクト */
function moveCursor(state: MinesweeperState, dir: Direction): MinesweeperState {
	const [dx, dy] = DELTA[dir];
	const x = Math.min(state.cols - 1, Math.max(0, state.cursor.x + dx));
	const y = Math.min(state.rows - 1, Math.max(0, state.cursor.y + dy));
	if (x === state.cursor.x && y === state.cursor.y) return state;
	return { ...state, cursor: { x, y } };
}

/** 入力を状態に適用する。手番駆動なので一時停止系は無視（AC-061） */
export function input(state: MinesweeperState, action: HostAction, rng: Rng): MinesweeperState {
	const running = state.phase === 'running';
	switch (action.type) {
		case 'start':
			if (state.phase === 'idle') return { ...state, phase: 'running' };
			if (state.phase === 'over' || state.phase === 'won') return fresh(rng, state.preset, true);
			return state;
		case 'restart':
			if (state.phase === 'idle') return { ...state, phase: 'running' };
			return fresh(rng, state.preset, true);
		case 'quit':
			return state.phase === 'idle' ? state : init(rng, state.preset);
		case 'turn':
			return running ? moveCursor(state, action.dir) : state;
		case 'cell': {
			if (!running) return state;
			const target = targetOf(state, action);
			if (!target) return state;
			return action.alt ? toggleFlag(state, target.index, target.cursor) : reveal(state, target.index, target.cursor, rng);
		}
		case 'pause':
		case 'resume':
		case 'toggle-pause':
		case 'continue':
		case 'rotate':
		case 'drop':
			return state;
	}
}
