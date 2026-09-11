import { ButtonComponent, ItemView, Platform, type ViewStateResult, type WorkspaceLeaf } from 'obsidian';
import { CSS_PREFIX, ICON, MAX_FRAME_MS, VIEW_TYPE } from '../constants';
import { advance } from '../core/host/loop';
import { defaultMapInput } from '../core/host/input';
import { MIN_CELL_OTHER_PX, MIN_CELL_PHONE_PX, availableVariants, effectiveVariant } from '../core/host/variant';
import type { GameState, HostAction, RawInput, Rng } from '../core/host/types';
import { isSpeed, type HighScoreKey, type PrefKey, type Speed } from '../core/settings';
import { GameSession } from './game-session';
import { findGame, GAMES } from './games/registry';
import type { GameId, GameModule, VariantOption } from './games/types';
import { attachInput } from './input-adapter';
import { renderOverlay, type MenuEntry, type ScreenModel } from './screens';
import { readPalette } from './theme';

/** ビューが必要とするプラグイン側の機能。ビューは saveData に直接触れない */
export interface ArcadeHost {
	/** プラグイン読込ごとに変わる id。前回起動の保存状態を復元しないために使う（AC-003） */
	readonly sessionId: string;
	getSpeed(): Speed;
	setSpeed(speed: Speed): Promise<void>;
	/** 好み（PREF_KEYS）の読み書き。値の検証はプラグイン側 */
	getPref(key: PrefKey): string;
	setPref(key: PrefKey, value: string): Promise<void>;
	getHighScore(key: HighScoreKey): number;
	submitScore(key: HighScoreKey, score: number): Promise<boolean>;
}

interface SavedView {
	session?: unknown;
	game?: unknown;
	speed?: unknown;
	saved?: unknown;
}

// Vault Arcade のビュー（adapter 層）。Obsidian・DOM・時間を知る唯一の場所。
// ゲームごとの分岐は持たず、進行中のゲームは GameSession（モジュール＋状態＋レンダラ）に委ねる
export class VaultArcadeView extends ItemView {
	override navigation = true;

	private session: GameSession | null = null;
	private readonly rng: Rng = () => Math.random();
	private boardEl: HTMLElement | null = null;
	private overlayEl: HTMLElement | null = null;
	private hudTitleEl: HTMLElement | null = null;
	private hudScoreEl: HTMLElement | null = null;
	private hudBestEl: HTMLElement | null = null;
	/** HUD のボタン。tick ゲームの running/paused では Pause/Resume、結果が出た直後は Results */
	private hudActionBtn: ButtonComponent | null = null;
	/** over/won のあと結果画面を開いたか。開くまでは盤面（答え）を見せる */
	private resultShown = false;
	private liveRegionEl: HTMLElement | null = null;
	private rafId = 0;
	private loopOn = false;
	private acc = 0;
	private last = 0;
	private seqCounter = 0;
	/** メニュー描画時の可用な選択肢の集合（id の連結）。盤面幅が変わって集合が変わったらメニューを描き直す（AC-055） */
	private availabilityKey = '';
	/** onOpen より前に setState が来た場合の復元待ち */
	private pendingRestore: { module: GameModule; speed: Speed; state: GameState } | null = null;

	constructor(
		leaf: WorkspaceLeaf,
		private readonly host: ArcadeHost,
	) {
		super(leaf);
	}

	getViewType(): string {
		return VIEW_TYPE;
	}

	getDisplayText(): string {
		return 'Vault Arcade';
	}

	override getIcon(): string {
		return ICON;
	}

	// Obsidian は背景タブのビューを破棄して作り直す（deferred view）。進行中のゲームを state に退避し、
	// 同じセッション内の復元でだけ戻す。アプリ再起動後はメニューから（AC-003）
	override getState(): Record<string, unknown> {
		const s = this.session;
		return {
			session: this.host.sessionId,
			game: s ? s.module.id : null,
			speed: s ? s.speed : this.host.getSpeed(),
			saved: s ? s.module.toSaved(s.state) : null,
		};
	}

	override async setState(state: unknown, result: ViewStateResult): Promise<void> {
		await super.setState(state, result);
		if (typeof state !== 'object' || state === null) return;
		const r = state as SavedView;
		if (r.session !== this.host.sessionId) return;
		const module = findGame(r.game);
		if (!module) return;
		const restored = module.parseSaved(r.saved);
		if (!restored) return;
		const speed = isSpeed(r.speed) ? r.speed : this.host.getSpeed();
		if (this.boardEl) this.restoreSession(module, speed, restored);
		else this.pendingRestore = { module, speed, state: restored };
	}

