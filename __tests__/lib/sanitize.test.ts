/**
 * Unit tests for app/lib/sanitize.ts
 *
 * DOMPurify only runs in a browser DOM environment — the function is a no-op
 * on the server.  These tests therefore run in jest-environment jsdom so the
 * DOMPurify code path is actually exercised.
 *
 * Coverage:
 *   - Basic pass-through (safe strings returned unchanged)
 *   - Script tag injection (inline and via src)
 *   - Event handler injection (onerror, onclick, etc.)
 *   - Data URIs carrying JavaScript
 *   - HTML entity-encoded payloads
 *   - SVG / MathML-based injection vectors
 *   - Null / empty input handling
 *   - All HTML tags stripped (ALLOWED_TAGS = [])
 *   - All attributes stripped (ALLOWED_ATTR = [])
 */

import { sanitize } from "@/app/lib/sanitize";

// The sanitize function relies on DOMPurify which needs a real DOM.
// jest-environment jsdom provides window / document, so DOMPurify will
// activate and the function is NOT a no-op in this test environment.

describe("sanitize()", () => {
  // ── Safe strings ──────────────────────────────────────────────────────────

  it("returns a plain string unchanged", () => {
    expect(sanitize("Hello, World!")).toBe("Hello, World!");
  });

  it("returns an empty string for empty input", () => {
    expect(sanitize("")).toBe("");
  });

  it("preserves numbers-as-strings", () => {
    expect(sanitize("42")).toBe("42");
  });

  it("preserves unicode characters", () => {
    expect(sanitize("こんにちは 🎬")).toBe("こんにちは 🎬");
  });

  it("preserves normal punctuation", () => {
    expect(sanitize("Hello, it's a test & it works!")).toBe(
      "Hello, it's a test & it works!",
    );
  });

  // ── Script tag injection ──────────────────────────────────────────────────

  it("strips a bare <script> tag", () => {
    const result = sanitize("<script>alert('xss')</script>");
    expect(result).not.toContain("<script>");
    expect(result).not.toContain("alert");
  });

  it("strips a <script> tag with src attribute", () => {
    const result = sanitize('<script src="https://evil.com/xss.js"></script>');
    expect(result).not.toContain("<script>");
    expect(result).not.toContain("evil.com");
  });

  it("strips a capitalised <SCRIPT> tag (case-insensitive)", () => {
    const result = sanitize("<SCRIPT>alert(1)</SCRIPT>");
    expect(result).not.toContain("<SCRIPT>");
    expect(result).not.toContain("alert");
  });

  it("strips a script tag with a newline break attempt", () => {
    const result = sanitize("<scr\nipt>alert(1)</scr\nipt>");
    expect(result).not.toContain("alert");
  });

  // ── Event handler injection ───────────────────────────────────────────────

  it("strips onclick from a plain string context", () => {
    const result = sanitize('<img src="x" onerror="alert(1)">');
    expect(result).not.toContain("onerror");
    expect(result).not.toContain("alert");
  });

  it("strips onmouseover attribute", () => {
    const result = sanitize('<a href="#" onmouseover="steal()">click</a>');
    expect(result).not.toContain("onmouseover");
  });

  it("strips all HTML tags (ALLOWED_TAGS is empty)", () => {
    // Even benign tags like <b> must be stripped because ALLOWED_TAGS = []
    const result = sanitize("<b>bold</b> and <i>italic</i>");
    expect(result).not.toContain("<b>");
    expect(result).not.toContain("<i>");
    // Text content is preserved
    expect(result).toContain("bold");
    expect(result).toContain("italic");
  });

  it("strips href with javascript: pseudo-protocol", () => {
    const result = sanitize('<a href="javascript:alert(1)">click</a>');
    expect(result).not.toContain("javascript:");
  });

  // ── Data URI injection ────────────────────────────────────────────────────

  it("strips data: URI carrying JavaScript in an img src", () => {
    const result = sanitize(
      '<img src="data:text/html,<script>alert(1)</script>">',
    );
    expect(result).not.toContain("data:text/html");
    expect(result).not.toContain("alert");
  });

  it("strips data: URI with base64-encoded JS payload", () => {
    // data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==
    // decodes to <script>alert(1)</script>
    const payload =
      "data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==";
    const result = sanitize(`<img src="${payload}">`);
    expect(result).not.toContain("data:text/html");
  });

  // ── Encoded / obfuscated payloads ─────────────────────────────────────────

  it("strips HTML entity-encoded script tag", () => {
    // &lt;script&gt; decoded by the browser before script parsing
    const result = sanitize("&lt;script&gt;alert(1)&lt;/script&gt;");
    // DOMPurify receives the decoded form and must strip it
    expect(result).not.toContain("<script>");
  });

  it("strips a null-byte injection attempt", () => {
    const result = sanitize("<scri\x00pt>alert(1)</scri\x00pt>");
    expect(result).not.toContain("alert");
  });

  it("strips a Unicode lookalike script tag", () => {
    // Some parsers normalise Unicode tag-like sequences
    const result = sanitize("\uFEFF<script>alert(1)</script>");
    expect(result).not.toContain("alert");
  });

  // ── SVG / MathML vectors ──────────────────────────────────────────────────

  it("strips SVG with an embedded script", () => {
    const result = sanitize(
      '<svg><animate onbegin="alert(1)" attributeName="x"></animate></svg>',
    );
    expect(result).not.toContain("onbegin");
    expect(result).not.toContain("alert");
  });

  it("strips SVG foreignObject wrapping a script tag", () => {
    const result = sanitize(
      "<svg><foreignObject><script>alert(1)</script></foreignObject></svg>",
    );
    expect(result).not.toContain("<script>");
    expect(result).not.toContain("alert");
  });

  it("strips MathML with an event handler", () => {
    const result = sanitize(
      '<math><maction actiontype="statusline#" xlink:href="javascript:alert(1)">click</maction></math>',
    );
    expect(result).not.toContain("javascript:");
    expect(result).not.toContain("alert");
  });

  // ── Attribute stripping ───────────────────────────────────────────────────

  it("strips all attributes (ALLOWED_ATTR is empty)", () => {
    // Even a class attribute on an otherwise benign element must be stripped
    const result = sanitize('<p class="user-class" id="user-id">text</p>');
    expect(result).not.toContain("class=");
    expect(result).not.toContain("id=");
  });

  it("strips style attribute (CSS-based injection vector)", () => {
    const result = sanitize(
      '<div style="background:url(javascript:alert(1))">text</div>',
    );
    expect(result).not.toContain("style=");
    expect(result).not.toContain("javascript:");
  });

  // ── Edge cases ────────────────────────────────────────────────────────────

  it("handles a deeply nested injection attempt", () => {
    const nested =
      "<div><p><span><b><i><u>" +
      '<script>alert(1)</script>' +
      "</u></i></b></span></p></div>";
    const result = sanitize(nested);
    expect(result).not.toContain("<script>");
    expect(result).not.toContain("alert");
  });

  it("handles multiple injection vectors in one string", () => {
    const multi = [
      "<script>alert(1)</script>",
      '<img onerror="alert(2)" src="x">',
      '<a href="javascript:alert(3)">x</a>',
    ].join(" ");
    const result = sanitize(multi);
    expect(result).not.toContain("alert");
    expect(result).not.toContain("javascript:");
    expect(result).not.toContain("onerror");
  });

  it("is idempotent — sanitizing an already-clean string twice gives the same result", () => {
    const clean = "Safe user name 123";
    expect(sanitize(sanitize(clean))).toBe(sanitize(clean));
  });
});
