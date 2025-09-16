const { app, BrowserWindow, ipcMain } = require('electron');
const { EC2Client, DescribeInstancesCommand, StartInstancesCommand, StopInstancesCommand, TerminateInstancesCommand } = require('@aws-sdk/client-ec2');
const { CloudWatchClient, PutMetricAlarmCommand } = require('@aws-sdk/client-cloudwatch');
const path = require('path');
const fs = require('fs');
const os = require('os');
const keytar = require('keytar');
const { exec, spawn } = require('child_process');

let mainWindow;
let ec2Client;
let cloudWatchClient;
let awsRegion;

// Path for storing user preferences
const userDataPath = path.join(os.homedir(), '.aws-compute-manager');
const settingsFile = path.join(userDataPath, 'settings.json');

// Ensure settings directory exists
function ensureSettingsDir() {
  if (!fs.existsSync(userDataPath)) {
    fs.mkdirSync(userDataPath, { recursive: true });
  }
}

// Load saved settings
function loadSettings() {
  try {
    ensureSettingsDir();
    if (fs.existsSync(settingsFile)) {
      const data = fs.readFileSync(settingsFile, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error loading settings:', error);
  }
  return {};
}

// Save settings
function saveSettings(settings) {
  try {
    ensureSettingsDir();
    fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 2));
    return true;
  } catch (error) {
    console.error('Error saving settings:', error);
    return false;
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    titleBarStyle: 'default',
    resizable: true,
    minimizable: true,
    maximizable: true,
    title: 'AWS Compute Manager'
  });

  mainWindow.loadFile('src/index.html');

  // Open DevTools in development
  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }

  // Add keyboard shortcut to toggle DevTools (Cmd+Shift+I on Mac, Ctrl+Shift+I on Windows)
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if ((input.meta || input.control) && input.shift && input.key.toLowerCase() === 'i') {
      mainWindow.webContents.toggleDevTools();
    }
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Get saved settings
ipcMain.handle('get-saved-settings', async () => {
  try {
    const settings = loadSettings();
    return {
      success: true,
      settings: {
        region: settings.region || '',
        accessKeyId: settings.accessKeyId || ''
        // Note: We don't return the secret key for security
      }
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Configure AWS credentials
ipcMain.handle('configure-aws', async (event, { region, accessKeyId, secretAccessKey }) => {
  try {
    // Store the region globally
    awsRegion = region;
    
    const credentials = {
      accessKeyId: accessKeyId,
      secretAccessKey: secretAccessKey,
    };

    ec2Client = new EC2Client({
      region: region,
      credentials: credentials,
    });

    cloudWatchClient = new CloudWatchClient({
      region: region,
      credentials: credentials,
    });

    // Save settings (without secret key for security)
    const settingsToSave = {
      region: region,
      accessKeyId: accessKeyId,
      lastUpdated: new Date().toISOString()
    };
    
    const saved = saveSettings(settingsToSave);
    if (!saved) {
      console.warn('Failed to save settings, but AWS configuration successful');
    }

    return { success: true, settingsSaved: saved };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// List instances
ipcMain.handle('list-instances', async () => {
  try {
    if (!ec2Client) {
      throw new Error('AWS not configured');
    }

    const command = new DescribeInstancesCommand({});
    const response = await ec2Client.send(command);
    
    const instances = [];
    response.Reservations.forEach(reservation => {
      reservation.Instances.forEach(instance => {
        // Get the name tag
        const nameTag = instance.Tags?.find(tag => tag.Key === 'Name');
        
        instances.push({
          id: instance.InstanceId,
          name: nameTag ? nameTag.Value : instance.InstanceId,
          state: instance.State.Name,
          type: instance.InstanceType,
          publicIp: instance.PublicIpAddress,
          privateIp: instance.PrivateIpAddress,
          platform: instance.Platform || 'Linux/Unix'
        });
      });
    });

    return { success: true, instances };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Get instance status
ipcMain.handle('get-instance-status', async (event, instanceId) => {
  try {
    if (!ec2Client) {
      throw new Error('AWS not configured');
    }

    const command = new DescribeInstancesCommand({
      InstanceIds: [instanceId]
    });

    const response = await ec2Client.send(command);
    const instance = response.Reservations[0]?.Instances[0];
    
    if (!instance) {
      throw new Error('Instance not found');
    }

    return {
      success: true,
      state: instance.State.Name,
      instanceType: instance.InstanceType,
      publicIp: instance.PublicIpAddress,
      privateIp: instance.PrivateIpAddress,
      isSpotInstance: instance.SpotInstanceRequestId ? true : false
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Start instance with optional auto-stop using CloudWatch Alarm
ipcMain.handle('start-instance', async (event, instanceId, autoStopMinutes = null) => {
  try {
    if (!ec2Client) {
      throw new Error('AWS not configured');
    }

    const command = new StartInstancesCommand({
      InstanceIds: [instanceId]
    });

    await ec2Client.send(command);

    // Create alarms based on user preferences
    let scheduleErrors = [];
    
    // Time-based auto-stop alarm
    if (autoStopMinutes && autoStopMinutes > 0) {
      try {
        await createAutoStopAlarm(instanceId, autoStopMinutes);
      } catch (scheduleError) {
        scheduleErrors.push(`Time-based auto-stop: ${scheduleError.message}`);
      }
    }
    
    if (scheduleErrors.length > 0) {
      return { 
        success: true, 
        autoStop: false, 
        scheduleError: scheduleErrors.join('; ')
      };
    }
    
    if (autoStopMinutes > 0) {
      let features = [];
      if (autoStopMinutes > 0) features.push(`stops after ${autoStopMinutes} minutes`);
      
      return { 
        success: true, 
        autoStop: true,
        stopTime: autoStopMinutes > 0 ? new Date(Date.now() + autoStopMinutes * 60 * 1000).toLocaleTimeString() : null,
        method: 'cloudwatch',
        features: features.join(' and ')
      };
    }

    return { success: true, autoStop: false };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Create CloudWatch alarm to auto-stop instance
async function createAutoStopAlarm(instanceId, minutes) {
  if (!cloudWatchClient) {
    throw new Error('CloudWatch not configured');
  }

  if (!awsRegion) {
    throw new Error('AWS region not configured');
  }

  const alarmName = `AutoStop-${instanceId}-${Date.now()}`;
  const targetTime = new Date(Date.now() + minutes * 60 * 1000);
  
  // Use a metric that will reliably trigger after the specified time
  // We'll use CPUUtilization with a threshold that will always be met
  const alarmParams = {
    AlarmName: alarmName,
    AlarmDescription: `Auto-stop ${instanceId} after ${minutes} minutes (scheduled for ${targetTime.toISOString()})`,
    ActionsEnabled: true,
    AlarmActions: [
      `arn:aws:automate:${awsRegion}:ec2:stop`
    ],
    MetricName: 'CPUUtilization',
    Namespace: 'AWS/EC2',
    Statistic: 'Average',
    Dimensions: [
      {
        Name: 'InstanceId',
        Value: instanceId
      }
    ],
    Period: 60, // 1-minute periods
    EvaluationPeriods: minutes, // Number of minutes to wait
    Threshold: -1, // Impossible threshold that will always be exceeded
    ComparisonOperator: 'GreaterThanThreshold',
    TreatMissingData: 'breaching', // Treat missing data as breaching the threshold
    DatapointsToAlarm: 1 // Only need 1 datapoint to trigger
  };

  const command = new PutMetricAlarmCommand(alarmParams);
  await cloudWatchClient.send(command);
  
  console.log(`CloudWatch auto-stop alarm created: ${alarmName}`);
  console.log(`Instance ${instanceId} will be stopped at approximately ${targetTime.toISOString()}`);
}

// Stop instance
ipcMain.handle('stop-instance', async (event, instanceId) => {
  try {
    if (!ec2Client) {
      throw new Error('AWS not configured');
    }

    // First, get instance details to check if it's a spot instance
    const describeCommand = new DescribeInstancesCommand({
      InstanceIds: [instanceId]
    });

    const describeResponse = await ec2Client.send(describeCommand);
    const instance = describeResponse.Reservations[0]?.Instances[0];
    
    if (!instance) {
      throw new Error('Instance not found');
    }

    const isSpotInstance = instance.InstanceLifecycle === 'spot';

    try {
      // Try to stop the instance normally first
      const stopCommand = new StopInstancesCommand({
        InstanceIds: [instanceId]
      });

      await ec2Client.send(stopCommand);
      return { 
        success: true, 
        method: 'stopped',
        message: isSpotInstance ? 'Spot instance stopped successfully' : 'Instance stopped successfully'
      };
    } catch (stopError) {
      // If stopping fails and it's a spot instance, offer termination as an alternative
      if (isSpotInstance && stopError.name === 'UnsupportedOperation') {
        return {
          success: false,
          error: 'Spot instances cannot be stopped, only terminated. Use the terminate option instead.',
          isSpotInstance: true,
          canTerminate: true
        };
      }
      
      // For other errors, return the original error
      throw stopError;
    }
  } catch (error) {
    return { 
      success: false, 
      error: error.message,
      details: error.name === 'UnsupportedOperation' ? 'This operation is not supported for this instance type' : null
    };
  }
});

// Terminate instance (for spot instances that can't be stopped)
ipcMain.handle('terminate-instance', async (event, instanceId) => {
  try {
    if (!ec2Client) {
      throw new Error('AWS not configured');
    }

    const command = new TerminateInstancesCommand({
      InstanceIds: [instanceId]
    });

    await ec2Client.send(command);
    return { 
      success: true,
      method: 'terminated',
      message: 'Instance terminated successfully'
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Secure credential storage using OS keychain/credential manager
const KEYTAR_SERVICE = 'aws-compute-manager';

// Store credentials securely in OS keychain
ipcMain.handle('store-credentials-secure', async (event, accessKeyId, secretAccessKey, region) => {
  try {
    await keytar.setPassword(KEYTAR_SERVICE, 'aws-access-key-id', accessKeyId);
    await keytar.setPassword(KEYTAR_SERVICE, 'aws-secret-access-key', secretAccessKey);
    await keytar.setPassword(KEYTAR_SERVICE, 'aws-region', region);
    
    console.log('Credentials stored securely in OS keychain');
    return { success: true };
  } catch (error) {
    console.error('Failed to store credentials securely:', error);
    return { success: false, error: error.message };
  }
});

// Retrieve credentials securely from OS keychain
ipcMain.handle('retrieve-credentials-secure', async (event) => {
  try {
    const accessKeyId = await keytar.getPassword(KEYTAR_SERVICE, 'aws-access-key-id');
    const secretAccessKey = await keytar.getPassword(KEYTAR_SERVICE, 'aws-secret-access-key');
    const region = await keytar.getPassword(KEYTAR_SERVICE, 'aws-region');
    
    if (accessKeyId && secretAccessKey && region) {
      console.log('Credentials retrieved securely from OS keychain');
      return { 
        success: true, 
        credentials: { accessKeyId, secretAccessKey, region } 
      };
    } else {
      return { success: false, error: 'No stored credentials found' };
    }
  } catch (error) {
    console.error('Failed to retrieve credentials securely:', error);
    return { success: false, error: error.message };
  }
});

// Check if secure credentials exist
ipcMain.handle('check-secure-credentials', async (event) => {
  try {
    const accessKeyId = await keytar.getPassword(KEYTAR_SERVICE, 'aws-access-key-id');
    const hasCredentials = !!accessKeyId;
    
    return { success: true, hasCredentials };
  } catch (error) {
    console.error('Failed to check secure credentials:', error);
    return { success: false, hasCredentials: false };
  }
});

// Delete stored credentials from OS keychain
ipcMain.handle('delete-credentials-secure', async (event) => {
  try {
    await keytar.deletePassword(KEYTAR_SERVICE, 'aws-access-key-id');
    await keytar.deletePassword(KEYTAR_SERVICE, 'aws-secret-access-key');
    await keytar.deletePassword(KEYTAR_SERVICE, 'aws-region');
    
    console.log('Credentials deleted from OS keychain');
    return { success: true };
  } catch (error) {
    console.error('Failed to delete secure credentials:', error);
    return { success: false, error: error.message };
  }
});

// Launch RDP session to EC2 instance
ipcMain.handle('launch-rdp', async (event, publicIp) => {
  try {
    if (!publicIp) {
      throw new Error('No public IP address available for RDP connection');
    }

    const platform = process.platform;
    console.log(`Platform: ${platform}, Target IP: ${publicIp}`);

    if (platform === 'win32') {
      // Windows: Try the most basic approach possible
      console.log('Attempting basic Windows RDP launch...');
      
      return new Promise((resolve) => {
        // Try using exec with shell: true and proper Windows command
        const command = `mstsc.exe /v:${publicIp}`;
        console.log(`Executing: ${command}`);
        
        exec(command, { shell: true, windowsHide: false }, (error, stdout, stderr) => {
          console.log('exec callback called');
          console.log('error:', error);
          console.log('stdout:', stdout);
          console.log('stderr:', stderr);
          
          if (error) {
            console.error('RDP exec error:', error);
            
            // Try alternative approach with full path
            const altCommand = `"C:\\Windows\\System32\\mstsc.exe" /v:${publicIp}`;
            console.log(`Trying alternative: ${altCommand}`);
            
            exec(altCommand, { shell: true, windowsHide: false }, (altError, altStdout, altStderr) => {
              console.log('Alternative exec callback called');
              console.log('altError:', altError);
              console.log('altStdout:', altStdout);
              console.log('altStderr:', altStderr);
              
              if (altError) {
                resolve({ 
                  success: false, 
                  error: `Both attempts failed. First: ${error.message}, Second: ${altError.message}`,
                  helpMessage: 'Unable to launch Remote Desktop Connection. Please try running "mstsc /v:' + publicIp + '" manually from Command Prompt.',
                  publicIp: publicIp,
                  debugInfo: {
                    command1: command,
                    command2: altCommand,
                    error1: error.message,
                    error2: altError.message
                  }
                });
              } else {
                console.log('Alternative command succeeded');
                resolve({ 
                  success: true, 
                  message: `RDP session launched to ${publicIp}`,
                  publicIp: publicIp
                });
              }
            });
          } else {
            console.log('Primary command succeeded');
            resolve({ 
              success: true, 
              message: `RDP session launched to ${publicIp}`,
              publicIp: publicIp
            });
          }
        });
      });
      
    } else {
      // Non-Windows platforms
      if (platform === 'darwin') {
        // macOS: Create RDP file and open it
        console.log('Creating RDP file for macOS...');
        
        return new Promise((resolve) => {
          const tempDir = os.tmpdir();
          const rdpFileName = `aws-ec2-${publicIp.replace(/\./g, '-')}-${Date.now()}.rdp`;
          const rdpFilePath = path.join(tempDir, rdpFileName);
          
          // Create RDP file content compatible with macOS RDP clients
          const rdpContent = [
            'screen mode id:i:2',
            'use multimon:i:0',
            'desktopwidth:i:1920',
            'desktopheight:i:1080',
            'session bpp:i:32',
            'compression:i:1',
            'keyboardhook:i:2',
            'audiocapturemode:i:0',
            'videoplaybackmode:i:1',
            'connection type:i:7',
            'networkautodetect:i:1',
            'bandwidthautodetect:i:1',
            'displayconnectionbar:i:1',
            'disable wallpaper:i:0',
            'allow font smoothing:i:0',
            'allow desktop composition:i:0',
            'disable full window drag:i:1',
            'disable menu anims:i:1',
            'disable themes:i:0',
            'bitmapcachepersistenable:i:1',
            `full address:s:${publicIp}`,
            'authentication level:i:2',
            'prompt for credentials:i:1',
            'negotiate security layer:i:1',
            'remoteapplicationmode:i:0',
            'alternate shell:s:',
            'shell working directory:s:',
            'gatewayhostname:s:',
            'gatewayusagemethod:i:4',
            'gatewaycredentialssource:i:4',
            'promptcredentialonce:i:0',
            'use redirection server name:i:0'
          ].join('\r\n');
          
          try {
            fs.writeFileSync(rdpFilePath, rdpContent, 'utf8');
            console.log(`RDP file created: ${rdpFilePath}`);
            
            // Open the RDP file with the default application
            exec(`open "${rdpFilePath}"`, (error, stdout, stderr) => {
              if (error) {
                console.error('RDP file open error:', error);
                // Clean up the temp file
                try { fs.unlinkSync(rdpFilePath); } catch (e) {}
                
                resolve({ 
                  success: false, 
                  error: error.message,
                  helpMessage: 'Failed to open RDP file. Make sure you have an RDP client installed (Microsoft Remote Desktop recommended).',
                  publicIp: publicIp,
                  installInstructions: 'Microsoft Remote Desktop: https://apps.apple.com/app/microsoft-remote-desktop/id1295203466'
                });
              } else {
                console.log('RDP file opened successfully');
                
                // Clean up the temp file after a delay
                setTimeout(() => {
                  try { 
                    fs.unlinkSync(rdpFilePath); 
                    console.log('Temp RDP file cleaned up');
                  } catch (e) {
                    console.log('Could not clean up temp file:', e.message);
                  }
                }, 10000); // Wait 10 seconds before cleanup
                
                resolve({ 
                  success: true, 
                  message: `RDP file opened for ${publicIp}`,
                  publicIp: publicIp
                });
              }
            });
            
          } catch (fileError) {
            console.error('Failed to create RDP file:', fileError);
            resolve({ 
              success: false, 
              error: 'Failed to create RDP connection file',
              helpMessage: 'Unable to create temporary RDP file. Please try connecting manually to: ' + publicIp,
              publicIp: publicIp
            });
          }
        });
      } else {
        // Linux and other platforms
        let command;
        switch (platform) {
          case 'linux':
            command = `rdesktop ${publicIp} 2>/dev/null || xfreerdp /v:${publicIp} 2>/dev/null || krdc rdp://${publicIp}`;
            break;
          default:
            throw new Error(`RDP connections not supported on platform: ${platform}`);
        }

        console.log(`Launching RDP session: ${command}`);
        
        return new Promise((resolve) => {
          exec(command, (error, stdout, stderr) => {
            if (error) {
              console.error('RDP launch error:', error);
              
              let helpMessage = '';
              switch (platform) {
                case 'linux':
                  helpMessage = 'Make sure an RDP client is installed (rdesktop, xfreerdp, or krdc).';
                  break;
              }
              
              resolve({ 
                success: false, 
                error: error.message,
                helpMessage: helpMessage,
                publicIp: publicIp
              });
            } else {
              console.log('RDP session launched successfully');
              resolve({ 
                success: true, 
                message: `RDP session launched to ${publicIp}`,
                publicIp: publicIp
              });
            }
          });
        });
      }
    }

  } catch (error) {
    console.error('RDP launch error:', error);
    return { success: false, error: error.message };
  }
});
