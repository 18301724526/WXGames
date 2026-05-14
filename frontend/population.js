// ==================== 人口管理系统 v3.0 ====================
// 设计原则：前端只显示，后端是唯一真相源
// app.js 只调用 mountPopulationMethods(game)，不深入内部

window.mountPopulationMethods = function(game) {
    
    // --- 人口渲染（只读，不计算）---
    game.renderPopulation = function() {
        const s = this.state;
        const pop = s.population || {}; // 优先读取后端同步的完整对象
        
        // 人口数字
        this.setText('totalPop', pop.total ?? s.totalPop ?? 0);
        this.setText('maxPop', pop.maxPop ?? s.maxPop ?? 0);
        this.setText('unassignedPop', pop.unassigned ?? 0);
        this.setText('farmerCount', pop.farmers ?? s.farmers ?? 0);
        this.setText('scholarCount', pop.scholars ?? s.scholars ?? 0);
        this.setText('craftsmanCount', pop.craftsmen ?? s.craftsmen ?? 0);
    };

    // --- 人口按钮状态更新 ---
    game.updatePopulationButtons = function() {
        const s = this.state;
        const pop = s.population || {};
        const unassigned = pop.unassigned ?? 0;
        
        // + 按钮：有未分配人口时才可点
        document.querySelectorAll('.job-controls .btn-plus').forEach(btn => {
            btn.disabled = unassigned <= 0;
        });
        
        // - 按钮：该职业有人时才可点
        document.querySelectorAll('.job-controls .btn-minus').forEach(btn => {
            const job = btn.dataset.job;
            // 后端字段名为复数形式：farmers, scholars, craftsmen
            const jobKey = job + 's';
            const count = pop[jobKey] ?? s[jobKey] ?? 0;
            btn.disabled = count <= 0;
        });
        
        // 工匠卡片显隐（有工坊才显示）
        const craftsmanCard = document.getElementById('craftsmanCard');
        if (craftsmanCard) {
            const workshopCount = s.workshopCount ?? 0;
            craftsmanCard.style.display = workshopCount > 0 ? '' : 'none';
        }
    };

    // --- 人口分配 API 调用（无本地回退）---
    game.assignJob = async function(job, delta) {
        if (!this.token) {
            this.log('❌ 请先登录');
            return;
        }

        try {
            const result = await this.apiPost('/game/action', {
                action: 'assign',
                target: job,
                count: delta
            });

            if (result.success) {
                // API 成功 → 立即拉取最新状态同步
                const data = await this.apiGet('/game/state');
                if (data.gameState) {
                    this.syncFromServer(data.gameState, data.gameState?.eventQueue, data.gameState?.offlineEventLog);
                }
                if (data.offlineIncome?.food > 0 || data.offlineIncome?.knowledge > 0) {
                    this.showOfflineModal(data.offlineIncome, data.offlineEventLog);
                }
                this.log(`👥 ${delta > 0 ? '+' : ''}${delta} ${job}`);
            } else {
                this.log(`❌ ${result.message}`);
                // 失败时拉一次状态，确保前端显示与后端一致
                const data = await this.apiGet('/game/state');
                if (data.gameState) this.syncFromServer(data.gameState);
            }
        } catch (e) {
            console.error('assignJob API error:', e);
            this.log('❌ 网络错误，人口分配失败');
            // 网络错误也拉状态对齐
            try {
                const data = await this.apiGet('/game/state');
                if (data.gameState) this.syncFromServer(data.gameState);
            } catch (_) {}
        }
    };

    // --- 事件绑定（防重复）---
    game.bindPopulationEvents = function() {
        if (game._populationEventsBound) return;
        game._populationEventsBound = true;
        
        document.querySelectorAll('.job-controls button').forEach(btn => {
            if (btn.dataset._popBound === 'true') return;
            btn.dataset._popBound = 'true';
            
            btn.addEventListener('click', (e) => {
                const job = e.target.dataset.job;
                const delta = e.target.classList.contains('btn-plus') ? 1 : -1;
                this.assignJob(job, delta);
            });
        });
    };

    console.log('[population.js] 人口管理模块 v3.0 已挂载');
};
