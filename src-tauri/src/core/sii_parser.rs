//! Parse SCS `SiiNunit` dashboard and template `.sii` files into [`DashboardProject`](crate::core::models::DashboardProject).

use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::OnceLock;

use anyhow::{anyhow, Context, Result};
use regex::Regex;
use uuid::Uuid;

use crate::core::models::{
    DashboardElement, DashboardProject, DashboardScreen, ElementType, TextTemplate,
};

fn re_block_header() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| {
        Regex::new(r"(?m)^(ui::\w+|ui_[a-zA-Z0-9_]+)\s*:\s*(\S+)\s*\{").expect("regex")
    })
}

fn re_include_line() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| Regex::new(r#"(?m)^\s*@include\s+"([^"]+)""#).expect("regex"))
}

fn re_legacy_bar_text() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| Regex::new(r"^([HV])~~(\d+)~~(\d+)$").expect("regex"))
}

/// Parse a UTF-8 `.sii` string (after optional `@include` resolution by caller).
pub fn parse_sii_string(content: &str, base_dir: Option<&Path>) -> Result<DashboardProject> {
    let expanded = if base_dir.is_some() {
        expand_includes(content, base_dir.unwrap(), &mut HashSet::new())?
    } else {
        content.to_string()
    };
    let cleaned = strip_comments(&expanded);
    parse_siinunit(&cleaned, None)
}

/// Read a file from disk (UTF-8 with optional BOM), resolve `@include` relative to the file directory, then parse.
pub fn parse_sii_file(path: &Path) -> Result<DashboardProject> {
    let raw = fs::read(path).with_context(|| format!("Cannot read file: {}", path.display()))?;
    let text = decode_utf8_with_bom(&raw);
    let base = path.parent().unwrap_or_else(|| Path::new("."));
    let expanded = expand_includes(&text, base, &mut HashSet::new()).with_context(|| {
        format!(
            "Include expansion failed for: {}",
            path.display()
        )
    })?;
    let cleaned = strip_comments(&expanded);
    let mut project = parse_siinunit(&cleaned, Some(base)).with_context(|| {
        format!("Parse failed for: {}", path.display())
    })?;
    project.sii_source_directory = Some(base.to_string_lossy().into_owned());
    let stem = path
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("dashboard");
    project.dashboard_file_name = stem.to_string();
    if project.mod_id.is_empty() {
        project.mod_id = stem.to_string();
    }
    Ok(project)
}

/// Parse `dashboard.sii` and, if present, `ui/template/dashboard_text.<mod_id>.sii` next to the game-style tree.
pub fn parse_dashboard_with_templates(dashboard_path: &Path, mod_id: &str) -> Result<DashboardProject> {
    let mut p = parse_sii_file(dashboard_path)?;
    p.mod_id = mod_id.to_string();
    if let Some(base) = dashboard_path.parent().and_then(|p| p.parent()) {
        let template_path = base
            .join("template")
            .join(format!("dashboard_text.{mod_id}.sii"));
        if template_path.is_file() {
            let tp = parse_sii_file(&template_path)?;
            let mut map: HashMap<String, TextTemplate> = HashMap::new();
            for t in p.templates.iter().cloned() {
                map.insert(t.name.clone(), t);
            }
            for t in tp.templates {
                map.insert(t.name.clone(), t);
            }
            let mut merged: Vec<TextTemplate> = map.into_values().collect();
            merged.sort_by(|a, b| a.name.cmp(&b.name));
            p.templates = merged;
        }
    }
    Ok(p)
}

fn decode_utf8_with_bom(raw: &[u8]) -> String {
    if raw.len() >= 3 && raw[0..3] == [0xEF, 0xBB, 0xBF] {
        return String::from_utf8_lossy(&raw[3..]).into_owned();
    }
    String::from_utf8_lossy(raw).into_owned()
}

