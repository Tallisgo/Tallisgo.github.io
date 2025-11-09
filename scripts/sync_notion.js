#!/usr/bin/env node
/**
 * 从 Notion 数据库同步笔记到 Hugo 博客
 * 支持图片下载和处理
 */

import { Client } from '@notionhq/client';
import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 配置
const NOTION_TOKEN = process.env.NOTION_TOKEN;
const NOTION_DATABASE_ID = process.env.NOTION_DATABASE_ID;

// 目录路径
const ROOT_DIR = path.resolve(__dirname, '..');
const CONTENT_DIR = path.join(ROOT_DIR, 'content', 'posts');
const STATIC_DIR = path.join(ROOT_DIR, 'static');
const IMAGES_DIR = path.join(STATIC_DIR, 'images', 'posts');

/**
 * 初始化 Notion 客户端
 */
function initNotionClient() {
    if (!NOTION_TOKEN) {
        throw new Error('未设置 NOTION_TOKEN 环境变量');
    }
    return new Client({ auth: NOTION_TOKEN });
}

/**
 * 查询 Notion 数据库中的所有页面（只获取 Status 为 "Done" 的页面）
 */
async function queryNotionDatabase(notion) {
    // 首先获取数据库结构，找到 Status 属性的实际名称
    const database = await notion.databases.retrieve({
        database_id: NOTION_DATABASE_ID,
    });

    // 查找 Status 属性
    const properties = database.properties;
    let statusPropertyName = null;

    // 调试：打印所有属性
    console.log('数据库属性列表:');
    for (const [key, prop] of Object.entries(properties)) {
        console.log(`  - ${key} (${prop.type}) - 显示名称: ${prop.name || 'N/A'}`);
        if (prop.type === 'select') {
            console.log(`    选项: ${JSON.stringify(prop.select?.options?.map(o => o.name) || [])}`);
        }
    }

    for (const [key, prop] of Object.entries(properties)) {
        if (prop.type === 'select' &&
            (key.toLowerCase() === 'status' || prop.name?.toLowerCase() === 'status')) {
            statusPropertyName = key;
            console.log(`找到 Status 属性: ${key} (显示名称: ${prop.name})`);
            break;
        }
    }

    if (!statusPropertyName) {
        console.warn('警告: 未找到 Status 属性，将获取所有页面并在客户端过滤');
    }

    const allPages = [];
    let hasMore = true;
    let startCursor = null;

    while (hasMore) {
        const queryParams = {
            database_id: NOTION_DATABASE_ID,
        };

        // 只有当 startCursor 不为 null 时才添加
        if (startCursor) {
            queryParams.start_cursor = startCursor;
        }

        // 如果找到了 Status 属性，添加过滤条件
        if (statusPropertyName) {
            queryParams.filter = {
                property: statusPropertyName,
                select: {
                    equals: 'Done',
                },
            };
        }

        const response = await notion.databases.query(queryParams);

        // 如果无法使用过滤，在客户端过滤
        let pages = response.results;

        // 调试：打印每个页面的 Status
        if (pages.length > 0) {
            console.log(`\n查询到 ${pages.length} 个页面，检查 Status:`);
            pages.forEach((page, index) => {
                const props = page.properties || {};
                let title = 'Untitled';
                let statusValue = 'null';

                // 获取标题
                for (const [key, prop] of Object.entries(props)) {
                    if (prop.type === 'title' && (key.toLowerCase() === 'title' || prop.name?.toLowerCase() === 'title')) {
                        title = prop.title?.map((item) => item.plain_text).join('') || 'Untitled';
                        break;
                    }
                }

                // 获取 Status
                for (const [key, prop] of Object.entries(props)) {
                    if (prop.type === 'select' &&
                        (key.toLowerCase() === 'status' || prop.name?.toLowerCase() === 'status')) {
                        statusValue = prop.select?.name || 'null';
                        break;
                    }
                }

                console.log(`  页面 ${index + 1}: "${title}" - Status: "${statusValue}"`);
            });
        }

        if (!statusPropertyName) {
            pages = pages.filter((page) => {
                const props = page.properties || {};
                for (const [key, prop] of Object.entries(props)) {
                    if (prop.type === 'select' &&
                        (key.toLowerCase() === 'status' || prop.name?.toLowerCase() === 'status')) {
                        const statusValue = prop.select?.name;
                        // 不区分大小写比较
                        return statusValue && statusValue.toLowerCase() === 'done';
                    }
                }
                return false;
            });
        } else {
            // 即使使用了 API 过滤，也进行客户端验证（不区分大小写）
            pages = pages.filter((page) => {
                const props = page.properties || {};
                for (const [key, prop] of Object.entries(props)) {
                    if (prop.type === 'select' &&
                        (key.toLowerCase() === 'status' || prop.name?.toLowerCase() === 'status')) {
                        const statusValue = prop.select?.name;
                        return statusValue && statusValue.toLowerCase() === 'done';
                    }
                }
                return false;
            });
        }

        allPages.push(...pages);
        hasMore = response.has_more;
        startCursor = response.next_cursor;
    }

    return allPages;
}

