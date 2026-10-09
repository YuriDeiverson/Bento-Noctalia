use std::collections::HashMap;
use std::process::{Child, Command};
use std::sync::atomic::{AtomicBool, AtomicIsize, Ordering};
use std::sync::Mutex;
use std::time::Duration;

use serde::Deserialize;
use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Emitter, Manager, PhysicalPosition, PhysicalSize, RunEvent, WebviewUrl, WebviewWindow, WebviewWindowBuilder, WindowEvent};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState};

mod barra_windows;
mod janela_frente;
mod miniaturas;

const PORTA: u16 = 47831;
const ALTURA_ILHA: f64 = 720.0;
const ALTURA_DOCK: f64 = 250.0;

#[derive(Clone, PartialEq, Eq)]
struct GeometriaMonitor {
    nome: Option<String>,
    x: i32,
    y: i32,
    largura: u32,
    altura: u32,
    escala: u64,
}

#[derive(Deserialize, Clone, Copy)]
struct Retangulo {
    x: f64,
    y: f64,
    w: f64,
    h: f64,
}

struct Estado {
    areas: Mutex<HashMap<String, Vec<Retangulo>>>,
    token: String,
    ponte: Mutex<Option<Child>>,
}

fn gerar_token() -> String {
    use windows::Win32::Security::Cryptography::{BCryptGenRandom, BCRYPT_USE_SYSTEM_PREFERRED_RNG};
    let mut bytes = [0u8; 32];
    let status = unsafe { BCryptGenRandom(None, &mut bytes, BCRYPT_USE_SYSTEM_PREFERRED_RNG) };
    assert!(status.is_ok(), "falha ao gerar o token da ponte");
    bytes.iter().map(|b| format!("{:02x}", b)).collect()
}

#[tauri::command]
fn area_interativa(janela: String, retangulos: Vec<Retangulo>, estado: tauri::State<Estado>) {
    if let Ok(mut areas) = estado.areas.lock() {
        areas.insert(janela, retangulos);
    }
}

#[tauri::command]
fn token_ponte(estado: tauri::State<Estado>) -> String {
    estado.token.clone()
}

#[tauri::command]
fn porta_ponte() -> u16 {
    PORTA
}

#[tauri::command]
fn mostrar_sistema(app: AppHandle) {
    mostrar(&app);
}

static ULTIMA_FRENTE: AtomicIsize = AtomicIsize::new(0);

fn registrar_frente(app: &AppHandle) {
    let frente = unsafe { windows::Win32::UI::WindowsAndMessaging::GetForegroundWindow() }.0 as isize;
    if frente == 0 {
        return;
    }
    let sobreposta = ["ilha", "dock"].iter().any(|r| app.get_webview_window(r).and_then(|j| j.hwnd().ok()).map(|h| h.0 as isize == frente).unwrap_or(false));
    if !sobreposta {
        ULTIMA_FRENTE.store(frente, Ordering::Relaxed);
    }
}

#[tauri::command]
fn alternar_sistema(app: AppHandle) {
    if let Some(janela) = app.get_webview_window("sistema") {
        let visivel = janela.is_visible().unwrap_or(false) && !janela.is_minimized().unwrap_or(false);
        let focada = janela.hwnd().map(|h| h.0 as isize == ULTIMA_FRENTE.load(Ordering::Relaxed)).unwrap_or(false);
        if visivel && focada {
            let _ = janela.minimize();
        } else {
            mostrar(&app);
        }
    }
}

#[tauri::command]
fn abrir_link(url: String) -> Result<(), String> {
    let endereco = url.trim();
    if !(endereco.starts_with("https://") || endereco.starts_with("http://")) || endereco.chars().any(|c| c.is_whitespace() || c.is_control()) {
        return Err("link_invalido".into());
    }
    let largo: Vec<u16> = endereco.encode_utf16().chain(std::iter::once(0)).collect();
    let resultado = unsafe {
        windows::Win32::UI::Shell::ShellExecuteW(
            None,
            windows::core::w!("open"),
            windows::core::PCWSTR(largo.as_ptr()),
            None,
            None,
            windows::Win32::UI::WindowsAndMessaging::SW_SHOWNORMAL,
        )
    };
    if resultado.0 as isize > 32 {
        Ok(())
    } else {
        Err("falha_ao_abrir".into())
    }
}

#[tauri::command]
fn sair(app: AppHandle) {
    sair_salvando(&app);
}