fn expand_includes(content: &str, base_dir: &Path, visited: &mut HashSet<PathBuf>) -> Result<String> {
    let mut out = String::with_capacity(content.len() * 2);
    let mut rest = content;
    while let Some(caps) = re_include_line().captures(rest) {
        let full = caps.get(0).unwrap();
        out.push_str(&rest[..full.start()]);
        let rel = caps.get(1).map(|c| c.as_str()).unwrap_or("");
        let inc_path = normalize_include_path(base_dir, rel)?;
        let can = inc_path
            .canonicalize()
            .unwrap_or_else(|_| inc_path.clone());
        if !visited.insert(can.clone()) {
            return Err(anyhow!("@include cycle involving {}", inc_path.display()));
        }
        let raw = fs::read(&inc_path)
            .with_context(|| format!("@include {}", inc_path.display()))?;
        let inner = decode_utf8_with_bom(&raw);
        let parent = inc_path.parent().unwrap_or(base_dir);
        let expanded = expand_includes(&inner, parent, visited)?;
        visited.remove(&can);
        out.push_str(&expanded);
        rest = &rest[full.end()..];
    }
    out.push_str(rest);
    Ok(out)
}

fn normalize_include_path(base_dir: &Path, rel: &str) -> Result<PathBuf> {
    let rel_norm = rel.replace('\\', "/");
    let p = Path::new(rel_norm.as_str());
    let combined = if p.is_absolute() {
        p.to_path_buf()
    } else {
        base_dir.join(&rel_norm)
    };
    if combined.exists() {
        Ok(combined.canonicalize().unwrap_or(combined))
    } else {
        Ok(combined)
    }
}

/// Remove `//`, `#` (to EOL), and `/* */` outside of quoted strings.
fn strip_comments(input: &str) -> String {
    let bytes = input.as_bytes();
    let mut out = String::with_capacity(input.len());
    let mut i = 0usize;
    let mut in_string = false;
    while i < bytes.len() {
        let b = bytes[i];
        if in_string {
            out.push(b as char);
            if b == b'\\' && i + 1 < bytes.len() {
                i += 1;
                out.push(bytes[i] as char);
            } else if b == b'"' {
                in_string = false;
            }
            i += 1;
            continue;
        }
        if b == b'"' {
            in_string = true;
            out.push('"');
            i += 1;
            continue;
        }
        // // line comment
        if b == b'/' && i + 1 < bytes.len() && bytes[i + 1] == b'/' {
            i += 2;
            while i < bytes.len() && bytes[i] != b'\n' {
                i += 1;
            }
            continue;
        }
        // /* block comment */
        if b == b'/' && i + 1 < bytes.len() && bytes[i + 1] == b'*' {
            i += 2;
            while i + 1 < bytes.len() {
                if bytes[i] == b'*' && bytes[i + 1] == b'/' {
                    i += 2;
                    break;
                }
                i += 1;
            }
            continue;
        }
        // # to EOL (SCS template style)
        if b == b'#' {
            while i < bytes.len() && bytes[i] != b'\n' {
                i += 1;
            }
            continue;
        }
        out.push(b as char);
        i += 1;
    }
    out
}

fn parse_siinunit(cleaned: &str, _base: Option<&Path>) -> Result<DashboardProject> {
    let body = extract_siinunit_body(cleaned)?;
    let blocks = split_blocks(body)?;
    build_project(blocks)
}

fn extract_siinunit_body(s: &str) -> Result<&str> {
    let t = s.trim();
    let lower = t.to_ascii_lowercase();
    let start = lower
        .find("siinunit")
        .ok_or_else(|| anyhow!("missing SiiNunit"))?;
    let after_kw = &t[start + 8..];
    let rest = after_kw.trim_start();
    let brace = rest
        .find('{')
        .ok_or_else(|| anyhow!("SiiNunit missing {{"))?;
    let from_brace = &rest[brace..];
    let close = find_matching_brace_byte(from_brace.as_bytes(), 0)
        .ok_or_else(|| anyhow!("unclosed SiiNunit"))?;
    Ok(from_brace[1..close].trim())
}

