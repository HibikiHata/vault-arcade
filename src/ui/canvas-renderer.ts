import type { SnakeState } from '../core/snake/types';
import { CSS_PREFIX } from '../constants';
import type { Palette } from './theme';

// Snake の Canvas 描画（adapter 層）。状態を受け取って描くだけで、自分の状態はパレットとサイズのみ。
// 毎フレームの割り当てを避けるため、描画中に配列やオブジェクトを作らない

export class CanvasRenderer {
	private canvas: HTMLCanvasElement | null = null;
	private ctx: CanvasRenderingContext2D | null = null;
	private palette: Palette | null = null;
	private cssSize = 0;

	mount(container: HTMLElement): void {
		this.canvas = container.createEl('canvas', { cls: `${CSS_PREFIX}-canvas` });
		this.ctx = this.canvas.getContext('2d');
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

	render(state: SnakeState): void {
		const ctx = this.ctx;
		const palette = this.palette;
		if (!ctx || !palette || this.cssSize === 0) return;
		const size = this.cssSize;
		const cell = size / state.cols;

		ctx.fillStyle = palette.background;
		ctx.fillRect(0, 0, size, size);

		ctx.strokeStyle = palette.grid;
		ctx.lineWidth = 1;
		ctx.beginPath();
		for (let i = 1; i < state.cols; i += 1) {
			const x = Math.round(i * cell) + 0.5;
			ctx.moveTo(x, 0);
			ctx.lineTo(x, size);
		}
		for (let j = 1; j < state.rows; j += 1) {
			const y = Math.round(j * cell) + 0.5;
			ctx.moveTo(0, y);
			ctx.lineTo(size, y);
		}
		ctx.stroke();

		if (state.food) {
			ctx.fillStyle = palette.food;
			const r = cell * 0.35;
			ctx.beginPath();
			ctx.arc((state.food.x + 0.5) * cell, (state.food.y + 0.5) * cell, r, 0, Math.PI * 2);
			ctx.fill();
		}

		const inset = Math.max(1, cell * 0.08);
		for (let i = state.body.length - 1; i >= 0; i -= 1) {
			const seg = state.body[i];
			if (!seg) continue;
			ctx.fillStyle = i === 0 ? palette.head : palette.snake;
			ctx.fillRect(seg.x * cell + inset, seg.y * cell + inset, cell - inset * 2, cell - inset * 2);
		}
	}

	unmount(): void {
		this.canvas?.remove();
		this.canvas = null;
		this.ctx = null;
	}
}
