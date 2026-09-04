async (page) => {
  const themes = [
    "01-obsidian-orbit",
    "02-aurora-bloom",
    "03-solar-ember",
    "04-porcelain-halo",
    "05-noir-constellation",
    "06-halo-spine",
    "07-eclipse-dial",
    "08-prism-zenith",
    "09-quantum-orchid",
    "10-celestial-ice",
    "11-emerald-singularity",
    "12-crimson-nova",
    "13-lunar-titanium",
    "14-sapphire-observatory",
    "15-astral-dune",
  ];
  const surfaces = [
    { id: "taskbar", state: "expanded", selector: ".qa-taskbar-stage" },
    { id: "top", state: "expanded", selector: ".qa-top-orbit" },
    { id: "edge", state: "expanded", selector: ".qa-edge-orbit" },
    { id: "hud", state: "idle", selector: ".qa-floating-hud" },
    { id: "quick", state: "idle", selector: ".qa-catalog-hero--quick" },
    { id: "dashboard", state: "idle", selector: ".qa-catalog-hero--dashboard" },
  ];

  await page.setViewportSize({ width: 1440, height: 900 });
  for (const slug of themes) {
    for (const surface of surfaces) {
      const query = [
        "window=demo",
        "gen=v8",
        `catalog=${slug}`,
        `surface=${surface.id}`,
        `state=${surface.state}`,
        "motion=off",
      ].join("&");
      await page.goto(`http://127.0.0.1:4173/?${query}`);
      const element = page.locator(surface.selector);
      await element.waitFor();
      await page.waitForTimeout(90);
      await element.screenshot({
        path: `output/playwright/reference/${slug}/${surface.id}.png`,
        animations: "disabled",
      });
    }
  }

  return { themes: themes.length, surfaces: surfaces.length };
}
