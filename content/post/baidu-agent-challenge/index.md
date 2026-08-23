---
title: "百度 Agent+ 攻防能力挑战赛记录"
description: "线上赛 2/150，33 个 flag 全场最多，token 消耗前十最少——以及这套 Heimdall 智能渗透 Agent 是怎么长出来的。"
date: 2026-08-23T00:00:00+08:00
slug: baidu-agent-challenge
categories:
  - AI安全
  - 红队
tags:
  - Agent
  - Heimdall
  - CTF
---

## 前言

先说比赛结果：**线上赛排名 2/150，拿到 33 个 flag 全场最多，token 消耗前十最少**，最终在官方评审下居然没进入 Top 8。也就没机会去参加线下决赛展示了。

在这里写篇文章记录一下，也正好说最近用 AI 在做的事情，以及自己的一些思考。

### 线上赛结果

第二和第一仅差 0.06 分。消耗 token 约 2 亿（解题时间由于架构用了 loop，会一直解到靶场暂停）。

<figure>
  <img src="https://img.wemd.app/1787405896001_5y72b3.png" alt="线上赛总分排名，第二名与第一名仅差 0.06 分">
</figure>

获得 flag 33 个，全场最多，完成率也是全场最高。

<figure>
  <img src="https://img.wemd.app/1787405919069_fu9bj5.png" alt="flag 数量与完成率全场最高">
</figure>

## 比赛内容

赛制以「实战」为主。题型是 Web 67%、二进制 20%、AI 漏洞挖掘 7%、区块链漏洞挖掘 6%。

<figure>
  <img src="https://img.wemd.app/1787406273558_dupo4f.png" alt="赛题类型占比：Web 为主，其次是二进制、AI 与区块链">
</figure>

线上赛和评委评分各 50%。

<figure>
  <img src="https://img.wemd.app/1787406286122_9cpg28.png" alt="线上赛与评委评分各占 50%">
</figure>

打比赛要盯的三件事：解题成功率、解题速度、Token 消耗。

## 架构设计与演进

追溯到年初，我在探索 Agent 自动化渗透的时候写过一篇公众号：《我们离一键渗透还有多远：AI 驱动的下一代红队武器架构设计》。当时把自研的 webshell 原子化，用 CrewAI 框架自己编排了一个多 Agent 框架做内网渗透，暴露了一些问题：

- 上下文管理粗糙，长任务丢状态
- 大致流程固定，AI 不能最大化发挥
- AI 幻觉无法被结构化否证

后来改成 Claude Code SDK 配武器库，比自己硬编框架好用。但这场没用它梭哈——太重。虽然有顶尖的上下文管理、子 Agent 调度，但它始终是一个面向编程而设计的产品：渗透用不到的提示词和安全监视路径太多，缓存命中脆。

再调研了一圈，最后以 pi agent 为核心，构建了 Heimdall 智能渗透 Agent 参加比赛。

### Token 消耗与解题速度

实现完初步的靶场对接调度程序后，直接用简单提示词、裸调用 pi agent 和 Claude Code SDK，在 TSecBench v1 靶场做了对比（感谢腾讯云提供的公益靶场环境，效果更直观）。

<figure>
  <img src="https://img.wemd.app/1787406915888_e426ex.png" alt="TSecBench v1 上 pi agent 与 Claude Code 的解题对比">
</figure>

<figure>
  <img src="https://img.wemd.app/1787407005126_vir8c8.png" alt="pi agent 在解题速度和 token 消耗上优于 Claude Code">
</figure>

最终在官方比赛中也成功展现优势：消耗 token 前十最少，约为第一的 1/7。

### 为什么会这样？

Claude Code 是编程产品。公开系统提示里，主会话大约有 1 万 token 的编程规范、拒答和工具表，旁边还有一条大约 3.8 万 token 的安全监视。前缀一长，cache miss 就要按大前缀再付一次，公开资料里大约是 12.5 倍。渗透场景很多都用不到。

Heimdall 的 pi agent 实现反过来做：

系统提示只留授权、提交契约、map / brief 怎么读。工具只有这些：`read`、`bash`、`edit`、`write`、`grep`、`find`、`ls`。

