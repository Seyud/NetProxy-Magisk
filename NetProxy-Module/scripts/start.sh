#!/system/bin/sh
set -e
set -u

readonly MODDIR="$(cd "$(dirname "$0")/.." && pwd)"
readonly LOG_FILE="$MODDIR/logs/service.log"
readonly XRAY_BIN="$MODDIR/bin/xray"
readonly STATUS_FILE="$MODDIR/config/status.yaml"
readonly XRAY_LOG_FILE="$MODDIR/logs/xray.log"
readonly UID_LIST_FILE="$MODDIR/config/uid_list.conf"
readonly DEFAULT_PORT=1080

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
# 错误退出
# Arguments:
#   $1 - 错误消息
#   $2 - 退出码（可选，默认1）
#######################################
die() {
    log "ERROR" "$1"
    exit "${2:-1}"
}

#######################################
# 从状态文件获取配置路径
# Returns:
#   配置文件路径
#######################################
get_config_path() {
    if [ ! -f "$STATUS_FILE" ]; then
        die "状态文件不存在: $STATUS_FILE" 1
    fi
    
    local config_path
    config_path=$(awk -F'"' '/^config:/ {print $2}' "$STATUS_FILE")
    
    if [ -z "$config_path" ]; then
        die "无法从状态文件解析配置路径" 1
    fi
    
    echo "$config_path"
}

#######################################
# 从配置文件提取 inbound 端口
# Arguments:
#   $1 - 配置文件路径
# Returns:
#   端口号
#######################################
get_inbound_port() {
    local config_file="$1"
    
    if [ ! -f "$config_file" ]; then
        log "WARN" "配置文件不存在: $config_file，使用默认端口 $DEFAULT_PORT"
        echo "$DEFAULT_PORT"
        return
    fi
    
    local port
    port=$(sed -n '/\"inbounds\"/,/]/p' "$config_file" | \
           grep -o '\"port\"[[:space:]]*:[[:space:]]*[0-9]*' | \
           head -n 1 | \
           grep -o '[0-9]*')
    
    if [ -z "$port" ]; then
        log "WARN" "无法解析端口，使用默认 $DEFAULT_PORT"
        echo "$DEFAULT_PORT"
    else
        log "INFO" "解析到 inbound 端口: $port"
        echo "$port"
    fi
}


#######################################
# 更新状态文件
# Arguments:
#   $1 - 配置文件路径
#######################################
update_status() {
    local config_path="$1"
    
    {
        echo "status: \"running\""
        echo "config: \"$config_path\""
    } > "$STATUS_FILE"
    
    log "INFO" "状态已更新: running, config: $config_path"
}

#######################################
# 检查 Xray 是否已运行
# Returns:
#   0 运行中, 1 未运行
#######################################
is_xray_running() {
    pgrep -f "^$XRAY_BIN" >/dev/null 2>&1
}

#######################################
# 启动 Xray 服务
#######################################
start_xray() {
    local config_path
    local tproxy_port
    
    log "INFO" "========== 开始启动 Xray 服务 =========="
    
    # 获取配置文件路径
    config_path=$(get_config_path)
    
    if [ ! -f "$config_path" ]; then
        die "配置文件不存在: $config_path" 1
    fi
    
    log "INFO" "使用配置文件: $config_path"
    
    # 启动 Xray 进程
    nohup "$XRAY_BIN" -config "$config_path" > "$XRAY_LOG_FILE" 2>&1 &
    local xray_pid=$!
    
    log "INFO" "Xray 进程已启动, PID: $xray_pid"
    
    # 等待进程稳定
    sleep 1
    
    # 验证进程是否仍在运行
    if ! kill -0 "$xray_pid" 2>/dev/null; then
        die "Xray 进程启动后立即退出，请检查配置" 1
    fi
    
    # 获取端口并配置 TProxy
    tproxy_port=$(get_inbound_port "$config_path")
    "$MODDIR/scripts/tproxy.sh" enable "$tproxy_port"
    
    # 更新状态
    update_status "$config_path"
    
    log "INFO" "========== Xray 服务启动完成 =========="
}

# 主流程
if is_xray_running; then
    log "WARN" "Xray 已在运行，跳过启动"
    exit 0
fi

start_xray
