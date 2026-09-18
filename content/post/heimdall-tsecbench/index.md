---
title: "开源 Heimdall 渗透平台：Circle of Circles 理念，20 块拿下 TSecBench 第一"
description: "Circle of Circles 理念，TSecBench v1 解题 63 道、综合第一、全场最少 token，模型费用大约 20 块。Heimdall CTF 解题模块开源。"
date: 2026-09-15T18:07:00+08:00
slug: heimdall-tsecbench
categories:
  - AI安全
  - 红队
tags:
  - Agent
  - Heimdall
  - CTF
---

## 前言

上个月对我的实战渗透 agent 增加了 ctf 解题模式，打了百度 Agent+ 攻防挑战赛，线上解题最多、综合第二，token 消耗最少，参考上一篇：[百度 Agent+ 攻防能力挑战赛记录](/post/baidu-agent-challenge/)。

上周，同一套 Circle of Circles 理念在 TSecBenchv1 上跑完：解题 63 道，全场最少 token、最短时间，综合第一，模型费用大概只有 20 块。

<figure>
  <img src="tsecbench-rank.png" alt="TSecBench 官方认证榜 · Heimdall 第一">
</figure>

Heimdall ctf 解题模块开源（去掉部分自研进攻性武器后的理念与架构，只进行 ctf 解题，后续会迭代开源实战渗透模块）。

开源仓库：<https://github.com/QiantangCredit/heimdall-pentest>

> 名字取自北欧神话里守桥的 Heimdall（海姆达尔）：主职是俯瞰全局，和系统的设计理念相对应。

## 1. Circle of Circles 理念

「Kreis von Kreisen / a circle of circles」出自黑格尔《哲学全书》，我是在一次会上从老板口中听到的，他是之前是在做移动安全领域的研究，是文科生，文科生在 ai 时代还是有红利 ^。

原句大意是：

> 哲学的每一部分都是一个自己闭合的圆；但每个圆又冲破自己的界限，长出更大的圆。整体因此呈现为 Circle of Circles——每一个小圆都是全体的一个环节，全体又出现在每一个小圆里。

Heimdall 参考的就是这个结构。

内圈是 Executor：自己转完 Thought–Action–Observation。

外圈是 Observer：不执行攻击，只做深入思考，把这一圈收成短 map（CONFIRMED / LOCK 等），写进下一圈的 system prompt，试错过的路不再走死胡同，下一圈带着 map 接着转，直到完成目标。

<figure class="small">
  <img src="circle-of-circles.png" alt="Circle of Circles：内圈 Executor，外圈 Observer">
</figure>

## 2. Agent 设计结构

目前我了解到的 Agent 设计，大体能分成五类，也有各个类叠加组成一个新的 agent：

1. Single-agent ReAct（单回路工具 Agent）
2. Orchestrator–Worker（编排–工人 / subagent）
3. Blackboard（黑板 / 共享状态 / worker 工作）
4. Evaluator–Optimizer（生成–评价 / 返回建议）
5. Sidecar Observer（旁路观察者）

每类都有自己的独特优缺点，如何选型设计一个专注于渗透的 agent 呢？

老生常谈：“渗透测试的本质是信息收集”——要去探索多个可能性分支，多个 Agent / worker 并行、多条线路一起试，尽量穷尽所有链路，效果通常不会太差，所以 Blackboard / Orchestrator–Worker 架构在渗透领域是有自己天生的优势。

但如果把 token 和效率算进去，就得先押相对最正确的一条串行验证，在比赛解题环境里，Sidecar Observer 在速度和消耗上有绝对的优势——因为题通常有相对固定的解，只要 lock 到对的路一直走就能完成目标。

整体结构和上一版差不多，以 pi coding sdk 为核心，构造 Observer / solver，claude code 完善的 goal 模块攻克难题。

为什么不直接只用 pi？pi 的强大之处在于极简 / 省 token / 可操控性强；我也试过 goal 类插件和自己写的目标导向插件，测评下来仍不如 Claude Code 的 goal 功能完善好用。

