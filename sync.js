const { Client } = require("@notionhq/client");
const { NotionToMarkdown } = require("notion-to-md");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("🚀 啟動同步程序...");

  const auth = process.env.NOTION_TOKEN;
  const databaseId = process.env.NOTION_DATABASE_ID;

  if (!auth || !databaseId) {
    console.error("❌ 錯誤：找不到 TOKEN 或 ID");
    process.exit(1);
  }

  const notion = new Client({ auth: auth });
  const n2m = new NotionToMarkdown({ notionClient: notion });

  try {
    console.log("📡 正在連接 Notion API...");
    
    // 使用 request 方法更為穩定
    const response = await notion.request({
      path: `databases/${databaseId}/query`,
      method: "POST",
      body: {
        filter: {
          property: "Status",
          select: { equals: "Published" },
        },
      },
    });

    console.log(`✅ 成功連通！找到 ${response.results.length} 篇發佈的文章。`);

    const postsDir = path.join(__dirname, "posts");
    if (!fs.existsSync(postsDir)) fs.mkdirSync(postsDir);

    for (const page of response.results) {
      const title = page.properties.Name?.title[0]?.plain_text || "Untitled";
      const slug = page.properties.Slug?.rich_text[0]?.plain_text || `post-${page.id}`;
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
