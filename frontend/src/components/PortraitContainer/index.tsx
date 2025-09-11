import { displayImage } from "../../utils/displayImage";
import "./style.css"

export const PortraitContainer = (imagePath: string) => {
  return (
    <div className="portrait-container">
      <img src={displayImage(imagePath, 'driver')} alt={`${imagePath} portrait`} />
      </div>
  );
}