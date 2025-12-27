import { KSUService } from '../services/ksu-service.js';
import { toast } from '../utils/toast.js';

/**
 * 配置页面管理器
 */
export class ConfigPageManager {
    constructor(ui) {
        this.ui = ui;
    }

    /**
     * 从配置内容解析出站信息
     */
    parseOutboundInfo(content) {
        try {
            const config = JSON.parse(content);
            const outbounds = config.outbounds || [];

            // 查找第一个非 direct/freedom/blackhole 的出站
            for (const outbound of outbounds) {
                const protocol = outbound.protocol;
                if (!protocol || ['freedom', 'blackhole', 'dns'].includes(protocol)) {
                    continue;
                }

                let address = '';
                let port = '';

                // 根据协议解析地址和端口
                if (outbound.settings) {
                    // vless, vmess, trojan 使用 vnext
                    if (outbound.settings.vnext && outbound.settings.vnext[0]) {
                        address = outbound.settings.vnext[0].address || '';
                        port = outbound.settings.vnext[0].port || '';
                    }
                    // shadowsocks 使用 servers
                    else if (outbound.settings.servers && outbound.settings.servers[0]) {
                        address = outbound.settings.servers[0].address || '';
                        port = outbound.settings.servers[0].port || '';
                    }
                }

                return { protocol, address, port };
            }

            // 如果只有 freedom 类型，返回直连信息
            return { protocol: 'direct', address: '直连模式', port: '' };
        } catch (e) {
            console.warn('Failed to parse config:', e);
            return { protocol: 'unknown', address: '', port: '' };
        }
    }

    async update() {
        try {
            const listEl = document.getElementById('config-list');

            // 显示骨架屏
            this.ui.showSkeleton(listEl, 3);

            const configs = await KSUService.getConfigList();
            const { config: currentConfig } = await KSUService.getStatus();

            if (configs.length === 0) {
                listEl.innerHTML = '<mdui-list-item><div slot="headline">暂无配置文件</div></mdui-list-item>';
                return;
            }

            // 并行读取所有配置文件内容
            const configInfoPromises = configs.map(async filename => {
                try {
                    const content = await KSUService.readConfig(filename);
                    return { filename, info: this.parseOutboundInfo(content) };
                } catch (e) {
                    return { filename, info: { protocol: 'unknown', address: '', port: '' } };
                }
            });
            const configInfos = await Promise.all(configInfoPromises);
            const infoMap = new Map(configInfos.map(c => [c.filename, c.info]));

            listEl.innerHTML = '';
            configs.forEach(filename => {
                const item = document.createElement('mdui-list-item');
                item.setAttribute('clickable', '');

                // 显示名称（移除 .json 后缀）
                const displayName = filename.replace(/\.json$/i, '');
                item.setAttribute('headline', displayName);

                // 获取出站信息
                const info = infoMap.get(filename) || { protocol: 'unknown', address: '', port: '' };

                // 显示协议、地址、端口
                const description = info.port
                    ? `${info.protocol} • ${info.address}:${info.port}`
                    : `${info.protocol} • ${info.address}`;
                item.setAttribute('description', description);

                const isCurrent = filename === currentConfig;

                // 当前配置标记
                if (isCurrent) {
                    const chip = document.createElement('mdui-chip');
                    chip.slot = 'end';
                    chip.textContent = '当前';
                    chip.style.marginRight = '8px';
                    item.appendChild(chip);
                }

                // 更多按钮（三点菜单）
                const dropdown = document.createElement('mdui-dropdown');
                dropdown.setAttribute('placement', 'bottom-end');
                dropdown.slot = 'end-icon';

                const menuBtn = document.createElement('mdui-button-icon');
                menuBtn.setAttribute('slot', 'trigger');
                menuBtn.setAttribute('icon', 'more_vert');
                menuBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                });
                dropdown.appendChild(menuBtn);

                const menu = document.createElement('mdui-menu');

                // 编辑选项
                const editItem = document.createElement('mdui-menu-item');
                editItem.innerHTML = '<mdui-icon slot="icon" name="edit"></mdui-icon>编辑';
                editItem.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    dropdown.open = false;
                    await this.ui.showConfigDialog(filename);
                });
                menu.appendChild(editItem);

