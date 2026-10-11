import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { it } from "node:test";

import {
  calendarColumnStyle,
  calendarRowStyle,
} from "@features/calendar/month-grid-layout";

it("native Yoga keeps seven aligned columns at affected and normal widths", () => {
  const directory = mkdtempSync(join(tmpdir(), "calendar-yoga-regression-"));
  try {
    const yogaRoot = resolve("node_modules/react-native/ReactCommon/yoga");
    const source = join(directory, "check.cpp");
    const binary = join(directory, "check");
    const direction =
      calendarRowStyle.flexDirection === "row"
        ? "YGFlexDirectionRow"
        : "YGFlexDirectionColumn";
    writeFileSync(
      source,
      `
#include <yoga/Yoga.h>
#include <cstdio>
#include <initializer_list>
int main() {
  for (float screen : {360.f,375.f,390.f,393.f,402.f,412.f,414.f,430.f,440.f}) {
    for (float scale : {1.f,2.f,3.f}) {
      auto config=YGConfigNew();
      YGConfigSetErrata(config,YGErrataAll);
      YGConfigSetPointScaleFactor(config,scale);
      auto root=YGNodeNewWithConfig(config);
      YGNodeStyleSetWidth(root,screen);
      YGNodeStyleSetPadding(root,YGEdgeHorizontal,18);
      for(int row=0;row<7;row++) {
        auto week=YGNodeNewWithConfig(config);
        YGNodeStyleSetFlexDirection(week,${direction});
        YGNodeInsertChild(root,week,row);
        for(int column=0;column<7;column++) {
          auto cell=YGNodeNewWithConfig(config);
          YGNodeStyleSetFlex(cell,${calendarColumnStyle.flex});
          YGNodeStyleSetMinWidth(cell,${calendarColumnStyle.minWidth});
          YGNodeStyleSetMinHeight(cell,row==0?15:52);
          YGNodeInsertChild(week,cell,column);
        }
      }
      YGNodeCalculateLayout(root,screen,YGUndefined,YGDirectionLTR);
      auto header=YGNodeGetChild(root,0);
      for(int row=1;row<7;row++) {
        auto week=YGNodeGetChild(root,row);
        if(YGNodeLayoutGetHeight(week)!=52) return 1;
        for(int column=0;column<7;column++) {
          auto cell=YGNodeGetChild(week,column);
          auto heading=YGNodeGetChild(header,column);
          if(YGNodeLayoutGetTop(cell)!=0 ||
             YGNodeLayoutGetLeft(cell)!=YGNodeLayoutGetLeft(heading) ||
             YGNodeLayoutGetWidth(cell)!=YGNodeLayoutGetWidth(heading) ||
             YGNodeLayoutGetWidth(cell)<=0) {
            std::fprintf(stderr,"Misaligned screen=%.0f scale=%.0f row=%d column=%d\\n",screen,scale,row,column);
            return 1;
          }
        }
      }
      YGNodeFreeRecursive(root);
      YGConfigFree(config);
    }
  }
  std::puts("27 width/scale configurations: six seven-column weeks align with headers");
}
`,
    );
    const sources = readdirSync(join(yogaRoot, "yoga"), { recursive: true })
      .filter((path) => typeof path === "string" && path.endsWith(".cpp"))
      .map((path) => join(yogaRoot, "yoga", String(path)));
    const compile = spawnSync(
      "c++",
      ["-std=c++20", `-I${yogaRoot}`, source, ...sources, "-o", binary],
      { encoding: "utf8" },
    );
    assert.equal(
      compile.status,
      0,
      `C++ compiler required for native Yoga regression: ${compile.error?.message ?? compile.stderr}`,
    );
    const result = spawnSync(binary, [], { encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
