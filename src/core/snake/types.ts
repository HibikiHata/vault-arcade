import type { Direction, HostAction, Phase, Point } from '../host/types';

/** Snake の状態。すべて読み取り専用で、遷移は新しいオブジェクトを返す */
export interface SnakeState {
	readonly phase: Phase;
	readonly cols: number;
	readonly rows: number;
	/** 先頭が頭 */
	readonly body: readonly Point[];
	readonly dir: Direction;
	/** 未適用の方向入力。最大2件 */
	readonly queue: readonly Direction[];
	/** won のときだけ null */
	readonly food: Point | null;
	readonly score: number;
}

/** Snake が受け取る操作。host 共通の語彙そのもの（continue は無視する） */
export type SnakeAction = HostAction;
