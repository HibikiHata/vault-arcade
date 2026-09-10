import { CSS_PREFIX } from '../constants';
import { COLS, ROWS, gravityTicks } from '../core/blocks/constants';
import { PIECES } from '../core/blocks/pieces';
import { landingY, nextPiece } from '../core/blocks/rules';
import type { BlocksState, LastClear } from '../core/blocks/types';
import type { GameRenderer } from './games/types';
import type { Palette } from './theme';

// Blocks の Canvas 描画（adapter 層）。正方形のキャンバスの中央に 10×20 の井戸を置き（セル = 一辺 / 20）、
// 左右の余白に Level / Lines を文字で出す。固定セルも落下中のピースも同じ 1 色、平らな塗りに 1px の隙間だけ。
// 着地位置は同色の細い輪郭（ゴースト）で示す。
// 次のピース枠・着地時の色変化・ベベルは描かない。
// 消えた行は約 180 ms 明滅させてから現在の盤面に切り替える。時間はこの UI 層だけが見る（core は tick 数）。
// 落下は tick カウンタの進み具合で行の間を補間して滑らかに見せる。
// 次のピースは右余白に同色・小さめで描く。
// Snake 用レンダラと resize / DPR の扱いが重複しているが、3 つ目の Canvas ゲームが出るまで共通化しない

/** 消去演出の長さ（ms） */
const FLASH_MS = 180;

interface Flash {
	readonly rows: readonly number[];
	/** 消去直前の井戸（固定したピースを含む） */
	readonly well: readonly number[];
	readonly start: number;
}

export class CanvasRendererBlocks implements GameRenderer<BlocksState> {
	private canvas: HTMLCanvasElement | null = null;
	private ctx: CanvasRenderingContext2D | null = null;
	private palette: Palette | null = null;
	private cssSize = 0;
	private fontFamily = 'sans-serif';
	/** 前回描いた井戸。消去演出で「消える前の盤面」を再構成するために使う */
	private prevWell: readonly number[] | null = null;
	private seenClear: LastClear | null = null;
	private flash: Flash | null = null;

	mount(container: HTMLElement): void {
		this.canvas = container.createEl('canvas', { cls: `${CSS_PREFIX}-canvas` });
		this.ctx = this.canvas.getContext('2d');
		// Canvas は CSS 変数を直接使えないので、余白の文字用にインターフェースのフォントを一度だけ読む
		this.fontFamily = getComputedStyle(container).fontFamily || 'sans-serif';
	}

	setPalette(palette: Palette): void {
		this.palette = palette;
	}

	/** CSS 上の一辺の長さと devicePixelRatio から裏バッファを確保する（Retina で滲ませない） */
	resize(cssSize: number, dpr: number): void {
		if (!this.canvas || !this.ctx) return;
		const px = Math.max(1, Math.round(cssSize * dpr));
		if (this.canvas.width !== px || this.canvas.height !== px) {
			this.canvas.width = px;
			this.canvas.height = px;
		}
		this.cssSize = cssSize;
		this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
	}

