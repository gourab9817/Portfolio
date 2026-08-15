"use strict";

const fs = require("fs");
const path = require("path");
const matter = require("gray-matter");
const MarkdownIt = require("markdown-it");
const hljs = require("highlight.js");

const { listTemplate, postTemplate, categoriesTemplate, slugifyTag } = require("./templates");

const BLOG_DIR = path.resolve(__dirname, "..");
const REPO_ROOT = path.resolve(BLOG_DIR, "..");
const CONTENT_DIR = path.join(BLOG_DIR, "content");
const OUT_DIR = path.join(BLOG_DIR, "public");
const SITE_URL = "https://blogs.gourabchoudhury.dev";

const CATEGORY_LABELS = {
  ai: "AI",
  tech: "Tech",
  tools: "Tools",
  "new-launch": "New Launch",
};

const md = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: true,
  highlight(str, lang) {
    if (lang && hljs.getLanguage(lang)) {
      try {
        const highlighted = hljs.highlight(str, { language: lang, ignoreIllegals: true }).value;
        return `<pre class="hljs"><code>${highlighted}</code></pre>`;
      } catch (_) {
        /* fall through to escaped output below */
      }
    }
    return `<pre class="hljs"><code>${md.utils.escapeHtml(str)}</code></pre>`;
  },
});

function titleCase(slug) {
  return slug
    .split("-")
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
}

function categoryLabel(slug) {
  return CATEGORY_LABELS[slug] || titleCase(slug);
}

function normalizeDate(rawDate) {
  // gray-matter's YAML parser turns unquoted YYYY-MM-DD into a Date object.
  if (rawDate instanceof Date) return rawDate.toISOString().slice(0, 10);
  return String(rawDate);
}

function slugify(input) {
  return String(input)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function formatDate(dateStr) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return dateStr;
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(d);
}

function readPosts() {
  const posts = [];
  if (!fs.existsSync(CONTENT_DIR)) return posts;

  const categoryDirs = fs
    .readdirSync(CONTENT_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory());

  for (const dirent of categoryDirs) {
    const categorySlug = dirent.name;
    const categoryPath = path.join(CONTENT_DIR, categorySlug);
    const files = fs.readdirSync(categoryPath).filter((f) => f.endsWith(".md"));

    for (const file of files) {
      const raw = fs.readFileSync(path.join(categoryPath, file), "utf8");
      const { data, content } = matter(raw);

      if (data.draft) continue;
      if (!data.title || !data.date) {
        console.warn(`Skipping ${categorySlug}/${file}: needs both "title" and "date" in frontmatter`);
        continue;
      }

      const slug = data.slug ? slugify(data.slug) : slugify(file.replace(/\.md$/, ""));
      const tags = Array.isArray(data.tags) ? data.tags.map((t) => String(t)) : [];

      posts.push({
        title: String(data.title),
        date: normalizeDate(data.date),
        description: data.description ? String(data.description) : "",
        tags,
        category: categorySlug,
        categoryLabel: categoryLabel(categorySlug),
        slug,
        html: md.render(content),
        url: `/${categorySlug}/${slug}/`,
      });
    }
  }

  posts.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  return posts;
}

function write(relPath, content) {
  const fullPath = path.join(OUT_DIR, relPath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content);
}

function copyAsset(srcRelToRoot, destRelToOut) {
  const src = path.join(REPO_ROOT, srcRelToRoot);
  if (!fs.existsSync(src)) {
    console.warn(`Skipping copy, not found: ${srcRelToRoot}`);
    return;
  }
  const dest = path.join(OUT_DIR, destRelToOut);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

function escapeXml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function buildFeed(posts) {
  const items = posts
    .slice(0, 30)
    .map((p) => {
      const link = `${SITE_URL}${p.url}`;
      return `  <item>
    <title>${escapeXml(p.title)}</title>
    <link>${link}</link>
    <guid>${link}</guid>
    <pubDate>${new Date(`${p.date}T00:00:00Z`).toUTCString()}</pubDate>
    <description>${escapeXml(p.description)}</description>
  </item>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
<channel>
  <title>Gourab Choudhury -- Blog</title>
  <link>${SITE_URL}/</link>
  <description>Technical writing on AI, tools, and engineering.</description>
${items}
</channel>
</rss>
`;
}

function main() {
  fs.rmSync(OUT_DIR, { recursive: true, force: true });
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const posts = readPosts();

  const categoryMap = new Map();
  for (const post of posts) {
    if (!categoryMap.has(post.category)) categoryMap.set(post.category, []);
    categoryMap.get(post.category).push(post);
  }

  write(
    "index.html",
    listTemplate({
      pageTitle: "Blog",
      heading: "Blog",
      intro: "Technical writing -- AI, tools, engineering, and whatever else I'm building.",
      posts,
      formatDate,
    })
  );

  for (const [categorySlug, categoryPosts] of categoryMap) {
    write(
      `${categorySlug}/index.html`,
      listTemplate({
        pageTitle: categoryLabel(categorySlug),
        heading: categoryLabel(categorySlug),
        intro: `Posts in ${categoryLabel(categorySlug)}.`,
        posts: categoryPosts,
        formatDate,
      })
    );

    for (const post of categoryPosts) {
      write(`${categorySlug}/${post.slug}/index.html`, postTemplate({ post, formatDate }));
    }
  }

  write(
    "categories/index.html",
    categoriesTemplate({
      categories: [...categoryMap.entries()]
        .map(([slug, list]) => ({ slug, label: categoryLabel(slug), count: list.length }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    })
  );

  const tagMap = new Map();
  for (const post of posts) {
    for (const tag of post.tags) {
      const tagSlug = slugifyTag(tag);
      if (!tagMap.has(tagSlug)) tagMap.set(tagSlug, { label: tag, posts: [] });
      tagMap.get(tagSlug).posts.push(post);
    }
  }
  for (const [tagSlug, { label, posts: tagPosts }] of tagMap) {
    write(
      `tags/${tagSlug}/index.html`,
      listTemplate({
        pageTitle: `#${label}`,
        heading: `#${label}`,
        intro: `Posts tagged "${label}".`,
        posts: tagPosts,
        formatDate,
      })
    );
  }

  write("feed.xml", buildFeed(posts));
  write("CNAME", "blogs.gourabchoudhury.dev\n");

  copyAsset("styles.css", "styles.css");
  copyAsset("script.js", "script.js");
  copyAsset("assets/gourab-logo.png", "assets/gourab-logo.png");
  fs.copyFileSync(path.join(BLOG_DIR, "build", "blog.css"), path.join(OUT_DIR, "blog.css"));

  console.log(
    `Built ${posts.length} post(s) across ${categoryMap.size} categor${categoryMap.size === 1 ? "y" : "ies"}.`
  );
}

main();
