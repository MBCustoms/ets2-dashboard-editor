//! Tokenize SCS dashboard text markup (`<color>`, `<font>`, `<ret>`, …) — mirrors legacy `ScsTextRenderer.Tokenize`.

use std::collections::HashMap;
use std::sync::OnceLock;

use regex::Regex;

/// Normalized markup token stream (legacy `TokenType`).
#[derive(Debug, Clone, PartialEq)]
pub enum ScsMarkupToken {
    Text(String),
    /// AABBGGRR or `@@named@@`
    Color(String),
    Image {
        src: String,
        attrs: HashMap<String, String>,
    },
    FontBlock {
        face: String,
        xscale: f32,
        yscale: f32,
        inner: Vec<ScsMarkupToken>,
    },
    AlignPush {
        hstyle: String,
        vstyle: String,
        left: f32,
        right: f32,
    },
    AlignPop,
    Ret,
    Br,
    Offset { hshift: f32, vshift: f32 },
}

/// Escape sequences used in `.sii` / template strings (legacy `Replace` before tokenize).
///
/// Handles both `\\r\\n` (Windows-style escaped CRLF) and `\\n` (escaped LF) that
/// appear as literal escape sequences in stored SII string values, as well as real
/// CRLF (`\r\n`) line endings.  All are normalised to a plain `\n` which the
/// tokenizer then skips (SCS markup uses explicit `<ret>`/`<br>` for positioning).
pub fn normalize_scs_text(input: &str) -> String {
    input
        .replace("\\r\\n", "\n")
        .replace("\\n", "\n")
        .replace("\r\n", "\n")
}

/// Normalize then tokenize (main entry).
pub fn parse_scs_markup(input: &str) -> Vec<ScsMarkupToken> {
    tokenize_scs_markup(&normalize_scs_text(input))
}

/// Split into tags and plain-text runs.
///
/// Real `\n` characters are **skipped** (they are formatting whitespace in `.sii` files).
/// Cursor positioning is controlled exclusively by explicit `<ret>` and `<br>` tags.
pub fn tokenize_scs_markup(text: &str) -> Vec<ScsMarkupToken> {
    let mut tokens = Vec::new();
    let mut i = 0usize;
    let mut text_buf = String::new();

    let flush_text = |buf: &mut String, out: &mut Vec<ScsMarkupToken>| {
        if !buf.is_empty() {
            out.push(ScsMarkupToken::Text(std::mem::take(buf)));
        }
    };

    while i < text.len() {
        let rest = &text[i..];
        let Some(ch) = rest.chars().next() else {
            break;
        };

        if ch == '<' {
            flush_text(&mut text_buf, &mut tokens);
            let Some(rel_gt) = rest.find('>') else {
                text_buf.push('<');
                text_buf.push_str(&rest[1..]);
                break;
            };
            let end = i + rel_gt;
            let tag = text[i + 1..end].trim();
            i = end + 1;

            if tag_is_ci(tag, "color") && key_has_space_or_tab_prefix(tag, "color") {
                let attrs = parse_attrs(tag);
                let val = attrs.get("value").cloned().unwrap_or_default();
                tokens.push(ScsMarkupToken::Color(val));
            } else if tag_is_ci(tag, "img") && key_has_space_prefix(tag, "img") {
                let attrs = parse_attrs(tag);
                let src = attrs.get("src").cloned().unwrap_or_default();
                tokens.push(ScsMarkupToken::Image { src, attrs });
            } else if tag_is_ci(tag, "font") && key_has_space_prefix(tag, "font") {
                let attrs = parse_attrs(tag);
                let face = attrs.get("face").cloned().unwrap_or_default();
                let xscale = attrs
                    .get("xscale")
                    .and_then(|v| v.parse::<f32>().ok())
                    .unwrap_or(1.0);
                let yscale = attrs
                    .get("yscale")
                    .and_then(|v| v.parse::<f32>().ok())
                    .unwrap_or(1.0);
                let content_start = i;
                if let Some(close_idx) = find_matching_font_end(text, content_start) {
                    let inner_str = &text[content_start..close_idx];
                    let inner = tokenize_scs_markup(inner_str);
                    tokens.push(ScsMarkupToken::FontBlock {
                        face,
                        xscale,
                        yscale,
                        inner,
                    });
                    i = close_idx + 7;
                } else {
                    let inner_str = &text[content_start..];
                    let inner = tokenize_scs_markup(inner_str);
                    tokens.push(ScsMarkupToken::FontBlock {
                        face,
                        xscale,
                        yscale,
                        inner,
                    });
                    i = text.len();
                }
            } else if tag.eq_ignore_ascii_case("ret") {
                tokens.push(ScsMarkupToken::Ret);
            } else if tag.eq_ignore_ascii_case("br") {
                tokens.push(ScsMarkupToken::Br);
            } else if tag_is_ci(tag, "offset") && key_has_space_prefix(tag, "offset") {
                let attrs = parse_attrs(tag);
                let hshift = attrs
                    .get("hshift")
                    .and_then(|s| s.parse().ok())
                    .unwrap_or(0.0);
                let vshift = attrs
                    .get("vshift")
                    .and_then(|s| s.parse().ok())
                    .unwrap_or(0.0);
                tokens.push(ScsMarkupToken::Offset { hshift, vshift });
            } else if is_align_tag(tag) {
                let attrs = parse_attrs(tag);
                let hstyle = attrs
                    .get("hstyle")
                    .cloned()
                    .unwrap_or_else(|| "left".to_string());
                let vstyle = attrs
                    .get("vstyle")
                    .cloned()
                    .unwrap_or_else(|| "top".to_string());
                let left = attrs
                    .get("left")
                    .and_then(|s| s.parse().ok())
                    .unwrap_or(0.0);
                let right = attrs
                    .get("right")
                    .and_then(|s| s.parse().ok())
                    .unwrap_or(0.0);
                tokens.push(ScsMarkupToken::AlignPush {
                    hstyle,
                    vstyle,
                    left,
                    right,
                });
            } else if tag.trim_start().to_ascii_lowercase().starts_with("/align") {
                tokens.push(ScsMarkupToken::AlignPop);
            } else if tag.trim_start().to_ascii_lowercase().starts_with("/font") {
                // Stray `</font>` — paired blocks consume the close.
            }
        } else if ch == '\n' {
            // Real newlines (including those produced by normalize_scs_text from "\\r\\n"
            // and "\\n" escape sequences) are formatting whitespace only — they must NOT
            // become Ret tokens.  SCS dashboard markup uses explicit <ret> and <br> tags
            // for cursor positioning; every real newline in a .sii string is just the
            // author breaking a long line for readability.
            //
            // Converting newlines to Ret causes stacked / overlapping elements whenever
            // the markup spans multiple lines, which is extremely common in SCS files.
            // This matches the WPF reference implementation which also skips newlines.
            flush_text(&mut text_buf, &mut tokens); // flush any buffered plain text first
            i += 1; // skip the newline — do NOT emit Ret
        } else {
            text_buf.push(ch);
            i += ch.len_utf8();
        }
    }

    flush_text(&mut text_buf, &mut tokens);
    tokens
}

