import { describe, expect, it } from 'vitest';
import {
	blocksHighScoreKey,
	DEFAULT_SETTINGS,
	HIGH_SCORE_KEYS,
	highScoreKey,
	isMinesweeperPreset,
	isSpeed,
	minesweeperHighScoreKey,
	PREF_KEYS,
	withPrefsFrom,
	mergeHighScore,
	mergeHighScores,
	mergeSettings,
	normalizeSettings,
	type PluginSettings,
} from './settings';

interface S {
	a: string;
	b: number;
}
const defaults: S = { a: 'x', b: 1 };

describe('mergeSettings', () => {
	it('保存データが null（初回起動）なら既定値と同じ内容の新しいオブジェクトを返す', () => {
		const result = mergeSettings(defaults, null);
		expect(result).toEqual({ a: 'x', b: 1 });
		expect(result).not.toBe(defaults);
	});

	it('保存データにあるキーは保存値で上書きする', () => {
		expect(mergeSettings(defaults, { a: 'saved' })).toEqual({ a: 'saved', b: 1 });
	});

	it('保存データに無いキーは既定値で埋める', () => {
		expect(mergeSettings(defaults, { b: 9 })).toEqual({ a: 'x', b: 9 });
	});

	it('保存データにしか無いキー（旧バージョンの設定）は落とさず残す', () => {
		const loaded = { a: 'y', legacy: true } as Partial<S>;
		expect(mergeSettings(defaults, loaded)).toEqual({ a: 'y', b: 1, legacy: true });
	});

	it('引数の既定値オブジェクトを変更しない', () => {
		mergeSettings(defaults, { a: 'z' });
		expect(defaults).toEqual({ a: 'x', b: 1 });
	});
});

describe('highScoreKey', () => {
	it('速度ごとに平坦なキー名を返す（Sync のキー単位マージに耐える）', () => {
		expect(highScoreKey('slow')).toBe('highScoreSnakeSlow');
		expect(highScoreKey('normal')).toBe('highScoreSnakeNormal');
		expect(highScoreKey('fast')).toBe('highScoreSnakeFast');
	});
});

describe('minesweeperHighScoreKey / isMinesweeperPreset / PREF_KEYS', () => {
	it('プリセットごとに平坦なキー名を返す（AC-060）', () => {
		expect(minesweeperHighScoreKey('small')).toBe('highScoreMinesweeperSmall');
		expect(minesweeperHighScoreKey('medium')).toBe('highScoreMinesweeperMedium');
		expect(minesweeperHighScoreKey('large')).toBe('highScoreMinesweeperLarge');
	});

	it('isMinesweeperPreset は 3 つの id だけを受け付ける（AC-056）', () => {
		expect(isMinesweeperPreset('small')).toBe(true);
		expect(isMinesweeperPreset('medium')).toBe(true);
		expect(isMinesweeperPreset('large')).toBe(true);
		expect(isMinesweeperPreset('huge')).toBe(false);
		expect(isMinesweeperPreset(9)).toBe(false);
		expect(isMinesweeperPreset(undefined)).toBe(false);
	});

	it('設定（好み）のキーは 1 か所で列挙する。外部変更ではこれらをディスクから採る', () => {
		expect([...PREF_KEYS]).toEqual(['speed', 'minesweeperPreset']);
	});

	it('withPrefsFrom は好みだけを写し、成績は写さない。引数は変更しない', () => {
		const disk: PluginSettings = { ...DEFAULT_SETTINGS, speed: 'slow', minesweeperPreset: 'large', highScore2048: 8 };
		const memory: PluginSettings = { ...DEFAULT_SETTINGS, speed: 'fast', minesweeperPreset: 'small', highScore2048: 4 };
		const out = withPrefsFrom(disk, memory);
		expect(out.speed).toBe('slow');
		expect(out.minesweeperPreset).toBe('large');
		expect(out.highScore2048).toBe(4);
		expect(memory.speed).toBe('fast');
		expect(out).not.toBe(memory);
	});
});

describe('blocksHighScoreKey', () => {
	it('Blocks も速度ごとに平坦なキー名を持つ', () => {
		expect(blocksHighScoreKey('slow')).toBe('highScoreBlocksSlow');
		expect(blocksHighScoreKey('normal')).toBe('highScoreBlocksNormal');
		expect(blocksHighScoreKey('fast')).toBe('highScoreBlocksFast');
	});
});

