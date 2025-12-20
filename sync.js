const { NotionToMarkdown } = require("notion-to-md");
const fs = require("fs");
const path = require("path");

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const DATABASE_ID = process.env.NOTION_DATABASE_ID;

// 這裡我們只手動處理資料庫查詢，內文轉換仍交給 notion-to-md
async function getNotionDatabase() {
  const url = `https://api.notion.com/v1/databases/${DATABASE_ID}/query`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${NOTION_TOKEN}`,
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
  
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`Notion API 錯誤: ${JSON.stringify(errorData)}`);
  }
  return await response.json();
}

async function sync() {
  console.log("🚀 啟動同步程序 (Fetch 模式)...");
  const postsDir = path.join(__dirname, "posts");
  if (!fs.existsSync(postsDir)) fs.mkdirSync(postsDir);

  try {
    const data = await getNotionDatabase();
    console.log(`✅ 成功獲取 ${data.results.length} 篇文章。`);

    // 為了讓 notion-to-md 運作，我們還是需要一個簡單的 client 偽裝
    const { Client } = require("@notionhq/client");
    const notionProxy = new Client({ auth: NOTION_TOKEN });
    const n2m = new NotionToMarkdown({ notionClient: notionProxy });

    const postsList = [];

    for (const page of data.results) {
      const title = page.properties.Name?.title[0]?.plain_text || 
                    page.properties.Title?.title[0]?.plain_text || "Untitled";
      
      const date = page.properties.Date?.date?.start || new Date().toISOString().split('T')[0];
      
      let slug = page.properties.slug?.rich_text[0]?.plain_text;
      if (!slug) {
        slug = title.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-');
      }

      postsList.push({ title, slug, date });

      console.log(`📝 正在轉換：${title} (slug: ${slug})`);
      const mdblocks = await n2m.pageToMarkdown(page.id);
      const mdString = n2m.toMarkdownString(mdblocks);
      
      const content = `---\ntitle: "${title}"\ndate: "${date}"\n---\n\n${mdString.parent}`;
      fs.writeFileSync(path.join(postsDir, `${slug}.md`), content);
    }

    fs.writeFileSync(path.join(postsDir, "posts.json"), JSON.stringify(postsList, null, 2));
    console.log("📋 posts.json 已更新！");
    console.log("🎉 所有文章同步完成！");
  } catch (error) {
    console.error("❌ 執行失敗：", error.message);
    process.exit(1);
  }
}

sync();