fn tag_is_ci(tag: &str, word: &str) -> bool {
    let t = tag.trim_start();
    t.len() >= word.len() && t[..word.len()].eq_ignore_ascii_case(word)
}

/// `color value=…` — `color` followed by space or tab (legacy `color ` / `color\t`).
fn key_has_space_or_tab_prefix(tag: &str, word: &str) -> bool {
    let t = tag.trim_start();
    if t.len() <= word.len() {
        return false;
    }
    if !t[..word.len()].eq_ignore_ascii_case(word) {
        return false;
    }
    matches!(t.as_bytes().get(word.len()), Some(b' ') | Some(b'\t'))
}

/// `img ` / `font ` / `offset ` — space only (legacy `StartsWith("… ")`).
fn key_has_space_prefix(tag: &str, word: &str) -> bool {
    let t = tag.trim_start();
    if t.len() <= word.len() {
        return false;
    }
    if !t[..word.len()].eq_ignore_ascii_case(word) {
        return false;
    }
    t.as_bytes().get(word.len()) == Some(&b' ')
}

fn is_align_tag(tag: &str) -> bool {
    let t = tag.trim();
    if t.eq_ignore_ascii_case("align") {
        return true;
    }
    tag_is_ci(tag, "align") && key_has_space_prefix(tag, "align")
}

fn re_attrs() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| {
        Regex::new(
            r#"(?x)
            (\w+)=
            (?:
                (-?[0-9]+(?:\.[0-9]+)?)
                |
                "([^"]*)"
                |
                ([^\s>"'\\]+)
            )"#,
        )
        .expect("re_attrs regex")
    })
}

/// Legacy `ParseAttrs`: `name=value` pairs; keys stored lowercase for case-insensitive lookup.
pub fn parse_attrs(tag: &str) -> HashMap<String, String> {
    let mut m = HashMap::new();
    for cap in re_attrs().captures_iter(tag) {
        let key = cap.get(1).map(|g| g.as_str().to_string()).unwrap_or_default();
        let val = if let Some(g) = cap.get(2) {
            g.as_str().to_string()
        } else if let Some(g) = cap.get(3) {
            g.as_str().to_string()
        } else if let Some(g) = cap.get(4) {
            g.as_str().to_string()
        } else {
            continue;
        };
        if !key.is_empty() {
            m.insert(key.to_ascii_lowercase(), val);
        }
    }
    m
}

/// `</font>` matching with nested `<font …>` depth (legacy `FindMatchingFontEnd`).
pub fn find_matching_font_end(text: &str, from: usize) -> Option<usize> {
    let mut depth = 1i32;
    let mut j = from;
    while j < text.len() && depth > 0 {
        let open_idx = index_of_tag_ci(text, "<font ", j);
        let close_idx = index_of_tag_ci(text, "</font>", j)?;
        if open_idx.is_some_and(|o| o < close_idx) {
            let o = open_idx.unwrap();
            depth += 1;
            j = o + 6;
        } else {
            depth -= 1;
            if depth == 0 {
                return Some(close_idx);
            }
            j = close_idx + 7;
        }
    }
    None
}