	override async onOpen(): Promise<void> {
		const root = this.contentEl;
		root.empty();
		root.addClass(`${CSS_PREFIX}-view`);

		const hud = root.createDiv({ cls: `${CSS_PREFIX}-hud` });
		this.hudTitleEl = hud.createSpan({ text: 'Vault Arcade' });
		this.hudScoreEl = hud.createSpan({ text: '' });
		this.hudBestEl = hud.createSpan({ text: '' });
		this.hudActionBtn = new ButtonComponent(hud).setButtonText('Pause').onClick(() => {
			if (this.isResultPending()) this.showResult();
			else this.dispatch({ type: 'toggle-pause' });
			// ボタンにフォーカスが移るとキーが盤面に届かなくなるので戻す
			this.focusBoard();
		});
		this.hudActionBtn.buttonEl.addClass(`${CSS_PREFIX}-hud-pause`, 'is-hidden');

		const boardEl = root.createDiv({ cls: `${CSS_PREFIX}-board` });
		boardEl.setAttr('tabindex', '0');
		boardEl.setAttr('role', 'application');
		boardEl.setAttr('aria-label', 'Vault Arcade board');
		this.boardEl = boardEl;
		this.overlayEl = boardEl.createDiv({ cls: `${CSS_PREFIX}-overlay` });
		this.liveRegionEl = root.createDiv({ cls: `${CSS_PREFIX}-live`, attr: { 'aria-live': 'polite' } });

		// タッチはビュー全体で受ける（盤面の外をスワイプしても曲がる）。生入力の解釈は進行中のゲームに委ねる
		attachInput(
			this,
			boardEl,
			root,
			(raw) => this.mapInput(raw),
			(action) => this.dispatch(action),
		);

		this.registerEvent(this.app.workspace.on('css-change', () => this.onThemeChange()));
		this.registerEvent(
			this.app.workspace.on('active-leaf-change', (leaf) => {
				if (leaf === this.leaf) this.focusBoard();
				else this.pauseIfRunning();
			}),
		);
		// ポップアウトでも正しいウィンドウ/ドキュメントを見る
		this.registerDomEvent(this.containerEl.win, 'blur', () => this.pauseIfRunning());
		this.registerDomEvent(this.containerEl.doc, 'visibilitychange', () => {
			if (this.containerEl.doc.hidden) this.pauseIfRunning();
		});
		this.register(() => this.stopLoop());

		const observer = new ResizeObserver(() => this.fit());
		observer.observe(boardEl);
		this.register(() => observer.disconnect());

		if (this.pendingRestore) {
			const { module, speed, state } = this.pendingRestore;
			this.pendingRestore = null;
			this.restoreSession(module, speed, state);
		} else {
			this.renderAll();
		}
		// 開いた直後から盤面にフォーカスを置く（レイアウト確定後）。復元直後のゲームをすぐ操作できるようにするため
		this.app.workspace.onLayoutReady(() => this.focusBoard());
		return Promise.resolve();
	}

	override onResize(): void {
		this.fit();
	}

	override async onClose(): Promise<void> {
		this.stopLoop();
		this.session?.renderer.unmount();
		this.session = null;
		this.contentEl.empty();
		return Promise.resolve();
	}

	// ---- セッションの開始・復元・終了 ----

	private startGame(module: GameModule): void {
		this.endSession();
		const state = module.rules.init(this.rng, this.variantFor(module));
		const session = this.createSession(module, this.host.getSpeed(), state);
		const prev = session.state;
		session.input({ type: 'start' }, this.rng);
		this.afterTransition(prev, { type: 'start' });
	}

	private restoreSession(module: GameModule, speed: Speed, state: GameState): void {
		this.endSession();
		this.resultShown = false;
		const session = this.createSession(module, speed, state);
		this.renderAll();
		// tick 駆動のゲームだけループを再開する。手番駆動（2048）は入力でしか進まない
		if (session.isTick && session.state.phase === 'running') this.startLoop();
		this.focusBoard();
	}

