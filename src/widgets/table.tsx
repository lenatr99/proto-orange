import Table from "react-bootstrap/Table";

const TableWidget = ({ settings }) => {
  const data = settings.data_list || [];

  if (data.length === 0) {
    return <div>No data available</div>;
  }

  const columnHeaders = Object.keys(data[0]);

  return (
    <Table striped bordered hover size="sm">
      <thead>
        <tr>
          {columnHeaders.map((header) => (
            <th key={header}>{header}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.map((row, index) => (
          <tr key={index}>
            {columnHeaders.map((col) => (
              <td key={col}>{row[col]}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </Table>
  );
};

TableWidget.settings = { data: null };
TableWidget.widgetName = "Table";
TableWidget.icon = (
  <g>
    <path
      fill="#333333"
      d="M6,6v36h36V6H6z M40,22L40,22v1l0,0v8l0,0v1l0,0v8h0H30h-1H19h-1H8l0,0V14l0,0h10h1h10h1h10h0V22z"
    />
    <path
      fill="#666666"
      d="M30,14h-1v8H19v-8h-1v8H8v-8l0,0v26l0,0v-8h10v8h1v-8h10v8h1v-8h10v-1H30v-8h10v-1H30V14z M18,31H8v-8h10
		V31z M29,31H19v-8h10V31z"
    />
    <rect x="8" y="32" fill="#FFFFFF" width="10" height="8" />
    <rect x="8" y="23" fill="#FFFFFF" width="10" height="8" />
    <rect x="8" y="14" fill="#FFFFFF" width="10" height="8" />
    <rect x="19" y="32" fill="#FFFFFF" width="10" height="8" />
    <rect x="19" y="23" fill="#FFFFFF" width="10" height="8" />
    <rect x="19" y="14" fill="#FFFFFF" width="10" height="8" />
    <rect x="40" y="32" fill="#FFFFFF" width="0" height="8" />
    <rect x="30" y="32" fill="#FFFFFF" width="10" height="8" />
    <rect x="40" y="23" fill="#FFFFFF" width="0" height="8" />
    <rect x="30" y="23" fill="#FFFFFF" width="10" height="8" />
    <rect x="40" y="14" fill="#FFFFFF" width="0" height="8" />
    <rect x="30" y="14" fill="#FFFFFF" width="10" height="8" />
  </g>
);

export default TableWidget;
