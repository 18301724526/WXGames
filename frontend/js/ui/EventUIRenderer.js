(function (global) {
  class EventUIRenderer {
    constructor(setText) {
      this.setText = setText;
    }

    formatReward(reward) {
      if (!reward) return '事件已完成';
      const parts = [];
      if (reward.food) parts.push(`🌾 +${reward.food}`);
      if (reward.knowledge) parts.push(`📚 +${reward.knowledge}`);
      if (reward.wood) parts.push(`🪵 +${reward.wood}`);
      return parts.join(' ') || '事件已完成';
    }

    render(state) {
      this.setText('techKnowledgeRate', `${state.resources.knowledgePerSecond || 0}/s`);
      const pending = document.getElementById('pendingEventsContainer');
      const badge = document.getElementById('eventsBadge');
      if (badge) {
        badge.hidden = !state.eventQueue.length;
        badge.textContent = state.eventQueue.length > 9 ? '9+' : String(state.eventQueue.length);
      }

      if (pending) {
        if (!state.eventQueue.length) {
          pending.innerHTML = '<div class="pending-events-empty">暂无待处理事件</div>';
        } else {
          pending.innerHTML = state.eventQueue.map((event) => `
            <div class="pending-event-card ${event.type === 'special' ? 'is-special' : ''}" data-event-id="${event.id}" id="${event.id === 'evt_settlement_forest_001' ? 'event-card-special' : ''}">
              <div class="pending-event-header">${event.icon || '📜'} ${event.title}</div>
              <div class="pending-event-desc">${event.description}</div>
              <div class="pending-event-hint">点击查看详情</div>
            </div>
          `).join('');
        }
      }

      const history = document.getElementById('eventHistoryList');
      if (history) {
        if (!state.eventHistory.length) {
          history.innerHTML = '<div class="event-history-empty">暂无事件记录</div>';
        } else {
          history.innerHTML = state.eventHistory.map((event) => `
            <div class="event-history-item positive">
              <div class="event-history-emoji">${event.icon || '📜'}</div>
              <div class="event-history-info">
                <div class="event-history-title">${event.title}</div>
                <div class="event-history-result">${this.formatReward(event.selectedOptionId ? event.options?.find((item) => item.id === event.selectedOptionId)?.reward : null)}</div>
              </div>
            </div>
          `).join('');
        }
      }
    }

    open(eventData) {
      this.setText('eventModalTitle', `${eventData.icon || '📜'} ${eventData.title}`);
      this.setText('eventModalDescription', eventData.description || '');
      this.setText('eventModalReward', this.formatReward(eventData.options?.[0]?.reward));
      const modal = document.getElementById('eventModal');
      if (modal) modal.classList.add('show');
    }

    close() {
      const modal = document.getElementById('eventModal');
      if (modal) modal.classList.remove('show');
    }
  }

  global.EventUIRenderer = EventUIRenderer;
  if (typeof module !== 'undefined' && module.exports) module.exports = EventUIRenderer;
})(typeof window !== 'undefined' ? window : globalThis);
