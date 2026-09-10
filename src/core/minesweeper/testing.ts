// テスト専用の補助。盤面を行文字列で書く（'*' = 地雷 / 'o' = 開封 / 'F' = 旗 / '.' = それ以外）

/** 行文字列（上から下）を 0/1 配列にする。mark の文字だけ 1 */
export function cellsFrom(rows: readonly string[], mark: string): number[] {
	const out: number[] = [];
	for (const row of rows) for (const ch of row) out.push(ch === mark ? 1 : 0);
	return out;
}

/** 固定列を返す乱数 */
export function seq(values: readonly number[]): () => number {
	let i = 0;
	return () => {
		const v = values[i % values.length] ?? 0;
		i += 1;
		return v;
	};
}

/** 線形合同法（ファズ用） */
export function lcg(seed: number): () => number {
	let s = seed >>> 0;
	return () => {
		s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
		return s / 4294967296;
	};
}
