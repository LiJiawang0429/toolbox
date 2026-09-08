# 飞书混淆矩阵可视化 (Feishu Confusion Matrix)

> 一个纯前端单页应用，把任意分类模型的「真实标签 vs 预测标签」表格数据粘贴进来，即可一键生成混淆矩阵热力图与完整分类指标（Accuracy / Precision / Recall / F1 / 宏平均 / 加权平均）。

专为 ML 评估场景设计，最常用的输入是「从飞书表格 Ctrl+C 复制下来的二列数据」，零配置、无需上传、本地浏览器解析。

纯个人兴趣项目，不涉及任何公司代码或敏感信息。

---

## 项目列表

| 项目名 | 一句话说明 | 技术栈 | 状态 |
|-|-|-|-|
| [feishu-confusion-matrix](.) | 飞书表格 → 混淆矩阵热力图 + 分类指标 | React 18 / TypeScript / Rsbuild / TailwindCSS / NextUI | ✅ 可用 |

---

## 功能特性

- 📋 **多格式数据输入**：CSV / TSV / JSON / 纯文本表格，自动识别
- 🪄 **智能猜列**：根据列名（actual / predicted / 真实 / 预测 …）自动映射真实列与预测列
- 🎨 **热力图矩阵**：对角线（正确预测）绿色、其余按选定颜色方案渐变，支持蓝/绿/红/紫四套配色
- 🔄 **拖拽排序**：直接拖动行列标题调整类别顺序，所见即所得
- 📊 **完整指标**：Accuracy + 各类别 Precision / Recall / F1 + 宏平均 / 加权平均，可切换卡片视图与表格视图
- 🧮 **行列总计**：可开关行 / 列 / 总样本数显示
- 🪶 **零后端**：纯前端，所有计算在浏览器本地完成，数据不外发

## 技术栈

| 类别 | 选型 |
|-|-|
| 框架 | React 18 + TypeScript |
| 构建 | Rsbuild（基于 Rspack） |
| 样式 | TailwindCSS 3 + PostCSS / Autoprefixer |
| UI 库 | NextUI 2 + Framer Motion |
| 字体 | Inter（Google Fonts CDN） |

## 快速开始

### 环境要求

- Node.js ≥ 18
- npm ≥ 9（或 pnpm / yarn 均可）

### 安装与本地开发

```bash
# 1. 安装依赖
npm install

# 2. 启动开发服务器（默认 http://localhost:3000，自动打开浏览器）
npm run dev

# 3. 生产构建（产物输出到 dist/）
npm run build

# 4. 本地预览生产构建
npm run preview
```

### 使用流程

1. **粘贴数据**：在飞书表格选中两列（真实标签 + 预测标签），`Ctrl+C` 复制，粘贴到左侧输入框；系统自动解析。
   - 也支持拖拽 / 选择 `.csv` / `.tsv` / `.json` / `.txt` 文件
   - 或点击「示例」按钮加载内置三分类（猫 / 狗 / 鸟）样本
2. **确认列映射**：左侧「列映射配置」会自动猜测真实列与预测列，必要时手动修正下拉框。
3. **生成矩阵**：点击「生成混淆矩阵」按钮，右侧立即出现热力图与指标。
4. **调整显示**：左侧「显示设置」面板可切换颜色方案、显示数值 / 百分比 / 行列总计、调整单元格大小。
5. **拖拽排序**：直接拖动矩阵的行标题或列标题，可重新排列类别顺序；点击右上角「重置顺序」恢复字母序。

### 数据格式示例

#### CSV

```csv
actual,predicted
猫,猫
猫,狗
狗,狗
鸟,猫
```

#### TSV（飞书表格复制默认格式）

```text
actual	predicted
猫	猫
猫	狗
狗	狗
```

#### JSON

```json
[
  {"actual": "猫", "predicted": "猫"},
  {"actual": "猫", "predicted": "狗"}
]
```

> 列名无需固定为 `actual` / `predicted`，系统会智能识别含 `actual / true / label / 真实 / 标签` 的列为真实列，含 `predicted / pred / 预测 / 结果 / 模型` 的列为预测列；若无法匹配，则默认取前两列。

## 部署

### 静态托管（推荐）

本项目构建后是纯静态资源，可直接托管到任意静态服务器：

```bash
npm run build
# 产物在 dist/ 目录，包含 index.html + 静态资源
```

常见托管方式：

| 平台 | 命令 / 说明 |
|-|-|
| GitHub Pages | 把 `dist/` 推到 `gh-pages` 分支，或用 Actions 自动部署 |
| Netlify / Vercel | 连接仓库，Build command 填 `npm run build`，Publish directory 填 `dist` |
| Nginx | 把 `dist/` 拷贝到 web root，配置 SPA fallback 即可 |
| 本地预览 | `npm run preview` 启动 Rsbuild 内置预览服务器 |

### Docker（可选）

如需容器化部署，可参考以下 Dockerfile（基于 nginx 稳定镜像）：

```dockerfile
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

构建并运行：

```bash
docker build -t feishu-confusion-matrix .
docker run -p 8080:80 feishu-confusion-matrix
# 访问 http://localhost:8080
```

## 目录结构

```text
feishu-confusion-matrix/
├── src/
│   ├── components/                # UI 组件
│   │   ├── ColumnMappingPanel.tsx        # 列映射配置面板
│   │   ├── ConfigPanel.tsx               # 显示设置面板（颜色 / 单元格大小 等）
│   │   ├── ConfusionMatrixHeatmap.tsx    # 混淆矩阵热力图（支持拖拽排序）
│   │   ├── DataInputPanel.tsx            # 数据输入面板（粘贴 / 拖拽 / 文件 / 示例）
│   │   └── MetricsPanel.tsx              # 分类指标面板（卡片 + 表格）
│   ├── types/
│   │   └── index.ts                      # 全局类型定义
│   ├── utils/
│   │   ├── dataParser.ts                 # 数据解析（CSV / TSV / JSON / 智能猜列）
│   │   └── matrixCalculator.ts           # 混淆矩阵与指标计算
│   ├── App.tsx                           # 应用根组件
│   ├── entry.tsx                         # 应用入口（挂载 React）
│   ├── entry.css                         # Tailwind 入口
│   └── global.css                        # 全局样式（飞书品牌色 / 滚动条 / 动画）
├── package.json
├── rsbuild.config.ts                     # Rsbuild 构建配置
├── tailwind.config.ts                    # TailwindCSS 配置
├── postcss.config.js                     # PostCSS 配置
├── tsconfig.json                         # TypeScript 配置
├── .gitignore
└── README.md
```

## 核心模块说明

| 模块 | 职责 |
|-|-|
| [`utils/dataParser.ts`](./src/utils/dataParser.ts) | 多格式自动识别 + 单行 CSV 引号解析 + 列名智能猜测 + 数据校验 |
| [`utils/matrixCalculator.ts`](./src/utils/matrixCalculator.ts) | 混淆矩阵构建 + Precision / Recall / F1 / Accuracy / 宏平均 / 加权平均计算 + 热力图颜色函数 |
| [`components/ConfusionMatrixHeatmap.tsx`](./src/components/ConfusionMatrixHeatmap.tsx) | 热力图渲染、行列总计、标签拖拽排序、对角线特殊着色 |
| [`components/MetricsPanel.tsx`](./src/components/MetricsPanel.tsx) | 指标双视图：整体卡片 + 各类别表格（带阈值配色提示） |

## 许可证

MIT License — 自由使用、修改与分发。
