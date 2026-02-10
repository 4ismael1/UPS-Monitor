use chrono::{DateTime, Duration as ChronoDuration, NaiveDate, Utc};
use hidapi::HidApi;
use rodio::{Decoder, OutputStream, Sink};
use serde::{de::DeserializeOwned, Deserialize, Serialize};
use std::io::BufReader;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, Mutex, MutexGuard};
use std::thread;
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager, State};
use tauri_plugin_notification::NotificationExt;
#[cfg(target_os = "windows")]
use tauri::{
    menu::{MenuBuilder, MenuItemBuilder},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
};
#[cfg(target_os = "windows")]
use windows::Win32::Graphics::Dwm::{DwmSetWindowAttribute, DWMWA_WINDOW_CORNER_PREFERENCE, DWM_WINDOW_CORNER_PREFERENCE};

const UPS_VID: u16 = 0x0925;
const UPS_PID: u16 = 0x1234;
const MAX_EVENTS: usize = 1000;
const MAX_DATA_POINTS: usize = 5000;
const BATTERY_LOW_SHUTDOWN_DELAY_MINUTES: u64 = 5;
const BATTERY_CRITICAL_SHUTDOWN_DELAY_MINUTES: u64 = 1;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AlertConfig {
    play_sound: bool,
    show_popup: bool,
    sound_repeats: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ShutdownOnAcFault {
    enabled: bool,
    delay_minutes: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ShutdownToggle {
    enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ShutdownPCSettings {
    on_ac_fault: ShutdownOnAcFault,
    on_battery_low: ShutdownToggle,
    on_battery_critical: ShutdownToggle,
    auto_save_files: bool,
    shutdown_command: String,
    action: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct UpsControlSettings {
    shutdown_ups_after_pc: bool,
    ups_shutdown_delay: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AlertSettings {
    ac_fault: AlertConfig,
    battery_low: AlertConfig,
    battery_critical: AlertConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AppSettings {
    start_with_windows: bool,
    start_minimized: bool,
    #[serde(default)]
    monitor_only_mode: bool,
    polling_interval: u64,
    enable_notifications: bool,
    alerts: AlertSettings,
    #[serde(rename = "shutdownPC", alias = "shutdownPc")]
    shutdown_pc: ShutdownPCSettings,
    ups_control: UpsControlSettings,
    save_history: bool,
    history_interval: u64,
    low_battery_threshold: u64,
    critical_battery_threshold: u64,
    custom_sounds_path: Option<String>,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            start_with_windows: false,
            start_minimized: false,
            monitor_only_mode: false,
            polling_interval: 1000,
            enable_notifications: true,
            alerts: AlertSettings {
                ac_fault: AlertConfig {
                    play_sound: true,
                    show_popup: true,
                    sound_repeats: 3,
                },
                battery_low: AlertConfig {
                    play_sound: true,
                    show_popup: true,
                    sound_repeats: 5,
                },
                battery_critical: AlertConfig {
                    play_sound: true,
                    show_popup: true,
                    sound_repeats: 10,
                },
            },
            shutdown_pc: ShutdownPCSettings {
                on_ac_fault: ShutdownOnAcFault {
                    enabled: true,
                    delay_minutes: 18,
                },
                on_battery_low: ShutdownToggle { enabled: false },
                on_battery_critical: ShutdownToggle { enabled: true },
                auto_save_files: true,
                shutdown_command: String::new(),
                action: "shutdown".to_string(),
            },
            ups_control: UpsControlSettings {
                shutdown_ups_after_pc: true,
                ups_shutdown_delay: 2,
            },
            save_history: true,
            history_interval: 300,
            low_battery_threshold: 20,
            critical_battery_threshold: 10,
            custom_sounds_path: None,
        }
    }
}

impl AppSettings {
    fn apply_monitor_only_defaults(&mut self) {
        self.enable_notifications = false;
        self.alerts.ac_fault.play_sound = false;
        self.alerts.ac_fault.show_popup = false;
        self.alerts.battery_low.play_sound = false;
        self.alerts.battery_low.show_popup = false;
        self.alerts.battery_critical.play_sound = false;
        self.alerts.battery_critical.show_popup = false;

        self.shutdown_pc.on_ac_fault.enabled = false;
        self.shutdown_pc.on_battery_low.enabled = false;
        self.shutdown_pc.on_battery_critical.enabled = false;
        self.shutdown_pc.auto_save_files = false;
        self.shutdown_pc.shutdown_command.clear();

        self.ups_control.shutdown_ups_after_pc = false;
        self.save_history = false;
    }

    fn normalize(mut self) -> Self {
        self.polling_interval = clamp_u64(self.polling_interval, 500, 10_000, 1000);
        self.history_interval = clamp_u64(self.history_interval, 60, 3600, 300);
        self.low_battery_threshold = clamp_u64(self.low_battery_threshold, 5, 50, 20);
        self.critical_battery_threshold =
            clamp_u64(self.critical_battery_threshold, 5, 30, 10).min(self.low_battery_threshold);

        self.alerts.ac_fault.sound_repeats =
            clamp_u64(self.alerts.ac_fault.sound_repeats, 1, 30, 3);
        self.alerts.battery_low.sound_repeats =
            clamp_u64(self.alerts.battery_low.sound_repeats, 1, 30, 5);
        self.alerts.battery_critical.sound_repeats =
            clamp_u64(self.alerts.battery_critical.sound_repeats, 1, 30, 10);

        self.shutdown_pc.on_ac_fault.delay_minutes =
            clamp_u64(self.shutdown_pc.on_ac_fault.delay_minutes, 1, 60, 18);
        self.ups_control.ups_shutdown_delay =
            clamp_u64(self.ups_control.ups_shutdown_delay, 1, 10, 2);

        if self.shutdown_pc.action != "shutdown" && self.shutdown_pc.action != "sleep" {
            self.shutdown_pc.action = "shutdown".to_string();
        }

        if self.monitor_only_mode {
            self.apply_monitor_only_defaults();
        }

        self
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct UpsStatusFlags {
    raw: String,
    utility_fail: bool,
    battery_low: bool,
    bypass_active: bool,
    ups_failed: bool,
    ups_is_standby: bool,
    test_in_progress: bool,
    shutdown_active: bool,
    beeper_on: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct UpsData {
    r#type: String,
    input_voltage: f64,
    fault_voltage: f64,
    output_voltage: f64,
    load_percent: u64,
    frequency: f64,
    battery_voltage: f64,
    temperature: f64,
    battery_percent: u64,
    estimated_runtime: u64,
    timestamp: String,
    status: UpsStatusFlags,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct UpsInfo {
    manufacturer: String,
    product: String,
    vendor_id: String,
    product_id: String,
    firmware: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct HistoryEvent {
    id: u64,
    time: String,
    classification: String,
    name: String,
    remarks: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct DataHistoryEntry {
    id: u64,
    time: String,
    input_voltage: f64,
    output_voltage: f64,
    frequency: f64,
    load_percent: u64,
    battery_voltage: f64,
    battery_percent: u64,
    temperature: f64,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct HistoryFilter {
    classification: Option<String>,
    date_from: Option<String>,
    date_to: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SoundRepeatConfig {
    ac_fault: u64,
    battery_low: u64,
    critical: u64,
    default: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SoundConfig {
    repeat_config: SoundRepeatConfig,
    repeat_delay: u64,
    custom_sounds_path: Option<String>,
    sounds: SoundFiles,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SoundFiles {
    ac_fault: String,
    battery_low: String,
    critical: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SoundInfo {
    name: String,
    path: String,
    custom: bool,
    location: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SoundConfigPatch {
    repeat_config: Option<RepeatConfigPatch>,
    repeat_delay: Option<u64>,
    custom_sounds_path: Option<Option<String>>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RepeatConfigPatch {
    ac_fault: Option<u64>,
    battery_low: Option<u64>,
    critical: Option<u64>,
    default: Option<u64>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ShutdownSimulationResult {
    scheduled: bool,
    cancelled: bool,
    minutes: u64,
    shutdown_time: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ShutdownScheduledPayload {
    minutes: u64,
    shutdown_time: String,
}

#[derive(Debug, Clone)]
enum DecodedPacket {
    Status(UpsData),
    Version(String),
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum AlertKind {
    AcFault,
    BatteryLow,
    BatteryCritical,
}

impl AlertKind {
    fn from_str(value: &str) -> Option<Self> {
        match value {
            "acFault" | "ac_fault" | "ac-fault" | "ac" => Some(Self::AcFault),
            "batteryLow" | "battery_low" | "battery-low" | "low" => Some(Self::BatteryLow),
            "batteryCritical" | "critical" | "battery_critical" | "battery-critical" => {
                Some(Self::BatteryCritical)
            }
            _ => None,
        }
    }

    fn event_name(self) -> &'static str {
        match self {
            Self::AcFault => "Fallo de energia",
            Self::BatteryLow => "Bateria baja",
            Self::BatteryCritical => "Bateria critica",
        }
    }

    fn alert_type(self) -> &'static str {
        match self {
            Self::AcFault => "warning",
            Self::BatteryLow => "battery",
            Self::BatteryCritical => "critical",
        }
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct UrgentAlertPayload {
    title: String,
    message: String,
    alert_type: String,
    created_at: String,
}

struct AppState {
    config_path: PathBuf,
    events_path: PathBuf,
    data_path: PathBuf,
    sounds_path: PathBuf,
    settings: Mutex<AppSettings>,
    events: Mutex<Vec<HistoryEvent>>,
    data_history: Mutex<Vec<DataHistoryEntry>>,
    last_status: Mutex<Option<UpsData>>,
    device_info: Mutex<Option<UpsInfo>>,
    is_connected: Mutex<bool>,
    has_emitted_disconnected: Mutex<bool>,
    is_on_battery: Mutex<bool>,
    was_battery_low: Mutex<bool>,
    was_battery_critical: Mutex<bool>,
    battery_start_ms: Mutex<Option<u64>>,
    last_data_save_ms: Mutex<u64>,
    scheduled_shutdown_at_ms: Mutex<Option<u64>>,
    scheduled_shutdown_reason: Mutex<Option<String>>,
    last_error: Mutex<Option<String>>,
    stop_monitor: AtomicBool,
    allow_process_exit: AtomicBool,
    pending_show_main_window: AtomicBool,
    sound_generation: AtomicU64,
    last_forced_popup_ms: AtomicU64,
}

type SharedState = Arc<AppState>;

impl AppState {
    fn new(app: &AppHandle) -> Self {
        let app_data_dir = app.path().app_data_dir().unwrap_or_else(|_| {
            std::env::current_dir()
                .unwrap_or_else(|_| PathBuf::from("."))
                .join(".ups-monitor-pro")
        });

        let history_dir = app_data_dir.join("history");
        let sounds_path = app_data_dir.join("sounds");
        let _ = fs::create_dir_all(&history_dir);
        let _ = fs::create_dir_all(&sounds_path);

        let config_path = app_data_dir.join("config.json");
        let events_path = history_dir.join("events.json");
        let data_path = history_dir.join("data.json");

        let settings: AppSettings = read_json_or_default::<AppSettings>(&config_path).normalize();
        write_json_pretty(&config_path, &settings);

        let events: Vec<HistoryEvent> = read_json_or_default(&events_path);
        let data_history: Vec<DataHistoryEntry> = read_json_or_default(&data_path);

        Self {
            config_path,
            events_path,
            data_path,
            sounds_path,
            settings: Mutex::new(settings),
            events: Mutex::new(events),
            data_history: Mutex::new(data_history),
            last_status: Mutex::new(None),
            device_info: Mutex::new(None),
            is_connected: Mutex::new(false),
            has_emitted_disconnected: Mutex::new(false),
            is_on_battery: Mutex::new(false),
            was_battery_low: Mutex::new(false),
            was_battery_critical: Mutex::new(false),
            battery_start_ms: Mutex::new(None),
            last_data_save_ms: Mutex::new(0),
            scheduled_shutdown_at_ms: Mutex::new(None),
            scheduled_shutdown_reason: Mutex::new(None),
            last_error: Mutex::new(None),
            stop_monitor: AtomicBool::new(false),
            allow_process_exit: AtomicBool::new(false),
            pending_show_main_window: AtomicBool::new(false),
            sound_generation: AtomicU64::new(0),
            last_forced_popup_ms: AtomicU64::new(0),
        }
    }

    fn save_settings(&self) {
        let settings = lock(&self.settings).clone();
        write_json_pretty(&self.config_path, &settings);
    }

    fn save_events(&self) {
        let events = lock(&self.events).clone();
        write_json_pretty(&self.events_path, &events);
    }

    fn save_data_history(&self) {
        let data = lock(&self.data_history).clone();
        write_json_pretty(&self.data_path, &data);
    }

    fn log_event(&self, classification: &str, name: &str, remarks: &str) {
        if lock(&self.settings).monitor_only_mode {
            return;
        }

        let mut events = lock(&self.events);
        events.insert(
            0,
            HistoryEvent {
                id: now_millis(),
                time: now_iso(),
                classification: classification.to_string(),
                name: name.to_string(),
                remarks: remarks.to_string(),
            },
        );
        if events.len() > MAX_EVENTS {
            events.truncate(MAX_EVENTS);
        }
        drop(events);
        self.save_events();
    }

    fn log_data_point_if_needed(&self, status: &UpsData) {
        let settings = lock(&self.settings).clone();
        if !settings.save_history {
            return;
        }

        let now = now_millis();
        let mut last_save = lock(&self.last_data_save_ms);
        if now.saturating_sub(*last_save) < settings.history_interval.saturating_mul(1000) {
            return;
        }
        *last_save = now;
        drop(last_save);

        let mut data = lock(&self.data_history);
        data.insert(
            0,
            DataHistoryEntry {
                id: now,
                time: now_iso(),
                input_voltage: status.input_voltage,
                output_voltage: status.output_voltage,
                frequency: status.frequency,
                load_percent: status.load_percent,
                battery_voltage: status.battery_voltage,
                battery_percent: status.battery_percent,
                temperature: status.temperature,
            },
        );

        if data.len() > MAX_DATA_POINTS {
            data.truncate(MAX_DATA_POINTS);
        }

        drop(data);
        self.save_data_history();
    }
}

fn lock<T>(mutex: &Mutex<T>) -> MutexGuard<'_, T> {
    mutex.lock().unwrap_or_else(|e| e.into_inner())
}

fn clamp_u64(value: u64, min: u64, max: u64, fallback: u64) -> u64 {
    if value == 0 {
        return fallback;
    }
    value.max(min).min(max)
}

fn now_millis() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

fn now_iso() -> String {
    Utc::now().to_rfc3339()
}

fn write_json_pretty<T: Serialize>(path: &Path, value: &T) {
    if let Ok(text) = serde_json::to_string_pretty(value) {
        let _ = fs::write(path, text);
    }
}

fn read_json_or_default<T>(path: &Path) -> T
where
    T: DeserializeOwned + Default,
{
    match fs::read_to_string(path) {
        Ok(content) => serde_json::from_str::<T>(&content).unwrap_or_default(),
        Err(_) => T::default(),
    }
}

fn emit_if_possible<T: Serialize + Clone>(app: &AppHandle, event: &str, payload: T) {
    let _ = app.emit(event, payload);
}

fn mark_disconnected(app: &AppHandle, state: &SharedState) {
    let mut connected = lock(&state.is_connected);
    let was_connected = *connected;
    *connected = false;
    drop(connected);

    let mut has_emitted_disconnected = lock(&state.has_emitted_disconnected);
    if !was_connected && *has_emitted_disconnected {
        return;
    }
    *has_emitted_disconnected = true;
    drop(has_emitted_disconnected);

    *lock(&state.is_on_battery) = false;
    *lock(&state.was_battery_low) = false;
    *lock(&state.was_battery_critical) = false;
    *lock(&state.battery_start_ms) = None;
    *lock(&state.last_status) = None;
    let _ = cancel_scheduled_shutdown(state, app, true);
    state.sound_generation.fetch_add(1, Ordering::Relaxed);

    if was_connected {
        state.log_event("Critical Event", "UPS disconnected", "UPS disconnected");
    }
    emit_if_possible(app, "ups-disconnected", ());
}

fn mark_connected(app: &AppHandle, state: &SharedState) {
    let mut connected = lock(&state.is_connected);
    if *connected {
        return;
    }

    *connected = true;
    drop(connected);
    *lock(&state.has_emitted_disconnected) = false;

    state.log_event("General Event", "UPS connected", "UPS connected");
    emit_if_possible(app, "ups-connected", ());
}

fn emit_error_once(app: &AppHandle, state: &SharedState, message: String) {
    let mut last_error = lock(&state.last_error);
    if last_error.as_ref() == Some(&message) {
        return;
    }
    *last_error = Some(message.clone());
    drop(last_error);
    emit_if_possible(app, "ups-error", message);
}

fn clear_last_error(state: &SharedState) {
    *lock(&state.last_error) = None;
}

fn alert_config_for_kind(settings: &AppSettings, kind: AlertKind) -> AlertConfig {
    match kind {
        AlertKind::AcFault => settings.alerts.ac_fault.clone(),
        AlertKind::BatteryLow => settings.alerts.battery_low.clone(),
        AlertKind::BatteryCritical => settings.alerts.battery_critical.clone(),
    }
}

fn alert_sound_file_name(kind: AlertKind) -> &'static str {
    match kind {
        AlertKind::AcFault => "alert-ac-fault.wav",
        AlertKind::BatteryLow => "alert-battery-low.wav",
        AlertKind::BatteryCritical => "alert-critical.wav",
    }
}

fn resolve_sound_path(state: &SharedState, settings: &AppSettings, kind: AlertKind) -> Option<PathBuf> {
    let file_name = alert_sound_file_name(kind);

    if let Some(custom_path) = settings.custom_sounds_path.as_ref() {
        let custom_file = PathBuf::from(custom_path).join(file_name);
        if custom_file.exists() {
            return Some(custom_file);
        }
    }

    let app_file = state.sounds_path.join(file_name);
    if app_file.exists() {
        return Some(app_file);
    }

    None
}

fn play_fallback_beep() {
    #[cfg(target_os = "windows")]
    {
        let _ = Command::new("powershell")
            .args([
                "-NoProfile",
                "-WindowStyle",
                "Hidden",
                "-Command",
                "[console]::beep(950,220)",
            ])
            .spawn();
    }
}

fn play_sound_with_generation(state: SharedState, sound_path: Option<PathBuf>, repeats: u64) -> bool {
    let generation = state.sound_generation.fetch_add(1, Ordering::Relaxed) + 1;
    let loop_count = repeats.max(1).min(30);

    tauri::async_runtime::spawn_blocking(move || {
        let stream = OutputStream::try_default().ok();

        for _ in 0..loop_count {
            if state.sound_generation.load(Ordering::Relaxed) != generation {
                return;
            }

            let mut played_from_file = false;
            if let (Some(path), Some((_, stream_handle))) = (sound_path.as_ref(), stream.as_ref()) {
                if let Ok(file) = fs::File::open(path) {
                    if let Ok(source) = Decoder::new(BufReader::new(file)) {
                        if let Ok(sink) = Sink::try_new(stream_handle) {
                            sink.append(source);
                            played_from_file = true;
                            while !sink.empty() {
                                if state.sound_generation.load(Ordering::Relaxed) != generation {
                                    sink.stop();
                                    return;
                                }
                                thread::sleep(Duration::from_millis(70));
                            }
                        }
                    }
                }
            }

            if !played_from_file {
                play_fallback_beep();
                thread::sleep(Duration::from_millis(260));
            }

            if state.sound_generation.load(Ordering::Relaxed) != generation {
                return;
            }
            thread::sleep(Duration::from_millis(140));
        }
    });

    true
}

fn notify_windows(app: &AppHandle, title: &str, message: &str) -> bool {
    match app
        .notification()
        .builder()
        .title(title)
        .body(message)
        .show()
    {
        Ok(_) => true,
        Err(error) => {
            eprintln!("notification error: {}", error);
            false
        }
    }
}

fn escape_ps_single_quote(input: &str) -> String {
    input.replace('\'', "''")
}

fn should_force_popup(app: &AppHandle, state: &SharedState) -> bool {
    let now = now_millis();
    let last = state.last_forced_popup_ms.load(Ordering::Relaxed);
    if now.saturating_sub(last) < 6_000 {
        return false;
    }

    if let Some(window) = app.get_webview_window("main") {
        let is_visible = window.is_visible().unwrap_or(false);
        let is_focused = window.is_focused().unwrap_or(false);
        if is_visible && is_focused {
            return false;
        }
    }

    state.last_forced_popup_ms.store(now, Ordering::Relaxed);
    true
}

fn force_windows_popup(title: &str, message: &str, alert_type: &str) {
    #[cfg(target_os = "windows")]
    {
        let popup_flags = if alert_type == "critical" { "0x1010" } else { "0x1030" };
        let safe_title = escape_ps_single_quote(title);
        let safe_message = escape_ps_single_quote(message);
        let script = format!(
            "$w=New-Object -ComObject WScript.Shell; $null=$w.Popup('{}', 12, '{}', {})",
            safe_message, safe_title, popup_flags
        );

        let _ = Command::new("powershell")
            .args(["-NoProfile", "-WindowStyle", "Hidden", "-Command", &script])
            .spawn();
    }
}

fn emit_urgent_alert(app: &AppHandle, title: &str, message: &str, alert_type: &str) {
    emit_if_possible(
        app,
        "urgent-alert",
        UrgentAlertPayload {
            title: title.to_string(),
            message: message.to_string(),
            alert_type: alert_type.to_string(),
            created_at: now_iso(),
        },
    );
}

fn cancel_scheduled_shutdown(state: &SharedState, app: &AppHandle, emit_event: bool) -> bool {
    let had_schedule = lock(&state.scheduled_shutdown_at_ms).take().is_some();
    *lock(&state.scheduled_shutdown_reason) = None;
    if had_schedule && emit_event {
        emit_if_possible(app, "shutdown-cancelled", ());
    }
    had_schedule
}

fn schedule_shutdown_after_minutes(
    state: &SharedState,
    app: &AppHandle,
    delay_minutes: u64,
    reason: &str,
) -> bool {
    let safe_minutes = delay_minutes.max(1).min(120);
    let target_ms = now_millis().saturating_add(safe_minutes * 60 * 1000);

    let mut shutdown_guard = lock(&state.scheduled_shutdown_at_ms);
    let should_replace = shutdown_guard
        .map(|existing| target_ms < existing)
        .unwrap_or(true);
    if !should_replace {
        return true;
    }

    *shutdown_guard = Some(target_ms);
    drop(shutdown_guard);

    *lock(&state.scheduled_shutdown_reason) = Some(reason.to_string());
    emit_if_possible(
        app,
        "shutdown-scheduled",
        ShutdownScheduledPayload {
            minutes: safe_minutes,
            shutdown_time: (Utc::now() + ChronoDuration::minutes(safe_minutes as i64)).to_rfc3339(),
        },
    );
    true
}

fn execute_shutdown_command(settings: &AppSettings) -> Result<(), String> {
    let custom_command = settings.shutdown_pc.shutdown_command.trim();
    if !custom_command.is_empty() {
        Command::new("cmd")
            .args(["/C", custom_command])
            .spawn()
            .map(|_| ())
            .map_err(|err| format!("No se pudo ejecutar comando personalizado: {}", err))?;
        return Ok(());
    }

    let action = settings.shutdown_pc.action.as_str();
    if action == "sleep" {
        Command::new("rundll32.exe")
            .args(["powrprof.dll,SetSuspendState", "0,1,0"])
            .spawn()
            .map(|_| ())
            .map_err(|err| format!("No se pudo ejecutar suspension: {}", err))?;
        return Ok(());
    }

    Command::new("shutdown")
        .args(["/s", "/t", "0", "/f"])
        .spawn()
        .map(|_| ())
        .map_err(|err| format!("No se pudo ejecutar apagado: {}", err))
}

fn process_pending_shutdown(app: &AppHandle, state: &SharedState, settings: &AppSettings) {
    if settings.monitor_only_mode {
        return;
    }

    let is_due = {
        let shutdown_at = *lock(&state.scheduled_shutdown_at_ms);
        shutdown_at
            .map(|ts| now_millis() >= ts)
            .unwrap_or(false)
    };

    if !is_due {
        return;
    }

    let reason = lock(&state.scheduled_shutdown_reason)
        .clone()
        .unwrap_or_else(|| "shutdown-scheduled".to_string());
    let _ = cancel_scheduled_shutdown(state, app, false);

    let title = "Apagado de seguridad";
    let message = format!("Ejecutando accion configurada ({})", reason);
    let _ = notify_windows(app, title, &message);
    if should_force_popup(app, state) {
        force_windows_popup(title, &message, "critical");
    }
    emit_urgent_alert(app, title, &message, "critical");
    state.log_event("Critical Event", "Shutdown execution", &reason);

    if let Err(error) = execute_shutdown_command(settings) {
        emit_error_once(app, state, error);
    }
}

fn handle_alert_transition(
    app: &AppHandle,
    state: &SharedState,
    settings: &AppSettings,
    kind: AlertKind,
    status: &UpsData,
) {
    if settings.monitor_only_mode {
        return;
    }

    let config = alert_config_for_kind(settings, kind);
    let title = kind.event_name();
    let message = format!(
        "Entrada {:.1}V · Bateria {}% · Carga {}%",
        status.input_voltage, status.battery_percent, status.load_percent
    );

    if settings.enable_notifications && config.show_popup {
        let _ = notify_windows(app, title, &message);
    }

    if config.show_popup {
        emit_urgent_alert(app, title, &message, kind.alert_type());
        if should_force_popup(app, state) {
            force_windows_popup(title, &message, kind.alert_type());
        }
    }

    if config.play_sound {
        let sound_path = resolve_sound_path(state, settings, kind);
        let _ = play_sound_with_generation(state.clone(), sound_path, config.sound_repeats);
    }

    match kind {
        AlertKind::AcFault if settings.shutdown_pc.on_ac_fault.enabled => {
            let _ = schedule_shutdown_after_minutes(
                state,
                app,
                settings.shutdown_pc.on_ac_fault.delay_minutes,
                "ac-fault",
            );
        }
        AlertKind::BatteryLow if settings.shutdown_pc.on_battery_low.enabled => {
            let _ = schedule_shutdown_after_minutes(
                state,
                app,
                BATTERY_LOW_SHUTDOWN_DELAY_MINUTES,
                "battery-low",
            );
        }
        AlertKind::BatteryCritical if settings.shutdown_pc.on_battery_critical.enabled => {
            let _ = schedule_shutdown_after_minutes(
                state,
                app,
                BATTERY_CRITICAL_SHUTDOWN_DELAY_MINUTES,
                "battery-critical",
            );
        }
        _ => {}
    }
}

fn poll_ups(
    app: &AppHandle,
    state: &SharedState,
    api: &HidApi,
    connected_device: &mut Option<hidapi::HidDevice>,
    read_timeout_ms: i32,
) {
    if let Some(device) = connected_device.as_ref() {
        clear_last_error(state);
        mark_connected(app, state);
        if !read_one_packet(app, state, device, read_timeout_ms) {
            *connected_device = None;
        }
        return;
    }

    let mut found = false;

    for device_info in api.device_list() {
        if device_info.vendor_id() != UPS_VID || device_info.product_id() != UPS_PID {
            continue;
        }

        found = true;

        let info = UpsInfo {
            manufacturer: device_info
                .manufacturer_string()
                .unwrap_or("RICHCOMM")
                .to_string(),
            product: device_info
                .product_string()
                .unwrap_or("UPS USB Mon")
                .to_string(),
            vendor_id: format!("{:04X}", UPS_VID),
            product_id: format!("{:04X}", UPS_PID),
            firmware: lock(&state.device_info)
                .as_ref()
                .and_then(|existing| existing.firmware.clone()),
        };
        *lock(&state.device_info) = Some(info);

        match api.open_path(device_info.path()) {
            Ok(device) => {
                clear_last_error(state);
                mark_connected(app, state);
                *connected_device = Some(device);
                if let Some(active_device) = connected_device.as_ref() {
                    let _ = read_one_packet(app, state, active_device, read_timeout_ms.min(150));
                }
                return;
            }
            Err(error) => {
                emit_error_once(app, state, format!("Cannot open UPS HID device: {}", error));
            }
        }
    }

    if !found {
        clear_last_error(state);
        mark_disconnected(app, state);
    }
}

fn read_one_packet(
    app: &AppHandle,
    state: &SharedState,
    device: &hidapi::HidDevice,
    read_timeout_ms: i32,
) -> bool {
    let mut buffer = [0u8; 64];
    match device.read_timeout(&mut buffer, read_timeout_ms.max(100)) {
        Ok(size) if size > 0 => {
            if let Some(decoded) = decode_packet(&buffer[..size]) {
                match decoded {
                    DecodedPacket::Version(firmware) => {
                        if let Some(info) = lock(&state.device_info).as_mut() {
                            info.firmware = Some(firmware);
                        }
                    }
                    DecodedPacket::Status(status) => {
                        handle_status_packet(app, state, status);
                    }
                }
            }
            true
        }
        Ok(_) => true,
        Err(error) => {
            emit_error_once(app, state, format!("HID read error: {}", error));
            mark_disconnected(app, state);
            false
        }
    }
}

fn handle_status_packet(app: &AppHandle, state: &SharedState, status: UpsData) {
    let settings = lock(&state.settings).clone();

    let was_on_battery = *lock(&state.is_on_battery);
    let is_on_battery = status.status.utility_fail;

    let mut ac_fault_triggered = false;
    if is_on_battery && !was_on_battery {
        *lock(&state.battery_start_ms) = Some(now_millis());
        state.log_event("Critical Event", "AC Fault", "AC Fault");
        ac_fault_triggered = true;
    }

    if !is_on_battery && was_on_battery {
        *lock(&state.battery_start_ms) = None;
        *lock(&state.was_battery_low) = false;
        *lock(&state.was_battery_critical) = false;
        state.log_event("General Event", "Normal AC value", "Normal AC value");
        let _ = cancel_scheduled_shutdown(state, app, true);
        state.sound_generation.fetch_add(1, Ordering::Relaxed);
    }

    let is_low_battery = is_on_battery
        && (status.status.battery_low || status.battery_percent <= settings.low_battery_threshold);
    let is_critical_battery =
        is_on_battery && status.battery_percent <= settings.critical_battery_threshold;

    let battery_low_triggered = {
        let mut was_low = lock(&state.was_battery_low);
        let mut triggered = false;
        if is_low_battery && !is_critical_battery && !*was_low {
            state.log_event("Critical Event", "Battery Low", "Battery Low");
            *was_low = true;
            triggered = true;
        }
        if !is_low_battery {
            *was_low = false;
        }
        triggered
    };

    let battery_critical_triggered = {
        let mut was_critical = lock(&state.was_battery_critical);
        let mut triggered = false;
        if is_critical_battery && !*was_critical {
            state.log_event("Critical Event", "Battery Critical", "Battery Critical");
            *was_critical = true;
            triggered = true;
        }
        if !is_critical_battery {
            *was_critical = false;
        }
        triggered
    };

    if ac_fault_triggered {
        handle_alert_transition(app, state, &settings, AlertKind::AcFault, &status);
    }
    if battery_low_triggered {
        handle_alert_transition(app, state, &settings, AlertKind::BatteryLow, &status);
    }
    if battery_critical_triggered {
        handle_alert_transition(app, state, &settings, AlertKind::BatteryCritical, &status);
    }

    process_pending_shutdown(app, state, &settings);

    *lock(&state.is_on_battery) = is_on_battery;
    *lock(&state.last_status) = Some(status.clone());

    state.log_data_point_if_needed(&status);
    emit_if_possible(app, "ups-data", status);
}

fn decode_packet(raw_data: &[u8]) -> Option<DecodedPacket> {
    if raw_data.is_empty() {
        return None;
    }

    let data_bytes = if raw_data.len() > 1 {
        &raw_data[1..]
    } else {
        raw_data
    };
    let content_end = data_bytes
        .iter()
        .position(|byte| *byte == 0x0D)
        .unwrap_or(data_bytes.len());

    let ascii = data_bytes
        .iter()
        .take(content_end)
        .filter(|byte| **byte >= 32 && **byte <= 126)
        .map(|byte| *byte as char)
        .collect::<String>();

    parse_ups_string(ascii.trim())
}

fn parse_ups_string(input: &str) -> Option<DecodedPacket> {
    if input.starts_with('(') {
        let parts = input
            .trim_start_matches('(')
            .split_whitespace()
            .collect::<Vec<_>>();
        if parts.len() < 8 {
            return None;
        }

        let status_bits = parts[7];
        let battery_voltage = parse_f64(parts[5]);
        let load_percent = parse_u64(parts[3]);
        let battery_percent = calculate_battery_percent(battery_voltage);

        let status = UpsData {
            r#type: "STATUS".to_string(),
            input_voltage: parse_f64(parts[0]),
            fault_voltage: parse_f64(parts[1]),
            output_voltage: parse_f64(parts[2]),
            load_percent,
            frequency: parse_f64(parts[4]),
            battery_voltage,
            temperature: parse_f64(parts[6]),
            battery_percent,
            estimated_runtime: estimate_runtime(battery_percent, load_percent),
            timestamp: now_iso(),
            status: UpsStatusFlags {
                raw: status_bits.to_string(),
                utility_fail: status_bit(status_bits, 0),
                battery_low: status_bit(status_bits, 1),
                bypass_active: status_bit(status_bits, 2),
                ups_failed: status_bit(status_bits, 3),
                ups_is_standby: status_bit(status_bits, 4),
                test_in_progress: status_bit(status_bits, 5),
                shutdown_active: status_bit(status_bits, 6),
                beeper_on: status_bit(status_bits, 7),
            },
        };

        return Some(DecodedPacket::Status(status));
    }

    if input.contains('V') && (input.contains('#') || input.contains("V")) {
        return Some(DecodedPacket::Version(
            input.replace('#', "").trim().to_string(),
        ));
    }

    None
}

fn parse_f64(value: &str) -> f64 {
    value.parse::<f64>().unwrap_or(0.0)
}

fn parse_u64(value: &str) -> u64 {
    value.parse::<u64>().unwrap_or(0)
}

fn status_bit(bits: &str, index: usize) -> bool {
    bits.chars().nth(index).map(|ch| ch == '1').unwrap_or(false)
}

fn calculate_battery_percent(voltage: f64) -> u64 {
    let min_voltage = 21.0;
    let max_voltage = 26.8;

    if voltage <= min_voltage {
        return 0;
    }
    if voltage >= max_voltage {
        return 100;
    }

    (((voltage - min_voltage) / (max_voltage - min_voltage)) * 100.0)
        .round()
        .clamp(0.0, 100.0) as u64
}

fn estimate_runtime(battery_percent: u64, load_percent: u64) -> u64 {
    let base_runtime_minutes = 15.0;
    let load_factor = (load_percent.max(10) as f64) / 100.0;
    ((battery_percent as f64 / 100.0) * (base_runtime_minutes / load_factor)).round() as u64
}

fn start_ups_monitor(app: AppHandle, state: SharedState) {
    tauri::async_runtime::spawn_blocking(move || {
        let mut api: Option<HidApi> = None;
        let mut connected_device: Option<hidapi::HidDevice> = None;
        let mut last_device_refresh_ms = 0_u64;

        while !state.stop_monitor.load(Ordering::Relaxed) {
            let settings = lock(&state.settings).clone();
            let polling_interval_ms = settings.polling_interval.max(500);
            let has_recent_status = lock(&state.last_status).is_some();
            let read_timeout_ms = if connected_device.is_some() {
                if has_recent_status {
                    polling_interval_ms.min(600) as i32
                } else {
                    120
                }
            } else {
                90
            };

            if api.is_none() {
                match HidApi::new() {
                    Ok(next_api) => api = Some(next_api),
                    Err(error) => {
                        mark_disconnected(&app, &state);
                        emit_error_once(&app, &state, format!("HID init error: {}", error));
                        thread::sleep(Duration::from_millis(1_500));
                        continue;
                    }
                }
            }

            if let Some(api_ref) = api.as_mut() {
                let now = now_millis();
                let refresh_interval_ms = if connected_device.is_some() { 2_000 } else { 350 };

                if now.saturating_sub(last_device_refresh_ms) >= refresh_interval_ms {
                    if let Err(error) = api_ref.refresh_devices() {
                        mark_disconnected(&app, &state);
                        emit_error_once(&app, &state, format!("HID refresh error: {}", error));
                        api = None;
                        connected_device = None;
                        thread::sleep(Duration::from_millis(1_500));
                        continue;
                    }
                    last_device_refresh_ms = now;
                }

                poll_ups(
                    &app,
                    &state,
                    api_ref,
                    &mut connected_device,
                    read_timeout_ms,
                );
            }

            process_pending_shutdown(&app, &state, &settings);

            let is_connected = *lock(&state.is_connected);
            let sleep_ms = if is_connected {
                if has_recent_status {
                    polling_interval_ms
                        .saturating_sub(read_timeout_ms.max(0) as u64)
                        .clamp(30, 280)
                } else {
                    30
                }
            } else {
                150
            };
            thread::sleep(Duration::from_millis(sleep_ms));
        }
    });
}

fn parse_date_bound(date_str: &str, end_of_day: bool) -> Option<DateTime<Utc>> {
    let date = NaiveDate::parse_from_str(date_str, "%Y-%m-%d").ok()?;
    let naive_dt = if end_of_day {
        date.and_hms_opt(23, 59, 59)?
    } else {
        date.and_hms_opt(0, 0, 0)?
    };
    Some(DateTime::<Utc>::from_naive_utc_and_offset(naive_dt, Utc))
}

fn parse_rfc3339_utc(date_str: &str) -> Option<DateTime<Utc>> {
    DateTime::parse_from_rfc3339(date_str)
        .ok()
        .map(|dt| dt.with_timezone(&Utc))
}

#[tauri::command]
fn get_settings(state: State<'_, SharedState>) -> AppSettings {
    lock(&state.settings).clone()
}

#[tauri::command]
fn save_settings(
    app: AppHandle,
    state: State<'_, SharedState>,
    new_settings: AppSettings,
) -> Result<bool, String> {
    let normalized = new_settings.normalize();
    if normalized.monitor_only_mode {
        state.sound_generation.fetch_add(1, Ordering::Relaxed);
        let _ = cancel_scheduled_shutdown(&state, &app, true);
    }
    *lock(&state.settings) = normalized.clone();
    state.save_settings();

    Ok(true)
}

#[tauri::command]
fn get_ups_status(state: State<'_, SharedState>) -> Option<UpsData> {
    lock(&state.last_status).clone()
}

#[tauri::command]
fn get_ups_info(state: State<'_, SharedState>) -> Option<UpsInfo> {
    lock(&state.device_info).clone()
}

#[tauri::command]
fn test_notification(app: AppHandle, state: State<'_, SharedState>) -> bool {
    let _ = notify_windows(
        &app,
        "UPS Monitor",
        "Notificacion de prueba enviada correctamente",
    );
    if should_force_popup(&app, &state) {
        force_windows_popup(
            "UPS Monitor",
            "Notificacion de prueba enviada correctamente",
            "warning",
        );
    }
    true
}

#[tauri::command]
fn minimize_main_window(app: AppHandle) -> bool {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.set_skip_taskbar(true);
        return window.close().is_ok();
    }
    false
}

#[tauri::command]
fn toggle_maximize_main_window(app: AppHandle) -> bool {
    if let Some(window) = app.get_webview_window("main") {
        let is_maximized = window.is_maximized().unwrap_or(false);
        if is_maximized {
            return window.unmaximize().is_ok();
        }
        return window.maximize().is_ok();
    }
    false
}

#[tauri::command]
fn close_main_window(app: AppHandle) -> bool {
    request_app_exit(&app);
    true
}

fn create_main_window(app: &AppHandle) -> bool {
    let window_config = app
        .config()
        .app
        .windows
        .iter()
        .find(|w| w.label == "main")
        .or_else(|| app.config().app.windows.first());

    let Some(window_config) = window_config else {
        return false;
    };

    if let Some(state) = app.try_state::<SharedState>() {
        state.pending_show_main_window.store(true, Ordering::Relaxed);
    }

    let window = match tauri::WebviewWindowBuilder::from_config(app, window_config) {
        Ok(builder) => match builder
            .decorations(false)
            .visible(false)
            .build()
        {
            Ok(window) => window,
            Err(_) => return false,
        },
        Err(_) => return false,
    };

    #[cfg(target_os = "windows")]
    {
        let _ = window.set_decorations(false);
        let _ = window.set_shadow(false);
        apply_rounded_corners(&window);
    }

    let _ = window.set_skip_taskbar(true);
    true
}

fn show_main_window(app: &AppHandle) {
    let app_handle = app.clone();
    tauri::async_runtime::spawn(async move {
        if let Some(window) = app_handle.get_webview_window("main") {
            if let Some(state) = app_handle.try_state::<SharedState>() {
                if state.pending_show_main_window.load(Ordering::Relaxed) {
                    return;
                }
            }
            let _ = window.set_skip_taskbar(false);
            let _ = window.show();
            let _ = window.unminimize();
            let _ = window.set_focus();
            return;
        }

        let _ = create_main_window(&app_handle);
    });
}

#[tauri::command]
fn main_window_ready(app: AppHandle, state: State<'_, SharedState>) -> bool {
    if !state.pending_show_main_window.swap(false, Ordering::Relaxed) {
        return false;
    }

    if let Some(window) = app.get_webview_window("main") {
        let _ = window.set_skip_taskbar(false);
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
        return true;
    }
    false
}

fn request_app_exit(app: &AppHandle) {
    if let Some(state) = app.try_state::<SharedState>() {
        state.allow_process_exit.store(true, Ordering::Relaxed);
    }
    app.exit(0);
}

#[tauri::command]
fn cancel_shutdown(app: AppHandle, state: State<'_, SharedState>) -> bool {
    cancel_scheduled_shutdown(&state, &app, true)
}

#[tauri::command]
fn trigger_shutdown(app: AppHandle, state: State<'_, SharedState>, minutes: u64) -> bool {
    if lock(&state.settings).monitor_only_mode {
        return false;
    }

    schedule_shutdown_after_minutes(&state, &app, minutes, "manual-trigger")
}

#[tauri::command]
fn simulate_shutdown_flow(
    app: AppHandle,
    minutes: Option<u64>,
    auto_cancel_ms: Option<u64>,
    state: State<'_, SharedState>,
) -> Result<ShutdownSimulationResult, String> {
    if lock(&state.settings).monitor_only_mode {
        return Err("Modo solo monitor activo".to_string());
    }

    let safe_minutes = minutes.unwrap_or(5).max(1);
    let safe_cancel_ms = auto_cancel_ms.unwrap_or(1200).max(100);
    let shutdown_time = (Utc::now() + ChronoDuration::minutes(safe_minutes as i64)).to_rfc3339();

    emit_if_possible(
        &app,
        "shutdown-scheduled",
        ShutdownScheduledPayload {
            minutes: safe_minutes,
            shutdown_time: shutdown_time.clone(),
        },
    );

    thread::sleep(Duration::from_millis(safe_cancel_ms));
    emit_if_possible(&app, "shutdown-cancelled", ());

    Ok(ShutdownSimulationResult {
        scheduled: true,
        cancelled: true,
        minutes: safe_minutes,
        shutdown_time,
    })
}

#[tauri::command]
fn get_battery_time(state: State<'_, SharedState>) -> Option<u64> {
    let start_ms = *lock(&state.battery_start_ms);
    start_ms.map(|started_at| now_millis().saturating_sub(started_at) / 1000)
}

#[tauri::command]
fn get_events(state: State<'_, SharedState>, filter: Option<HistoryFilter>) -> Vec<HistoryEvent> {
    let mut events = lock(&state.events).clone();

    if let Some(filter) = filter {
        if let Some(classification) = filter.classification {
            if classification != "All Events" {
                events = events
                    .into_iter()
                    .filter(|item| item.classification == classification)
                    .collect();
            }
        }

        if let Some(date_from) = filter.date_from {
            if let Some(from_dt) = parse_date_bound(&date_from, false) {
                events = events
                    .into_iter()
                    .filter(|item| {
                        parse_rfc3339_utc(&item.time)
                            .map(|item_dt| item_dt >= from_dt)
                            .unwrap_or(true)
                    })
                    .collect();
            }
        }

        if let Some(date_to) = filter.date_to {
            if let Some(to_dt) = parse_date_bound(&date_to, true) {
                events = events
                    .into_iter()
                    .filter(|item| {
                        parse_rfc3339_utc(&item.time)
                            .map(|item_dt| item_dt <= to_dt)
                            .unwrap_or(true)
                    })
                    .collect();
            }
        }
    }

    events
}

#[tauri::command]
fn delete_events(state: State<'_, SharedState>, ids: Vec<u64>) -> Vec<HistoryEvent> {
    let mut events = lock(&state.events);
    if ids.is_empty() {
        events.clear();
    } else {
        events.retain(|item| !ids.contains(&item.id));
    }

    let result = events.clone();
    drop(events);
    state.save_events();
    result
}

#[tauri::command]
fn get_data_history(
    state: State<'_, SharedState>,
    filter: Option<HistoryFilter>,
) -> Vec<DataHistoryEntry> {
    let mut data = lock(&state.data_history).clone();

    if let Some(filter) = filter {
        if let Some(date_from) = filter.date_from {
            if let Some(from_dt) = parse_date_bound(&date_from, false) {
                data = data
                    .into_iter()
                    .filter(|item| {
                        parse_rfc3339_utc(&item.time)
                            .map(|item_dt| item_dt >= from_dt)
                            .unwrap_or(true)
                    })
                    .collect();
            }
        }

        if let Some(date_to) = filter.date_to {
            if let Some(to_dt) = parse_date_bound(&date_to, true) {
                data = data
                    .into_iter()
                    .filter(|item| {
                        parse_rfc3339_utc(&item.time)
                            .map(|item_dt| item_dt <= to_dt)
                            .unwrap_or(true)
                    })
                    .collect();
            }
        }
    }

    data
}

#[tauri::command]
fn delete_data_history(state: State<'_, SharedState>, ids: Vec<u64>) -> Vec<DataHistoryEntry> {
    let mut data = lock(&state.data_history);
    if ids.is_empty() {
        data.clear();
    } else {
        data.retain(|item| !ids.contains(&item.id));
    }

    let result = data.clone();
    drop(data);
    state.save_data_history();
    result
}

#[tauri::command]
fn update_history_interval(state: State<'_, SharedState>, seconds: u64) -> bool {
    let mut settings = lock(&state.settings);
    settings.history_interval = clamp_u64(seconds, 60, 3600, settings.history_interval);
    drop(settings);
    state.save_settings();
    true
}

#[tauri::command]
fn play_sound(state: State<'_, SharedState>, sound_type: String, repeats: Option<u64>) -> bool {
    let settings = lock(&state.settings).clone();
    let kind = AlertKind::from_str(sound_type.as_str()).unwrap_or(AlertKind::BatteryCritical);
    let sound_path = resolve_sound_path(&state, &settings, kind);
    play_sound_with_generation(state.inner().clone(), sound_path, repeats.unwrap_or(1))
}

#[tauri::command]
fn stop_sound(state: State<'_, SharedState>) -> bool {
    state.sound_generation.fetch_add(1, Ordering::Relaxed);
    true
}

#[tauri::command]
fn test_urgent_alert(
    app: AppHandle,
    state: State<'_, SharedState>,
    title: String,
    message: String,
    alert_type: String,
) -> bool {
    let _ = notify_windows(&app, &title, &message);
    if should_force_popup(&app, &state) {
        force_windows_popup(&title, &message, &alert_type);
    }
    emit_urgent_alert(&app, &title, &message, &alert_type);
    emit_if_possible(&app, "show-status", ());
    true
}

#[tauri::command]
fn get_available_sounds(state: State<'_, SharedState>) -> Vec<SoundInfo> {
    let settings = lock(&state.settings).clone();
    let mut sounds = Vec::new();

    if let Ok(entries) = fs::read_dir(&state.sounds_path) {
        for entry in entries.flatten() {
            let path = entry.path();
            if !is_sound_file(&path) {
                continue;
            }
            sounds.push(SoundInfo {
                name: file_name_or_default(&path),
                path: path.to_string_lossy().to_string(),
                custom: false,
                location: Some("AppData".to_string()),
            });
        }
    }

    if let Some(custom_path) = settings.custom_sounds_path {
        let custom_dir = PathBuf::from(custom_path);
        if let Ok(entries) = fs::read_dir(custom_dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if !is_sound_file(&path) {
                    continue;
                }
                sounds.push(SoundInfo {
                    name: file_name_or_default(&path),
                    path: path.to_string_lossy().to_string(),
                    custom: true,
                    location: Some("Custom".to_string()),
                });
            }
        }
    }

    sounds
}

fn is_sound_file(path: &Path) -> bool {
    path.extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| {
            let ext = ext.to_ascii_lowercase();
            ext == "wav" || ext == "mp3"
        })
        .unwrap_or(false)
}

fn file_name_or_default(path: &Path) -> String {
    path.file_name()
        .and_then(|value| value.to_str())
        .map(|value| value.to_string())
        .unwrap_or_else(|| "unknown.wav".to_string())
}

#[tauri::command]
fn get_sound_config(state: State<'_, SharedState>) -> SoundConfig {
    let settings = lock(&state.settings).clone();
    SoundConfig {
        repeat_config: SoundRepeatConfig {
            ac_fault: settings.alerts.ac_fault.sound_repeats,
            battery_low: settings.alerts.battery_low.sound_repeats,
            critical: settings.alerts.battery_critical.sound_repeats,
            default: 3,
        },
        repeat_delay: 2500,
        custom_sounds_path: settings.custom_sounds_path,
        sounds: SoundFiles {
            ac_fault: "alert-ac-fault.wav".to_string(),
            battery_low: "alert-battery-low.wav".to_string(),
            critical: "alert-critical.wav".to_string(),
        },
    }
}

#[tauri::command]
fn set_sound_config(state: State<'_, SharedState>, config: SoundConfigPatch) -> bool {
    let mut settings = lock(&state.settings);

    if let Some(repeat_config) = config.repeat_config {
        if let Some(value) = repeat_config.default {
            let default_value = clamp_u64(value, 1, 30, settings.alerts.ac_fault.sound_repeats);
            settings.alerts.ac_fault.sound_repeats = default_value;
            settings.alerts.battery_low.sound_repeats = default_value;
            settings.alerts.battery_critical.sound_repeats = default_value;
        }

        if let Some(value) = repeat_config.ac_fault {
            settings.alerts.ac_fault.sound_repeats =
                clamp_u64(value, 1, 30, settings.alerts.ac_fault.sound_repeats);
        }
        if let Some(value) = repeat_config.battery_low {
            settings.alerts.battery_low.sound_repeats =
                clamp_u64(value, 1, 30, settings.alerts.battery_low.sound_repeats);
        }
        if let Some(value) = repeat_config.critical {
            settings.alerts.battery_critical.sound_repeats =
                clamp_u64(value, 1, 30, settings.alerts.battery_critical.sound_repeats);
        }
    }

    if let Some(custom_path) = config.custom_sounds_path {
        settings.custom_sounds_path = custom_path;
    }

    if let Some(delay_value) = config.repeat_delay {
        let _normalized_delay_ms = clamp_u64(delay_value, 250, 10_000, 2_500);
    }

    drop(settings);
    state.save_settings();
    true
}

#[tauri::command]
fn set_custom_sounds_path(state: State<'_, SharedState>, sound_path: Option<String>) -> bool {
    lock(&state.settings).custom_sounds_path = sound_path;
    state.save_settings();
    true
}

#[cfg(target_os = "windows")]
fn apply_rounded_corners(window: &tauri::WebviewWindow) {
    use windows::Win32::Foundation::HWND;
    // Tauri v2 exposes hwnd() directly on Windows
    if let Ok(hwnd_raw) = window.hwnd() {
        let hwnd = HWND(hwnd_raw.0 as *mut _);
        let preference = DWM_WINDOW_CORNER_PREFERENCE(2); // DWMWCP_ROUND
        unsafe {
            let _ = DwmSetWindowAttribute(
                hwnd,
                DWMWA_WINDOW_CORNER_PREFERENCE,
                &preference as *const _ as *const _,
                std::mem::size_of::<DWM_WINDOW_CORNER_PREFERENCE>() as u32,
            );
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .setup(|app| {
            let state = Arc::new(AppState::new(&app.handle().clone()));
            let start_minimized = lock(&state.settings).start_minimized;
            start_ups_monitor(app.handle().clone(), state.clone());
            app.manage(state);

            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            #[cfg(target_os = "windows")]
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_decorations(false);
                let _ = window.set_shadow(false);
                apply_rounded_corners(&window);
            }

            if start_minimized {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.set_skip_taskbar(true);
                    let _ = window.hide();
                }
            } else {
                // Window starts hidden (visible=false in config).
                // Set flag so main_window_ready (called from JS) will show it
                // once the frontend has fully rendered, avoiding white flash.
                if let Some(st) = app.try_state::<SharedState>() {
                    st.pending_show_main_window.store(true, Ordering::Relaxed);
                }
            }

            #[cfg(target_os = "windows")]
            {
                let tray_show = MenuItemBuilder::with_id("tray_show", "Mostrar UPS Monitor")
                    .build(app)?;
                let tray_quit = MenuItemBuilder::with_id("tray_quit", "Salir").build(app)?;
                let tray_menu = MenuBuilder::new(app)
                    .items(&[&tray_show, &tray_quit])
                    .build()?;

                let mut tray_builder = TrayIconBuilder::with_id("main-tray")
                    .menu(&tray_menu)
                    .tooltip("UPS Monitor")
                    .show_menu_on_left_click(false)
                    .on_menu_event(|app, event| match event.id().as_ref() {
                        "tray_show" => show_main_window(app),
                        "tray_quit" => request_app_exit(app),
                        _ => {}
                    })
                    .on_tray_icon_event(|tray, event| {
                        if let TrayIconEvent::Click {
                            button: MouseButton::Left,
                            button_state: MouseButtonState::Up,
                            ..
                        } = event
                        {
                            show_main_window(&tray.app_handle());
                        }
                    });

                if let Some(default_icon) = app.default_window_icon() {
                    tray_builder = tray_builder.icon(default_icon.clone());
                }

                let _ = tray_builder.build(app)?;
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_settings,
            save_settings,
            get_ups_status,
            get_ups_info,
            test_notification,
            minimize_main_window,
            toggle_maximize_main_window,
            close_main_window,
            main_window_ready,
            cancel_shutdown,
            trigger_shutdown,
            simulate_shutdown_flow,
            get_battery_time,
            get_events,
            delete_events,
            get_data_history,
            delete_data_history,
            update_history_interval,
            play_sound,
            stop_sound,
            test_urgent_alert,
            get_available_sounds,
            get_sound_config,
            set_sound_config,
            set_custom_sounds_path
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app, event| {
            if let tauri::RunEvent::ExitRequested { api, .. } = event {
                if let Some(state) = app.try_state::<SharedState>() {
                    if !state.allow_process_exit.load(Ordering::Relaxed) {
                        api.prevent_exit();
                    }
                }
            }
        });
}
