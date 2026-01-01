#!/system/bin/sh
set -e
set -u

readonly MODDIR="$(cd "$(dirname "$0")/../.." && pwd)"
readonly LOG_FILE="$MODDIR/logs/service.log"
readonly XRAY_BIN="$MODDIR/bin/xray"
readonly KILL_TIMEOUT=5
# 运行时配置快照（启动时复制的配置）
readonly TPROXY_RUNTIME_CONF="$MODDIR/logs/.tproxy_runtime.conf"
# 原始配置文件（备用）
readonly TPROXY_CONF="$MODDIR/config/tproxy.conf"

#######################################
# 记录日志
# Arguments:
#   $1 - 日志级别
#   $2 - 日志消息
#######################################
log() {
    local level="${1:-INFO}"
    local message="$2"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [$level] $message" >> "$LOG_FILE"
}

#######################################
# 终止 Xray 进程
# Returns:
#   0 成功, 1 失败
#######################################
kill_xray_process() {
    local pid
    pid=$(pidof -s "$XRAY_BIN")
    
    if [ -z "$pid" ]; then
        log "INFO" "未发现运行中的 Xray 进程"
        return 0
    fi
    
    log "INFO" "正在终止 Xray 进程 (PID: $pid)..."
    
    # 尝试优雅终止
    if kill "$pid" 2>/dev/null; then
        # 等待进程退出
        local count=0
        while kill -0 "$pid" 2>/dev/null && [ "$count" -lt "$KILL_TIMEOUT" ]; do
            sleep 1
            count=$((count + 1))
        done
        
        # 如果仍在运行，强制终止
        if kill -0 "$pid" 2>/dev/null; then
            log "WARN" "进程未响应 SIGTERM，发送 SIGKILL"
            kill -9 "$pid" 2>/dev/null || true
        fi
    fi
    
    log "INFO" "Xray 进程已终止"
    return 0
}

#######################################
# 清理 TProxy 规则
#######################################
cleanup_tproxy() {
    log "INFO" "清理 TProxy 规则..."
    
    # 优先使用运行时配置快照（启动时的配置），确保正确清理
    if [ -f "$TPROXY_RUNTIME_CONF" ]; then
        log "INFO" "使用运行时配置快照进行清理"
        TPROXY_CONFIG="$TPROXY_RUNTIME_CONF" "$MODDIR/scripts/network/tproxy.sh" stop || true
        # 清理完成后删除运行时配置
        rm -f "$TPROXY_RUNTIME_CONF"
        log "INFO" "运行时配置快照已删除"
    else
        log "WARN" "未找到运行时配置快照，使用当前配置"
        "$MODDIR/scripts/network/tproxy.sh" stop || true
    fi
    
    log "INFO" "TProxy 规则清理完成"
}

#######################################
# 停止 Xray 服务
#######################################
stop_xray() {
    log "INFO" "========== 开始停止 Xray 服务 =========="
    
    # 清理 TProxy（先清理规则避免断网）
    cleanup_tproxy
    
    # 终止进程
    kill_xray_process
    
    log "INFO" "========== Xray 服务停止完成 =========="
}

# 主流程
stop_xray
