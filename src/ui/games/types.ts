import type { GameRules, GameState, HostAction, InputMapper } from '../../core/host/types';
import type { HighScoreKey, PrefKey, Speed } from '../../core/settings';
import type { Palette } from '../theme';

// ゲームモジュールの契約。レンダラを含むため core ではなく ui に置く

export type GameId = 'snake' | 'game2048' | 'blocks' | 'minesweeper';

/** ゲームごとの選択肢（Minesweeper のプリセット）。cols を持つ選択肢は盤面幅で可用性を判定する（AC-055） */
export interface VariantOption {
	readonly id: string;
	readonly label: string;
	readonly cols?: number;
}
export interface VariantSpec {
	/** 選択を保存する設定キー（好み。外部変更時はディスク優先） */
	readonly settingKey: PrefKey;
	readonly label: string;
	readonly options: readonly VariantOption[];
}

export interface GameRenderer<S> {
	/** dispatch はセル入力を発行するレンダラ（Minesweeper）が使う。Canvas のゲームは無視してよい */
	mount(container: HTMLElement, dispatch?: (action: HostAction) => void): void;
	setPalette(palette: Palette): void;
	resize(cssSize: number, dpr: number): void;
	render(state: S): void;
	unmount(): void;
}

export interface GameModule<S extends GameState = GameState> {
	readonly id: GameId;
	readonly title: string;
	readonly rules: GameRules<S>;
	/** ある = tick 駆動（ループ・速度セレクタ・フォーカス喪失で一時停止）。無い = 手番駆動 */
	readonly tickInterval?: (speed: Speed) => number;
	/** variant はゲームが宣言した選択肢の id（無いゲームには渡らない） */
	scoreKey(speed: Speed, variant?: string): HighScoreKey;
	toSaved(state: S): unknown;
	parseSaved(raw: unknown): S | null;
	createRenderer(): GameRenderer<S>;
	/** won 画面に Keep playing を出す（2048） */
	readonly canContinue?: true;
	/** 生入力の解釈をゲームが差し替える（Blocks: Space=ドロップ、タップ=回転）。無ければ defaultMapInput */
	readonly mapInput?: InputMapper;
	/** メニューに出す選択肢（Minesweeper のプリセット）。無ければ選択肢なし */
	readonly variant?: VariantSpec;
	/** 状態からバリアント id を導く（状態が唯一の情報源。ビュー状態には保存しない） */
	variantOf?(state: S): string;
}
