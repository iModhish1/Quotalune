//! Small helper for storing local secret-bearing JSON files.

use std::io;
use std::path::Path;

use base64::Engine;
use serde::{Deserialize, Serialize};

const FORMAT: &str = "codexbar.secure-file";
const VERSION: u32 = 1;
const WINDOWS_DPAPI_USER: &str = "windows-dpapi-user";
const WINDOWS_DPAPI_MACHINE: &str = "windows-dpapi-machine";

#[derive(Debug, Serialize, Deserialize)]
struct ProtectedFile {
    format: String,
    version: u32,
    protection: String,
    payload: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum SecureFileStatus {
    Missing,
    Plaintext,
    Protected(String),
    Unreadable(String),
}

/// Return a non-secret storage status for diagnostics/UI surfaces.
pub fn status(path: &Path) -> SecureFileStatus {
    if !path.exists() {
        return SecureFileStatus::Missing;
    }

    let raw = match std::fs::read_to_string(path) {
        Ok(raw) => raw,
        Err(e) => return SecureFileStatus::Unreadable(e.to_string()),
    };

    let Ok(file) = serde_json::from_str::<ProtectedFile>(&raw) else {
        return SecureFileStatus::Plaintext;
    };

    if file.format != FORMAT {
        return SecureFileStatus::Plaintext;
    }
    if file.version != VERSION {
        return SecureFileStatus::Unreadable(format!(
            "unsupported secure file version {}",
            file.version
        ));
    }

    match file.protection.as_str() {
        WINDOWS_DPAPI_USER | WINDOWS_DPAPI_MACHINE => SecureFileStatus::Protected(file.protection),
        other => {
            SecureFileStatus::Unreadable(format!("unsupported secure file protection {other}"))
        }
    }
}

/// Read a UTF-8 file that may be protected by this module.
pub fn read_string(path: &Path) -> io::Result<String> {
    let raw = std::fs::read_to_string(path)?;
    let Ok(file) = serde_json::from_str::<ProtectedFile>(&raw) else {
        return Ok(raw);
    };

    if file.format != FORMAT {
        return Ok(raw);
    }
    if file.version != VERSION {
        return Err(io::Error::new(
            io::ErrorKind::InvalidData,
            format!("unsupported secure file version {}", file.version),
        ));
    }

    match file.protection.as_str() {
        WINDOWS_DPAPI_USER | WINDOWS_DPAPI_MACHINE => {
            let encrypted = base64::engine::general_purpose::STANDARD
                .decode(file.payload.as_bytes())
                .map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e))?;
            let plain = unprotect(&encrypted)?;
            String::from_utf8(plain).map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e))
        }
        other => Err(io::Error::new(
            io::ErrorKind::InvalidData,
            format!("unsupported secure file protection {other}"),
        )),
    }
}

/// Write a UTF-8 file, protecting it with user-scoped Windows DPAPI when available.
pub fn write_string(path: &Path, contents: &str) -> io::Result<()> {
    let bytes = protected_file_bytes(contents)?;
    std::fs::write(path, bytes)?;
    restrict_file_permissions(path)?;
    Ok(())
}

/// Publish a complete protected document without exposing a truncated file to
/// concurrent Settings readers. The previous file survives any pre-rename error.
pub fn write_string_atomic(path: &Path, contents: &str) -> io::Result<()> {
    use std::io::Write;
    let bytes = protected_file_bytes(contents)?;
    let mut name = path.as_os_str().to_os_string();
    name.push(format!(".tmp-{}", uuid::Uuid::new_v4()));
    let temporary = std::path::PathBuf::from(name);
    let result = (|| {
        let mut options = std::fs::OpenOptions::new();
        options.write(true).create_new(true);
        #[cfg(unix)]
        {
            use std::os::unix::fs::OpenOptionsExt;
            options.mode(0o600);
        }
        let mut file = options.open(&temporary)?;
        restrict_file_permissions(&temporary)?;
        file.write_all(&bytes)?;
        file.sync_all()?;
        drop(file);
        std::fs::rename(&temporary, path)
    })();
    if result.is_err() {
        let _cleanup = std::fs::remove_file(&temporary);
    }
    result
}

