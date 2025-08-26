const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { EC2Client, StartInstancesCommand, StopInstancesCommand, DescribeInstancesCommand, TerminateInstancesCommand } = require('@aws-sdk/client-ec2');
const { CloudWatchClient, PutMetricAlarmCommand, DeleteAlarmsCommand } = require('@aws-sdk/client-cloudwatch');

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
ipcMain.handle('start-instance', async (event, instanceId, autoStopMinutes = null, idleStopEnabled = false) => {
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
    
    // Idle-based auto-stop alarm
    if (idleStopEnabled) {
      try {
        await createIdleStopAlarm(instanceId);
      } catch (scheduleError) {
        scheduleErrors.push(`Idle detection: ${scheduleError.message}`);
      }
    }
    
    if (scheduleErrors.length > 0) {
      return { 
        success: true, 
        autoStop: false, 
        scheduleError: scheduleErrors.join('; ')
      };
    }
    
    if (autoStopMinutes > 0 || idleStopEnabled) {
      let features = [];
      if (autoStopMinutes > 0) features.push(`stops after ${autoStopMinutes} minutes`);
      if (idleStopEnabled) features.push('stops when idle');
      
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

// Create CloudWatch alarm to stop instance when idle (low CPU usage)
async function createIdleStopAlarm(instanceId) {
  if (!cloudWatchClient) {
    throw new Error('CloudWatch not configured');
  }

  if (!awsRegion) {
    throw new Error('AWS region not configured');
  }

  const alarmName = `IdleStop-${instanceId}-${Date.now()}`;
  
  // Create an alarm that triggers when CPU usage is low for 5 consecutive minutes
  const alarmParams = {
    AlarmName: alarmName,
    AlarmDescription: `Auto-stop ${instanceId} when idle (CPU < 5% for 5 minutes)`,
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
    EvaluationPeriods: 5, // 5 consecutive periods = 5 minutes
    Threshold: 5.0, // 5% CPU utilization
    ComparisonOperator: 'LessThanThreshold',
    TreatMissingData: 'breaching', // Treat missing data as low CPU
    DatapointsToAlarm: 5 // All 5 datapoints must be below threshold
  };

  const command = new PutMetricAlarmCommand(alarmParams);
  await cloudWatchClient.send(command);
  
  console.log(`CloudWatch idle-stop alarm created: ${alarmName}`);
  console.log(`Instance ${instanceId} will be stopped when CPU < 5% for 5 consecutive minutes`);
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