const ESPERA_PARA_SALVAR: Duration = Duration::from_millis(700);

fn sair_salvando(app: &AppHandle) {
    if ENCERRANDO.swap(true, Ordering::Relaxed) {
        return;
    }
    let _ = app.emit("bento://saindo", ());
    let app = app.clone();
    std::thread::spawn(move || {
        std::thread::sleep(ESPERA_PARA_SALVAR);
        app.exit(0);
    });
}

fn mostrar(app: &AppHandle) {
    if let Some(janela) = app.get_webview_window("sistema") {
        let _ = janela.unminimize();
        let _ = janela.show();
        let _ = janela.set_focus();
    }
}

fn criar_sobreposta(app: &AppHandle, rotulo: &str, y: f64, x: f64, largura: f64, altura: f64) -> tauri::Result<WebviewWindow> {
    WebviewWindowBuilder::new(app, rotulo, WebviewUrl::App("index.html".into()))
        .title("Bento")
        .transparent(true)
        .decorations(false)
        .shadow(false)
        .always_on_top(true)
        .skip_taskbar(true)
        .resizable(false)
        .focused(false)
        .visible(false)
        .position(x, y)
        .inner_size(largura, altura)
        .build()
}

fn geometria_monitor_principal(app: &AppHandle) -> Option<GeometriaMonitor> {
    let monitor = app.primary_monitor().ok().flatten().or_else(|| app.available_monitors().ok()?.into_iter().next())?;
    let posicao = monitor.position();
    let tamanho = monitor.size();
    Some(GeometriaMonitor {
        nome: monitor.name().cloned(),
        x: posicao.x,
        y: posicao.y,
        largura: tamanho.width,
        altura: tamanho.height,
        escala: monitor.scale_factor().to_bits(),
    })
}

fn realinhar_sobrepostas(app: &AppHandle, monitor: &GeometriaMonitor) {
    let escala = f64::from_bits(monitor.escala);
    let altura_ilha = (ALTURA_ILHA * escala).round() as u32;
    let altura_dock = (ALTURA_DOCK * escala).round() as u32;
    for (rotulo, y, altura) in [
        ("ilha", monitor.y, altura_ilha),
        ("dock", monitor.y + monitor.altura as i32 - altura_dock as i32, altura_dock),
    ] {
        if let Some(janela) = app.get_webview_window(rotulo) {
            if let Err(erro) = janela.set_size(PhysicalSize::new(monitor.largura, altura)) {
                eprintln!("Falha ao ajustar o tamanho da janela {rotulo}: {erro}");
            }
            if let Err(erro) = janela.set_position(PhysicalPosition::new(monitor.x, y)) {
                eprintln!("Falha ao realinhar a janela {rotulo}: {erro}");
            }
        }
    }
}

fn vigiar_monitores(app: AppHandle) {
    std::thread::spawn(move || {
        let mut anterior = None;
        loop {
            if let Some(monitor) = geometria_monitor_principal(&app) {
                if anterior.as_ref() != Some(&monitor) {
                    realinhar_sobrepostas(&app, &monitor);
                    anterior = Some(monitor);
                }
            }
            std::thread::sleep(Duration::from_millis(750));
        }
    });
}

fn vigiar_cursor(app: AppHandle) {
    std::thread::spawn(move || {
        let mut fora: HashMap<String, bool> = HashMap::new();
        loop {
            std::thread::sleep(Duration::from_millis(45));
            registrar_frente(&app);
            let areas = match app.state::<Estado>().areas.lock() {
                Ok(a) => a.clone(),
                Err(_) => continue,
            };
            for rotulo in ["ilha", "dock"] {
                let Some(janela) = app.get_webview_window(rotulo) else { continue };
                let (Ok(cursor), Ok(origem), Ok(escala)) = (janela.cursor_position(), janela.outer_position(), janela.scale_factor()) else { continue };
                let x = (cursor.x - origem.x as f64) / escala;
                let y = (cursor.y - origem.y as f64) / escala;
                let dentro = areas.get(rotulo).map(|lista| lista.iter().any(|r| x >= r.x - 4.0 && x <= r.x + r.w + 4.0 && y >= r.y - 4.0 && y <= r.y + r.h + 4.0)).unwrap_or(false);
                let estava_fora = *fora.get(rotulo).unwrap_or(&false);
                let agora_fora = !dentro;
                if !fora.contains_key(rotulo) || estava_fora != agora_fora {
                    let _ = janela.set_ignore_cursor_events(agora_fora);
                    if agora_fora {
                        let _ = janela.emit_to(rotulo, "bento://cursor-fora", ());
                    }
                    fora.insert(rotulo.to_string(), agora_fora);
                }
            }
        }
    });
}

