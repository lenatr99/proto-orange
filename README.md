# orange4
Development of Orange 4 (web version).

For backend:
- Prepare a Python environment with pip or conda, run `pip install -r backend/requirements.txt`.
- Run `python backend/main.py`.

For frontend:
- Install the dependencies with `npm install --prefix frontend`.
- Run `npm start --prefix frontend`.
- Open [http://localhost:3000](http://localhost:3000) in one or more browsers.

If the server fails because of unexpected `broadcast=True` argument, try `pip install python-socketio==5.7.2`. Apparently `flask-socketio` has problems with newer versions of `python-socket`.
