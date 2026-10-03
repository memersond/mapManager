const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('platform', {
  name: process.platform,
});
