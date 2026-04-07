#!/bin/bash
# 从备份恢复数据库
# 用法: ./scripts/backup-restore.sh [backup_file.db.gz]
# 不传参数则列出可用备份让你选

SERVER="root@118.31.237.111"
REMOTE_DB="/opt/chess-edu/backend/data.db"
REMOTE_BACKUP_DIR="/opt/chess-edu/backups"

if [ -z "$1" ]; then
    echo "=== 可用备份（服务器端）==="
    echo ""
    echo "--- 日备份 ---"
    ssh $SERVER "ls -lh $REMOTE_BACKUP_DIR/daily/*.db.gz 2>/dev/null"
    echo ""
    echo "--- 周备份 ---"
    ssh $SERVER "ls -lh $REMOTE_BACKUP_DIR/weekly/*.db.gz 2>/dev/null"
    echo ""
    echo "--- 月备份 ---"
    ssh $SERVER "ls -lh $REMOTE_BACKUP_DIR/monthly/*.db.gz 2>/dev/null"
    echo ""
    echo "用法: $0 <backup_filename>"
    echo "例如: $0 daily/data_20260407_030001.db.gz"
    exit 0
fi

BACKUP_FILE="$1"

echo "⚠️  即将用备份恢复数据库，当前数据将被覆盖！"
echo "备份文件: $BACKUP_FILE"
read -p "确认恢复？(yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo "取消恢复"
    exit 0
fi

echo "1. 停止服务..."
ssh $SERVER "systemctl stop chess-edu"

echo "2. 备份当前数据库..."
ssh $SERVER "cp $REMOTE_DB ${REMOTE_DB}.before_restore"

echo "3. 恢复备份..."
ssh $SERVER "cd $REMOTE_BACKUP_DIR && gunzip -k ${BACKUP_FILE} -c > $REMOTE_DB"

echo "4. 验证..."
INTEGRITY=$(ssh $SERVER "sqlite3 $REMOTE_DB 'PRAGMA integrity_check'")
echo "完整性检查: $INTEGRITY"

echo "5. 重启服务..."
ssh $SERVER "systemctl start chess-edu"
sleep 3

echo "6. 验证服务..."
HTTP_CODE=$(curl -s -o /dev/null -w '%{http_code}' http://118.31.237.111/chess/api/v1/auth/login -H 'Content-Type: application/json' -d '{"username":"admin","password":"admin"}')
echo "API 状态: HTTP $HTTP_CODE"

if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "401" ]; then
    echo "✅ 恢复成功"
else
    echo "❌ 恢复后服务异常，回滚到恢复前的数据..."
    ssh $SERVER "cp ${REMOTE_DB}.before_restore $REMOTE_DB && systemctl restart chess-edu"
    echo "已回滚"
fi
