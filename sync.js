const fs = require("fs");
const path = require("path");
const { NotionToMarkdown } = require("notion-to-md");
const { Client } = require("@notionhq/client");

async function sync() {
  console.log("🚀 啟動同步程序 (穩定模式)...");
  
  const token = process.env.NOTION_TOKEN;
  const databaseId = process.env.NOTION_DATABASE_ID;
  const postsDir = path.join(__dirname, "posts");

  if (!fs.existsSync(postsDir)) fs.mkdirSync(postsDir);

  try {
    console.log("📡 正在從 Notion 獲取資料...");

    // 使用原生 fetch 直接請求資料庫，避開 SDK 報錯
    const response = await fetch(`https://api.notion.com/v1/databases/${databaseId}/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        filter: { property: "Status", select: { equals: "Published" } }
      })
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(`Notion API 報錯: ${error.message}`);
    }

    const data = await response.json();
    console.log(`✅ 成功獲取 ${data.results.length} 篇文章。`);

    // 為了轉換內文，我們還是需要初始化一個簡單的 notion 客戶端給 n2m 使用
    const notionClient = new Client({ auth: token });
    const n2m = new NotionToMarkdown({ notionClient });

    const postsList = [];

    for (const page of data.results) {
      // 獲取標題 (相容 Name 或 Title 欄位)
      const titleProp = page.properties.Name || page.properties.Title;
      const title = titleProp?.title[0]?.plain_text || "Untitled";
      
      const date = page.properties.Date?.date?.start || new Date().toISOString().split('T')[0];
      
      let slug = page.properties.slug?.rich_text[0]?.plain_text;
      if (!slug) {
        slug = title.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-');
      }

      postsList.push({ title, slug, date });

      console.log(`📝 正在轉換：${title}`);
      const mdblocks = await n2m.pageToMarkdown(page.id);
      const mdString = n2m.toMarkdownString(mdblocks);
      
      const content = `---\ntitle: "${title}"\ndate: "${date}"\n---\n\n${mdString.parent}`;
      fs.writeFileSync(path.join(postsDir, `${slug}.md`), content);
    }

    // 儲存清單到 posts/posts.json
    fs.writeFileSync(path.join(postsDir, "posts.json"), JSON.stringify(postsList, null, 2));
    console.log("📋 posts.json 清單已更新！");
    console.log("🎉 所有文章同步完成！");

  } catch (error) {
    console.error("❌ 發生錯誤：", error.message);
    process.exit(1);
  }
}

sync();