describe('normalizeSettings', () => {
	it('既定値は速度ごとのハイスコアが 0', () => {
		expect(DEFAULT_SETTINGS).toEqual({
			speed: 'normal',
			highScoreSnakeSlow: 0,
			highScoreSnakeNormal: 0,
			highScoreSnakeFast: 0,
			highScore2048: 0,
			highScoreBlocksSlow: 0,
			highScoreBlocksNormal: 0,
			highScoreBlocksFast: 0,
			minesweeperPreset: 'small',
			highScoreMinesweeperSmall: 0,
			highScoreMinesweeperMedium: 0,
			highScoreMinesweeperLarge: 0,
		});
	});

	it('未知の speed は normal に、未知のプリセットは small に、負や非数のスコアは 0 に丸める（AC-016, AC-056）', () => {
		const s = normalizeSettings({
			speed: 'turbo' as never,
			highScoreSnakeSlow: -5,
			highScoreSnakeNormal: Number.NaN,
			highScoreSnakeFast: 12.7,
			highScore2048: -1,
			highScoreBlocksSlow: -3,
			highScoreBlocksNormal: 7.5,
			highScoreBlocksFast: Number.NaN,
			minesweeperPreset: 'huge' as never,
			highScoreMinesweeperSmall: 71.9,
			highScoreMinesweeperMedium: -1,
			highScoreMinesweeperLarge: Number.NaN,
		});
		expect(s).toEqual({
			speed: 'normal',
			highScoreSnakeSlow: 0,
			highScoreSnakeNormal: 0,
			highScoreSnakeFast: 12,
			highScore2048: 0,
			highScoreBlocksSlow: 0,
			highScoreBlocksNormal: 7,
			highScoreBlocksFast: 0,
			minesweeperPreset: 'small',
			highScoreMinesweeperSmall: 71,
			highScoreMinesweeperMedium: 0,
			highScoreMinesweeperLarge: 0,
		});
	});

	it('旧キー highScoreSnake（速度なし）は normal のハイスコアとして引き継ぎ、旧キーは消す', () => {
		const legacy = { ...DEFAULT_SETTINGS, highScoreSnake: 15 } as PluginSettings & { highScoreSnake?: number };
		const s = normalizeSettings(legacy);
		expect(s.highScoreSnakeNormal).toBe(15);
		expect('highScoreSnake' in s).toBe(false);
	});

	it('旧キーより新キーが大きければ新キーを保つ', () => {
		const legacy = { ...DEFAULT_SETTINGS, highScoreSnakeNormal: 20, highScoreSnake: 15 } as PluginSettings & {
			highScoreSnake?: number;
		};
		expect(normalizeSettings(legacy).highScoreSnakeNormal).toBe(20);
	});
});

describe('mergeHighScore（AC-017）', () => {
	it('メモリとディスクの大きい方を採る', () => {
		expect(mergeHighScore(12, 9)).toBe(12);
		expect(mergeHighScore(9, 20)).toBe(20);
	});

	it('非数は 0 として扱う', () => {
		expect(mergeHighScore(Number.NaN, 5)).toBe(5);
		expect(mergeHighScore(7, Number.NaN)).toBe(7);
	});
});

describe('isSpeed', () => {
	it('3つの速度名だけを受け付ける（ビュー状態の復元で使う）', () => {
		expect(isSpeed('slow')).toBe(true);
		expect(isSpeed('normal')).toBe(true);
		expect(isSpeed('fast')).toBe(true);
		expect(isSpeed('turbo')).toBe(false);
		expect(isSpeed(null)).toBe(false);
		expect(isSpeed(1)).toBe(false);
	});
});

describe('HIGH_SCORE_KEYS / mergeHighScores', () => {
	it('全ハイスコアキーを1か所で列挙する（Snake 3 + 2048 + Blocks 3 + Minesweeper のプリセット別 3）', () => {
		expect([...HIGH_SCORE_KEYS]).toEqual([
			'highScoreSnakeSlow',
			'highScoreSnakeNormal',
			'highScoreSnakeFast',
			'highScore2048',
			'highScoreBlocksSlow',
			'highScoreBlocksNormal',
			'highScoreBlocksFast',
			'highScoreMinesweeperSmall',
			'highScoreMinesweeperMedium',
			'highScoreMinesweeperLarge',
		]);
	});

	it('メモリとディスクをキーごとに最大値でマージし、speed はメモリの値を保つ', () => {
		const memory: PluginSettings = {
			speed: 'fast',
			highScoreSnakeSlow: 3,
			highScoreSnakeNormal: 15,
			highScoreSnakeFast: 0,
			highScore2048: 512,
			highScoreBlocksSlow: 100,
			highScoreBlocksNormal: 0,
			highScoreBlocksFast: 800,
			minesweeperPreset: 'large',
			highScoreMinesweeperSmall: 71,
			highScoreMinesweeperMedium: 0,
			highScoreMinesweeperLarge: 10,
		};
		const disk: PluginSettings = {
			speed: 'slow',
			highScoreSnakeSlow: 5,
			highScoreSnakeNormal: 9,
			highScoreSnakeFast: 2,
			highScore2048: 256,
			highScoreBlocksSlow: 300,
			highScoreBlocksNormal: 0,
			highScoreBlocksFast: 500,
			minesweeperPreset: 'small',
			highScoreMinesweeperSmall: 40,
			highScoreMinesweeperMedium: 50,
			highScoreMinesweeperLarge: 0,
		};
		// 成績は最大値、好み（speed, minesweeperPreset）はメモリ側の値のまま（外部変更時の差し替えは main.ts が行う）
		expect(mergeHighScores(memory, disk)).toEqual({
			speed: 'fast',
			highScoreSnakeSlow: 5,
			highScoreSnakeNormal: 15,
			highScoreSnakeFast: 2,
			highScore2048: 512,
			highScoreBlocksSlow: 300,
			highScoreBlocksNormal: 0,
			highScoreBlocksFast: 800,
			minesweeperPreset: 'large',
			highScoreMinesweeperSmall: 71,
			highScoreMinesweeperMedium: 50,
			highScoreMinesweeperLarge: 10,
		});
	});

	it('引数を変更せず新しいオブジェクトを返す', () => {
		const memory = { ...DEFAULT_SETTINGS, highScore2048: 4 };
		const disk = { ...DEFAULT_SETTINGS, highScore2048: 8 };
		const out = mergeHighScores(memory, disk);
		expect(out).not.toBe(memory);
		expect(memory.highScore2048).toBe(4);
	});
});
