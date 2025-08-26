const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  configureAWS: (config) => ipcRenderer.invoke('configure-aws', config),
  getSavedSettings: () => ipcRenderer.invoke('get-saved-settings'),
  listInstances: () => ipcRenderer.invoke('list-instances'),
  getInstanceStatus: (instanceId) => ipcRenderer.invoke('get-instance-status', instanceId),
  startInstance: (instanceId, autoStopMinutes, idleStopEnabled) => ipcRenderer.invoke('start-instance', instanceId, autoStopMinutes, idleStopEnabled),
  stopInstance: (instanceId) => ipcRenderer.invoke('stop-instance', instanceId),
  terminateInstance: (instanceId) => ipcRenderer.invoke('terminate-instance', instanceId)
});
