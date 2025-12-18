const { Client } = require("@notionhq/client");
const { NotionToMarkdown } = require("notion-to-md");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("🚀 啟動同步程序...");

  // 從環境變數讀取，並使用 .trim() 刪除可能存在的空白
  const auth = process.env.NOTION_TOKEN ? process.env.NOTION_TOKEN.trim() : null;
  const databaseId = process.env.NOTION_DATABASE_ID ? process.env.NOTION_DATABASE_ID.trim() : null;

  if (!auth || !databaseId) {
    console.error("❌ 錯誤：找不到 NOTION_TOKEN 或 NOTION_DATABASE_ID，請檢查 GitHub Secrets。");
    process.exit(1);
  }

  const notion = new Client({ auth: auth });
  const n2m = new NotionToMarkdown({ notionClient: notion });

  try {
    console.log("📡 正在從 Notion 讀取資料庫...");

    // 使用官方標準 method，不手動拼接 URL 避免 'invalid_request_url'
    const response = await notion.databases.query({
      database_id: databaseId,
      filter: {
        property: "Status",
        select: { equals: "Published" },
      },
    });

    console.log(`✅ 成功連通！找到 ${response.results.length} 篇發佈的文章。`);

    const postsDir = path.join(__dirname, "posts");
    if (!fs.existsSync(postsDir)) fs.mkdirSync(postsDir);

    for (const page of response.results) {
      // 取得標題 (Name)
      const title = page.properties.Name?.title[0]?.plain_text || "Untitled";
      // 取得 Slug
      const slug = page.properties.Slug?.rich_text[0]?.plain_text || `post-${page.id}`;
      // 取得日期 (Date)
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

    console.log("🎉 所有文章同步完成！");
  } catch (error) {
    console.error("❌ 同步過程中發生錯誤：", error.message);
    // 如果報錯是 404，通常是忘記在 Notion 頁面做 Add Connections
    if (error.message.includes("Could not find database")) {
      console.error("💡 提示：請檢查 Notion 頁面右上角是否已 'Add connections' 給你的 Bot。");
    }
    process.exit(1);
  }
}

main();
