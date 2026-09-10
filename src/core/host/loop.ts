// 固定タイムステップの累積器。時間そのもの（rAF・performance.now）は host 側が持ち、ここは純粋な計算だけ

export interface Advance {
	readonly acc: number;
	readonly ticks: number;
}

/**
 * 経過時間 dt を累積し、tick 間隔 interval を何回分進めるかを返す。
 * dt は maxDt でクランプする（バックグラウンド復帰時に数百 tick を一気に回さないため）。負の dt は 0
 */
export function advance(acc: number, dt: number, interval: number, maxDt = 250): Advance {
	const safeDt = Math.min(Math.max(dt, 0), maxDt);
	let total = acc + safeDt;
	let ticks = 0;
	if (interval > 0) {
		ticks = Math.floor(total / interval);
		total -= ticks * interval;
	}
	return { acc: total, ticks };
}