fn sem_prefixo(caminho: std::path::PathBuf) -> std::path::PathBuf {
    let texto = caminho.to_string_lossy().to_string();
    match texto.strip_prefix(r"\\?\UNC\") {
        Some(resto) => std::path::PathBuf::from(format!(r"\\{}", resto)),
        None => match texto.strip_prefix(r"\\?\") {
            Some(resto) => std::path::PathBuf::from(resto),
            None => caminho,
        },
    }
}

fn iniciar_ponte(app: &AppHandle, token: &str, reinicio: bool) {
    if cfg!(debug_assertions) {
        return;
    }
    let dados = app.path().app_data_dir().ok();
    let registrar = |texto: String| {
        if let Some(pasta) = &dados {
            let _ = std::fs::create_dir_all(pasta);
            let _ = std::fs::write(pasta.join("bento.log"), texto);
        }
    };
    let Ok(pasta) = app.path().resource_dir() else {
        registrar("sem pasta de recursos".into());
        return;
    };
    let recursos = sem_prefixo(pasta.join("recursos"));
    let node = recursos.join("node.exe");
    let script = recursos.join("ponte.mjs");
    let saida_erro = dados.as_ref().and_then(|p| {
        let caminho = sem_prefixo(p.join("ponte.log"));
        if reinicio {
            std::fs::OpenOptions::new().create(true).append(true).open(caminho).ok()
        } else {
            std::fs::File::create(caminho).ok()
        }
    });
    let mut comando = Command::new(&node);
    comando.current_dir(&recursos).stdin(std::process::Stdio::null()).stdout(std::process::Stdio::null());
    match saida_erro {
        Some(arquivo) => {
            comando.stderr(arquivo);
        }
        None => {
            comando.stderr(std::process::Stdio::null());
        }
    }
    comando.arg("ponte.mjs").env("BENTO_PORTA", PORTA.to_string()).env("BENTO_TOKEN", token).env("BENTO_PAI", std::process::id().to_string());
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        comando.creation_flags(0x0800_0000);
    }
    match comando.spawn() {
        Ok(filho) => {
            registrar(format!("ponte iniciada: {} {} (pid {})", node.display(), script.display(), filho.id()));
            if let Ok(mut ponte) = app.state::<Estado>().ponte.lock() {
                *ponte = Some(filho);
            }
        }
        Err(erro) => registrar(format!("falha ao iniciar a ponte: {} {} {}", node.display(), script.display(), erro)),
    }
}

fn parar_ponte(app: &AppHandle) {
    ENCERRANDO.store(true, Ordering::Relaxed);
    if let Ok(mut ponte) = app.state::<Estado>().ponte.lock() {
        if let Some(mut filho) = ponte.take() {
            let _ = filho.kill();
        }
    }
}

static ENCERRANDO: AtomicBool = AtomicBool::new(false);
const MAXIMO_REINICIOS_DA_PONTE: u32 = 5;

