#!/system/bin/sh

SKIPUNZIP=1

# 设置 xraycore 配置目录变量
CONFIG_DIR="/data/adb/modules/netproxy/xraycore/config"

# 打印开始信息
ui_print "开始安装..."

# 检查 CONFIG_DIR 目录是否为空
if [ "$(ls -A "$CONFIG_DIR")" ]; then
    # 如果目录非空，先备份 config 目录到 TMPDIR
    ui_print "目录 $CONFIG_DIR 非空，开始备份..."
    cp -r "$CONFIG_DIR" "$TMPDIR" >/dev/null 2>&1

    # 解压并排除 xraycore/config  
    ui_print "解压 $ZIPFILE 并排除 xraycore/config..."
    unzip -o "$ZIPFILE" -x "xraycore/config/*" -d "$MODPATH" >/dev/null 2>&1  

    # 恢复备份的 config 目录，注意只恢复 TMPDIR 下的内容
    ui_print "恢复备份的 config 目录..."
    cp -r "$TMPDIR/config" "$MODPATH/xraycore/" >/dev/null 2>&1
else
    # 如果目录为空，直接解压整个 ZIP 文件
    ui_print "目录 $CONFIG_DIR 为空，直接解压 $ZIPFILE..."
    unzip -o "$ZIPFILE" -d "$MODPATH" >/dev/null 2>&1
fi

# 设置文件可执行权限
ui_print "正在设置 xray, start.sh 和 stop.sh 文件的可执行权限..."
set_perm_recursive "$MODPATH/xraycore/xray" 0 0 0755 0755
set_perm_recursive "$MODPATH/start.sh" 0 0 0755 0755
set_perm_recursive "$MODPATH/stop.sh" 0 0 0755 0755

# 打印安装完毕信息
ui_print "安装脚本执行完毕。"