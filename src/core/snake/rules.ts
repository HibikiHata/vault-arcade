import type { Direction, Point, Rng } from '../host/types';
import type { SnakeAction, SnakeState } from './types';

// Snake のルール。純関数のみで、時間・DOM・乱数（rng 以外）に依存しない

const INITIAL_LENGTH = 3;
const MAX_QUEUE = 2;

const DELTA: Record<Direction, Point> = {
	up: { x: 0, y: -1 },
	down: { x: 0, y: 1 },
	left: { x: -1, y: 0 },
	right: { x: 1, y: 0 },
};

const OPPOSITE: Record<Direction, Direction> = {
	up: 'down',
	down: 'up',
	left: 'right',
	right: 'left',
};

export function isOpposite(a: Direction, b: Direction): boolean {
	return OPPOSITE[a] === b;
}

function same(a: Point, b: Point): boolean {
	return a.x === b.x && a.y === b.y;
}

function key(p: Point): string {
	return `${p.x},${p.y}`;
}

/**
 * 体を避けた空きセルから rng で1つ選ぶ。空きセルは行優先（y 外側・x 内側）で番号付けする。
 * 空きが無ければ null（= 盤面を埋め尽くした）
 */
export function placeFood(cols: number, rows: number, body: readonly Point[], rng: Rng): Point | null {
	const occupied = new Set(body.map(key));
	const free: Point[] = [];
	for (let y = 0; y < rows; y += 1) {
		for (let x = 0; x < cols; x += 1) {
			if (!occupied.has(`${x},${y}`)) free.push({ x, y });
		}
	}
	if (free.length === 0) return null;
	const idx = Math.min(free.length - 1, Math.max(0, Math.floor(rng() * free.length)));
	return free[idx] ?? null;
}

/** 長さ3・中央・右向きの idle 状態 */
export function init(cols: number, rows: number, rng: Rng): SnakeState {
	const cx = Math.floor(cols / 2);
	const cy = Math.floor(rows / 2);
	const body: Point[] = [];
	for (let i = 0; i < INITIAL_LENGTH; i += 1) body.push({ x: cx - i, y: cy });
	return {
		phase: 'idle',
		cols,
		rows,
		body,
		dir: 'right',
		queue: [],
		food: placeFood(cols, rows, body, rng),
		score: 0,
	};
}

function fresh(state: SnakeState, rng: Rng, running: boolean): SnakeState {
	const s = init(state.cols, state.rows, rng);
	return running ? { ...s, phase: 'running' } : s;
}

/** 入力を状態に適用する。phase に合わない入力は無視して同じ状態を返す */
export function input(state: SnakeState, action: SnakeAction, rng: Rng): SnakeState {
	switch (action.type) {
		case 'start':
		case 'restart':
			if (state.phase === 'idle') return { ...state, phase: 'running' };
			if (state.phase === 'over' || state.phase === 'won') return fresh(state, rng, true);
			// paused からの restart はやり直し、start は無視（Enter を誤って押しても消えない）
			return action.type === 'restart' ? fresh(state, rng, true) : state;
		case 'quit':
			return state.phase === 'idle' ? state : fresh(state, rng, false);
		case 'continue':
			// Keep playing は 2048 用。Snake には該当する状態が無い
			return state;
		case 'rotate':
		case 'drop':
			// Blocks 用。Snake には回転もドロップも無い
			return state;
		case 'cell':
			// Minesweeper 用
			return state;
		case 'pause':
			return state.phase === 'running' ? { ...state, phase: 'paused' } : state;
		case 'resume':
			return state.phase === 'paused' ? { ...state, phase: 'running' } : state;
		case 'toggle-pause':
			if (state.phase === 'running') return { ...state, phase: 'paused' };
			if (state.phase === 'paused') return { ...state, phase: 'running' };
			return state;
		case 'turn': {
			if (state.phase !== 'running') return state;
			// 検証の基準は「最後にキューされた方向」。無ければ現在の方向（AC-007）
			const last = state.queue[state.queue.length - 1] ?? state.dir;
			if (action.dir === last || isOpposite(action.dir, last)) return state;
			if (state.queue.length >= MAX_QUEUE) return state;
			return { ...state, queue: [...state.queue, action.dir] };
		}
	}
}

/**
 * 1 tick 進める。判定順: 新しい頭 → 餌か（成長）→ 占有集合（成長なら全身、そうでなければ尾を除く）
 * → 壁・占有セルなら over → 移動。尾のセルは同じ tick で空くので、食べない限り入れる
 */
export function step(state: SnakeState, rng: Rng): SnakeState {
	if (state.phase !== 'running') return state;
	const head = state.body[0];
	if (!head) return state;

	const queued = state.queue[0];
	const dir = queued ?? state.dir;
	const queue = queued ? state.queue.slice(1) : state.queue;
	const delta = DELTA[dir];
	const next: Point = { x: head.x + delta.x, y: head.y + delta.y };

	const eats = state.food !== null && same(next, state.food);
	const occupied = eats ? state.body : state.body.slice(0, -1);
	const outside = next.x < 0 || next.y < 0 || next.x >= state.cols || next.y >= state.rows;
	if (outside || occupied.some((c) => same(c, next))) {
		return { ...state, phase: 'over', dir, queue };
	}

	const body = eats ? [next, ...state.body] : [next, ...state.body.slice(0, -1)];
	if (!eats) return { ...state, body, dir, queue };

	const score = state.score + 1;
	const food = placeFood(state.cols, state.rows, body, rng);
	if (food === null) return { ...state, phase: 'won', body, dir, queue, food: null, score };
	return { ...state, body, dir, queue, food, score };
}
