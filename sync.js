const fs = require("fs");
const path = require("path");

async function main() {
  console.log("🚀 啟動同步程序 (手動請求穩定版)...");

  const auth = process.env.NOTION_TOKEN ? process.env.NOTION_TOKEN.trim() : null;
  const databaseId = process.env.NOTION_DATABASE_ID ? process.env.NOTION_DATABASE_ID.trim() : null;

  if (!auth || !databaseId) {
    console.error("❌ 錯誤：找不到環境變數。");
    process.exit(1);
  }

  try {
    console.log("📡 正在從 Notion 獲取資料...");
    const response = await fetch(`https://api.notion.com/v1/databases/${databaseId}/query`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${auth}`,
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        filter: { property: "Status", status: { equals: "Published" } }
      })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(`Notion API 報錯: ${data.message}`);

    console.log(`✅ 成功獲取 ${data.results.length} 篇文章。`);

    // --- 核心改動：建立文章清單 ---
    const postsList = [];
    const postsDir = path.join(__dirname, "posts");
    if (!fs.existsSync(postsDir)) fs.mkdirSync(postsDir);

    const { Client } = require("@notionhq/client");
    const { NotionToMarkdown } = require("notion-to-md");
    const notion = new Client({ auth: auth });
    const n2m = new NotionToMarkdown({ notionClient: notion });

    for (const page of data.results) {
      const title = page.properties.Name?.title[0]?.plain_text || "Untitled";
      const slug = page.properties.Slug?.rich_text[0]?.plain_text || `post-${page.id}`;
      const date = page.properties.Date?.date?.start || new Date().toISOString().split('T')[0];

      // 將文章資訊加入清單
      postsList.push({ title, slug, date });

      console.log(`📝 正在轉換：${title}`);
      const mdblocks = await n2m.pageToMarkdown(page.id);
      const mdString = n2m.toMarkdownString(mdblocks);
      const content = `---\ntitle: "${title}"\ndate: "${date}"\n---\n\n${mdString.parent}`;
      
      fs.writeFileSync(path.join(postsDir, `${slug}.md`), content);
    }

    // 將清單存成 posts.json，這就是前端 index.html 讀取的對象
    fs.writeFileSync(path.join(__dirname, "posts.json"), JSON.stringify(postsList, null, 2));
    console.log("📋 posts.json 清單已更新！");

    console.log("🎉 所有文章同步完成！");
  } catch (error) {
    console.error("❌ 發生錯誤：", error.message);
    process.exit(1);
  }
}

main();
