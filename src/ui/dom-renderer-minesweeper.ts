import { CSS_PREFIX } from '../constants';
import type { HostAction } from '../core/host/types';
import { adjacentCount } from '../core/minesweeper/rules';
import type { MinesweeperState } from '../core/minesweeper/types';
import { attachCellInput } from './cell-input';
import type { GameRenderer } from './games/types';

// Minesweeper の DOM 描画（セルをタップするゲームは DOM で描く）。cols×rows のグリッドを一度作り、
// render ごとにクラスと文字を更新する。色とサイズは CSS（テーマ変数）に任せる。
// セル入力は cell-input ヘルパが受け、mount で渡された dispatch へ cell アクションを発行する

const CELL = `${CSS_PREFIX}-ms-cell`;

export class DomRendererMinesweeper implements GameRenderer<MinesweeperState> {
	private root: HTMLElement | null = null;
	private cells: HTMLElement[] = [];
	private cols = 0;
	private rows = 0;
	private dispatch: ((action: HostAction) => void) | null = null;
	private detach: (() => void) | null = null;

	mount(container: HTMLElement, dispatch?: (action: HostAction) => void): void {
		this.root = container.createDiv({ cls: `${CSS_PREFIX}-ms` });
		this.root.setAttr('aria-hidden', 'true');
		this.dispatch = dispatch ?? null;
		this.detach = attachCellInput(this.root, {
			cellOf: (target) => this.indexOf(target),
			onReveal: (i) => this.send(i, false),
			onFlag: (i) => this.send(i, true),
			onHolding: (i, holding) => this.cells[i]?.toggleClass('is-holding', holding),
		});
	}

	setPalette(): void {
		// 色は CSS 変数で解決される
	}

	resize(): void {
		// レイアウトは CSS grid に任せる
	}

	render(state: MinesweeperState): void {
		if (!this.root) return;
		if (state.cols !== this.cols || state.rows !== this.rows) this.rebuild(state);
		const over = state.phase === 'over';
		const won = state.phase === 'won';
		const cursorIndex = state.cursor.y * state.cols + state.cursor.x;
		for (let i = 0; i < this.cells.length; i += 1) {
			const el = this.cells[i];
			if (!el) continue;
			const open = state.open[i] === 1;
			const flag = state.flags[i] === 1;
			const mine = state.mines[i] === 1;
			let cls = '';
			let text = '';
			if (open) {
				if (mine) {
					cls = i === state.exploded ? 'is-open is-mine is-exploded' : 'is-open is-mine';
					text = '✹';
				} else {
					const n = adjacentCount(state.mines, i, state.cols, state.rows);
					cls = n > 0 ? `is-open is-n${n}` : 'is-open';
					text = n > 0 ? String(n) : '';
				}
			} else if (flag) {
				// 敗北後、地雷でないセルの旗は誤りとして示す（正しい旗はそのまま）
				cls = over && !mine ? 'is-flag is-wrong' : 'is-flag';
				text = '⚑';
			} else if (won && mine) {
				// 勝利後は残りの地雷を旗で示す（表示のみ。状態の flags は変えない）
				cls = 'is-flag';
				text = '⚑';
			}
			if (i === cursorIndex) cls += ' is-cursor';
			el.className = `${CELL} ${cls}`.trim();
			if (el.textContent !== text) el.setText(text);
		}
	}

	unmount(): void {
		this.detach?.();
		this.detach = null;
		this.root?.remove();
		this.root = null;
		this.cells = [];
		this.dispatch = null;
	}

	private rebuild(state: MinesweeperState): void {
		const root = this.root;
		if (!root) return;
		root.empty();
		this.cells = [];
		this.cols = state.cols;
		this.rows = state.rows;
		root.setCssProps({ '--cols': String(state.cols), '--rows': String(state.rows) });
		for (let i = 0; i < state.cols * state.rows; i += 1) {
			const cell = root.createDiv({ cls: CELL });
			cell.dataset['i'] = String(i);
			this.cells.push(cell);
		}
	}

	/** target からセル index を得る。instanceof はポップアウト（別 Window）で偽になるので、closest と dataset の有無で判定する */
	private indexOf(target: EventTarget | null): number | null {
		const el = target as { closest?: (selector: string) => Element | null } | null;
		const cell = typeof el?.closest === 'function' ? el.closest(`.${CELL}`) : null;
		const dataset = (cell as { dataset?: DOMStringMap } | null)?.dataset;
		if (!dataset) return null;
		const i = Number(dataset['i']);
		return Number.isInteger(i) ? i : null;
	}

	private send(index: number, alt: boolean): void {
		if (!this.dispatch || this.cols === 0) return;
		this.dispatch({ type: 'cell', alt, x: index % this.cols, y: Math.floor(index / this.cols) });
	}
}