	private createSession(module: GameModule, speed: Speed, state: GameState): GameSession {
		this.seqCounter += 1;
		const session = new GameSession(module, speed, this.seqCounter, state);
		this.session = session;
		if (this.boardEl) {
			// セル入力を発行するレンダラ（Minesweeper）のために dispatch を渡す。他のレンダラは無視する
			session.renderer.mount(this.boardEl, (action) => this.dispatch(action));
			// レンダラはオーバーレイの下に置く（overlayEl は boardEl の最後の子として残す）
			if (this.overlayEl) this.boardEl.appendChild(this.overlayEl);
			session.renderer.setPalette(readPalette(this.contentEl));
			this.boardEl.setAttr('aria-label', `${module.title} board`);
			this.fit();
		}
		return session;
	}

	private endSession(): void {
		this.stopLoop();
		if (this.session) {
			this.session.renderer.unmount();
			this.session = null;
		}
		this.boardEl?.setAttr('aria-label', 'Vault Arcade board');
	}

	// ---- 状態遷移 ----

	/** 進行中のゲームのマッピング、無ければ既定。ビューはゲーム名で分岐しない */
	private mapInput(raw: RawInput): HostAction | null {
		return (this.session?.module.mapInput ?? defaultMapInput)(raw);
	}

	private dispatch(action: HostAction): void {
		const session = this.session;
		// メニュー中はキー操作を受けない。ゲームは Play ボタン（Tab で到達）で選ぶ
		if (!session) return;
		// 結果が出た直後は盤面を見せている。Enter（start）と Restart / Quit 以外の操作は結果画面を開く
		if (this.isResultPending() && action.type !== 'start' && action.type !== 'restart' && action.type !== 'quit') {
			this.showResult();
			return;
		}
		const prev = session.state;
		const next = session.input(action, this.rng);
		if (next === prev) return;
		this.afterTransition(prev, action);
	}

	private afterTransition(prev: GameState, action: HostAction): void {
		const session = this.session;
		if (!session) return;
		const phase = session.state.phase;
		if (phase === 'running') this.resultShown = false;
		if (phase === 'idle') {
			// quit → メニューへ
			this.endSession();
			this.renderAll();
			this.focusBoard();
			return;
		}
		// 入力で得点が動いた（Blocks のハードドロップ等）ときも読み上げる。over/won は下で得点付きで読み上げる
		if (phase === 'running' && session.state.score !== prev.score) this.announce(`Score ${session.state.score}`);
		if (phase === 'running' && prev.phase !== 'running') {
			// 新しいゲーム（start / restart）か、続き（resume / continue）か
			if (action.type === 'start' || action.type === 'restart') {
				// 新しいゲーム。古い保存完了の結果を捨てられるよう通し番号を進める
				session.isNewHigh = false;
				this.seqCounter += 1;
				session.seq = this.seqCounter;
			}
			if (session.isTick) this.startLoop();
			this.focusBoard();
		} else if (phase !== 'running') {
			this.stopLoop();
		}
		if ((phase === 'over' || phase === 'won') && prev.phase === 'running') {
			this.announce(`${phase === 'won' ? 'You won' : 'Game over'}. Score ${session.state.score}`);
			const seq = session.seq;
			void this.host.submitScore(session.scoreKey, session.state.score).then((isNew) => {
				if (this.session?.seq !== seq) return; // 別のゲームが始まっていれば古い結果は捨てる
				this.session.isNewHigh = isNew;
				this.renderAll();
			});
		}
		this.renderAll();
	}

	/** tick 駆動のゲームだけを一時停止する。手番駆動（2048）はフォーカス喪失で止めない */
	private pauseIfRunning(): void {
		const s = this.session;
		if (s && s.isTick && s.state.phase === 'running') this.dispatch({ type: 'pause' });
	}

	/** phase を問わず盤面へフォーカスする。メニューでも Enter で開始できるようにするため */
	private focusBoard(): void {
		this.boardEl?.focus({ preventScroll: true });
	}

	// ---- ループ（時間はここだけが知る） ----

	private startLoop(): void {
		if (this.loopOn) return;
		this.loopOn = true;
		this.acc = 0;
		this.last = this.containerEl.win.performance.now();
		this.rafId = this.containerEl.win.requestAnimationFrame((t) => this.frame(t));
	}

	private stopLoop(): void {
		if (!this.loopOn) return;
		this.loopOn = false;
		this.containerEl.win.cancelAnimationFrame(this.rafId);
		this.rafId = 0;
	}

