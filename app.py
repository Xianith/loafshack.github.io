from flask import Flask, render_template, jsonify
import json
import os

app = Flask(__name__, static_folder='static', template_folder='templates')


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/events')
def events():
    here = os.path.dirname(__file__)
    data_file = os.path.join(here, 'data', 'events.json')
    with open(data_file, 'r', encoding='utf-8') as f:
        data = json.load(f)
    return jsonify(data)


if __name__ == '__main__':
    app.run(debug=True)
