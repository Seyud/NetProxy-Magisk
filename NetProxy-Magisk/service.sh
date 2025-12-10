#!/system/bin/sh

# 等待系统开机完成
until [ "$(getprop sys.boot_completed)" = 1 ]; do
    sleep 1
done

# 等待存储挂载完成
until [ -d "/sdcard/Android" ]; do
    sleep 1
done

MODDIR=${0%/*}

# 运行 start.sh
sh "$MODDIR/start.sh"