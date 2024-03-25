import numpy as np

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
            {c for c in self.connections if widget_id in c}
        )
        self.output_cache.pop(widget_id, None)

    def send(self, widget_id, data):
        self.output_cache[widget_id] = data
        for source, target in self.connections:
            if source == widget_id:
                Widget.widgets[target].input(data)


signal_manager = SignalManager()


class Widget:
    widgets = {}

    def __init__(self, widget_id):
        self.widget_id = widget_id
        self.widgets[widget_id] = self

    def __del__(self):
        del self.widgets[self.widget_id]

    def handle(self, message):
        pass

    def input(self, data):
        pass

    def send(self, data):
        signal_manager.send(self.widget_id, data)

    def emit(self, data):
        from server import send_setting

        send_setting(self.widget_id, data)

    def message(self, text, details, msg_type):
        self.emit({"widget_error": dict(text=text, details=details, type=msg_type)})

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
        self.url = message.get("url", None)
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
            self.emit(
                {"instances": len(data), "attributes": len(data.domain.attributes)}
            )


class ScatterPlotWidget(Widget):
    name = "Scatter Plot"

    def __init__(self, widget_id):
        super().__init__(widget_id)
        self.data = None
        self.x = None
        self.xval = None
        self.y = None
        self.color = None  # Initialize color attribute
        self.selected = []
        self.last_sent_data = None

    def input(self, data):
        self.data = data
        if self.data is None:
            self.x = self.y = self.color = None
            self.emit({"attrs": [], "x": None, "y": None})
        else:
            names = [a.name for a in self.data.domain.variables]
            self.x, self.y = data.domain.attributes[:2]
            self.color = (
                data.domain.attributes[2] if len(data.domain.attributes) > 2 else None
            )
            self.emit(
                {
                    "attrs": names,
                    "x": names[0],
                    "y": names[1],
                    "colorAttr": self.color.name if self.color else None,
                }
            )
        self.update()

    def handle(self, message):
        domain = self.data.domain
        if "selected" in message:
            self.selected = message["selected"]
        if "x" in message:
            self.x = domain[message["x"]]
        if "y" in message:
            self.y = domain[message["y"]]
        if "colorAttr" in message:  # Handle color attribute change
            self.color = domain[message["colorAttr"]]
        self.update()

    def update(self):
        if self.data is None:
            self.emit(dict(datax=None, datay=None, selected=None))
            return

        colx = self.data.get_column(self.x)
        coly = self.data.get_column(self.y)
        colcolor = self.data.get_column(self.color) if self.color else None
        mask = ~np.isnan(colx) & ~np.isnan(coly)
        filtered_colx = colx[mask].tolist()
        filtered_coly = coly[mask].tolist()
        filtered_colcolor = colcolor[mask].tolist() if colcolor is not None else None

        self.emit(
            {
                "datax": colx[mask].tolist(),
                "datay": coly[mask].tolist(),
                "datacolor": filtered_colcolor,
                "selected": self.selected,
            }
        )

        data_to_send = self.data[self.selected] if self.selected else self.data

        if not np.array_equal(data_to_send, self.last_sent_data):
            self.send(data_to_send)
            self.last_sent_data = data_to_send


class TableWidget(Widget):
    name = "Table"

    def __init__(self, widget_id):
        super().__init__(widget_id)
        self.data = []
        self.data_list = []
        self.update()

    def input(self, data):
        self.clear_messages()
        if data is None:
            self.data = []
            self.emit({"data": []})
            self.info("No data", "Awaiting data...")
        else:
            try:
                self.data = data
                self.data_list = self.convert_orange_table_to_list(data)
                self.emit({"data_list": self.data_list})
            except Exception as e:
                self.error("Error processing data", str(e))
        self.update()

    def convert_orange_table_to_list(self, orange_table):
        """
        Convert an Orange data table to a list of dictionaries.
        Each dictionary represents a row, with keys as column names.
        """
        columns = [attr.name for attr in orange_table.domain.attributes]
        data_list = []
        for row in orange_table:
            row_dict = {col: row[col].value for col in columns}
            data_list.append(row_dict)
        return data_list

    def update(self):
        self.emit({"data_list": self.data_list})
        self.send(self.data)


widget_repo = {
    "Data Set": DataSetWidget,
    "Info": InfoWidget,
    "Scatter Plot": ScatterPlotWidget,
    "Table": TableWidget,
}
