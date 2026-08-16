"use strict";

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const matter = require("gray-matter");
const MarkdownIt = require("markdown-it");
const hljs = require("highlight.js");
const katex = require("katex");
const texmath = require("markdown-it-texmath");

const { listTemplate, postTemplate, slugifyTag } = require("./templates");

const BLOG_DIR = path.resolve(__dirname, "..");
const REPO_ROOT = path.resolve(BLOG_DIR, "..");
const CONTENT_DIR = path.join(BLOG_DIR, "content");
const OUT_DIR = path.join(BLOG_DIR, "public");
const SITE_URL = "https://blogs.gourabchoudhury.dev";

// Fixed, ordered category set -- always shown in the sidebar, even at 0 posts,
// so the site's topic structure is visible from day one. Any other folder that
// shows up under content/ still works and is appended after these automatically.
const CATEGORY_ORDER = ["technologies", "ai-ml", "tools-software", "programming-languages", "system-design"];

const CATEGORY_LABELS = {
  technologies: "Technologies",
  "ai-ml": "AI & Machine Learning",
  "tools-software": "Tools & Software",
  "programming-languages": "Programming Languages",
  "system-design": "Software Design & System Architecture",
};

// Set by the highlight() hook when a post contains a ```mermaid fence, so the
// mermaid.js CDN script only gets loaded on posts that actually need it.
let currentHasMermaid = false;

const md = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: true,
  highlight(str, lang) {
    if (lang === "mermaid") {
      currentHasMermaid = true;
      // Raw diagram source, escaped as text content -- mermaid.js reads this
      // element's textContent at render time and replaces it with an <svg>.
      return `<pre class="mermaid">${md.utils.escapeHtml(str)}</pre>`;
    }
    if (lang === "math" || lang === "latex") {
      // A raw LaTeX block (e.g. a \begin{align}...\end{align} environment)
      // pasted without $$ delimiters -- render it as display math directly.
      try {
        return katex.renderToString(str, { displayMode: true, throwOnError: false, strict: "ignore" });
      } catch (_) {
        return `<pre class="hljs"><code>${md.utils.escapeHtml(str)}</code></pre>`;
      }
    }
    if (lang && hljs.getLanguage(lang)) {
      try {
        const highlighted = hljs.highlight(str, { language: lang, ignoreIllegals: true }).value;
        return `<pre class="hljs"><code>${highlighted}</code></pre>`;
      } catch (_) {
        /* fall through to auto-detect below */
      }
    }
    // Unrecognized language tag (e.g. "prisma", "env", a typo) -- guess
    // rather than dumping flat, uncolored text.
    try {
      const guessed = hljs.highlightAuto(str).value;
      return `<pre class="hljs"><code>${guessed}</code></pre>`;
    } catch (_) {
      return `<pre class="hljs"><code>${md.utils.escapeHtml(str)}</code></pre>`;
    }
  },
});

// $inline$ and $$block$$ (and \(...\) / \[...\]) math, rendered to KaTeX
// HTML/MathML at build time -- no client-side JS needed for math itself.
md.use(texmath.use(katex), {
  delimiters: "dollars",
  katexOptions: { throwOnError: false, strict: "ignore" },
});

// Wrap tables so wide ones scroll horizontally on narrow screens instead of
// overflowing or forcing the whole post wider.
md.renderer.rules.table_open = () => '<div class="table-wrap"><table>';
md.renderer.rules.table_close = () => "</table></div>";

// Gives every h2/h3 a stable id and collects them into `currentHeadings` as a
// side effect of md.render(), so the "on this page" TOC can be built from the
// exact same headings without a second markdown parse.
let currentHeadings = [];
const usedHeadingIds = new Set();
md.renderer.rules.heading_open = (tokens, idx) => {
  const token = tokens[idx];
  const level = Number(token.tag.slice(1));
  const inlineToken = tokens[idx + 1];
  const text = (inlineToken.children || []).map((t) => t.content || "").join("");
  let id = slugify(text) || `section-${idx}`;
  let unique = id;
  let n = 2;
  while (usedHeadingIds.has(unique)) {
    unique = `${id}-${n}`;
    n += 1;
  }
  usedHeadingIds.add(unique);
  if (level === 2 || level === 3) currentHeadings.push({ level, text, id: unique });
  return `<${token.tag} id="${unique}">`;
};

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

// Frontmatter is optional. If a post has no "title", the first "# Heading"
// in the body is used instead (and stripped out, since the template already
// renders the title in its own <h1>).
function extractTitle(content) {
  const lines = content.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const m = trimmed.match(/^#\s+(.+?)\s*$/);
    return m ? { title: m[1].trim(), headingLine: line } : { title: null, headingLine: null };
  }
  return { title: null, headingLine: null };
}

function stripHeadingLine(content, headingLine) {
  const idx = content.indexOf(headingLine);
  if (idx === -1) return content;
  return (content.slice(0, idx) + content.slice(idx + headingLine.length)).replace(/^\s+/, "");
}

