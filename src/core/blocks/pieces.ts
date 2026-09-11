import type { Cell, PieceId } from './types';

// 7 形の回転状態。状態 0（スポーン向き）だけを書き、残りは箱を時計回りに回して生成する。
// 箱の中心を軸にした真の回転なので、どの状態から回しても位置が跳ばない（形だけで重複を除くと
// I/S/Z の 2 回目の回転が元の箱位置へ瞬間移動する不具合があった）。
// 同じセル集合が現れたら止める: O は 2×2 の箱なので 1 状態、他の 6 形は 4 状態。
// 公開されている回転テーブルは使わない

interface Base {
	readonly size: number;
	readonly cells: readonly Cell[];
}

const BASE: Readonly<Record<PieceId, Base>> = {
	I: { size: 4, cells: [[0, 0], [1, 0], [2, 0], [3, 0]] },
	O: { size: 2, cells: [[0, 0], [1, 0], [0, 1], [1, 1]] },
	T: { size: 3, cells: [[1, 0], [0, 1], [1, 1], [2, 1]] },
	S: { size: 3, cells: [[1, 0], [2, 0], [0, 1], [1, 1]] },
	Z: { size: 3, cells: [[0, 0], [1, 0], [1, 1], [2, 1]] },
	J: { size: 3, cells: [[0, 0], [0, 1], [1, 1], [2, 1]] },
	L: { size: 3, cells: [[2, 0], [0, 1], [1, 1], [2, 1]] },
};

/** 箱（size×size）の中で時計回りに 90° 回す: (c, r) → (size - 1 - r, c) */
function rotateCw(cells: readonly Cell[], size: number): Cell[] {
	return cells.map(([c, r]) => [size - 1 - r, c] as const);
}

/** セル集合の識別子（箱の中の位置まで含めて比較する） */
function cellKey(cells: readonly Cell[]): string {
	return cells
		.map(([c, r]) => `${c},${r}`)
		.sort()
		.join(' ');
}

function orientationsOf(base: Base): readonly (readonly Cell[])[] {
	const out: (readonly Cell[])[] = [];
	const seen = new Set<string>();
	let cur = base.cells;
	for (let i = 0; i < 4; i += 1) {
		const key = cellKey(cur);
		if (seen.has(key)) break;
		seen.add(key);
		out.push(cur);
		cur = rotateCw(cur, base.size);
	}
	return out;
}

/** 形ごとの回転状態の一覧。index 0 がスポーン向き、以降は時計回り */
export const PIECES: Readonly<Record<PieceId, readonly (readonly Cell[])[]>> = {
	I: orientationsOf(BASE.I),
	O: orientationsOf(BASE.O),
	T: orientationsOf(BASE.T),
	S: orientationsOf(BASE.S),
	Z: orientationsOf(BASE.Z),
	J: orientationsOf(BASE.J),
	L: orientationsOf(BASE.L),
};

export function orientationCount(piece: PieceId): number {
	return PIECES[piece].length;
}

/** 回転箱の一辺。壁蹴りの最大幅（size - 1）に使う */
export function boxSize(piece: PieceId): number {
	return BASE[piece].size;
}

/** 原点 (x, y) に置いたときの絶対座標 */
export function cellsOf(piece: PieceId, rotation: number, x: number, y: number): Cell[] {
	const cells = PIECES[piece][rotation] ?? PIECES[piece][0] ?? [];
	return cells.map(([c, r]) => [c + x, r + y] as const);
}
