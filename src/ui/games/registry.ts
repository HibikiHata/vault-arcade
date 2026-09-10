import { blocksModule } from './blocks';
import { game2048Module } from './game2048';
import { minesweeperModule } from './minesweeper';
import { snakeModule } from './snake';
import type { GameModule } from './types';

// 登録済みゲームの一覧（メニューの表示順）。プラグイン本体はこれを保持しない（ビューが import する）
export const GAMES: readonly GameModule[] = [snakeModule, game2048Module, blocksModule, minesweeperModule];

export function findGame(id: unknown): GameModule | undefined {
	return GAMES.find((g) => g.id === id);
}
