from collections import defaultdict
import json
import logging

from flask import Flask, request
from flask_socketio import SocketIO
from flask_cors import CORS

werkzeug_logger = logging.getLogger('werkzeug')
werkzeug_logger.setLevel(logging.ERROR)
# logging.basicConfig(level=logging.DEBUG)

app = Flask(__name__)
socketio = SocketIO(app, cors_allowed_origins="*")
CORS(app, resources={"*": {"origins": "*"}})


@app.route('/')
def index():
	return "Nothing to see here"


widget_actions = []
connection_actions = []
widget_settings_actions = {}

widgets = {}
connections = set()
settings = defaultdict(dict)


@socketio.on('widget-action')
def handle_message(message):
    def add_widget_listener(widget_id):
        event_name = f'widget-settings-{widget_id}'
        widget_settings_actions[widget_id] = []
        def handle_message(message):
            if message == "init_request":
                socketio.emit(event_name,
                              json.dumps(settings[widget_id]),
                              to=request.sid)
                return

            value = json.loads(message)
            logging.info(f'{event_name}: {value}')

            widget_settings_actions[widget_id].append(message)
            socketio.emit(event_name, message, broadcast=True)

            del value['sessionId']
            settings[widget_id].update(value)
            print(settings)

        socketio.on_event(event_name, handle_message)
        logging.info(f'added listener for {event_name}')

    def remove_widget_listener(widget_id):
        event_name = f'widget-settings-{widget_id}'
        del socketio.server.handlers["/"][event_name]
        del widget_settings_actions[widget_id]
        logging.info(f'removed listener for {event_name}')

    if message == 'init_request':
        socketio.emit('widget-action',
                      json.dumps(dict(type='init', widgets=widgets)),
                      to=request.sid)
        return

    value = json.loads(message)
    logging.info(f'widget-action: {value}')

    socketio.emit('widget-action', message, broadcast=True)
    widget_actions.append(message)

    widgetId = value.get('widgetId', None)
    del value['sessionId']
    match value.get('type'):
        case 'addWidget':
            widgets[widgetId] = value
            add_widget_listener(widgetId)
        case 'removeWidget':
            del widgets[widgetId]
            remove_widget_listener(widgetId)
        case 'removeWidgets':
            for widgetId in value["selection"]:
                del widgets[widgetId]
                remove_widget_listener(widgetId)
        case 'moveWidget':
            widgets[widgetId].update(value)
        case action:
            logging.error(f'unknown action: {action} with {value}')
    logging.debug(str(widgets))


@socketio.on('connection-action')
def handle_message(message):
    if message == 'init_request':
        socketio.emit('connection-action',
                      json.dumps(dict(type='init', connections=list(connections))),
                      to=request.sid)
        return

    value = json.loads(message)
    logging.info(f'connection-action: {value}')

    connection_actions.append(message)
    socketio.emit('connection-action', message, broadcast=True)

    match value:
        case {'type': 'addConnection', 'sourceId': sourceId, 'targetId': targetId}:
            connections.add((sourceId, targetId))
        case {'type': 'removeConnection', 'sourceId': sourceId, 'targetId': targetId}:
            connections.remove((sourceId, targetId))
        case {'type': 'removeWidgets', 'selection': selection}:
            selection = set(selection)
            connections.difference_update({c for c in connections if set(c) & selection})
        case action:
            logging.error(f'unknown action: {action} with {value}')
    logging.debug(connections)


@socketio.on('connect')
def handle_message(message):
    logging.info("new connection")


if __name__ == '__main__':
    socketio.run(app, port=4000) #, debug=True)