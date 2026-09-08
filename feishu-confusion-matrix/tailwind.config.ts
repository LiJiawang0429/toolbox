/**
 * @file TailwindCSS 配置
 * @description 启用 NextUI 主题插件，扫描 src 下所有组件
 * @author TODO <your-github-username>
 * @date 2026-09-08
 */
import type { Config } from 'tailwindcss';
import { nextui } from '@nextui-org/react';

export default {
  content: [
    './src/**/*.{js,jsx,ts,tsx}',
    './node_modules/@nextui-org/theme/dist/components/**/*.js',
  ],
  darkMode: 'class',
  plugins: [nextui()],
} satisfies Config;
