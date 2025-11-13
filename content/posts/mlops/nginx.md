---
title: Nginx
date: 2024-07-03T08:00:00.000+08:00
draft: false
categories: ["MLOps"]
---

# 介绍
Nginx（读作 Engine X）是一个高性能的Web 服务器、反向代理服务器以及电子邮件（IMAP/POP3）代理服务器。它最早由俄罗斯的程序员 Igor Sysoev 编写，于 2004 年首次发布。Nginx 以其高并发处理能力、低资源占用和稳定性著称，广泛用于各种规模的网站与应用部署中。
---
## 一、Nginx 的主要功能
1. 静态资源服务器
1. 反向代理（Reverse Proxy）
1. 负载均衡
1. 动静分离
1. 缓存与压缩
1. HTTPS / SSL 支持
1. 作为 API 网关
---
## 二、Nginx 的核心特点
- 高并发：采用异步、事件驱动架构（基于 epoll/kqueue）。单机可支撑十万级甚至百万级并发连接。
- 轻量级：占用内存小，配置灵活。
- 模块化设计：通过加载不同模块扩展功能。
- 跨平台：支持 Linux、Unix、Windows 等系统。
---
## 三、Nginx 的常见应用场景
- 大型网站的前端 Web 服务（例如静态资源分发）
- 反向代理 + 负载均衡集群
- 动静分离架构
- 微服务或 API 网关入口
- HTTPS 证书终止层
- CDN 边缘缓存节点
---
## 四、总结
一句话概括：
> Nginx 是一个高性能、轻量级的 Web 服务器和反向代理服务器，能高效处理大量并发连接，是现代网站架构中的核心组件之一。
# 反向代理
## 一、什么是反向代理（Reverse Proxy）
反向代理是代理服务器的一种工作方式。
简单理解就是：客户端只访问代理服务器，由代理服务器将请求转发给后端服务器并把响应返回给客户端。
---
- 正向代理（Forward Proxy）：代理 客户端 向目标服务器发起请求。
- 反向代理（Reverse Proxy）：代理 服务器端 来响应客户端请求。
### 🔁 反向代理的核心逻辑
1. 用户访问入口（如 Nginx）。
1. Nginx 接收到请求后，根据配置判断应该把请求转发到哪个后端服务器。
1. Nginx 从后端服务器获取响应。
1. Nginx 把响应返回给客户端。
客户端始终只和 Nginx 通信，而不知道实际的后端服务部署在哪里。
---
## 二、为什么要用反向代理
反向代理的好处包括：
1. 负载均衡：Nginx 可将请求分配给多台后端服务器，提升性能和可靠性。
1. 安全隔离：隐藏真实服务器的 IP 和端口，对外只暴露 Nginx。
1. 缓存加速：Nginx 可缓存常用资源，减少后端压力。
1. 统一入口：方便处理认证、日志、SSL、限流等功能。
---
## 三、Nginx 是如何实现反向代理的
Nginx 内置有一个 proxy 模块（proxy_pass） 用于实现反向代理功能。
举个简单的配置示例（讲思路，不包含敏感生产内容）：
```plain text
http {
    upstream backend {
        server 127.0.0.1:8080;
        server 127.0.0.1:8081;
    }

    server {
        listen 80;
        server_name example.com;

        location / {
            proxy_pass <http://backend>;
        }
    }
}

```
### 工作原理
1. 客户端访问 http://example.com。
1. Nginx 监听 80 端口并接收到请求。
1. 按照配置，Nginx 将请求转发（proxy_pass）到 backend 后端集群。
1. 后端服务器处理请求并返回响应数据。
1. Nginx 再将数据返回给客户端。
在这个过程中，客户端始终不知道真实的后端 IP，只与 Nginx 通信。
---
## 四、总结一下
> 一句话总结：Nginx 的反向代理就是一个“前端接入网关”，对外统一入口，对内智慧分发请求。
---
## 实例
- 每个 server  {...} 就是一个 Server 块 （虚拟主机配置块）， 就是一台虚拟的web 服务器；
- 站点就是一个互联网上可访问的web 服务，有自己的域名和访问路径；
### listen
用于指定服务器监听的端口和地址
- [::] 表示IPv6 通配地址， 没有则表示 所有Ipv4 地址；
### location
用于根据URI 匹配规则来决定请求应如何被处理， 支持多种匹配模式
```nix
location /api/ {
    proxy_pass http://backend_server;
}
```
---
补充知识：
一个完整的URL长这样：
```nix
https://example.com/api/v1/user?id=123
```
---
```nix
server {

	server_name gof-cs-cn.diandian.info;

	listen [::]:80;

	access_log /log/gof-cs-cn/access.log;
	error_log /log/gof-cs-cn/error.log;

	root /www/local;

	client_max_body_size 50M;

	location /export {
		autoindex on;
		autoindex_localtime on;
		alias /www/tallis/export-dify-cn/dump-files;

		auth_basic "Leap Area";
		auth_basic_user_file /etc/nginx/htpasswd;
	}

	#location /export-ENCrowajl6LDdgw {
	#	autoindex on;
	#	autoindex_localtime on;
	#	alias /www/tallis/export-dify-cn/dump-files;

		#	auth_basic "Leap Area";
		#auth_basic_user_file /etc/nginx/htpasswd;
	#}

	location /  {
		proxy_pass http://10.0.84.215:12346;

		proxy_set_header Upgrade $http_upgrade;
		proxy_set_header Connection "upgrade";

		proxy_http_version 1.1;
		proxy_set_header Host $host;
		proxy_set_header X-Real-IP $remote_addr;
		proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
		proxy_set_header X-Forwarded-Proto $scheme;
	}

	location = /robots.txt  { access_log off; log_not_found off; }
	location = /favicon.ico { access_log off; log_not_found off; }
	location ~ /\.		    { access_log off; log_not_found off; deny all; }
}

```
### 设置文件上传大小
```bash

client_max_body_size 200M;  # 允许上传最大200MB的文件

```
