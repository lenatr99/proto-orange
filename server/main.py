import json

from flask import Flask
from flask_socketio import SocketIO
from flask_cors import CORS

app = Flask(__name__)
socketio = SocketIO(app, cors_allowed_origins="*")


CORS(app, resources={"*": {"origins": "*"}})

@app.route('/')
def index():
	return "Nothing to see here"


widget_actions = []
connection_actions = []
widget_settings = {}


@socketio.on('widget-action')
def handle_message(message):
    def add_widget_listener(widget_id):
        event_name = f'widget-settings-{widget_id}'
        widget_settings[widget_id] = []
        def handle_message(message):
            print(event_name, json.loads(message))
            widget_settings[action["id"]].append(message)
            socketio.emit(event_name, message, broadcast=True)
        socketio.on_event(event_name, handle_message)
        print('added listener for', event_name)
        print(socketio.server.handlers["/"])

    def remove_widget_listener(widget_id):
        event_name = f'widget-settings-{widget_id}'
        del socketio.server.handlers["/"][event_name]
        del widget_settings[widget_id]
        print('removed listener for', event_name)

    print('widget-action:', json.loads(message))
    widget_actions.append(message)
    socketio.emit('widget-action', message, broadcast=True)
    action = json.loads(message)
    if action['type'] == 'addWidget':
         add_widget_listener(action['id'])
    if action['type'] == 'removeWidget':
        remove_widget_listener(action['id'])
    if action["type"] == 'removeWidgets':
        for widgetId in action["selection"]:
            remove_widget_listener(widgetId)


@socketio.on('connection-action')
def handle_message(message):
    print('connection-action:', json.loads(message))
    connection_actions.append(message)
    socketio.emit('connection-action', message, broadcast=True)


@socketio.on('connect')
def handle_message(message):
    print("new connection")
    for action in widget_actions:
        socketio.emit('widget-action', action, broadcast=True)
    for action in connection_actions:
        socketio.emit('connection-action', action, broadcast=True)
    for widgetId in widget_settings:
        event_name = f'widget-settings-{widgetId}'
        for action in widget_settings[widgetId]:
            socketio.emit(event_name, action, broadcast=True)


if __name__ == '__main__':
    socketio.run(app, port=4000) #, debug=True)