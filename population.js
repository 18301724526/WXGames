// ==================== 人口管理系统 ====================
// 解耦提取：所有人口逻辑独立为可复用模块
// 由 app.js init() 调用 window.mountPopulationMethods(game) 挂载

window.mountPopulationMethods = function(game) {
    // --- 人口上限计算 ---
    game.applyHouseCapacity = function() {
        const ts = this.state.techState;
        const techBonus = ts?.cityState?.status === 'completed' ? 1 : 0;
        this.state.maxPop = this.state.houseCount * (4 + techBonus);
    };

    // --- 职业分配 ---
    game.assignJob = async function(job, delta) {
        if (!this.token) {
            this.assignJobLocal(job, delta);
            return;
        }

        try {
            const result = await this.apiPost('/game/action', {
                action: 'assign',
                target: job,
                count: delta
            });

            if (result.success) {
                const data = await this.apiGet('/game/state');
                if (data.gameState) this.syncFromServer(data.gameState, data.gameState?.eventQueue, data.gameState?.offlineEventLog);
                if (data.offlineIncome && (data.offlineIncome.food > 0 || data.offlineIncome.knowledge > 0)) {
                    this.showOfflineModal(data.offlineIncome, data.offlineEventLog);
                }
                this.log(`👥 +${delta} ${job}`);
            } else {
                this.log(`❌ 分配失败：${result.message}`);
                this.assignJobLocal(job, delta);
            }
        } catch (e) {
            console.error('assignJob API error:', e);
            this.assignJobLocal(job, delta);
        }
    };

    game.assignJobLocal = function(job, delta) {
        const s = this.state;
        const unassigned = s.totalPop - s.farmers - s.scholars - s.craftsmen;

        if (job === 'farmer') {
            if (delta > 0 && unassigned > 0) s.farmers++;
            else if (delta < 0 && s.farmers > 0) s.farmers--;
        } else if (job === 'scholar') {
            if (delta > 0 && unassigned > 0) s.scholars++;
            else if (delta < 0 && s.scholars > 0) s.scholars--;
        } else if (job === 'craftsman') {
            if (delta > 0 && unassigned > 0) s.craftsmen++;
            else if (delta < 0 && s.craftsmen > 0) s.craftsmen--;
        }

        this.render();
        this.save();
    };

    // --- 人口事件绑定 ---
    game.bindPopulationEvents = function() {
        if (game._populationEventsBound) return;
        game._populationEventsBound = true;
        document.querySelectorAll('.job-controls button').forEach(btn => {
            // 防重复绑定：已绑定的按钮跳过
            if (btn.dataset._popBound === 'true') return;
            btn.dataset._popBound = 'true';
            
            btn.addEventListener('click', (e) => {
                const job = e.target.dataset.job;
                const delta = e.target.classList.contains('btn-plus') ? 1 : -1;
                this.assignJob(job, delta);
            });
        });
    };

    // --- 人口渲染 ---
    game.renderPopulation = function() {
        const s = this.state;
        const unassigned = s.totalPop - s.farmers - s.scholars - s.craftsmen;

        this.setText('totalPop', s.totalPop);
        this.setText('maxPop', s.maxPop);
        this.setText('unassignedPop', unassigned >= 0 ? unassigned : 0);
        this.setText('farmerCount', s.farmers);
        this.setText('scholarCount', s.scholars);
        this.setText('craftsmanCount', s.craftsmen);
    };

    // --- 人口按钮状态更新 ---
    game.updatePopulationButtons = function() {
        const s = this.state;
        const unassigned = s.totalPop - s.farmers - s.scholars - s.craftsmen;

        document.querySelectorAll('.btn-plus').forEach(btn => {
            btn.disabled = unassigned <= 0;
        });

        const farmerMinus = document.querySelector('[data-job="farmer"].btn-minus');
        if (farmerMinus) farmerMinus.disabled = s.farmers <= 0;

        const scholarMinus = document.querySelector('[data-job="scholar"].btn-minus');
        if (scholarMinus) scholarMinus.disabled = s.scholars <= 0;

        const craftsmanMinus = document.querySelector('[data-job="craftsman"].btn-minus');
        if (craftsmanMinus) craftsmanMinus.disabled = s.craftsmen <= 0;

        // 工匠卡片显隐
        const craftsmanCard = document.getElementById('craftsmanCard');
        if (craftsmanCard) {
            craftsmanCard.style.display = s.workshopCount > 0 ? '' : 'none';
        }
    };

    console.log('[population.js] 人口管理模块已挂载');
};
