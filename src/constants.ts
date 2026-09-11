// 公開後に変更できない識別子と、ゲーム共通の調整値をここに集約する
import type { Speed } from './core/settings';

/** ワークスペースに保存されるビュー種別。公開後は固定 */
export const VIEW_TYPE = 'vault-arcade-view';
/** コマンド id。Obsidian が "vault-arcade:" を前置するのでプラグイン名を含めない */
export const COMMAND_OPEN = 'open';
/** Lucide アイコン名（Obsidian 同梱） */
export const ICON = 'gamepad-2';
/** Snake の速度ごとの tick 間隔（ms）。iPhone での試行後に調整可 */
export const SPEED_INTERVALS: Record<Speed, number> = { slow: 200, normal: 120, fast: 70 };
/** Blocks の速度ごとの tick 間隔（ms）。重力とロック遅延は core 側で tick 数として持つ */
export const BLOCKS_TICK_MS: Record<Speed, number> = { slow: 70, normal: 50, fast: 35 };
/** 1フレームで進めてよい経過時間の上限（ms）。バックグラウンド復帰時の連続 tick を防ぐ */
export const MAX_FRAME_MS = 250;
/** スワイプと判定する最小移動量（CSS px） */
export const SWIPE_MIN_PX = 24;
/** タップと判定する最大移動量（CSS px） */
export const TAP_MAX_PX = 10;
/** 指を離さない横ドラッグで 1 段階（Blocks では 1 列）と数える移動量（CSS px） */
export const DRAG_STEP_PX = 24;
/** CSS クラスの接頭辞。既存の arcade プラグインと衝突させない */
export const CSS_PREFIX = 'vault-arcade';
/** セルの長押しを旗と判定する時間（ms）。Minesweeper の旗立て */
export const LONG_PRESS_MS = 500;
/** 長押しの途中表示（押している見た目）を出すまでの時間（ms） */
export const HOLD_FEEDBACK_MS = 150;
