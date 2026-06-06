import os
import json
from flask import Flask, render_template, request, jsonify

app = Flask(__name__)

# Имя файла для хранения состояния
STATE_FILE = 'state.json'

# Значения по умолчанию (используются, если файла еще нет)
DEFAULT_ANALOG = {
    'Скорость': {'value': 25, 'min': 0, 'max': 100},
    'Мощность': {'value': 50, 'min': 0, 'max': 100},
    'Температура': {'value': 75, 'min': 0, 'max': 100}
}
DEFAULT_DIGITAL = {
    'Свет1': 0,
    'Свет2': 0,
    'Свет3': 0
}

def load_state():
    """Загружает состояние из файла или возвращает значения по умолчанию"""
    if os.path.exists(STATE_FILE):
        try:
            with open(STATE_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            print(f"Ошибка чтения {STATE_FILE}: {e}. Используются значения по умолчанию.")
    
    # Если файла нет или произошла ошибка, возвращаем структуру по умолчанию
    return {
        "analog": DEFAULT_ANALOG,
        "digital": DEFAULT_DIGITAL
    }

def save_state(state_data):
    """Сохраняет текущее состояние в файл"""
    try:
        with open(STATE_FILE, 'w', encoding='utf-8') as f:
            # indent=4 делает файл красивым и читаемым
            # ensure_ascii=False сохраняет кириллицу в нормальном виде
            json.dump(state_data, f, indent=4, ensure_ascii=False)
    except Exception as e:
        print(f"Ошибка записи в {STATE_FILE}: {e}")

# Загружаем состояние при старте приложения
app_state = load_state()
variables = app_state["analog"]
digital_vars = app_state["digital"]

@app.route('/')
def index():
    return render_template('index.html', variables=variables, digital_vars=digital_vars)

@app.route('/update', methods=['POST'])
def update_value():
    data = request.get_json()
    var_id = data.get('id')
    
    if not var_id:
        return jsonify({"status": "error", "message": "Нет ID"}), 400

    # --- Обработка аналоговых переменных ---
    if var_id in variables:
        var = variables[var_id]
        
        if 'value' in data:
            var['value'] = max(var['min'], min(int(data['value']), var['max']))
        if 'min' in data:
            var['min'] = int(data['min'])
            if var['value'] < var['min']: var['value'] = var['min']
        if 'max' in data:
            var['max'] = int(data['max'])
            if var['value'] > var['max']: var['value'] = var['max']
            
        if var['min'] > var['max']:
            var['min'], var['max'] = var['max'], var['min']
            
        print(f"[ANALOG] {var_id} -> Val: {var['value']}, Min: {var['min']}, Max: {var['max']}")
        
        # Сохраняем изменения на диск
        save_state(app_state)
        
        return jsonify({"status": "success", "type": "analog", "id": var_id, "data": var})

    # --- Обработка цифровых переменных ---
    elif var_id in digital_vars:
        if 'action' in data and data['action'] == 'invert':
            digital_vars[var_id] = 1 - digital_vars[var_id]
        elif 'value' in data:
            digital_vars[var_id] = 1 if int(data['value']) else 0
            
        print(f"[DIGITAL] {var_id} -> Val: {digital_vars[var_id]}")
        
        # Сохраняем изменения на диск
        save_state(app_state)
        
        return jsonify({"status": "success", "type": "digital", "id": var_id, "value": digital_vars[var_id]})
        
    return jsonify({"status": "error", "message": "Переменная не найдена"}), 400

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)