fn find_matching_brace_byte(bytes: &[u8], open_pos: usize) -> Option<usize> {
    if bytes.get(open_pos) != Some(&b'{') {
        return None;
    }
    let mut i = open_pos + 1;
    let mut depth = 1u32;
    let mut in_string = false;
    while i < bytes.len() {
        let b = bytes[i];
        if in_string {
            if b == b'\\' && i + 1 < bytes.len() {
                i += 2;
                continue;
            }
            if b == b'"' {
                in_string = false;
            }
            i += 1;
            continue;
        }
        if b == b'"' {
            in_string = true;
            i += 1;
            continue;
        }
        if b == b'{' {
            depth += 1;
        } else if b == b'}' {
            depth -= 1;
            if depth == 0 {
                return Some(i);
            }
        }
        i += 1;
    }
    None
}

struct RawBlockInfo {
    kind: String,
    unit_name: String,
    body: String,
}

fn split_blocks(inner: &str) -> Result<Vec<RawBlockInfo>> {
    let bytes = inner.as_bytes();
    let mut out = Vec::new();
    for m in re_block_header().captures_iter(inner) {
        let full = m.get(0).unwrap();
        let kind = m.get(1).unwrap().as_str().to_string();
        let unit_name = m.get(2).unwrap().as_str().to_string();
        let open_brace = full.end() - 1;
        if bytes.get(open_brace) != Some(&b'{') {
            return Err(anyhow!("block header must end with {{: {:?}", full.as_str()));
        }
        let close = find_matching_brace_byte(bytes, open_brace)
            .ok_or_else(|| anyhow!("unclosed block {}", unit_name))?;
        let body = inner[open_brace + 1..close].to_string();
        out.push(RawBlockInfo {
            kind,
            unit_name,
            body,
        });
    }
    Ok(out)
}

#[derive(Debug, Default, Clone)]
struct RawBlock {
    attrs: HashMap<String, String>,
    my_children: Vec<(usize, String)>,
    my_children_append: Vec<String>,
}

fn parse_attributes_into(body: &str, rb: &mut RawBlock) -> Result<()> {
    let mut pending_key: Option<String> = None;
    let mut pending_val = String::new();
    let mut in_string = false;

    for raw_line in body.lines() {
        let line = raw_line.trim();
        if line.is_empty() {
            continue;
        }
        if in_string {
            pending_val.push('\n');
            pending_val.push_str(line);
            if let Some(closed) = closes_quoted_string(&pending_val) {
                if closed {
                    in_string = false;
                    if let Some(k) = pending_key.take() {
                        let v = take_quoted_value(&pending_val)?;
                        insert_attr(rb, &k, v)?;
                    }
                    pending_val.clear();
                }
            }
            continue;
        }

        let Some(colon) = line.find(':') else {
            continue;
        };
        let key = line[..colon].trim();
        let mut val = line[colon + 1..].trim();

        if key.is_empty() {
            continue;
        }

        if val.starts_with('"') && !line_ends_unclosed_string(val) {
            let v = parse_string_value(val)?;
            insert_attr(rb, key, v)?;
            continue;
        }
        if val.starts_with('"') && line_ends_unclosed_string(val) {
            pending_key = Some(key.to_string());
            pending_val = val.to_string();
            in_string = true;
            continue;
        }

        if val.starts_with('"') {
            pending_key = Some(key.to_string());
            pending_val = val.to_string();
            in_string = true;
            continue;
        }

        val = val.trim_end_matches(',');
        insert_attr(rb, key, val.to_string())?;
    }

    if in_string {
        return Err(anyhow!("unterminated string in block attributes"));
    }
    Ok(())
}

fn line_ends_unclosed_string(s: &str) -> bool {
    let mut i = 0usize;
    let b = s.as_bytes();
    if !s.starts_with('"') {
        return false;
    }
    i += 1;
    while i < b.len() {
        if b[i] == b'\\' && i + 1 < b.len() {
            i += 2;
            continue;
        }
        if b[i] == b'"' {
            return false;
        }
        i += 1;
    }
    true
}

fn closes_quoted_string(accum: &str) -> Option<bool> {
    let b = accum.as_bytes();
    if !accum.starts_with('"') {
        return Some(true);
    }
    let mut i = 1usize;
    while i < b.len() {
        if b[i] == b'\\' && i + 1 < b.len() {
            i += 2;
            continue;
        }
        if b[i] == b'"' {
            return Some(true);
        }
        i += 1;
    }
    None
}

