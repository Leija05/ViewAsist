const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('electronInfo', {
  platform: process.platform,
  versions: process.versions,
});
