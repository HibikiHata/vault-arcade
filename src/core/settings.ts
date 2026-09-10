// プラグイン設定の型・既定値と、保存データとのマージ・正規化。
// この層は Obsidian API に依存しない（ESLint の no-restricted-imports で強制）

export type Speed = 'slow' | 'normal' | 'fast';

/** Minesweeper の盤面プリセット。寸法と地雷数は core/minesweeper が持つ */
export type MinesweeperPreset = 'small' | 'medium' | 'large';

/**
 * 好み（設定）のキー。成績（ハイスコア）と違い、他端末が data.json を書いたときはディスクの値を採る
 * （main.ts の onExternalSettingsChange）。ここに列挙したものだけがその扱いを受ける
 */
export type PrefKey = 'speed' | 'minesweeperPreset';
export const PREF_KEYS: readonly PrefKey[] = ['speed', 'minesweeperPreset'];

/**
 * ハイスコアは平坦なキーで持つ。
 * tick ゲーム（Snake, Blocks）は速度セレクタが付くので速度ごと、手番駆動の 2048 は1つ
 */
export type HighScoreKey =
	| 'highScoreSnakeSlow'
	| 'highScoreSnakeNormal'
	| 'highScoreSnakeFast'
	| 'highScore2048'
	| 'highScoreBlocksSlow'
	| 'highScoreBlocksNormal'
	| 'highScoreBlocksFast'
	| 'highScoreMinesweeperSmall'
	| 'highScoreMinesweeperMedium'
	| 'highScoreMinesweeperLarge';

export interface PluginSettings {
	speed: Speed;
	highScoreSnakeSlow: number;
	highScoreSnakeNormal: number;
	highScoreSnakeFast: number;
	highScore2048: number;
	highScoreBlocksSlow: number;
	highScoreBlocksNormal: number;
	highScoreBlocksFast: number;
	minesweeperPreset: MinesweeperPreset;
	highScoreMinesweeperSmall: number;
	highScoreMinesweeperMedium: number;
	highScoreMinesweeperLarge: number;
}

/** 全ハイスコアキーの唯一の列挙。永続化のマージはここを回す */
export const HIGH_SCORE_KEYS: readonly HighScoreKey[] = [
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
];

export const DEFAULT_SETTINGS: PluginSettings = {
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
};

const MINESWEEPER_PRESETS: readonly MinesweeperPreset[] = ['small', 'medium', 'large'];

/** プリセット id かどうか。設定の正規化とモジュールの init/scoreKey の入口で使う（AC-056） */
export function isMinesweeperPreset(v: unknown): v is MinesweeperPreset {
	return typeof v === 'string' && (MINESWEEPER_PRESETS as readonly string[]).includes(v);
}

const SPEEDS: readonly Speed[] = ['slow', 'normal', 'fast'];

/** 速度名かどうか。ビュー状態の復元など、外から来た値の検証に使う */
export function isSpeed(v: unknown): v is Speed {
	return typeof v === 'string' && (SPEEDS as readonly string[]).includes(v);
}

const SNAKE_KEYS: Record<Speed, HighScoreKey> = {
	slow: 'highScoreSnakeSlow',
	normal: 'highScoreSnakeNormal',
	fast: 'highScoreSnakeFast',
};

/** Snake の速度別ハイスコアキー */
export function highScoreKey(speed: Speed): HighScoreKey {
	return SNAKE_KEYS[speed];
}

const BLOCKS_KEYS: Record<Speed, HighScoreKey> = {
	slow: 'highScoreBlocksSlow',
	normal: 'highScoreBlocksNormal',
	fast: 'highScoreBlocksFast',
};

/** Blocks の速度別ハイスコアキー（速度別の表は Snake と Blocks の 2 つ。同種の 3 つ目が現れたら共通化を検討する） */
export function blocksHighScoreKey(speed: Speed): HighScoreKey {
	return BLOCKS_KEYS[speed];
}

