const { Client } = require("@notionhq/client");
const { NotionToMarkdown } = require("notion-to-markdown");
const fs = require("fs");
const path = require("path");

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const n2m = new NotionToMarkdown({ notionClient: notion });

async function sync() {
  console.log("🚀 啟動同步程序...");
  const databaseId = process.env.NOTION_DATABASE_ID;
  const postsDir = path.join(__dirname, "posts");

  if (!fs.existsSync(postsDir)) fs.mkdirSync(postsDir);

  try {
    const response = await notion.databases.query({
      database_id: databaseId,
      filter: { property: "Status", select: { equals: "Published" } }, // 💡 只抓取已發布文章
    });

    const postsList = [];

    for (const page of response.results) {
      const title = page.properties.Name.title[0].plain_text;
      const date = page.properties.Date.date.start;
      // 優先讀取 slug 屬性，若無則使用標題作為檔名
      const slug = page.properties.slug?.rich_text[0]?.plain_text || title.replace(/\s+/g, '-').toLowerCase();

      postsList.push({ title, slug, date });

      console.log(`📝 正在轉換：${title}`);
      const mdblocks = await n2m.pageToMarkdown(page.id);
      const mdString = n2m.toMarkdownString(mdblocks);
      
      // Notion 匯出通常自帶標題資訊，我們將其封裝在 Front Matter
      const content = `---\ntitle: "${title}"\ndate: "${date}"\n---\n\n${mdString.parent}`;
      
      fs.writeFileSync(path.join(postsDir, `${slug}.md`), content);
    }

    // ✨ 修正路徑：確保 posts.json 存在 posts/ 資料夾內
    fs.writeFileSync(path.join(postsDir, "posts.json"), JSON.stringify(postsList, null, 2));
    
    console.log("📋 posts.json 清單已更新於 posts/ 目錄！");
    console.log("🎉 所有文章同步完成！");
  } catch (error) {
    console.error("❌ 發生錯誤：", error.message);
    process.exit(1);
  }
}

sync();
