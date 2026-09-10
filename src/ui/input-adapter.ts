import type { Component } from 'obsidian';
import { CSS_PREFIX, DRAG_STEP_PX, SWIPE_MIN_PX, TAP_MAX_PX } from '../constants';
import { isTap, swipeToDirection } from '../core/host/input';
import type { HostAction, InputMapper, RawInput } from '../core/host/types';

// DOM イベントを RawInput（純データ）に変え、マッパーで HostAction にする（adapter 層）。
// マッパーは進行中のゲームが差し替えられる（Blocks: Space=ドロップ、タップ=回転）。
// キーはフォーカスされた盤面だけで受け、処理したキーは preventDefault してペインのスクロールと
// Obsidian への伝播を止める。タッチはビュー全体（surface）で受ける（iPhone では盤面の外でも
// スワイプで操作できるようにするため）。抑止策3つは iPhone で検証したもの（touch-action は CSS）

/**
 * オーバーレイ内のボタンやドロップダウンに向いたイベントは横取りしない（Enter/Space/矢印を部品に渡す）。
 * instanceof HTMLElement はポップアウト（別 Window）の要素で偽になるので、closest の有無で判定する
 */
function isControl(target: EventTarget | null): boolean {
	const el = target as { closest?: (selector: string) => Element | null } | null;
	return typeof el?.closest === 'function' && el.closest('button, select, input') !== null;
}

/** メニュー表示中のオーバーレイは縦スクロールできる。そのタッチはブラウザに任せる */
function isMenuSurface(target: EventTarget | null): boolean {
	const el = target as { closest?: (selector: string) => Element | null } | null;
	return typeof el?.closest === 'function' && el.closest(`.${CSS_PREFIX}-overlay.is-menu`) !== null;
}

function isPassThrough(target: EventTarget | null): boolean {
	return isControl(target) || isMenuSurface(target);
}

export function attachInput(
	owner: Component,
	board: HTMLElement,
	surface: HTMLElement,
	map: InputMapper,
	dispatch: (action: HostAction) => void,
): void {
	owner.registerDomEvent(board, 'keydown', (e: KeyboardEvent) => {
		if (e.target !== board) return;
		const raw: RawInput = {
			kind: 'key',
			key: e.key,
			code: e.code,
			repeat: e.repeat,
			modifier: e.metaKey || e.ctrlKey || e.altKey,
		};
		// 消費判定はリピートを無視して行う: リピートで捨てられたキー（Space 長押し等）も 1.1.0 と同じく
		// 握りつぶしてスクロールさせず、修飾キー付きだけを Obsidian に通す
		if (map({ ...raw, repeat: false }) === null) return;
		e.preventDefault();
		e.stopPropagation();
		const action = map(raw);
		if (action) dispatch(action);
	});

	let start: { x: number; y: number } | null = null;
	/** ドラッグ段階の基準 x。DRAG_STEP_PX 動くごとに 1 段階進めて基準をずらす */
	let dragX = 0;
	/** このタッチで drag を dispatch したか。したなら指を離したときのタップ / スワイプ判定はしない */
	let dragged = false;

	owner.registerDomEvent(surface, 'touchstart', (e: TouchEvent) => {
		if (isPassThrough(e.target)) return;
		const t = e.touches[0];
		if (!t) return;
		start = { x: t.clientX, y: t.clientY };
		dragX = t.clientX;
		dragged = false;
		e.stopPropagation();
	});

	// passive: false でないと preventDefault が無効になり、ページがスクロールする
	owner.registerDomEvent(
		surface,
		'touchmove',
		(e: TouchEvent) => {
			if (isPassThrough(e.target)) return;
			e.preventDefault();
			e.stopPropagation();
			const t = e.touches[0];
			if (!t || !start) return;
			// 横ドラッグ: 横の動きが縦より大きいときだけ、DRAG_STEP_PX ごとに 1 段階。
			// 下スワイプ（ハードドロップ）を横ずれで潰さないための条件。使わないゲームでは map が null を返す
			const horizontal = Math.abs(t.clientX - start.x) >= Math.abs(t.clientY - start.y);
			let dx = t.clientX - dragX;
			while (horizontal && Math.abs(dx) >= DRAG_STEP_PX) {
				const action = map({ kind: 'drag', dir: dx > 0 ? 'right' : 'left' });
				if (!action) break;
				dispatch(action);
				dragged = true;
				dragX += dx > 0 ? DRAG_STEP_PX : -DRAG_STEP_PX;
				dx = t.clientX - dragX;
			}
		},
		{ passive: false },
	);

	// 着信や OS ジェスチャで中断されたタッチの開始点を捨てる（次のタッチを誤判定しない）
	owner.registerDomEvent(surface, 'touchcancel', () => {
		start = null;
	});

	owner.registerDomEvent(surface, 'touchend', (e: TouchEvent) => {
		if (isPassThrough(e.target)) {
			start = null;
			return;
		}
		const t = e.changedTouches[0];
		if (!t || !start) return;
		const dx = t.clientX - start.x;
		const dy = t.clientY - start.y;
		start = null;
		e.stopPropagation();
		// ドラッグで動かしたタッチは、離した瞬間のタップ / スワイプとして扱わない
		if (dragged) return;
		let raw: RawInput | null = null;
		if (isTap(dx, dy, TAP_MAX_PX)) {
			raw = { kind: 'tap' };
		} else {
			const dir = swipeToDirection(dx, dy, SWIPE_MIN_PX);
			if (dir) raw = { kind: 'swipe', dir };
		}
		if (!raw) return;
		const action = map(raw);
		if (action) dispatch(action);
	});
}
