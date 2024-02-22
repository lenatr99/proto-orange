import Dropdown from 'react-bootstrap/Dropdown';
import widgetRepo from "../widgets/index";

const WidgetMenu = ({x, y, action}) => {
    return <Dropdown.Menu show style={{position: "absolute", left: x, top: y}}>
              { Object.keys(widgetRepo).map((name) =>
                  <Dropdown.Item href="" key={name} onClick={() => action(name)}>{name}</Dropdown.Item>) }
          </Dropdown.Menu>
};

export default WidgetMenu;