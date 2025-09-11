import { displayImage } from "../../utils/displayImage";
import "./style.css"

export const PortraitContainerTeam = (imagePath: string) => {
  return (
    <div className="portrait-team-container">
      <img src={displayImage(imagePath, 'team')} alt={`${imagePath} portrait`} />
      </div>
  );
}