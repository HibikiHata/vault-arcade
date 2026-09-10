// Blocks のルール定数。時間は tick 数で表し、ms は host 側（BLOCKS_TICK_MS）が持つ

export const COLS = 10;
export const ROWS = 20;

/** level ごとの 1 マス落下に要する tick 数（index = level - 1）。末尾でクランプし、0 にはならない */
export const GRAVITY_TICKS: readonly number[] = [16, 14, 12, 10, 8, 6, 5, 4, 3, 2, 1];

/** 床や積みに接してからロックまでの tick 数（normal の 50 ms なら 500 ms）。下へ動けたときだけ 0 に戻る */
export const LOCK_DELAY_TICKS = 10;

/** 同時に消えた行数ごとの基礎点。level を掛ける。ドロップ加点は無い */
export const LINE_SCORES: readonly number[] = [0, 100, 300, 500, 800];

export const LINES_PER_LEVEL = 10;

/** スポーン位置（回転箱の原点）。全形で共通。見えるセルは列 3〜6、行 0〜1 に収まる */
export const SPAWN_X = 3;
export const SPAWN_Y = 0;

/** level に応じた落下 tick 数。表の外は末尾（最速）で止める */
export function gravityTicks(level: number): number {
	const index = Math.min(Math.max(level, 1), GRAVITY_TICKS.length) - 1;
	return GRAVITY_TICKS[index] ?? 1;
}

/** 消去ライン数から level を求める（10 ラインごとに 1 上がる） */
export function levelFor(lines: number): number {
	return 1 + Math.floor(lines / LINES_PER_LEVEL);
}
