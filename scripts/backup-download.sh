#!/bin/bash
# 从服务器下载最新备份到本地（异地备份）
# 用法: ./scripts/backup-download.sh

LOCAL_BACKUP_DIR="./backups"
SERVER="root@118.31.237.111"
REMOTE_DIR="/opt/chess-edu/backups"

mkdir -p "$LOCAL_BACKUP_DIR"

echo "=== 下载最新备份 ==="
# 下载最新的日备份
LATEST=$(ssh $SERVER "ls -t $REMOTE_DIR/daily/*.db.gz 2>/dev/null | head -1")
if [ -n "$LATEST" ]; then
    scp "$SERVER:$LATEST" "$LOCAL_BACKUP_DIR/"
    echo "Downloaded: $(basename $LATEST)"
else
    echo "No daily backup found"
fi

# 下载最新的周备份（如果有）
WEEKLY=$(ssh $SERVER "ls -t $REMOTE_DIR/weekly/*.db.gz 2>/dev/null | head -1")
if [ -n "$WEEKLY" ]; then
    scp "$SERVER:$WEEKLY" "$LOCAL_BACKUP_DIR/"
    echo "Downloaded: $(basename $WEEKLY)"
fi

echo ""
echo "=== 本地备份 ==="
ls -lh "$LOCAL_BACKUP_DIR/"*.db.gz 2>/dev/null || echo "No local backups"

echo ""
echo "=== 服务器备份状态 ==="
ssh $SERVER "tail -5 $REMOTE_DIR/backup.log"
