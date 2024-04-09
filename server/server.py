from collections import defaultdict
import json
import logging
from db import *

from flask import Flask, request
from flask_socketio import SocketIO
from flask_cors import CORS

from widgets import widget_repo, signal_manager


werkzeug_logger = logging.getLogger('werkzeug')
werkzeug_logger.setLevel(logging.ERROR)
# logging.basicConfig(level=logging.DEBUG)

app = Flask(__name__)
socketio = SocketIO(app, cors_allowed_origins="*", async_handlers=False)
CORS(app, resources={"*": {"origins": "*"}})


@app.route('/')
def index():
    return "Nothing to see here"

widget_actions = []
widget_settings_actions = {}
widgets = {}
widget_instances = {}

connection_actions = []


settings = defaultdict(dict)

# init_db(app)

@socketio.on('widget-action')
def handle_message(message):
    def add_widget_listener(widget_id):
        print('adding listener')
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
            widget_instances[widget_id].handle(value)

        socketio.on_event(event_name, handle_message)
        logging.info(f'added listener for {event_name}')
    def remove_widget_listener(widget_id):
        event_name = f'widget-settings-{widget_id}'
        del socketio.server.handlers["/"][event_name]
        del widget_settings_actions[widget_id]
        logging.info(f'removed listener for {event_name}')

    def remove_widget(widget_id):
        del widgets[widget_id]
        del widget_instances[widget_id]
        del settings[widget_id]
        remove_widget_listener(widget_id)
        signal_manager.remove_widget(widget_id)
                
    db = get_db()
    cursor = db.cursor()
    
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
    session_id = value.get('sessionId', None)
    del value['sessionId']
    match value.get('type'):
        case 'addWidget':
            widgets[widgetId] = value
            widget_instances[widgetId] = widget_repo[value['widgetType']](widgetId)
            settings[widgetId] = {}
            add_widget_listener(widgetId)
            cursor.execute('INSERT INTO widgets (widget_id, session_id, settings) VALUES (?, ?, ?)',
                           (widgetId, session_id, json.dumps(value)))
            db.commit()
        case 'removeWidget':
            remove_widget(widgetId)
        case 'removeWidgets':
            for widgetId in value["selection"]:
                remove_widget(widgetId)
        case 'moveWidget':
            widgets[widgetId].update(value)
        case action:
            logging.error(f'unknown action: {action} with {value}')
    logging.debug(str(widgets))
    
    
def add_widget_listener(widget_id):
    print('adding listener')
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
        widget_instances[widget_id].handle(value)

    socketio.on_event(event_name, handle_message)
    logging.info(f'added listener for {event_name}')


def send_setting(widget_id, data):
    logging.info(f'widget {widget_id} was sent {data}')
    settings[widget_id].update(data)
    socketio.emit(f'widget-settings-{widget_id}', json.dumps(data), broadcast=True)


@socketio.on('connection-action')
def handle_message(message):
    if message == 'init_request':
        socketio.emit('connection-action',
                      json.dumps(dict(type='init', connections=list(signal_manager.connections))),
                      to=request.sid)
        return

    value = json.loads(message)
    logging.info(f'connection-action: {value}')

    connection_actions.append(message)
    socketio.emit('connection-action', message, broadcast=True)

    match value:
        case {'type': 'addConnection', 'sourceId': sourceId, 'targetId': targetId}:
            signal_manager.connect(sourceId, targetId)
            # Add to database
            db = get_db()
            cursor = db.cursor()
            cursor.execute('INSERT INTO connections (source_id, target_id, session_id) VALUES (?, ?, ?)',
                           (sourceId, targetId, value['sessionId']))
            db.commit()
        case {'type': 'removeConnection', 'sourceId': sourceId, 'targetId': targetId}:
            signal_manager.disconnect(sourceId, targetId)
        case {'type': 'removeWidgets', 'selection': selection}:
            for widgetId in selection:
                signal_manager.remove_widget(widgetId)
        case action:
            logging.error(f'unknown action: {action} with {value}')
    logging.debug(signal_manager.connections)


@socketio.on('connect')
def handle_message(message):
    logging.info("new connection")
    
    
@socketio.on('load-session')
def load_session(data):
    session_id = data['sessionId']
    # check in database if session exists
    db = get_db()
    cursor = db.cursor()
    cursor.execute('SELECT id FROM sessions WHERE session_id = ?', (session_id,))
    row = cursor.fetchone()
    if row:
        print('Session exists')
        cursor.execute('SELECT widget_id, settings FROM widgets WHERE session_id = ?', (session_id,))
        widgets_session = cursor.fetchall()
        # initialize these widgets on the client without session_id
        for widget in widgets_session:
            widget_id, settings_session = widget
            socketio.emit('widget-action', json.dumps({'type': 'addWidget', 'widgetId': widget_id, **json.loads(settings_session)}))
            widget_actions.append(json.dumps({'type': 'addWidget', 'widgetId': widget_id, **json.loads(settings_session)}))
            # start their listeners
            widgetId = widget_id
            widgets[widgetId] = json.loads(settings_session)
            widget_instances[widgetId] = widget_repo[widgets[widgetId]['widgetType']](widgetId)
            settings[widgetId] = {}
            add_widget_listener(widget_id)
        cursor.execute('SELECT source_id, target_id FROM connections WHERE session_id = ?', (session_id,))
        connections = cursor.fetchall()
        for connection in connections:
            source_id, target_id = connection
            socketio.emit('connection-action', json.dumps({'type': 'addConnection', 'sourceId': source_id, 'targetId': target_id}))
            connection_actions.append(json.dumps({'type': 'addConnection', 'sourceId': source_id, 'targetId': target_id}))
        print(widget_instances)
        
    else:
        logging.error(f"Session {session_id} not found. Creating new session.")
        cursor.execute('INSERT INTO sessions (session_id) VALUES (?)', (session_id,))
        db.commit()


if __name__ == '__main__':
    socketio.run(app, host="0.0.0.0", port=4000, debug=True, allow_unsafe_werkzeug=True)