fn take_quoted_value(s: &str) -> Result<String> {
    parse_string_value(s)
}

fn parse_string_value(s: &str) -> Result<String> {
    let t = s.trim();
    if !t.starts_with('"') {
        return Ok(t.to_string());
    }
    let mut raw: Vec<u8> = Vec::new();
    let bytes = t.as_bytes();
    let mut i = 1usize;
    while i < bytes.len() {
        if bytes[i] == b'\\' && i + 1 < bytes.len() {
            match bytes[i + 1] {
                b'n'  => raw.push(b'\n'),
                b'r'  => raw.push(b'\r'),
                b't'  => raw.push(b'\t'),
                b'\\' => raw.push(b'\\'),
                b'"'  => raw.push(b'"'),
                other => raw.push(other),
            }
            i += 2;
            continue;
        }
        if bytes[i] == b'"' { break; }
        raw.push(bytes[i]);
        i += 1;
    }
    Ok(String::from_utf8_lossy(&raw).into_owned())
}

fn insert_attr(rb: &mut RawBlock, key: &str, value: String) -> Result<()> {
    if key == "my_children" {
        return Ok(());
    }
    if let Some(rest) = key.strip_prefix("my_children[") {
        if let Some(idx_part) = rest.strip_suffix(']') {
            if idx_part.is_empty() {
                rb.my_children_append.push(value);
            } else {
                let idx: usize = idx_part
                    .parse()
                    .map_err(|_| anyhow!("bad my_children index: {}", key))?;
                rb.my_children.push((idx, value));
            }
            return Ok(());
        }
    }
    rb.attrs.insert(key.to_string(), value);
    Ok(())
}

fn dedup_templates_last_wins(templates: Vec<TextTemplate>) -> Vec<TextTemplate> {
    let mut map: HashMap<String, TextTemplate> = HashMap::new();
    for t in templates {
        map.insert(t.name.clone(), t);
    }
    let mut v: Vec<TextTemplate> = map.into_values().collect();
    v.sort_by(|a, b| a.name.cmp(&b.name));
    v
}

fn build_project(mut raw_blocks: Vec<RawBlockInfo>) -> Result<DashboardProject> {
    let mut templates = Vec::new();
    let mut window_name = String::new();
    let mut canvas_w = 800i32;
    let mut canvas_h = 800i32;
    let mut blocks_map: HashMap<String, (String, String, RawBlock)> = HashMap::new();

    for b in raw_blocks.drain(..) {
        if b.kind == "ui::text_template" {
            let mut rb = RawBlock::default();
            parse_attributes_into(&b.body, &mut rb)?;
            let text = rb
                .attrs
                .get("text")
                .cloned()
                .unwrap_or_default();
            templates.push(TextTemplate {
                name: b.unit_name.clone(),
                text,
            });
            continue;
        }

        if b.kind == "ui::window" {
            window_name = b.unit_name.clone();
            let mut wb = RawBlock::default();
            if parse_attributes_into(&b.body, &mut wb).is_ok() {
                if let Some(v) = wb.attrs.get("coords_r") {
                    if let Some(n) = parse_i32_token(v) {
                        canvas_w = n;
                    }
                }
                if let Some(v) = wb.attrs.get("coords_t") {
                    if let Some(n) = parse_i32_token(v) {
                        canvas_h = n;
                    }
                }
            }
        }

        let mut rb = RawBlock::default();
        parse_attributes_into(&b.body, &mut rb)?;
        blocks_map.insert(b.unit_name.clone(), (b.kind, b.unit_name, rb));
    }

    if window_name.is_empty() {
        if !templates.is_empty() {
            return Ok(DashboardProject {
                window_unit_name: String::new(),
                mod_id: String::new(),
                dashboard_file_name: String::new(),
                screens: Vec::new(),
                templates: dedup_templates_last_wins(templates),
                sii_source_directory: None,
                game_root_path: None,
                canvas_width: 800,
                canvas_height: 800,
            });
        }
        return Err(anyhow!("no ui::window block found"));
    }

    let window_children = children_list(
        blocks_map
            .get(&window_name)
            .ok_or_else(|| anyhow!("window block missing"))?,
    )?;

    let mut screens = Vec::new();
    for child in window_children {
        let Some((kind, unit, rb)) = blocks_map.get(&child) else {
            continue;
        };
        if kind != "ui::group" {
            continue;
        }
        let screen_id = rb
            .attrs
            .get("id")
            .and_then(|s| parse_i32_token(s))
            .unwrap_or(0);
        if !is_screen_id(screen_id) {
            continue;
        }

        let mut elements = collect_screen_elements(
            &window_name,
            unit,
            screen_id,
            &blocks_map,
        )?;
        elements.sort_by(|a, b| {
            a.layer
                .cmp(&b.layer)
                .then_with(|| a.name.cmp(&b.name))
        });
        screens.push(DashboardScreen {
            id: Uuid::new_v4().to_string(),
            unit_name: unit.clone(),
            screen_id,
            display_name: format!("{unit} ({screen_id})"),
            elements,
        });
    }

    screens.sort_by(|a, b| screen_sort_key(a.screen_id).cmp(&screen_sort_key(b.screen_id)));

    append_missing_elements_from_blocks(&blocks_map, &window_name, &mut screens)?;

    Ok(DashboardProject {
        window_unit_name: window_name,
        mod_id: String::new(),
        dashboard_file_name: String::new(),
        screens,
        templates: dedup_templates_last_wins(templates),
        sii_source_directory: None,
        game_root_path: None,
        canvas_width: canvas_w.max(1),
        canvas_height: canvas_h.max(1),
    })
}

