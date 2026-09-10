import type { Phase } from '../host/types';
import { isMinesweeperPreset } from '../settings';
import { PRESETS } from './rules';
import type { MinesweeperState } from './types';

// deferred view で退避した状態の保存と復元。手番駆動なので running のまま保存する（2048 と同じ）。
// 少しでも壊れていれば null を返し、呼び出し側はメニューに戻す

export type SavedMinesweeper = MinesweeperState;

const PHASES: readonly Phase[] = ['idle', 'running', 'paused', 'won', 'over'];

export function toSaved(state: MinesweeperState): SavedMinesweeper {
	return state;
}

function isInt(v: unknown): v is number {
	return typeof v === 'number' && Number.isInteger(v);
}

function isBits(v: unknown, length: number): v is number[] {
	return Array.isArray(v) && v.length === length && v.every((c) => c === 0 || c === 1);
}

export function parseSaved(raw: unknown): MinesweeperState | null {
	if (typeof raw !== 'object' || raw === null) return null;
	const r = raw as Record<string, unknown>;
	if (typeof r.phase !== 'string' || !PHASES.includes(r.phase as Phase)) return null;
	const savedPhase = r.phase as Phase;
	if (!isMinesweeperPreset(r.preset)) return null;
	const table = PRESETS[r.preset];
	if (r.cols !== table.cols || r.rows !== table.rows || r.mineCount !== table.mines) return null;
	const total = table.cols * table.rows;
	if (!isBits(r.mines, total) || !isBits(r.open, total) || !isBits(r.flags, total)) return null;
	if (typeof r.placed !== 'boolean') return null;
	const mineSum = r.mines.reduce((a, b) => a + b, 0);
	if (mineSum !== (r.placed ? table.mines : 0)) return null;
	const phase: Phase = savedPhase === 'paused' ? 'running' : savedPhase;
	let openSafe = 0;
	for (let i = 0; i < total; i += 1) {
		if (r.open[i] && r.flags[i]) return null;
		if (r.open[i] && r.mines[i] && phase !== 'over') return null;
		if (r.open[i] && !r.mines[i]) openSafe += 1;
	}
	if (!isInt(r.score) || r.score !== openSafe) return null;
	if (phase === 'won' && openSafe !== total - table.mines) return null;
	let exploded: number | null = null;
	if (phase === 'over') {
		if (!isInt(r.exploded) || r.exploded < 0 || r.exploded >= total) return null;
		if (!r.mines[r.exploded] || !r.open[r.exploded]) return null;
		exploded = r.exploded;
	} else if (r.exploded !== null) {
		return null;
	}
	const cursor = r.cursor as { x?: unknown; y?: unknown } | null;
	if (typeof cursor !== 'object' || cursor === null) return null;
	if (!isInt(cursor.x) || !isInt(cursor.y)) return null;
	if (cursor.x < 0 || cursor.x >= table.cols || cursor.y < 0 || cursor.y >= table.rows) return null;
	return {
		phase,
		preset: r.preset,
		cols: table.cols,
		rows: table.rows,
		mineCount: table.mines,
		mines: r.mines.slice(),
		open: r.open.slice(),
		flags: r.flags.slice(),
		placed: r.placed,
		exploded,
		cursor: { x: cursor.x, y: cursor.y },
		score: r.score,
	};
}
