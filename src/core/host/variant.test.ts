import { describe, expect, it } from 'vitest';
import { MIN_CELL_OTHER_PX, MIN_CELL_PHONE_PX, availableVariants, effectiveVariant } from './variant';

// Minesweeper のプリセット梯子。cols を持つ選択肢は「盤面幅 ÷ 列数 ≥ 閾値」で可用
const presets = [
	{ id: 'small', cols: 9 },
	{ id: 'medium', cols: 11 },
	{ id: 'large', cols: 16 },
];
const ids = (list: readonly { id: string }[]) => list.map((o) => o.id);

describe('availableVariants（AC-024, AC-055）', () => {
	it('閾値はスマホ 32 px・それ以外 24 px', () => {
		expect(MIN_CELL_PHONE_PX).toBe(32);
		expect(MIN_CELL_OTHER_PX).toBe(24);
	});

	it('AC-024: 実効幅 384 px のスマホでは 12 列以下だけ（384 / 12 = 32）', () => {
		const ladder = [
			{ id: 'a', cols: 9 },
			{ id: 'b', cols: 12 },
			{ id: 'c', cols: 13 },
		];
		expect(ids(availableVariants(ladder, 384, MIN_CELL_PHONE_PX))).toEqual(['a', 'b']);
	});

	it('iPhone 縦（盤面 358 px）では small と medium（358 / 11 = 32.5）、large は不可', () => {
		expect(ids(availableVariants(presets, 358, MIN_CELL_PHONE_PX))).toEqual(['small', 'medium']);
	});

	it('デスクトップ上限 480 px は 24 px 閾値で 3 つとも可（480 / 16 = 30）', () => {
		expect(ids(availableVariants(presets, 480, MIN_CELL_OTHER_PX))).toEqual(['small', 'medium', 'large']);
	});

	it('幅 0（未計測）はすべて可、どれも入らなければ最小の 1 つだけ', () => {
		expect(ids(availableVariants(presets, 0, MIN_CELL_PHONE_PX))).toEqual(['small', 'medium', 'large']);
		expect(ids(availableVariants(presets, 270, MIN_CELL_PHONE_PX))).toEqual(['small']);
	});

	it('cols の無い選択肢は常に可。引数の配列は変更しない', () => {
		const mixed = [{ id: 'x' }, { id: 'y', cols: 30 }];
		expect(ids(availableVariants(mixed, 100, MIN_CELL_PHONE_PX))).toEqual(['x']);
		expect(mixed).toHaveLength(2);
	});
});

describe('effectiveVariant（AC-056）', () => {
	it('保存値が可用ならそれ、無ければ最大（最後）の可用な id', () => {
		const available = availableVariants(presets, 358, MIN_CELL_PHONE_PX);
		expect(effectiveVariant(available, 'medium')).toBe('medium');
		expect(effectiveVariant(available, 'large')).toBe('medium');
		expect(effectiveVariant(available, 'nonsense')).toBe('medium');
	});
});
