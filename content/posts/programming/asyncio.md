---
title: asyncio
date: 2025-11-10T22:44:00.000+08:00
draft: false
categories: ["Programming"]
---

# 定义
asyncio 是 Python 用来编写 异步 I/O 程序的标准库。
它提供了：
- 事件循环（Event Loop） — 负责调度和执行异步任务；
- 协程（Coroutine） — 一种特殊的函数，用 async def 定义；
- 任务（Task） — 在事件循环中运行协程的具体调度单位；
- Future 对象 — 表示一个“未来”会完成的结果。
> 简而言之：
## 协程
下面就是一个 协程函数， 调用的时候不会执行，而是返回一个 协程对象。
```python
async def foo():
	print("start")
	await asyncio.sleep(1)
	
	print("end")
```
事件循环相当于一个“任务调度中心”，它不断从任务列表中取出可以执行的协程， 运行直到遇到await，再切换到其他任务。
```python
import asyncio

asyncio.run(foo())
```
1. 创建一个新的事件循环；
1. 把协程放到事件循环中调度；
1. 运行到协程完成；
1. 清理并关闭循环；
## await： 挂起当前协程
- await 表示一个异步操作的结果；
- 后面必须跟一个 await 对象， 一般是另一个协程 或者 asyncio 提供的异步函数；
- 当执行到 await 语句时，协程会暂时让出控制权，可以去执行其他任务
# asyncio 的核心组合方式
1. 并发运行多个任务: asyncio.gather 
```python
results = await asyncio.gather(task1(), task2(), task3())
```
让多个协程几乎同时启动执行，返回一个列表保存结果。
并发但非并行（仍在单线程中依次切换执行）
1. 创建任务: asyncio.create_task 
希望任务 后台运行， 不等他立即完成；
```python
async def foo():
    await asyncio.sleep(1)
    print("done")

async def main():
    task = asyncio.create_task(foo())  # 启动 foo，但不会阻塞
    print("main 执行其他逻辑")
    await task  # 最后等 foo 完成

asyncio.run(main())
```
## 错误处理与超时
await 可以和 try...except  一起使用:
```python
try:
	data = await fetch_data()

except Exception as e:
	print('请求出错:' , e)
```
给任务设置超时:
```python
await asyncio.wait_for(task, timeout=5)
```
