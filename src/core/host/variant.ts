// ゲームごとの選択肢（バリアント）の可用性判定（AC-024 / AC-055）。純関数で、core/settings に依存しない

/** スマホでは 1 セル 32 px 以上、それ以外は 24 px 以上（WCAG 2.5.8 の下限）を求める */
export const MIN_CELL_PHONE_PX = 32;
export const MIN_CELL_OTHER_PX = 24;

interface SizedOption {
	readonly id: string;
	/** 盤面の列数。無ければ幅に関係なく可用 */
	readonly cols?: number;
}

/**
 * 盤面幅 boardWidth（CSS px）で使える選択肢。cols を持つものは「幅 ÷ 列数 ≥ minCell」のときだけ残す。
 * 幅 0 は未計測（非表示タブ等）なので全部返す。どれも入らなければ先頭（最小）を 1 つ返して空にしない
 */
export function availableVariants<T extends SizedOption>(
	options: readonly T[],
	boardWidth: number,
	minCell: number,
): readonly T[] {
	if (boardWidth <= 0) return options;
	const ok = options.filter((o) => o.cols === undefined || boardWidth / o.cols >= minCell);
	if (ok.length > 0) return ok;
	const first = options[0];
	return first ? [first] : [];
}

/** 保存された id が可用ならそれ、無ければ可用なものの最後（最大）。可用が空なら保存値をそのまま返す */
export function effectiveVariant(available: readonly { readonly id: string }[], stored: string): string {
	if (available.some((o) => o.id === stored)) return stored;
	const last = available[available.length - 1];
	return last ? last.id : stored;
}
