---
title: docker
date: 2022-10-06T08:00:00.000+08:00
draft: false
categories: ["MLOps"]
---

# 知识点
## repo 、image name 和tag
1. repository 是指仓库 或者镜像仓库，即一个空间；
- 公有仓库 Docker hub；
- 私有仓库 Harbor 阿里云镜像仓库；
1. image name 是指 repo下某一类应用的具体名称；
1. tag 用于标识镜像的版本，每个tag 对应一个镜像ID
docker 镜像是由多层layer 叠加而成，可以被多个镜像共享
# docker 常用命令
## image
```bash
docker pull xxx

docker image ls
docker images

docker build -t myapp:1.0 .

docker tag myapp:1.0 myrepo/myapp:latest

docker rmi image-name


docker inspect image-name
```
## container
```bash
docker run \
		--rm \ # 容器退出的时候直接销毁
		-it \
		-v xxx:xxx \ # 挂载目录
		--entrypoint /bin/bash \ # 如果容器有自启动命令，这样设置可以跳过；
		--name xxx \ # 指定容器名
		image-name
```
1. 挂载目录之后，本地修改文件， 容器内文件也同步修改；
1. 如果image tag 不是 latest ， 需要加上tag；
# docker compose
compose 允许用户通过一个单独的 docker-compose.yml 模版文件 来定义一组相关联的应用容器作为一个项目。
- 服务（service）: 一个应用的容器，或者若干运行相同镜像的容器实例；
- 项目（project）： 完整的业务单元；
```bash
docker compose up

docker compose down

docker compose build
```
## compose.yaml
```bash
version: "3.9"   # YAML文件版本（Docker Compose v2 之后可省略）

services:
  web:
    image: nginx:latest
    ports:
      - "8080:80"
    volumes:
      - ./html:/usr/share/nginx/html
    networks:
      - frontend

  app:
    build: ./app
    depends_on:
      - db
    environment:
      - DEBUG=true
    networks:
      - frontend
      - backend

volumes:
  db-data:

networks:
  frontend:
  backend:
```
### services
- 用于定义应用中的每一个容器服务；
- 每个服务对应一个容器；
entrypoint
- 指定容器启动时执行的主程序；
command
- 为entrypoint 提供参数，或作为主程序直接替换
### profiles
profiles  给服务加一个“标签”或者“分组”，让你在执行 docker compose up 时，选择启用的那一组。
```yaml
services:
  web:
    image: nginx
  db:
    image: mysql
  redis:
    image: redis
  vllm-server:
    image: vllm:latest
    profiles: ["vllm"]
  monitor:
    image: grafana
    profiles: ["monitor"]
```
1. 默认只启动没有profile的服务
```yaml
docker compose up
```
1. 启动vllm-server
```yaml
docker compose --profile vllm up
```
1. 连监控一起开
```yaml
docker compose --profile vllm --profile monitor up
```
# docker 打包
# issue
1. 权限问题
```bash
permission denied while trying to connect to the Docker daemon socket at unix:///var/run/docker.sock: Post "http://%2Fvar%2Frun%2Fdocker.sock/v1.51/images/create?fromImage=docker.io%2Fvllm%2Fvllm-openai&tag=0.8.5.post1": dial unix /var/run/docker.sock: connect: permission denied
```
```bash
sudo usermod -aG docker $USER

# 需要重新登陆
```