const MINESWEEPER_KEYS: Record<MinesweeperPreset, HighScoreKey> = {
	small: 'highScoreMinesweeperSmall',
	medium: 'highScoreMinesweeperMedium',
	large: 'highScoreMinesweeperLarge',
};

/** Minesweeper のプリセット別ハイスコアキー（速度別の表とは別種。プリセット別の表が 2 つになったら共通化を検討する） */
export function minesweeperHighScoreKey(preset: MinesweeperPreset): HighScoreKey {
	return MINESWEEPER_KEYS[preset];
}

/** 好み（PREF_KEYS）だけを source から写した新しい設定を返す。外部変更時に「設定はディスク優先」を実現する */
export function withPrefsFrom(source: PluginSettings, target: PluginSettings): PluginSettings {
	const out: PluginSettings = { ...target };
	const writable = out as unknown as Record<PrefKey, string>;
	for (const key of PREF_KEYS) writable[key] = source[key];
	return out;
}

/**
 * 既定値に保存済み設定を重ねて完全な設定を返す。
 * - loaded が null/undefined（初回起動）なら既定値と同じ内容の新しいオブジェクト
 * - loaded に無いキーは既定値で埋める
 * - loaded にしか無いキー（旧バージョンの設定）は落とさず残す（Object.assign と同じ振る舞い）
 * - 引数はどちらも変更しない
 */
export function mergeSettings<T extends object>(defaults: T, loaded: Partial<T> | null | undefined): T {
	return { ...defaults, ...(loaded ?? {}) };
}

function clampScore(raw: unknown): number {
	return typeof raw === 'number' && Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 0;
}

/**
 * 保存データの値を安全な範囲に丸める（AC-016）。未知の speed は normal、負や非数のスコアは 0、小数は切り捨て。
 * 速度なしの旧キー highScoreSnake は normal のハイスコアへ引き継いで削除する（0.1.0 の開発中データ）
 */
export function normalizeSettings(s: PluginSettings): PluginSettings {
	const { highScoreSnake: legacy, ...rest } = s as PluginSettings & { highScoreSnake?: unknown };
	const speed = isSpeed(rest.speed) ? rest.speed : DEFAULT_SETTINGS.speed;
	const minesweeperPreset = isMinesweeperPreset(rest.minesweeperPreset)
		? rest.minesweeperPreset
		: DEFAULT_SETTINGS.minesweeperPreset;
	return {
		...rest,
		speed,
		minesweeperPreset,
		highScoreSnakeSlow: clampScore(rest.highScoreSnakeSlow),
		highScoreSnakeNormal: Math.max(clampScore(rest.highScoreSnakeNormal), clampScore(legacy)),
		highScoreSnakeFast: clampScore(rest.highScoreSnakeFast),
		highScore2048: clampScore(rest.highScore2048),
		highScoreBlocksSlow: clampScore(rest.highScoreBlocksSlow),
		highScoreBlocksNormal: clampScore(rest.highScoreBlocksNormal),
		highScoreBlocksFast: clampScore(rest.highScoreBlocksFast),
		highScoreMinesweeperSmall: clampScore(rest.highScoreMinesweeperSmall),
		highScoreMinesweeperMedium: clampScore(rest.highScoreMinesweeperMedium),
		highScoreMinesweeperLarge: clampScore(rest.highScoreMinesweeperLarge),
	};
}

/** ハイスコアは単調増加: メモリとディスクの大きい方を採る。非数は 0 扱い（AC-017） */
export function mergeHighScore(memory: number, disk: number): number {
	const m = Number.isFinite(memory) ? memory : 0;
	const d = Number.isFinite(disk) ? disk : 0;
	return Math.max(m, d);
}

/** 全キーを最大値でマージした新しい設定を返す。speed はメモリ側の値。引数は変更しない */
export function mergeHighScores(memory: PluginSettings, disk: PluginSettings): PluginSettings {
	const out: PluginSettings = { ...memory };
	for (const key of HIGH_SCORE_KEYS) out[key] = mergeHighScore(memory[key], disk[key]);
	return out;
}
