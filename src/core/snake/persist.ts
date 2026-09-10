import type { Direction, Phase, Point } from '../host/types';
import type { SnakeState } from './types';

// Obsidian は背景のタブのビューを破棄し、表示時に作り直す（deferred view）。
// 進行中のゲームを View の state（JSON）として退避・復元するための純関数。
// running は保存時に paused へ落とす（復元で勝手に動き出さない）

export type SavedSnake = Omit<SnakeState, 'phase'> & { readonly phase: Exclude<Phase, 'running'> };

const PHASES: readonly Phase[] = ['idle', 'running', 'paused', 'over', 'won'];
const DIRS: readonly Direction[] = ['up', 'down', 'left', 'right'];

export function toSavedState(state: SnakeState): SavedSnake {
	const phase = state.phase === 'running' ? 'paused' : state.phase;
	return { ...state, phase };
}

function isInt(v: unknown): v is number {
	return typeof v === 'number' && Number.isInteger(v);
}

function isPoint(v: unknown, cols: number, rows: number): v is Point {
	if (typeof v !== 'object' || v === null) return false;
	const { x, y } = v as { x?: unknown; y?: unknown };
	return isInt(x) && isInt(y) && x >= 0 && y >= 0 && x < cols && y < rows;
}

/** 保存データを検証して状態に戻す。少しでも壊れていれば null（呼び出し側は新規ゲームにする） */
export function parseSavedState(raw: unknown): SnakeState | null {
	if (typeof raw !== 'object' || raw === null) return null;
	const r = raw as Record<string, unknown>;
	if (!isInt(r.cols) || !isInt(r.rows) || r.cols < 4 || r.rows < 4) return null;
	const cols = r.cols;
	const rows = r.rows;
	if (typeof r.phase !== 'string' || !PHASES.includes(r.phase as Phase)) return null;
	if (typeof r.dir !== 'string' || !DIRS.includes(r.dir as Direction)) return null;
	if (!Array.isArray(r.body) || r.body.length === 0) return null;
	const seen = new Set<string>();
	for (const cell of r.body) {
		if (!isPoint(cell, cols, rows)) return null;
		const k = `${cell.x},${cell.y}`;
		if (seen.has(k)) return null;
		seen.add(k);
	}
	const body = r.body as Point[];
	if (!Array.isArray(r.queue) || r.queue.length > 2) return null;
	for (const d of r.queue) if (typeof d !== 'string' || !DIRS.includes(d as Direction)) return null;
	let food: Point | null = null;
	if (r.food !== null) {
		if (!isPoint(r.food, cols, rows) || seen.has(`${r.food.x},${r.food.y}`)) return null;
		food = r.food;
	}
	if (!isInt(r.score) || r.score < 0) return null;
	const phase = (r.phase === 'running' ? 'paused' : r.phase) as Phase;
	return {
		phase,
		cols,
		rows,
		body: body.map((p) => ({ x: p.x, y: p.y })),
		dir: r.dir as Direction,
		queue: r.queue as Direction[],
		food,
		score: r.score,
	};
}
