import type { GameState, Phase } from '../host/types';
import type { MinesweeperPreset } from '../settings';

/** プリセットの寸法と地雷数。表は rules.ts の PRESETS */
export interface Preset {
	readonly cols: number;
	readonly rows: number;
	readonly mines: number;
}

/**
 * Minesweeper の状態。盤面は cols×rows の行優先配列を 3 本（地雷 / 開封 / 旗、0 か 1）で持つ。
 * 地雷は初手の開封で置く（placed）。score は開いた安全セルの数（タイマーは持たない）。
 * カーソルはキーボード操作用で、座標付きの cell 操作でもそのセルへ動く
 */
export interface MinesweeperState extends GameState {
	readonly phase: Phase;
	readonly preset: MinesweeperPreset;
	readonly cols: number;
	readonly rows: number;
	readonly mineCount: number;
	readonly mines: readonly number[];
	readonly open: readonly number[];
	readonly flags: readonly number[];
	readonly placed: boolean;
	/** over のとき、開いてしまった地雷の index。それ以外は null */
	readonly exploded: number | null;
	readonly cursor: { readonly x: number; readonly y: number };
	readonly score: number;
}