<figure>
  <img src="architecture-shot.png" alt="Heimdall 整体架构：观察者注入 map，未解再进 loop">
</figure>

真实世界渗透实战不一样：不是有唯一解，而是各个方向都可能存在漏洞，Blackboard / Orchestrator–Worker 这种架构通常会适合。

这个时候我会把 Circle of Circles 当成一个整体单元：多个 Circle of Circles 并行渗透，甚至内部还可以再叠 subagent，再配合上黑板架构去协调，探索面会更大，src 效果通常更好，当然 token 消耗也会随之增加。

## 3. Observer 如何设计

Observer 目标是纠偏主 Agent 的错误路线，记录主 Agent 已经走过的路，列出待试的方向，帮助它拿到 flag，解决死胡同，主 agent 陷入幻觉等通用问题。

可用的工具：`read`、`write`、`grep`、`ls`、`observation_context`、`observation_submit`

不给 bash。在测试中如果给了 bash 只靠提示词限制，Observer 有时在看的时候觉得不如我直接上，直接去打靶场，但实际自己又做不出，这点感觉和门口老大爷下棋周围的观棋者有一些异曲同工之妙...

根据提交统一生成：`CONFIRMED.md`、`observe_dag.json`、`inject.txt`（`<heimdall-map>`）。可以粗分成两层：

1. 覆盖台账（DAG）：记「哪一类试过了 / 还开着」，防走过的路重新走一遍
2. 短 map（inject）：注入进下一圈的 solver system prompt，给主 Agent 看的判断摘要

### 3.1 inject 短 map 字段

注入块：

```text
<heimdall-map>
HYPOTHESIS: 一句话假设…
CONFIRMED:
- 试了什么 → 结果怎么样
LOCK:
- 在考什么 | 难在哪 | flag 大概率在哪
TENSION:
- 可选；主 Agent 本窗口的 lock 判断互斥时，写两句**原话**
ANGLES:
- 仍合理的待试方向（有序；爆破类后置）
FORBID: 低价值磨功类限制 dirbust; jwt-brute等
</heimdall-map>
```

和上一篇架构不一样的是发现没有 DEAD 节点。

刚开始也就是上一篇架构设计观察者的时候添加了 dead 节点，目的是标一些已经试过的死路，考虑到了 dead 可能误标正确方向，导致很难解题，做了一个推翻制度，但实战中发现效果并不理想，现在全部进 CONFIRMED，coverage 用 tried-miss 代替。

观察者图：

<figure>
  <img src="observer-graph.png" alt="观察者图：解题进度与覆盖 DAG">
</figure>

<figure>
  <video controls playsinline preload="metadata" src="observer-multistage.mp4"></video>
</figure>

### 3.2 内网：loot → spray 字典

内网题上，观察者会把主 Agent 渗透过程里摸到的东西收成 loot（users / passwords / hosts / patterns / products …），再靠脚本 `rebuildSprayDict` 自动扩写成 `spray_users.txt` / `spray_passwords.txt` / `spray_creds.txt`。

观察者 map 上盖一戳 `DICT rev=…`，ANGLES 里提醒：这个 rev 还没喷过的登录面，可以再喷一轮。

真实内网攻防里，关键在于尽量隐匿地搞到高权凭据，常见几条路：

- 直接盯运维 / 高权限人员，想办法控到办公机，拿浏览器账密 / cookie 登集权设备 -over
- 域 / k8s 环境漏洞或配错，直接摸到高权凭据 -over
- 盯 EDR / 堡垒机这类集权设备，0day 进后台 / shell 拿凭据 -over

上面三条高效解决战斗的路走不通，一般只能传统方法慢慢磨：

攻击路径里抓 hash、翻服务器浏览器、数据库等密码 → 组成密码本 → 喷新主机 → 再抓再扩再喷，一路滚到核心系统、喷洒的时候可以通过已获取的凭据扩出新候选。

