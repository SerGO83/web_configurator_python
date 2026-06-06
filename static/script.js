document.addEventListener('DOMContentLoaded', () => {
    
    // === ЕДИНЫЕ КОНСТАНТЫ ДЛЯ ТЕКСТА СОСТОЯНИЯ ===
    // Меняем текст только здесь, и он поменяется везде
    const TEXT_ON = "[ ВКЛ ]";
    const TEXT_OFF = "[ ВЫКЛ ]";
    // ==============================================

    function setOfflineMode(isOffline) {
        const banner = document.getElementById('offline-banner');
        const panels = document.querySelectorAll('.panel');
        
        if (isOffline) {
            banner.classList.add('visible');
            panels.forEach(p => p.classList.add('offline'));
        } else {
            banner.classList.remove('visible');
            panels.forEach(p => p.classList.remove('offline'));
        }
    }

    function sendUpdate(varId, payload, uiState) {
        fetch('/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: varId, ...payload })
        })
        .then(res => {
            if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
            return res.json();
        })
        .then(data => {
            if (data.status === 'success') {
                setOfflineMode(false);
                
                if (data.type === 'analog') {
                    const d = data.data;
                    const slider = document.getElementById(`slider-${varId}`);
                    slider.value = d.value;
                    slider.min = d.min;
                    slider.max = d.max;
                    document.getElementById(`display-${varId}`).textContent = d.value;
                    document.getElementById(`min-${varId}`).value = d.min;
                    document.getElementById(`max-${varId}`).value = d.max;
                } 
                else if (data.type === 'digital') {
                    const isActive = (data.value === 1);
                    document.getElementById(`toggle-${varId}`).checked = isActive;
                    const display = document.getElementById(`d-display-${varId}`);
                    
                    // ИСПОЛЬЗУЕМ КОНСТАНТУ
                    display.textContent = isActive ? TEXT_ON : TEXT_OFF;
                    display.className = `value-display ${isActive ? 'active' : 'inactive'}`;
                }
            } else {
                revertUI(uiState);
            }
        })
        .catch(err => {
            console.error('Ошибка связи с сервером:', err);
            setOfflineMode(true);
            revertUI(uiState);
        });
    }

    function revertUI(state) {
        if (state.slider) state.slider.value = state.fallbackValue;
        if (state.display) state.display.textContent = state.fallbackValue;
        if (state.input) state.input.value = state.fallbackValue;
        if (state.toggle) {
            state.toggle.checked = state.fallbackValue;
            const varId = state.toggle.dataset.var;
            const display = document.getElementById(`d-display-${varId}`);
            const isActive = state.fallbackValue;
            
            // ИСПОЛЬЗУЕМ КОНСТАНТУ
            display.textContent = isActive ? TEXT_ON : TEXT_OFF;
            display.className = `value-display ${isActive ? 'active' : 'inactive'}`;
        }
    }

    // === АНАЛОГОВЫЕ ПОЛЗУНКИ ===
    document.querySelectorAll('input[type="range"][data-var]').forEach(slider => {
        slider.addEventListener('input', function() {
            const varId = this.dataset.var;
            const display = document.getElementById(`display-${varId}`);
            const lastGoodValue = display.textContent;

            sendUpdate(varId, { value: this.value }, {
                slider: this,
                display: display,
                fallbackValue: lastGoodValue
            });
        });

        slider.addEventListener('wheel', function(e) {
            e.preventDefault();
            const varId = this.dataset.var;
            const display = document.getElementById(`display-${varId}`);
            const lastGoodValue = display.textContent;

            let min = parseInt(this.min);
            let max = parseInt(this.max);
            let step = Math.max(1, Math.round((max - min) / 50));
            let delta = e.deltaY < 0 ? step : -step;
            let newVal = Math.max(min, Math.min(parseInt(this.value) + delta, max));
            
            this.value = newVal;
            sendUpdate(varId, { value: newVal }, {
                slider: this,
                display: display,
                fallbackValue: lastGoodValue
            });
        });
    });

    // === АНАЛОГОВЫЕ ПОЛЯ MIN/MAX ===
    document.querySelectorAll('.limit-input').forEach(input => {
        input.addEventListener('focus', function() {
            this.dataset.oldValue = this.value;
        });

        input.addEventListener('change', function() {
            const varId = this.dataset.var;
            const isMin = this.id.startsWith('min-');
            
            sendUpdate(varId, { [isMin ? 'min' : 'max']: this.value }, {
                input: this,
                fallbackValue: this.dataset.oldValue
            });
        });

        input.addEventListener('wheel', function(e) {
            e.preventDefault();
            const varId = this.dataset.var;
            const isMin = this.id.startsWith('min-');
            
            let step = parseInt(this.step) || 1;
            let delta = e.deltaY < 0 ? step : -step;
            let newVal = Math.max(0, parseInt(this.value || 0) + delta);
            
            this.value = newVal;
            sendUpdate(varId, { [isMin ? 'min' : 'max']: newVal }, {
                input: this,
                fallbackValue: this.dataset.oldValue
            });
        });
    });

    // === ЦИФРОВЫЕ ПЕРЕКЛЮЧАТЕЛИ (ТОГГЛЫ) ===
    document.querySelectorAll('.toggle-switch input[type="checkbox"]').forEach(toggle => {
        toggle.addEventListener('change', function() {
            const varId = this.dataset.var;
            sendUpdate(varId, { value: this.checked ? 1 : 0 }, {
                toggle: this,
                fallbackValue: !this.checked
            });
        });
    });

    // === ЦИФРОВЫЕ КНОПКИ ИНВЕРСИИ ===
    document.querySelectorAll('.invert-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const varId = this.dataset.var;
            const toggle = document.getElementById(`toggle-${varId}`);
            
            sendUpdate(varId, { action: 'invert' }, {
                toggle: toggle,
                fallbackValue: toggle.checked
            });
        });
    });
});