                // 测试选项
                const testItem = document.createElement('mdui-menu-item');
                testItem.innerHTML = '<mdui-icon slot="icon" name="speed"></mdui-icon>测试';
                testItem.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    dropdown.open = false;
                    await this.testConfig(filename, info.address, info.port);
                });
                menu.appendChild(testItem);

                // 删除选项（当前配置不可删除）
                if (!isCurrent) {
                    const deleteItem = document.createElement('mdui-menu-item');
                    deleteItem.innerHTML = '<mdui-icon slot="icon" name="delete"></mdui-icon>删除';
                    deleteItem.style.color = 'var(--mdui-color-error)';
                    deleteItem.addEventListener('click', async (e) => {
                        e.stopPropagation();
                        dropdown.open = false;
                        await this.deleteConfig(filename);
                    });
                    menu.appendChild(deleteItem);
                }

                dropdown.appendChild(menu);
                item.appendChild(dropdown);

                // 点击切换配置
                item.addEventListener('click', () => {
                    if (!isCurrent) {
                        this.switchConfig(filename);
                    }
                });

                listEl.appendChild(item);
            });
        } catch (error) {
            console.error('Update config page failed:', error);
        }
    }

    async testConfig(filename, address, port) {
        if (!address || address === '直连模式') {
            toast('直连模式无需测试');
            return;
        }

        try {
            toast('正在测试连接...');
            const latency = await KSUService.getPingLatency(address);
            toast(`${filename.replace(/\.json$/i, '')}: ${latency}`);
        } catch (error) {
            toast('测试失败: ' + error.message);
        }
    }

    async deleteConfig(filename) {
        try {
            const confirmed = await this.ui.confirm(`确定要删除配置文件 "${filename.replace(/\.json$/i, '')}" 吗？\n\n此操作不可恢复。`);

            if (!confirmed) {
                return;
            }

            const result = await KSUService.deleteConfig(filename);

            if (result && result.success) {
                toast('配置已删除');
                this.update();
            } else {
                toast('删除失败: ' + (result?.error || '未知错误'));
            }
        } catch (error) {
            console.error('deleteConfig error:', error);
            toast('删除失败: ' + error.message);
        }
    }

    async switchConfig(filename) {
        try {
            await KSUService.switchConfig(filename);
            toast('已切换到: ' + filename.replace(/\.json$/i, ''));

            await this.update();
            await this.ui.statusPage.update();
        } catch (error) {
            console.error('Switch config error:', error);
            toast('切换配置失败: ' + error.message);
        }
    }

    async showDialog(filename = null) {
        const dialog = document.getElementById('config-dialog');
        const filenameInput = document.getElementById('config-filename');
        const contentInput = document.getElementById('config-content');

        if (filename) {
            filenameInput.value = filename;
            filenameInput.disabled = true;
            const content = await KSUService.readConfig(filename);
            contentInput.value = content;
        } else {
            filenameInput.value = '';
            filenameInput.disabled = false;
            contentInput.value = JSON.stringify({
                "inbounds": [{ "port": 1080, "protocol": "socks" }],
                "outbounds": [{ "protocol": "freedom" }]
            }, null, 2);
        }

        dialog.open = true;
    }

    async saveConfig() {
        const filename = document.getElementById('config-filename').value.trim();
        const content = document.getElementById('config-content').value;

        if (!filename) {
            toast('请输入文件名');
            return;
        }

        if (!filename.endsWith('.json')) {
            toast('文件名必须以 .json 结尾');
            return;
        }

        try {
            JSON.parse(content); // 验证 JSON
            await KSUService.saveConfig(filename, content);
            toast('保存成功');
            document.getElementById('config-dialog').open = false;
            this.update();
        } catch (error) {
            toast('保存失败: ' + error.message);
        }
    }

    async importNodeLink() {
        const input = document.getElementById('node-link-input');
        const nodeLink = input.value.trim();

        if (!nodeLink) {
            toast('请输入节点链接');
            return;
        }

        const supportedProtocols = ['vless://', 'vmess://', 'trojan://', 'ss://', 'socks://', 'http://', 'https://'];
        const isValid = supportedProtocols.some(protocol => nodeLink.startsWith(protocol));

        if (!isValid) {
            toast('不支持的节点链接格式');
            return;
        }

        try {
            toast('正在导入节点...');
            const result = await KSUService.importFromNodeLink(nodeLink);

            if (result.success) {
                toast('节点导入成功');
                document.getElementById('node-link-dialog').open = false;
                input.value = '';
                this.update();
            } else {
                toast('导入失败: ' + (result.error || '未知错误'));
            }
        } catch (error) {
            console.error('Import node link error:', error);
            toast('导入失败: ' + error.message);
        }
    }
}
