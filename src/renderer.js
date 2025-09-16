class AWSComputeManager {
    constructor() {
        this.currentInstanceId = '';
        this.isConfigured = false;
        this.refreshInterval = null;
        this.initializeEventListeners();
        this.checkForSavedCredentials();
        this.loadSavedSettings();
    }

    initializeEventListeners() {
        console.log('Initializing event listeners...'); // Debug log
        
        // AWS Configuration Form
        const awsForm = document.getElementById('awsConfigForm');
        if (awsForm) {
            console.log('AWS form found, adding event listener'); // Debug log
            awsForm.addEventListener('submit', this.handleAWSConfig.bind(this));
        } else {
            console.error('AWS form not found!'); // Debug log
        }
        
        // Instance Management
        document.getElementById('loadInstancesBtn').addEventListener('click', this.loadInstances.bind(this));
        document.getElementById('refreshBtn').addEventListener('click', this.refreshInstanceStatus.bind(this));
        document.getElementById('startBtn').addEventListener('click', this.startInstance.bind(this));
        document.getElementById('stopBtn').addEventListener('click', this.stopInstance.bind(this));
        document.getElementById('terminateBtn').addEventListener('click', this.terminateInstance.bind(this));
        
        // Auto-stop controls
        document.getElementById('autoStopTime').addEventListener('change', this.handleAutoStopChange.bind(this));
        
        // Secure credential controls - use safer approach with error handling
        this.setupSecureCredentialListeners();
    }

    setupSecureCredentialListeners() {
        const loadBtn = document.getElementById('loadSavedCredentialsBtn');
        const deleteBtn = document.getElementById('deleteSavedCredentialsBtn');
        
        if (loadBtn) {
            loadBtn.addEventListener('click', this.loadSavedCredentials.bind(this));
        }
        if (deleteBtn) {
            deleteBtn.addEventListener('click', this.deleteSavedCredentials.bind(this));
        }
    }

    async loadSavedSettings() {
        try {
            const result = await window.electronAPI.getSavedSettings();
            
            if (result.success && result.settings) {
                const { region, accessKeyId } = result.settings;
                
                // Populate form fields if we have saved values
                if (region) {
                    document.getElementById('region').value = region;
                }
                if (accessKeyId) {
                    document.getElementById('accessKeyId').value = accessKeyId;
                }
                
                // Add log entry if settings were loaded
                if (region || accessKeyId) {
                    setTimeout(() => {
                        this.addLogEntry('Previous AWS settings loaded. Enter your secret key to continue.', 'info');
                    }, 500);
                }
            }
            
            // Check for secure credentials after loading regular settings
            await this.checkForSavedCredentials();
            
        } catch (error) {
            console.warn('Could not load saved settings:', error);
        }
    }

    async handleAWSConfig(event) {
        console.log('handleAWSConfig called'); // Debug log
        event.preventDefault();
        this.showLoading(true);

        const config = {
            region: document.getElementById('region').value,
            accessKeyId: document.getElementById('accessKeyId').value,
            secretAccessKey: document.getElementById('secretAccessKey').value
        };

        console.log('AWS Config:', { region: config.region, accessKeyId: config.accessKeyId }); // Debug log (don't log secret)

        const saveSecurely = document.getElementById('saveCredentialsSecure').checked;
        console.log('Save securely:', saveSecurely); // Debug log

        try {
            const result = await window.electronAPI.configureAWS(config);
            console.log('Configure AWS result:', result); // Debug log
            
            if (result.success) {
                this.isConfigured = true;
                this.showInstanceSection();
                let message = 'AWS configuration successful';
                if (result.settingsSaved) {
                    message += ' (settings saved for next time)';
                }
                this.addLogEntry(message, 'success');
                
                // Save credentials securely if checkbox is checked
                if (saveSecurely) {
                    try {
                        console.log('Attempting to save credentials securely...'); // Debug log
                        const secureResult = await window.electronAPI.storeCredentialsSecure(
                            config.accessKeyId, 
                            config.secretAccessKey, 
                            config.region
                        );
                        
                        if (secureResult.success) {
                            this.showSecureCredentialsStatus('🔐 Credentials saved securely with biometric protection', 'success');
                            // Show the saved credentials section for next time
                            document.getElementById('savedCredentialsSection').style.display = 'block';
                        } else {
                            this.showSecureCredentialsStatus('⚠️ Failed to save credentials securely: ' + secureResult.error, 'error');
                        }
                    } catch (secureError) {
                        console.error('Secure save error:', secureError); // Debug log
                        this.showSecureCredentialsStatus('⚠️ Error saving credentials securely: ' + secureError.message, 'error');
                    }
                }
                
                // Automatically load instances after successful configuration
                setTimeout(() => this.loadInstances(), 1000);
            } else {
                this.addLogEntry(`Configuration failed: ${result.error}`, 'error');
            }
        } catch (error) {
            console.error('Configuration error:', error); // Enhanced debug log
            this.addLogEntry(`Configuration error: ${error.message}`, 'error');
        } finally {
            this.showLoading(false);
        }
    }

    handleAutoStopChange(event) {
        const customInput = document.getElementById('customStopTime');
        if (event.target.value === 'custom') {
            customInput.style.display = 'block';
            customInput.focus();
        } else {
            customInput.style.display = 'none';
        }
    }

    updateAutoStopVisibility() {
        const autoStopOption = document.getElementById('autoStopOption');
        const hasInstanceId = this.currentInstanceId.length > 0;
        autoStopOption.style.display = hasInstanceId ? 'block' : 'none';
    }

    async loadInstances() {
        this.showLoading(true);
        this.addLogEntry('Loading instances...', 'info');

        try {
            const result = await window.electronAPI.listInstances();
            
            if (result.success) {
                this.displayInstances(result.instances);
                this.addLogEntry(`Found ${result.instances.length} instances`, 'success');
            } else {
                this.addLogEntry(`Failed to load instances: ${result.error}`, 'error');
            }
        } catch (error) {
            this.addLogEntry(`Load instances error: ${error.message}`, 'error');
        } finally {
            this.showLoading(false);
        }
    }

    displayInstances(instances) {
        const instanceGrid = document.getElementById('instanceGrid');
        const instanceListContainer = document.getElementById('instanceListContainer');
        
        instanceGrid.innerHTML = '';
        
        if (instances.length === 0) {
            instanceGrid.innerHTML = `
                <div class="no-instances">
                    <div style="font-size: 48px; margin-bottom: 15px; opacity: 0.5;">☁️</div>
                    <p>No instances found in this region</p>
                </div>
            `;
        } else {
            instances.forEach(instance => {
                const instanceCard = this.createInstanceCard(instance);
                instanceGrid.appendChild(instanceCard);
            });
        }
        
        instanceListContainer.style.display = 'block';
    }

    createInstanceCard(instance) {
        const card = document.createElement('div');
        card.className = 'instance-card';
        card.dataset.instanceId = instance.id;
        
        const launchDate = instance.launchTime ? new Date(instance.launchTime).toLocaleDateString() : 'Unknown';
        
        card.innerHTML = `
            <div class="instance-name">${instance.name}</div>
            <div class="instance-id">${instance.id}</div>
            <div class="instance-details">
                <span class="instance-type">${instance.type}</span>
                <span class="instance-state-badge ${instance.state.toLowerCase()}">${instance.state}</span>
            </div>
            <div style="margin-top: 8px; font-size: 11px; color: #6c757d;">
                Launched: ${launchDate}
                ${instance.publicIp ? `<br>Public IP: ${instance.publicIp}` : ''}
            </div>
        `;
        
        card.addEventListener('click', () => this.selectInstance(instance));
        
        return card;
    }

    selectInstance(instance) {
        // Clear previous selection
        this.clearInstanceSelection();
        
        // Select the clicked card
        const card = document.querySelector(`[data-instance-id="${instance.id}"]`);
        card.classList.add('selected');
        
        // Update the current instance ID
        this.currentInstanceId = instance.id;
        
        // Update status display immediately
        this.updateStatusDisplay({
            state: instance.state,
            instanceType: instance.type,
            publicIp: instance.publicIp,
            privateIp: instance.privateIp,
            isSpotInstance: instance.spotInstanceRequestId ? true : false
        });
        
        // Show auto-stop option
        this.updateAutoStopVisibility();
        
        this.addLogEntry(`Selected instance: ${instance.name} (${instance.id})`, 'info');
    }

    clearInstanceSelection() {
        document.querySelectorAll('.instance-card.selected').forEach(card => {
            card.classList.remove('selected');
        });
    }

    async refreshInstanceStatus() {
        if (!this.currentInstanceId) {
            this.addLogEntry('Please select an instance first', 'error');
            return;
        }

        this.showLoading(true);

        try {
            const result = await window.electronAPI.getInstanceStatus(this.currentInstanceId);
            
            if (result.success) {
                this.updateStatusDisplay(result);
                this.addLogEntry(`Status updated for ${this.currentInstanceId}`, 'success');
            } else {
                this.addLogEntry(`Failed to get status: ${result.error}`, 'error');
                this.clearStatus();
            }
        } catch (error) {
            this.addLogEntry(`Status error: ${error.message}`, 'error');
        } finally {
            this.showLoading(false);
        }
    }

    async startInstance() {
        if (!this.currentInstanceId) {
            this.addLogEntry('Please select an instance first', 'error');
            return;
        }

        // Get auto-stop time
        const autoStopSelect = document.getElementById('autoStopTime');
        const customStopTime = document.getElementById('customStopTime');
        
        let autoStopMinutes = 0;
        if (autoStopSelect.value === 'custom') {
            autoStopMinutes = parseInt(customStopTime.value) || 0;
        } else {
            autoStopMinutes = parseInt(autoStopSelect.value) || 0;
        }

        this.showLoading(true);
        
        let logMessage = `Starting instance ${this.currentInstanceId}`;
        if (autoStopMinutes > 0) {
            logMessage += ` with auto-stop after ${autoStopMinutes} minutes`;
        }
        this.addLogEntry(logMessage + '...', 'info');

        try {
            const result = await window.electronAPI.startInstance(this.currentInstanceId, autoStopMinutes);
            
            if (result.success) {
                this.addLogEntry(`Start command sent successfully`, 'success');
                
                if (result.autoStop === true && result.features) {
                    this.addLogEntry(`✅ Auto-stop configured: ${result.features}`, 'success');
                    this.showAutoStopScheduled(autoStopMinutes, result.features);
                } else if (result.autoStop === true && result.stopTime) {
                    this.addLogEntry(`✅ Auto-stop scheduled for ${result.stopTime}`, 'success');
                    this.showAutoStopScheduled(autoStopMinutes);
                } else if (result.autoStop === 'pending' && result.stopTime) {
                    this.addLogEntry(`⏳ Auto-stop will be scheduled once instance is running (target: ${result.stopTime})`, 'info');
                    this.showAutoStopPending(autoStopMinutes);
                } else if (result.autoStop === false && result.scheduleError) {
                    this.addLogEntry(`⚠️ Instance started but auto-stop scheduling failed: ${result.scheduleError}`, 'error');
                    this.showAutoStopError(result.scheduleError);
                }
                
                // Wait a moment then refresh status
                setTimeout(() => this.refreshInstanceStatus(), 2000);
            } else {
                this.addLogEntry(`Failed to start instance: ${result.error}`, 'error');
            }
        } catch (error) {
            this.addLogEntry(`Start error: ${error.message}`, 'error');
        } finally {
            this.showLoading(false);
        }
    }

    showAutoStopScheduled(minutes, features = null) {
        const statusContainer = document.getElementById('autoStopStatusContainer');
        
        // Remove any existing scheduled notice
        const existingNotice = document.querySelector('.auto-stop-scheduled, .auto-stop-pending, .auto-stop-error');
        if (existingNotice) {
            existingNotice.remove();
        }
        
        // Add new scheduled notice
        const scheduledDiv = document.createElement('div');
        scheduledDiv.className = 'auto-stop-scheduled';
        
        let message = '<span class="icon">✅</span><strong>Auto-stop configured</strong><br>';
        
        if (features) {
            message += `Instance will ${features}`;
        } else {
            if (minutes > 0) {
                const stopTime = new Date(Date.now() + minutes * 60 * 1000);
                message += `Instance will stop at ${stopTime.toLocaleTimeString()} (${minutes} minutes)`;
            }
        }
        
        scheduledDiv.innerHTML = message;
        statusContainer.appendChild(scheduledDiv);
    }

    showAutoStopPending(minutes) {
        const statusContainer = document.getElementById('autoStopStatusContainer');
        
        // Remove any existing notice
        const existingNotice = document.querySelector('.auto-stop-scheduled, .auto-stop-pending, .auto-stop-error');
        if (existingNotice) {
            existingNotice.remove();
        }
        
        // Add pending notice
        const pendingDiv = document.createElement('div');
        pendingDiv.className = 'auto-stop-pending';
        
        let message = '<span class="icon">⏳</span><strong>Auto-stop pending</strong><br>';
        
        if (minutes > 0) {
            const stopTime = new Date(Date.now() + minutes * 60 * 1000);
            message += `Will be scheduled once instance is fully running (target: ${stopTime.toLocaleTimeString()})`;
        }
        
        pendingDiv.innerHTML = message;
        statusContainer.appendChild(pendingDiv);
    }

    showAutoStopError(error) {
        const statusContainer = document.getElementById('autoStopStatusContainer');
        
        // Remove any existing notice
        const existingNotice = document.querySelector('.auto-stop-scheduled, .auto-stop-pending, .auto-stop-error');
        if (existingNotice) {
            existingNotice.remove();
        }
        
        // Add error notice
        const errorDiv = document.createElement('div');
        errorDiv.className = 'auto-stop-error';
        errorDiv.innerHTML = `
            <span class="icon">⚠️</span>
            <strong>Auto-stop failed</strong><br>
            ${error}<br>
            <small>You may need to stop the instance manually</small>
        `;
        
        statusContainer.appendChild(errorDiv);
    }

    async stopInstance() {
        if (!this.currentInstanceId) {
            this.addLogEntry('Please select an instance first', 'error');
            return;
        }

        this.showLoading(true);
        this.addLogEntry(`Stopping instance ${this.currentInstanceId}...`, 'info');

        try {
            const result = await window.electronAPI.stopInstance(this.currentInstanceId);
            
            if (result.success) {
                this.addLogEntry(`Stop command sent successfully`, 'success');
                // Wait a moment then refresh status
                setTimeout(() => this.refreshInstanceStatus(), 2000);
            } else {
                if (result.isSpotInstance && result.canTerminate) {
                    this.addLogEntry(`❌ ${result.error}`, 'error');
                    this.showTerminateOption();
                } else {
                    this.addLogEntry(`Failed to stop instance: ${result.error}`, 'error');
                    if (result.details) {
                        this.addLogEntry(`Details: ${result.details}`, 'error');
                    }
                }
            }
        } catch (error) {
            this.addLogEntry(`Stop error: ${error.message}`, 'error');
        } finally {
            this.showLoading(false);
        }
    }

    async terminateInstance() {
        if (!this.currentInstanceId) {
            this.addLogEntry('Please select an instance first', 'error');
            return;
        }

        // Show confirmation dialog for termination
        const confirmed = confirm(
            '⚠️ WARNING: Terminating an instance will permanently destroy it and all data on it.\n\n' +
            'This action cannot be undone. Are you sure you want to terminate this instance?'
        );

        if (!confirmed) {
            this.addLogEntry('Termination cancelled by user', 'info');
            return;
        }

        this.showLoading(true);
        this.addLogEntry(`Terminating instance ${this.currentInstanceId}...`, 'info');

        try {
            const result = await window.electronAPI.terminateInstance(this.currentInstanceId);
            
            if (result.success) {
                this.addLogEntry(`⚠️ Instance terminated successfully`, 'success');
                this.hideTerminateOption();
                // Wait a moment then refresh status
                setTimeout(() => this.refreshInstanceStatus(), 2000);
            } else {
                this.addLogEntry(`Failed to terminate instance: ${result.error}`, 'error');
            }
        } catch (error) {
            this.addLogEntry(`Terminate error: ${error.message}`, 'error');
        } finally {
            this.showLoading(false);
        }
    }

    showTerminateOption() {
        document.getElementById('terminateBtn').style.display = 'block';
        this.addLogEntry('💡 Spot instances cannot be stopped, only terminated. Use the Terminate button.', 'info');
    }

    hideTerminateOption() {
        document.getElementById('terminateBtn').style.display = 'none';
    }

    updateStatusDisplay(data) {
        const stateElement = document.getElementById('instanceState');
        const typeElement = document.getElementById('instanceType');
        const publicIpElement = document.getElementById('publicIp');
        const privateIpElement = document.getElementById('privateIp');

        stateElement.textContent = data.state;
        stateElement.className = `status-badge ${data.state.toLowerCase()}`;
        
        typeElement.textContent = data.instanceType || '-';
        publicIpElement.textContent = data.publicIp || '-';
        privateIpElement.textContent = data.privateIp || '-';

        // Update button states
        const startBtn = document.getElementById('startBtn');
        const stopBtn = document.getElementById('stopBtn');
        const terminateBtn = document.getElementById('terminateBtn');

        // Hide terminate button by default
        terminateBtn.style.display = 'none';

        if (data.state === 'running') {
            startBtn.disabled = true;
            stopBtn.disabled = false;
            
            // Show terminate button for spot instances
            if (data.isSpotInstance) {
                terminateBtn.style.display = 'block';
            }
        } else if (data.state === 'stopped') {
            startBtn.disabled = false;
            stopBtn.disabled = true;
        } else {
            // Pending, stopping, etc.
            startBtn.disabled = true;
            stopBtn.disabled = true;
        }
    }

    clearStatus() {
        document.getElementById('instanceState').textContent = 'Select an instance';
        document.getElementById('instanceState').className = 'status-badge';
        document.getElementById('instanceType').textContent = '-';
        document.getElementById('publicIp').textContent = '-';
        document.getElementById('privateIp').textContent = '-';
        
        document.getElementById('startBtn').disabled = true;
        document.getElementById('stopBtn').disabled = true;
        document.getElementById('terminateBtn').style.display = 'none';
    }

    showInstanceSection() {
        document.getElementById('configSection').style.display = 'none';
        document.getElementById('instanceSection').style.display = 'block';
    }

    showLoading(show) {
        document.getElementById('loading').style.display = show ? 'flex' : 'none';
    }

    addLogEntry(message, type = 'info') {
        const logContainer = document.getElementById('logContainer');
        const timestamp = new Date().toLocaleTimeString();
        const logEntry = document.createElement('div');
        logEntry.className = `log-entry ${type}`;
        logEntry.textContent = `[${timestamp}] ${message}`;
        
        logContainer.appendChild(logEntry);
        logContainer.scrollTop = logContainer.scrollHeight;

        // Keep only last 50 entries
        while (logContainer.children.length > 50) {
            logContainer.removeChild(logContainer.firstChild);
        }
    }

    startAutoRefresh() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
        }
        
        this.refreshInterval = setInterval(() => {
            if (this.currentInstanceId && this.isConfigured) {
                this.refreshInstanceStatus();
            }
        }, 30000); // Refresh every 30 seconds
    }

    stopAutoRefresh() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
    }

    // Secure Credential Management
    async checkForSavedCredentials() {
        try {
            const result = await window.electronAPI.checkSecureCredentials();
            const savedCredentialsSection = document.getElementById('savedCredentialsSection');
            
            if (result.success && result.hasCredentials) {
                savedCredentialsSection.style.display = 'block';
            } else {
                savedCredentialsSection.style.display = 'none';
            }
        } catch (error) {
            console.error('Error checking for saved credentials:', error);
        }
    }

    async loadSavedCredentials() {
        try {
            this.showSecureCredentialsStatus('Loading saved credentials...', 'info');
            
            const result = await window.electronAPI.retrieveCredentialsSecure();
            
            if (result.success && result.credentials) {
                const { accessKeyId, secretAccessKey, region } = result.credentials;
                
                // Fill form fields
                document.getElementById('region').value = region;
                document.getElementById('accessKeyId').value = accessKeyId;
                document.getElementById('secretAccessKey').value = secretAccessKey;
                
                this.showSecureCredentialsStatus('✅ Credentials loaded successfully from secure storage', 'success');
                
                // Auto-configure AWS with loaded credentials
                setTimeout(() => {
                    this.handleAWSConfig({ preventDefault: () => {} });
                }, 1000);
                
            } else {
                this.showSecureCredentialsStatus('❌ Failed to load saved credentials: ' + (result.error || 'Unknown error'), 'error');
            }
        } catch (error) {
            this.showSecureCredentialsStatus('❌ Error loading credentials: ' + error.message, 'error');
        }
    }

    async deleteSavedCredentials() {
        if (!confirm('Are you sure you want to delete your saved credentials? This action cannot be undone.')) {
            return;
        }

        try {
            this.showSecureCredentialsStatus('Deleting saved credentials...', 'info');
            
            const result = await window.electronAPI.deleteCredentialsSecure();
            
            if (result.success) {
                this.showSecureCredentialsStatus('✅ Saved credentials deleted successfully', 'success');
                document.getElementById('savedCredentialsSection').style.display = 'none';
                
                // Clear form fields
                document.getElementById('accessKeyId').value = '';
                document.getElementById('secretAccessKey').value = '';
                document.getElementById('saveCredentialsSecure').checked = false;
                
            } else {
                this.showSecureCredentialsStatus('❌ Failed to delete credentials: ' + (result.error || 'Unknown error'), 'error');
            }
        } catch (error) {
            this.showSecureCredentialsStatus('❌ Error deleting credentials: ' + error.message, 'error');
        }
    }

    showSecureCredentialsStatus(message, type) {
        const statusDiv = document.getElementById('secureCredentialsStatus');
        statusDiv.innerHTML = `<div class="secure-credentials-status ${type}">${message}</div>`;
        statusDiv.style.display = 'block';
        
        // Auto-hide success messages after 5 seconds
        if (type === 'success') {
            setTimeout(() => {
                statusDiv.style.display = 'none';
            }, 5000);
        }
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    const app = new AWSComputeManager();
    
    // Start auto-refresh when configured
    window.addEventListener('beforeunload', () => {
        app.stopAutoRefresh();
    });
});