	private frame(now: number): void {
		const session = this.session;
		if (!this.loopOn || !session) return;
		const result = advance(this.acc, now - this.last, session.interval, MAX_FRAME_MS);
		this.acc = result.acc;
		this.last = now;
		try {
			const prev = session.state;
			for (let i = 0; i < result.ticks && session.state.phase === 'running'; i += 1) {
				session.step(this.rng);
			}
			// 終了した tick の得点は afterTransition が結果と一緒に読み上げる（二重読み上げを避ける）
			if (session.state.phase === 'running' && session.state.score !== prev.score) {
				this.announce(`Score ${session.state.score}`);
			}
			if (session.state.phase !== 'running') {
				this.afterTransition(prev, { type: 'pause' });
				return;
			}
			this.renderBoard();
		} catch (err) {
			console.error('Vault Arcade: frame error', err);
			this.stopLoop();
			this.showError();
			return;
		}
		this.rafId = this.containerEl.win.requestAnimationFrame((t) => this.frame(t));
	}

	// ---- 描画 ----

	private fit(): void {
		const boardEl = this.boardEl;
		const session = this.session;
		if (!boardEl) return;
		if (!session) {
			// メニュー表示中: 盤面幅で可用な選択肢が変わったら描き直す（回転・ペイン幅の変更）
			if (this.availabilityKey !== this.computeAvailabilityKey()) this.renderAll();
			return;
		}
		const size = boardEl.clientWidth;
		if (size <= 0) return;
		session.renderer.resize(size, this.containerEl.win.devicePixelRatio || 1);
		this.renderBoard();
	}

	// ---- ゲーム固有の選択肢（バリアント） ----

	/** セルの最小サイズ。スマホは 32 px、それ以外は 24 px（AC-055） */
	private minCellPx(): number {
		return Platform.isPhone ? MIN_CELL_PHONE_PX : MIN_CELL_OTHER_PX;
	}

	/** 現在の盤面幅で可用な選択肢。幅 0（未計測）なら全部 */
	private availableFor(module: GameModule): readonly VariantOption[] {
		if (!module.variant) return [];
		return availableVariants(module.variant.options, this.boardEl?.clientWidth ?? 0, this.minCellPx());
	}

	/** ゲーム開始時に渡すバリアント id: 保存値が可用ならそれ、無ければ最大の可用値（書き戻さない。AC-056） */
	private variantFor(module: GameModule): string | undefined {
		if (!module.variant) return undefined;
		return effectiveVariant(this.availableFor(module), this.host.getPref(module.variant.settingKey));
	}

	private computeAvailabilityKey(): string {
		return GAMES.map((g) =>
			this.availableFor(g)
				.map((o) => o.id)
				.join(','),
		).join('|');
	}

	private onThemeChange(): void {
		if (this.session && this.contentEl.isConnected) {
			this.session.renderer.setPalette(readPalette(this.contentEl));
			this.renderBoard();
		}
	}

	private renderBoard(): void {
		const session = this.session;
		if (!session) return;
		session.renderer.render(session.state);
		this.hudScoreEl?.setText(this.hudScoreText());
	}

	/** over/won の直後（結果画面を開く前）か */
	private isResultPending(): boolean {
		const phase = this.session?.state.phase;
		return (phase === 'over' || phase === 'won') && !this.resultShown;
	}

	/** 盤面を見せている状態から結果画面へ */
	private showResult(): void {
		this.resultShown = true;
		this.renderAll();
	}

	/** HUD の得点表示 */
	private hudScoreText(): string {
		const s = this.session;
		return s ? `Score: ${s.state.score}` : '';
	}

	/** HUD のタイトル欄。結果が出た直後は結果ラベルに差し替える（HUD を 1 行に収めるため） */
	private hudTitleText(): string {
		const s = this.session;
		if (!s) return 'Vault Arcade';
		if (this.isResultPending()) return s.state.phase === 'won' ? 'You won' : 'Game over';
		return s.module.title;
	}

	/** HUD の Best 欄。結果が出た直後に新記録なら ★ を添える */
	private hudBestText(): string {
		const s = this.session;
		if (!s) return '';
		const star = this.isResultPending() && s.isNewHigh ? ' ★' : '';
		return `Best: ${this.host.getHighScore(s.scoreKey)}${star}`;
	}

