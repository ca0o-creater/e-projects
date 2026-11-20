import {scene2Config as c} from '../config/scene2.config.ts';
export function moonExitAt(state:string,endingElapsed:number){
 const success=state==='swallowing'||state==='complete';
 const p=success?Math.max(0,Math.min(1,(endingElapsed-c.ending.swallowSeconds)/c.moon.fadeSeconds)):0;
 const finished=endingElapsed>=c.ending.swallowSeconds+c.ending.riseSeconds;
 return {alpha:p*p*(3-2*p),enabled:state==='complete'&&finished&&p===1};
}
