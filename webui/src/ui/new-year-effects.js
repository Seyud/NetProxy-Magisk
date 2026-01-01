/**
 * 元旦特效模块 - New Year 2026 Special Effects
 * 仅在元旦期间显示（1月1日-1月3日）
 */

// 导入样式
import '../styles/new-year.css';

class NewYearEffects {
    constructor() {
        this.isEnabled = this.shouldShowEffects();
        this.bannerId = 'new-year-banner';
        this.snowContainerId = 'snowflakes-container';
    }

    /**
     * 检查是否应该显示新年特效
     * 仅在1月1日-1月3日期间显示
     */
    shouldShowEffects() {
        const now = new Date();
        const month = now.getMonth(); // 0 = January
        const day = now.getDate();

        // 1月1日-3日显示特效
        return month === 0 && day >= 1 && day <= 3;
    }

    /**
     * 初始化所有特效
     */
    init() {
        if (!this.isEnabled) {
            console.log('🎆 新年特效已过期，今年再见！');
            return;
        }

        // 检查用户是否已关闭
        if (localStorage.getItem('newYearEffectsClosed') === '2026') {
            return;
        }

        console.log('🎉 新年快乐！2026 元旦特效已启用');

        this.createBanner();
        this.createSnowflakes();
        this.setupFireworks();
    }

    /**
     * 创建新年灯笼装饰
     */
    createBanner() {
        if (document.getElementById(this.bannerId)) return;

        const lanterns = document.createElement('div');
        lanterns.id = this.bannerId;
        lanterns.className = 'new-year-lanterns';

        // 创建5个灯笼
        for (let i = 0; i < 5; i++) {
            const lantern = document.createElement('span');
            lantern.className = 'lantern';
            lantern.textContent = '🏮';

            // 第一个灯笼可以点击关闭
            if (i === 0) {
                lantern.style.position = 'relative';
                const hint = document.createElement('span');
                hint.className = 'close-hint';
                hint.textContent = '点击关闭特效';
                lantern.appendChild(hint);
                lantern.addEventListener('click', () => this.closeBanner());
            }

            lanterns.appendChild(lantern);
        }

        document.body.insertBefore(lanterns, document.body.firstChild);
    }

    /**
     * 关闭灯笼和特效
     */
    closeBanner() {
        const lanterns = document.getElementById(this.bannerId);
        if (lanterns) {
            lanterns.style.opacity = '0';
            lanterns.style.transition = 'opacity 0.3s ease-out';
            setTimeout(() => lanterns.remove(), 300);
        }

        // 记住用户选择（当年有效）
        localStorage.setItem('newYearEffectsClosed', '2026');

        // 同时移除雪花
        this.removeSnowflakes();
    }



    /**
     * 创建飘雪效果
     */
    createSnowflakes() {
        if (document.getElementById(this.snowContainerId)) return;

        const container = document.createElement('div');
        container.id = this.snowContainerId;
        container.className = 'snowflakes';
        container.setAttribute('aria-hidden', 'true');

        // 创建10个雪花
        const snowChars = ['❄', '❅', '❆', '✦', '✧'];
        for (let i = 0; i < 10; i++) {
            const snowflake = document.createElement('span');
            snowflake.className = 'snowflake';
            snowflake.textContent = snowChars[i % snowChars.length];
            container.appendChild(snowflake);
        }

        document.body.appendChild(container);
    }

    /**
     * 移除雪花
     */
    removeSnowflakes() {
        const container = document.getElementById(this.snowContainerId);
        if (container) {
            container.style.opacity = '0';
            container.style.transition = 'opacity 0.5s';
            setTimeout(() => container.remove(), 500);
        }
    }

    /**
     * 设置点击烟花效果
     */
    setupFireworks() {
        document.addEventListener('click', (e) => {
            // 仅在特定区域或情况下触发
            if (e.target.closest('.new-year-banner')) return;

            // 50% 概率触发烟花
            if (Math.random() > 0.5) return;

            this.createFirework(e.clientX, e.clientY);
        });
    }

    /**
     * 创建单个烟花爆炸效果
     */
    createFirework(x, y) {
        const firework = document.createElement('div');
        firework.className = 'firework';
        firework.style.left = x + 'px';
        firework.style.top = y + 'px';

        const colors = ['#ff6b6b', '#ffd93d', '#6bcb77', '#4d96ff', '#ff6bcb'];
        const particleCount = 12;

        for (let i = 0; i < particleCount; i++) {
            const particle = document.createElement('div');
            particle.className = 'firework-particle';

            const angle = (i / particleCount) * Math.PI * 2;
            const distance = 50 + Math.random() * 30;
            const tx = Math.cos(angle) * distance;
            const ty = Math.sin(angle) * distance;

            particle.style.setProperty('--tx', tx + 'px');
            particle.style.setProperty('--ty', ty + 'px');
            particle.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];

            firework.appendChild(particle);
        }

        document.body.appendChild(firework);

        // 动画结束后移除
        setTimeout(() => firework.remove(), 1000);
    }
}

// 导出模块
export const newYearEffects = new NewYearEffects();

// 页面加载后初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => newYearEffects.init());
} else {
    newYearEffects.init();
}