	private menuEntries(): MenuEntry[] {
		const speed = this.host.getSpeed();
		this.availabilityKey = this.computeAvailabilityKey();
		return GAMES.map((g) => {
			const spec = g.variant;
			const options = this.availableFor(g);
			const value = spec ? effectiveVariant(options, this.host.getPref(spec.settingKey)) : undefined;
			return {
				id: g.id,
				title: g.title,
				best: this.host.getHighScore(g.scoreKey(speed, value)),
				hasSpeed: g.tickInterval !== undefined,
				variant: spec ? { settingKey: spec.settingKey, label: spec.label, options, value: value ?? '' } : undefined,
			};
		});
	}

	private screenModel(): ScreenModel | null {
		const s = this.session;
		if (!s) return { kind: 'menu', entries: this.menuEntries(), speed: this.host.getSpeed() };
		switch (s.state.phase) {
			case 'running':
				return null;
			case 'paused':
				return { kind: 'paused' };
			case 'over':
			case 'won':
				// 結果画面は求めに応じて開く。それまでは盤面（答え）をそのまま見せる
				if (!this.resultShown) return null;
				return {
					kind: 'result',
					won: s.state.phase === 'won',
					score: s.state.score,
					best: this.host.getHighScore(s.scoreKey),
					isNewHigh: s.isNewHigh,
					canContinue: s.module.canContinue === true,
				};
			case 'idle':
				return { kind: 'menu', entries: this.menuEntries(), speed: this.host.getSpeed() };
		}
	}

	private renderAll(): void {
		const s = this.session;
		this.hudTitleEl?.setText(this.hudTitleText());
		this.hudScoreEl?.setText(this.hudScoreText());
		this.hudBestEl?.setText(this.hudBestText());
		this.renderHudButton();
		if (s) s.renderer.render(s.state);
		if (!this.overlayEl) return;
		const model = this.screenModel();
		// メニュー中は正方形の枠をやめ、内容の高さで表示する（内側スクロールを無くす）。
		// ビュー全体は縦パンを許し、adapter はメニュー上のタッチを素通しする
		const isMenu = model?.kind === 'menu';
		this.boardEl?.toggleClass('is-menu', isMenu);
		this.contentEl.toggleClass('is-menu', isMenu);
		renderOverlay(this.overlayEl, model, {
			onPlay: (id: GameId) => {
				const module = findGame(id);
				if (module) this.startGame(module);
			},
			onResume: () => this.dispatch({ type: 'resume' }),
			onQuit: () => this.dispatch({ type: 'quit' }),
			onRestart: () => this.dispatch({ type: 'restart' }),
			onBack: () => this.dispatch({ type: 'quit' }),
			onContinue: () => this.dispatch({ type: 'continue' }),
			onSpeedChange: (speed) => {
				void this.host.setSpeed(speed).then(() => this.refocusSetting('speed'));
			},
			onVariantChange: (key, value) => {
				void this.host.setPref(key, value).then(() => this.refocusSetting(key));
			},
		});
	}

	/** メニューを作り直したあと、変更した設定のドロップダウンにフォーカスを戻す */
	private refocusSetting(key: PrefKey): void {
		this.renderAll();
		this.overlayEl?.querySelector<HTMLSelectElement>(`select[data-setting="${key}"]`)?.focus();
	}

	/**
	 * HUD のボタン: tick ゲームの running / paused では Pause / Resume、
	 * 結果が出た直後（全ゲーム）は Results。それ以外は隠す
	 */
	private renderHudButton(): void {
		const btn = this.hudActionBtn;
		if (!btn) return;
		const s = this.session;
		const phase = s?.state.phase;
		const resultPending = this.isResultPending();
		const pause = s !== null && s.isTick && (phase === 'running' || phase === 'paused');
		btn.buttonEl.toggleClass('is-hidden', !(resultPending || pause));
		if (resultPending) btn.setButtonText('Results');
		else if (pause) btn.setButtonText(phase === 'running' ? 'Pause' : 'Resume');
	}

	private showError(): void {
		if (!this.overlayEl) return;
		this.overlayEl.empty();
		this.overlayEl.removeClass('is-hidden');
		this.overlayEl.createEl('h3', { text: 'Something went wrong' });
		const controls = this.overlayEl.createDiv({ cls: `${CSS_PREFIX}-controls` });
		const btn = controls.createEl('button', { text: 'Restart', cls: 'mod-cta' });
		this.registerDomEvent(btn, 'click', () => {
			const module = this.session?.module;
			if (module) this.startGame(module);
		});
	}

	private announce(text: string): void {
		this.liveRegionEl?.setText(text);
	}
}
