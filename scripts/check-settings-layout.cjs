// Browser layout regression fixture: production CSS, structural Settings markup.
// This does not impersonate the native backend or verify native window controls.
async (page) => {
  await page.goto('http://127.0.0.1:1421/?window=settings');
  await page.evaluate(async () => {
    await import('/src/styles.css');
    await import('/src/surfaces/settings/SettingsStudio.css');
    document.body.innerHTML = `<main class="settings-surface settings-surface--full"><div class="settings settings-studio" data-navigation="side">
      <div class="settings-titlebar">Settings</div>
      <div class="settings-studio-toolbar"><strong>QuotaArc</strong><label>Navigation <select><option>Sidebar</option></select></label></div>
      <nav class="settings-tabs" role="tablist">${['General','Providers','Notifications','Menu Bar','Menu','Usage & Spend','Surfaces','Themes','Advanced','About'].map((s,i)=>`<button role="tab" class="settings-tab" aria-selected="${i===6}">${s}</button>`).join('')}</nav>
      <div class="settings-body">${Array.from({length:20},()=>'<section class="settings-section"><h2>Provider preferences</h2><p>Detailed options remain reachable inside the content scroll area.</p></section>').join('')}</div>
    </div></main>`;
  });
  const results = [];
  for (const [width,height] of [[520,440],[720,660],[1280,720],[1920,1080]]) {
    await page.setViewportSize({width,height});
    for (const mode of ['side','top','bottom']) {
      await page.evaluate(mode=>{
        document.querySelector('.settings-studio').dataset.navigation=mode;
        document.querySelector('.settings-tabs').scrollTop=0;
        document.querySelector('.settings-tabs').scrollLeft=0;
      },mode);
      const result=await page.evaluate(()=>{
        const nav=document.querySelector('.settings-tabs'), body=document.querySelector('.settings-body');
        const rect=el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom};};
        const n=rect(nav), b=rect(body), first=rect(nav.firstElementChild), root=rect(document.querySelector('.settings-studio'));
        return {n,b,first,root,ok:n.h>20 && n.y>=0 && n.bottom<=innerHeight+1 && n.right<=innerWidth+1 && first.x>=n.x-1 && first.y>=n.y-1 && b.h>50 && b.bottom<=innerHeight+1 && root.h<=innerHeight+1};
      });
      results.push({width,height,mode,...result});
    }
  }
  if(results.some(r=>!r.ok))throw Error('Settings navigation/content escapes the viewport');
  return {passed:results.length, results};
}
