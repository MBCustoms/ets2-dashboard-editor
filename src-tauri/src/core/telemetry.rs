//! Shared-memory telemetry from `scs-sdk-plugin` (Windows) and normalization to dashboard IDs (0–1 where applicable).

use std::collections::HashMap;

/// Layout matches the common `TelemetryData` / scs-sdk style **packed** struct used with the dashboard editor mapping name `Local\SCSDashboardEditor`.
/// If your plugin version differs, adjust this struct (or read offsets manually).
#[repr(C, packed)]
#[derive(Clone, Copy)]
pub struct TelemetryData {
    pub sdk_active: u32,
    pub paused: u32,
    pub speed: f32,
    pub engine_rpm: f32,
    pub fuel_amount: f32,
    pub fuel_capacity: f32,
    pub water_temp: f32,
    pub oil_temp: f32,
    pub oil_pressure: f32,
    pub air_pressure: f32,
    pub brake_pressure: f32,
    pub fuel_consumption: f32,
    pub adblue_amount: f32,
    pub adblue_capacity: f32,
    pub gear: i32,
    pub displayed_gear: i32,
    pub cruise_control_speed: f32,
    pub cruise_control_on: u32,
    pub park_brake_on: u32,
    pub engine_on: u32,
    pub odometer: f32,
    pub trip_distance: f32,
    pub ambient_temp: f32,
    pub turbo_bar: f32,
    pub left_blinker: u32,
    pub right_blinker: u32,
    pub high_beam: u32,
    pub low_beam: u32,
    pub parking_lights: u32,
    pub engine_brake: u32,
    pub retarder_level: u32,
    pub differential_lock: u32,
    pub battery_voltage: f32,
    pub speed_limit: f32,
    pub instant_fuel_economy: f32,
    pub average_fuel_economy: f32,
    pub trip_fuel_consumed: f32,
    pub engine_running_time: f32,
    pub trip_time: f32,
}

pub const TELEMETRY_MAP_NAME: &str = "Local\\SCSDashboardEditor";

/// Copy `TelemetryData` from shared memory if the mapping exists and is large enough.
#[cfg(windows)]
pub fn read_shared_memory_telemetry() -> Option<TelemetryData> {
    use std::mem::size_of;

    use windows::core::w;
    use windows::Win32::Foundation::CloseHandle;
    use windows::Win32::System::Memory::{MapViewOfFile, OpenFileMappingW, UnmapViewOfFile, FILE_MAP_READ};

    let needed = size_of::<TelemetryData>();
    unsafe {
        let h = OpenFileMappingW(FILE_MAP_READ.0, false, w!("Local\\SCSDashboardEditor")).ok()?;
        let view = MapViewOfFile(h, FILE_MAP_READ, 0, 0, 0);
        if view.Value.is_null() {
            let _ = CloseHandle(h);
            return None;
        }
        let slice = std::slice::from_raw_parts(view.Value as *const u8, needed);
        let mut data: TelemetryData = std::mem::zeroed();
        std::ptr::copy_nonoverlapping(slice.as_ptr(), &mut data as *mut _ as *mut u8, needed);
        let _ = UnmapViewOfFile(view);
        let _ = CloseHandle(h);
        Some(data)
    }
}

#[cfg(not(windows))]
pub fn read_shared_memory_telemetry() -> Option<TelemetryData> {
    None
}

