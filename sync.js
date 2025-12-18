const { Client } = require("@notionhq/client");
const { NotionToMarkdown } = require("notion-to-md");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("🚀 啟動同步程序...");

  // 1. 取得並清理環境變數
  const auth = process.env.NOTION_TOKEN ? process.env.NOTION_TOKEN.trim() : null;
  const databaseId = process.env.NOTION_DATABASE_ID ? process.env.NOTION_DATABASE_ID.trim() : null;

  if (!auth || !databaseId) {
    console.error("❌ 錯誤：環境變數缺失，請檢查 GitHub Secrets (NOTION_TOKEN 或 NOTION_DATABASE_ID)");
    process.exit(1);
  }

  // 2. 初始化 Notion Client (確保這部分在 try 之前成功)
  const notion = new Client({ auth: auth });
  const n2m = new NotionToMarkdown({ notionClient: notion });

  try {
    console.log("📡 正在連接 Notion API 並讀取資料庫...");

    // 3. 執行查詢
    const response = await notion.databases.query({
      database_id: databaseId,
      filter: {
        property: "Status",
        select: {
          equals: "Published",
        },
      },
    });

    console.log(`✅ 成功連通！找到 ${response.results.length} 篇發佈的文章。`);

    if (response.results.length === 0) {
      console.log("⚠️ 提示：資料庫中沒有狀態為 'Published' 的文章。");
      return;
    }

    const postsDir = path.join(__dirname, "posts");
    if (!fs.existsSync(postsDir)) fs.mkdirSync(postsDir);

    for (const page of response.results) {
      const title = page.properties.Name?.title[0]?.plain_text || "Untitled";
      const slug = page.properties.Slug?.rich_text[0]?.plain_text || `post-${page.id}`;
      const date = page.properties.Date?.date?.start || new Date().toISOString().split('T')[0];

      console.log(`📝 正在轉換文章：${title}`);

      const mdblocks = await n2m.pageToMarkdown(page.id);
      const mdString = n2m.toMarkdownString(mdblocks);

      const content = `---
title: "${title}"
date: "${date}"
---

${mdString.parent}`;

      fs.writeFileSync(path.join(postsDir, `${slug}.md`), content);
    }

    console.log("🎉 所有文章同步成功完成！");
  } catch (error) {
    console.error("❌ 發生錯誤：");
    if (error.status === 404) {
      console.error("錯誤代碼 404：找不到資料庫。請確認 ID 正確，且已在 Notion 頁面中 'Add connections'。");
    } else if (error.status === 401) {
      console.error("錯誤代碼 401：Token 無效，請檢查 NOTION_TOKEN。");
    } else {
      console.error(error.message);
    }
    process.exit(1);
  }
}

main();
