import type { Direction, InputMapper } from '../host/types';

// Blocks の生入力マッピング。Space はハードドロップ、↑/W とタップは回転、下スワイプはハードドロップ。
// ソフトドロップはキーボードだけ（下スワイプを距離で soft/hard に分けると不可逆な誤爆が致命的）。
// 自動リピートは移動（左右下）だけ通し、回転・ドロップ・一時停止・開始は 1 回だけ。修飾キー付きは Obsidian に通す

const MOVE_CODES: Readonly<Record<string, Direction>> = { KeyA: 'left', KeyD: 'right', KeyS: 'down' };
const MOVE_KEYS: Readonly<Record<string, Direction>> = { ArrowLeft: 'left', ArrowRight: 'right', ArrowDown: 'down' };

export const blocksMapInput: InputMapper = (raw) => {
	switch (raw.kind) {
		case 'tap':
			return { type: 'rotate' };
		case 'drag':
			// 指を離さない横移動: 1 段階 = 1 列（AC-049）
			return { type: 'turn', dir: raw.dir };
		case 'swipe':
			if (raw.dir === 'down') return { type: 'drop' };
			if (raw.dir === 'up') return { type: 'rotate' };
			return { type: 'turn', dir: raw.dir };
		case 'key': {
			if (raw.modifier) return null;
			const move = MOVE_CODES[raw.code] ?? MOVE_KEYS[raw.key];
			if (move) return { type: 'turn', dir: move };
			if (raw.repeat) return null;
			if (raw.code === 'KeyW' || raw.key === 'ArrowUp') return { type: 'rotate' };
			if (raw.key === ' ' || raw.code === 'Space') return { type: 'drop' };
			if (raw.code === 'KeyP') return { type: 'toggle-pause' };
			if (raw.key === 'Enter') return { type: 'start' };
			if (raw.key === 'Escape') return { type: 'quit' };
			return null;
		}
	}
};
