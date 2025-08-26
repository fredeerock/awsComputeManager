# GitHub Release Commands for AWS Compute Manager

## Quick Release (Current Method)
```bash
# 1. Build all binaries
npm run build-all

# 2. Create release with current version
VERSION=$(node -p "require('./package.json').version")
gh release create "v$VERSION" \
  --title "AWS Compute Manager v$VERSION" \
  --notes-file RELEASE_NOTES.md \
  "dist/AWS Compute Manager-$VERSION.dmg#macOS Universal Installer (DMG)" \
  "dist/AWS Compute Manager-$VERSION-arm64.dmg#macOS Apple Silicon Installer (DMG)" \
  "dist/AWS Compute Manager Setup $VERSION.exe#Windows Installer (EXE)" \
  "dist/AWS Compute Manager-$VERSION-portable.exe#Windows Portable (EXE)"
```

## Manual Commands

### View Releases
```bash
gh release list
gh release view v1.0.0
gh release view v1.0.0 --web  # Open in browser
```

### Create Release
```bash
gh release create v1.1.0 \
  --title "AWS Compute Manager v1.1.0" \
  --notes "Release notes here..." \
  path/to/binary1 \
  path/to/binary2
```

### Upload Additional Assets
```bash
gh release upload v1.0.0 path/to/new/file.zip
```

### Edit Release
```bash
gh release edit v1.0.0 --notes "Updated notes"
```

### Delete Release
```bash
gh release delete v1.0.0 --yes
```

## Release Workflow

1. **Update version** in `package.json`
2. **Build binaries**: `npm run build-all`
3. **Create release**: Use the quick command above
4. **Verify**: `gh release view vX.X.X --web`

## Automation Options

- Use GitHub Actions to auto-build and release on version tags
- Create pre-releases for testing: `--prerelease` flag
- Draft releases for review: `--draft` flag
