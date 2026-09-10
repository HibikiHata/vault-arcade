import { COLS, ROWS } from './constants';

// テスト専用の補助。固定乱数列と、井戸の文字列表記（'#' = 埋まり、'.' = 空き）

/** 固定列を返す乱数。列を使い切ったら先頭に戻る */
export function seq(values: readonly number[]): () => number {
	let i = 0;
	return () => {
		const v = values[i % values.length] ?? 0;
		i += 1;
		return v;
	};
}

/** 線形合同法。ファズ用の決定的な乱数列 */
export function lcg(seed: number): () => number {
	let s = seed >>> 0;
	return () => {
		s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
		return s / 4294967296;
	};
}

/** 下から詰めた行文字列で井戸を作る。rows は上から下の順（最後の要素が最下段）。指定の無い上部は空 */
export function wellBottom(rows: readonly string[]): number[] {
	const well: number[] = new Array<number>(COLS * ROWS).fill(0);
	const top = ROWS - rows.length;
	rows.forEach((row, i) => {
		if (row.length !== COLS) throw new Error(`row must have ${COLS} chars: ${row}`);
		for (let c = 0; c < COLS; c += 1) well[(top + i) * COLS + c] = row[c] === '#' ? 1 : 0;
	});
	return well;
}

/** 井戸の下 n 行を文字列にする（上から下の順） */
export function bottomRows(well: readonly number[], n: number): string[] {
	const out: string[] = [];
	for (let r = ROWS - n; r < ROWS; r += 1) {
		let s = '';
		for (let c = 0; c < COLS; c += 1) s += well[r * COLS + c] ? '#' : '.';
		out.push(s);
	}
	return out;
}

export const EMPTY_ROW = '..........';
