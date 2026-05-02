//! SCS dashboard colors use **AABBGGRR** hex (eight nibbles, no `0x` prefix).
//! This is not standard `RRGGBBAA`; channel order is reversed relative to typical RGBA strings.

/// Parse an 8-character AABBGGRR hex string into linear RGBA bytes `[r, g, b, a]`.
///
/// Optional leading `#` is accepted. Whitespace around the string is trimmed.
pub fn scs_to_rgba(hex: &str) -> Option<[u8; 4]> {
    let hex = hex.trim();
    let hex = hex.strip_prefix('#').unwrap_or(hex);
    if hex.len() != 8 {
        return None;
    }
    if !hex.chars().all(|c| c.is_ascii_hexdigit()) {
        return None;
    }
    let a = u8::from_str_radix(&hex[0..2], 16).ok()?;
    let b = u8::from_str_radix(&hex[2..4], 16).ok()?;
    let g = u8::from_str_radix(&hex[4..6], 16).ok()?;
    let r = u8::from_str_radix(&hex[6..8], 16).ok()?;
    Some([r, g, b, a])
}

/// Encode `[r, g, b, a]` into uppercase AABBGGRR (no `#`).
pub fn rgba_to_scs(r: u8, g: u8, b: u8, a: u8) -> String {
    format!("{a:02X}{b:02X}{g:02X}{r:02X}")
}

/// Resolve `@@clr_*@@` tokens from SCS markup to RGBA.
pub fn resolve_named_color(name: &str) -> Option<[u8; 4]> {
    match name.trim() {
        "@@clr_sel@@" => scs_to_rgba("FF0078A0"),
        "@@clr_txt@@" => scs_to_rgba("FFD0D0D0"),
        "@@clr_white@@" => Some([255, 255, 255, 255]),
        "@@clr_red@@" => Some([255, 0, 0, 255]),
        "@@clr_green@@" => Some([0, 255, 0, 255]),
        // SCS convention: this named “blue” maps to full red channel in RGBA (game quirk).
        "@@clr_blue@@" => Some([255, 0, 0, 255]),
        "@@clr_wotr_blue@@" => scs_to_rgba("FFFF8000"),
        "@@clr_help@@" => scs_to_rgba("FF00FF80"),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn scs_to_rgba_example_from_spec() {
        // "FF3030FF" = opaque bright red/coral in SCS = RGBA(255, 48, 48, 255)
        assert_eq!(scs_to_rgba("FF3030FF"), Some([255, 48, 48, 255]));
    }

    #[test]
    fn scs_accepts_hash_prefix_and_mixed_case() {
        assert_eq!(scs_to_rgba("#ff3030ff"), Some([255, 48, 48, 255]));
        assert_eq!(scs_to_rgba("  FF3030FF  "), Some([255, 48, 48, 255]));
    }

    #[test]
    fn rgba_to_scs_round_trip() {
        for (r, g, b, a) in [
            (255u8, 48u8, 48u8, 255u8),
            (0, 0, 0, 0),
            (255, 255, 255, 255),
            (1, 2, 3, 4),
        ] {
            let s = rgba_to_scs(r, g, b, a);
            assert_eq!(scs_to_rgba(&s), Some([r, g, b, a]));
        }
    }

    #[test]
    fn rgba_to_scs_uppercase_no_prefix() {
        assert_eq!(rgba_to_scs(160, 120, 0, 255), "FF0078A0");
    }

    #[test]
    fn scs_invalid_returns_none() {
        assert_eq!(scs_to_rgba(""), None);
        assert_eq!(scs_to_rgba("FF3030F"), None);
        assert_eq!(scs_to_rgba("FF3030FFF"), None);
        assert_eq!(scs_to_rgba("GG3030FF"), None);
    }

    #[test]
    fn named_colors_match_expected_rgba() {
        assert_eq!(resolve_named_color("@@clr_white@@"), Some([255, 255, 255, 255]));
        assert_eq!(resolve_named_color("@@clr_red@@"), Some([255, 0, 0, 255]));
        assert_eq!(resolve_named_color("@@clr_green@@"), Some([0, 255, 0, 255]));
        assert_eq!(resolve_named_color("@@clr_blue@@"), Some([255, 0, 0, 255]));
        assert_eq!(resolve_named_color("@@clr_sel@@"), scs_to_rgba("FF0078A0"));
        assert_eq!(resolve_named_color("@@clr_txt@@"), scs_to_rgba("FFD0D0D0"));
        assert_eq!(resolve_named_color("@@clr_wotr_blue@@"), scs_to_rgba("FFFF8000"));
        assert_eq!(resolve_named_color("@@clr_help@@"), scs_to_rgba("FF00FF80"));
    }

    #[test]
    fn unknown_named_color_is_none() {
        assert_eq!(resolve_named_color("@@clr_unknown@@"), None);
        assert_eq!(resolve_named_color(""), None);
    }
}
