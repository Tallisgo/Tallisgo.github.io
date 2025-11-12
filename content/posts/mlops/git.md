---
title: git
date: 2021-04-06T08:00:00.000+08:00
draft: false
categories: ["MLOps"]
---

# 基本概念
## 裸仓库
裸仓库 指的是 没有工作区（代码文件）的 Git 仓库，只包含Git 版本控制所需的元数据和对象（.git 目录的内容），而不包含实际的项目文件副本
```bash
git init --bare myproject.git
```
![](/images/posts/2a094928-1-91916bf2.png)
使用方式:
```bash
mkdir /srv/git/
cd /srv/git/

git init --bare myproject.git



git clone user@server:/srv/git/myproject.git

git add .
git commit -m "add new feature"

git push origin main
```
## origin 别名
origin 是远程仓库的一个名称，是默认的别名，可以使用其他的。通常在以下两个场景下被设置
### git clone 一个仓库
```bash
git clone https://github.com/user/project.git
```
1. 克隆远程代码到一个新的目录里；
1. 自动为刚才克隆的那个地址创建一个远程别名叫 origin ;
```bash
cd project
git remote -v

输出
#origin  https://github.com/user/project.git (fetch)
#origin  https://github.com/user/project.git (push)
```
### 手动添加远程
```bash
git init

git remote add origin https://github.com/user/newrepo.git

git push -u origin main
```
### 后续操作
```bash
git remote -v

git remote set-url origin https://new.url.git

git remote remove origin

```
## upstream
upstream 是指当前分支默认关联的远程分支，用于拉取更新 和推送。
```bash
git branch -vv
```
### 设置upstream 的几种方式
```bash
git push -u origin dev
```
# 常用操作
```bash
git config --global alias.url "config --get remote.origin.url"
```
## git push
```bash
git push <远程仓库名> <本地分支>:<远程分支>

# 本地有一个分支dev， 希望把它推送到远程的origin 仓库,并且远程叫做 dev
git push origin dev:dev

# 如果远程分支 和本地分支名字一样，可以简写
git push origin dev
```
## git pull
```bash
git pull <远程仓库名> <远程分支>:<本地分支>

git pull origin dev: feature
# 把远程的origin/dev 拉下来合并到本地的feature 分支
```
## 方式一： 克隆仓库
```bash
git clone https://codeup.aliyun.com/675feb1320a07de19c7c13a3/engines/test.git
cd test
touch README.md
git add README.md
git commit -m "add README"
git push -u origin master
```
方式二： 已有文件夹或仓库
```bash
cd existing_folder
git init
git remote add origin https://codeup.aliyun.com/675feb1320a07de19c7c13a3/engines/test.git
git add .
git commit
git push -u origin master
```
# Git LFS 使用
```bash
git lfs track "*.pt"

git add model.pt

git commit -m "Add model with Git LFS"
```
