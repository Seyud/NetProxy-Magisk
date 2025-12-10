#!/system/bin/sh

MODDIR=${0%/*}
LOG_FILE="$MODDIR/xraycore/log/service.log"
XRAY_BIN="$MODDIR/xraycore/xray"
STATUS_FILE="$MODDIR/xraycore/xray_status.yaml"
XRAY_LOG_FILE="$MODDIR/xraycore/log/xray.log"
UID_LIST_FILE="$MODDIR/xraycore/uid_list.conf"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"; }

# ---------------------------
# 从 inbounds 中提取 port
# ---------------------------
get_nat_port() {
    local config_path
    config_path=$(awk -F\" '/config:/ {print $2}' "$STATUS_FILE")

    if [ ! -f "$config_path" ]; then
        NAT_PORT=1080
        log "配置文件不存在: $config_path，使用默认端口 $NAT_PORT"
        return
    fi

    # 提取 inbounds 数组内部的 port
    local port
    port=$(sed -n '/"inbounds"[[:space:]]*:/,/]/p' "$config_path" \
        | grep -o '"port"[[:space:]]*:[[:space:]]*[0-9]*' \
        | head -n 1 \
        | grep -o '[0-9]*')

    if [ -z "$port" ]; then
        NAT_PORT=1080
        log "无法在 inbounds 中解析 port，使用默认 $NAT_PORT"
    else
        NAT_PORT="$port"
        log "成功从 inbounds 解析 NAT 端口: $NAT_PORT"
    fi
}

# ---------------------------
# 更新状态文件
# ---------------------------
update_status() {
    echo "status: \"running\"" > "$STATUS_FILE"
    echo "config: \"$1\"" >> "$STATUS_FILE"
    log "更新状态文件: 运行配置: $1"
}

# ---------------------------
# 设置 iptables NAT
# ---------------------------
apply_iptables() {
    log "设置 iptables NAT 规则..."

    # 创建或清空 XRAY 链
    iptables -t nat -N XRAY 2>/dev/null || iptables -t nat -F XRAY

    # root UID 直连
    iptables -t nat -I OUTPUT -p tcp -m owner --uid-owner 0 -j RETURN
    log "添加 root UID 直连规则"

    log "从 $UID_LIST_FILE 读取 UID 白名单..."
    if [ -f "$UID_LIST_FILE" ] && [ -s "$UID_LIST_FILE" ]; then
        while IFS= read -r UID || [ -n "$UID" ]; do
            UID=$(echo "$UID" | tr -d '\r' | tr -d ' ')
            [ -z "$UID" ] && continue
            case "$UID" in *[!0-9]*) continue ;; esac

            iptables -t nat -I OUTPUT -p tcp -m owner --uid-owner "$UID" -j RETURN
            log "添加 UID 直连: $UID"
        done < "$UID_LIST_FILE"
    fi

    # NAT 转发到 Xray inbound 端口
    iptables -t nat -A XRAY -p tcp -j REDIRECT --to-ports $NAT_PORT
    log "添加 REDIRECT 到端口 $NAT_PORT"

    # OUTPUT 全部挂到 XRAY 链
    iptables -t nat -A OUTPUT -p tcp -j XRAY
    log "挂接 OUTPUT → XRAY 完成"
}

# ---------------------------
# 启动 Xray 服务
# ---------------------------
start_xray() {
    log "开始启动 Xray 服务..."

    CONFIG_PATH=$(awk -F\" '/config:/ {print $2}' "$STATUS_FILE")
    [ ! -f "$CONFIG_PATH" ] && log "配置不存在: $CONFIG_PATH" && exit 1

    nohup $XRAY_BIN -config "$CONFIG_PATH" > "$XRAY_LOG_FILE" 2>&1 &
    log "Xray 启动成功, PID: $!"

    update_status "$CONFIG_PATH"
    get_nat_port
    apply_iptables
    log "iptables NAT 分应用代理初始化完成"
}

# ---------------------------
# 检查是否已运行
# ---------------------------
check_xray_running() {
    pgrep -f "$XRAY_BIN" >/dev/null 2>&1
}

# ---------------------------
# 主流程
# ---------------------------
if check_xray_running; then
    log "Xray 已在运行，不重复启动"
else
    start_xray
fi
