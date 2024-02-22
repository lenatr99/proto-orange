import Orange


class SignalManager:
    def __init__(self):
        self.connections = set()

    def send(self, widget_id, data):
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


class DataSetWidget(Widget):
    name = "Data Set"

    def __init__(self, widget_id):
        super().__init__(widget_id)
        self.url = None
        self.data = None

    def handle(self, message):
        self.url = message.get('url', None)
        self.data = self.url and Orange.data.Table(self.url)
        self.send(self.data)


class InfoWidget(Widget):
    name = "Info"

    def input(self, data):
        self.emit({"instances": len(data),
                   "attributes": len(data.domain.attributes)})


widget_repo = {
    "Data Set": DataSetWidget,
    "Info": InfoWidget
}