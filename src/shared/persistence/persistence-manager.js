const fs = require('fs').promises;
const path = require('path');
const os = require('os');

/**
 * PersistenceManager - Cross-platform atomic file persistence manager.
 * Supports persistent disks on Render.com (/data) as well as desktop OS Application Data folders.
 */
class PersistenceManager {
  constructor() {
    this.isRender = process.env.RENDER === 'true';
    this.dataDir = this.getDataDirectory();
  }

  /**
   * Resolves the canonical data storage directory for the target platform.
   * @returns {string} Absolute path to storage directory
   */
  getDataDirectory() {
    // Render.com: persistent disk mount path
    if (this.isRender) {
      return '/data';
    }

    const platform = os.platform();
    if (platform === 'win32') {
      const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
      return path.join(appData, 'argus-bot');
    }
    if (platform === 'darwin') {
      return path.join(os.homedir(), 'Library', 'Application Support', 'argus-bot');
    }
    // Linux and other POSIX
    return path.join(os.homedir(), '.argus-bot');
  }

  /**
   * Ensures the data directory exists on disk.
   */
  async ensureDataDir() {
    try {
      await fs.mkdir(this.dataDir, { recursive: true });
    } catch (err) {
      console.warn(`[PersistenceManager] Could not create dataDir at ${this.dataDir}, falling back to local ./data:`, err.message);
      this.dataDir = path.join(process.cwd(), 'data');
      await fs.mkdir(this.dataDir, { recursive: true });
    }
  }

  /**
   * Atomically writes data to a JSON file with checksum and backup.
   * @param {string} filename - Target file name
   * @param {Object} data - JavaScript object to serialize
   */
  async saveData(filename, data) {
    await this.ensureDataDir();
    const filePath = path.join(this.dataDir, filename);
    const tempPath = `${filePath}.${Date.now()}.tmp`;
    const backupPath = `${filePath}.bak`;
    
    const payload = JSON.stringify(data, null, 2);
    const checksum = require('crypto').createHash('sha256').update(payload).digest('hex');
    const finalData = JSON.stringify({ checksum, data }, null, 2);

    await fs.writeFile(tempPath, finalData, 'utf-8');
    
    // Create backup of previous known good state
    try { await fs.copyFile(filePath, backupPath); } catch (e) {}
    
    await fs.rename(tempPath, filePath);
    try { await fs.copyFile(filePath, backupPath); } catch (e) {}
  }

  /**
   * Loads and parses a JSON file with checksum validation and corrupted-state fallback.
   * @param {string} filename - Target file name
   * @param {Object} [defaultData={}] - Default data to populate and return if missing
   * @returns {Promise<Object>} Parsed JSON content
   */
  async loadData(filename, defaultData = {}) {
    await this.ensureDataDir();
    const filePath = path.join(this.dataDir, filename);
    const backupPath = `${filePath}.bak`;
    
    const tryLoad = async (p) => {
      try {
        const content = await fs.readFile(p, 'utf-8');
        const parsed = JSON.parse(content);
        if (parsed.checksum && parsed.data) {
           const verify = require('crypto').createHash('sha256').update(JSON.stringify(parsed.data, null, 2)).digest('hex');
           if (verify === parsed.checksum) return parsed.data;
           console.warn(`[PersistenceManager] Checksum mismatch for ${p}`);
           return null;
        }
        return parsed; // Legacy format
      } catch (e) {
        return null;
      }
    };

    let data = await tryLoad(filePath);
    if (!data && (await tryLoad(backupPath))) {
        console.warn(`[PersistenceManager] Recovered ${filename} from last-known-good backup.`);
        data = await tryLoad(backupPath);
        // Restore backup as main file
        try { await fs.copyFile(backupPath, filePath); } catch(e){}
    }

    if (!data) {
      if (require('fs').existsSync(filePath)) {
          console.warn(`[PersistenceManager] ${filename} corrupted or missing, resetting to default.`);
      }
      await this.saveData(filename, defaultData);
      return defaultData;
    }
    return data;
  }

  /**
   * Saves unified state snapshot to state_snapshot.json.
   * @param {Object} state - State payload
   */
  async saveState(state) {
    return this.saveData('state_snapshot.json', state);
  }

  /**
   * Loads unified state snapshot.
   * @returns {Promise<Object>}
   */
  async loadState() {
    return this.loadData('state_snapshot.json', {
      locations: { bases: [], farms: [], mines: [], waypoints: [] },
      chests: [],
      permissions: [],
      config: {}
    });
  }

  /**
   * Appends a log entry to persistent bot.log.
   * @param {Object|string} logEntry - Log entry to record
   */
  async saveLog(logEntry) {
    try {
      await this.ensureDataDir();
      const logFile = path.join(this.dataDir, 'bot.log');
      const entryStr = typeof logEntry === 'string' ? logEntry : JSON.stringify(logEntry);
      const line = `${new Date().toISOString()} - ${entryStr}\n`;
      await fs.appendFile(logFile, line, 'utf-8');
    } catch (err) {
      // Non-fatal if log write fails
    }
  }

  /**
   * Returns host platform metrics and storage configuration for diagnostics and dashboard.
   * @returns {{ platform: string, isRender: boolean, dataDir: string }}
   */
  getPlatformInfo() {
    let platformName = os.platform();
    if (this.isRender) platformName = 'Render.com Cloud';
    else if (platformName === 'darwin') platformName = 'macOS';
    else if (platformName === 'win32') platformName = 'Windows';
    else if (platformName === 'linux') platformName = 'Linux';

    return {
      platform: platformName,
      isRender: this.isRender,
      dataDir: this.dataDir
    };
  }
}

module.exports = new PersistenceManager();
