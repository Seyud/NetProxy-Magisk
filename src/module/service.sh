#!/system/bin/sh
set -e

readonly MAX_WAIT=60
readonly MODDIR="${0%/*}"
readonly MODULE_CONF="$MODDIR/config/module.conf"
readonly LOG_FILE="$MODDIR/logs/service.log"

#######################################
# 日志函数
#######################################
log() {
    local level="$1"
    local msg="$2"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$timestamp] [$level] $msg" >> "$LOG_FILE"
}

#######################################
# 加载模块配置
#######################################
load_module_config() {
    # 默认值
    AUTO_START=1
    ONEPLUS_A16_FIX=1
    
    if [ -f "$MODULE_CONF" ]; then
        . "$MODULE_CONF"
        log "INFO" "模块配置已加载"
    else
        log "WARN" "模块配置文件不存在，使用默认值"
    fi
}

#######################################
# 等待系统启动完成
# Returns:
#   0 成功, 1 超时
#######################################
wait_for_boot() {
    local count=0
    
    log "INFO" "等待系统启动完成..."
    
    # 等待系统开机完成
    while [ "$(getprop sys.boot_completed)" != "1" ]; do
        sleep 1
        count=$((count + 1))
        [ "$count" -ge "$MAX_WAIT" ] && return 1
    done
    log "INFO" "系统启动完成 (耗时 ${count}s)"
    
    # 等待存储挂载完成
    count=0
    while [ ! -d "/sdcard/Android" ]; do
        sleep 1
        count=$((count + 1))
        [ "$count" -ge "$MAX_WAIT" ] && return 1
    done
    log "INFO" "存储挂载完成"
    
    return 0
}

#######################################
# 检测设备并执行特定脚本
#######################################
check_device_specific() {
    # 检查是否启用 OnePlus A16 修复
    if [ "$ONEPLUS_A16_FIX" != "1" ]; then
        log "INFO" "OnePlus A16 修复已禁用"
        return 0
    fi
    
    local brand=$(getprop ro.product.brand)
    local android_version=$(getprop ro.build.version.release)
    
    log "INFO" "设备信息: $brand Android $android_version"
    
    # OnePlus + Android 16 需要清理 REJECT 规则
    if [ "$brand" = "OnePlus" ] && [ "$android_version" = "16" ]; then
        log "INFO" "检测到 OnePlus Android 16，执行兼容修复"
        if [ -f "$MODDIR/scripts/utils/oneplus_a16_fix.sh" ]; then
            sh "$MODDIR/scripts/utils/oneplus_a16_fix.sh"
            log "INFO" "OnePlus A16 修复执行完成"
        else
            log "WARN" "修复脚本不存在"
        fi
    fi
}

# 确保日志目录存在
mkdir -p "$MODDIR/logs"

# 主流程
log "INFO" "========== NetProxy 服务启动 =========="
load_module_config

if wait_for_boot; then
    # 检查是否启用开机自启
    if [ "$AUTO_START" = "1" ]; then
        log "INFO" "开始启动服务..."
        sh "$MODDIR/scripts/core/start.sh"
        log "INFO" "服务启动完成"
    else
        log "INFO" "开机自启已禁用，跳过启动"
    fi
    
    # 执行设备特定脚本
    check_device_specific
    log "INFO" "========== 服务启动流程结束 =========="
else
    log "ERROR" "系统启动超时，无法启动 NetProxy"
    exit 1
fi