观察者 loot → spray 就是这样设计的，腾讯云内网题也是按这套思路出的，比如 B-02 后面关键就是「产品名首字母大写 + @ + 年份」这种口令；要是纯靠 LLM 的能力自己刚好蒙对，或者自主去构造，是由一定的运气和不确定性，靠观察者这套被动收集字典功能，拿了全场唯一一个多阶段渗透满分。

<figure class="small">
  <img src="multistage-fullscore.png" alt="多阶段渗透 3/3 · 100%">
</figure>

覆盖图中的字典动态更新：

<figure>
  <img src="coverage-graph.png" alt="覆盖图：DICT rev 动态更新">
</figure>

但是后来这种能力被社区给官方反映成了作弊，将我的这次成绩下架，官方给的举报点：

1. 比赛设置为通用 Agent 比赛，不能针对 pwn / 内网 / web / 对抗规避等每个题目类型设置不同的提示词
2. `heimdall-cve` 这个 cli 去查 cve poc，自写 cve poc
3. 爆破题目根据答题定制策略

当然我也有我自己的一些理解：

1. 通用单 Agent：所有不同题型的各种 prompt 堆积到一起设计过于冗余，会很大影响 llm context 进而影响解题注意力和判断，所以开源还是会通过渗透类型预置不同的提示词，也保留了一个 all 手册，当然测评也可以设计一个调度 agent 根据题目类型分发提示词，但是就先不做了，代码越多 bug 越多...
2. cve-cli：和官方沟通了这个 cli 只是镜像 nuclei 查 poc，如果是已知的漏洞，会直接利用，这个是官方是允许的，因为题目类型考察的就是已知漏洞利用，榜上前几名的都有内置，但是不能自己写 poc
3. 爆破策略：这个是大范围的，因为没有任何内置关键字，都是观察者动态生成的，字典不仅仅是题目设计，还有 hash，去已控数据库搜寻其他密码等等，这个能力在开源版本仍然会保存，我觉得在真实内网攻防中这个功能也是通用的

后面也是重新去除了这些质疑修改了一个版本重新跑了一下，依旧是解题消耗 token 排行榜最少，解题数量和第一并列。

## 4. 一些实战的时候发现的 trick

1. Skills：补模型训练期没见过的知识（如特定 WAF / rasp 等防护设备绕过 trick），当模型训练的时候就没有这个 waf 绕过技巧，是真的无论如何都想不到绕过方法，就需要补充
2. 开源工具往往比自研武器库模型更「熟」：Heimdall 实战版本内置了很多自研的 webshell / c2 / 隧道，把进攻性能力收成 CLI，抓取 hash，执行命令等进攻性武器方式原生免杀，进而提高隐匿性质。但在实战中模型很容易忘记使用方法多次 help，模型预训练见过公共工具，反而用起来更加顺手
3. 模型可控性：在解题的过程中，agent 竟然自主外部搜索 wp，搜索靶场题目相关的比赛信息，还有攻击内部调度数据库，而不是专注于解题，这种自主性，在真实实战中需要注意，如何设计一个可控的渗透 agent 是一个难题

## 5. 总结

我个人理解现在很多测评集，还是更吃基模能力，对 agent 怎么设计考得偏少，日常 badcase 能不能解决、token 效率、是否能隐匿可控的渗透，安全设备告不高警等等。

当然这些都是需要时间的积累去发现这些 badcase，一个好的 benchmark 比一个 Agent 实现要难得多，感谢腾讯云提供的免费测评靶场和测评集，希望后面能多出一些更贴实战工程取舍的题目。

2026 年，AI 已经在改漏洞研究、攻防和各种安全工程的日常，大家都很快的用起来了，而世界存量漏洞太多，发现成本被大幅压低——对 agent「许个愿」就能出洞，这种事每时每刻都在发生，希望大家都能找到自己的方向，在 AI 时代站稳脚跟。
