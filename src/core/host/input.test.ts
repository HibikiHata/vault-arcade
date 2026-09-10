import { describe, expect, it } from 'vitest';
import { defaultMapInput, isTap, keyToAction, swipeToDirection } from './input';
import type { RawInput } from './types';

describe('keyToAction', () => {
	it('矢印キーは key で判定する', () => {
		expect(keyToAction('ArrowUp', 'ArrowUp')).toEqual({ type: 'turn', dir: 'up' });
		expect(keyToAction('ArrowDown', 'ArrowDown')).toEqual({ type: 'turn', dir: 'down' });
		expect(keyToAction('ArrowLeft', 'ArrowLeft')).toEqual({ type: 'turn', dir: 'left' });
		expect(keyToAction('ArrowRight', 'ArrowRight')).toEqual({ type: 'turn', dir: 'right' });
	});

	it('WASD は code で判定し、配列や大文字小文字に依存しない', () => {
		expect(keyToAction('w', 'KeyW')).toEqual({ type: 'turn', dir: 'up' });
		expect(keyToAction('W', 'KeyW')).toEqual({ type: 'turn', dir: 'up' });
		expect(keyToAction('a', 'KeyA')).toEqual({ type: 'turn', dir: 'left' });
		expect(keyToAction('s', 'KeyS')).toEqual({ type: 'turn', dir: 'down' });
		expect(keyToAction('d', 'KeyD')).toEqual({ type: 'turn', dir: 'right' });
		expect(keyToAction('z', 'KeyW')).toEqual({ type: 'turn', dir: 'up' });
	});

	it('Space は一時停止の切替、Enter は開始、Escape は終了', () => {
		expect(keyToAction(' ', 'Space')).toEqual({ type: 'toggle-pause' });
		expect(keyToAction('Enter', 'Enter')).toEqual({ type: 'start' });
		expect(keyToAction('Escape', 'Escape')).toEqual({ type: 'quit' });
	});

	it('未知のキーと空文字は null', () => {
		expect(keyToAction('x', 'KeyX')).toBeNull();
		expect(keyToAction('', '')).toBeNull();
	});

	it('P は一時停止の切替（全ゲーム共通、AC-043）', () => {
		expect(keyToAction('p', 'KeyP')).toEqual({ type: 'toggle-pause' });
		expect(keyToAction('P', 'KeyP')).toEqual({ type: 'toggle-pause' });
	});
});

describe('defaultMapInput（既定の生入力マッピング）', () => {
	const key = (key: string, code: string, over: Partial<Extract<RawInput, { kind: 'key' }>> = {}): RawInput => ({
		kind: 'key',
		key,
		code,
		repeat: false,
		modifier: false,
		...over,
	});

	it('修飾キー付きは null（Obsidian のホットキーを横取りしない、AC-043）', () => {
		expect(defaultMapInput(key('ArrowUp', 'ArrowUp', { modifier: true }))).toBeNull();
		expect(defaultMapInput(key(' ', 'Space', { modifier: true }))).toBeNull();
		expect(defaultMapInput(key('p', 'KeyP', { modifier: true }))).toBeNull();
	});

	it('自動リピートは方向入力だけ通し、Space / Enter / Escape / P は捨てる（AC-043）', () => {
		expect(defaultMapInput(key('ArrowLeft', 'ArrowLeft', { repeat: true }))).toEqual({ type: 'turn', dir: 'left' });
		expect(defaultMapInput(key('s', 'KeyS', { repeat: true }))).toEqual({ type: 'turn', dir: 'down' });
		expect(defaultMapInput(key(' ', 'Space', { repeat: true }))).toBeNull();
		expect(defaultMapInput(key('Enter', 'Enter', { repeat: true }))).toBeNull();
		expect(defaultMapInput(key('Escape', 'Escape', { repeat: true }))).toBeNull();
		expect(defaultMapInput(key('p', 'KeyP', { repeat: true }))).toBeNull();
	});

	it('リピートでも修飾キーでもなければ keyToAction と同じ', () => {
		expect(defaultMapInput(key(' ', 'Space'))).toEqual({ type: 'toggle-pause' });
		expect(defaultMapInput(key('Enter', 'Enter'))).toEqual({ type: 'start' });
		expect(defaultMapInput(key('x', 'KeyX'))).toBeNull();
	});

	it('スワイプは方向入力、タップは一時停止の切替', () => {
		expect(defaultMapInput({ kind: 'swipe', dir: 'up' })).toEqual({ type: 'turn', dir: 'up' });
		expect(defaultMapInput({ kind: 'swipe', dir: 'right' })).toEqual({ type: 'turn', dir: 'right' });
		expect(defaultMapInput({ kind: 'tap' })).toEqual({ type: 'toggle-pause' });
	});

	it('ドラッグ（指を離さない横移動）は既定では無視する（Snake / 2048 はスワイプで操作する）', () => {
		expect(defaultMapInput({ kind: 'drag', dir: 'left' })).toBeNull();
		expect(defaultMapInput({ kind: 'drag', dir: 'right' })).toBeNull();
	});
});

describe('swipeToDirection', () => {
	it('支配軸の方向を返す', () => {
		expect(swipeToDirection(30, 5, 24)).toBe('right');
		expect(swipeToDirection(-30, -5, 24)).toBe('left');
		expect(swipeToDirection(5, 30, 24)).toBe('down');
		expect(swipeToDirection(5, -30, 24)).toBe('up');
	});

	it('閾値未満は null、閾値ちょうどは有効（AC-011）', () => {
		expect(swipeToDirection(10, 10, 24)).toBeNull();
		expect(swipeToDirection(20, 20, 24)).toBeNull();
		expect(swipeToDirection(24, 0, 24)).toBe('right');
	});

	it('同値のときは水平を優先する', () => {
		expect(swipeToDirection(30, 30, 24)).toBe('right');
	});
});

describe('isTap', () => {
	it('移動量が上限未満ならタップ', () => {
		expect(isTap(3, 4, 10)).toBe(true);
		expect(isTap(0, 0, 10)).toBe(true);
		expect(isTap(10, 0, 10)).toBe(false);
	});
});
