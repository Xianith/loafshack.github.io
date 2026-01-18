Loafshack Timeline Map
======================

Minimal Flask app that shows a Leaflet map with a timeline slider.

Requirements
- Python 3.8+
- pip

Install

PowerShell (Windows):
```
python -m venv .venv; .\.venv\Scripts\Activate.ps1; pip install -r requirements.txt
```

Run
```
$env:FLASK_APP = 'app.py'; flask run
```

Open http://127.0.0.1:5000 in your browser.

Notes
- `data/events.json` contains sample events. Edit or replace with your own data (ISO 8601 dates).
- Frontend uses Leaflet and noUiSlider from CDNs.
