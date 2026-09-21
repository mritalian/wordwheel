import { Router } from "./core/Router.js";
import { LadderSelectScreen } from "./screens/LadderSelectScreen.js";
import { LevelSelectScreen } from "./screens/LevelSelectScreen.js";
import { GameplayScreen } from "./screens/GameplayScreen.js";
import { LevelCompleteScreen } from "./screens/LevelCompleteScreen.js";
import { SettingsScreen } from "./screens/SettingsScreen.js";

const root = document.getElementById("app-root");
const router = new Router(
  {
    ladderSelect: LadderSelectScreen,
    levelSelect: LevelSelectScreen,
    gameplay: GameplayScreen,
    levelComplete: LevelCompleteScreen,
    settings: SettingsScreen,
  },
  root
);

router.goTo("ladderSelect");
