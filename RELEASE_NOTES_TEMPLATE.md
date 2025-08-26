## AWS Compute Manager v1.0.0

### 🚀 Features
- **Cross-Platform Support**: Universal macOS (Intel + Apple Silicon) and Windows binaries
- **EC2 Instance Management**: Start, stop, and terminate AWS EC2 instances with visual interface
- **Spot Instance Support**: Proper handling of spot instances with terminate functionality
- **Auto-Stop Features**: CloudWatch-based time limits and CPU idle detection
- **Settings Persistence**: Remembers AWS credentials and region between sessions

### 📦 Downloads

#### macOS
- **Universal DMG** (Intel + Apple Silicon): `AWS Compute Manager-1.0.0.dmg`
- **Apple Silicon DMG** (M1/M2/M3): `AWS Compute Manager-1.0.0-arm64.dmg`

#### Windows
- **Installer** (Recommended): `AWS Compute Manager Setup 1.0.0.exe`
- **Portable** (No installation): `AWS Compute Manager-1.0.0-portable.exe`

### 🔧 Installation

#### macOS
1. Download the appropriate DMG file
2. Mount the DMG and drag the app to Applications folder
3. **IMPORTANT**: On first launch, **right-click** the app and select **"Open"** to bypass security warnings
4. Click **"Open"** in the security dialog that appears

#### Windows
1. Download the installer or portable version
2. For installer: Run the .exe and follow the setup wizard
3. For portable: Just run the .exe file directly

### 🛡️ Security Notice for macOS Users

**You may see a warning: "Apple could not verify AWS Compute Manager is free of malware"**

This is normal for unsigned applications. To resolve:

**Option 1 (Recommended):**
1. Right-click on "AWS Compute Manager.app"
2. Select "Open" from the context menu
3. Click "Open" in the security dialog

**Option 2:**
1. Go to System Settings → Privacy & Security
2. Find the notification about the blocked app
3. Click "Open Anyway"

**Option 3 (Terminal):**
```bash
sudo xattr -dr com.apple.quarantine "/Applications/AWS Compute Manager.app"
```

This app is open source and safe to use. The warning appears because it's not signed with an Apple Developer certificate.

### ⚙️ Setup
1. Launch AWS Compute Manager
2. Enter your AWS Access Key ID and Secret Access Key
3. Select your preferred AWS region
4. Click 'Load Instances' to see your EC2 instances

### 📋 Requirements
- AWS account with EC2 access
- AWS credentials (Access Key ID and Secret Access Key)
- macOS 10.12+ or Windows 7+

### 🔒 Privacy & Security
- This app runs locally on your machine
- AWS credentials are stored locally in your user directory
- No data is sent to third parties
- Open source code available for review
