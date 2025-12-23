import { KSUService } from '../services/ksu-service.js';
import { toast } from '../utils/toast.js';

/**
 * UID 管理页面管理器
 */
export class UIDPageManager {
    constructor(ui) {
        this.ui = ui;
        this.allApps = [];
    }

    async update() {
        try {
            const listEl = document.getElementById('uid-list');

            // 使用当前项目数量作为骨架屏数量，避免布局偏移
            const currentCount = listEl.children.length > 0 ? listEl.children.length : 1;

            // 显示骨架屏
            this.ui.showSkeleton(listEl, currentCount);

            const uids = await KSUService.getUIDList();

            if (uids.length === 0) {
                listEl.innerHTML = '<mdui-list-item><div slot="headline">暂无白名单</div><div slot="supporting-text">点击上方按钮添加应用</div></mdui-list-item>';
                return;
            }

            // 获取所有应用信息以便匹配 UID
            let allApps = [];
            try {
                allApps = await KSUService.getInstalledApps();
            } catch (e) {
                console.warn('Failed to load app info:', e);
            }

            // 创建 UID 到应用的映射
            const uidToApp = {};
            allApps.forEach(app => {
                uidToApp[app.uid] = app;
            });

            const observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const item = entry.target;
                        const img = item.querySelector('img.app-icon[data-package-name]');
                        if (img) {
                            const packageName = img.dataset.packageName;
                            if (packageName && !img.src) {
                                KSUService.loadAppIcon(packageName).then(base64 => {
                                    if (base64) {
                                        img.src = base64;
                                        img.style.display = 'block';
                                        const placeholder = item.querySelector('mdui-icon[slot="icon"]');
                                        if (placeholder) {
                                            placeholder.style.display = 'none';
                                        }
                                    }
                                });
                            }
                        }
                        observer.unobserve(item);
                    }
                });
            }, {
                rootMargin: '100px',
                threshold: 0.1
            });

            listEl.innerHTML = '';
            uids.forEach(uid => {
                const item = document.createElement('mdui-list-item');
                const app = uidToApp[parseInt(uid)];

                if (app) {
                    item.setAttribute('headline', app.appLabel);
                    item.setAttribute('description', `UID: ${uid} • ${app.packageName}`);

                    if (app.icon) {
                        const iconEl = document.createElement('img');
                        iconEl.slot = 'icon';
                        iconEl.className = 'app-icon';
                        iconEl.src = app.icon;
                        iconEl.onerror = function () {
                            this.style.display = 'none';
                            const icon = document.createElement('mdui-icon');
                            icon.slot = 'icon';
                            icon.setAttribute('name', 'android');
                            this.parentElement.insertBefore(icon, this);
                        };
                        item.appendChild(iconEl);
                    } else {
                        const icon = document.createElement('mdui-icon');
                        icon.slot = 'icon';
                        icon.setAttribute('name', 'android');
                        item.appendChild(icon);

                        const iconEl = document.createElement('img');
                        iconEl.slot = 'icon';
                        iconEl.className = 'app-icon';
                        iconEl.dataset.packageName = app.packageName;
                        iconEl.style.display = 'none';
                        item.appendChild(iconEl);
                        observer.observe(item);
                    }
                } else {
                    item.setAttribute('headline', `UID: ${uid}`);
                    item.setAttribute('description', '应用 UID 白名单');
                    item.setAttribute('icon', 'person');
                }

                // 添加删除按钮
                const deleteBtn = document.createElement('mdui-button-icon');
                deleteBtn.slot = 'end-icon';
                deleteBtn.setAttribute('icon', 'delete');
                deleteBtn.style.color = 'var(--mdui-color-error)';
                deleteBtn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    const appName = app ? app.appLabel : `UID ${uid}`;
                    await this.deleteUID(uid, appName);
                });
                item.appendChild(deleteBtn);

                listEl.appendChild(item);
            });
        } catch (error) {
            console.error('Update UID page failed:', error);
        }
    }

    async deleteUID(uid, appName) {
        if (await this.ui.confirm(`确定要删除 ${appName} 吗？`)) {
            try {
                await KSUService.removeUID(uid);
                toast('已删除');
                this.update();
            } catch (error) {
                toast('删除失败: ' + error.message, true);
            }
        }
    }

    async showAppSelector() {
        const dialog = document.getElementById('app-selector-dialog');
        const listEl = document.getElementById('app-selector-list');

        dialog.open = true;

        // 显示骨架屏
        this.ui.showSkeleton(listEl, 5);

        try {
            this.allApps = await KSUService.getInstalledApps();
            this.renderAppList(this.allApps);
        } catch (error) {
            listEl.innerHTML = '<mdui-list-item><div slot="headline">加载失败</div></mdui-list-item>';
            toast('加载应用列表失败: ' + error.message, true);
        }
    }

    renderAppList(apps) {
        // 清空之前的图标加载队列，优先加载当前列表的图标
        KSUService.clearIconLoadQueue();

        const listEl = document.getElementById('app-selector-list');

        if (apps.length === 0) {
            listEl.innerHTML = '<mdui-list-item><div slot="headline">没有找到应用</div></mdui-list-item>';
            return;
        }

        listEl.innerHTML = '';

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const item = entry.target;
                    const img = item.querySelector('img.app-icon[data-package-name]');
                    if (img) {
                        const packageName = img.dataset.packageName;
                        if (packageName && !img.src) {
                            KSUService.loadAppIcon(packageName).then(base64 => {
                                if (base64) {
                                    img.src = base64;
                                    img.style.display = 'block';
                                    const placeholder = item.querySelector('mdui-icon[slot="icon"]');
                                    if (placeholder) {
                                        placeholder.style.display = 'none';
                                    }
                                }
                            });
                        }
                    }
                    observer.unobserve(item);
                }
            });
        }, {
            rootMargin: '100px',
            threshold: 0.1
        });

        apps.forEach(app => {
            const item = document.createElement('mdui-list-item');
            item.setAttribute('clickable', '');
            item.setAttribute('headline', app.appLabel);
            item.setAttribute('description', `UID: ${app.uid}`);

            // 添加应用图标
            if (app.icon) {
                const iconEl = document.createElement('img');
                iconEl.slot = 'icon';
                iconEl.className = 'app-icon';
                iconEl.src = app.icon;
                iconEl.onerror = function () {
                    this.style.display = 'none';
                    const icon = document.createElement('mdui-icon');
                    icon.slot = 'icon';
                    icon.setAttribute('name', 'android');
                    this.parentElement.insertBefore(icon, this);
                };
                item.appendChild(iconEl);
            } else {
                const icon = document.createElement('mdui-icon');
                icon.slot = 'icon';
                icon.setAttribute('name', 'android');
                item.appendChild(icon);

                const iconEl = document.createElement('img');
                iconEl.slot = 'icon';
                iconEl.className = 'app-icon';
                iconEl.dataset.packageName = app.packageName;
                iconEl.style.display = 'none';
                item.appendChild(iconEl);
                observer.observe(item);
            }

            item.addEventListener('click', async () => {
                await this.addApp(app);
            });

            listEl.appendChild(item);
        });
    }

    async addApp(app) {
        try {
            await KSUService.addUID(app.uid.toString());

            // 检查服务是否运行，如果运行则即时应用iptables规则
            const { status } = await KSUService.getStatus();
            if (status === 'running') {
                const result = await KSUService.applyUIDIptables(app.uid.toString());
                if (result.success) {
                    toast(`已添加 ${app.appLabel} 并即时生效`);
                } else {
                    toast(`已添加 ${app.appLabel}，但规则应用失败`);
                }
            } else {
                toast(`已添加 ${app.appLabel}`);
            }

            document.getElementById('app-selector-dialog').open = false;
            this.update();
        } catch (error) {
            if (error.message.includes('已存在')) {
                toast('该应用已在白名单中');
            } else {
                toast('添加失败: ' + error.message, true);
            }
        }
    }

    filterApps(query) {
        if (!this.allApps) return;

        const filtered = this.allApps.filter(app =>
            app.appLabel.toLowerCase().includes(query.toLowerCase()) ||
            app.packageName.toLowerCase().includes(query.toLowerCase()) ||
            app.uid.toString().includes(query)
        );

        this.renderAppList(filtered);
    }
}

