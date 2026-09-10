import { PluginSettingTab, type SettingDefinitionItem } from 'obsidian';
import { DEFAULT_SETTINGS, type PluginSettings } from './core/settings';

// 設定タブ（adapter 層）。Obsidian 1.13 の宣言的設定 API を使う。
// 値の読み書きは基底クラスが this.plugin.settings に対して行い data.json へ永続化する
export class SettingTab extends PluginSettingTab {
	getSettingDefinitions(): SettingDefinitionItem<keyof PluginSettings>[] {
		return [
			{
				name: 'Speed',
				desc: 'Tick speed for the Snake and Blocks games.',
				control: {
					type: 'dropdown',
					key: 'speed',
					defaultValue: DEFAULT_SETTINGS.speed,
					options: { slow: 'Slow', normal: 'Normal', fast: 'Fast' },
				},
			},
			{
				name: 'Board',
				desc: 'Minesweeper board preset. The menu hides presets whose cells would be too small for the pane.',
				control: {
					type: 'dropdown',
					key: 'minesweeperPreset',
					defaultValue: DEFAULT_SETTINGS.minesweeperPreset,
					options: { small: '9×9, 10 mines', medium: '11×11, 18 mines', large: '16×16, 40 mines' },
				},
			},
		];
	}
}
