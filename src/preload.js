const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  configureAWS: (config) => ipcRenderer.invoke('configure-aws', config),
  getSavedSettings: () => ipcRenderer.invoke('get-saved-settings'),
  listInstances: () => ipcRenderer.invoke('list-instances'),
  getInstanceStatus: (instanceId) => ipcRenderer.invoke('get-instance-status', instanceId),
  startInstance: (instanceId, autoStopMinutes) => ipcRenderer.invoke('start-instance', instanceId, autoStopMinutes),
  stopInstance: (instanceId) => ipcRenderer.invoke('stop-instance', instanceId),
  terminateInstance: (instanceId) => ipcRenderer.invoke('terminate-instance', instanceId),
  
  // Secure credential storage
  storeCredentialsSecure: (accessKeyId, secretAccessKey, region) => 
    ipcRenderer.invoke('store-credentials-secure', accessKeyId, secretAccessKey, region),
  retrieveCredentialsSecure: () => ipcRenderer.invoke('retrieve-credentials-secure'),
  checkSecureCredentials: () => ipcRenderer.invoke('check-secure-credentials'),
  deleteCredentialsSecure: () => ipcRenderer.invoke('delete-credentials-secure')
});