	render(state: BlocksState): void {
		const canvas = this.canvas;
		const ctx = this.ctx;
		const palette = this.palette;
		if (!canvas || !ctx || !palette || this.cssSize === 0) return;
		const size = this.cssSize;
		const cell = size / ROWS;
		const wellWidth = cell * COLS;
		const left = (size - wellWidth) / 2;
		const now = canvas.win.performance.now();
		const flash = this.updateFlash(state, canvas, now);

		ctx.fillStyle = palette.background;
		ctx.fillRect(0, 0, size, size);

		// 井戸の枠線（1px、テーマの境界色）
		ctx.strokeStyle = palette.grid;
		ctx.lineWidth = 1;
		ctx.strokeRect(Math.round(left) + 0.5, 0.5, Math.round(wellWidth) - 1, size - 1);

		// 固定セルと落下中のピースは同じ色（着地で色を変えない）。演出中は消える前の井戸を描く
		const inset = Math.max(1, cell * 0.06);
		const side = cell - inset * 2;
		const well = flash ? flash.well : state.well;
		ctx.fillStyle = palette.snake;
		for (let r = 0; r < ROWS; r += 1) {
			for (let c = 0; c < COLS; c += 1) {
				if (well[r * COLS + c]) ctx.fillRect(left + c * cell + inset, r * cell + inset, side, side);
			}
		}
		// 落下中は次の行までの進み具合（gravity / その level の tick 数）だけ下にずらして描く。接地中は整数行
		const ly = landingY(state);
		const frac = ly > state.y ? Math.min(state.gravity / gravityTicks(state.level), 0.999) : 0;
		const cells = PIECES[state.piece][state.rotation] ?? [];
		for (const [dc, dr] of cells) {
			const c = state.x + dc;
			const r = state.y + dr;
			if (c < 0 || c >= COLS || r < 0 || r >= ROWS) continue;
			ctx.fillRect(left + c * cell + inset, (r + frac) * cell + inset, side, side);
		}

		if (flash) {
			// 消える行を明るく塗ってフェードさせる
			const t = Math.min(1, (now - flash.start) / FLASH_MS);
			ctx.fillStyle = palette.text;
			ctx.globalAlpha = 0.85 * (1 - t);
			for (const r of flash.rows) ctx.fillRect(left, r * cell, wellWidth, cell);
			ctx.globalAlpha = 1;
		} else if (state.phase === 'running' || state.phase === 'paused') {
			// 着地位置の輪郭（ゴースト）。塗らず同色の 1px 線だけ。演出中は井戸が古いので描かない
			if (ly > state.y) {
				ctx.strokeStyle = palette.snake;
				ctx.lineWidth = 1;
				for (const [dc, dr] of cells) {
					const c = state.x + dc;
					const r = ly + dr;
					ctx.strokeRect(left + c * cell + inset + 0.5, r * cell + inset + 0.5, side - 1, side - 1);
				}
			}
		}

		// 余白の Level / Lines。箱のような枠は描かない（次のピース枠に見せない）
		ctx.fillStyle = palette.muted;
		ctx.font = `${Math.max(10, Math.round(cell * 0.75))}px ${this.fontFamily}`;
		ctx.textAlign = 'center';
		ctx.textBaseline = 'top';
		const leftCenter = left / 2;
		const rightCenter = left + wellWidth + left / 2;
		ctx.fillText('Level', leftCenter, cell);
		ctx.fillText(String(state.level), leftCenter, cell * 2.2);
		ctx.fillText('Lines', rightCenter, cell);
		ctx.fillText(String(state.lines), rightCenter, cell * 2.2);

		// 次のピース（bag の先頭）。ラベルと形だけを同じ色で描き、箱は描かない
		ctx.fillText('Next', rightCenter, cell * 4);
		const next = PIECES[nextPiece(state)][0] ?? [];
		let minC = 4;
		let maxC = 0;
		let minR = 4;
		for (const [c, r] of next) {
			if (c < minC) minC = c;
			if (c > maxC) maxC = c;
			if (r < minR) minR = r;
		}
		const small = cell * 0.6;
		const smallInset = Math.max(1, small * 0.06);
		const x0 = rightCenter - ((maxC - minC + 1) * small) / 2;
		const y0 = cell * 5.4;
		ctx.fillStyle = palette.snake;
		for (const [c, r] of next) {
			ctx.fillRect(x0 + (c - minC) * small + smallInset, y0 + (r - minR) * small + smallInset, small - smallInset * 2, small - smallInset * 2);
		}

		this.prevWell = state.well;
	}

	/**
	 * 消去演出の開始と終了を判定する。新しい lastClear を見たら、前回描いた井戸に固定したセルを足して
	 * 「消える前の盤面」を作り、FLASH_MS の間それを描く。reduce-motion なら演出しない。
	 * running でなくなったら（over・paused）演出を打ち切って現在の盤面を出す（ループが止まり途中で固まるため）
	 */
	private updateFlash(state: BlocksState, canvas: HTMLCanvasElement, now: number): Flash | null {
		if (state.lastClear && state.lastClear !== this.seenClear) {
			this.seenClear = state.lastClear;
			const reduceMotion = canvas.win.matchMedia('(prefers-reduced-motion: reduce)').matches;
			if (!reduceMotion && this.prevWell) {
				const snapshot = this.prevWell.slice();
				for (const [c, r] of state.lastClear.cells) snapshot[r * COLS + c] = 1;
				this.flash = { rows: state.lastClear.rows, well: snapshot, start: now };
			}
		}
		if (this.flash && (state.phase !== 'running' || now - this.flash.start >= FLASH_MS)) this.flash = null;
		return this.flash;
	}

	unmount(): void {
		this.canvas?.remove();
		this.canvas = null;
		this.ctx = null;
	}
}
