from server import app, socketio

if __name__ == '__main__':
    socketio.run(app, port=4000, debug=True, allow_unsafe_werkzeug=True)