import { HOLD_FEEDBACK_MS, LONG_PRESS_MS, TAP_MAX_PX } from '../constants';

// セル単位の入力（Minesweeper。Sudoku でも使う予定）。グリッド要素にリスナーを張り、
// タップ = 開封、長押し（LONG_PRESS_MS）= 旗、マウスの左クリック = 開封、右クリック = 旗にする。
// - タッチの開封は touchend で行い preventDefault する。ビューの adapter が touchmove を preventDefault するため
//   合成 click が来るか不安定で（W3C Touch Events）、click に頼れない。click はマウス専用
// - Android は長押しで contextmenu も発火する。タッチ進行中の contextmenu は旗にしない（二重トグル防止）
// - 時間はこの UI 層だけが見る（core は tick も時計も持たない）

export interface CellInputHandlers {
	/** イベントの target からセル index を得る。セル以外なら null */
	cellOf(target: EventTarget | null): number | null;
	onReveal(index: number): void;
	onFlag(index: number): void;
	/** 長押しの途中表示。holding=false で解除 */
	onHolding(index: number, holding: boolean): void;
}

/** リスナーを張り、外す関数を返す */
export function attachCellInput(grid: HTMLElement, h: CellInputHandlers): () => void {
	const win = grid.win;
	let touching = false;
	let touchIndex: number | null = null;
	let start: { x: number; y: number } | null = null;
	let holdTimer: number | null = null;
	let flagTimer: number | null = null;
	let flagged = false;
	let cancelled = false;
	// 直近の touchend 時刻。タッチ直後の合成 click / contextmenu を無視する。初期値は −∞（起動直後のクリックを捨てない）
	let lastTouchEnd = Number.NEGATIVE_INFINITY;

	const clearTimers = (): void => {
		if (holdTimer !== null) win.clearTimeout(holdTimer);
		if (flagTimer !== null) win.clearTimeout(flagTimer);
		holdTimer = null;
		flagTimer = null;
	};
	const stopHolding = (): void => {
		if (touchIndex !== null) h.onHolding(touchIndex, false);
	};

	const onTouchStart = (e: TouchEvent): void => {
		if (touching) {
			// 2 本目以降の指: 進行中の押下を取り消し、このタッチは無視する（押下表示を残さない）
			cancelled = true;
			clearTimers();
			stopHolding();
			return;
		}
		const t = e.touches[0];
		const index = h.cellOf(e.target);
		if (!t || index === null) return;
		touching = true;
		touchIndex = index;
		start = { x: t.clientX, y: t.clientY };
		flagged = false;
		cancelled = false;
		clearTimers();
		holdTimer = win.setTimeout(() => h.onHolding(index, true), HOLD_FEEDBACK_MS);
		flagTimer = win.setTimeout(() => {
			flagged = true;
			h.onHolding(index, false);
			h.onFlag(index);
		}, LONG_PRESS_MS);
	};
	const onTouchMove = (e: TouchEvent): void => {
		const t = e.touches[0];
		if (!t || !start || touchIndex === null || cancelled) return;
		if (Math.abs(t.clientX - start.x) >= TAP_MAX_PX || Math.abs(t.clientY - start.y) >= TAP_MAX_PX) {
			// 動かした指は何もしない（誤開封を防ぐ）
			cancelled = true;
			clearTimers();
			stopHolding();
		}
	};
	const onTouchEnd = (e: TouchEvent): void => {
		lastTouchEnd = win.performance.now();
		touching = false;
		const index = touchIndex;
		clearTimers();
		stopHolding();
		touchIndex = null;
		start = null;
		if (index === null) return;
		// 合成 click を止める（マウス経路と二重にしない）
		e.preventDefault();
		if (!flagged && !cancelled) h.onReveal(index);
	};
	const onTouchCancel = (): void => {
		touching = false;
		clearTimers();
		stopHolding();
		touchIndex = null;
		start = null;
		cancelled = true;
	};
	const onClick = (e: MouseEvent): void => {
		// タッチ直後に来た click は無視（touchend で開封済み）
		if (win.performance.now() - lastTouchEnd < LONG_PRESS_MS) return;
		const index = h.cellOf(e.target);
		if (index === null) return;
		h.onReveal(index);
	};
	const onContextMenu = (e: MouseEvent): void => {
		e.preventDefault();
		// タッチ中と、タッチ直後（Android は長押しで contextmenu も出す。発火順に依らず旗の二重トグルを防ぐ）は無視
		if (touching || win.performance.now() - lastTouchEnd < LONG_PRESS_MS) return;
		const index = h.cellOf(e.target);
		if (index === null) return;
		h.onFlag(index);
	};

	grid.addEventListener('touchstart', onTouchStart, { passive: true });
	grid.addEventListener('touchmove', onTouchMove, { passive: true });
	grid.addEventListener('touchend', onTouchEnd, { passive: false });
	grid.addEventListener('touchcancel', onTouchCancel);
	grid.addEventListener('click', onClick);
	grid.addEventListener('contextmenu', onContextMenu);
	return () => {
		clearTimers();
		stopHolding();
		grid.removeEventListener('touchstart', onTouchStart);
		grid.removeEventListener('touchmove', onTouchMove);
		grid.removeEventListener('touchend', onTouchEnd);
		grid.removeEventListener('touchcancel', onTouchCancel);
		grid.removeEventListener('click', onClick);
		grid.removeEventListener('contextmenu', onContextMenu);
	};
}