### 裸架构遇到的问题

裸 Pi 跑完整 TSecBench v1 Web 题，有一部分没解出来。

<figure>
  <img src="https://img.wemd.app/1787407682471_6cuawn.png" alt="裸 Pi 在 TSecBench v1 Web 题上的未解情况">
</figure>

查看 LLM 对话日志，能看到一些典型问题：死胡同、喜欢爆破、死路重测、幻觉循环……

靶场公开排行榜上，A-03、A-18 两道题大部分 Agent 也都没做出来，说明大家的 Agent 会撞上同一类问题。

当然也有一些优秀的开源项目，用自己的思路解决了一部分，成功解出——基于 DAG、意图等等。但大多数都是在**同一个 Agent** 上做的：比如解题 Agent 发现一条可能路径，就写到一个图文件里，后面慢慢去读这张图。这样必然会影响主 Agent 的注意力：没法全部投入拿 flag，而要分一部分注意力到记录层面。

### 解决方案：观察者 Agent——读思路、画图、不攻击

观察者是另一路 Agent，不执行攻击。它读主 Agent 的思考和工具结果，对照流量写成 `<heimdall-map>`，经 LLM 旁路注入后续请求的系统提示。图里只含：

- **LOCK**：这题在考什么 / 难在哪 / flag 大概率在哪
- **DEAD**：当时失败过的一整类
- **ANGLES**：还没认真打过的突破类
- **TENSION**：主 Agent 自己两句互相打架的话。观察者只举镜子，由主 Agent 决定废哪一句

架构图：

<figure>
  <img src="https://img.wemd.app/1787408339232_97hbel.png" alt="Heimdall 主 Agent 与观察者 Agent 的架构图">
</figure>

实现过程中也踩了坑，最后都做了改善：

- 图里的建议会影响主 Agent 做主动思考 → **禁止祈使句，没有 NEXT**
- DEAD / LOCK 节点一旦误判，就永远错失解题方向 → **新证据可撤销误标的 DEAD / LOCK**；TENSION 标出互相打架的两句话，由主 Agent 决定废弃哪一句
- 解题一开始就尝试 JWT 爆破、路径爆破等耗时工程 → **观察者标明哪些操作需要后置**

观察者 Agent 产出的图：

<figure>
  <img src="https://img.wemd.app/1787409054591_4ffxcr.png" alt="观察者 Agent 产出的 heimdall-map">
</figure>

靶场测试：A-03、A-18 是腾讯云 Bench 上多数 Agent 难以按时解出的题。同一套主 Agent，只开关观察器对比：

<figure>
  <img src="https://img.wemd.app/1787409598212_7oupzq.png" alt="开关观察器后 A-03 / A-18 的解题对比（一）">
</figure>

<figure>
  <img src="https://img.wemd.app/1787409627678_uhj0xm.png" alt="开关观察器后 A-03 / A-18 的解题对比（二）">
</figure>

### Prompt、Context 与 Loop 工程：提升解题注意力

#### Workspace 分离

system prompt 按题型细致分割：明确是 web / pwn / ai / 链 / 内网 / cve，只挂对应工具段和 prompt。这次比赛不报类型，实际是全部归到了一起，但在其他场景有着明显的效果。

#### 万物皆 CLI：AI Native 红队设施

现在的前沿模型预训练里已经有了大量的漏洞原理和利用骨架，再去堆大量 Skills / MCP 协议，等于每轮把模型已经知道的知识再塞进 context：占窗口、扰动 cache 前缀、稀释真题解题注意力。

Heimdall 把能力收成 CLI：bash 调用，公共输出格式契约，窗口只留下场契约与本题，把大模型注意力全部集中在解题上。

```text
Playwright CLI
heimdall-challenge
heimdall-cve
heimdall-ocr
heimdall-submit
...
```

包括自己之前自研的 webshell / C2 框架，也全部做成了 CLI。内网渗透在高强度 EDR / 流量设备防护下，AI 自动化渗透就需要隐匿。

