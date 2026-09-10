// テーマ色の解決（adapter 層）。Canvas は CSS 変数を直接使えないため、描画前に計算済みの値へ変換する。
// 色の直書きはしない。変数が無いテーマでは --text-normal / --background-primary、
// それも無ければ CSS のシステム色（CanvasText / Canvas）に落とす

export interface Palette {
	readonly background: string;
	readonly grid: string;
	readonly snake: string;
	readonly head: string;
	readonly food: string;
	readonly text: string;
	/** 補助テキスト（Blocks の Level / Lines）。--text-muted、無ければ text */
	readonly muted: string;
}

export function readPalette(el: HTMLElement): Palette {
	const cs = getComputedStyle(el);
	const read = (name: string, fallback: string): string => cs.getPropertyValue(name).trim() || fallback;
	const fg = read('--text-normal', 'CanvasText');
	const bg = read('--background-primary', 'Canvas');
	return {
		background: read('--background-secondary', bg),
		grid: read('--background-modifier-border', fg),
		snake: read('--interactive-accent', fg),
		head: read('--text-accent', fg),
		food: read('--color-red', fg),
		text: fg,
		muted: read('--text-muted', fg),
	};
}
