// ゲーム共通の契約。Obsidian・DOM・時計・乱数に依存しない

export type Direction = 'up' | 'down' | 'left' | 'right';
export type Phase = 'idle' | 'running' | 'paused' | 'over' | 'won';

export interface Point {
	readonly x: number;
	readonly y: number;
}

/** [0, 1) の乱数を返す。テストでは固定列を注入する */
export type Rng = () => number;

/** host が発行する操作の語彙。ゲームは自分に関係ないものを無視して同じ状態を返す */
export type HostAction =
	| { type: 'start' }
	| { type: 'restart' }
	| { type: 'quit' }
	| { type: 'pause' }
	| { type: 'resume' }
	| { type: 'toggle-pause' }
	| { type: 'continue' }
	| { type: 'turn'; dir: Direction }
	/** 時計回りに回転（Blocks）。Snake / 2048 は同じ状態を返す */
	| { type: 'rotate' }
	/** ハードドロップ（Blocks）。Snake / 2048 は同じ状態を返す */
	| { type: 'drop' }
	/**
	 * セル操作。alt=false は開封、alt=true は旗。x/y 省略はゲームのカーソル位置。
	 * レンダラがセル上のタップ/クリック/長押しから発行する。他のゲームは同じ状態を返す
	 */
	| { type: 'cell'; alt: boolean; x?: number; y?: number };

/**
 * 生入力。DOM イベントではなく純データにして、解釈（どの HostAction にするか）を core の純関数に任せる。
 * key/code はブラウザの KeyboardEvent の値そのまま。repeat は自動リピート、modifier は Cmd/Ctrl/Alt のいずれか
 */
export type RawInput =
	| { kind: 'key'; key: string; code: string; repeat: boolean; modifier: boolean }
	| { kind: 'swipe'; dir: Direction }
	| { kind: 'tap' }
	/** 指を離さずに横へ 1 段階（DRAG_STEP_PX）動かした。既定では無視、Blocks は 1 列移動 */
	| { kind: 'drag'; dir: Direction };

/** 生入力を操作に変換する。null は「このゲームには無関係」 */
export type InputMapper = (raw: RawInput) => HostAction | null;

/** すべてのゲーム状態が持つ共通部分 */
export interface GameState {
	readonly phase: Phase;
	readonly score: number;
}

/**
 * 各ゲームが実装するルール。盤面の寸法はゲーム側の定数。
 * step は tick 駆動のゲームだけが持ち、手番駆動のゲーム（2048 等）は input だけで進む
 */
export interface GameRules<S extends GameState> {
	/** variant はモジュールが宣言する選択肢の id（Minesweeper のプリセット）。使わないゲームは無視する */
	init(rng: Rng, variant?: string): S;
	input(state: S, action: HostAction, rng: Rng): S;
	step?(state: S, rng: Rng): S;
}