// If a post has no "description", fall back to its first real paragraph.
function extractDescription(content) {
  for (const rawLine of content.split(/\r?\n/)) {
    const trimmed = rawLine.trim();
    if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("```")) continue;
    const plain = trimmed.replace(/[*_`]/g, "").replace(/\[(.*?)\]\([^)]*\)/g, "$1");
    return plain.length > 200 ? `${plain.slice(0, 197).trimEnd()}...` : plain;
  }
  return "";
}

// If a post has no "date", fall back to the date it was actually committed.
function gitAddedDate(absFilePath) {
  try {
    const out = execFileSync(
      "git",
      ["log", "--diff-filter=A", "--follow", "-1", "--format=%aI", "--", absFilePath],
      { cwd: REPO_ROOT, stdio: ["ignore", "pipe", "ignore"] }
    )
      .toString()
      .trim();
    return out ? out.slice(0, 10) : null;
  } catch (_) {
    return null;
  }
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
      const absPath = path.join(categoryPath, file);
      const raw = fs.readFileSync(absPath, "utf8");
      const { data, content: rawContent } = matter(raw);

      if (data.draft) continue;

      let title = data.title ? String(data.title) : null;
      let content = rawContent;
      if (!title) {
        const extracted = extractTitle(rawContent);
        title = extracted.title;
        if (extracted.headingLine) content = stripHeadingLine(rawContent, extracted.headingLine);
      }
      if (!title) {
        console.warn(`Skipping ${categorySlug}/${file}: no "title" in frontmatter and no "# Heading" in the body`);
        continue;
      }

      const date = data.date ? normalizeDate(data.date) : gitAddedDate(absPath) || new Date().toISOString().slice(0, 10);
      const descriptionIsExplicit = Boolean(data.description);
      const description = descriptionIsExplicit ? String(data.description) : extractDescription(content);
      const slug = data.slug ? slugify(data.slug) : slugify(file.replace(/\.md$/, ""));
      const tags = Array.isArray(data.tags) ? data.tags.map((t) => String(t)) : [];
      const wordCount = content.trim().split(/\s+/).filter(Boolean).length;
      const readMinutes = Math.max(1, Math.round(wordCount / 200));

      currentHeadings = [];
      usedHeadingIds.clear();
      currentHasMermaid = false;
      const html = md.render(content);
      const headings = currentHeadings;
      const hasMermaid = currentHasMermaid;
      const hasMath = html.includes('class="katex');

      posts.push({
        title,
        date,
        description,
        descriptionIsExplicit,
        tags,
        category: categorySlug,
        categoryLabel: categoryLabel(categorySlug),
        slug,
        readMinutes,
        headings,
        hasMermaid,
        hasMath,
        html,
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

function copyDirAbs(srcAbs, destAbs) {
  if (!fs.existsSync(srcAbs)) return;
  fs.mkdirSync(destAbs, { recursive: true });
  for (const entry of fs.readdirSync(srcAbs, { withFileTypes: true })) {
    const s = path.join(srcAbs, entry.name);
    const d = path.join(destAbs, entry.name);
    if (entry.isDirectory()) copyDirAbs(s, d);
    else fs.copyFileSync(s, d);
  }
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

  // Sidebar: the fixed 5, in order, always visible -- then any ad-hoc extra
  // category folder someone adds later, appended alphabetically.
  const extraSlugs = [...categoryMap.keys()]
    .filter((slug) => !CATEGORY_ORDER.includes(slug))
    .sort((a, b) => categoryLabel(a).localeCompare(categoryLabel(b)));
  const sidebarCategories = [...CATEGORY_ORDER, ...extraSlugs].map((slug) => ({
    slug,
    label: categoryLabel(slug),
    count: (categoryMap.get(slug) || []).length,
  }));

  write(
    "index.html",
    listTemplate({
      kicker: "Blog",
      pageTitle: "Blog",
      heading: "Writing",
      intro: "Technical writing -- AI, tools, engineering, and whatever else I'm building.",
      posts,
      formatDate,
      categories: sidebarCategories,
      activeCategory: null,
    })
  );

  for (const categorySlug of sidebarCategories.map((c) => c.slug)) {
    const categoryPosts = categoryMap.get(categorySlug) || [];
    write(
      `${categorySlug}/index.html`,
      listTemplate({
        kicker: "Category",
        pageTitle: categoryLabel(categorySlug),
        heading: categoryLabel(categorySlug),
        intro: `Posts in ${categoryLabel(categorySlug)}.`,
        posts: categoryPosts,
        formatDate,
        categories: sidebarCategories,
        activeCategory: categorySlug,
      })
    );

    for (const post of categoryPosts) {
      write(
        `${categorySlug}/${post.slug}/index.html`,
        postTemplate({ post, formatDate, categories: sidebarCategories, activeCategory: categorySlug })
      );
    }
  }

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
        kicker: "Tag",
        pageTitle: `#${label}`,
        heading: `#${label}`,
        intro: `Posts tagged "${label}".`,
        posts: tagPosts,
        formatDate,
        categories: sidebarCategories,
        activeCategory: null,
      })
    );
  }

  write("feed.xml", buildFeed(posts));
  write("CNAME", "blogs.gourabchoudhury.dev\n");

  copyAsset("styles.css", "styles.css");
  copyAsset("script.js", "script.js");
  copyAsset("assets/gourab-logo.png", "assets/gourab-logo.png");
  fs.copyFileSync(path.join(BLOG_DIR, "build", "blog.css"), path.join(OUT_DIR, "blog.css"));
  fs.copyFileSync(path.join(BLOG_DIR, "build", "toc.js"), path.join(OUT_DIR, "toc.js"));

  const katexDist = path.join(BLOG_DIR, "node_modules", "katex", "dist");
  fs.mkdirSync(path.join(OUT_DIR, "katex"), { recursive: true });
  fs.copyFileSync(path.join(katexDist, "katex.min.css"), path.join(OUT_DIR, "katex", "katex.min.css"));
  copyDirAbs(path.join(katexDist, "fonts"), path.join(OUT_DIR, "katex", "fonts"));

  console.log(
    `Built ${posts.length} post(s) across ${categoryMap.size} categor${categoryMap.size === 1 ? "y" : "ies"}.`
  );
}

main();
