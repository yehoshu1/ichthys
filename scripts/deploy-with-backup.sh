#!/bin/bash
#
# Safe Deployment Script with Database Backup
#
# Usage: ./scripts/deploy-with-backup.sh
# 
# This script:
# 1. Creates a backup of the database
# 2. Applies schema changes (db:push)
# 3. Builds the application
# 4. Reports status

set -e  # Exit on error

echo "🚀 Starting safe deployment with Bun..."
echo ""

# Step 1: Create backup
echo "📦 Step 1: Creating database backup..."
bun run db:backup
if [ $? -ne 0 ]; then
    echo "❌ Backup failed! Aborting deployment."
    exit 1
fi
echo ""

# Step 2: Apply database migrations
echo "🗄️  Step 2: Applying database schema changes..."
bun run db:push
if [ $? -ne 0 ]; then
    echo "❌ Database migration failed!"
    echo "💡 You can restore from backup using: bun run db:restore"
    exit 1
fi
echo ""

# Step 3: Build the application
echo "🔨 Step 3: Building application..."
bun run build
if [ $? -ne 0 ]; then
    echo "❌ Build failed!"
    exit 1
fi
echo ""

# Step 4: Build dashboard
echo "🎨 Step 4: Building dashboard..."
bun run dashboard:build
if [ $? -ne 0 ]; then
    echo "❌ Dashboard build failed!"
    exit 1
fi
echo ""

echo "✅ Deployment complete!"
echo ""
echo "📝 Next steps:"
echo "   - Test the application"
echo "   - If issues occur, restore with: bun run db:restore"
echo "   - List backups: bun run db:backup:list"
