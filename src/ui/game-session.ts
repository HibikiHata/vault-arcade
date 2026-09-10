import type { GameState, HostAction, Rng } from '../core/host/types';
import type { HighScoreKey, Speed } from '../core/settings';
import type { GameModule, GameRenderer } from './games/types';

// 進行中の1ゲーム。モジュール・状態・レンダラ・開始時の速度・通し番号を束ね、
// ビューがゲームごとの分岐を持たずに済むようにする
export class GameSession {
	state: GameState;
	readonly renderer: GameRenderer<GameState>;
	/** 開始時に固定した速度（tick 間隔とスコアの帰属に使う） */
	readonly speed: Speed;
	/** 状態から導いたバリアント id（Minesweeper のプリセット）。スコアの帰属に使う */
	readonly variant: string | undefined;
	/** 古い保存完了が後続ゲームの結果表示を上書きしないための識別子 */
	seq: number;
	isNewHigh = false;

	constructor(
		readonly module: GameModule,
		speed: Speed,
		seq: number,
		state: GameState,
	) {
		this.speed = speed;
		this.seq = seq;
		this.state = state;
		this.variant = module.variantOf?.(state);
		this.renderer = module.createRenderer();
	}

	get isTick(): boolean {
		return this.module.tickInterval !== undefined;
	}

	get interval(): number {
		return this.module.tickInterval ? this.module.tickInterval(this.speed) : 0;
	}

	get scoreKey(): HighScoreKey {
		return this.module.scoreKey(this.speed, this.variant);
	}

	input(action: HostAction, rng: Rng): GameState {
		this.state = this.module.rules.input(this.state, action, rng);
		return this.state;
	}

	step(rng: Rng): GameState {
		if (this.module.rules.step) this.state = this.module.rules.step(this.state, rng);
		return this.state;
	}
}
