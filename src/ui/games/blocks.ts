import { BLOCKS_TICK_MS } from '../../constants';
import { blocksMapInput } from '../../core/blocks/input';
import { parseSaved, toSaved } from '../../core/blocks/persist';
import { init, input, step } from '../../core/blocks/rules';
import type { BlocksState } from '../../core/blocks/types';
import { blocksHighScoreKey } from '../../core/settings';
import { CanvasRendererBlocks } from '../canvas-renderer-blocks';
import type { GameModule } from './types';

/**
 * Blocks のモジュール。tick 駆動（速度は基本 tick 間隔の倍率、重力は core の tick カウンタ）、
 * スコアは速度ごと、入力は独自マッピング（Space = ハードドロップ、タップ = 回転）。
 */
export const blocksModule: GameModule<BlocksState> = {
	id: 'blocks',
	title: 'Blocks',
	rules: { init, input, step },
	tickInterval: (speed) => BLOCKS_TICK_MS[speed],
	scoreKey: blocksHighScoreKey,
	toSaved,
	parseSaved,
	createRenderer: () => new CanvasRendererBlocks(),
	mapInput: blocksMapInput,
};
