#!/system/bin/sh

MODDIR=${0%/*}
LOG_FILE="$MODDIR/xraycore/log/service.log"
XRAY_BIN="$MODDIR/xraycore/xray"
STATUS_FILE="$MODDIR/xraycore/xray_status.yaml"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"; }

stop_xray() {
    log "开始停止 Xray 服务..."

    PID=$(pgrep -f "$XRAY_BIN")
    if [ -n "$PID" ]; then
        kill "$PID"
        log "Xray 进程已终止，PID: $PID"
    else
        log "未发现运行中的 Xray 进程"
    fi

    log "删除 iptables NAT 规则..."

    # 删除 OUTPUT -> XRAY
    iptables -t nat -D OUTPUT -p tcp -j XRAY 2>/dev/null

    # 删除 root UID RULE
    iptables -t nat -D OUTPUT -p tcp -m owner --uid-owner 0 -j RETURN 2>/dev/null

    # 删除 UID 白名单规则（扫描并删除所有 RETURN）
    # 任何 RETURN 都是启动脚本加的白名单规则
    while iptables -t nat -C OUTPUT -j RETURN >/dev/null 2>&1; do
        iptables -t nat -D OUTPUT -j RETURN >/dev/null 2>&1
    done

    # 清空并删除 XRAY 链
    iptables -t nat -F XRAY 2>/dev/null
    iptables -t nat -X XRAY 2>/dev/null

    log "iptables NAT 规则已清理"

    # 更新状态文件
    CONFIG_PATH=$(awk '/config:/ {print $2}' "$STATUS_FILE" | tr -d '"')
    echo "status: \"stopped\"" > "$STATUS_FILE"
    echo "config: \"$CONFIG_PATH\"" >> "$STATUS_FILE"
    log "更新状态文件: Xray已停止"
}

stop_xray
