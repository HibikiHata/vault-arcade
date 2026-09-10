import { describe, expect, it } from 'vitest';
import { draw, refill } from './bag';
import { lcg, seq } from './testing';
import { PIECE_IDS } from './types';

describe('bag: 7 種を 1 巡ずつ出す（AC-041）', () => {
	it('乱数が常に 0 なら Fisher–Yates（i = 6..1 で swap(i, 0)）の手計算どおりの順になる', () => {
		expect(refill(seq([0]))).toEqual(['O', 'T', 'S', 'Z', 'J', 'L', 'I']);
	});

	it('乱数が常に 1 に近ければ入れ替えは起きず、定義順のまま', () => {
		expect(refill(seq([0.999]))).toEqual(['I', 'O', 'T', 'S', 'Z', 'J', 'L']);
	});

	it('補充 1 回で乱数を 6 回だけ消費する', () => {
		let calls = 0;
		refill(() => {
			calls += 1;
			return 0.5;
		});
		expect(calls).toBe(6);
	});

	it('draw は bag[0] を取り、残りを返す。空なら補充してから取る', () => {
		let calls = 0;
		const rng = () => {
			calls += 1;
			return 0;
		};
		const d1 = draw(['T', 'S'], rng);
		expect(d1).toEqual({ piece: 'T', bag: ['S'] });
		expect(calls).toBe(0);
		const d2 = draw([], rng);
		expect(d2.piece).toBe('O');
		expect(d2.bag).toEqual(['T', 'S', 'Z', 'J', 'L', 'I']);
		expect(calls).toBe(6);
	});

	it('最後の 1 個を取ったら直ちに補充し、bag が空で返ることはない（次のピース表示のため）', () => {
		let calls = 0;
		const rng = () => {
			calls += 1;
			return 0;
		};
		const d = draw(['L'], rng);
		expect(d.piece).toBe('L');
		expect(d.bag).toEqual(['O', 'T', 'S', 'Z', 'J', 'L', 'I']);
		expect(calls).toBe(6);
	});

	it('連続 7 個・14 個はそれぞれ 7 種の順列（種ごとに 1 回ずつ）', () => {
		const rng = lcg(42);
		let bag: readonly string[] = [];
		const pieces: string[] = [];
		for (let i = 0; i < 70; i += 1) {
			const d = draw(bag as never, rng);
			pieces.push(d.piece);
			bag = d.bag;
		}
		for (let start = 0; start < 70; start += 7) {
			const window = pieces.slice(start, start + 7).sort();
			expect(window).toEqual([...PIECE_IDS].sort());
		}
	});
});
