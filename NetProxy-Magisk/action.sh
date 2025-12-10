#!/system/bin/sh

MODDIR=${0%/*}
START_SCRIPT="$MODDIR/start.sh"
STOP_SCRIPT="$MODDIR/stop.sh"

# 日志函数
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$MODDIR/xraycore/log/service.log"
}

# 检查 Xray 是否正在运行
check_xray_running() {
    PID=$(pgrep xray)
    if [ -n "$PID" ]; then
        log "Xray正在运行，PID: $PID"
        return 0  # 进程正在运行
    else
        log "Xray未运行"
        return 1  # 进程未运行
    fi
}

# 启动 Xray
start_xray() {
    log "启动 Xray..."
    sh "$START_SCRIPT"  # 调用 start.sh 来启动 Xray
}

# 停止 Xray
stop_xray() {
    log "停止 Xray..."
    sh "$STOP_SCRIPT"  # 调用 stop.sh 来停止 Xray
}

# 主逻辑
check_xray_running
if [ $? -eq 0 ]; then
    # 如果 Xray 正在运行，则停止它
    stop_xray
else
    # 如果 Xray 没有运行，则启动它
    start_xray
fi