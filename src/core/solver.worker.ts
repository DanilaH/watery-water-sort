import {solveHint} from './hintSolver';
self.onmessage=(event)=>{const {board,goal,revision,requestId,level,extra}=event.data;self.postMessage({result:solveHint(board,goal,level,extra),revision,requestId});};
