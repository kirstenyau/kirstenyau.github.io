const { Client } = require("@notionhq/client");
const { NotionToMarkdown } = require("notion-to-md");
const fs = require("fs");
const path = require("path");

// 💡 確保 Client 正確初始化
const notion = new Client({ 
  auth: process.env.NOTION_TOKEN 
});

const n2m = new NotionToMarkdown({ 
  notionClient: notion 
});

async function sync() {
  console.log("🚀 啟動同步程序...");
  const databaseId = process.env.NOTION_DATABASE_ID;
  const postsDir = path.join(__dirname, "posts");

  if (!fs.existsSync(postsDir)) {
    fs.mkdirSync(postsDir);
  }

  try {
    // 💡 再次確認此處調用方式
    const response = await notion.databases.query({
      database_id: databaseId,
      filter: {
        property: "Status",
        select: { equals: "Published" }
      },
    });

    const postsList = [];

    for (const page of response.results) {
      // 處理 Name 屬性 (Notion 預設標題欄位通常叫 Name 或 Title)
      const titleProp = page.properties.Name || page.properties.Title;
      const title = titleProp?.title[0]?.plain_text || "Untitled";
      
      const dateProp = page.properties.Date;
      const date = dateProp?.date?.start || new Date().toISOString().split('T')[0];

      let slug = page.properties.slug?.rich_text[0]?.plain_text;
      if (!slug) {
        slug = title.toLowerCase()
                    .replace(/[^\w\s-]/g, '')
                    .replace(/\s+/g, '-');
      }

      postsList.push({ title, slug, date });

      console.log(`📝 正在轉換：${title}`);
      const mdblocks = await n2m.pageToMarkdown(page.id);
      const mdString = n2m.toMarkdownString(mdblocks);
      
      const content = `---\ntitle: "${title}"\ndate: "${date}"\n---\n\n${mdString.parent}`;
      
      fs.writeFileSync(path.join(postsDir, `${slug}.md`), content);
    }

    fs.writeFileSync(path.join(postsDir, "posts.json"), JSON.stringify(postsList, null, 2));
    
    console.log("📋 posts.json 清單已更新！");
    console.log("🎉 所有文章同步完成！");
  } catch (error) {
    console.error("❌ 發生錯誤：", error); // 💡 印出完整 error 物件以便排錯
    process.exit(1);
  }
}

sync();
