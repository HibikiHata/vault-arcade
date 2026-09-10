import obsidianmd from 'eslint-plugin-obsidianmd';
import globals from 'globals';
import { globalIgnores, defineConfig } from 'eslint/config';

export default defineConfig(
	globalIgnores([
		'node_modules',
		'dist',
		'esbuild.config.mjs',
		'version-bump.mjs',
		'versions.json',
		'main.js',
		'package.json',
		'package-lock.json',
		'tsconfig.json',
	]),
	{
		languageOptions: {
			globals: {
				...globals.browser,
			},
			parserOptions: {
				projectService: {
					allowDefaultProject: ['eslint.config.mts', 'vitest.config.ts', 'manifest.json'],
				},
				tsconfigRootDir: import.meta.dirname,
				extraFileExtensions: ['.json'],
			},
		},
	},
	...obsidianmd.configs.recommended,
	{
		// 製品名 "Vault Arcade" は固有名詞として大文字を保つ（sentence-case ルールの許可リスト）
		rules: {
			'obsidianmd/ui/sentence-case': ['warn', { brands: ['Vault Arcade'] }],
		},
	},
	{
		// core 層は Obsidian API に依存しない（src/core は 'obsidian' を import しない）。
		// 将来 PWA 等で再利用するため、違反はレビューではなく lint で機械的に止める
		files: ['src/core/**/*.ts'],
		rules: {
			'no-restricted-imports': [
				'error',
				{
					paths: [
						{
							name: 'obsidian',
							message:
								'src/core/ は Obsidian API に依存しない層です。Obsidian に触る処理は src/main.ts 等の adapter 側へ置いてください。',
						},
					],
				},
			],
		},
	},
);
