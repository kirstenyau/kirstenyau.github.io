const { Client } = require("@notionhq/client");
const { NotionToMarkdown } = require("notion-to-md");
const fs = require("fs");

async function main() {
  const notion = new Client({ auth: process.env.NOTION_TOKEN });
  const n2m = new NotionToMarkdown({ notionClient: notion });

  const response = await notion.databases.query({
    database_id: process.env.NOTION_DATABASE_ID,
    filter: { property: "Status", select: { equals: "Published" } },
  });

  if (!fs.existsSync("./posts")) fs.mkdirSync("./posts");

  for (const page of response.results) {
    const title = page.properties.Name.title[0].plain_text;
    const slug = page.properties.Slug.rich_text[0].plain_text;
    const mdblocks = await n2m.pageToMarkdown(page.id);
    const mdString = n2m.toMarkdownString(mdblocks);
    fs.writeFileSync(`./posts/${slug}.md`, `---\ntitle: "${title}"\n---\n\n${mdString.parent}`);
  }
}
main();