fn screen_sort_key(id: i32) -> i32 {
    match id {
        950 => 0,
        900 => 10_000,
        x => x,
    }
}

fn is_screen_id(id: i32) -> bool {
    id == 950
        || id == 900
        || (100..=800).contains(&id) && id % 100 == 0
}

fn children_list(triple: &(String, String, RawBlock)) -> Result<Vec<String>> {
    let rb = &triple.2;
    let mut pairs = rb.my_children.clone();
    pairs.sort_by_key(|(i, _)| *i);
    let mut out: Vec<String> = pairs.into_iter().map(|(_, n)| n).collect();
    out.extend(rb.my_children_append.iter().cloned());
    Ok(out)
}

fn parent_of_map(blocks_map: &HashMap<String, (String, String, RawBlock)>) -> HashMap<String, String> {
    let mut parent_of = HashMap::new();
    for (name, (_, _, rb)) in blocks_map {
        let p = rb
            .attrs
            .get("my_parent")
            .map(|s| normalize_parent(s))
            .unwrap_or_default();
        parent_of.insert(name.clone(), p);
    }
    parent_of
}

/// Second pass: blocks skipped by the first pass (e.g. `my_parent` naming edge cases) are attached to the matching screen.
fn append_missing_elements_from_blocks(
    blocks_map: &HashMap<String, (String, String, RawBlock)>,
    window_name: &str,
    screens: &mut Vec<DashboardScreen>,
) -> Result<()> {
    let parent_of = parent_of_map(blocks_map);
    let mut assigned: HashSet<String> = HashSet::new();
    for s in screens.iter() {
        for e in &s.elements {
            assigned.insert(e.name.clone());
        }
    }

    for (name, (kind, _, rb)) in blocks_map {
        if kind == "ui::text_template" || kind == "ui::window" {
            continue;
        }
        if assigned.contains(name) {
            continue;
        }
        for s in screens.iter_mut() {
            if !is_under_screen(name, &s.unit_name, window_name, &parent_of) {
                continue;
            }
            let el = raw_to_element(kind, name, rb, s.screen_id)?;
            s.elements.push(el);
            assigned.insert(name.clone());
            break;
        }
    }

    // Last resort: elements whose my_parent points directly to the window unit
    // (or is empty) are not under any specific screen.  Assign them to the shared
    // screen (950) if present, otherwise the first available screen.
    for (name, (kind, _, rb)) in blocks_map {
        if kind == "ui::text_template" || kind == "ui::window" {
            continue;
        }
        if assigned.contains(name) {
            continue;
        }
        let parent = parent_of.get(name).cloned().unwrap_or_default();
        let is_orphan = parent.is_empty() || parent.eq_ignore_ascii_case(window_name);
        if !is_orphan {
            continue;
        }
        // Prefer shared screen 950, else first screen.
        let target_id = screens
            .iter()
            .find(|s| s.screen_id == 950)
            .or_else(|| screens.iter().next())
            .map(|s| s.screen_id);
        if let Some(sid) = target_id {
            if let Some(s) = screens.iter_mut().find(|s| s.screen_id == sid) {
                let el = raw_to_element(kind, name, rb, s.screen_id)?;
                s.elements.push(el);
                assigned.insert(name.clone());
            }
        }
    }

    for s in screens.iter_mut() {
        s.elements.sort_by(|a, b| {
            a.layer
                .cmp(&b.layer)
                .then_with(|| a.name.cmp(&b.name))
        });
    }
    Ok(())
}

