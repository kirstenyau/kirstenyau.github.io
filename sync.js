const { Client } = require("@notionhq/client");
const { NotionToMarkdown } = require("notion-to-md");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("🚀 啟動同步程序...");

  // 讀取環境變數
  const auth = process.env.NOTION_TOKEN;
  const databaseId = process.env.NOTION_DATABASE_ID;

  // 偵錯訊息：確認變數是否有傳進來
  console.log("檢查變數狀態：", {
    TOKEN_是否存在: !!auth,
    DATABASE_ID_是否存在: !!databaseId
  });

  if (!auth || !databaseId) {
    console.error("❌ 錯誤：找不到 NOTION_TOKEN 或 NOTION_DATABASE_ID。");
    console.error("請檢查 GitHub Settings -> Secrets -> Actions 中的變數名稱是否正確。");
    process.exit(1);
  }

  const notion = new Client({ auth: auth });
  const n2m = new NotionToMarkdown({ notionClient: notion });

  try {
    console.log("📡 正在從 Notion 讀取資料...");
    const response = await notion.databases.query({
      database_id: databaseId,
      filter: {
        property: "Status", // 請確保你的 Notion 裡有這個欄位
        select: { equals: "Published" }, // 請確保狀態是 Published
      },
    });

    console.log(`✅ 成功連通！找到 ${response.results.length} 篇發佈的文章。`);

    const postsDir = path.join(__dirname, "posts");
    if (!fs.existsSync(postsDir)) fs.mkdirSync(postsDir);

    for (const page of response.results) {
      // 取得標題
      const title = page.properties.Name?.title[0]?.plain_text || "Untitled";
      // 取得 Slug (用於檔名)
      const slug = page.properties.Slug?.rich_text[0]?.plain_text || `post-${page.id}`;
      // 取得日期
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
    process.exit(1);
  }
}

main();
