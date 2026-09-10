import type { GameState, Phase } from '../host/types';

export type PieceId = 'I' | 'O' | 'T' | 'S' | 'Z' | 'J' | 'L';

/** bag の補充順の基準（Fisher–Yates はこの順から始める） */
export const PIECE_IDS: readonly PieceId[] = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];

export function isPieceId(v: unknown): v is PieceId {
	return typeof v === 'string' && (PIECE_IDS as readonly string[]).includes(v);
}

/** [col, row]。row 0 が上 */
export type Cell = readonly [number, number];

/** 直前のロックで消えた行（消去前の井戸での行番号、昇順）と固定したピースのセル。消去演出のための一時情報で永続化しない */
export interface LastClear {
	readonly rows: readonly number[];
	readonly cells: readonly Cell[];
}

/**
 * Blocks の状態。井戸は COLS×ROWS の行優先配列（0 = 空、1 = 固定）。
 * 落下中のピースは (piece, rotation, x, y) で表し、x/y は回転箱の原点（壁蹴りで x が負になりうる）。
 * gravity / lock は tick 数のカウンタ（core は時間を知らない）
 */
export interface BlocksState extends GameState {
	readonly phase: Phase;
	readonly well: readonly number[];
	readonly piece: PieceId;
	readonly rotation: number;
	readonly x: number;
	readonly y: number;
	/** 現在の bag の残り。bag[0] が次のピース。描画しない（プレビュー無し） */
	readonly bag: readonly PieceId[];
	readonly score: number;
	readonly lines: number;
	readonly level: number;
	/** 最後に下へ動いてからの tick 数 */
	readonly gravity: number;
	/** 床や積みに接している tick 数 */
	readonly lock: number;
	/** 行が消えたロックの直後だけ値を持つ。それ以外のロックで null に戻る */
	readonly lastClear: LastClear | null;
}
