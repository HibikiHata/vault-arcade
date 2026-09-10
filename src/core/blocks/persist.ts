import type { Phase } from '../host/types';
import { COLS, LOCK_DELAY_TICKS, ROWS, gravityTicks, levelFor } from './constants';
import { orientationCount } from './pieces';
import { fits } from './rules';
import { PIECE_IDS, isPieceId, type BlocksState, type PieceId } from './types';

// deferred view で退避した状態の保存と復元（Snake と同じ規約: running は paused として保存する）。
// 少しでも壊れていれば null を返し、呼び出し側はメニューに戻す

export type SavedBlocks = Omit<BlocksState, 'phase'> & { readonly phase: Exclude<Phase, 'running'> };

/** won は Blocks に無いので受け付けない */
const PHASES: readonly Phase[] = ['idle', 'running', 'paused', 'over'];

export function toSaved(state: BlocksState): SavedBlocks {
	const phase = state.phase === 'running' ? 'paused' : state.phase;
	return { ...state, phase };
}

function isInt(v: unknown): v is number {
	return typeof v === 'number' && Number.isInteger(v);
}

function isWell(v: unknown): v is number[] {
	return Array.isArray(v) && v.length === COLS * ROWS && v.every((c) => c === 0 || c === 1);
}

/** 先回りで補充するので bag は 1〜7 個 */
function isBag(v: unknown): v is PieceId[] {
	return (
		Array.isArray(v) &&
		v.length >= 1 &&
		v.length <= PIECE_IDS.length &&
		v.every(isPieceId) &&
		new Set(v).size === v.length
	);
}

export function parseSaved(raw: unknown): BlocksState | null {
	if (typeof raw !== 'object' || raw === null) return null;
	const r = raw as Record<string, unknown>;
	if (typeof r.phase !== 'string' || !PHASES.includes(r.phase as Phase)) return null;
	const savedPhase = r.phase as Phase;
	if (!isWell(r.well)) return null;
	if (!isPieceId(r.piece)) return null;
	if (!isInt(r.rotation) || r.rotation < 0 || r.rotation >= orientationCount(r.piece)) return null;
	if (!isInt(r.x) || !isInt(r.y)) return null;
	// over ではスポーンで重なったピースをそのまま凍結表示する。それ以外は必ず置ける位置にある
	if (savedPhase !== 'over' && !fits(r.well, r.piece, r.rotation, r.x, r.y)) return null;
	if (!isBag(r.bag)) return null;
	if (!isInt(r.score) || r.score < 0 || !isInt(r.lines) || r.lines < 0) return null;
	if (!isInt(r.level) || r.level !== levelFor(r.lines)) return null;
	// カウンタはルールが到達しうる範囲だけ（gravity はその level の落下 tick 数未満、lock はロック遅延未満）
	if (!isInt(r.gravity) || r.gravity < 0 || r.gravity >= gravityTicks(r.level)) return null;
	if (!isInt(r.lock) || r.lock < 0 || r.lock >= LOCK_DELAY_TICKS) return null;
	const phase: Phase = savedPhase === 'running' ? 'paused' : savedPhase;
	return {
		phase,
		well: r.well.slice(),
		piece: r.piece,
		rotation: r.rotation,
		x: r.x,
		y: r.y,
		bag: [...r.bag],
		score: r.score,
		lines: r.lines,
		level: r.level,
		gravity: r.gravity,
		lock: r.lock,
		lastClear: null,
	};
}
