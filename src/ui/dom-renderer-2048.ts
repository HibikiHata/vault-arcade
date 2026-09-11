import { CSS_PREFIX } from '../constants';
import type { Board2048State } from '../core/game2048/types';
import type { GameRenderer } from './games/types';

// 2048 の DOM 描画（文字を持つタイルは DOM で描く）。色とサイズは CSS クラスで指定し、位置は CSS 変数で渡す。
// 直前の手（state.lastMove）があれば、各タイルに移動量を与えて CSS トランジションでスライドさせ、
// 終了後に確定描画する（新タイルは小さく出現、合体先は一瞬拡大）。時間はこの層だけが知る

const TIER_MAX = 11; // 2048 = 2^11
const SIZE = 4;
/** CSS のトランジション時間と揃える。終了検知はタイマーで行い、transitionend に依存しない */
const SLIDE_MS = 100;

export class DomRenderer2048 implements GameRenderer<Board2048State> {
	private root: HTMLElement | null = null;
	private layer: HTMLElement | null = null;
	private pending: number | null = null;
	private pendingState: Board2048State | null = null;

	mount(container: HTMLElement): void {
		this.root = container.createDiv({ cls: `${CSS_PREFIX}-grid` });
		for (let i = 0; i < SIZE * SIZE; i += 1) this.root.createDiv({ cls: `${CSS_PREFIX}-cell` });
		this.layer = this.root.createDiv({ cls: `${CSS_PREFIX}-tiles` });
		this.layer.setAttr('aria-hidden', 'true');
	}

	setPalette(): void {
		// 色は CSS 変数で解決されるため、DOM レンダラでは何もしない
	}

	resize(): void {
		// レイアウトは CSS grid に任せる
	}

	render(state: Board2048State): void {
		if (!this.layer) return;
		// 前のアニメーションが残っていれば即確定してから次へ
		this.finishPending();
		const last = state.lastMove;
		if (!last || last.moves.every((m) => m.from === m.to) || !this.layer.hasChildNodes()) {
			this.drawStatic(state, last?.spawned ?? null, []);
			return;
		}
		// 1) 現在の（移動前の）タイルに移動量を与える
		const tiles = new Map<number, HTMLElement>();
		for (const el of Array.from(this.layer.children)) {
			const from = Number((el as HTMLElement).dataset['index']);
			if (Number.isFinite(from)) tiles.set(from, el as HTMLElement);
		}
		for (const m of last.moves) {
			const el = tiles.get(m.from);
			if (!el || m.from === m.to) continue;
			const dx = (m.to % SIZE) - (m.from % SIZE);
			const dy = Math.floor(m.to / SIZE) - Math.floor(m.from / SIZE);
			el.setCssProps({ '--dx': String(dx), '--dy': String(dy) });
			el.addClass(`${CSS_PREFIX}-tile--moving`);
		}
		// 2) トランジション後に確定描画（合体先を強調し、新タイルを出現させる）
		const merged = last.moves.filter((m) => m.merged).map((m) => m.to);
		this.pendingState = state;
		this.pending = this.layer.win.setTimeout(() => {
			this.pending = null;
			this.pendingState = null;
			this.drawStatic(state, last.spawned, merged);
		}, SLIDE_MS);
	}

	unmount(): void {
		if (this.pending !== null && this.layer) this.layer.win.clearTimeout(this.pending);
		this.pending = null;
		this.pendingState = null;
		this.root?.remove();
		this.root = null;
		this.layer = null;
	}

	private finishPending(): void {
		if (this.pending === null || !this.layer) return;
		this.layer.win.clearTimeout(this.pending);
		this.pending = null;
		const s = this.pendingState;
		this.pendingState = null;
		if (s) this.drawStatic(s, null, []);
	}

	/** タイル層を作り直す。spawned は出現、emphasize は合体先の強調 */
	private drawStatic(state: Board2048State, spawned: number | null, emphasize: readonly number[]): void {
		const layer = this.layer;
		if (!layer) return;
		layer.empty();
		state.grid.forEach((value, i) => {
			if (value === 0) return;
			const tier = Math.min(TIER_MAX, Math.round(Math.log2(value)));
			const tile = layer.createDiv({ cls: `${CSS_PREFIX}-tile ${CSS_PREFIX}-tile--t${tier}`, text: String(value) });
			tile.dataset['index'] = String(i);
			tile.setCssProps({ '--col': String(i % SIZE), '--row': String(Math.floor(i / SIZE)) });
			if (value >= 1024) tile.addClass(`${CSS_PREFIX}-tile--wide`);
			if (i === spawned) tile.addClass(`${CSS_PREFIX}-tile--spawn`);
			if (emphasize.includes(i)) tile.addClass(`${CSS_PREFIX}-tile--merged`);
		});
	}
}
