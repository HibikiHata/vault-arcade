import { describe, expect, it } from 'vitest';
import type { RawInput } from '../host/types';
import { blocksMapInput } from './input';

const key = (key: string, code: string, over: Partial<Extract<RawInput, { kind: 'key' }>> = {}): RawInput => ({
	kind: 'key',
	key,
	code,
	repeat: false,
	modifier: false,
	...over,
});

describe('blocksMapInput: キー（AC-043）', () => {
	it('Space はハードドロップ、↑/W は回転、↓/S はソフトドロップ、←→/A D は移動', () => {
		expect(blocksMapInput(key(' ', 'Space'))).toEqual({ type: 'drop' });
		expect(blocksMapInput(key('ArrowUp', 'ArrowUp'))).toEqual({ type: 'rotate' });
		expect(blocksMapInput(key('w', 'KeyW'))).toEqual({ type: 'rotate' });
		expect(blocksMapInput(key('ArrowDown', 'ArrowDown'))).toEqual({ type: 'turn', dir: 'down' });
		expect(blocksMapInput(key('s', 'KeyS'))).toEqual({ type: 'turn', dir: 'down' });
		expect(blocksMapInput(key('ArrowLeft', 'ArrowLeft'))).toEqual({ type: 'turn', dir: 'left' });
		expect(blocksMapInput(key('a', 'KeyA'))).toEqual({ type: 'turn', dir: 'left' });
		expect(blocksMapInput(key('ArrowRight', 'ArrowRight'))).toEqual({ type: 'turn', dir: 'right' });
		expect(blocksMapInput(key('d', 'KeyD'))).toEqual({ type: 'turn', dir: 'right' });
	});

	it('P は一時停止、Enter は開始、Escape は終了、未知のキーは null', () => {
		expect(blocksMapInput(key('p', 'KeyP'))).toEqual({ type: 'toggle-pause' });
		expect(blocksMapInput(key('Enter', 'Enter'))).toEqual({ type: 'start' });
		expect(blocksMapInput(key('Escape', 'Escape'))).toEqual({ type: 'quit' });
		expect(blocksMapInput(key('x', 'KeyX'))).toBeNull();
	});

	it('自動リピートは移動（左右下）だけ通し、回転・ドロップ・一時停止・開始は 1 回だけ', () => {
		expect(blocksMapInput(key('ArrowLeft', 'ArrowLeft', { repeat: true }))).toEqual({ type: 'turn', dir: 'left' });
		expect(blocksMapInput(key('ArrowRight', 'ArrowRight', { repeat: true }))).toEqual({ type: 'turn', dir: 'right' });
		expect(blocksMapInput(key('ArrowDown', 'ArrowDown', { repeat: true }))).toEqual({ type: 'turn', dir: 'down' });
		expect(blocksMapInput(key('ArrowUp', 'ArrowUp', { repeat: true }))).toBeNull();
		expect(blocksMapInput(key(' ', 'Space', { repeat: true }))).toBeNull();
		expect(blocksMapInput(key('p', 'KeyP', { repeat: true }))).toBeNull();
		expect(blocksMapInput(key('Enter', 'Enter', { repeat: true }))).toBeNull();
	});

	it('修飾キー付きは null', () => {
		expect(blocksMapInput(key(' ', 'Space', { modifier: true }))).toBeNull();
		expect(blocksMapInput(key('ArrowUp', 'ArrowUp', { modifier: true }))).toBeNull();
		expect(blocksMapInput(key('p', 'KeyP', { modifier: true }))).toBeNull();
	});
});

describe('blocksMapInput: タッチ（AC-044）', () => {
	it('タップは回転、左右スワイプは移動、下スワイプはハードドロップ、上スワイプは回転', () => {
		expect(blocksMapInput({ kind: 'tap' })).toEqual({ type: 'rotate' });
		expect(blocksMapInput({ kind: 'swipe', dir: 'left' })).toEqual({ type: 'turn', dir: 'left' });
		expect(blocksMapInput({ kind: 'swipe', dir: 'right' })).toEqual({ type: 'turn', dir: 'right' });
		expect(blocksMapInput({ kind: 'swipe', dir: 'down' })).toEqual({ type: 'drop' });
		expect(blocksMapInput({ kind: 'swipe', dir: 'up' })).toEqual({ type: 'rotate' });
	});

	it('ドラッグは 1 段階ごとに 1 列の移動（AC-049）', () => {
		expect(blocksMapInput({ kind: 'drag', dir: 'left' })).toEqual({ type: 'turn', dir: 'left' });
		expect(blocksMapInput({ kind: 'drag', dir: 'right' })).toEqual({ type: 'turn', dir: 'right' });
	});
});
