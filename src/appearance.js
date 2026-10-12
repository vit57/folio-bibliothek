import {normalizeReadingPreferences} from './reading-preferences.js';
export function resolvedAppearance(preferences,systemDark=false) {
  return preferences.appTheme==='dark'||preferences.appTheme==='system'&&systemDark?'dark':'light';
}
export function migrateAppearance(preferences) {
  const next={...preferences};
  if(next.typographyVersion!==2){
    if(!Number.isFinite(next.size)||next.size<24)next.size=26;
    next.uiScale=Number.isFinite(next.uiScale)?next.uiScale:1.1;
    next.animationStyle='fade';next.typographyVersion=2;
  }
  next.uiScale=Math.max(1,Math.min(1.6,Number(next.uiScale)||1.1));
  next.appTheme=['light','dark','system'].includes(next.appTheme)?next.appTheme:'system';
  if(next.motionVersion!==3){next.animationStyle='page';next.motionVersion=3;}
  next.animationStyle=['page','fade','slide'].includes(next.animationStyle)?next.animationStyle:'page';
  if(next.readerExperienceVersion!==1){next.guideDim=true;next.guideDimming='medium';next.themeLinked=true;next.readingSurface='integrated';next.readerExperienceVersion=1;}
  return normalizeReadingPreferences(next);
}
