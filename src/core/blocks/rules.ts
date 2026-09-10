import type { HostAction, Rng } from '../host/types';
import { draw } from './bag';
import { COLS, LINE_SCORES, LOCK_DELAY_TICKS, ROWS, SPAWN_X, SPAWN_Y, gravityTicks, levelFor } from './constants';
import { boxSize, cellsOf, orientationCount } from './pieces';
import type { BlocksState, PieceId } from './types';

// Blocks のルール（純関数）。時間は tick 数、乱数は注入。
// 変化が無い操作は同じオブジェクトを返す（ビューはそれで再描画を省く）

/** ピースが井戸の中にあり、固定セルと重ならないか。井戸の上に隠し行は無い */
export function fits(well: readonly number[], piece: PieceId, rotation: number, x: number, y: number): boolean {
	for (const [c, r] of cellsOf(piece, rotation, x, y)) {
		if (c < 0 || c >= COLS || r < 0 || r >= ROWS) return false;
		if (well[r * COLS + c] !== 0) return false;
	}
	return true;
}

export function init(rng: Rng): BlocksState {
	const { piece, bag } = draw([], rng);
	return {
		phase: 'idle',
		well: new Array<number>(COLS * ROWS).fill(0),
		piece,
		rotation: 0,
		x: SPAWN_X,
		y: SPAWN_Y,
		bag,
		score: 0,
		lines: 0,
		level: 1,
		gravity: 0,
		lock: 0,
		lastClear: null,
	};
}

/** 満杯の行を取り除き、上の行を下へ詰める。隣接していなくてもまとめて消す。rows は消えた行番号（消去前、昇順） */
export function clearLines(well: readonly number[]): { well: number[]; cleared: number; rows: number[] } {
	const kept: number[][] = [];
	const rows: number[] = [];
	for (let r = 0; r < ROWS; r += 1) {
		const row = well.slice(r * COLS, (r + 1) * COLS);
		if (row.every((c) => c !== 0)) rows.push(r);
		else kept.push(row);
	}
	const out: number[] = new Array<number>(rows.length * COLS).fill(0);
	for (const row of kept) out.push(...row);
	return { well: out, cleared: rows.length, rows };
}

/** 次にスポーンするピース（bag の先頭。bag は空にならない）。次ピース表示用 */
export function nextPiece(state: BlocksState): PieceId {
	return state.bag[0] ?? state.piece;
}

/** 現在の x と回転のまま落ちきったときの y（ゴースト表示用）。床の上なら今の y */
export function landingY(state: BlocksState): number {
	let y = state.y;
	while (fits(state.well, state.piece, state.rotation, state.x, y + 1)) y += 1;
	return y;
}

function fresh(rng: Rng, running: boolean): BlocksState {
	const s = init(rng);
	return running ? { ...s, phase: 'running' } : s;
}

/** ピースを井戸に固定し、行を消し、得点と level を更新して次のピースを出す。スポーンできなければ over */
function lockPiece(state: BlocksState, rng: Rng): BlocksState {
	const filled = state.well.slice();
	const locked = cellsOf(state.piece, state.rotation, state.x, state.y);
	for (const [c, r] of locked) filled[r * COLS + c] = 1;
	const { well, cleared, rows } = clearLines(filled);
	const score = state.score + (LINE_SCORES[cleared] ?? 0) * state.level;
	const lines = state.lines + cleared;
	const next = draw(state.bag, rng);
	const spawned = fits(well, next.piece, 0, SPAWN_X, SPAWN_Y);
	return {
		...state,
		phase: spawned ? 'running' : 'over',
		well,
		piece: next.piece,
		bag: next.bag,
		rotation: 0,
		x: SPAWN_X,
		y: SPAWN_Y,
		score,
		lines,
		level: levelFor(lines),
		gravity: 0,
		lock: 0,
		lastClear: cleared > 0 ? { rows, cells: locked } : null,
	};
}

function canFall(state: BlocksState): boolean {
	return fits(state.well, state.piece, state.rotation, state.x, state.y + 1);
}

/** 1 マス下げてカウンタを戻す。下へ動けたときだけロック遅延がリセットされる */
function fall(state: BlocksState): BlocksState {
	return { ...state, y: state.y + 1, gravity: 0, lock: 0 };
}

/** 1 tick。落ちられるなら重力カウンタ、接地しているならロックカウンタを進める */
export function step(state: BlocksState, rng: Rng): BlocksState {
	if (state.phase !== 'running') return state;
	if (canFall(state)) {
		const gravity = state.gravity + 1;
		return gravity >= gravityTicks(state.level) ? fall(state) : { ...state, gravity };
	}
	const lock = state.lock + 1;
	return lock >= LOCK_DELAY_TICKS ? lockPiece(state, rng) : { ...state, lock };
}

function shift(state: BlocksState, dx: number): BlocksState {
	const x = state.x + dx;
	return fits(state.well, state.piece, state.rotation, x, state.y) ? { ...state, x } : state;
}

/** 時計回りに 1 状態。入らなければ水平に 0, -1, +1, -2, +2（I は ±3 まで）の順で蹴る。全滅なら同じ状態 */
function rotate(state: BlocksState): BlocksState {
	const count = orientationCount(state.piece);
	if (count <= 1) return state;
	const rotation = (state.rotation + 1) % count;
	const maxKick = boxSize(state.piece) - 1;
	for (let k = 0; k <= maxKick; k += 1) {
		for (const dx of k === 0 ? [0] : [-k, k]) {
			const x = state.x + dx;
			if (fits(state.well, state.piece, rotation, x, state.y)) return { ...state, rotation, x };
		}
	}
	return state;
}

/** 最下段まで落として即ロック */
function drop(state: BlocksState, rng: Rng): BlocksState {
	let y = state.y;
	while (fits(state.well, state.piece, state.rotation, state.x, y + 1)) y += 1;
	return lockPiece({ ...state, y }, rng);
}

/** 入力を状態に適用する。phase に合わない入力は無視して同じ状態を返す */
export function input(state: BlocksState, action: HostAction, rng: Rng): BlocksState {
	const running = state.phase === 'running';
	switch (action.type) {
		case 'start':
			if (state.phase === 'idle') return { ...state, phase: 'running' };
			// 結果画面からの Enter は新しいゲーム（2048 の AC-034 と同じ）
			if (state.phase === 'over') return fresh(rng, true);
			return state;
		case 'restart':
			if (state.phase === 'idle') return { ...state, phase: 'running' };
			return fresh(rng, true);
		case 'quit':
			return state.phase === 'idle' ? state : init(rng);
		case 'pause':
			return running ? { ...state, phase: 'paused' } : state;
		case 'resume':
			return state.phase === 'paused' ? { ...state, phase: 'running' } : state;
		case 'toggle-pause':
			if (running) return { ...state, phase: 'paused' };
			if (state.phase === 'paused') return { ...state, phase: 'running' };
			return state;
		case 'continue':
			// Blocks に won は無い
			return state;
		case 'turn': {
			if (!running) return state;
			switch (action.dir) {
				case 'left':
					return shift(state, -1);
				case 'right':
					return shift(state, 1);
				case 'down':
					// ソフトドロップ。床の上では何もしない（ロックもしない）
					return canFall(state) ? fall(state) : state;
				case 'up':
					// 回転は rotate。方向としての上は Blocks に意味が無い
					return state;
			}
			return state;
		}
		case 'rotate':
			return running ? rotate(state) : state;
		case 'drop':
			return running ? drop(state, rng) : state;
		case 'cell':
			// Minesweeper 用
			return state;
	}
}
