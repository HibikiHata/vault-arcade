import type { Direction, HostAction, InputMapper } from './types';

// キー・タッチの生の値を HostAction に変換する純関数。DOM イベントは受け取らない

const CODE_DIRS: Readonly<Record<string, Direction>> = {
	KeyW: 'up',
	KeyA: 'left',
	KeyS: 'down',
	KeyD: 'right',
};

const KEY_DIRS: Readonly<Record<string, Direction>> = {
	ArrowUp: 'up',
	ArrowDown: 'down',
	ArrowLeft: 'left',
	ArrowRight: 'right',
};

/** key（文字）と code（物理キー）から操作を決める。WASD は配列に依存しないよう code で判定する */
export function keyToAction(key: string, code: string): HostAction | null {
	const byCode = CODE_DIRS[code];
	if (byCode) return { type: 'turn', dir: byCode };
	const byKey = KEY_DIRS[key];
	if (byKey) return { type: 'turn', dir: byKey };
	if (key === ' ' || code === 'Space') return { type: 'toggle-pause' };
	// P は全ゲーム共通の一時停止（Blocks では Space がハードドロップになるため）
	if (code === 'KeyP') return { type: 'toggle-pause' };
	if (key === 'Enter') return { type: 'start' };
	if (key === 'Escape') return { type: 'quit' };
	return null;
}

/**
 * 既定の生入力マッピング（mapInput を持たないゲームが使う）。
 * - 修飾キー付きは null: Obsidian のホットキー（Cmd+P 等）を横取りしない
 * - 自動リピートは方向入力だけ通す: Space 長押しで一時停止が連続トグルしない
 * - スワイプは方向、タップは一時停止の切替
 */
export const defaultMapInput: InputMapper = (raw) => {
	switch (raw.kind) {
		case 'key': {
			if (raw.modifier) return null;
			const action = keyToAction(raw.key, raw.code);
			if (!action) return null;
			return raw.repeat && action.type !== 'turn' ? null : action;
		}
		case 'swipe':
			return { type: 'turn', dir: raw.dir };
		case 'tap':
			return { type: 'toggle-pause' };
		case 'drag':
			// Snake / 2048 はスワイプで操作する。ドラッグを使うゲームは mapInput で受ける
			return null;
	}
};

/** 支配軸でスワイプ方向を決める。最大移動量が minPx 未満なら null。同値は水平を優先 */
export function swipeToDirection(dx: number, dy: number, minPx: number): Direction | null {
	const ax = Math.abs(dx);
	const ay = Math.abs(dy);
	if (Math.max(ax, ay) < minPx) return null;
	if (ax >= ay) return dx > 0 ? 'right' : 'left';
	return dy > 0 ? 'down' : 'up';
}

/** 両軸の移動量が maxPx 未満ならタップ */
export function isTap(dx: number, dy: number, maxPx: number): boolean {
	return Math.abs(dx) < maxPx && Math.abs(dy) < maxPx;
}
