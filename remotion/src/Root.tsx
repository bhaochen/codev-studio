import React from "react";
import { Composition } from "remotion";
import { CodevStudioDemo } from "./compositions/CodevStudioDemo";
import { VIDEO, TOTAL_DURATION } from "./lib/constants";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="CodevStudioDemo"
        component={CodevStudioDemo}
        durationInFrames={TOTAL_DURATION}
        fps={VIDEO.FPS}
        width={VIDEO.WIDTH}
        height={VIDEO.HEIGHT}
      />
    </>
  );
};
