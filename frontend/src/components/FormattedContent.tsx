import React, { useMemo } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";

interface FormattedContentProps {
  text?: string | null;
  className?: string;
  as?: "div" | "span" | "p";
}

/**
 * Robust Rich Content Formatter:
 * - Renders LaTeX math expressions ($inline$ and $$block$$) using KaTeX
 * - Preserves code formatting with ```lang code blocks and `inline code`
 * - Supports RTL and multi-script bidirectional text via dir="auto"
 */
export const FormattedContent: React.FC<FormattedContentProps> = ({
  text,
  className = "",
  as: Component = "div",
}) => {
  if (!text) return null;

  const htmlContent = useMemo(() => {
    let raw = text;

    // 1. Process Multiline Code Blocks: ```lang ... ```
    raw = raw.replace(/```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g, (_, lang, code) => {
      const escapedCode = code
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
      const langBadge = lang ? `<span class="code-lang-tag">${lang}</span>` : "";
      return `<div class="formatted-code-block">${langBadge}<pre><code>${escapedCode}</code></pre></div>`;
    });

    // 2. Process Block Math: $$...$$
    raw = raw.replace(/\$\$([\s\S]+?)\$\$/g, (_, math) => {
      try {
        return `<div class="katex-display-wrapper">${katex.renderToString(math.trim(), {
          displayMode: true,
          throwOnError: false,
        })}</div>`;
      } catch (err) {
        return `<pre class="katex-error">${math}</pre>`;
      }
    });

    // 3. Process Inline Math: $...$
    raw = raw.replace(/(?<!\\)\$([^\$\n]+?)\$/g, (_, math) => {
      try {
        return katex.renderToString(math.trim(), {
          displayMode: false,
          throwOnError: false,
        });
      } catch (err) {
        return `<code>${math}</code>`;
      }
    });

    // 4. Process Inline Code: `...`
    raw = raw.replace(/`([^`\n]+?)`/g, (_, inlineCode) => {
      const escaped = inlineCode
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
      return `<code class="formatted-inline-code">${escaped}</code>`;
    });

    // 5. Preserve Line Breaks for regular paragraphs
    const paragraphs = raw.split(/\n\n+/);
    return paragraphs
      .map((p) => (p.startsWith("<div") ? p : `<p>${p.replace(/\n/g, "<br/>")}</p>`))
      .join("");
  }, [text]);

  return (
    <Component
      dir="auto"
      className={`formatted-content-root ${className}`}
      dangerouslySetInnerHTML={{ __html: htmlContent }}
    />
  );
};