/**
 * 从 block 中提取文本内容
 */
function extractTextFromBlock(block) {
    const blockType = block.type;
    if (!block[blockType]) {
        return '';
    }

    const content = block[blockType];
    if (!content.rich_text) {
        return '';
    }

    return content.rich_text
        .map((textItem) => textItem.plain_text || '')
        .join('');
}

/**
 * 下载图片并返回本地路径
 */
async function downloadImage(imageUrl, pageId, imageIndex) {
    try {
        // 确保图片目录存在
        await fs.mkdir(IMAGES_DIR, { recursive: true });

        // 处理 Notion 文件 URL（可能需要特殊处理）
        let downloadUrl = imageUrl;

        // 如果是 Notion 的 s3.us-west-2.amazonaws.com 域名，可能需要添加认证
        // 但通常 Notion API 返回的 URL 已经包含必要的认证参数

        // 获取图片扩展名
        let ext = '.jpg';
        try {
            const urlObj = new URL(imageUrl);
            ext = path.extname(urlObj.pathname) || '.jpg';

            // 从 URL 参数中获取文件类型（如果有）
            const contentType = urlObj.searchParams.get('X-Amz-Content-Type') ||
                urlObj.searchParams.get('content-type');
            if (contentType) {
                const mimeToExt = {
                    'image/jpeg': '.jpg',
                    'image/jpg': '.jpg',
                    'image/png': '.png',
                    'image/gif': '.gif',
                    'image/webp': '.webp',
                    'image/svg+xml': '.svg',
                };
                if (mimeToExt[contentType]) {
                    ext = mimeToExt[contentType];
                }
            }
        } catch {
            // URL 解析失败，使用默认扩展名
        }

        if (!['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'].includes(ext.toLowerCase())) {
            ext = '.jpg';
        }

        // 生成唯一文件名
        const hash = crypto.createHash('md5').update(imageUrl).digest('hex').substring(0, 8);
        const filename = `${pageId.substring(0, 8)}-${imageIndex}-${hash}${ext}`;
        const filepath = path.join(IMAGES_DIR, filename);

        // 检查文件是否已存在
        try {
            await fs.access(filepath);
            console.log(`  图片已存在，跳过下载: ${filename}`);
            return `/images/posts/${filename}`;
        } catch {
            // 文件不存在，继续下载
        }

        // 下载图片
        const response = await axios({
            method: 'GET',
            url: downloadUrl,
            responseType: 'arraybuffer',
            timeout: 30000,
            maxRedirects: 5,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'image/*',
            },
        });

        // 根据响应头确定文件类型
        const contentType = response.headers['content-type'];
        if (contentType && contentType.startsWith('image/')) {
            const mimeToExt = {
                'image/jpeg': '.jpg',
                'image/jpg': '.jpg',
                'image/png': '.png',
                'image/gif': '.gif',
                'image/webp': '.webp',
                'image/svg+xml': '.svg',
            };
            if (mimeToExt[contentType]) {
                const newExt = mimeToExt[contentType];
                if (newExt !== ext) {
                    // 更新文件名和路径
                    const newFilename = filename.replace(ext, newExt);
                    const newFilepath = path.join(IMAGES_DIR, newFilename);
                    await fs.writeFile(newFilepath, response.data);
                    console.log(`  ✓ 已下载图片: ${newFilename}`);
                    return `/images/posts/${newFilename}`;
                }
            }
        }

        // 保存文件
        await fs.writeFile(filepath, response.data);
        console.log(`  ✓ 已下载图片: ${filename}`);

        return `/images/posts/${filename}`;
    } catch (error) {
        console.error(`  下载图片失败 (${imageUrl}):`, error.message);
        // 如果下载失败，返回原始 URL（让 Hugo 直接使用外部链接）
        return imageUrl;
    }
}

/**
 * 获取 Notion 页面的完整内容（包括图片处理）
 */
