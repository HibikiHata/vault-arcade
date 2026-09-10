import { parseSaved, toSaved } from '../../core/game2048/persist';
import { init, input } from '../../core/game2048/rules';
import type { Board2048State } from '../../core/game2048/types';
import { DomRenderer2048 } from '../dom-renderer-2048';
import type { GameModule } from './types';

/** 2048 のモジュール。手番駆動（tickInterval なし）、スコアは速度と無関係に1キー、won 画面で Keep playing */
export const game2048Module: GameModule<Board2048State> = {
	id: 'game2048',
	title: '2048',
	rules: { init, input },
	scoreKey: () => 'highScore2048',
	toSaved,
	parseSaved,
	createRenderer: () => new DomRenderer2048(),
	canContinue: true,
};
