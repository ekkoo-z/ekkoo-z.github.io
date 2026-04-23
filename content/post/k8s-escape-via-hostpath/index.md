---
title: "K8s 容器逃逸：hostPath 挂载利用链实战"
description: "从一个拿到容器权限的靶机开始，一步步完成到 Node 再到集群的横向"
date: 2026-02-11
slug: k8s-escape-via-hostpath
categories:
  - 云原生安全
tags:
  - Kubernetes
  - 容器逃逸
  - 红队
toc: true
---

## 环境

- 集群：K8s v1.28，containerd 运行时
- 入口：一个 RCE 漏洞拿到了 Web 容器权限
- 目标：提权到 Node → 横向其它 Pod → 拿到 kubeconfig

## 第一步：判断当前环境

```bash
# 是否在容器里
cat /proc/1/cgroup

# 是否有 docker.sock / containerd.sock 暴露
ls -la /var/run/docker.sock /run/containerd/containerd.sock 2>/dev/null

# hostPath 挂载点
mount | grep -E 'proc|sys|hostPath'
```

## 第二步：通过 hostPath 读取 Node 凭证

`TODO: 根据实际场景补充命令`

## 第三步：利用 kubeconfig 横向

如果 `/etc/kubernetes/admin.conf` 可读，直接拷贝下来用 kubectl 操作整个集群。

## 加固建议

1. PSA (Pod Security Admission) + restricted profile
2. OPA/Kyverno 禁止 hostPath 挂载敏感目录
3. containerd 的 sock 不要挂进业务容器

---

_仅用于授权靶场测试。_
