import path from "node:path";
import { defineConfig } from "vite";

// Vite 极限压缩配置（可选）
// - 目标：给“部署者”提供一条可选的极限压缩路径（minify + tree-shaking）
// - 注意：本项目默认仍采用“无构建、可直接静态托管”的交付方式；该构建产物不会被运行时强制依赖
export default defineConfig({
  build: {
    outDir: "dist",
    emptyOutDir: true,
    target: "es2019",
    sourcemap: false,

    // 只输出一份 CSS（减少请求数）
    cssCodeSplit: false,

    // Library 模式：输出 IIFE，便于作为普通 <script src="..."> 引入（不强制模块化部署）
    lib: {
      entry: path.resolve("src/bundle.mjs"),
      name: "GKB",
      formats: ["iife"],
      fileName: () => "gkb.min.js",
    },

    // 依赖最小化：使用内置 esbuild 压缩（避免额外 terser 依赖）
    // 说明：极少数场景下 terser 可能进一步缩小体积；但本项目优先“零运行时依赖 + 工具链轻量”。
    minify: "esbuild",

    rollupOptions: {
      treeshake: {
        moduleSideEffects: "no-external",
        propertyReadSideEffects: false,
        tryCatchDeoptimization: false,
      },
      output: {
        compact: true,
        assetFileNames: (assetInfo) => {
          const name = String(assetInfo.name || "");
          if (name.endsWith(".css")) return "gkb.min.css";
          return "asset-[hash][extname]";
        },
      },
    },
  },
});
