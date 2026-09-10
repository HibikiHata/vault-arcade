import { describe, expect, it } from 'vitest';
import type { RawInput } from '../host/types';
import { minesweeperMapInput } from './input';

const key = (key: string, code: string, over: Partial<Extract<RawInput, { kind: 'key' }>> = {}): RawInput => ({
	kind: 'key',
	key,
	code,
	repeat: false,
	modifier: false,
	...over,
});

describe('minesweeperMapInput: キー（AC-057）', () => {
	it('矢印 / WASD はカーソル移動、Space は開封、F は旗', () => {
		expect(minesweeperMapInput(key('ArrowLeft', 'ArrowLeft'))).toEqual({ type: 'turn', dir: 'left' });
		expect(minesweeperMapInput(key('ArrowUp', 'ArrowUp'))).toEqual({ type: 'turn', dir: 'up' });
		expect(minesweeperMapInput(key('d', 'KeyD'))).toEqual({ type: 'turn', dir: 'right' });
		expect(minesweeperMapInput(key('s', 'KeyS'))).toEqual({ type: 'turn', dir: 'down' });
		expect(minesweeperMapInput(key(' ', 'Space'))).toEqual({ type: 'cell', alt: false });
		expect(minesweeperMapInput(key('f', 'KeyF'))).toEqual({ type: 'cell', alt: true });
	});

	it('Enter は開始、Escape は終了、P は一時停止（ルールが無視する）、未知は null', () => {
		expect(minesweeperMapInput(key('Enter', 'Enter'))).toEqual({ type: 'start' });
		expect(minesweeperMapInput(key('Escape', 'Escape'))).toEqual({ type: 'quit' });
		expect(minesweeperMapInput(key('p', 'KeyP'))).toEqual({ type: 'toggle-pause' });
		expect(minesweeperMapInput(key('x', 'KeyX'))).toBeNull();
	});

	it('自動リピートはカーソル移動だけ通す。修飾キー付きは null', () => {
		expect(minesweeperMapInput(key('ArrowRight', 'ArrowRight', { repeat: true }))).toEqual({ type: 'turn', dir: 'right' });
		expect(minesweeperMapInput(key(' ', 'Space', { repeat: true }))).toBeNull();
		expect(minesweeperMapInput(key('f', 'KeyF', { repeat: true }))).toBeNull();
		expect(minesweeperMapInput(key(' ', 'Space', { modifier: true }))).toBeNull();
		expect(minesweeperMapInput(key('f', 'KeyF', { modifier: true }))).toBeNull();
	});
});

describe('minesweeperMapInput: タッチは adapter 経由では扱わない（セルの helper が受ける）', () => {
	it('tap / swipe / drag は null', () => {
		expect(minesweeperMapInput({ kind: 'tap' })).toBeNull();
		expect(minesweeperMapInput({ kind: 'swipe', dir: 'down' })).toBeNull();
		expect(minesweeperMapInput({ kind: 'drag', dir: 'left' })).toBeNull();
	});
});
