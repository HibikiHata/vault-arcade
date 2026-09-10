import type { Rng } from '../host/types';
import { PIECE_IDS, type PieceId } from './types';

// 7 種を 1 巡ずつ出す bag。純乱数だと同じ形が続いて理不尽に感じるため（プレビュー無しでは特に）

/** PIECE_IDS の順から Fisher–Yates（i = 6..1、j = floor(rng() * (i + 1))）で 6 回の乱数を消費して並べ替える */
export function refill(rng: Rng): PieceId[] {
	const bag = [...PIECE_IDS];
	for (let i = bag.length - 1; i >= 1; i -= 1) {
		const j = Math.floor(rng() * (i + 1));
		const a = bag[i];
		const b = bag[j];
		if (a !== undefined && b !== undefined) {
			bag[i] = b;
			bag[j] = a;
		}
	}
	return bag;
}

/**
 * 先頭を取り出し、残りを返す。空なら補充してから取り、取ったあと空になれば直ちに補充する。
 * したがって返る bag は常に 1〜7 個で、bag[0] が「次のピース」として表示できる
 */
export function draw(bag: readonly PieceId[], rng: Rng): { piece: PieceId; bag: PieceId[] } {
	const source = bag.length > 0 ? bag : refill(rng);
	const piece = source[0];
	if (piece === undefined) throw new Error('bag is empty after refill');
	const rest = source.slice(1);
	return { piece, bag: rest.length > 0 ? rest : refill(rng) };
}
