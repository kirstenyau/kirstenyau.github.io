const { Client } = require("@notionhq/client");
const { NotionToMarkdown } = require("notion-to-md"); // 💡 已修正
const fs = require("fs");
const path = require("path");

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const n2m = new NotionToMarkdown({ notionClient: notion });

async function sync() {
  console.log("🚀 啟動同步程序...");
  const databaseId = process.env.NOTION_DATABASE_ID;
  const postsDir = path.join(__dirname, "posts");

  // 確保 posts 資料夾存在
  if (!fs.existsSync(postsDir)) {
    fs.mkdirSync(postsDir);
  }

  try {
    const response = await notion.databases.query({
      database_id: databaseId,
      filter: {
        property: "Status",
        select: { equals: "Published" } // 只抓取狀態為 Published 的文章
      },
    });

    const postsList = [];

    for (const page of response.results) {
      // 獲取標題
      const title = page.properties.Name?.title[0]?.plain_text || "Untitled";
      // 獲取日期
      const date = page.properties.Date?.date?.start || new Date().toISOString().split('T')[0];
      // 獲取 slug (優先讀取 slug 屬性，若無則將標題轉為 slug)
      let slug = page.properties.slug?.rich_text[0]?.plain_text;
      if (!slug) {
        slug = title.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-');
      }

      postsList.push({ title, slug, date });

      console.log(`📝 正在轉換：${title}`);
      const mdblocks = await n2m.pageToMarkdown(page.id);
      const mdString = n2m.toMarkdownString(mdblocks);
      
      // 內容包含 Front Matter 供 Debug 或其他用途
      const content = `---\ntitle: "${title}"\ndate: "${date}"\n---\n\n${mdString.parent}`;
      
      // 寫入 .md 檔案
      fs.writeFileSync(path.join(postsDir, `${slug}.md`), content);
    }

    // 將 posts.json 寫入 posts/ 資料夾內，確保 post.html 可以讀取
    fs.writeFileSync(path.join(postsDir, "posts.json"), JSON.stringify(postsList, null, 2));
    
    console.log("📋 posts.json 清單已更新！");
    console.log("🎉 所有文章同步完成！");
  } catch (error) {
    console.error("❌ 發生錯誤：", error.message);
    process.exit(1);
  }
}

sync();
