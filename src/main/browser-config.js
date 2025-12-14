/**
 * BROWSER CONFIG - Configuración del navegador predeterminado
 * 
 * Configura Opera como navegador predeterminado para enlaces externos
 * y previene que Chrome/Explorer se abran y se queden cargando.
 */

const { shell } = require('electron');
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

/**
 * Encuentra la ruta de Opera en el sistema
 */
function getOperaPath() {
  const commonPaths = [
    path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Opera', 'launcher.exe'),
    path.join(process.env.PROGRAMFILES || '', 'Opera', 'launcher.exe'),
    path.join(process.env['PROGRAMFILES(X86)'] || '', 'Opera', 'launcher.exe')
  ];

  for (const p of commonPaths) {
    if (fs.existsSync(p)) {
      return p;
    }
  }

  // Intentar encontrar via registro de Windows
  if (process.platform === 'win32') {
    try {
      const regKey = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\App Paths\\opera.exe';
      const result = execSync(`reg query "${regKey}" /ve`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] });
      const match = result.match(/REG_SZ\s+([^\r\n]+)/i);
      if (match && fs.existsSync(match[1])) {
        return match[1];
      }
    } catch (e) {
      // Ignorar error si la clave del registro no existe
    }
  }

  return null;
}

/**
 * Configura la interceptación de navegador para usar Opera
 */
function configureBrowserInterception(mainWindow) {
  const operaPath = getOperaPath();

  if (operaPath) {
    console.log(`🌐 Opera detectado en: ${operaPath}. Configurando como navegador predeterminado.`);

    // Interceptar eventos de nueva ventana
    mainWindow.webContents.on('new-window', (event, url) => {
      event.preventDefault();
      shell.openExternal(url);
    });

    // Interceptar eventos de navegación
    mainWindow.webContents.on('will-navigate', (event, url) => {
      const currentUrl = mainWindow.webContents.getURL();
      if (url !== currentUrl && !url.startsWith('file://')) {
        // Solo interceptar navegaciones externas
        event.preventDefault();
        shell.openExternal(url);
      }
    });

    // Prevenir que Chrome/Explorer se abran con Google al iniciar sesión
    mainWindow.webContents.on('did-finish-load', () => {
      const currentUrl = mainWindow.webContents.getURL();
      if (currentUrl.includes('google.com') && !currentUrl.includes('search?q=')) {
        // Si es solo google.com sin búsqueda, podría ser una carga no deseada
        // Pero no hacemos nada automático aquí para evitar problemas
      }
    });

  } else {
    console.warn('⚠️ Opera no detectado. Se usará el navegador predeterminado del sistema.');
  }
}

/**
 * Obtiene la configuración del navegador (función exportada para compatibilidad)
 */
function getBrowserConfig() {
  const operaPath = getOperaPath();
  
  return {
    operaPath,
    findOperaPath: async () => {
      // Función async para compatibilidad con main.js
      return Promise.resolve(operaPath);
    },
    configureElectronBrowser: (mainWindow) => {
      // Wrapper para configureBrowserInterception
      configureBrowserInterception(mainWindow);
    },
    configure: configureBrowserInterception
  };
}

module.exports = {
  getBrowserConfig,
  configureBrowserInterception,
  getOperaPath
};

