import { displayImage } from "../../utils/displayImage";
import "./style.css"

export const PortraitContainer = (imagePath: string) => {
  return (
    <div className="portrait-container">
      <img loading="lazy" src={displayImage(imagePath, 'driver')} alt={`${imagePath} portrait`} />
      </div>
  );
}