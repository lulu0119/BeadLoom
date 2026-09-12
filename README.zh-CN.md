<p align="center">
  <img src="./apps/web/public/android-chrome-192x192.png" width="96" alt="豆织工坊标志" />
</p>

<h1 align="center">豆织工坊</h1>

<p align="center">
  BeadLoom — 对着拼豆图纸说话，再用手工工具继续改。
</p>

<p align="center">
  <a href="./README.md">English</a>
  ·
  <a href="#豆织工坊是什么">豆织工坊是什么？</a>
  ·
  <a href="#本地体验">本地体验</a>
  ·
  <a href="#开发">开发</a>
</p>

<p align="center">
  <img alt="Next.js" src="https://img.shields.io/badge/Next.js-16-black" />
  <img alt="React" src="https://img.shields.io/badge/React-19-61dafb" />
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-ready-3178c6" />
</p>

## 豆织工坊是什么？

豆织工坊（BeadLoom）是以代理为入口的拼豆图纸编辑器。打开就是 32×32 空白图纸和对话。直接说想画什么，或把照片拖进输入框——代理用的绘制工具与人手工具相同。

图库、尺寸、调色板和撤销仍由人来操作。图纸保存在本机浏览器。

## 本地体验

```bash
pnpm install
pnpm dev
```

然后打开 Next.js 在终端中输出的本地地址。模型设置（接口地址、模型、API 密钥）在应用内的设置面板。

## 开发

这个仓库是 pnpm workspace。Web 应用位于 `apps/web`，共享包位于 `packages/*`。

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```
