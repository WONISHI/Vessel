use pulldown_cmark::{Event, Options, Parser, Tag, TagEnd, LinkType};
use serde::{Deserialize, Serialize};
use std::{collections::{BTreeSet, HashMap}, fs, io, path::Path, time::{Instant, UNIX_EPOCH}};

const VERSION: u32 = 2;
const MAX_NOTE_BYTES: u64 = 32 * 1024 * 1024;
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq, PartialOrd, Ord)]
struct LinkRecord { target: String, wiki: bool }
#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
struct FileRecord {
    path: String, title: String, kind: String, fingerprint: String,
    modified_ms: u64, links: Vec<LinkRecord>, tags: Vec<String>,
}
#[derive(Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct Index {
    version: u32, files: Vec<FileRecord>, warnings: Vec<String>,
    scanned: usize, reused: usize, elapsed_ms: u64,
}
fn note(name: &str) -> bool { [".md", ".markdown", ".mdown"].iter().any(|ext| name.to_lowercase().ends_with(ext)) }
fn attachment(name: &str) -> bool {
    let ext = name.rsplit('.').next().unwrap_or("").to_lowercase();
    ["png","jpg","jpeg","gif","webp","svg","avif","bmp","ico","pdf","mp3","wav","ogg","mp4","webm","mov","m4a","flac","csv","canvas","base","excalidraw","docx","xlsx","pptx"].contains(&ext.as_str())
}
fn add_tags(text: &str, tags: &mut BTreeSet<String>) {
    for (start, _) in text.match_indices('#') {
        if start > 0 && text[..start].chars().next_back().is_some_and(|c| !c.is_whitespace() && !"([{,;".contains(c)) { continue; }
        let tag: String = text[start+1..].chars().take_while(|c| c.is_alphanumeric() || "_-/".contains(*c)).collect();
        if !tag.is_empty() && !tag.chars().all(|c| c.is_ascii_digit()) { tags.insert(tag); }
    }
}
fn extract(text: &str) -> (Vec<LinkRecord>, Vec<String>) {
    let mut links = BTreeSet::new();
    let mut tags = BTreeSet::new();
    // Frontmatter tags are not prose. Common YAML scalar/list forms are supported.
    if text.starts_with("---\n") || text.starts_with("---\r\n") {
        let mut in_tags = false;
        for line in text.lines().skip(1).take_while(|line| *line != "---" && *line != "...") {
            let line = line.trim();
            if let Some(value) = line.strip_prefix("tags:") {
                in_tags = true;
                for value in value.trim_matches(|c: char| c.is_whitespace() || "[]".contains(c)).split(',') {
                    let value = value.trim().trim_matches(['\'', '"']).trim_start_matches('#');
                    if !value.is_empty() { tags.insert(value.to_owned()); }
                }
            } else if in_tags && line.starts_with("- ") {
                let value = line[2..].trim().trim_matches(['\'', '"']).trim_start_matches('#');
                if !value.is_empty() { tags.insert(value.to_owned()); }
            } else if !line.is_empty() { in_tags = false; }
        }
    }
    let options = Options::ENABLE_WIKILINKS | Options::ENABLE_YAML_STYLE_METADATA_BLOCKS;
    let mut excluded = 0;
    for event in Parser::new_ext(text, options) {
        match event {
            Event::Start(Tag::CodeBlock(_) | Tag::MetadataBlock(_)) => excluded += 1,
            Event::End(TagEnd::CodeBlock | TagEnd::MetadataBlock(_)) => excluded -= 1,
            Event::Start(Tag::Link { dest_url, link_type, .. } | Tag::Image { dest_url, link_type, .. }) if excluded == 0 => { links.insert(LinkRecord { target: dest_url.to_string(), wiki: matches!(link_type, LinkType::WikiLink { .. }) }); },
            Event::Text(value) if excluded == 0 => add_tags(&value, &mut tags),
            _ => (),
        }
    }
    (links.into_iter().collect(), tags.into_iter().collect())
}
fn scan(directory: &Path, base: &Path, old: &mut HashMap<String, FileRecord>, index: &mut Index) -> io::Result<()> {
    for entry in fs::read_dir(directory)? {
        let entry = match entry { Ok(value) => value, Err(error) => { index.warnings.push(error.to_string()); continue; } };
        let name = entry.file_name().to_string_lossy().into_owned();
        if name.starts_with('.') || ["node_modules", "target", "vendor", "dist", "build"].contains(&name.as_str()) { continue; }
        let kind = match entry.file_type() { Ok(value) => value, Err(error) => { index.warnings.push(error.to_string()); continue; } };
        if kind.is_symlink() { continue; }
        let path = entry.path();
        if kind.is_dir() {
            if let Err(error) = scan(&path, base, old, index) { index.warnings.push(format!("{}: {}", path.display(), error)); }
            continue;
        }
        if !kind.is_file() || (!note(&name) && !attachment(&name)) { continue; }
        let relative = path.strip_prefix(base).unwrap().to_string_lossy().replace('\\', "/");
        let record = (|| -> io::Result<FileRecord> {
            let metadata = entry.metadata()?;
            let modified = metadata.modified()?.duration_since(UNIX_EPOCH).unwrap_or_default();
            let fingerprint = format!("{}:{}:{}", modified.as_secs(), modified.subsec_nanos(), metadata.len());
            if let Some(record) = old.remove(&relative) {
                if record.fingerprint == fingerprint { index.reused += 1; return Ok(record); }
            }
            let (links, tags) = if note(&name) {
                if metadata.len() > MAX_NOTE_BYTES { return Err(io::Error::other("笔记超过 32MB，已跳过内容索引")); }
                extract(&fs::read_to_string(&path)?)
            } else { (vec![], vec![]) };
            index.scanned += 1;
            Ok(FileRecord { path: relative.clone(), title: if note(&name) { Path::new(&name).file_stem().unwrap().to_string_lossy().into_owned() } else { name.clone() }, kind: if note(&name) { "note" } else { "attachment" }.into(), fingerprint, modified_ms: modified.as_millis() as u64, links, tags })
        })();
        match record { Ok(record) => {
            println!("{}", serde_json::json!({"file": &record, "scanned": index.scanned, "reused": index.reused}));
            index.files.push(record);
        }, Err(error) => index.warnings.push(format!("{}: {}", relative, error)) }
    }
    Ok(())
}
fn run() -> Result<(), Box<dyn std::error::Error>> {
    let started = Instant::now();
    let args: Vec<String> = std::env::args().collect();
    let base = Path::new(args.get(1).map(String::as_str).unwrap_or("/workspace"));
    let cache = Path::new(args.get(2).map(String::as_str).unwrap_or("/cache/index.json"));
    let previous: Index = fs::read(cache).ok().and_then(|bytes| serde_json::from_slice(&bytes).ok()).unwrap_or_default();
    let mut old = if previous.version == VERSION { previous.files.into_iter().map(|file| (file.path.clone(), file)).collect() } else { HashMap::new() };
    let mut index = Index { version: VERSION, ..Index::default() };
    scan(base, base, &mut old, &mut index)?;
    index.files.sort_by(|a, b| a.path.cmp(&b.path));
    index.elapsed_ms = started.elapsed().as_millis() as u64;
    let temporary = cache.with_extension("next.json");
    fs::write(&temporary, serde_json::to_vec(&index)?)?;
    fs::rename(temporary, cache)?;
    Ok(())
}
fn main() { if let Err(error) = run() { eprintln!("{}", error); std::process::exit(1); } }

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn parses_links_embeds_tags_and_ignores_code() {
        let (links, tags) = extract("---\ntags: [项目, rust]\n---\n[[中文笔记|别名]] ![[photo.png]] [标题](../a.md#章节) #标签/子标签 `[[假链接]] #假的`\n```\n[[fake]] #bad\n```\n");
        assert!(links.iter().any(|link| link.target == "中文笔记" && link.wiki));
        assert!(links.iter().any(|link| link.target == "photo.png" && link.wiki));
        assert!(links.iter().any(|link| link.target == "../a.md#章节" && !link.wiki));
        assert_eq!(links.len(), 3);
        assert!(tags.contains(&"标签/子标签".into()));
        assert!(tags.contains(&"项目".into()));
        assert!(!tags.contains(&"假的".into()));
    }
}
