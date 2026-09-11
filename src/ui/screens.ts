import { ButtonComponent, DropdownComponent } from 'obsidian';
import { CSS_PREFIX } from '../constants';
import type { PrefKey, Speed } from '../core/settings';
import type { GameId, VariantOption } from './games/types';

// オーバーレイ画面（S-01 / S-03 / S-04）。Obsidian の部品を使い、色やサイズは CSS クラスで指定する

export interface MenuEntry {
	readonly id: GameId;
	readonly title: string;
	readonly best: number;
	/** 速度設定を使う（tick ゲーム: Snake, Blocks）。セレクタは 1 つでメニュー上部に置く（設定は 1 つ） */
	readonly hasSpeed: boolean;
	/** ゲーム固有の選択肢（Minesweeper のプリセット）。options は現在の盤面幅で可用なものだけ */
	readonly variant?: {
		readonly settingKey: PrefKey;
		readonly label: string;
		readonly options: readonly VariantOption[];
		readonly value: string;
	};
}

export type ScreenModel =
	| { kind: 'menu'; entries: readonly MenuEntry[]; speed: Speed }
	| { kind: 'paused' }
	| { kind: 'result'; won: boolean; score: number; best: number; isNewHigh: boolean; canContinue: boolean };

// ハンドラは関数プロパティにする（ボタンにそのまま渡すので this に依存させない）
export interface ScreenHandlers {
	onPlay: (id: GameId) => void;
	onResume: () => void;
	onQuit: () => void;
	onRestart: () => void;
	onBack: () => void;
	onContinue: () => void;
	onSpeedChange: (speed: Speed) => void;
	/** ゲーム固有の選択肢が変わった（設定キーと新しい id） */
	onVariantChange: (key: PrefKey, value: string) => void;
}

const SPEED_LABELS: Record<Speed, string> = { slow: 'Slow', normal: 'Normal', fast: 'Fast' };

function isSpeedValue(v: string): v is Speed {
	return v === 'slow' || v === 'normal' || v === 'fast';
}

/** 画面モデルに応じてオーバーレイを作り直す。null（プレイ中）は隠す */
export function renderOverlay(overlay: HTMLElement, model: ScreenModel | null, h: ScreenHandlers): void {
	overlay.empty();
	overlay.toggleClass('is-hidden', model === null);
	overlay.toggleClass(`${CSS_PREFIX}-overlay--dim`, model?.kind === 'paused');
	// メニューはエントリの数だけ高くなり盤面より高くなりうるので、このときだけ縦スクロールを許す（CSS と input-adapter が参照）
	overlay.toggleClass('is-menu', model?.kind === 'menu');
	if (!model) return;

	const controls = (parent: HTMLElement = overlay): HTMLElement => parent.createDiv({ cls: `${CSS_PREFIX}-controls` });

	if (model.kind === 'menu') {
		// 見出しは置かない（HUD のタイトルが Vault Arcade を出している）
		// 速度は 1 つの設定。tick ゲームが 1 つでもあれば、エントリごとではなく上部に 1 行だけ出す
		const speedGames = model.entries.filter((entry) => entry.hasSpeed).map((entry) => entry.title);
		if (speedGames.length > 0) {
			const speedRow = overlay.createDiv({ cls: `${CSS_PREFIX}-speed` });
			speedRow.createSpan({ text: `Speed (${speedGames.join(', ')})` });
			const speedDropdown = new DropdownComponent(speedRow)
				.addOptions(SPEED_LABELS)
				.setValue(model.speed)
				.onChange((v) => {
					if (isSpeedValue(v)) h.onSpeedChange(v);
				});
			speedDropdown.selectEl.setAttr('data-setting', 'speed');
		}
		const list = overlay.createDiv({ cls: `${CSS_PREFIX}-menu` });
		// どのゲームも対等: 主ボタン（アクセント色）にはしない（先頭を強調して Enter の既定にすると、
		// iPhone で常に Snake だけが紫になるので廃止）
		for (const entry of model.entries) {
			const row = list.createDiv({ cls: `${CSS_PREFIX}-menu-entry` });
			const text = row.createDiv({ cls: `${CSS_PREFIX}-menu-text` });
			text.createEl('strong', { text: entry.title });
			text.createSpan({ cls: `${CSS_PREFIX}-menu-best`, text: `Best: ${entry.best}` });
			const variant = entry.variant;
			if (variant) {
				// ゲーム固有の選択肢（Minesweeper の盤面プリセット）。可用なものだけを並べる（AC-055）。
				// 行を 1 列に保つため文字ラベルは置かず、セレクタ自体にラベルを付ける
				const holder = row.createDiv({ cls: `${CSS_PREFIX}-menu-variant` });
				const options: Record<string, string> = {};
				for (const o of variant.options) options[o.id] = o.label;
				const dropdown = new DropdownComponent(holder)
					.addOptions(options)
					.setValue(variant.value)
					.onChange((v) => h.onVariantChange(variant.settingKey, v));
				dropdown.selectEl.setAttr('data-setting', variant.settingKey);
				dropdown.selectEl.setAttr('aria-label', variant.label);
				dropdown.selectEl.setAttr('title', variant.label);
			}
			new ButtonComponent(controls(row)).setButtonText('Play').onClick(() => h.onPlay(entry.id));
		}
		return;
	}

	if (model.kind === 'paused') {
		overlay.createEl('h3', { text: 'Paused' });
		const c = controls();
		new ButtonComponent(c).setButtonText('Resume').setCta().onClick(h.onResume);
		new ButtonComponent(c).setButtonText('Quit').onClick(h.onQuit);
		return;
	}

	overlay.createEl('h3', { text: model.won ? 'You won' : 'Game over' });
	overlay.createEl('p', { text: `Score: ${model.score}` });
	overlay.createEl('p', { text: `Best: ${model.best}` });
	if (model.isNewHigh) overlay.createEl('p', { cls: `${CSS_PREFIX}-newhigh`, text: 'New high score' });
	const c = controls();
	if (model.won && model.canContinue) {
		new ButtonComponent(c).setButtonText('Keep playing').setCta().onClick(h.onContinue);
		new ButtonComponent(c).setButtonText('Restart').onClick(h.onRestart);
	} else {
		new ButtonComponent(c).setButtonText('Restart').setCta().onClick(h.onRestart);
	}
	new ButtonComponent(c).setButtonText('Back').onClick(h.onBack);
}