#[cfg(windows)]
fn protected_file_bytes(contents: &str) -> io::Result<Vec<u8>> {
    let (protection, encrypted) = protect(contents.as_bytes())?;
    let file = ProtectedFile {
        format: FORMAT.to_string(),
        version: VERSION,
        protection: protection.to_string(),
        payload: base64::engine::general_purpose::STANDARD.encode(encrypted),
    };
    serde_json::to_vec_pretty(&file).map_err(io::Error::other)
}

#[cfg(not(windows))]
fn protected_file_bytes(contents: &str) -> io::Result<Vec<u8>> {
    Ok(contents.as_bytes().to_vec())
}

#[cfg(windows)]
fn protect(plain: &[u8]) -> io::Result<(&'static str, Vec<u8>)> {
    use windows::Win32::Security::Cryptography::CRYPTPROTECT_UI_FORBIDDEN;

    // Credential-bearing stores must remain bound to the current Windows
    // user. Machine-scoped DPAPI lets another account on the same machine
    // decrypt a blob if it can read the file, so a failed user-scope write
    // is an error rather than a reason to silently weaken protection.
    protect_with_flags(plain, CRYPTPROTECT_UI_FORBIDDEN)
        .map(|encrypted| (WINDOWS_DPAPI_USER, encrypted))
        .map_err(|error| io::Error::other(format!("user-scoped DPAPI protection failed: {error}")))
}

#[cfg(windows)]
fn protect_with_flags(plain: &[u8], flags: u32) -> io::Result<Vec<u8>> {
    use windows::Win32::Foundation::{HLOCAL, LocalFree};
    use windows::Win32::Security::Cryptography::{CRYPT_INTEGER_BLOB, CryptProtectData};

    // SAFETY: input_blob borrows `plain` for the duration of the call and
    // cbData is its exact length; output_blob is filled by CryptProtectData,
    // copied out before LocalFree releases the API-allocated buffer.
    unsafe {
        #[allow(
            clippy::cast_possible_truncation,
            reason = "credential payloads are small config blobs; a >4 GiB secret is not a real input"
        )]
        let input_blob = CRYPT_INTEGER_BLOB {
            cbData: plain.len() as u32,
            pbData: plain.as_ptr() as *mut u8,
        };
        let mut output_blob = CRYPT_INTEGER_BLOB {
            cbData: 0,
            pbData: std::ptr::null_mut(),
        };

        CryptProtectData(&input_blob, None, None, None, None, flags, &mut output_blob)
            .map_err(|e| io::Error::other(format!("CryptProtectData failed: {e:?}")))?;

        if output_blob.pbData.is_null() {
            return Err(io::Error::other("CryptProtectData returned null output"));
        }

        let encrypted =
            std::slice::from_raw_parts(output_blob.pbData, output_blob.cbData as usize).to_vec();
        let _ = LocalFree(HLOCAL(output_blob.pbData as *mut _));
        Ok(encrypted)
    }
}

#[cfg(windows)]
fn unprotect(encrypted: &[u8]) -> io::Result<Vec<u8>> {
    use windows::Win32::Foundation::{HLOCAL, LocalFree};
    use windows::Win32::Security::Cryptography::{
        CRYPT_INTEGER_BLOB, CRYPTPROTECT_UI_FORBIDDEN, CryptUnprotectData,
    };

    // SAFETY: same blob contract as protect_with_flags: input points at
    // `encrypted` with its exact length; the returned buffer is fully copied
    // before LocalFree, per the DPAPI allocation contract.
    unsafe {
        #[allow(
            clippy::cast_possible_truncation,
            reason = "protected files were written by protect(); their size fits u32 by construction"
        )]
        let input_blob = CRYPT_INTEGER_BLOB {
            cbData: encrypted.len() as u32,
            pbData: encrypted.as_ptr() as *mut u8,
        };
        let mut output_blob = CRYPT_INTEGER_BLOB {
            cbData: 0,
            pbData: std::ptr::null_mut(),
        };

        CryptUnprotectData(
            &input_blob,
            None,
            None,
            None,
            None,
            CRYPTPROTECT_UI_FORBIDDEN,
            &mut output_blob,
        )
        .map_err(|e| io::Error::other(format!("CryptUnprotectData failed: {e:?}")))?;

        if output_blob.pbData.is_null() {
            return Err(io::Error::other("CryptUnprotectData returned null output"));
        }

        let plain =
            std::slice::from_raw_parts(output_blob.pbData, output_blob.cbData as usize).to_vec();
        let _ = LocalFree(HLOCAL(output_blob.pbData as *mut _));
        Ok(plain)
    }
}

