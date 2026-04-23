---
title: "Cobalt Strike Beacon 免杀思路整理"
description: "从 shellcode 加载器到流量特征，整理一套现代免杀的思路框架"
date: 2025-11-05
slug: cs-beacon-obfuscation
categories:
  - 红队
tags:
  - Cobalt Strike
  - 免杀
  - Shellcode
toc: true
---

## 为什么还是 CS

市面 C2 百花齐放，但业内对抗训练里 Cobalt Strike 仍然是基准。它的问题也很明显——**特征太成熟了**，各厂商检出率是最高的。

## 加载器层

- 直接 CreateThread/VirtualAlloc：基本 100% 杀
- 加回调（EnumWindows / EnumFonts / MapViewOfFile）：混过一部分静态
- Syscall 直接用：绕 Hook
- .NET Loader / Donut：换皮
- Sleep Mask：绕内存扫描

## 流量层

- Malleable Profile 必须改，别用社区公开的
- HTTPS + 合法证书
- CDN 前置 / 域前置（部分厂商已封）
- DNS Beacon 作为兜底

## 运行时对抗

`TODO: EDR 对抗细节待补`

## 写在最后

**这部分内容不会在公开博客上细讲实现**，只做思路分享。真想深入的朋友找我公众号后台交流。