/// Normalize raw telemetry into dashboard `id` → value. Many values are 0–1; some (gear, trip km, etc.) are raw.
pub fn normalize(data: &TelemetryData) -> HashMap<i32, f64> {
    let mut m = HashMap::new();

    m.insert(1000, (f64::from(data.ambient_temp)).clamp(0.0, 50.0) / 50.0);
    m.insert(1010, (f64::from(data.oil_temp)).clamp(0.0, 130.0) / 130.0);

    let speed_kmh = f64::from(data.speed) * 3.6;
    m.insert(1020, speed_kmh.clamp(0.0, 150.0) / 150.0);

    m.insert(1030, f64::from(data.odometer));
    m.insert(1040, f64::from(data.gear));

    m.insert(1060, fuel_ratio(data.fuel_amount, data.fuel_capacity));
    m.insert(1070, *m.get(&1060).unwrap_or(&0.0));

    let range_km = if data.fuel_consumption > 0.001 {
        f64::from(data.fuel_amount) / f64::from(data.fuel_consumption)
    } else {
        0.0
    };
    m.insert(1080, (range_km / 2000.0).clamp(0.0, 1.0));

    m.insert(1090, (f64::from(data.water_temp)).clamp(0.0, 130.0) / 130.0);

    let cc_kmh = f64::from(data.cruise_control_speed) * 3.6;
    m.insert(1100, cc_kmh.clamp(0.0, 150.0) / 150.0);

    m.insert(1110, (f64::from(data.oil_pressure)).clamp(0.0, 8.0) / 8.0);
    m.insert(1120, (f64::from(data.air_pressure)).clamp(0.0, 12.0) / 12.0);
    m.insert(1130, f64::from(data.turbo_bar).clamp(0.0, 1.0));

    m.insert(1140, adblue_ratio(data.adblue_amount, data.adblue_capacity));
    m.insert(1150, *m.get(&1090).unwrap_or(&0.0));

    m.insert(1160, (f64::from(data.fuel_consumption)).clamp(0.0, 5.0) / 5.0);
    m.insert(1170, (f64::from(data.average_fuel_economy)).clamp(0.0, 5.0) / 5.0);

    m.insert(1180, f64::from(data.brake_pressure).clamp(0.0, 1.0));

    m.insert(1200, if *m.get(&1060).unwrap_or(&1.0) < 0.1 { 1.0 } else { 0.0 });

    m.insert(1210, f64::from(data.trip_distance));

    m.insert(1230, if data.engine_brake > 0 { 1.0 } else { 0.0 });
    m.insert(1240, if data.cruise_control_on > 0 { 1.0 } else { 0.0 });
    m.insert(1270, if data.park_brake_on > 0 { 1.0 } else { 0.0 });

    m.insert(1280, f64::from(data.engine_running_time));
    m.insert(1300, f64::from(data.gear));
    m.insert(1320, f64::from(data.battery_voltage));
    m.insert(1370, f64::from(data.air_pressure) * 14.504);
    m.insert(1390, f64::from(data.trip_time));

    m.insert(1430, *m.get(&1020).unwrap_or(&0.0));
    m.insert(1510, *m.get(&1060).unwrap_or(&0.0) * 100.0);
    m.insert(1520, *m.get(&1140).unwrap_or(&0.0) * 100.0);

    m.insert(1570, if data.left_blinker > 0 { 1.0 } else { 0.0 });
    m.insert(1580, if data.right_blinker > 0 { 1.0 } else { 0.0 });
    m.insert(1590, if data.high_beam > 0 { 1.0 } else { 0.0 });

    m.insert(1610, f64::from(data.speed_limit) * 3.6);

    m
}

#[inline]
fn fuel_ratio(amount: f32, cap: f32) -> f64 {
    if cap > 0.0 {
        (f64::from(amount) / f64::from(cap)).clamp(0.0, 1.0)
    } else {
        0.0
    }
}

#[inline]
fn adblue_ratio(amount: f32, cap: f32) -> f64 {
    if cap > 0.0 {
        (f64::from(amount) / f64::from(cap)).clamp(0.0, 1.0)
    } else {
        0.0
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalize_inserts_speed_bucket() {
        let mut t: TelemetryData = unsafe { std::mem::zeroed() };
        t.speed = 150.0 / 3.6;
        let m = normalize(&t);
        assert!((m.get(&1020).copied().unwrap() - 1.0).abs() < 0.02);
    }
}
