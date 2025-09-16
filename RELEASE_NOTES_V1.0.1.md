## AWS Compute Manager v1.1.0

### 🎉 What's New - RDP Connection Support!

This release introduces **automatic Remote Desktop Protocol (RDP) connectivity** to your EC2 instances with full cross-platform support!

#### 🖥️ New RDP Features
- **One-Click RDP Access**: Launch Remote Desktop sessions directly from the instance list
- **Cross-Platform Support**: Works seamlessly on Windows, macOS, and Linux
- **Smart Button Management**: RDP button automatically enables/disables based on instance state
- **Platform-Specific Optimizations**:
  - **Windows**: Direct `mstsc.exe` integration with fallback support
  - **macOS**: Generates `.rdp` files compatible with Microsoft Remote Desktop and other RDP clients
  - **Linux**: Supports multiple RDP clients (rdesktop, xfreerdp, krdc)
- **Comprehensive Error Handling**: User-friendly guidance for missing RDP clients
- **Secure Temporary Files**: Automatic cleanup of generated RDP connection files

#### 🚀 Existing Features
- **EC2 Instance Management**: Start, stop, and terminate AWS EC2 instances with visual interface
- **Spot Instance Support**: Proper handling of spot instances with terminate functionality
- **Auto-Stop Features**: CloudWatch-based time limits and CPU idle detection
- **Settings Persistence**: Remembers AWS credentials and region between sessions
- **Cross-Platform Binaries**: Universal macOS (Intel + Apple Silicon) and Windows support

### 📦 Downloads

Choose the appropriate binary for your platform:

- **macOS (Apple Silicon/M1/M2)**: `AWS Compute Manager-1.1.0-arm64.dmg`
- **macOS (Intel)**: `AWS Compute Manager-1.1.0.dmg`
- **Windows (Installer)**: `AWS Compute Manager Setup 1.1.0.exe`
- **Windows (Portable)**: `AWS Compute Manager-1.1.0-portable.exe`

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

This app is open source and safe to use.

### 🔧 Technical Details

**RDP Connection Requirements:**
- **Windows**: Uses built-in Remote Desktop Connection (mstsc.exe)
- **macOS**: Requires Microsoft Remote Desktop or compatible RDP client
- **Linux**: Requires rdesktop, xfreerdp, or krdc

The app will guide you through installation if any required RDP client is missing.

### 📝 Changelog

**Added:**
- RDP Connect button with custom blue gradient styling
- Cross-platform RDP client detection and launching
- Platform-specific RDP file generation for macOS compatibility
- Comprehensive error handling with installation guidance
- Smart instance state validation for RDP availability
- Enhanced logging and debugging for RDP operations

**Technical Improvements:**
- Improved cross-platform compatibility
- Enhanced error messaging
- Better temporary file management
- Expanded platform detection capabilities

---

**Full Changelog**: https://github.com/fredeerock/awsComputeManager/compare/v1.0.1...v1.1.0