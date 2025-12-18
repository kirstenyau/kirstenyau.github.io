const fs = require("fs");
const path = require("path");

async function main() {
  console.log("🚀 啟動同步程序 (手動請求版)...");

  const auth = process.env.NOTION_TOKEN ? process.env.NOTION_TOKEN.trim() : null;
  const databaseId = process.env.NOTION_DATABASE_ID ? process.env.NOTION_DATABASE_ID.trim() : null;

  if (!auth || !databaseId) {
    console.error("❌ 錯誤：環境變數缺失。");
    process.exit(1);
  }

  try {
    console.log("📡 正在發送 API 請求到 Notion...");

    // 直接使用 fetch (Node 18+ 內建) 發送請求
    const response = await fetch(`https://api.notion.com/v1/databases/${databaseId}/query`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${auth}`,
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        filter: {
          property: "Status",
          select: { equals: "Published" }
        }
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(`Notion API 報錯: ${data.message || response.statusText}`);
    }

    console.log(`✅ 成功連通！找到 ${data.results.length} 篇發佈的文章。`);

    const postsDir = path.join(__dirname, "posts");
    if (!fs.existsSync(postsDir)) fs.mkdirSync(postsDir);

    // 這裡我們需要安裝 notion-to-md 來轉 Markdown，但查詢部分已經繞過 SDK 錯誤
    const { Client } = require("@notionhq/client");
    const { NotionToMarkdown } = require("notion-to-md");
    const notion = new Client({ auth: auth });
    const n2m = new NotionToMarkdown({ notionClient: notion });

    for (const page of data.results) {
      const title = page.properties.Name?.title[0]?.plain_text || "Untitled";
      const slug = page.properties.Slug?.rich_text[0]?.plain_text || `post-${page.id}`;
      const date = page.properties.Date?.date?.start || new Date().toISOString().split('T')[0];

      console.log(`📝 正在轉換：${title}`);

      const mdblocks = await n2m.pageToMarkdown(page.id);
      const mdString = n2m.toMarkdownString(mdblocks);

      const content = `---
title: "${title}"
date: "${date}"
---

${mdString.parent}`;

      fs.writeFileSync(path.join(postsDir, `${slug}.md`), content);
    }

    console.log("🎉 所有文章同步成功！");
  } catch (error) {
    console.error("❌ 發生錯誤：", error.message);
    process.exit(1);
  }
}

main();
