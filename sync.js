const { Client } = require("@notionhq/client");
const { NotionToMarkdown } = require("notion-to-md");
const fs = require("fs");
const path = require("path");

// 💡 修正初始化方式：確保 Client 屬性被正確調用
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
    console.log("📡 正在從 Notion 獲取資料...");
    // 💡 核心修正：確認此處調用結構
    const response = await notion.databases.query({
      database_id: databaseId,
      filter: {
        property: "Status",
        select: { equals: "Published" }
      },
    });

    console.log(`✅ 成功獲取 ${response.results.length} 篇文章。`);
    const postsList = [];

    for (const page of response.results) {
      // 處理標題：考慮 Name 或 Title 兩種欄位名稱
      const titleProp = page.properties.Name || page.properties.Title;
      const title = titleProp?.title[0]?.plain_text || "Untitled";
      
      // 處理日期
      const dateProp = page.properties.Date;
      const date = dateProp?.date?.start || new Date().toISOString().split('T')[0];

      // 處理 Slug：優先讀取 slug 欄位，沒有的話將標題轉英文
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

    // 儲存 posts.json
    fs.writeFileSync(path.join(postsDir, "posts.json"), JSON.stringify(postsList, null, 2));
    
    console.log("📋 posts.json 已更新！");
    console.log("🎉 所有文章同步完成！");
  } catch (error) {
    console.error("❌ 發生錯誤詳情：");
    console.error(error);
    process.exit(1);
  }
}

sync();