async function getPageContent(notion, pageId) {
    const allBlocks = [];
    let hasMore = true;
    let startCursor = null;

    while (hasMore) {
        const listParams = {
            block_id: pageId,
        };

        // 只有当 startCursor 不为 null 时才添加
        if (startCursor) {
            listParams.start_cursor = startCursor;
        }

        const response = await notion.blocks.children.list(listParams);

        allBlocks.push(...response.results);
        hasMore = response.has_more;
        startCursor = response.next_cursor;
    }

    // 将 blocks 转换为 Markdown
    const markdownLines = [];
    let imageIndex = 0;

    for (const block of allBlocks) {
        const blockType = block.type;
        if (!block[blockType]) {
            continue;
        }

        const content = block[blockType];
        const text = extractTextFromBlock(block);

        switch (blockType) {
            case 'heading_1':
                if (text) {
                    markdownLines.push(`# ${text}\n`);
                }
                break;

            case 'heading_2':
                if (text) {
                    markdownLines.push(`## ${text}\n`);
                }
                break;

            case 'heading_3':
                if (text) {
                    markdownLines.push(`### ${text}\n`);
                }
                break;

            case 'paragraph':
                if (text) {
                    markdownLines.push(`${text}\n`);
                }
                break;

            case 'bulleted_list_item':
                if (text) {
                    markdownLines.push(`- ${text}\n`);
                }
                break;

            case 'numbered_list_item':
                if (text) {
                    markdownLines.push(`1. ${text}\n`);
                }
                break;

            case 'code':
                if (text) {
                    const language = content.language || '';
                    markdownLines.push(`\`\`\`${language}\n${text}\n\`\`\`\n`);
                }
                break;

            case 'quote':
                if (text) {
                    markdownLines.push(`> ${text}\n`);
                }
                break;

            case 'divider':
                markdownLines.push('---\n');
                break;

            case 'image':
                // 处理图片
                if (content.type === 'external' && content.external?.url) {
                    imageIndex++;
                    const localPath = await downloadImage(content.external.url, pageId, imageIndex);
                    const caption = content.caption
                        ?.map((item) => item.plain_text)
                        .join('') || '';
                    markdownLines.push(`![${caption}](${localPath})\n`);
                } else if (content.type === 'file' && content.file?.url) {
                    imageIndex++;
                    // Notion 文件 URL 需要特殊处理，可能需要认证
                    const imageUrl = content.file.url;
                    const localPath = await downloadImage(imageUrl, pageId, imageIndex);
                    const caption = content.caption
                        ?.map((item) => item.plain_text)
                        .join('') || '';
                    markdownLines.push(`![${caption}](${localPath})\n`);
                }
                break;

            case 'bookmark':
                if (content.url) {
                    const caption = text || content.url;
                    markdownLines.push(`[${caption}](${content.url})\n`);
                }
                break;

            case 'callout':
                if (text) {
                    const emoji = content.icon?.emoji || '💡';
                    markdownLines.push(`> ${emoji} ${text}\n`);
                }
                break;

            default:
                // 其他类型，尝试提取文本
                if (text) {
                    markdownLines.push(`${text}\n`);
                }
                break;
        }
    }

    return markdownLines.join('');
}

/**
 * 从页面属性中获取值
 */
function getPropertyValue(properties, propName, propType) {
    // 尝试多种可能的属性名称（不区分大小写）
    const propKeys = Object.keys(properties);
    let prop = null;

    for (const key of propKeys) {
        if (key.toLowerCase() === propName.toLowerCase()) {
            prop = properties[key];
            break;
        }
    }

    if (!prop || prop.type !== propType) {
        return null;
    }

    switch (propType) {
        case 'title':
            return prop.title
                ?.map((item) => item.plain_text)
                .join('') || null;

        case 'rich_text':
            return prop.rich_text
                ?.map((item) => item.plain_text)
                .join('') || null;

        case 'date':
            return prop.date?.start || null;

        case 'select':
            return prop.select?.name || null;

        case 'multi_select':
            return prop.multi_select?.map((item) => item.name) || [];

        default:
            return null;
    }
}

/**
 * 将标题转换为安全的文件名
 */
function sanitizeFilename(title) {
    // 移除特殊字符，保留中文字符、字母、数字和连字符
    let filename = title.replace(/[^\w\s-]/g, '');
    // 将空格替换为连字符
    filename = filename.replace(/\s+/g, '-');
    // 转换为小写
    return filename.toLowerCase() || 'untitled';
}

/**
 * 格式化日期为 Hugo front matter 格式
 */
function formatDate(dateStr) {
    if (!dateStr) {
        return new Date().toISOString().replace('Z', '+08:00');
    }

    try {
        const date = new Date(dateStr);
        // 转换为北京时间 (UTC+8)
        const beijingTime = new Date(date.getTime() + 8 * 60 * 60 * 1000);
        return beijingTime.toISOString().replace('Z', '+08:00');
    } catch {
        return new Date().toISOString().replace('Z', '+08:00');
    }
}

/**
 * 从 Notion 页面创建 Hugo 文章
 */
