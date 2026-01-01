use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use tauri::State;
use walkdir::WalkDir;

const AUDIO_EXTENSIONS: &[&str] = &["wav", "mp3", "flac", "ogg", "aiff", "m4a"];

/// Tracks allowed directories for file operations (security)
#[derive(Default)]
pub struct AllowedPaths {
    /// The source directory selected by the user for scanning
    source_directory: Mutex<Option<PathBuf>>,
    /// Additional paths that have been explicitly allowed (e.g., save locations)
    allowed_paths: Mutex<Vec<PathBuf>>,
}

impl AllowedPaths {
    pub fn new() -> Self {
        Self::default()
    }

    /// Set the source directory (called when user selects a directory to scan)
    pub fn set_source_directory(&self, path: PathBuf) {
        *self.source_directory.lock().unwrap() = Some(path);
    }

    /// Add an allowed path (called when user explicitly selects a file via dialog)
    pub fn add_allowed_path(&self, path: PathBuf) {
        let mut paths = self.allowed_paths.lock().unwrap();
        if !paths.contains(&path) {
            paths.push(path);
        }
    }

    /// Check if a path is within allowed directories
    pub fn is_path_allowed(&self, path: &Path) -> bool {
        let canonical = match path.canonicalize() {
            Ok(p) => p,
            Err(_) => return false,
        };

        // Check if within source directory
        if let Some(ref source) = *self.source_directory.lock().unwrap() {
            if let Ok(source_canonical) = source.canonicalize() {
                if canonical.starts_with(&source_canonical) {
                    return true;
                }
            }
        }

        // Check if in explicitly allowed paths
        let allowed = self.allowed_paths.lock().unwrap();
        for allowed_path in allowed.iter() {
            if let Ok(allowed_canonical) = allowed_path.canonicalize() {
                if canonical.starts_with(&allowed_canonical) || canonical == allowed_canonical {
                    return true;
                }
            }
        }

        false
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Sample {
    pub path: String,
    pub filename: String,
    pub score: i32,
    pub comparisons: i32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TournamentState {
    pub samples: Vec<Sample>,
    pub current_round: i32,
    pub comparisons_this_round: Vec<(usize, usize)>,
    pub current_comparison_index: usize,
    pub advancement_threshold: f32,
    pub source_directory: String,
}

impl TournamentState {
    pub fn new(source_directory: String, advancement_threshold: f32) -> Self {
        Self {
            samples: Vec::new(),
            current_round: 1,
            comparisons_this_round: Vec::new(),
            current_comparison_index: 0,
            advancement_threshold,
            source_directory,
        }
    }
}

#[tauri::command]
fn scan_directory(
    directory: &str,
    allowed_paths: State<AllowedPaths>,
) -> Result<Vec<Sample>, String> {
    let path = Path::new(directory);
    if !path.exists() {
        return Err("Directory does not exist".to_string());
    }

    // Validate and canonicalize the path
    let canonical_path = path.canonicalize().map_err(|e| e.to_string())?;

    // Register this directory as allowed for future operations
    allowed_paths.set_source_directory(canonical_path.clone());

    let mut samples = Vec::new();

    // Don't follow symlinks to prevent escape attacks
    for entry in WalkDir::new(&canonical_path)
        .follow_links(false)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        let entry_path = entry.path();
        if entry_path.is_file() {
            if let Some(ext) = entry_path.extension() {
                let ext_lower = ext.to_string_lossy().to_lowercase();
                if AUDIO_EXTENSIONS.contains(&ext_lower.as_str()) {
                    let filename = entry_path
                        .file_name()
                        .map(|n| n.to_string_lossy().to_string())
                        .unwrap_or_default();

                    samples.push(Sample {
                        path: entry_path.to_string_lossy().to_string(),
                        filename,
                        score: 0,
                        comparisons: 0,
                    });
                }
            }
        }
    }

    Ok(samples)
}

#[tauri::command]
fn save_progress(
    state: TournamentState,
    file_path: &str,
    allowed_paths: State<AllowedPaths>,
) -> Result<(), String> {
    let path = Path::new(file_path);

    // Register this path as allowed (user selected via dialog)
    if let Some(parent) = path.parent() {
        allowed_paths.add_allowed_path(parent.to_path_buf());
    }

    let json = serde_json::to_string_pretty(&state).map_err(|e| e.to_string())?;
    fs::write(file_path, json).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn load_progress(
    file_path: &str,
    allowed_paths: State<AllowedPaths>,
) -> Result<TournamentState, String> {
    let path = Path::new(file_path);

    // Register parent directory as allowed
    if let Some(parent) = path.parent() {
        allowed_paths.add_allowed_path(parent.to_path_buf());
    }

    let content = fs::read_to_string(file_path).map_err(|e| e.to_string())?;
    let state: TournamentState = serde_json::from_str(&content).map_err(|e| e.to_string())?;

    // Also register the source directory from the loaded state
    allowed_paths.set_source_directory(PathBuf::from(&state.source_directory));

    Ok(state)
}

#[tauri::command]
fn export_results(
    samples: Vec<Sample>,
    file_path: &str,
    min_score: i32,
    allowed_paths: State<AllowedPaths>,
) -> Result<(), String> {
    let path = Path::new(file_path);

    // Register this path as allowed (user selected via dialog)
    if let Some(parent) = path.parent() {
        allowed_paths.add_allowed_path(parent.to_path_buf());
    }

    let good_samples: Vec<&str> = samples
        .iter()
        .filter(|s| s.score >= min_score)
        .map(|s| s.path.as_str())
        .collect();

    let content = good_samples.join("\n");
    fs::write(file_path, content).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn get_audio_file_url(
    file_path: &str,
    allowed_paths: State<AllowedPaths>,
) -> Result<String, String> {
    let path = Path::new(file_path);
    if !path.exists() {
        return Err("File does not exist".to_string());
    }

    // Validate path is within allowed directories
    if !allowed_paths.is_path_allowed(path) {
        return Err("Access denied: path is outside allowed directories".to_string());
    }

    // Return a file:// URL that the frontend can use
    Ok(format!("file://{}", file_path))
}

#[tauri::command]
fn reveal_in_finder(
    file_path: String,
    allowed_paths: State<AllowedPaths>,
) -> Result<(), String> {
    let path = Path::new(&file_path);
    if !path.exists() {
        return Err("File does not exist".to_string());
    }

    // Validate path is within allowed directories
    if !allowed_paths.is_path_allowed(path) {
        return Err("Access denied: path is outside allowed directories".to_string());
    }

    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .args(["-R", &file_path])
            .spawn()
            .map_err(|e| e.to_string())?;
    }

    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .args(["/select,", &file_path])
            .spawn()
            .map_err(|e| e.to_string())?;
    }

    #[cfg(target_os = "linux")]
    {
        if let Some(parent) = path.parent() {
            std::process::Command::new("xdg-open")
                .arg(parent)
                .spawn()
                .map_err(|e| e.to_string())?;
        }
    }

    Ok(())
}

#[tauri::command]
fn copy_file_to_clipboard(
    file_path: String,
    allowed_paths: State<AllowedPaths>,
) -> Result<(), String> {
    let path = std::path::PathBuf::from(&file_path);
    if !path.exists() {
        return Err("File does not exist".to_string());
    }

    // Validate path is within allowed directories
    if !allowed_paths.is_path_allowed(&path) {
        return Err("Access denied: path is outside allowed directories".to_string());
    }

    #[cfg(target_os = "macos")]
    {
        use cocoa::appkit::NSPasteboard;
        use cocoa::base::{id, nil};
        use cocoa::foundation::{NSArray, NSString, NSURL};

        unsafe {
            let pasteboard: id = NSPasteboard::generalPasteboard(nil);
            NSPasteboard::clearContents(pasteboard);

            let file_url: id = NSURL::fileURLWithPath_(nil, NSString::alloc(nil).init_str(&file_path));
            let array: id = NSArray::arrayWithObject(nil, file_url);

            NSPasteboard::writeObjects(pasteboard, array);
        }
    }

    #[cfg(target_os = "windows")]
    {
        // Use PowerShell to copy file to clipboard
        std::process::Command::new("powershell")
            .args([
                "-Command",
                &format!("Set-Clipboard -Path '{}'", file_path.replace("'", "''"))
            ])
            .output()
            .map_err(|e| e.to_string())?;
    }

    #[cfg(target_os = "linux")]
    {
        // Use xclip to copy file URI to clipboard
        let file_uri = format!("file://{}", file_path);
        let mut child = std::process::Command::new("xclip")
            .args(["-selection", "clipboard", "-t", "text/uri-list"])
            .stdin(std::process::Stdio::piped())
            .spawn()
            .map_err(|e| format!("Failed to run xclip: {}. Make sure xclip is installed.", e))?;

        if let Some(stdin) = child.stdin.as_mut() {
            use std::io::Write;
            stdin.write_all(file_uri.as_bytes()).map_err(|e| e.to_string())?;
        }

        child.wait().map_err(|e| e.to_string())?;
    }

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(AllowedPaths::new())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            scan_directory,
            save_progress,
            load_progress,
            export_results,
            get_audio_file_url,
            reveal_in_finder,
            copy_file_to_clipboard,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
