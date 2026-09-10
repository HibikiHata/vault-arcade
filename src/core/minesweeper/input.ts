import type { Direction, InputMapper } from '../host/types';

// Minesweeper のキーマッピング（AC-057）。矢印 / WASD でカーソル、Space で開封、F で旗。
// タッチはセル上の helper（ui/cell-input）が受けるので、adapter 経由の tap / swipe / drag は無視する

const MOVE_CODES: Readonly<Record<string, Direction>> = { KeyA: 'left', KeyD: 'right', KeyW: 'up', KeyS: 'down' };
const MOVE_KEYS: Readonly<Record<string, Direction>> = {
	ArrowLeft: 'left',
	ArrowRight: 'right',
	ArrowUp: 'up',
	ArrowDown: 'down',
};

export const minesweeperMapInput: InputMapper = (raw) => {
	if (raw.kind !== 'key') return null;
	if (raw.modifier) return null;
	const move = MOVE_CODES[raw.code] ?? MOVE_KEYS[raw.key];
	if (move) return { type: 'turn', dir: move };
	if (raw.repeat) return null;
	if (raw.key === ' ' || raw.code === 'Space') return { type: 'cell', alt: false };
	if (raw.code === 'KeyF') return { type: 'cell', alt: true };
	if (raw.code === 'KeyP') return { type: 'toggle-pause' };
	if (raw.key === 'Enter') return { type: 'start' };
	if (raw.key === 'Escape') return { type: 'quit' };
	return null;
};
