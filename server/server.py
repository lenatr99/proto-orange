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
        print("value", value)
        del value['sessionId']
        settings[widget_id].update(value)
        widget_instances[widget_id].handle(value)
        sessions_collection.update_one(
            {'sessionId': current_session, 'widgets.widgetId': widget_id},
            {'$set': {'widgets.$.settings': settings[widget_id]}}
        )


    socketio.on_event(event_name, handle_message)
    logging.info(f'added listener for {event_name}')

def process_widget_action(message):
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
            print("value", value)
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
        print(socketio.server.handlers["/"])
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
            # save to db if not already saved
            if not sessions_collection.find_one({'sessionId': current_session, 'widgets.widgetId': widgetId}):
                sessions_collection.update_one(
                    {'sessionId': current_session},
                    {'$push': {'widgets': widget_data}}
                )  
        case 'removeWidgets':
            for widgetId in value["selection"]:
                sessions_collection.update_one(
                    {'sessionId': current_session},
                    {'$pull': {'widgets': {'widgetId': widgetId}}}
                )
                if widgetId in widgets:
                    remove_widget(widgetId)
        case 'moveWidget':
            sessions_collection.update_one(
                {'sessionId': current_session, 'widgets.widgetId': widgetId},
                {'$set': {'widgets.$.x': value['x'], 'widgets.$.y': value['y']}}
            )
        case action:
            logging.error(f'unknown action: {action} with {value}')
    logging.debug(str(widgets))


@socketio.on('widget-action')
def handle_message(message):
    process_widget_action(message)
    


def send_setting(widget_id, data):
    logging.info(f'widget {widget_id} was sent {data}')
    settings[widget_id].update(data)
    socketio.emit(f'widget-settings-{widget_id}', json.dumps(data), broadcast=True)
    
    # #find widget in db and update settings without knowing the session id
    # sessions_collection.update_one(
    #     {'widgets.widgetId': widget_id},
    #     {'$set': {'widgets.$.settings': settings[widget_id]}}
    # )
        



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
            signal_manager.connect(sourceId, targetId)
        case {'type': 'removeConnection', 'sourceId': sourceId, 'targetId': targetId}:
            sessions_collection.update_one(
                {'sessionId': value['sessionId']},
                {'$pull': {'connections': {'sourceId': sourceId, 'targetId': targetId}}}
            )
            signal_manager.disconnect(sourceId, targetId)
        case {'type': 'removeWidgets', 'selection': selection}:
            for widgetId in selection:
                signal_manager.remove_widget(widgetId)
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
    # clear all widgets and connections
    widget_actions.clear()
    connection_actions.clear()
    signal_manager.clear()
    widgets.clear()
    widget_instances.clear()
    settings.clear()
    widget_settings_actions.clear()

@socketio.on('load-session')
def load_session(data):
    session_id = data['sessionId']
    session_data = sessions_collection.find_one({'sessionId': session_id})

    if session_data:
        # Step 1: Add all widgets
        for widget_data in session_data['widgets']:
            widget_id = widget_data['widgetId']
            widget_type = widget_data['widgetType']
            widget_instance = widget_repo[widget_type](widget_id)
            widget_instances[widget_id] = widget_instance
            widgets[widget_id] = widget_data
            settings[widget_id] = widget_data.get('settings', {})
            
            if settings[widget_id]:
                widget_instances[widget_id].handle(settings[widget_id])
                message = {
                    "widgetId": widget_id,
                    "widgetType": widget_type,
                    "x": widget_data.get('x', 0),
                    "y": widget_data.get('y', 0),
                    "settings": settings[widget_id],
                    "sessionId": session_id
                }
                #start listening for settings
                add_widget_listener(json.dumps(message))

            
            print("widget_instances", widget_instances)
            #check if it was initialized
            

        # Since all widgets are now initialized with their settings,
        # we can proceed to connect them.
        for connection in session_data['connections']:
            print("connection", connection)
            signal_manager.connect(connection['sourceId'], connection['targetId'])

        # send all widgets to the client
        socketio.emit('widget-action',
                      json.dumps(dict(type='init', widgets=widgets)),
                      to=request.sid)
        socketio.emit('connection-action',
                      json.dumps(dict(type='init', connections=list(signal_manager.connections))),
                      to=request.sid)
        
        
        for widget_data in session_data['widgets']:
            widget_id = widget_data['widgetId']
            if settings[widget_id]:
                widget_instances[widget_id].handle(settings[widget_id])
            
        
        

    else:
        logging.error(f"Session {session_id} not found. Creating new session.")
        sessions_collection.insert_one({'sessionId': session_id, 'widgets': [], 'connections': []})
        


if __name__ == '__main__':
    socketio.run(app, host="0.0.0.0", port=4000, debug=True, allow_unsafe_werkzeug=True)