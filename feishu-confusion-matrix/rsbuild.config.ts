/**
 * @file rsbuild 构建配置
 * @description 使用 Rsbuild + React 插件搭建，集成 TailwindCSS / PostCSS / Autoprefixer
 * @author TODO <your-github-username>
 * @date 2026-09-08
 */
import { defineConfig } from "@rsbuild/core";
import { pluginReact } from "@rsbuild/plugin-react";

export default defineConfig({
  plugins: [pluginReact()],
  source: {
    entry: {
      index: './src/entry.tsx',
    },
  },
  tools: {
    postcss: {
      postcssOptions: {
        plugins: [
          require('tailwindcss'),
          require('autoprefixer'),
        ],
      },
    },
  },
});
