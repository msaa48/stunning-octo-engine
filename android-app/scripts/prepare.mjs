// بيجهّز www + capacitor.config.json قبل البناء.
// MASAR_MODE=bundled (الافتراضي): الموقع جوه التطبيق.  MASAR_MODE=live: التطبيق بيفتح نسخة الموقع الحالية (من غير ما نبني APK جديد مع كل تعديل).
import fs from 'node:fs';
import path from 'node:path';
const mode = (process.env.MASAR_MODE || 'bundled').toLowerCase();
const liveUrl = process.env.MASAR_LIVE_URL || 'https://msaa48.github.io/stunning-octo-engine/';
const appId = process.env.APP_ID || 'com.masar.centers';
fs.rmSync('www', { recursive: true, force: true });
fs.mkdirSync('www', { recursive: true });
fs.copyFileSync(path.join('..', 'index.html'), path.join('www', 'index.html'));
const cfg = {
  appId,
  appName: 'مسار',
  webDir: 'www',
  android: { allowMixedContent: false },
  plugins: { SystemBars: { insetsHandling: 'css' } }
};
if (mode === 'live') cfg.server = { url: liveUrl, cleartext: false };
fs.writeFileSync('capacitor.config.json', JSON.stringify(cfg, null, 2));
console.log(`prepared: mode=${mode} appId=${appId}${mode === 'live' ? ' url=' + liveUrl : ''}`);