fn vigiar_ponte(app: AppHandle, token: String) {
    if cfg!(debug_assertions) {
        return;
    }
    std::thread::spawn(move || {
        let mut reinicios = 0u32;
        let mut estavel_desde = std::time::Instant::now();
        loop {
            std::thread::sleep(Duration::from_secs(3));
            if ENCERRANDO.load(Ordering::Relaxed) {
                return;
            }
            let caiu = match app.state::<Estado>().ponte.lock() {
                Ok(mut ponte) => match ponte.as_mut() {
                    Some(filho) => matches!(filho.try_wait(), Ok(Some(_))),
                    None => false,
                },
                Err(_) => false,
            };
            if !caiu {
                if estavel_desde.elapsed() > Duration::from_secs(120) {
                    reinicios = 0;
                }
                continue;
            }
            if reinicios >= MAXIMO_REINICIOS_DA_PONTE {
                return;
            }
            reinicios += 1;
            std::thread::sleep(Duration::from_secs(u64::from(reinicios) * 2));
            if ENCERRANDO.load(Ordering::Relaxed) {
                return;
            }
            iniciar_ponte(&app, &token, true);
            estavel_desde = std::time::Instant::now();
        }
    });
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let token = gerar_token();
    let escondido = std::env::args().any(|a| a == "--escondido");

    let app = tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| mostrar(app)))
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_autostart::init(tauri_plugin_autostart::MacosLauncher::LaunchAgent, Some(vec!["--escondido"])))
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, _atalho, evento| {
                    if evento.state() == ShortcutState::Pressed {
                        mostrar(app);
                        let _ = app.emit_to("sistema", "bento://captura", ());
                    }
                })
                .build(),
        )
        .manage(Estado { areas: Mutex::new(HashMap::new()), token: token.clone(), ponte: Mutex::new(None) })
        .manage(miniaturas::Miniaturas::default())
        .invoke_handler(tauri::generate_handler![
            area_interativa,
            token_ponte,
            porta_ponte,
            mostrar_sistema,
            alternar_sistema,
            abrir_link,
            sair,
            barra_windows::barra_windows,
            barra_windows::reservar_dock,
            janela_frente::frente_cobre_tela,
            miniaturas::miniaturas_janelas
        ])
        .setup(move |app| {
            let handle = app.handle().clone();
            barra_windows::restaurar(&handle);
            iniciar_ponte(&handle, &token, false);
            vigiar_ponte(handle.clone(), token.clone());

            let monitor = app.primary_monitor()?.or(app.available_monitors()?.into_iter().next());
            let (mx, my, mw, mh) = match &monitor {
                Some(m) => {
                    let escala = m.scale_factor();
                    let area = m.work_area();
                    (area.position.x as f64 / escala, area.position.y as f64 / escala, area.size.width as f64 / escala, area.size.height as f64 / escala)
                }
                None => (0.0, 0.0, 1920.0, 1040.0),
            };
            let (tela_x, tela_y, tela_largura) = match &monitor {
                Some(m) => {
                    let escala = m.scale_factor();
                    (m.position().x as f64 / escala, m.position().y as f64 / escala, m.size().width as f64 / escala)
                }
                None => (mx, my, mw),
            };

            let sistema = WebviewWindowBuilder::new(app, "sistema", WebviewUrl::App("index.html".into()))
                .title("Bento")
                .decorations(false)
                .inner_size(1320.0_f64.min(mw - 40.0), 860.0_f64.min(mh - 40.0))
                .min_inner_size(960.0, 600.0)
                .background_color(tauri::window::Color(14, 14, 16, 255))
                .disable_drag_drop_handler()
                .center()
                .visible(!escondido)
                .build()?;
            let sistema_ref = sistema.clone();
            sistema.on_window_event(move |evento| {
                if let WindowEvent::CloseRequested { api, .. } = evento {
                    api.prevent_close();
                    let _ = sistema_ref.hide();
                }
            });

            criar_sobreposta(&handle, "ilha", tela_y, tela_x, tela_largura, ALTURA_ILHA)?;
            criar_sobreposta(&handle, "dock", my + mh - ALTURA_DOCK, mx, mw, ALTURA_DOCK)?;
            for rotulo in ["ilha", "dock"] {
                if let Some(j) = handle.get_webview_window(rotulo) {
                    let _ = j.set_ignore_cursor_events(true);
                }
            }
            vigiar_monitores(handle.clone());
            vigiar_cursor(handle.clone());

            let abrir = MenuItem::with_id(app, "abrir", "Abrir o Bento", true, None::<&str>)?;
            let sair_item = MenuItem::with_id(app, "sair", "Sair", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&abrir, &sair_item])?;
            let mut bandeja = TrayIconBuilder::with_id("bento").menu(&menu).show_menu_on_left_click(false).tooltip("Bento");
            if let Some(icone) = app.default_window_icon() {
                bandeja = bandeja.icon(icone.clone());
            }
            bandeja
                .on_menu_event(|app, evento| match evento.id.as_ref() {
                    "abrir" => mostrar(app),
                    "sair" => sair_salvando(app),
                    _ => {}
                })
                .on_tray_icon_event(|bandeja, evento| {
                    if let TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. } = evento {
                        mostrar(bandeja.app_handle());
                    }
                })
                .build(app)?;

            let _ = app.global_shortcut().register("ctrl+alt+space");
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("falha ao iniciar o Bento");

    app.run(|handle, evento| {
        if let RunEvent::Exit = evento {
            barra_windows::reservar_espaco_do_dock(handle, false);
            barra_windows::restaurar(handle);
            parar_ponte(handle);
        }
    });
}
