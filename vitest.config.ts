import { defineConfig } from 'vitest/config';

// テスト対象は core 層だけ。Obsidian API を import するファイルは Obsidian 本体の外では
// 動かないため、adapter 側（src/main.ts・src/settings.ts）は開発用ボールトでの手動確認に委ねる
export default defineConfig({
	test: {
		include: ['src/core/**/*.test.ts'],
		environment: 'node',
	},
});
