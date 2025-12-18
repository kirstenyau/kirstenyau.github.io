const fs = require("fs");
const path = require("path");

async function main() {
  console.log("🚀 啟動同步程序 (手動請求穩定版)...");

  // 讀取並清理環境變數
  const auth = process.env.NOTION_TOKEN ? process.env.NOTION_TOKEN.trim() : null;
  const databaseId = process.env.NOTION_DATABASE_ID ? process.env.NOTION_DATABASE_ID.trim() : null;

  if (!auth || !databaseId) {
    console.error("❌ 錯誤：找不到環境變數，請檢查 GitHub Secrets 設定。");
    process.exit(1);
  }

  try {
    console.log("📡 正在發送 API 請求到 Notion...");

    // 使用 Node 18 內建的 fetch，避免 SDK 版本衝突
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
          // 關鍵修正：將 select 改為 status
          status: { 
            equals: "Published" 
          }
        }
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(`Notion API 報錯: ${data.message || response.statusText}`);
    }

    console.log(`✅ 成功連通！找到 ${data.results.length} 篇發佈的文章。`);

    if (data.results.length === 0) {
      console.log("⚠️ 提示：資料庫中目前沒有文章狀態為 'Published'。");
      return;
    }

    // 初始化 Markdown 轉換工具
    const { Client } = require("@notionhq/client");
    const { NotionToMarkdown } = require("notion-to-md");
    const notion = new Client({ auth: auth });
    const n2m = new NotionToMarkdown({ notionClient: notion });

    const postsDir = path.join(__dirname, "posts");
    if (!fs.existsSync(postsDir)) fs.mkdirSync(postsDir);

    for (const page of data.results) {
      // 取得標題
      const title = page.properties.Name?.title[0]?.plain_text || "Untitled";
      // 取得 Slug
      const slug = page.properties.Slug?.rich_text[0]?.plain_text || `post-${page.id}`;
      // 取得日期
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
// 在 main 函式的最後，console.log("🎉 所有文章同步完成！"); 之前加入：
    const postsList = data.results.map(page => ({
      title: page.properties.Name?.title[0]?.plain_text || "Untitled",
      slug: page.properties.Slug?.rich_text[0]?.plain_text || `post-${page.id}`,
      date: page.properties.Date?.date?.start || new Date().toISOString().split('T')[0]
    }));
    fs.writeFileSync(path.join(__dirname, "posts.json"), JSON.stringify(postsList, null, 2));
    console.log("📋 posts.json 目錄已更新！");
    console.log("🎉 所有文章同步完成！");
  } catch (error) {
    console.error("❌ 發生錯誤：", error.message);
    process.exit(1);
  }
}

main();
