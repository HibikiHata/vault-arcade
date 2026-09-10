import { Notice, Plugin, type WorkspaceLeaf } from 'obsidian';
import { COMMAND_OPEN, ICON, VIEW_TYPE } from './constants';
import {
	DEFAULT_SETTINGS,
	isMinesweeperPreset,
	isSpeed,
	mergeHighScore,
	mergeHighScores,
	mergeSettings,
	normalizeSettings,
	withPrefsFrom,
	type HighScoreKey,
	type PluginSettings,
	type PrefKey,
	type Speed,
} from './core/settings';
import { SettingTab } from './settings';
import { VaultArcadeView } from './ui/arcade-view';

// プラグイン本体（adapter 層の入口）。lifecycle・登録・設定と成績の永続化を持つ。
// ビューへの参照は保持せず、必要なときに workspace から探す（obsidianmd の規約）
export default class VaultArcadePlugin extends Plugin {
	settings!: PluginSettings;
	/** 読込ごとに変わる id。ビューの保存状態が同じセッションのものかを判定する */
	readonly sessionId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
	/** 直前の保存が失敗して、メモリとディスクがずれている可能性がある */
	private unsaved = false;
	/** 設定の読み書きを1本に直列化する待ち行列。Sync 由来の再読込とローカル保存が交錯しないようにする */
	private settingsQueue: Promise<unknown> = Promise.resolve();

	async onload() {
		await this.loadSettings();
		this.registerView(VIEW_TYPE, (leaf) => new VaultArcadeView(leaf, this));
		this.addRibbonIcon(ICON, 'Open Vault Arcade', () => {
			void this.activateView();
		});
		this.addCommand({
			id: COMMAND_OPEN,
			name: 'Open',
			callback: () => {
				void this.activateView();
			},
		});
		this.addSettingTab(new SettingTab(this.app, this));
	}

	// unload でリーフを外さない（レイアウトを壊すため。Obsidian のガイドライン）
	onunload() {}

	/** 既存のタブがあればそれを表示し、無ければメインエリアに新しいタブで開く（AC-001, AC-002） */
	async activateView(): Promise<void> {
		const { workspace } = this.app;
		const existing: WorkspaceLeaf | undefined = workspace.getLeavesOfType(VIEW_TYPE)[0];
		const leaf = existing ?? workspace.getLeaf('tab');
		if (!leaf) {
			new Notice('Could not open Vault Arcade.');
			return;
		}
		if (!existing) {
			await leaf.setViewState({ type: VIEW_TYPE, active: true });
		}
		await workspace.revealLeaf(leaf);
	}

	// ---- ビュー向けの機能（ArcadeHost） ----

	getSpeed(): Speed {
		return this.settings.speed;
	}

	setSpeed(speed: Speed): Promise<void> {
		return this.setPref('speed', speed);
	}

	getPref(key: PrefKey): string {
		return this.settings[key];
	}

	/** 好みを検証して保存する。無効な値は無視（メニューは可用な選択肢しか出さないが、外から来る値も通る） */
	setPref(key: PrefKey, value: string): Promise<void> {
		return this.serialize(async () => {
			if (this.settings[key] === value && !this.unsaved) return;
			if (key === 'speed') {
				if (!isSpeed(value)) return;
				this.settings.speed = value;
			} else {
				if (!isMinesweeperPreset(value)) return;
				this.settings.minesweeperPreset = value;
			}
			await this.persist();
		});
	}

	/** 設定に触る非同期処理を順番に実行する */
	private serialize<T>(task: () => Promise<T>): Promise<T> {
		const run = this.settingsQueue.then(task, task);
		this.settingsQueue = run.then(
			() => undefined,
			() => undefined,
		);
		return run;
	}

	getHighScore(key: HighScoreKey): number {
		return this.settings[key];
	}

	/**
	 * その速度のハイスコアを更新したとき true を返す（AC-015）。保存は persist() に任せ、
	 * 前回の保存が失敗していれば新記録でなくても再保存を試みる
	 */
	submitScore(key: HighScoreKey, score: number): Promise<boolean> {
		return this.serialize(async () => {
			const merged = mergeHighScore(this.settings[key], Number.isFinite(score) ? Math.floor(score) : 0);
			const isNew = merged > this.settings[key];
			if (!isNew && !this.unsaved) return false;
			this.settings[key] = merged;
			await this.persist();
			return isNew;
		});
	}

	/**
	 * 設定を保存する唯一の経路。書く直前にディスクを読み直し、速度ごとのハイスコアを最大値でマージしてから
	 * 書く（Sync が書いた直後にメモリの古い値で上書きしない）。失敗は通知し、次の保存で再試行する
	 */
	private async persist(): Promise<void> {
		try {
			const loaded = (await this.loadData()) as Partial<PluginSettings> | null;
			const disk = normalizeSettings(mergeSettings(DEFAULT_SETTINGS, loaded));
			this.settings = mergeHighScores(this.settings, disk);
			await this.saveData(this.settings);
			this.unsaved = false;
		} catch (err) {
			this.unsaved = true;
			console.error('Vault Arcade: could not save settings', err);
			new Notice('Could not save Vault Arcade settings.');
		}
	}

	// ---- 設定の読み書き ----

	async loadSettings() {
		// loadData() は初回起動時 null。マージと正規化は core の純関数に任せ、ここでは I/O だけを行う
		const loaded = (await this.loadData()) as Partial<PluginSettings> | null;
		this.settings = normalizeSettings(mergeSettings(DEFAULT_SETTINGS, loaded));
	}

	/**
	 * data.json が Obsidian の外（Sync や他端末）から書き換えられたときに呼ばれる。
	 * ハイスコアは最大値でマージし、メモリの方が高ければ書き戻す（AC-017）
	 */
	async onExternalSettingsChange() {
		await this.serialize(async () => {
			const memory = { ...this.settings };
			await this.loadSettings();
			const disk = this.settings;
			// 好み（PREF_KEYS）は外部（他端末）の値を採り、ハイスコアはキーごとに最大値でマージする
			const merged = withPrefsFrom(disk, mergeHighScores(memory, disk));
			const dirty = JSON.stringify(merged) !== JSON.stringify(disk);
			this.settings = merged;
			if (dirty) await this.saveData(this.settings);
		});
	}
}
