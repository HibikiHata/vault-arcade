import type { Phase } from '../host/types';
import { CELLS, type Board2048State } from './types';

// deferred view の退避・復元。手番駆動なので running のまま保存する

const PHASES: readonly Phase[] = ['idle', 'running', 'paused', 'over', 'won'];

/** 保存形は状態そのもの（JSON 化できる純データ）。型を保つことでテストでの展開も可能 */
export function toSaved(state: Board2048State): Board2048State {
	return state;
}

function isTile(v: unknown): v is number {
	return typeof v === 'number' && Number.isInteger(v) && (v === 0 || (v >= 2 && (v & (v - 1)) === 0));
}

/** 保存データを検証して状態に戻す。少しでも壊れていれば null（呼び出し側はメニューに戻す） */
export function parseSaved(raw: unknown): Board2048State | null {
	if (typeof raw !== 'object' || raw === null) return null;
	const r = raw as Record<string, unknown>;
	if (typeof r.phase !== 'string' || !PHASES.includes(r.phase as Phase)) return null;
	if (!Array.isArray(r.grid) || r.grid.length !== CELLS || !r.grid.every(isTile)) return null;
	if (typeof r.score !== 'number' || !Number.isInteger(r.score) || r.score < 0) return null;
	if (typeof r.keepPlaying !== 'boolean') return null;
	// 手番駆動に paused は無い。壊れた保存データでも Resume が効かない画面に落とさない
	const phase: Phase = r.phase === 'paused' ? 'running' : (r.phase as Phase);
	return {
		phase,
		grid: r.grid.slice(),
		score: r.score,
		keepPlaying: r.keepPlaying,
		lastMove: null,
	};
}