#[cfg(not(windows))]
fn unprotect(_encrypted: &[u8]) -> io::Result<Vec<u8>> {
    Err(io::Error::new(
        io::ErrorKind::Unsupported,
        "Windows DPAPI-protected files can only be read on Windows by the same user",
    ))
}

#[cfg(unix)]
fn restrict_file_permissions(path: &Path) -> io::Result<()> {
    use std::os::unix::fs::PermissionsExt;
    let mut perms = std::fs::metadata(path)?.permissions();
    perms.set_mode(0o600);
    std::fs::set_permissions(path, perms)
}

#[cfg(not(unix))]
fn restrict_file_permissions(_path: &Path) -> io::Result<()> {
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn atomic_settings_publication_never_exposes_partial_json() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("settings.json");
        write_string_atomic(&path, "{\"revision\":0}").unwrap();
        std::thread::scope(|scope| {
            scope.spawn(|| {
                for revision in 1..30 {
                    write_string_atomic(&path, &format!("{{\"revision\":{revision}}}")).unwrap();
                }
            });
            for _ in 0..100 {
                let value: serde_json::Value =
                    serde_json::from_str(&read_string(&path).unwrap()).unwrap();
                assert!(value["revision"].is_number());
            }
        });
        assert_eq!(std::fs::read_dir(dir.path()).unwrap().count(), 1);
    }

    #[test]
    fn reads_plaintext_json_without_wrapper() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("plain.json");
        std::fs::write(&path, r#"{"hello":"world"}"#).unwrap();

        assert_eq!(read_string(&path).unwrap(), r#"{"hello":"world"}"#);
    }

    #[test]
    fn write_roundtrips_on_this_platform() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("secure.json");
        write_string(&path, r#"{"secret":"value"}"#).unwrap();

        assert_eq!(read_string(&path).unwrap(), r#"{"secret":"value"}"#);
    }

    #[test]
    fn status_reports_missing_plaintext_and_protected_files() {
        let dir = tempfile::tempdir().unwrap();
        let missing = dir.path().join("missing.json");
        assert_eq!(status(&missing), SecureFileStatus::Missing);

        let plain = dir.path().join("plain.json");
        std::fs::write(&plain, r#"{"secret":"value"}"#).unwrap();
        assert_eq!(status(&plain), SecureFileStatus::Plaintext);

        let protected = dir.path().join("protected.json");
        std::fs::write(
            &protected,
            serde_json::to_string(&ProtectedFile {
                format: FORMAT.to_string(),
                version: VERSION,
                protection: WINDOWS_DPAPI_USER.to_string(),
                payload: "AA==".to_string(),
            })
            .unwrap(),
        )
        .unwrap();
        assert_eq!(
            status(&protected),
            SecureFileStatus::Protected(WINDOWS_DPAPI_USER.to_string())
        );
    }

    #[test]
    fn status_reports_unsupported_wrappers_as_unreadable() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("protected.json");
        std::fs::write(
            &path,
            serde_json::to_string(&ProtectedFile {
                format: FORMAT.to_string(),
                version: VERSION + 1,
                protection: WINDOWS_DPAPI_USER.to_string(),
                payload: "AA==".to_string(),
            })
            .unwrap(),
        )
        .unwrap();

        assert!(matches!(status(&path), SecureFileStatus::Unreadable(_)));
    }

    #[cfg(windows)]
    #[test]
    fn windows_write_uses_protected_wrapper() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("secure.json");
        write_string(&path, r#"{"secret":"value"}"#).unwrap();

        let raw = std::fs::read_to_string(&path).unwrap();
        let file: ProtectedFile = serde_json::from_str(&raw).unwrap();

        assert_eq!(file.format, FORMAT);
        assert_eq!(file.version, VERSION);
        assert_eq!(file.protection, WINDOWS_DPAPI_USER);
        assert!(
            !raw.contains("secret") && !raw.contains("value"),
            "protected Windows file must not contain plaintext JSON"
        );
    }

    /// Quotalis rebrand secure-storage compatibility proof (owner spec
    /// section 4): the on-disk format tag ("codexbar.secure-file") was
    /// deliberately NOT renamed for cosmetic reasons -- this test builds a
    /// fixture file by hand using that exact literal string (standing in
    /// for a real file a legacy QuotaArc install would have written, since
    /// the format is byte-for-byte identical either way) and proves the
    /// *current* `read_string` still decrypts it via the real Windows DPAPI
    /// unprotect API on this machine -- not mocked, not assumed. No
    /// Personal secrets are read, copied, or logged; this is a synthetic
    /// tempdir fixture only.
    #[cfg(windows)]
    #[test]
    fn legacy_format_tagged_secure_file_is_still_decryptable() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("legacy-settings.json");
        let legacy_plaintext = r#"{"apiKeys":{},"legacyMarker":"quotaarc-fixture"}"#;

        // Build the fixture the way a legacy QuotaArc process would have:
        // encrypt with the real DPAPI protect() call, wrap it in a
        // ProtectedFile whose `format` field is the literal, unrenamed
        // "codexbar.secure-file" tag -- asserted explicitly here so this
        // test would fail loudly if that constant ever drifted.
        assert_eq!(FORMAT, "codexbar.secure-file");
        let (protection, encrypted) = protect(legacy_plaintext.as_bytes()).unwrap();
        let legacy_fixture = ProtectedFile {
            format: FORMAT.to_string(),
            version: VERSION,
            protection: protection.to_string(),
            payload: base64::engine::general_purpose::STANDARD.encode(encrypted),
        };
        std::fs::write(&path, serde_json::to_string(&legacy_fixture).unwrap()).unwrap();

        // The current (Quotalis) read path: same function every real
        // Settings::load() call in production uses.
        let recovered = read_string(&path).unwrap();
        assert_eq!(recovered, legacy_plaintext);
        assert_eq!(
            status(&path),
            SecureFileStatus::Protected(protection.to_string())
        );
    }

    /// Compatibility is intentionally asymmetric: new files are always
    /// user-scoped, while an existing machine-scoped envelope can still be
    /// opened and rewritten safely. This fixture uses the real Windows DPAPI
    /// APIs in a temp directory and contains no Personal data.
    #[cfg(windows)]
    #[test]
    fn existing_machine_scoped_file_remains_readable_but_rewrites_as_user_scoped() {
        use windows::Win32::Security::Cryptography::{
            CRYPTPROTECT_LOCAL_MACHINE, CRYPTPROTECT_UI_FORBIDDEN,
        };

        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("legacy-machine-scope.json");
        let plaintext = r#"{"secret":"synthetic-fixture"}"#;
        let encrypted = protect_with_flags(
            plaintext.as_bytes(),
            CRYPTPROTECT_UI_FORBIDDEN | CRYPTPROTECT_LOCAL_MACHINE,
        )
        .unwrap();
        let legacy_fixture = ProtectedFile {
            format: FORMAT.to_string(),
            version: VERSION,
            protection: WINDOWS_DPAPI_MACHINE.to_string(),
            payload: base64::engine::general_purpose::STANDARD.encode(encrypted),
        };
        std::fs::write(&path, serde_json::to_vec(&legacy_fixture).unwrap()).unwrap();

        assert_eq!(read_string(&path).unwrap(), plaintext);
        assert_eq!(
            status(&path),
            SecureFileStatus::Protected(WINDOWS_DPAPI_MACHINE.to_string())
        );

        write_string_atomic(&path, plaintext).unwrap();
        let rewritten: ProtectedFile =
            serde_json::from_str(&std::fs::read_to_string(&path).unwrap()).unwrap();
        assert_eq!(rewritten.protection, WINDOWS_DPAPI_USER);
        assert_eq!(read_string(&path).unwrap(), plaintext);
    }
}
