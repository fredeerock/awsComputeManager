# Building AWS Compute Manager

This guide explains how to build distributable binaries for macOS and Windows.

## Prerequisites

- Node.js 16+ installed
- npm or yarn package manager
- For Windows builds on macOS: Wine (optional, for testing)

## Build Commands

### Install Dependencies
```bash
npm install
```

### Build for macOS
```bash
npm run build-mac
```
Creates:
- `dist/AWS Compute Manager-1.0.0.dmg` (Universal installer)
- Supports both Intel (x64) and Apple Silicon (arm64) Macs

### Build for Windows
```bash
npm run build-windows
```
Creates:
- `dist/AWS Compute Manager Setup 1.0.0.exe` (NSIS installer)
- `dist/AWS Compute Manager-1.0.0-portable.exe` (Portable version)
- Supports both 64-bit (x64) and 32-bit (ia32) Windows

### Build for All Platforms
```bash
npm run build-all
```
Creates binaries for both macOS and Windows in one command.

## Output Files

All built files will be placed in the `dist/` directory:

### macOS
- **DMG Installer**: Double-click to mount and drag to Applications folder
- **Universal Binary**: Works on both Intel and Apple Silicon Macs

### Windows
- **NSIS Installer**: Traditional Windows installer with options
- **Portable Version**: Single .exe file that doesn't require installation

## Icon Customization

To customize the app icons:
1. Add your custom icons to the `assets/` folder:
   - `icon.icns` - macOS icon (512x512 or higher)
   - `icon.ico` - Windows icon (256x256 or higher)

## Code Signing (Optional)

For distribution outside of development:

### macOS
- Requires Apple Developer account
- Remove `"identity": null` from package.json
- Add your signing certificate details

### Windows
- Requires code signing certificate
- Add certificate details to build configuration

## Troubleshooting

### Build Errors
- Ensure all dependencies are installed: `npm install`
- Clear cache: `rm -rf node_modules dist && npm install`
- Check Node.js version compatibility

### Platform-Specific Issues
- **macOS**: May require Xcode Command Line Tools
- **Windows**: Some antivirus software may flag unsigned executables

## Distribution

### macOS
- For App Store: Use `mas` target instead of `dmg`
- For notarization: Add Apple Developer credentials

### Windows
- For Microsoft Store: Use `appx` target
- Consider code signing for trusted distribution