fn index_of_tag_ci(text: &str, needle: &str, from: usize) -> Option<usize> {
    let b = text.as_bytes();
    let n = needle.as_bytes();
    if n.is_empty() || from > b.len() {
        return None;
    }
    for i in from..=b.len().saturating_sub(n.len()) {
        if b[i..i + n.len()].eq_ignore_ascii_case(n) {
            return Some(i);
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn plain_text() {
        let t = parse_scs_markup("hello");
        assert_eq!(t, vec![ScsMarkupToken::Text("hello".into())]);
    }

    #[test]
    fn color_tag() {
        let t = parse_scs_markup(r#"<color value=FFFFFFFF>hi"#);
        assert_eq!(t.len(), 2);
        assert_eq!(t[0], ScsMarkupToken::Color("FFFFFFFF".into()));
        assert_eq!(t[1], ScsMarkupToken::Text("hi".into()));
    }

    #[test]
    fn ret_br() {
        let t = parse_scs_markup("<ret><br>");
        assert_eq!(t, vec![ScsMarkupToken::Ret, ScsMarkupToken::Br,]);
    }

    #[test]
    fn font_block_with_close() {
        let t = parse_scs_markup(
            r#"<font face=/font/digit.font xscale=1 yscale=1>12</font>rest"#,
        );
        assert_eq!(t.len(), 2);
        match &t[0] {
            ScsMarkupToken::FontBlock {
                face,
                xscale,
                yscale,
                inner,
            } => {
                assert_eq!(face, "/font/digit.font");
                assert!((*xscale - 1.0).abs() < f32::EPSILON);
                assert!((*yscale - 1.0).abs() < f32::EPSILON);
                assert_eq!(inner, &[ScsMarkupToken::Text("12".into())]);
            }
            _ => panic!("font"),
        }
        assert_eq!(t[1], ScsMarkupToken::Text("rest".into()));
    }

    #[test]
    fn nested_font_depth() {
        let raw = r#"<font face=a>a<font face=b>b</font>c</font>"#;
        let t = parse_scs_markup(raw);
        match &t[0] {
            ScsMarkupToken::FontBlock { inner, .. } => {
                assert_eq!(inner.len(), 3);
                assert_eq!(inner[0], ScsMarkupToken::Text("a".into()));
                assert!(matches!(inner[1], ScsMarkupToken::FontBlock { .. }));
                assert_eq!(inner[2], ScsMarkupToken::Text("c".into()));
            }
            _ => panic!("expected nested font"),
        }
    }

    #[test]
    fn align_and_end() {
        let t = parse_scs_markup(r#"<align right=10>x</align>"#);
        assert!(matches!(
            t[0],
            ScsMarkupToken::AlignPush {
                right,
                ..
            } if (right - 10.0).abs() < f32::EPSILON
        ));
        assert_eq!(t[1], ScsMarkupToken::Text("x".into()));
        assert_eq!(t[2], ScsMarkupToken::AlignPop);
    }

    #[test]
    fn newline_is_skipped_not_ret() {
        // Real newlines in SCS markup are formatting whitespace — they are SKIPPED,
        // not converted to <ret>.  SCS uses explicit <ret>/<br> for positioning.
        let t = parse_scs_markup("a\nb");
        assert_eq!(
            t,
            vec![
                ScsMarkupToken::Text("a".into()),
                ScsMarkupToken::Text("b".into()),
            ]
        );
    }

    #[test]
    fn escaped_crlf_normalized_then_skipped() {
        // "a\\r\\nb" in Rust source = string "a\r\nb" (backslash-r-backslash-n).
        // normalize_scs_text converts the 4-char escape "\r\n" → real newline.
        // The real newline is then skipped by the tokenizer (not emitted as Ret).
        let t = parse_scs_markup("a\\r\\nb");
        assert_eq!(
            t,
            vec![
                ScsMarkupToken::Text("a".into()),
                ScsMarkupToken::Text("b".into()),
            ]
        );
    }

    #[test]
    fn escaped_single_n_normalized_then_skipped() {
        // "a\\nb" in Rust source = string "a\nb" (backslash-n).
        // normalize_scs_text converts the 2-char escape "\n" → real newline, then skipped.
        let t = parse_scs_markup("a\\nb");
        assert_eq!(
            t,
            vec![
                ScsMarkupToken::Text("a".into()),
                ScsMarkupToken::Text("b".into()),
            ]
        );
    }

    #[test]
    fn unknown_tag_dropped_like_legacy() {
        let t = parse_scs_markup("<unknown>hi");
        assert_eq!(t, vec![ScsMarkupToken::Text("hi".into())]);
    }
}