fn collect_screen_elements(
    window_name: &str,
    screen_unit: &str,
    screen_id: i32,
    blocks_map: &HashMap<String, (String, String, RawBlock)>,
) -> Result<Vec<DashboardElement>> {
    let parent_of = parent_of_map(blocks_map);

    let mut out = Vec::new();
    for (name, (kind, _, rb)) in blocks_map {
        if kind == "ui::text_template" || kind == "ui::window" {
            continue;
        }
        if !is_under_screen(name, screen_unit, window_name, &parent_of) {
            continue;
        }
        let el = raw_to_element(kind, name, rb, screen_id)?;
        out.push(el);
    }
    Ok(out)
}

fn normalize_parent(s: &str) -> String {
    let t = s.trim();
    if t.eq_ignore_ascii_case("null") {
        String::new()
    } else {
        t.to_string()
    }
}

fn parent_lookup_ci(parent_of: &HashMap<String, String>, node: &str) -> String {
    if let Some(p) = parent_of.get(node) {
        return p.clone();
    }
    for (k, v) in parent_of.iter() {
        if k.eq_ignore_ascii_case(node) {
            return v.clone();
        }
    }
    String::new()
}

fn is_under_screen(
    node: &str,
    screen: &str,
    window: &str,
    parent_of: &HashMap<String, String>,
) -> bool {
    let mut c = node.to_string();
    loop {
        if c.eq_ignore_ascii_case(screen) {
            return true;
        }
        if c.eq_ignore_ascii_case(window) || c.is_empty() {
            return false;
        }
        c = parent_lookup_ci(parent_of, &c);
    }
}

