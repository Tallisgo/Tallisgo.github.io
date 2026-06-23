---
title: dify 升级记录
date: 2025-12-08T08:00:00.000+08:00
draft: false
categories: ["Projects"]
---

# 背景
dify 版本存在一定的漏洞，需要升级至指定版本 1.10.1-fix.1 ,  目前存在使用的数据 需要进行迁移保存，包括不限于 工作流，用户交互记录。
# 流程
1. 备份当前编排文件与环境变量
```python
cp docker-compose.yaml docker-compose.yaml.$(date +%s).bak
cp .env .env.$(date +%s).bak

# 备份数据卷（包含知识库和应用数据）
sudo tar -cvf volumes-$(date +%s).tgz volumes
```
1. 停服
```python
docker compose down
```
1. 拉取最新文件
```python
git pull
git checkout 1.10.1-fix.1
```
1. 修改配置文件
# 问题
升级过程中遇到以下情况：
1. 配置的时候数据库选择的是 Postgres ， compose.yaml 中 对应的service name 改变了，所以.env 中 db_host 需要修改。
![](/images/posts/2c394928-1-53e5cdf5.png)
![](/images/posts/2c394928-2-b77f61e9.png)
1. 我在恢复的时候出现数据丢失情况， workspace 中添加的成员全部丢失，另外工作流丢失部分，这很奇怪，但是我还没找到原因（不敢随意乱动）。好在之前备份了数据库，基于备份找回了原先内容。
- 备份脚本:
```bash
mkdir -p "$(dirname "$FILE")"

export PGHOST=127.0.0.1
export PGUSER=postgres
export PGDATABASE=dify
export PGPASSWORD=difyai123456
set -x
pg_dump | gzip --best > "$FILE"

# 备份本机数据
if [ "$LOCAL" = "Fla" ]; then
    LOCAL_DIR="/backup/${LOCAL}/gof-cs-cn"
elif [ "$LOCAL" = "Ray" ]; then
    LOCAL_DIR="/backup/${LOCAL}/gof-cs-en"
else
    echo "错误：未知的 LOCAL 值: $LOCAL"
	exit 1
fi
```
- 恢复脚本
```bash
# 1. 把压缩包解压并通过 psql 灌库
gunzip -c /path/to/dify-2025-12-08.sql.gz \\
  | docker exec -i <db-container> psql -U postgres -d dify

```
如果你已经用「临时容器」验证过数据完整，现在要覆盖正式库，按下面 4 步操作即可：
---
### ✅ ① 停正式栈 & 起干净库
```bash
cd /www/tallis/dify/docker
docker compose down                       # 停止全部服务
docker run -d --name db_restore \\
  -e POSTGRES_PASSWORD=postgres \\
  -p 5433:5432 \\
  -v "$PWD"/volumes/db/data_new:/var/lib/postgresql/data \\
  postgres:15
sleep 3

```
---
### ✅ ② 导入（用你脚本里同样的环境变量，确保字符集一致）
```bash
export PGHOST=127.0.0.1
export PGPORT=5433
export PGUSER=postgres
export PGPASSWORD=postgres
gunzip -c /www/tallis/dify-2025-12-08.sql.gz \\
  | psql -d postgres

```
---
### ✅ ③ 验证（仍连 5433）
```bash
psql -h 127.0.0.1 -p 5433 -U postgres -d dify -c "
  SELECT count(*) FROM tenant_account_joins;
  SELECT count(*) FROM datasets;
  SELECT count(*) FROM apps;"

```
数量正常 → 继续第 ④ 步。
---
### ✅ ④ 替换正式数据目录
```bash
docker stop db_restore && docker rm db_restore
mv volumes/db/data volumes/db/data.empty.$(date +%F)
mv volumes/db/data_new volumes/db/data
docker compose up -d

```
浏览器登录 Dify，老成员、老知识库应该全部回归。
---
### ⚠️ 注意
- 正式库默认密码是 difyai123456，而临时容器里我们用了默认的 postgres，所以导入时 不要 把 .env 里的密码变量直接带进去，用上面显式 PGPASSWORD=postgres 即可。
- 如果 SQL 里带 CREATE DATABASE dify;，导入前先把临时容器里的默认库叫 postgres 即可，pg_dump 纯文本格式会自动切换连接。
