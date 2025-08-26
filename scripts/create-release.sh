#!/bin/bash
# GitHub Release Script for AWS Compute Manager

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 AWS Compute Manager Release Creator${NC}"
echo ""

# Get version from package.json
VERSION=$(node -p "require('./package.json').version")
TAG="v$VERSION"

echo -e "${YELLOW}Version:${NC} $VERSION"
echo -e "${YELLOW}Tag:${NC} $TAG"
echo ""

# Check if dist folder exists
if [ ! -d "dist" ]; then
    echo -e "${RED}❌ dist folder not found. Please run 'npm run build-all' first.${NC}"
    exit 1
fi

# Check if binaries exist
BINARIES=(
    "dist/AWS Compute Manager-${VERSION}.dmg"
    "dist/AWS Compute Manager-${VERSION}-arm64.dmg"
    "dist/AWS Compute Manager Setup ${VERSION}.exe"
    "dist/AWS Compute Manager-${VERSION}-portable.exe"
)

echo -e "${BLUE}📦 Checking for binaries...${NC}"
for binary in "${BINARIES[@]}"; do
    if [ -f "$binary" ]; then
        echo -e "${GREEN}✓${NC} Found: $(basename "$binary")"
    else
        echo -e "${YELLOW}⚠${NC}  Missing: $(basename "$binary")"
    fi
done
echo ""

# Create release notes
if [ -f "RELEASE_NOTES_TEMPLATE.md" ]; then
    # Use template and replace version
    RELEASE_NOTES=$(sed "s/v1.0.0/v$VERSION/g" RELEASE_NOTES_TEMPLATE.md)
else
    # Fallback to original notes
    RELEASE_NOTES="## AWS Compute Manager v$VERSION

### 🚀 Features
- **Cross-Platform Support**: Universal macOS (Intel + Apple Silicon) and Windows binaries
- **EC2 Instance Management**: Start, stop, and terminate AWS EC2 instances with visual interface
- **Spot Instance Support**: Proper handling of spot instances with terminate functionality
- **Auto-Stop Features**: CloudWatch-based time limits and CPU idle detection
- **Settings Persistence**: Remembers AWS credentials and region between sessions

### �️ Security Notice for macOS Users

**You may see a warning: \"Apple could not verify AWS Compute Manager is free of malware\"**

This is normal for unsigned applications. To resolve:

**Option 1 (Recommended):**
1. Right-click on \"AWS Compute Manager.app\"
2. Select \"Open\" from the context menu
3. Click \"Open\" in the security dialog

**Option 2:**
1. Go to System Settings → Privacy & Security
2. Find the notification about the blocked app
3. Click \"Open Anyway\"

This app is open source and safe to use."
fi

echo -e "${BLUE}📝 Release notes preview:${NC}"
echo "$RELEASE_NOTES" | head -10
echo "..."
echo ""

# Confirm release creation
read -p "Create release '$TAG' with the above binaries? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Release cancelled."
    exit 1
fi

echo -e "${BLUE}🚀 Creating GitHub release...${NC}"

# Create the release
gh release create "$TAG" \
    --title "AWS Compute Manager v$VERSION" \
    --notes "$RELEASE_NOTES" \
    --draft=false \
    --prerelease=false \
    "dist/AWS Compute Manager-${VERSION}.dmg#macOS Universal Installer (DMG)" \
    "dist/AWS Compute Manager-${VERSION}-arm64.dmg#macOS Apple Silicon Installer (DMG)" \
    "dist/AWS Compute Manager Setup ${VERSION}.exe#Windows Installer (EXE)" \
    "dist/AWS Compute Manager-${VERSION}-portable.exe#Windows Portable (EXE)"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Release created successfully!${NC}"
    echo ""
    echo -e "${BLUE}🌐 View your release at:${NC}"
    gh release view "$TAG" --web
else
    echo -e "${RED}❌ Failed to create release.${NC}"
    exit 1
fi