fn raw_to_element(
    kind: &str,
    name: &str,
    rb: &RawBlock,
    _screen_id: i32,
) -> Result<DashboardElement> {
    let element_type = match kind {
        "ui::group" => ElementType::Group,
        "ui::text" => ElementType::Text,
        "ui::text_common" => ElementType::TextCommon,
        // Accept both underscore (app legacy) and double-colon (game SII) forms.
        "ui_text_bar" | "ui::text_bar" => ElementType::TextBar,
        "ui_gauge"    | "ui::gauge"    => ElementType::Gauge,
        _ => ElementType::Text,
    };

    let mut my_children: Vec<(usize, String)> = rb.my_children.clone();
    my_children.sort_by_key(|(i, _)| *i);
    let mut child_names: Vec<String> = my_children.into_iter().map(|(_, n)| n).collect();
    for n in &rb.my_children_append {
        child_names.push(n.clone());
    }

    let fitting = rb
        .attrs
        .get("fitting")
        .and_then(|s| parse_bool_attr(s));

    // Accept both `coords_*` (app export) and `area_*` (original game SII format).
    let coords_l = rb.attrs.get("coords_l")
        .or_else(|| rb.attrs.get("area_l"))
        .and_then(|s| parse_i32_token(s)).unwrap_or(0);
    let coords_r = rb.attrs.get("coords_r")
        .or_else(|| rb.attrs.get("area_r"))
        .and_then(|s| parse_i32_token(s)).unwrap_or(0);
    let coords_t = rb.attrs.get("coords_t")
        .or_else(|| rb.attrs.get("area_t"))
        .and_then(|s| parse_i32_token(s)).unwrap_or(0);
    let coords_b = rb.attrs.get("coords_b")
        .or_else(|| rb.attrs.get("area_b"))
        .and_then(|s| parse_i32_token(s)).unwrap_or(0);

    let dashboard_id = rb.attrs.get("id").and_then(|s| parse_i32_token(s)).unwrap_or(0);
    let layer = rb.attrs.get("layer").and_then(|s| parse_i32_token(s)).unwrap_or(0);

    let text_content = rb.attrs.get("text").cloned().unwrap_or_default();
    let look_template = rb
        .attrs
        .get("look_template")
        .cloned()
        .unwrap_or_default();
    let default_value = rb.attrs.get("value").cloned().unwrap_or_default();

    let mut is_vertical = rb
        .attrs
        .get("vertical")
        .and_then(|s| parse_bool_attr(s))
        .unwrap_or(false);
    let mut bar_min_value = rb
        .attrs
        .get("min_value")
        .map(|s| parse_f64_token(s))
        .unwrap_or(0.0);
    let mut bar_max_value = rb
        .attrs
        .get("max_value")
        .map(|s| parse_f64_token(s))
        .unwrap_or(0.0);
    let bar_min_size = rb
        .attrs
        .get("min_size")
        .and_then(|s| parse_i32_token(s))
        .unwrap_or(0);
    let bar_max_size = rb
        .attrs
        .get("max_size")
        .and_then(|s| parse_i32_token(s))
        .unwrap_or(0);

    if element_type == ElementType::TextBar {
        if let Some(caps) = re_legacy_bar_text().captures(&text_content) {
            is_vertical = caps.get(1).map(|m| m.as_str() == "V").unwrap_or(false);
            bar_min_value = caps
                .get(2)
                .and_then(|m| m.as_str().parse().ok())
                .unwrap_or(0.0);
            bar_max_value = caps
                .get(3)
                .and_then(|m| m.as_str().parse().ok())
                .unwrap_or(0.0);
        }
    }

    let gauge_min_angle = rb
        .attrs
        .get("min")
        .or_else(|| rb.attrs.get("min_angle"))
        .map(|s| parse_f64_token(s))
        .unwrap_or(0.0);
    let gauge_max_angle = rb
        .attrs
        .get("max")
        .or_else(|| rb.attrs.get("max_angle"))
        .map(|s| parse_f64_token(s))
        .unwrap_or(0.0);
    let gauge_value_min = rb
        .attrs
        .get("value_min")
        .map(|s| parse_f64_token(s))
        .unwrap_or(0.0);
    let gauge_value_max = rb
        .attrs
        .get("value_max")
        .map(|s| parse_f64_token(s))
        .unwrap_or(0.0);
    let gauge_value_off = rb
        .attrs
        .get("value_off")
        .or_else(|| rb.attrs.get("value"))
        .map(|s| parse_f64_token(s))
        .unwrap_or(0.0);
    let gauge_material = rb
        .attrs
        .get("material")
        .cloned()
        .unwrap_or_default();
    let gauge_xref_pos = rb
        .attrs
        .get("xref_pos")
        .and_then(|s| parse_i32_token(s))
        .unwrap_or(0);
    let gauge_yref_pos = rb
        .attrs
        .get("yref_pos")
        .and_then(|s| parse_i32_token(s))
        .unwrap_or(0);
    let gauge_off_x = rb
        .attrs
        .get("off_x")
        .and_then(|s| parse_i32_token(s))
        .unwrap_or(0);
    let gauge_off_y = rb
        .attrs
        .get("off_y")
        .and_then(|s| parse_i32_token(s))
        .unwrap_or(0);
    let gauge_smooth_move = rb
        .attrs
        .get("smooth_move")
        .and_then(|s| parse_bool_attr(s))
        .unwrap_or(false);

    let parent_name = rb
        .attrs
        .get("my_parent")
        .map(|s| normalize_parent(s))
        .unwrap_or_default();

    Ok(DashboardElement {
        id: Uuid::new_v4().to_string(),
        element_type,
        name: name.to_string(),
        parent_name,
        child_names,
        coords_l,
        coords_r,
        coords_t,
        coords_b,
        dashboard_id,
        layer,
        fitting,
        text_content,
        look_template,
        default_value,
        is_vertical,
        bar_min_value,
        bar_max_value,
        bar_min_size,
        bar_max_size,
        gauge_min_angle,
        gauge_max_angle,
        gauge_value_min,
        gauge_value_max,
        gauge_value_off,
        gauge_material,
        gauge_xref_pos,
        gauge_yref_pos,
        gauge_off_x,
        gauge_off_y,
        gauge_smooth_move,
        is_visible: true,
    })
}