async function createHugoPost(notion, page) {
    const properties = page.properties || {};

    // 获取标题
    const title =
        getPropertyValue(properties, 'Title', 'title') ||
        getPropertyValue(properties, 'title', 'title') ||
        'Untitled';

    // 获取其他属性
    const description =
        getPropertyValue(properties, 'Description', 'rich_text') ||
        getPropertyValue(properties, 'description', 'rich_text') ||
        '';

    // 优先使用 Publish Date，如果没有则使用 Date，最后使用创建时间
    const dateStr =
        getPropertyValue(properties, 'Publish Date', 'date') ||
        getPropertyValue(properties, 'PublishDate', 'date') ||
        getPropertyValue(properties, 'publish_date', 'date') ||
        getPropertyValue(properties, 'Date', 'date') ||
        getPropertyValue(properties, 'date', 'date') ||
        page.created_time;

    const tags =
        getPropertyValue(properties, 'Tags', 'multi_select') ||
        getPropertyValue(properties, 'tags', 'multi_select') ||
        [];

    // 获取 Category（可能是 select 或 multi_select）
    let category =
        getPropertyValue(properties, 'Category', 'select') ||
        getPropertyValue(properties, 'category', 'select');

    // 如果没有 select 类型的 Category，尝试 multi_select
    if (!category) {
        const categories =
            getPropertyValue(properties, 'Category', 'multi_select') ||
            getPropertyValue(properties, 'category', 'multi_select') ||
            getPropertyValue(properties, 'Categories', 'multi_select') ||
            getPropertyValue(properties, 'categories', 'multi_select') ||
            [];
        category = Array.isArray(categories) && categories.length > 0 ? categories[0] : null;
    }

    // 获取页面内容
    const pageId = page.id;
    const content = await getPageContent(notion, pageId);

    // 根据 Category 确定文件夹
    let targetDir = CONTENT_DIR;
    if (category) {
        // 清理分类名称，确保是安全的文件夹名
        const categoryDir = sanitizeFilename(category);
        targetDir = path.join(CONTENT_DIR, categoryDir);
        // 确保目录存在
        await fs.mkdir(targetDir, { recursive: true });
    }

    // 生成文件名
    const filename = sanitizeFilename(title);
    const filepath = path.join(targetDir, `${filename}.md`);

    // 生成 front matter
    const frontMatter = {
        title: title,
        date: formatDate(dateStr),
        draft: false,
    };

    if (description) {
        frontMatter.description = description;
    }

    if (tags && tags.length > 0) {
        frontMatter.tags = Array.isArray(tags) ? tags : [tags];
    }

    // 添加分类到 front matter
    if (category) {
        frontMatter.categories = [category];
    }

    // 写入文件
    let fileContent = '---\n';
    for (const [key, value] of Object.entries(frontMatter)) {
        if (Array.isArray(value)) {
            fileContent += `${key}: ${JSON.stringify(value)}\n`;
        } else if (typeof value === 'string' && (value.includes("'") || value.includes('"'))) {
            fileContent += `${key}: "${value.replace(/"/g, '\\"')}"\n`;
        } else {
            fileContent += `${key}: ${value}\n`;
        }
    }
    fileContent += '---\n\n';
    fileContent += content;

    await fs.writeFile(filepath, fileContent, 'utf-8');
    const categoryInfo = category ? ` [分类: ${category}]` : '';
    console.log(`✓ 已创建文章: ${filepath}${categoryInfo}`);
}

/**
 * 主函数
 */
async function main() {
    if (!NOTION_TOKEN) {
        console.error('错误: 未设置 NOTION_TOKEN 环境变量');
        process.exit(1);
    }

    if (!NOTION_DATABASE_ID) {
        console.error('错误: 未设置 NOTION_DATABASE_ID 环境变量');
        process.exit(1);
    }

    // 确保目录存在
    await fs.mkdir(CONTENT_DIR, { recursive: true });
    await fs.mkdir(IMAGES_DIR, { recursive: true });

    console.log('开始从 Notion 同步笔记...');
    console.log('过滤条件: Status = "Done"');

    try {
        const notion = initNotionClient();

        // 查询数据库
        const pages = await queryNotionDatabase(notion);
        console.log(`找到 ${pages.length} 个状态为 "Done" 的页面`);

        // 处理每个页面
        for (const page of pages) {
            try {
                await createHugoPost(notion, page);
            } catch (error) {
                console.error(`处理页面时出错:`, error.message);
                continue;
            }
        }

        console.log('同步完成！');
    } catch (error) {
        console.error('同步失败:', error.message);
        process.exit(1);
    }
}

// 运行主函数
main().catch((error) => {
    console.error('未处理的错误:', error);
    process.exit(1);
});

