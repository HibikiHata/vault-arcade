import { minesweeperMapInput } from '../../core/minesweeper/input';
import { parseSaved, toSaved } from '../../core/minesweeper/persist';
import { init, input } from '../../core/minesweeper/rules';
import type { MinesweeperState } from '../../core/minesweeper/types';
import { isMinesweeperPreset, minesweeperHighScoreKey } from '../../core/settings';
import { DomRendererMinesweeper } from '../dom-renderer-minesweeper';
import type { GameModule } from './types';

/**
 * Minesweeper のモジュール。手番駆動（tickInterval なし）、プリセットは variant で宣言し
 * 設定 minesweeperPreset に保存、スコアはプリセットごと（開いた安全セル数の最大）
 */
export const minesweeperModule: GameModule<MinesweeperState> = {
	id: 'minesweeper',
	title: 'Minesweeper',
	rules: { init, input },
	scoreKey: (_speed, variant) => minesweeperHighScoreKey(isMinesweeperPreset(variant) ? variant : 'small'),
	variant: {
		settingKey: 'minesweeperPreset',
		label: 'Board',
		options: [
			{ id: 'small', label: '9×9 · 10', cols: 9 },
			{ id: 'medium', label: '11×11 · 18', cols: 11 },
			{ id: 'large', label: '16×16 · 40', cols: 16 },
		],
	},
	variantOf: (state) => state.preset,
	toSaved,
	parseSaved,
	createRenderer: () => new DomRendererMinesweeper(),
	mapInput: minesweeperMapInput,
};
