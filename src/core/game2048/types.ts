import type { GameState } from '../host/types';

/** 1タイルの移動記録（盤面 index）。from === to なら動いていない */
export interface TileMove {
	readonly from: number;
	readonly to: number;
	readonly merged: boolean;
}

/** 直前の手の記録。描画層がスライドと出現のアニメーションに使う。1手分だけ保持し、永続化しない */
export interface LastMove {
	readonly moves: readonly TileMove[];
	readonly spawned: number | null;
}

/** 2048 の状態。grid は 4×4 を行優先で並べた 16 要素（0 = 空） */
export interface Board2048State extends GameState {
	readonly grid: readonly number[];
	/** 2048 到達後に Keep playing を選んだ（won を再発火させない） */
	readonly keepPlaying: boolean;
	readonly lastMove: LastMove | null;
}

export const SIZE = 4;
export const CELLS = SIZE * SIZE;
export const TARGET = 2048;
/** 新しいタイルが 2 になる確率。残りは 4 */
export const SPAWN_TWO_PROBABILITY = 0.9;
