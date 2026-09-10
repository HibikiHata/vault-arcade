import { SPEED_INTERVALS } from '../../constants';
import { highScoreKey } from '../../core/settings';
import { parseSavedState, toSavedState } from '../../core/snake/persist';
import { init, input, step } from '../../core/snake/rules';
import type { SnakeState } from '../../core/snake/types';
import { CanvasRenderer } from '../canvas-renderer';
import type { GameModule } from './types';

const COLS = 20;
const ROWS = 20;

/** Snake のモジュール。core/snake を host の契約に合わせて包む（core 側は無変更） */
export const snakeModule: GameModule<SnakeState> = {
	id: 'snake',
	title: 'Snake',
	rules: {
		init: (rng) => init(COLS, ROWS, rng),
		input,
		step,
	},
	tickInterval: (speed) => SPEED_INTERVALS[speed],
	scoreKey: (speed) => highScoreKey(speed),
	toSaved: toSavedState,
	parseSaved: parseSavedState,
	createRenderer: () => new CanvasRenderer(),
};
