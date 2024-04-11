import numpy as np
from db import get_db
import json

import Orange


class SignalManager:
    def __init__(self):
        self.connections = set()
        self.output_cache = {}

    def connect(self, source_id, target_id):
        self.connections.add((source_id, target_id))
        if source_id in self.output_cache:
            Widget.widgets[target_id].input(self.output_cache[source_id])

    def disconnect(self, source_id, target_id):
        Widget.widgets[target_id].input(None)
        self.connections.discard((source_id, target_id))

    def remove_widget(self, widget_id):
        self.connections.difference_update(
            {c for c in self.connections if widget_id in c})
        self.output_cache.pop(widget_id, None)

    def send(self, widget_id, data):
        self.output_cache[widget_id] = data
        for source, target in self.connections:
            if source == widget_id:
                Widget.widgets[target].input(data)
                
    def clear(self):
        self.connections.clear()
        self.output_cache.clear()


signal_manager = SignalManager()


class Widget:
    widgets = {}

    def __init__(self, widget_id):
        self.widget_id = widget_id
        self.widgets[widget_id] = self

    def __del__(self):
        try:
            del self.widgets[self.widget_id]
        except KeyError:
            pass

    def handle(self, message):
        self.update_db(message)

    def input(self, data):
        pass

    def send(self, data):
        signal_manager.send(self.widget_id, data)

    def emit(self, data):
        from server import send_setting
        send_setting(self.widget_id, data)

    def message(self, text, details, msg_type):
        self.emit({"widget_error": dict(
            text=text,
            details=details,
            type=msg_type)})
        
    def update_db(self, message):
        db = get_db()
        cursor = db.cursor()
        cursor.execute('SELECT * FROM settings WHERE widget_id = ?', (self.widget_id,))
        if not cursor.fetchone():
            cursor.execute('INSERT INTO settings (widget_id, settings) VALUES (?, ?)', (self.widget_id, json.dumps(message)))
        else:
            cursor.execute('UPDATE settings SET settings = ? WHERE widget_id = ?', (json.dumps(message), self.widget_id))
        db.commit()

    def error(self, text, details=None):
        self.message(text, details, "danger")

    def warning(self, text, details=None):
        self.message(text, details, "warning")

    def info(self, text, details=None):
        self.message(text, details, "info")

    def clear_messages(self):
        self.emit({"widget_error": None})


class DataSetWidget(Widget):
    name = "Data Set"

    def __init__(self, widget_id):
        super().__init__(widget_id)
        self.url = None
        self.data = None
        self.update()

    def handle(self, message):
        super().handle(message)
        self.url = message.get('url', None)
        self.update()

    def update(self):
        self.clear_messages()
        if not self.url:
            self.data = None
            self.info("No data", "Enter an URL to load data")
        else:
            try:
                self.data = self.url and Orange.data.Table(self.url)
            except Exception as e:
                self.data = None
                self.error("Error while loading data", str(e))
        self.send(self.data)


class InfoWidget(Widget):
    name = "Info"

    def input(self, data):
        self.clear_messages()
        if data is None:
            self.info("No data", "No data loaded")
            self.emit({"instances": None, "attributes": None})
        else:
            self.emit({"instances": len(data),
                       "attributes": len(data.domain.attributes)})


class ScatterPlotWidget(Widget):
    name = "Scatter Plot"

    def __init__(self, widget_id):
        super().__init__(widget_id)
        self.data = None
        self.x = None
        self.y = None

    def input(self, data):
        self.data = data
        if self.data is None:
            self.x = self.y = self.color = None
            self.emit({"attrs": [], "x": None, "y": None})
        else:
            names = [a.name for a in self.data.domain.variables]
            self.x, self.y = data.domain.attributes[:2]
            self.color = None
            self.emit({"attrs": names, "x": names[0], "y": names[1], "color": None})
        self.update()

    def handle(self, message):
        super().handle(message)
        domain = self.data.domain
        if "x" in message:
            self.x = domain[message["x"]]
        if "y" in message:
            self.y = domain[message["y"]]
        self.update()

    def update(self):
        if self.data is None:
            self.emit(dict(datax=None, datay=None))
            return

        colx = self.data.get_column(self.x)
        coly = self.data.get_column(self.y)
        mask = ~np.isnan(colx) & ~np.isnan(coly)
        self.emit({"datax": colx[mask].tolist(),
                   "datay": coly[mask].tolist()})


widget_repo = {
    "Data Set": DataSetWidget,
    "Info": InfoWidget,
    "Scatter Plot": ScatterPlotWidget
}