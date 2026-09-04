async (page) => {
  const themes = [
    "01-obsidian-orbit",
    "02-aurora-bloom",
    "03-solar-ember",
    "05-noir-constellation",
    "07-eclipse-dial",
    "12-crimson-nova",
    "15-astral-dune",
  ];

  await page.setViewportSize({ width: 1100, height: 720 });
  for (const slug of themes) {
    await page.goto(
      `http://127.0.0.1:4173/?window=demo&gen=v8&catalog=${slug}&surface=taskbar&proof=motion&motion=full`,
    );
    const proof = page.locator(".qa-taskbar-motion-proof");
    const target = page.locator(".qa-taskbar-node").nth(1);
    await proof.waitFor();
    await page.waitForTimeout(700);

    const directory = `output/playwright/motion/${slug}`;
    await proof.screenshot({ path: `${directory}/01-idle.png`, animations: "allow" });

    await target.hover();
    await page.waitForTimeout(120);
    await proof.screenshot({ path: `${directory}/02-hover.png`, animations: "allow" });

    await target.click();
    await page.mouse.move(8, 8);
    await page.waitForTimeout(180);
    await proof.screenshot({ path: `${directory}/03-focus.png`, animations: "allow" });

    const duration = await proof.locator(".qa-taskbar-stage").evaluate((element) =>
      parseFloat(getComputedStyle(element).getPropertyValue("--qa-theme-motion-duration")) || 300,
    );
    await page.getByRole("button", { name: "Expand quota instrument" }).click();
    await page.waitForTimeout(Math.max(50, duration * 0.34));
    await proof.screenshot({ path: `${directory}/04-expand-mid.png`, animations: "allow" });
    await page.waitForTimeout(duration + 120);
    await proof.screenshot({ path: `${directory}/05-expanded.png`, animations: "allow" });

    await page.getByRole("button", { name: "Collapse quota instrument" }).click();
    await page.waitForTimeout(Math.max(50, duration * 0.34));
    await proof.screenshot({ path: `${directory}/06-collapse-mid.png`, animations: "allow" });
    await page.waitForTimeout(duration + 120);
    await proof.screenshot({ path: `${directory}/07-collapsed.png`, animations: "allow" });
  }

  return themes.length;
}