fn parse_bool_attr(s: &str) -> Option<bool> {
    match s.trim().to_ascii_lowercase().as_str() {
        "true" => Some(true),
        "false" => Some(false),
        _ => None,
    }
}

fn parse_i32_token(s: &str) -> Option<i32> {
    let t = s.trim();
    t.parse::<i32>().ok()
}

fn parse_f64_token(s: &str) -> f64 {
    let t = s.trim();
    if let Some(hex) = t.strip_prefix('&') {
        if hex.len() == 8 {
            if let Ok(u) = u32::from_str_radix(hex, 16) {
                return f32::from_bits(u) as f64;
            }
        }
    }
    t.parse::<f64>().unwrap_or(0.0)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    #[test]
    fn strip_comments_keeps_quoted_slash_slash() {
        let s = r#"x: "http://foo" //c"#;
        let out = strip_comments(s);
        assert!(out.contains("http://foo"));
        assert!(!out.contains("//c"));
    }

    #[test]
    fn parse_minimal_siinunit() {
        let s = r#"
SiiNunit {
ui::window : .root {
 my_children[0]: .g950
 coords_l: 0
 coords_r: 800
 coords_t: 800
 coords_b: 0
 id: 0
 layer: 0
 my_parent: null
}
ui::group : .g950 {
 fitting: false
 coords_l: 0
 coords_r: 800
 coords_t: 300
 coords_b: 0
 id: 950
 layer: -1
 my_parent: .root
}
}
"#;
        let p = parse_sii_string(s, None).unwrap();
        assert_eq!(p.window_unit_name, ".root");
        assert_eq!(p.screens.len(), 1);
        assert_eq!(p.screens[0].screen_id, 950);
        assert_eq!(p.screens[0].elements.len(), 1);
        assert_eq!(p.screens[0].elements[0].name, ".g950");
    }

    #[test]
    fn legacy_bar_text_pattern() {
        let rb = RawBlock {
            attrs: HashMap::from([
                ("text".into(), "H~~0~~130".into()),
                ("id".into(), "1075".into()),
            ]),
            my_children: vec![],
            my_children_append: vec![],
        };
        let el = raw_to_element("ui_text_bar", ".bar", &rb, 100).unwrap();
        assert_eq!(el.bar_min_value, 0.0);
        assert_eq!(el.bar_max_value, 130.0);
        assert!(!el.is_vertical);
    }

    #[test]
    fn daf_2021_example_loads() {
        let manifest = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
        let path = manifest.join("../../dashboard_examples_from_game/ui/dashboard/daf_2021.sii");
        if !path.exists() {
            return;
        }
        let p = parse_sii_file(&path).expect("parse");
        assert!(!p.window_unit_name.is_empty());
        let shared = p.screens.iter().find(|s| s.screen_id == 950);
        assert!(shared.is_some(), "shared 950");
        assert!(shared.unwrap().elements.len() > 5);
        let has_gauge = shared.unwrap().elements.iter().any(|e| e.element_type == ElementType::Gauge);
        assert!(has_gauge);
    }

    #[test]
    fn daf_template_file_loads() {
        let manifest = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
        let path = manifest.join("../../dashboard_examples_from_game/ui/template/dashboard_text.daf_2021.sii");
        if !path.exists() {
            return;
        }
        let p = parse_sii_file(&path).expect("parse template");
        assert!(!p.templates.is_empty());
        assert!(p.templates.iter().any(|t| t.name.contains("daf_2021")));
    }
}
