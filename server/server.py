from collections import defaultdict
import json
import logging

from flask import Flask, request
from flask_socketio import SocketIO
from flask_cors import CORS

from pymongo import MongoClient

from widgets import widget_repo, signal_manager


werkzeug_logger = logging.getLogger('werkzeug')
werkzeug_logger.setLevel(logging.ERROR)
# logging.basicConfig(level=logging.DEBUG)

app = Flask(__name__)
socketio = SocketIO(app, cors_allowed_origins="*", async_handlers=False)
client = MongoClient('localhost', 27017)  # Connect to MongoDB
db = client['widget_app']  # Select the database
sessions_collection = db['sessions']  # Select the collection
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

            current_session = value.get('sessionId', None)
            del value['sessionId']
            settings[widget_id].update(value)
            widget_instances[widget_id].handle(value)
            sessions_collection.update_one(
                {'sessionId': current_session, 'widgets.widgetId': widget_id},
                {'$set': {'widgets.$.settings': settings[widget_id]}}
            )


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
    current_session = value.get('sessionId', None)
    del value['sessionId']
    match value.get('type'):
        case 'addWidget':
            widgets[widgetId] = value
            widget_instances[widgetId] = widget_repo[value['widgetType']](widgetId)
            settings[widgetId] = {}
            add_widget_listener(widgetId)
            widget_data = {
                "widgetId": widgetId,
                "widgetType": value['widgetType'],
                "x": value.get('x', 0),
                "y": value.get('y', 0),
            }
            session = sessions_collection.find_one({'sessionId': current_session})
            if session:
                sessions_collection.update_one(
                    {'sessionId': current_session},
                    {'$push': {'widgets': widget_data}}
                )
            else:
                sessions_collection.insert_one({
                    'sessionId': current_session,
                    'widgets': [widget_data],
                    'connections': []
                })
        case 'removeWidgets':
            for widgetId in value["selection"]:
                session = sessions_collection.find_one({'sessionId': current_session})
                if session:
                    sessions_collection.update_one(
                        {'sessionId': current_session},
                        {'$pull': {'widgets': {'widgetId': widgetId}}}
                    )
                remove_widget(widgetId)
        case 'moveWidget':
            session = sessions_collection.find_one({'sessionId': current_session})
            if session:
                sessions_collection.update_one(
                    {'sessionId': current_session, 'widgets.widgetId': widgetId},
                    {'$set': {'widgets.$.x': value['x'], 'widgets.$.y': value['y']}}
                )
                print("changing widget position")
        case action:
            logging.error(f'unknown action: {action} with {value}')
    logging.debug(str(widgets))


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
            sessions_collection.update_one(
                {'sessionId': value['sessionId']},
                {'$push': {'connections': {'sourceId': sourceId, 'targetId': targetId}}}
            )
        case {'type': 'removeConnection', 'sourceId': sourceId, 'targetId': targetId}:
            sessions_collection.update_one(
                {'sessionId': value['sessionId']},
                {'$pull': {'connections': {'sourceId': sourceId, 'targetId': targetId}}}
            )
        case {'type': 'removeWidgets', 'selection': selection}:
            for widgetId in selection:
                sessions_collection.update_one(
                    {'sessionId': value['sessionId']},
                    {'$pull': {'widgets': {'widgetId': widgetId}}}
                )
                #remove connection in db
                sessions_collection.update_one(
                    {'sessionId': value['sessionId']},
                    {'$pull': {'connections': {'sourceId': widgetId}}}
                )
                sessions_collection.update_one(
                    {'sessionId': value['sessionId']},
                    {'$pull': {'connections': {'targetId': widgetId}}}
                )
        case action:
            logging.error(f'unknown action: {action} with {value}')
    logging.debug(signal_manager.connections)


@socketio.on('connect')
def handle_message(message):
    logging.info("new connection")


@socketio.on('load-session')
def load_session(data):
    session_id = data['sessionId']
    session_data = sessions_collection.find_one({'sessionId': session_id}, {'_id': 0})
    if session_data:
        socketio.emit('session-data', session_data, to=request.sid)
    else:
        # Handle case where session is not found
        socketio.emit('error', {'message': 'Session not found'}, to=request.sid)



if __name__ == '__main__':
    socketio.run(app, host="0.0.0.0", port=4000, debug=True, allow_unsafe_werkzeug=True)