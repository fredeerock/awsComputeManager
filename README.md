# AWS Compute Manager

A simple macOS application built with Electron that allows you to easily start and stop your AWS EC2 instances.

## Features

- 🚀 Simple, intuitive GUI for managing EC2 instances
- ⚡ Quick start/stop functionality
- ⏰ **Auto-stop scheduling** - Set instances to automatically stop after a specified time
- 📊 Real-time instance status monitoring
- 🔐 Secure AWS credential management
- 📱 Modern, responsive design
- 📝 Activity logging

## Prerequisites

- Node.js (v16 or higher)
- AWS Account with EC2 instances
- AWS Access Key ID and Secret Access Key

## Setup Instructions

### 1. Install Dependencies

```bash
cd /Users/dostrenko/Documents/devwork/awsComputeManager
npm install
```

### 2. AWS Credentials Setup

You'll need AWS credentials with EC2 permissions. You can either:

**Option A: Use existing AWS credentials**
- Use your existing AWS Access Key ID and Secret Access Key

**Option B: Create new IAM user (Recommended)**
1. Go to AWS IAM Console
2. Create a new user with programmatic access
3. Attach the following policy (or use `AmazonEC2FullAccess` for simplicity):

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "ec2:DescribeInstances",
                "ec2:StartInstances",
                "ec2:StopInstances",
                "cloudwatch:PutMetricAlarm",
                "cloudwatch:DeleteAlarms",
                "cloudwatch:DescribeAlarms"
            ],
            "Resource": "*"
        }
    ]
}
```

### 3. Get Your Instance ID

1. Go to AWS EC2 Console
2. Find your instance
3. Copy the Instance ID (format: `i-1234567890abcdef0`)

## Running the Application

### Development Mode
```bash
npm run dev
```

### Production Mode
```bash
npm start
```

### Build for Distribution
```bash
npm run build-mac
```

This will create a `.dmg` file in the `dist` folder that you can install on macOS.

## Usage

1. **Configure AWS**: On first launch, enter your AWS region, Access Key ID, and Secret Access Key
2. **Browse Instances**: Your instances will automatically load and display as cards
3. **Select Instance**: Click on any instance card to select it, or manually enter an Instance ID
4. **Start with Auto-Stop**: 
   - Click the "Start Instance" button
   - Optionally select an auto-stop time (30 minutes to 8 hours, or custom)
   - The instance will automatically stop itself after the specified time
5. **Monitor Status**: Use "Refresh Status" to see current instance state
6. **Manual Stop**: Use the "Stop" button to immediately stop the instance

### Auto-Stop Feature

The auto-stop feature uses AWS CloudWatch alarms to automatically stop instances after a specified time. This means:
- ✅ The instance stops itself automatically - no need to keep the app running
- ✅ Uses AWS native scheduling with CloudWatch alarms
- ✅ Works even if you close the app after starting the instance
- ✅ No additional instance configuration required
- ✅ No IAM roles needed on instances

## Security Notes

- Credentials are stored in memory only while the app is running
- The app uses AWS SDK v3 with secure credential handling
- No credentials are saved to disk

## Supported Instance States

- **Running**: Instance is active and can be stopped
- **Stopped**: Instance is stopped and can be started  
- **Pending**: Instance is starting up
- **Stopping**: Instance is shutting down

## Troubleshooting

### "AWS not configured" error
- Make sure you've entered valid AWS credentials
- Check that your credentials have EC2 permissions

### "Instance not found" error
- Verify the Instance ID is correct
- Ensure the instance exists in the selected region
- Check that your credentials have permission to access the instance

### Connection issues
- Verify your internet connection
- Check AWS service status
- Ensure the selected region is correct

## File Structure

```
awsComputeManager/
├── src/
│   ├── main.js          # Electron main process
│   ├── preload.js       # Preload script for security
│   ├── renderer.js      # Frontend JavaScript
│   ├── index.html       # Main UI
│   └── styles.css       # Styling
├── package.json         # Dependencies and scripts
└── README.md           # This file
```

## License

MIT License - feel free to modify and distribute as needed.
