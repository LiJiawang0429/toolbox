/**
 * @file PostCSS 配置
 * @description 加载 TailwindCSS 与 Autoprefixer
 * @author TODO <your-github-username>
 * @date 2026-09-08
 */
module.exports = {
  plugins: {
    tailwindcss: {
      content: ['./src/**/*.{html,js,ts,jsx,tsx}'],
    },
    autoprefixer: {},
  },
};