奇安信对 OpenAI 模型「越狱」入侵 Hugging Face 的复盘：周末超过 1.7 万次操作，**路径笨拙、痕迹未清。能力强而隐蔽差**，是「裸模型 + 通用 shell」的失败模式。我们可以把隐匿性留给 AI Native 武器层——比如 webshell 执行命令使用 JNI / .NET native，C2 使用 BOF 执行 / AMSI bypass / 分阶段 dump hash。实战里人类怎么绕过对应杀软，就把武器赋给 Agent。我相信 Agent 也可以在复杂内网中进行渗透。

XdriveC2：BOF 执行 / 后渗透

<figure>
  <img src="https://img.wemd.app/1787413344595_aqoig1.png" alt="XdriveC2 的 BOF 执行与后渗透能力">
</figure>

Zdrive webshell：隐匿执行命令 / 后渗透

<figure>
  <img src="https://img.wemd.app/1787414109894_ybms2f.png" alt="Zdrive webshell 隐匿执行命令与后渗透">
</figure>

全部 CLI 化，交给 Agent 使用：

<figure>
  <img src="https://img.wemd.app/1787412144609_xpz9fp.png" alt="红队能力全部 CLI 化后供 Agent 调用">
</figure>

本届百度赛未设置内网渗透题。但笔者在实战中让 Agent 使用这一套 CLI，打穿过某 EDR 防护下的目标，从头到尾没有被踢出局。

#### GEPA 优化

大家做 Agent 大部分肯定都遇到过一个问题：prompt 改完没法衡量，只能靠体感，对着 `AGENTS.md` 念一段咒语，测完觉得好像好用了一点。GEPA 正是解决这个问题的方案之一。

GEPA 不训练模型，只是把 prompt 当成一个能迭代的组件：同一套任务反复跑，打分，留下真的变好的版本。当然也非常耗 token。

<figure>
  <img src="https://img.wemd.app/1787415213266_splkxo.png" alt="GEPA 对 prompt 进行迭代优化的示意图">
</figure>

## 实战

我觉得用 AI 做的事情要能产生价值才算没浪费时间。直白点就是：**能赚钱的 Agent 才是好 Agent**。

往年在工作的情况下基本上无余力去挖 SRC 做副业。今年在工作之余，我只需要输入一个企业名称，做好 token 供给，Agent 就真正意义上可以给你赚钱。上个月构建了一个系统，专门用于挖掘 SRC，目前已经拿到不少赏金了。

从输入一个企业名称，到自动化信息收集、资产评分，再到黑盒渗透：

<figure>
  <img src="https://img.wemd.app/1787416121862_gtcn94.png" alt="输入企业名称后的自动化信息收集与资产评分">
</figure>

<figure>
  <img src="https://img.wemd.app/1787416286133_tl4t4b.png" alt="自动化黑盒渗透流程">
</figure>

现在很少有人古法挖洞了。你的 Agent 需要有一些独特的灵魂，找到其他 Agent 可能遗漏的地方捡漏。

7 月使用该框架的部分漏洞挖掘成果：

<figure>
  <img src="https://img.wemd.app/1787416650382_jv0py6.png" alt="7 月漏洞挖掘成果截图（一）">
</figure>

<figure>
  <img src="https://img.wemd.app/1787416664162_w6bm6c.png" alt="7 月漏洞挖掘成果截图（二）">
</figure>

这套系统还在进一步优化中。我相信有一天，输入一个企业名称到内网沦陷，是真正可以做到的事情。

关于开源：CTF 相关的答题平台后续会开源。基于当前国内的环境，免杀、AI Native 进攻性工具和攻防平台暂时不会——我不希望这些工具变成砸向普通企业的导弹。

## 总结

这场比赛可惜没把这套东西拿到线下讲好。不服是真的，但在我的人生经历中，这种事情不是第一次发生了。把该做的做好就行，总有一天会有结果。

年初那篇结尾我写过一段话：

> **虽然这些工具到真正实用还有距离，但它们指明了方向——AI Agent 将成为人类能力的延伸，而非简单的工具替代。**

现在仅仅过了半年，已经能看到：到实用的距离，是在成倍缩短的。以后行业会变成什么样，我挺好奇。只希望能大浪淘沙，能够越来越好。
