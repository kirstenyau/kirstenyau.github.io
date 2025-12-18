const { Client } = require("@notionhq/client");
const { NotionToMarkdown } = require("notion-to-md");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("🚀 啟動同步程序...");

  // 1. 檢查環境變數
  const auth = process.env.NOTION_TOKEN;
  const databaseId = process.env.NOTION_DATABASE_ID;

  if (!auth || !databaseId) {
    console.error("❌ 錯誤：找不到 NOTION_TOKEN 或 NOTION_DATABASE_ID。請檢查 GitHub Secrets！");
    process.exit(1);
  }

  // 2. 初始化 Notion 客戶端
  const notion = new Client({ auth: auth });
  const n2m = new NotionToMarkdown({ notionClient: notion });

  try {
    console.log("📡 正在從 Notion 讀取資料...");
    const response = await notion.databases.query({
      database_id: databaseId,
      filter: {
        property: "Status",
        select: { equals: "Published" },
      },
    });

    console.log(`✅ 成功連通！找到 ${response.results.length} 篇發佈的文章。`);

    // 3. 確保 posts 資料夾存在
    const postsDir = path.join(__dirname, "posts");
    if (!fs.existsSync(postsDir)) {
      fs.mkdirSync(postsDir);
      console.log("📁 已建立 posts 資料夾");
    }

    // 4. 轉換並儲存文章
    for (const page of response.results) {
      const title = page.properties.Name?.title[0]?.plain_text || "Untitled";
      const slug = page.properties.Slug?.rich_text[0]?.plain_text || `post-${page.id}`;
      const date = page.properties.Date?.date?.start || new Date().toISOString().split('T')[0];

      console.log(`📝 正在轉換文章：${title}...`);

      const mdblocks = await n2m.pageToMarkdown(page.id);
      const mdString = n2m.toMarkdownString(mdblocks);

      const content = `---
title: "${title}"
date: "${date}"
---

${mdString.parent}`;

      fs.writeFileSync(path.join(postsDir, `${slug}.md`), content);
      console.log(`✨ 已生成檔案：${slug}.md`);
    }

    console.log("🎉 所有文章同步完成！");
  } catch (error) {
    console.error("❌ 同步過程中出錯：");
    console.error(error.message);
    process.exit(1);
  }
}

main();
